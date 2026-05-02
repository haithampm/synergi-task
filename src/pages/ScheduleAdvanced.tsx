import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Filter, GitBranch, IndentDecrease, IndentIncrease, Milestone, Plus, Save, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useCreateTask, useProjects, useTasks, useUpdateTask } from '@/hooks/useProjects';
import { toast } from 'sonner';

type ScheduleStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type ViewMode = 'table' | 'tree' | 'gantt' | 'milestones';
type SortKey = 'wbs' | 'projectName' | 'title' | 'phase' | 'status' | 'priority' | 'startDate' | 'endDate' | 'durationDays' | 'progress' | 'plannedHours' | 'critical';
type SortDirection = 'asc' | 'desc';

type Row = {
  id: string;
  persisted: boolean;
  projectId: string;
  projectName: string;
  title: string;
  phase: string;
  status: ScheduleStatus;
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
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const addDays = (value: string, days: number) => {
  const date = new Date(`${value || today}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const duration = (start?: string, end?: string) => {
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
const statusLabel = (value?: string) => {
  const status = normalize(value) || 'todo';
  if (status === 'todo') return 'Tasks';
  if (status === 'in-progress') return 'In Progress';
  return status.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
const compare = (a: unknown, b: unknown) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

const buildWbs = (rows: Row[]) => {
  const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
    const key = row.parentTaskId || '__root__';
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
  const output = new Map<string, { wbs: string; level: number }>();
  const sortRows = (items: Row[]) => [...items].sort((a, b) => `${a.phase}-${a.startDate}-${a.title}`.localeCompare(`${b.phase}-${b.startDate}-${b.title}`));
  const assign = (row: Row, wbs: string, level: number) => {
    output.set(row.id, { wbs, level });
    sortRows(grouped[row.id] ?? []).forEach((child, index) => assign(child, `${wbs}.${index + 1}`, level + 1));
  };
  phases.forEach((phase, phaseIndex) => {
    sortRows(grouped.__root__ ?? []).filter((row) => row.phase === phase).forEach((row, index) => assign(row, `${phaseIndex + 1}.${index + 1}`, 0));
  });
  sortRows(grouped.__root__ ?? []).filter((row) => !phases.includes(row.phase)).forEach((row, index) => assign(row, `9.${index + 1}`, 0));
  return output;
};

const Timeline = ({ row, start, span }: { row: Row; start: string; span: number }) => {
  const left = ((duration(start, row.startDate) - 1) / Math.max(1, span)) * 100;
  const width = (duration(row.startDate, row.endDate) / Math.max(1, span)) * 100;
  return (
    <div className="relative h-8 min-w-[230px] rounded-xl bg-muted">
      <div className={`absolute top-1 h-6 rounded-xl ${row.critical ? 'bg-red-500' : row.isMilestone ? 'bg-amber-500' : row.level === 0 ? 'bg-blue-600' : 'bg-primary'}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(row.isMilestone ? 2 : 5, width)}%` }} />
      <div className="absolute top-1 h-6 rounded-l-xl bg-white/40" style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0, Math.min(width, (width * row.progress) / 100))}%` }} />
    </div>
  );
};

