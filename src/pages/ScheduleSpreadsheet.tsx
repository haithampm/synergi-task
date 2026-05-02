import { useMemo, useState } from 'react';
import { Download, Filter, Milestone, Plus, Save, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useCreateTask, useProjects, useTasks, useUpdateTask } from '@/hooks/useProjects';
import { toast } from 'sonner';

type Mode = 'view' | 'edit';
type ViewMode = 'tree' | 'table' | 'gantt' | 'milestones';
type Status = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type SortKey = 'wbs' | 'projectName' | 'title' | 'phase' | 'status' | 'priority' | 'startDate' | 'endDate' | 'durationDays' | 'progress' | 'plannedHours' | 'critical';

type Row = {
  id: string;
  persisted: boolean;
  projectId: string;
  projectName: string;
  title: string;
  phase: string;
  status: Status;
  priority: Priority;
  startDate: string;
  endDate: string;
  durationDays: number;
  progress: number;
  plannedHours: number;
  isMilestone: boolean;
  parentTaskId?: string;
  predecessorId?: string;
  wbs: string;
  level: number;
  critical: boolean;
};

const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment', 'Closure'];
const today = new Date().toISOString().slice(0, 10);
const rowHeight = 28;
const viewportHeight = 560;
const overscan = 12;
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const addDays = (value: string, days: number) => {
  const date = new Date(`${value || today}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysBetween = (start?: string, end?: string) => {
  if (!start || !end) return 1;
  const s = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
  const e = new Date(`${end.slice(0, 10)}T00:00:00`).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1 || 1);
};
const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const statusLabel = (status?: string) => status === 'todo' ? 'Tasks' : status === 'in-progress' ? 'In Progress' : String(status ?? 'Tasks').replace(/-/g, ' ');
const compare = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number'
  ? a - b
  : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });

const buildWbs = (rows: Row[]) => {
  const byParent = rows.reduce<Record<string, Row[]>>((acc, row) => {
    const key = row.parentTaskId || '__root__';
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
  const result = new Map<string, { wbs: string; level: number }>();
  const sortRows = (items: Row[]) => [...items].sort((a, b) => `${a.phase}-${a.startDate}-${a.title}`.localeCompare(`${b.phase}-${b.startDate}-${b.title}`));
  const assign = (row: Row, wbs: string, level: number) => {
    result.set(row.id, { wbs, level });
    sortRows(byParent[row.id] ?? []).forEach((child, index) => assign(child, `${wbs}.${index + 1}`, level + 1));
  };
  phases.forEach((phase, phaseIndex) => sortRows(byParent.__root__ ?? []).filter((row) => row.phase === phase).forEach((row, index) => assign(row, `${phaseIndex + 1}.${index + 1}`, 0)));
  sortRows(byParent.__root__ ?? []).filter((row) => !phases.includes(row.phase)).forEach((row, index) => assign(row, `9.${index + 1}`, 0));
  return result;
};

const Timeline = ({ row, start, span }: { row: Row; start: string; span: number }) => {
  const left = ((daysBetween(start, row.startDate) - 1) / Math.max(1, span)) * 100;
  const width = (daysBetween(row.startDate, row.endDate) / Math.max(1, span)) * 100;
  return <div className="relative h-4 min-w-[180px] rounded bg-muted">
    <div className={`absolute top-0 h-4 rounded ${row.critical ? 'bg-red-500' : row.isMilestone ? 'bg-amber-500' : row.level === 0 ? 'bg-blue-600' : 'bg-primary'}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(row.isMilestone ? 2 : 4, width)}%` }} />
    <div className="absolute top-0 h-4 rounded-l bg-white/40" style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0, Math.min(width, (width * row.progress) / 100))}%` }} />
  </div>;
};