const ScheduleAdvanced = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? 'all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('tree');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<Row>>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('wbs');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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
      const days = duration(startDate, endDate);
      return {
        id: task.id,
        persisted: true,
        projectId,
        projectName: project?.name ?? task.projectName ?? 'Unassigned Project',
        title: task.title,
        phase: task.phase ?? 'Execution',
        status: (task.status ?? 'todo') as ScheduleStatus,
        priority: (task.priority ?? 'medium') as Priority,
        startDate,
        endDate,
        durationDays: days,
        progress: task.progress ?? (task.status === 'done' ? 100 : 0),
        plannedHours: task.workloadHours ?? days * 8,
        isMilestone: task.isMilestone ?? false,
        parentTaskId: task.parentTaskId,
        predecessorId: Array.isArray(raw.predecessors) ? String(raw.predecessors[0] ?? '') || undefined : undefined,
        wbs: '',
        level: 0,
        critical: false,
      };
    });
    const draftRows = Object.entries(drafts).filter(([id]) => id.startsWith('draft-')).map(([, value]) => value as Row);
    const combined = [...taskRows, ...draftRows].map((row) => ({ ...row, ...drafts[row.id] }));
    const wbs = buildWbs(combined);
    const successorIds = new Set(combined.map((row) => row.predecessorId).filter(Boolean) as string[]);
    return combined.map((row) => {
      const enriched = { ...row, ...(wbs.get(row.id) ?? { wbs: '9.9', level: 0 }) };
      const overdue = enriched.endDate < today && enriched.status !== 'done';
      const critical = overdue || (successorIds.has(enriched.id) && ['high', 'urgent'].includes(enriched.priority)) || (enriched.isMilestone && overdue);
      return { ...enriched, critical };
    });
  }, [drafts, projectMap, tasks]);

  const parentIds = useMemo(() => new Set(rows.map((row) => row.parentTaskId).filter(Boolean) as string[]), [rows]);
  const taskOptions = useMemo(() => rows.map((row) => ({ id: row.id, label: `${row.wbs} ${row.title}` })), [rows]);
  const treeRows = useMemo(() => {
    const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
      const key = row.parentTaskId || '__root__';
      acc[key] = acc[key] ?? [];
      acc[key].push(row);
      return acc;
    }, {});
    const output: Row[] = [];
    const add = (row: Row) => {
      output.push(row);
      if (collapsed.includes(row.id)) return;
      (grouped[row.id] ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(add);
    };
    (grouped.__root__ ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(add);
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
    return [...filtered].sort((a, b) => {
      const comparison = compare(a[sortKey === 'critical' ? 'critical' : sortKey], b[sortKey === 'critical' ? 'critical' : sortKey]);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [phaseFilter, priorityFilter, projectFilter, query, rows, sortDirection, sortKey, statusFilter, treeRows, view]);

  const timelineStart = filteredRows.map((row) => row.startDate).sort()[0] ?? today;
  const timelineEnd = filteredRows.map((row) => row.endDate).sort().at(-1) ?? addDays(today, 30);
  const timelineSpan = duration(timelineStart, timelineEnd);
  const projectTimeline = useMemo(() => {
    if (!selectedProject) return null;
    const projectRows = rows.filter((row) => row.projectId === selectedProject.id);
    const startDate = projectRows.map((row) => row.startDate).sort()[0] ?? String(selectedProject.start_date ?? selectedProject.startDate ?? '').slice(0, 10);
    const endDate = projectRows.map((row) => row.endDate).sort().at(-1) ?? String(selectedProject.end_date ?? selectedProject.endDate ?? '').slice(0, 10);
    const completed = projectRows.filter((row) => row.status === 'done').length;
    const progress = projectRows.length ? Math.round((completed / projectRows.length) * 100) : selectedProject.progress ?? 0;
    return { startDate, endDate, progress, count: projectRows.length };
  }, [rows, selectedProject]);

  const metrics = useMemo(() => {
    const completed = filteredRows.filter((row) => row.status === 'done').length;
    return {
      activities: filteredRows.length,
      completed,
      completion: filteredRows.length ? Math.round((completed / filteredRows.length) * 100) : 0,
      critical: filteredRows.filter((row) => row.critical).length,
      milestones: filteredRows.filter((row) => row.isMilestone).length,
    };
  }, [filteredRows]);

  const updateDraft = (id: string, update: Partial<Row>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
  const toggleSort = (key: SortKey) => {
    setSortKey((current) => {
      if (current === key) setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      else setSortDirection('asc');
      return key;
    });
  };
  const saveRow = async (row: Row) => {
    const payload = {
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
      duration: `${duration(row.startDate, row.endDate)}d`,
      progress: row.progress,
      workloadHours: row.plannedHours,
      isMilestone: row.isMilestone,
      parentTaskId: row.parentTaskId,
      predecessors: row.predecessorId ? [row.predecessorId] : [],
    };
    if (row.persisted) await updateTask.mutateAsync({ id: row.id, ...payload });
    else await createTask.mutateAsync({ title: row.title, ...payload });
    setDrafts((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    toast.success('Schedule activity saved');
  };
  const addTask = (parent?: Row, milestone = false) => {
    const project = parent ? projectMap.get(parent.projectId) : defaultProject;
    if (!project) return toast.error('Select a project first');
    const startDate = parent?.endDate ? addDays(parent.endDate, milestone ? 0 : 1) : String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    const endDate = milestone ? startDate : addDays(startDate, 2);
    const id = `draft-${Date.now()}`;
    setDrafts((current) => ({
      ...current,
      [id]: {
        id,
        persisted: false,
        projectId: project.id,
        projectName: project.name,
        title: milestone ? 'New milestone' : parent ? `${parent.title} - subtask` : 'New schedule activity',
        phase: parent?.phase ?? 'Execution',
        status: 'todo',
        priority: milestone ? 'high' : 'medium',
        startDate,
        endDate,
        durationDays: duration(startDate, endDate),
        progress: 0,
        plannedHours: milestone ? 0 : 24,
        isMilestone: milestone,
        parentTaskId: parent?.id,
        predecessorId: parent?.id,
        wbs: 'draft',
        level: parent ? parent.level + 1 : 0,
        critical: false,
      },
    }));
  };
  const generatePlan = async () => {
    const project = defaultProject;
    if (!project) return toast.error('Select a project first');
    const template = [
      ['Discovery', 'Kickoff milestone', 1, true], ['Discovery', 'Requirement workshops', 5, false], ['Planning', 'Baseline schedule and resource plan', 4, false],
      ['Planning', 'Risk register and acceptance criteria', 3, false], ['Execution', 'Development sprint 1', 10, false], ['Execution', 'Development sprint 2', 10, false],
      ['Testing', 'Functional testing and defect resolution', 7, false], ['Testing', 'UAT sign-off milestone', 1, true], ['Deployment', 'Go-live readiness', 5, false],
      ['Deployment', 'Go-live milestone', 1, true], ['Closure', 'Hypercare and closure report', 5, false],
    ] as const;
    let cursor = String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    let predecessorId: string | undefined;
    for (const [phase, title, days, milestone] of template) {
      const endDate = milestone ? cursor : addDays(cursor, days - 1);
      const created = await createTask.mutateAsync({ title, project_id: project.id, projectId: project.id, projectName: project.name, phase, status: 'todo', priority: milestone ? 'high' : 'medium', start_date: cursor, end_date: endDate, due_date: endDate, duration: `${days}d`, progress: 0, workloadHours: milestone ? 0 : days * 8, isMilestone: milestone, predecessors: predecessorId ? [predecessorId] : [] });
      predecessorId = created.id;
      cursor = addDays(endDate, 1);
    }
    toast.success('Generated project plan with milestones and dependencies');
  };
  const moveByDays = (row: Row, days: number) => updateDraft(row.id, { startDate: addDays(row.startDate, days), endDate: addDays(row.endDate, days) });
  const makeSubtaskOfPrevious = (row: Row) => {
    const index = filteredRows.findIndex((item) => item.id === row.id);
    const previous = filteredRows[index - 1];
    if (!previous) return toast.error('No previous task available');
    updateDraft(row.id, { parentTaskId: previous.id, predecessorId: previous.id, phase: previous.phase });
  };
  const dropOnRow = (target: Row) => {
    if (!draggedId || draggedId === target.id) return;
    const dragged = rows.find((row) => row.id === draggedId);
    if (!dragged || dragged.projectId !== target.projectId) return toast.error('Drag/drop must stay inside the same project');
    updateDraft(dragged.id, { parentTaskId: target.id, predecessorId: target.id, phase: target.phase, startDate: addDays(target.endDate, 1), endDate: addDays(target.endDate, duration(dragged.startDate, dragged.endDate)) });
    setDraggedId(null);
  };
  const resetFilters = () => { setProjectFilter('all'); setSearchParams({}, { replace: true }); setPhaseFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setQuery(''); };
  const exportCsv = () => {
    const lines = [['WBS', 'Project', 'Task', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration', 'Progress', 'Hours', 'Milestone', 'Dependency', 'Critical'], ...filteredRows.map((row) => [row.wbs, row.projectName, row.title, row.phase, statusLabel(row.status), row.priority, row.startDate, row.endDate, duration(row.startDate, row.endDate), `${row.progress}%`, row.plannedHours, row.isMilestone ? 'Yes' : 'No', taskOptions.find((item) => item.id === row.predecessorId)?.label ?? '', row.critical ? 'Yes' : 'No'])];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'master-schedule-critical-path.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const header = (label: string, key: SortKey) => <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground"><button type="button" onClick={() => toggleSort(key)} className="hover:text-primary">{label} {sortKey === key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>;
  const renderRow = (row: Row) => {
    const hasChildren = parentIds.has(row.id);
    const dirty = Boolean(drafts[row.id]);
    const mainGroup = row.level === 0 && hasChildren;
    return <tr key={row.id} draggable onDragStart={() => setDraggedId(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOnRow(row)} className={`${mainGroup ? 'bg-blue-50 font-bold dark:bg-blue-950/30' : 'odd:bg-muted/20'} hover:bg-primary/5 ${row.critical ? 'ring-1 ring-red-500/40' : ''}`}>
      <td className="border-b px-3 py-2 font-mono text-xs font-black text-muted-foreground"><span className="inline-flex items-center gap-1" style={{ paddingLeft: `${row.level * 16}px` }}>{hasChildren ? <button type="button" className="rounded border px-1 font-black text-primary" onClick={() => setCollapsed((current) => current.includes(row.id) ? current.filter((item) => item !== row.id) : [...current, row.id])}>{collapsed.includes(row.id) ? '+' : '-'}</button> : <span className="w-5" />}{row.wbs}</span></td>
      <td className="border-b px-3 py-2"><Link to={`/projects?projectId=${row.projectId}`} className="font-bold text-primary underline-offset-4 hover:underline">{row.projectName}</Link></td>
      <td className="min-w-[320px] border-b px-3 py-2"><div className="flex items-center gap-2">{row.critical ? <TriangleAlert className="h-4 w-4 text-red-500" /> : null}<Input value={row.title} onChange={(event) => updateDraft(row.id, { title: event.target.value })} className={mainGroup ? 'font-black text-blue-800 dark:text-blue-200' : ''} /><Link to={`/tasks?projectId=${row.projectId}`} className="rounded-lg border px-2 py-1 text-xs font-bold text-primary hover:bg-muted">View</Link></div></td>
      <td className="border-b px-3 py-2"><select value={row.phase} onChange={(event) => updateDraft(row.id, { phase: event.target.value })} className="h-9 rounded-xl border bg-background px-2 text-sm">{phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></td>
      <td className="border-b px-3 py-2"><select value={row.status} onChange={(event) => updateDraft(row.id, { status: event.target.value as ScheduleStatus })} className="h-9 rounded-xl border bg-background px-2 text-sm"><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select></td>
      <td className="border-b px-3 py-2"><select value={row.priority} onChange={(event) => updateDraft(row.id, { priority: event.target.value as Priority })} className="h-9 rounded-xl border bg-background px-2 text-sm"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="urgent">urgent</option></select></td>
      <td className="border-b px-3 py-2"><Input type="date" value={row.startDate} onChange={(event) => updateDraft(row.id, { startDate: event.target.value, durationDays: duration(event.target.value, row.endDate) })} /></td>
      <td className="border-b px-3 py-2"><Input type="date" value={row.endDate} onChange={(event) => updateDraft(row.id, { endDate: event.target.value, durationDays: duration(row.startDate, event.target.value) })} /></td>
      <td className="border-b px-3 py-2 text-muted-foreground">{duration(row.startDate, row.endDate)}d</td>
      <td className="border-b px-3 py-2"><Input type="number" min="0" max="100" value={row.progress} onChange={(event) => updateDraft(row.id, { progress: Number(event.target.value) })} className="w-20" /></td>
      <td className="border-b px-3 py-2"><Timeline row={row} start={timelineStart} span={timelineSpan} /></td>
      <td className="border-b px-3 py-2"><Input type="number" min="0" value={row.plannedHours} onChange={(event) => updateDraft(row.id, { plannedHours: Number(event.target.value) })} className="w-24" /></td>
      <td className="border-b px-3 py-2"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={row.isMilestone} onChange={(event) => updateDraft(row.id, { isMilestone: event.target.checked, plannedHours: event.target.checked ? 0 : row.plannedHours })} /> Milestone</label></td>
      <td className="min-w-[220px] border-b px-3 py-2"><select value={row.predecessorId ?? ''} onChange={(event) => updateDraft(row.id, { predecessorId: event.target.value || undefined })} className="h-9 w-full rounded-xl border bg-background px-2 text-sm"><option value="">No dependency</option>{taskOptions.filter((item) => item.id !== row.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></td>
      <td className="border-b px-3 py-2 text-center">{row.critical ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-black text-red-600">Critical</span> : '-'}</td>
      <td className="border-b px-3 py-2"><div className="flex flex-wrap gap-1"><Button size="sm" variant={dirty || !row.persisted ? 'default' : 'outline'} onClick={() => void saveRow(row)}><Save className="mr-1 h-3 w-3" /> Save</Button><Button size="sm" variant="outline" onClick={() => addTask(row)}><GitBranch className="mr-1 h-3 w-3" /> Sub</Button><Button size="sm" variant="outline" onClick={() => makeSubtaskOfPrevious(row)}><IndentIncrease className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={() => updateDraft(row.id, { parentTaskId: undefined })}><IndentDecrease className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={() => { updateDraft(row.id, { startDate: addDays(row.startDate, -1), endDate: addDays(row.endDate, -1) }); }}><ArrowUp className="h-3 w-3" /></Button><Button size="sm" variant="outline" onClick={() => { updateDraft(row.id, { startDate: addDays(row.startDate, 1), endDate: addDays(row.endDate, 1) }); }}><ArrowDown className="h-3 w-3" /></Button></div></td>
    </tr>;
  };

  return <AppLayout><AppHeader title="Master Schedule" subtitle="Excel-sortable MS Project schedule with project filters, task groups, timeline bars, dependencies, critical path, and clickable records." /><div className="space-y-5 p-4 sm:p-6">
    <div className="rounded-[2rem] bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-5 text-white shadow-2xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-300">MS Project Style Schedule</p><h1 className="mt-2 text-2xl font-black">Editable Master Schedule</h1><p className="mt-2 max-w-4xl text-sm text-slate-300">Sort like Excel, expand/collapse task groups, click project/task links, review timelines, and track critical path.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" className="gap-2" onClick={() => addTask()}><Plus className="h-4 w-4" /> Add Task</Button><Button variant="secondary" className="gap-2" onClick={() => addTask(undefined, true)}><Milestone className="h-4 w-4" /> Add Milestone</Button><Button variant="secondary" className="gap-2" onClick={() => void generatePlan()}><Sparkles className="h-4 w-4" /> Generate Plan</Button><Button variant="secondary" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Activities', metrics.activities], ['Completed', metrics.completed], ['Completion', `${metrics.completion}%`], ['Critical Path', metrics.critical], ['Milestones', metrics.milestones]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-background p-4 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}</div>
    {selectedProject && projectTimeline ? <div className="rounded-3xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Selected Project Timeline</p><Link to={`/projects?projectId=${selectedProject.id}`} className="text-lg font-black text-primary underline-offset-4 hover:underline">{selectedProject.name}</Link><p className="text-sm text-muted-foreground">{formatDate(projectTimeline.startDate)} - {formatDate(projectTimeline.endDate)} · {projectTimeline.count} activities</p></div><div className="min-w-[320px] flex-1"><Progress value={projectTimeline.progress} className="h-4" /><p className="mt-1 text-right text-xs font-black text-muted-foreground">{projectTimeline.progress}% complete</p></div></div></div> : null}
    <div className="rounded-3xl border bg-card p-3 shadow-sm"><div className="mb-3 flex flex-wrap gap-2">{(['table', 'tree', 'gantt', 'milestones'] as ViewMode[]).map((item) => <Button key={item} size="sm" variant={view === item ? 'default' : 'outline'} onClick={() => setView(item)} className="capitalize">{item}</Button>)}<Button size="sm" variant="outline" onClick={() => setCollapsed([])}>Expand all</Button><Button size="sm" variant="outline" onClick={() => setCollapsed(Array.from(parentIds))}>Collapse all</Button><Button size="sm" variant="outline" onClick={() => { setSortKey('critical'); setSortDirection('desc'); }}>Critical first</Button></div><div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_220px_160px_160px_160px_auto]"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search WBS, project, task, or dependency" className="pl-9" /></label><select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); event.target.value === 'all' ? setSearchParams({}, { replace: true }) : setSearchParams({ projectId: event.target.value }, { replace: true }); }} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={projectFilter === 'all' ? 'all' : phaseFilter} disabled={projectFilter === 'all'} onChange={(event) => setPhaseFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"><option value="all">Project sub-filter: all phases</option>{phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All statuses</option>{(['backlog', 'todo', 'in-progress', 'review', 'done'] as ScheduleStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All priorities</option>{(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="wbs">Sort: WBS</option><option value="projectName">Project</option><option value="title">Task name</option><option value="startDate">Start date</option><option value="endDate">Finish date</option><option value="progress">Progress</option><option value="critical">Critical</option></select><Button variant="outline" className="gap-2" onClick={resetFilters}><Filter className="h-4 w-4" /> Reset</Button></div></div>
    {view === 'gantt' ? <div className="rounded-3xl border bg-card p-4 shadow-sm"><div className="space-y-3 overflow-x-auto">{filteredRows.map((row) => <div key={row.id} className="grid min-w-[920px] grid-cols-[320px_1fr] items-center gap-3"><Link to={`/tasks?projectId=${row.projectId}`} className={`truncate text-sm font-semibold underline-offset-4 hover:underline ${row.critical ? 'text-red-600' : 'text-primary'}`}>{row.wbs} · {row.title}</Link><Timeline row={row} start={timelineStart} span={timelineSpan} /></div>)}</div></div> : <div className="rounded-3xl border bg-card shadow-sm"><div className="max-h-[70vh] overflow-auto p-3"><table className="min-w-[2300px] border-separate border-spacing-0 text-left text-sm"><thead><tr>{header('WBS', 'wbs')}{header('Project', 'projectName')}{header('Task / Activity', 'title')}{header('Phase', 'phase')}{header('Status', 'status')}{header('Priority', 'priority')}{header('Start', 'startDate')}{header('Finish', 'endDate')}{header('Duration', 'durationDays')}{header('Progress', 'progress')}<th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Timeline</th>{header('Hours', 'plannedHours')}<th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Milestone</th><th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Dependency</th>{header('Critical Path', 'critical')}<th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Actions</th></tr></thead><tbody>{filteredRows.map(renderRow)}</tbody></table>{filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No schedule activities match the current filters.</div> : null}</div></div>}
    <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground"><p className="font-semibold text-foreground">MS Project-style controls:</p><p className="mt-1">Click headers to sort like Excel. Use + / - to collapse or expand task groups. Main groups are bold and highlighted. Critical path rows are flagged red. Project and task names are clickable.</p></div>
  </div></AppLayout>;
};

export default ScheduleAdvanced;