const ScheduleSpreadsheet = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('view');
  const [view, setView] = useState<ViewMode>('tree');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? 'all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<Row>>>({});
  const [sortKey, setSortKey] = useState<SortKey>('wbs');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [scrollTop, setScrollTop] = useState(0);
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const selectedProject = projectFilter === 'all' ? undefined : projects.find((project) => project.id === projectFilter);
  const defaultProject = selectedProject ?? projects[0];

  const rows = useMemo<Row[]>(() => {
    const taskRows = tasks.map((task) => {
      const raw = task as Record<string, unknown>;
      const projectId = task.project_id ?? task.projectId ?? '';
      const project = projectMap.get(projectId);
      const startDate = String(task.start_date ?? task.due_date ?? project?.start_date ?? project?.startDate ?? today).slice(0, 10);
      const endDate = String(task.end_date ?? task.due_date ?? addDays(startDate, 2)).slice(0, 10);
      const durationDays = daysBetween(startDate, endDate);
      return {
        id: task.id,
        persisted: true,
        projectId,
        projectName: project?.name ?? task.projectName ?? 'Unassigned Project',
        title: task.title,
        phase: task.phase ?? 'Execution',
        status: (task.status ?? 'todo') as Status,
        priority: (task.priority ?? 'medium') as Priority,
        startDate,
        endDate,
        durationDays,
        progress: task.progress ?? (task.status === 'done' ? 100 : 0),
        plannedHours: task.workloadHours ?? durationDays * 8,
        isMilestone: task.isMilestone ?? false,
        parentTaskId: task.parentTaskId,
        predecessorId: Array.isArray(raw.predecessors) ? String(raw.predecessors[0] ?? '') || undefined : undefined,
        wbs: '',
        level: 0,
        critical: false,
      };
    });
    const draftRows = Object.entries(drafts).filter(([id]) => id.startsWith('draft-')).map(([, row]) => row as Row);
    const combined = [...taskRows, ...draftRows].map((row) => ({ ...row, ...drafts[row.id] }));
    const wbs = buildWbs(combined);
    const successorIds = new Set(combined.map((row) => row.predecessorId).filter(Boolean) as string[]);
    return combined.map((row) => {
      const withWbs = { ...row, ...(wbs.get(row.id) ?? { wbs: '9.9', level: 0 }) };
      const critical = (withWbs.endDate < today && withWbs.status !== 'done') || (successorIds.has(withWbs.id) && ['high', 'urgent'].includes(withWbs.priority));
      return { ...withWbs, critical };
    });
  }, [drafts, projectMap, tasks]);

  const parentIds = useMemo(() => new Set(rows.map((row) => row.parentTaskId).filter(Boolean) as string[]), [rows]);
  const taskOptions = useMemo(() => rows.map((row) => ({ id: row.id, label: `${row.wbs} ${row.title}` })), [rows]);
  const treeRows = useMemo(() => {
    const byParent = rows.reduce<Record<string, Row[]>>((acc, row) => {
      const key = row.parentTaskId || '__root__';
      acc[key] = acc[key] ?? [];
      acc[key].push(row);
      return acc;
    }, {});
    const output: Row[] = [];
    const append = (row: Row) => {
      output.push(row);
      if (collapsed.includes(row.id)) return;
      (byParent[row.id] ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(append);
    };
    (byParent.__root__ ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(append);
    return output;
  }, [collapsed, rows]);

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    const source = view === 'tree' ? treeRows : rows;
    const filtered = source.filter((row) => {
      const matchesProject = projectFilter === 'all' || row.projectId === projectFilter;
      const matchesPhase = phaseFilter === 'all' || row.phase === phaseFilter;
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || row.priority === priorityFilter;
      const matchesSearch = !search || normalize(row.wbs).includes(search) || normalize(row.projectName).includes(search) || normalize(row.title).includes(search);
      const matchesMilestone = view !== 'milestones' || row.isMilestone;
      return matchesProject && matchesPhase && matchesStatus && matchesPriority && matchesSearch && matchesMilestone;
    });
    if (view === 'tree' && sortKey === 'wbs') return filtered;
    return [...filtered].sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * compare(a[sortKey === 'critical' ? 'critical' : sortKey], b[sortKey === 'critical' ? 'critical' : sortKey]));
  }, [phaseFilter, priorityFilter, projectFilter, query, rows, sortDirection, sortKey, statusFilter, treeRows, view]);

  const timelineStart = filteredRows.map((row) => row.startDate).sort()[0] ?? today;
  const timelineEnd = filteredRows.map((row) => row.endDate).sort().at(-1) ?? addDays(today, 30);
  const timelineSpan = daysBetween(timelineStart, timelineEnd);
  const dirtyCount = Object.keys(drafts).length;
  const virtualStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const visibleRows = filteredRows.slice(virtualStart, virtualStart + visibleCount);
  const topPad = virtualStart * rowHeight;
  const bottomPad = Math.max(0, (filteredRows.length - virtualStart - visibleRows.length) * rowHeight);

  const updateDraft = (id: string, update: Partial<Row>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
  const toggleSort = (key: SortKey) => {
    setSortKey((current) => {
      if (current === key) setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      else setSortDirection('asc');
      return key;
    });
  };
  const payloadFor = (row: Row) => ({
    title: row.title,
    project_id: row.projectId,
    projectId: row.projectId,
    projectName: row.projectName,
    phase: row.phase,
    status: row.status,
    priority: row.priority,
    start_date: row.startDate,
    end_date: row.endDate,
    due_date: row.endDate,
    duration: `${daysBetween(row.startDate, row.endDate)}d`,
    progress: row.progress,
    workloadHours: row.plannedHours,
    isMilestone: row.isMilestone,
    parentTaskId: row.parentTaskId,
    predecessors: row.predecessorId ? [row.predecessorId] : [],
  });
  const saveAll = async () => {
    const dirtyRows = rows.filter((row) => drafts[row.id]);
    for (const row of dirtyRows) {
      if (row.persisted) await updateTask.mutateAsync({ id: row.id, ...payloadFor(row) });
      else await createTask.mutateAsync({ title: row.title, ...payloadFor(row) });
    }
    setDrafts({});
    toast.success(`Saved ${dirtyRows.length} schedule changes`);
  };
  const addTask = (parent?: Row, milestone = false) => {
    const project = parent ? projectMap.get(parent.projectId) : defaultProject;
    if (!project) return toast.error('Select a project first');
    const startDate = parent?.endDate ? addDays(parent.endDate, milestone ? 0 : 1) : String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    const endDate = milestone ? startDate : addDays(startDate, 2);
    const id = `draft-${Date.now()}`;
    setDrafts((current) => ({ ...current, [id]: { id, persisted: false, projectId: project.id, projectName: project.name, title: milestone ? 'New milestone' : parent ? `${parent.title} - subtask` : 'New schedule activity', phase: parent?.phase ?? 'Execution', status: 'todo', priority: milestone ? 'high' : 'medium', startDate, endDate, durationDays: daysBetween(startDate, endDate), progress: 0, plannedHours: milestone ? 0 : 24, isMilestone: milestone, parentTaskId: parent?.id, predecessorId: parent?.id, wbs: 'draft', level: parent ? parent.level + 1 : 0, critical: false } }));
    setMode('edit');
  };
  const generatePlan = async () => {
    const project = defaultProject;
    if (!project) return toast.error('Select a project first');
    const template = [['Discovery', 'Kickoff milestone', 1, true], ['Discovery', 'Requirement workshops', 5, false], ['Planning', 'Baseline schedule and resource plan', 4, false], ['Execution', 'Development sprint 1', 10, false], ['Execution', 'Development sprint 2', 10, false], ['Testing', 'Functional testing and defect resolution', 7, false], ['Testing', 'UAT sign-off milestone', 1, true], ['Deployment', 'Go-live readiness', 5, false], ['Deployment', 'Go-live milestone', 1, true], ['Closure', 'Hypercare and closure report', 5, false]] as const;
    let cursor = String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    let predecessorId: string | undefined;
    for (const [phase, title, length, milestone] of template) {
      const endDate = milestone ? cursor : addDays(cursor, length - 1);
      const created = await createTask.mutateAsync({ title, project_id: project.id, projectId: project.id, projectName: project.name, phase, status: 'todo', priority: milestone ? 'high' : 'medium', start_date: cursor, end_date: endDate, due_date: endDate, duration: `${length}d`, progress: 0, workloadHours: milestone ? 0 : length * 8, isMilestone: milestone, predecessors: predecessorId ? [predecessorId] : [] });
      predecessorId = created.id;
      cursor = addDays(endDate, 1);
    }
    toast.success('Generated project plan');
  };
  const doAction = (row: Row, action: string) => {
    if (!action) return;
    if (action === 'sub') addTask(row);
    if (action === 'indent') {
      const index = filteredRows.findIndex((item) => item.id === row.id);
      const previous = filteredRows[index - 1];
      if (previous) updateDraft(row.id, { parentTaskId: previous.id, predecessorId: previous.id, phase: previous.phase });
    }
    if (action === 'outdent') updateDraft(row.id, { parentTaskId: undefined });
    if (action === 'earlier') updateDraft(row.id, { startDate: addDays(row.startDate, -1), endDate: addDays(row.endDate, -1) });
    if (action === 'later') updateDraft(row.id, { startDate: addDays(row.startDate, 1), endDate: addDays(row.endDate, 1) });
    if (action === 'milestone') updateDraft(row.id, { isMilestone: !row.isMilestone, plannedHours: row.isMilestone ? 8 : 0 });
  };
  const exportCsv = () => {
    const lines = [['WBS', 'Project', 'Task', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration', 'Progress', 'Hours', 'Milestone', 'Dependency', 'Critical'], ...filteredRows.map((row) => [row.wbs, row.projectName, row.title, row.phase, statusLabel(row.status), row.priority, row.startDate, row.endDate, daysBetween(row.startDate, row.endDate), `${row.progress}%`, row.plannedHours, row.isMilestone ? 'Yes' : 'No', taskOptions.find((item) => item.id === row.predecessorId)?.label ?? '', row.critical ? 'Yes' : 'No'])];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'compact-master-schedule.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const header = (label: string, key: SortKey) => <th className="sticky top-0 z-20 border-b bg-background px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground"><button type="button" onClick={() => toggleSort(key)} className="hover:text-primary">{label} {sortKey === key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>;
  const cellInput = 'h-6 rounded border px-1 text-xs';
  const renderRow = (row: Row) => {
    const hasChildren = parentIds.has(row.id);
    const mainGroup = row.level === 0 && hasChildren;
    const isDirty = Boolean(drafts[row.id]);
    return <tr key={row.id} style={{ height: rowHeight }} className={`${mainGroup ? 'bg-blue-50 font-bold dark:bg-blue-950/30' : 'odd:bg-muted/20'} ${isDirty ? 'outline outline-1 outline-amber-400' : ''} ${row.critical ? 'ring-1 ring-red-500/30' : ''}`}>
      <td className="border-b px-2 py-0 text-[11px] font-mono"><span style={{ paddingLeft: `${row.level * 14}px` }} className="inline-flex items-center gap-1">{hasChildren ? <button className="rounded border px-1 font-black text-primary" onClick={() => setCollapsed((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}>{collapsed.includes(row.id) ? '+' : '-'}</button> : <span className="w-5" />}{row.wbs}</span></td>
      <td className="border-b px-2 py-0 text-xs"><Link to={`/projects?projectId=${row.projectId}`} className="font-bold text-primary underline-offset-4 hover:underline">{row.projectName}</Link></td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <Input value={row.title} onChange={(event) => updateDraft(row.id, { title: event.target.value })} className={`${cellInput} ${mainGroup ? 'font-black text-blue-800 dark:text-blue-200' : ''}`} /> : <Link to={`/tasks?projectId=${row.projectId}`} className={`underline-offset-4 hover:underline ${row.critical ? 'text-red-600' : 'text-foreground'}`}>{row.critical ? <TriangleAlert className="mr-1 inline h-3 w-3" /> : null}{row.title}</Link>}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <select value={row.phase} onChange={(event) => updateDraft(row.id, { phase: event.target.value })} className={cellInput}>{phases.map((phase) => <option key={phase}>{phase}</option>)}</select> : row.phase}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <select value={row.status} onChange={(event) => updateDraft(row.id, { status: event.target.value as Status })} className={cellInput}><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select> : statusLabel(row.status)}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <select value={row.priority} onChange={(event) => updateDraft(row.id, { priority: event.target.value as Priority })} className={cellInput}><option>low</option><option>medium</option><option>high</option><option>urgent</option></select> : row.priority}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <Input type="date" value={row.startDate} onChange={(event) => updateDraft(row.id, { startDate: event.target.value })} className={cellInput} /> : formatDate(row.startDate)}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <Input type="date" value={row.endDate} onChange={(event) => updateDraft(row.id, { endDate: event.target.value })} className={cellInput} /> : formatDate(row.endDate)}</td>
      <td className="border-b px-2 py-0 text-xs">{daysBetween(row.startDate, row.endDate)}d</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <Input type="number" min="0" max="100" value={row.progress} onChange={(event) => updateDraft(row.id, { progress: Number(event.target.value) })} className={`${cellInput} w-16`} /> : `${row.progress}%`}</td>
      <td className="border-b px-2 py-0"><Timeline row={row} start={timelineStart} span={timelineSpan} /></td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <Input type="number" min="0" value={row.plannedHours} onChange={(event) => updateDraft(row.id, { plannedHours: Number(event.target.value) })} className={`${cellInput} w-16`} /> : `${row.plannedHours}h`}</td>
      <td className="border-b px-2 py-0 text-xs">{mode === 'edit' ? <select value={row.predecessorId ?? ''} onChange={(event) => updateDraft(row.id, { predecessorId: event.target.value || undefined })} className={`${cellInput} w-44`}><option value="">No dependency</option>{taskOptions.filter((item) => item.id !== row.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select> : (taskOptions.find((item) => item.id === row.predecessorId)?.label ?? '-')}</td>
      <td className="border-b px-2 py-0 text-xs">{row.critical ? <span className="rounded bg-red-500/10 px-1 font-bold text-red-600">Critical</span> : '-'}</td>
      <td className="border-b px-2 py-0 text-xs"><select value="" onChange={(event) => { doAction(row, event.target.value); event.target.value = ''; }} className="h-6 rounded border bg-background px-1 text-xs"><option value="">Action</option><option value="sub">Add subtask</option><option value="indent">Make subtask</option><option value="outdent">Make main task</option><option value="earlier">Move earlier</option><option value="later">Move later</option><option value="milestone">Toggle milestone</option></select></td>
    </tr>;
  };

  return <AppLayout><AppHeader title="Master Schedule" subtitle="Compact virtualized spreadsheet with View/Edit tabs, Save All dirty tracking, dropdown row actions, sorting, grouping, timeline, and critical path." />
    <div className="space-y-4 p-4 sm:p-6">
      <div className="rounded-[1.5rem] bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-4 text-white shadow-xl"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Professional Spreadsheet Schedule</p><h1 className="text-xl font-black">Compact MS Project Grid</h1><p className="text-xs text-slate-300">Virtualized rendering, compact row height, View/Edit tabs, Save All, grouped rows, and dropdown actions.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => addTask()}><Plus className="mr-1 h-4 w-4" /> Task</Button><Button variant="secondary" size="sm" onClick={() => addTask(undefined, true)}><Milestone className="mr-1 h-4 w-4" /> Milestone</Button><Button variant="secondary" size="sm" onClick={() => void generatePlan()}><Sparkles className="mr-1 h-4 w-4" /> Generate</Button><Button variant="secondary" size="sm" onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> Export</Button><Button size="sm" onClick={() => void saveAll()} disabled={!dirtyCount}><Save className="mr-1 h-4 w-4" /> Save All ({dirtyCount})</Button></div></div></div>
      <div className="grid gap-2 rounded-2xl border bg-card p-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_190px_180px_140px_140px_140px_auto]">
        <div className="flex rounded-xl border p-1"><Button size="sm" variant={mode === 'view' ? 'default' : 'ghost'} onClick={() => setMode('view')}>View</Button><Button size="sm" variant={mode === 'edit' ? 'default' : 'ghost'} onClick={() => setMode('edit')}>Edit</Button></div>
        <div className="flex rounded-xl border p-1">{(['tree', 'table', 'gantt', 'milestones'] as ViewMode[]).map((item) => <Button key={item} size="sm" variant={view === item ? 'default' : 'ghost'} onClick={() => setView(item)} className="capitalize">{item}</Button>)}</div>
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search WBS, project, task" className="h-9 pl-9" /></label>
        <select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); event.target.value === 'all' ? setSearchParams({}, { replace: true }) : setSearchParams({ projectId: event.target.value }, { replace: true }); }} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select value={projectFilter === 'all' ? 'all' : phaseFilter} disabled={projectFilter === 'all'} onChange={(event) => setPhaseFilter(event.target.value)} className="h-9 rounded-xl border bg-background px-2 text-xs disabled:opacity-50"><option value="all">Project phases</option>{phases.map((phase) => <option key={phase}>{phase}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">Status</option><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">Priority</option><option>low</option><option>medium</option><option>high</option><option>urgent</option></select>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="wbs">Sort WBS</option><option value="startDate">Start</option><option value="endDate">Finish</option><option value="critical">Critical</option></select>
        <Button variant="outline" size="sm" onClick={() => { setProjectFilter('all'); setSearchParams({}, { replace: true }); setPhaseFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setQuery(''); }}><Filter className="mr-1 h-4 w-4" /> Reset</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">{[['Rows', filteredRows.length], ['Dirty', dirtyCount], ['Critical', filteredRows.filter((row) => row.critical).length], ['Milestones', filteredRows.filter((row) => row.isMilestone).length], ['Mode', mode]].map(([label, value]) => <div key={label} className="rounded-xl border bg-background p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-xl font-black">{value}</p></div>)}</div>
      {view === 'gantt' ? <div className="rounded-2xl border bg-card p-3"><div className="space-y-1 overflow-auto" style={{ maxHeight: viewportHeight }}>{filteredRows.map((row) => <div key={row.id} className="grid min-w-[900px] grid-cols-[320px_1fr] items-center gap-2 text-xs"><Link to={`/tasks?projectId=${row.projectId}`} className={row.critical ? 'font-bold text-red-600' : 'font-bold text-primary'}>{row.wbs} · {row.title}</Link><Timeline row={row} start={timelineStart} span={timelineSpan} /></div>)}</div></div> : <div className="rounded-2xl border bg-card shadow-sm"><div className="overflow-auto" style={{ height: viewportHeight }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}><table className="min-w-[2050px] border-separate border-spacing-0 text-left text-xs"><thead><tr>{header('WBS', 'wbs')}{header('Project', 'projectName')}{header('Task / Activity', 'title')}{header('Phase', 'phase')}{header('Status', 'status')}{header('Priority', 'priority')}{header('Start', 'startDate')}{header('Finish', 'endDate')}{header('Duration', 'durationDays')}{header('Progress', 'progress')}<th className="sticky top-0 z-20 border-b bg-background px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Timeline</th>{header('Hours', 'plannedHours')}<th className="sticky top-0 z-20 border-b bg-background px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Dependency</th>{header('Critical', 'critical')}<th className="sticky top-0 z-20 border-b bg-background px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Action</th></tr></thead><tbody>{topPad > 0 ? <tr style={{ height: topPad }}><td colSpan={15} /></tr> : null}{visibleRows.map(renderRow)}{bottomPad > 0 ? <tr style={{ height: bottomPad }}><td colSpan={15} /></tr> : null}</tbody></table></div></div>}
    </div></AppLayout>;
};

export default ScheduleSpreadsheet;
