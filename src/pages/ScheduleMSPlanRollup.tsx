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
type ViewMode = 'plan' | 'gantt' | 'milestones';
type Status = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type SortKey = 'wbs' | 'name' | 'startDate' | 'endDate' | 'durationDays' | 'progress' | 'critical';

type TaskRow = {
  kind: 'task';
  id: string;
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
  persisted: boolean;
};

type SummaryRow = {
  kind: 'project' | 'group';
  id: string;
  projectId: string;
  title: string;
  phase?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  progress: number;
  plannedHours: number;
  totalActivities: number;
  completedActivities: number;
  criticalCount: number;
  wbs: string;
  level: number;
};

type Row = TaskRow | SummaryRow;

const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment', 'Closure'];
const today = new Date().toISOString().slice(0, 10);
const viewportHeight = 620;
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const isTask = (row: Row): row is TaskRow => row.kind === 'task';

const addDays = (value: string, days: number) => {
  const date = new Date(`${value || today}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const daysBetween = (start?: string, end?: string) => {
  if (!start || !end) return 1;
  const startTime = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
  const endTime = new Date(`${end.slice(0, 10)}T00:00:00`).getTime();
  return Math.max(1, Math.round((endTime - startTime) / 86400000) + 1 || 1);
};

const fmt = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusLabel = (status?: string) => status === 'todo' ? 'Tasks' : status === 'in-progress' ? 'In Progress' : String(status ?? 'Tasks').replace(/-/g, ' ');
const compare = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
const rollupDuration = (rows: TaskRow[]) => rows.reduce((sum, row) => sum + Number(row.durationDays || 0), 0);
const rollupProgress = (rows: TaskRow[]) => {
  const totalDuration = rollupDuration(rows);
  if (!rows.length) return 0;
  if (!totalDuration) return Math.round(rows.reduce((sum, row) => sum + Number(row.progress || 0), 0) / rows.length);
  return Math.round(rows.reduce((sum, row) => sum + Number(row.progress || 0) * Number(row.durationDays || 0), 0) / totalDuration);
};

const Timeline = ({ row, start, span }: { row: Row; start: string; span: number }) => {
  const left = ((daysBetween(start, row.startDate) - 1) / Math.max(1, span)) * 100;
  const width = (daysBetween(row.startDate, row.endDate) / Math.max(1, span)) * 100;
  const color = row.kind === 'project' ? 'bg-slate-900' : row.kind === 'group' ? 'bg-blue-600' : row.critical ? 'bg-red-500' : row.isMilestone ? 'bg-amber-500' : 'bg-primary';
  return <div className="relative h-4 min-w-[220px] rounded bg-muted">
    <div className={`absolute top-0 h-4 rounded ${color}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(isTask(row) && row.isMilestone ? 2 : 5, width)}%` }} />
    <div className="absolute top-0 h-4 rounded-l bg-white/40" style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0, Math.min(width, (width * row.progress) / 100))}%` }} />
  </div>;
};

const ScheduleMSPlanRollup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('view');
  const [view, setView] = useState<ViewMode>('plan');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? 'all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<TaskRow>>>({});
  const [sortKey, setSortKey] = useState<SortKey>('wbs');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const selectedProject = projectFilter === 'all' ? undefined : projects.find((project) => project.id === projectFilter);
  const defaultProject = selectedProject ?? projects[0];

  const taskRows = useMemo<TaskRow[]>(() => {
    const base = tasks.map((task) => {
      const raw = task as Record<string, unknown>;
      const projectId = task.project_id ?? task.projectId ?? '';
      const project = projectMap.get(projectId);
      const startDate = String(task.start_date ?? task.due_date ?? project?.start_date ?? project?.startDate ?? today).slice(0, 10);
      const endDate = String(task.end_date ?? task.due_date ?? addDays(startDate, 2)).slice(0, 10);
      const durationDays = daysBetween(startDate, endDate);
      return {
        kind: 'task' as const,
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
        level: 2,
        critical: false,
      };
    });
    const draftRows = Object.entries(drafts).filter(([id]) => id.startsWith('draft-')).map(([, row]) => row as TaskRow);
    const combined = [...base, ...draftRows].map((row) => ({ ...row, ...drafts[row.id] })) as TaskRow[];
    const successorIds = new Set(combined.map((row) => row.predecessorId).filter(Boolean) as string[]);
    return combined.map((row) => ({
      ...row,
      durationDays: daysBetween(row.startDate, row.endDate),
      critical: (row.endDate < today && row.status !== 'done') || (successorIds.has(row.id) && ['high', 'urgent'].includes(row.priority)),
    }));
  }, [drafts, projectMap, tasks]);

  const projectTaskRows = useMemo(() => taskRows.filter((row) => projectFilter === 'all' || row.projectId === projectFilter), [projectFilter, taskRows]);

  const filteredTasks = useMemo(() => {
    const search = normalize(query);
    return projectTaskRows.filter((row) => {
      const matchesPhase = phaseFilter === 'all' || row.phase === phaseFilter;
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || row.priority === priorityFilter;
      const matchesSearch = !search || normalize(row.title).includes(search) || normalize(row.projectName).includes(search) || normalize(row.phase).includes(search);
      const matchesMilestone = view !== 'milestones' || row.isMilestone;
      return matchesPhase && matchesStatus && matchesPriority && matchesSearch && matchesMilestone;
    });
  }, [phaseFilter, priorityFilter, projectTaskRows, query, statusFilter, view]);

  const rows = useMemo<Row[]>(() => {
    const output: Row[] = [];
    const projectsToShow = projectFilter === 'all' ? projects : projects.filter((project) => project.id === projectFilter);

    projectsToShow.forEach((project, projectIndex) => {
      const projectRows = filteredTasks.filter((row) => row.projectId === project.id);
      if (!projectRows.length && query) return;
      const starts = projectRows.map((row) => row.startDate).sort();
      const ends = projectRows.map((row) => row.endDate).sort();
      const startDate = starts[0] ?? String(project.start_date ?? project.startDate ?? today).slice(0, 10);
      const endDate = ends.at(-1) ?? String(project.end_date ?? project.endDate ?? startDate).slice(0, 10);
      const projectDuration = rollupDuration(projectRows);
      const completed = projectRows.filter((row) => row.status === 'done').length;
      const projectSummary: SummaryRow = {
        kind: 'project',
        id: `project-${project.id}`,
        projectId: project.id,
        title: project.name,
        startDate,
        endDate,
        durationDays: projectDuration,
        progress: projectRows.length ? rollupProgress(projectRows) : Number(project.progress ?? 0),
        plannedHours: projectRows.reduce((sum, row) => sum + Number(row.plannedHours || 0), 0),
        totalActivities: projectRows.length,
        completedActivities: completed,
        criticalCount: projectRows.filter((row) => row.critical).length,
        wbs: `${projectIndex + 1}`,
        level: 0,
      };
      output.push(projectSummary);
      if (collapsed.includes(projectSummary.id)) return;

      phases.forEach((phase, phaseIndex) => {
        const phaseRows = projectRows.filter((row) => row.phase === phase).sort((a, b) => `${a.startDate}-${a.title}`.localeCompare(`${b.startDate}-${b.title}`));
        if (!phaseRows.length) return;
        const starts = phaseRows.map((row) => row.startDate).sort();
        const ends = phaseRows.map((row) => row.endDate).sort();
        const completed = phaseRows.filter((row) => row.status === 'done').length;
        const groupId = `group-${project.id}-${phase}`;
        const groupRow: SummaryRow = {
          kind: 'group',
          id: groupId,
          projectId: project.id,
          title: phase,
          phase,
          startDate: starts[0],
          endDate: ends.at(-1) ?? starts[0],
          durationDays: rollupDuration(phaseRows),
          progress: rollupProgress(phaseRows),
          plannedHours: phaseRows.reduce((sum, row) => sum + Number(row.plannedHours || 0), 0),
          totalActivities: phaseRows.length,
          completedActivities: completed,
          criticalCount: phaseRows.filter((row) => row.critical).length,
          wbs: `${projectIndex + 1}.${phaseIndex + 1}`,
          level: 1,
        };
        output.push(groupRow);
        if (collapsed.includes(groupId)) return;
        phaseRows.forEach((row, taskIndex) => output.push({ ...row, wbs: `${projectIndex + 1}.${phaseIndex + 1}.${taskIndex + 1}`, level: 2 }));
      });
    });

    if (sortKey !== 'wbs') {
      return [...output].sort((a, b) => {
        const aValue = sortKey === 'name' ? a.title : sortKey === 'critical' ? (isTask(a) ? a.critical : a.criticalCount > 0) : a[sortKey];
        const bValue = sortKey === 'name' ? b.title : sortKey === 'critical' ? (isTask(b) ? b.critical : b.criticalCount > 0) : b[sortKey];
        return (sortDirection === 'asc' ? 1 : -1) * compare(aValue, bValue);
      });
    }
    return output;
  }, [collapsed, filteredTasks, projectFilter, projects, query, sortDirection, sortKey]);

  const master = useMemo(() => {
    const starts = filteredTasks.map((row) => row.startDate).sort();
    const ends = filteredTasks.map((row) => row.endDate).sort();
    const completed = filteredTasks.filter((row) => row.status === 'done').length;
    return {
      startDate: starts[0] ?? today,
      endDate: ends.at(-1) ?? today,
      durationDays: rollupDuration(filteredTasks),
      plannedHours: filteredTasks.reduce((sum, row) => sum + Number(row.plannedHours || 0), 0),
      progress: rollupProgress(filteredTasks),
      totalActivities: filteredTasks.length,
      completedActivities: completed,
      criticalCount: filteredTasks.filter((row) => row.critical).length,
      milestones: filteredTasks.filter((row) => row.isMilestone).length,
    };
  }, [filteredTasks]);

  const timelineSpan = daysBetween(master.startDate, master.endDate);
  const dirtyCount = Object.keys(drafts).length;
  const visibleRows = rows;

  const updateDraft = (id: string, update: Partial<TaskRow>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
  const toggleSort = (key: SortKey) => {
    setSortKey((current) => {
      if (current === key) setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      else setSortDirection('asc');
      return key;
    });
  };

  const payloadFor = (row: TaskRow) => ({
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
    const dirtyRows = taskRows.filter((row) => drafts[row.id]);
    for (const row of dirtyRows) {
      if (row.persisted) await updateTask.mutateAsync({ id: row.id, ...payloadFor(row) });
      else await createTask.mutateAsync({ title: row.title, ...payloadFor(row) });
    }
    setDrafts({});
    toast.success(`Saved ${dirtyRows.length} schedule changes`);
  };

  const addTask = (phase = 'Execution', milestone = false) => {
    const project = defaultProject;
    if (!project) return toast.error('Select a project first');
    const startDate = String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    const endDate = milestone ? startDate : addDays(startDate, 2);
    const id = `draft-${Date.now()}`;
    setDrafts((current) => ({ ...current, [id]: { kind: 'task', id, persisted: false, projectId: project.id, projectName: project.name, title: milestone ? 'New milestone' : 'New schedule activity', phase, status: 'todo', priority: milestone ? 'high' : 'medium', startDate, endDate, durationDays: daysBetween(startDate, endDate), progress: 0, plannedHours: milestone ? 0 : 24, isMilestone: milestone, wbs: 'draft', level: 2, critical: false } as TaskRow }));
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
    toast.success('Generated MS Project-style plan');
  };

  const doAction = (row: TaskRow, action: string) => {
    if (!action) return;
    if (action === 'sub') addTask(row.phase, false);
    if (action === 'earlier') updateDraft(row.id, { startDate: addDays(row.startDate, -1), endDate: addDays(row.endDate, -1) });
    if (action === 'later') updateDraft(row.id, { startDate: addDays(row.startDate, 1), endDate: addDays(row.endDate, 1) });
    if (action === 'milestone') updateDraft(row.id, { isMilestone: !row.isMilestone, plannedHours: row.isMilestone ? 8 : 0 });
  };

  const exportCsv = () => {
    const lines = [['WBS', 'Task Name', 'Duration', 'Start', 'Finish', 'Predecessors', 'Work', '% Complete', 'Critical'], ...rows.map((row) => [row.wbs, row.title, `${row.durationDays}d`, row.startDate, row.endDate, isTask(row) ? (taskRows.find((item) => item.id === row.predecessorId)?.wbs ?? '') : '', `${row.plannedHours}h`, `${row.progress}%`, isTask(row) && row.critical ? 'Yes' : row.kind !== 'task' && row.criticalCount ? 'Yes' : 'No'])];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ms-project-plan-schedule.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  const header = (label: string, key: SortKey) => <th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground"><button type="button" onClick={() => toggleSort(key)} className="hover:text-primary">{label} {sortKey === key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</button></th>;
  const cellInput = 'h-7 rounded border px-2 text-xs';

  const renderRow = (row: Row) => {
    const summary = row.kind !== 'task';
    const isDirty = isTask(row) && Boolean(drafts[row.id]);
    const collapsedState = collapsed.includes(row.id);
    return <tr key={row.id} className={`${row.kind === 'project' ? 'bg-slate-950 text-white' : row.kind === 'group' ? 'bg-blue-50 font-bold dark:bg-blue-950/30' : 'odd:bg-muted/20 hover:bg-primary/5'} ${isDirty ? 'outline outline-1 outline-amber-400' : ''} ${isTask(row) && row.critical ? 'ring-1 ring-red-500/30' : ''}`}>
      <td className="border-b px-3 py-1.5 text-[11px] font-mono"><span style={{ paddingLeft: `${row.level * 14}px` }} className="inline-flex items-center gap-1">{summary ? <button className={`rounded border px-1 font-black ${row.kind === 'project' ? 'border-white/30 text-cyan-300' : 'text-primary'}`} onClick={() => setCollapsed((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}>{collapsedState ? '+' : '-'}</button> : <span className="w-5" />}{row.wbs}</span></td>
      <td className="min-w-[360px] border-b px-3 py-1.5 text-xs">{row.kind === 'project' ? <Link to={`/projects?projectId=${row.projectId}`} className="font-black text-cyan-300 underline-offset-4 hover:underline">{row.title} · {row.totalActivities} activities</Link> : row.kind === 'group' ? <span className="font-black text-blue-800 dark:text-blue-200">{row.title} · {row.totalActivities} activities</span> : mode === 'edit' ? <Input value={row.title} onChange={(event) => updateDraft(row.id, { title: event.target.value })} className={cellInput} /> : <Link to={`/tasks?taskId=${row.id}&projectId=${row.projectId}`} className={`underline-offset-4 hover:underline ${row.critical ? 'text-red-600' : 'text-foreground'}`}>{row.critical ? <TriangleAlert className="mr-1 inline h-3 w-3" /> : null}{row.title}</Link>}</td>
      <td className="border-b px-3 py-1.5 text-xs font-semibold">{row.durationDays}d</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) && mode === 'edit' ? <Input type="date" value={row.startDate} onChange={(event) => updateDraft(row.id, { startDate: event.target.value })} className={cellInput} /> : fmt(row.startDate)}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) && mode === 'edit' ? <Input type="date" value={row.endDate} onChange={(event) => updateDraft(row.id, { endDate: event.target.value })} className={cellInput} /> : fmt(row.endDate)}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) ? (mode === 'edit' ? <select value={row.predecessorId ?? ''} onChange={(event) => updateDraft(row.id, { predecessorId: event.target.value || undefined })} className={`${cellInput} w-44`}><option value="">None</option>{taskRows.filter((item) => item.id !== row.id).map((item) => <option key={item.id} value={item.id}>{item.wbs} {item.title}</option>)}</select> : (taskRows.find((item) => item.id === row.predecessorId)?.wbs ?? '-')) : '-'}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) && mode === 'edit' ? <Input type="number" min="0" value={row.plannedHours} onChange={(event) => updateDraft(row.id, { plannedHours: Number(event.target.value) })} className={`${cellInput} w-20`} /> : `${row.plannedHours}h`}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) && mode === 'edit' ? <select value={row.status} onChange={(event) => updateDraft(row.id, { status: event.target.value as Status })} className={cellInput}><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select> : isTask(row) ? statusLabel(row.status) : `${row.completedActivities}/${row.totalActivities}`}</td>
      <td className="border-b px-3 py-1.5 text-xs font-bold">{isTask(row) && mode === 'edit' ? <Input type="number" min="0" max="100" value={row.progress} onChange={(event) => updateDraft(row.id, { progress: Number(event.target.value) })} className={`${cellInput} w-20`} /> : `${row.progress}%`}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) ? (row.critical ? <span className="rounded bg-red-500/10 px-1 font-bold text-red-600">Critical</span> : '-') : row.criticalCount ? <span className="rounded bg-red-500/10 px-1 font-bold text-red-600">{row.criticalCount}</span> : '-'}</td>
      <td className="border-b px-3 py-1.5 text-xs">{isTask(row) ? <select value="" onChange={(event) => { doAction(row, event.target.value); event.target.value = ''; }} className="h-7 rounded border bg-background px-1 text-xs"><option value="">Action</option><option value="sub">Add task in phase</option><option value="earlier">Move earlier</option><option value="later">Move later</option><option value="milestone">Toggle milestone</option></select> : <Button size="sm" variant={row.kind === 'project' ? 'secondary' : 'outline'} onClick={() => addTask(row.kind === 'group' ? row.phase : 'Execution')}>Add</Button>}</td>
    </tr>;
  };

  return <AppLayout><AppHeader title="Master Schedule" subtitle="MS Project-style roll-up plan: project and phase rows sum activity durations, weighted progress, work hours, and critical counts." />
    <div className="space-y-4 p-4 sm:p-6">
      <div className="rounded-[1.5rem] bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-4 text-white shadow-xl"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">MS Project Roll-up Schedule</p><h1 className="text-xl font-black">Summed Duration and Weighted Progress</h1><p className="text-xs text-slate-300">All-project and selected-project views sum all visible activity durations. Project and phase groups collapse, roll up progress, and keep the table clean without a timeline column.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => addTask()}><Plus className="mr-1 h-4 w-4" /> Task</Button><Button variant="secondary" size="sm" onClick={() => addTask('Execution', true)}><Milestone className="mr-1 h-4 w-4" /> Milestone</Button><Button variant="secondary" size="sm" onClick={() => void generatePlan()}><Sparkles className="mr-1 h-4 w-4" /> Generate</Button><Button variant="secondary" size="sm" onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> Export</Button><Button size="sm" onClick={() => void saveAll()} disabled={!dirtyCount}><Save className="mr-1 h-4 w-4" /> Save All ({dirtyCount})</Button></div></div></div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Master Timeline Progress</p><h2 className="text-lg font-black">{projectFilter === 'all' ? 'All Projects' : selectedProject?.name ?? 'Selected Project'}</h2><p className="text-xs text-muted-foreground">{fmt(master.startDate)} - {fmt(master.endDate)} · summed activity duration {master.durationDays}d · {master.totalActivities} activities</p></div>
          <div className="text-right text-xs text-muted-foreground"><p className="text-2xl font-black text-foreground">{master.progress}%</p><p>{master.completedActivities}/{master.totalActivities} complete · {master.criticalCount} critical</p></div>
        </div>
        <Progress value={master.progress} className="h-4" />
      </div>

      <div className="grid gap-2 rounded-2xl border bg-card p-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_220px_180px_140px_140px_auto]">
        <div className="flex rounded-xl border p-1"><Button size="sm" variant={mode === 'view' ? 'default' : 'ghost'} onClick={() => setMode('view')}>View</Button><Button size="sm" variant={mode === 'edit' ? 'default' : 'ghost'} onClick={() => setMode('edit')}>Edit</Button></div>
        <div className="flex rounded-xl border p-1">{(['plan', 'gantt', 'milestones'] as ViewMode[]).map((item) => <Button key={item} size="sm" variant={view === item ? 'default' : 'ghost'} onClick={() => setView(item)} className="capitalize">{item}</Button>)}</div>
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, phase, project" className="h-9 pl-9" /></label>
        <select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); event.target.value === 'all' ? setSearchParams({}, { replace: true }) : setSearchParams({ projectId: event.target.value }, { replace: true }); }} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">All phases</option>{phases.map((phase) => <option key={phase}>{phase}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="all">Status</option><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-9 rounded-xl border bg-background px-2 text-xs"><option value="wbs">Sort WBS</option><option value="durationDays">Duration</option><option value="startDate">Start</option><option value="endDate">Finish</option><option value="progress">Progress</option><option value="critical">Critical</option></select>
        <Button variant="outline" size="sm" onClick={() => { setProjectFilter('all'); setSearchParams({}, { replace: true }); setPhaseFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setQuery(''); }}><Filter className="mr-1 h-4 w-4" /> Reset</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">{[['Activities', master.totalActivities], ['Total Duration', `${master.durationDays}d`], ['Progress', `${master.progress}%`], ['Critical', master.criticalCount], ['Milestones', master.milestones]].map(([label, value]) => <div key={label} className="rounded-xl border bg-background p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-xl font-black">{value}</p></div>)}</div>

      {view === 'gantt' ? <div className="rounded-2xl border bg-card p-3"><div className="space-y-1 overflow-auto" style={{ maxHeight: viewportHeight }}>{rows.map((row) => <div key={row.id} className={`grid min-w-[940px] grid-cols-[360px_1fr] items-center gap-2 px-2 text-xs ${row.kind === 'project' ? 'bg-slate-900 py-1 text-white' : row.kind === 'group' ? 'bg-blue-50 py-1 font-bold dark:bg-blue-950/30' : ''}`}><span>{row.kind !== 'task' ? <button className="mr-2 rounded border px-1" onClick={() => setCollapsed((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}>{collapsed.includes(row.id) ? '+' : '-'}</button> : null}{row.kind === 'project' ? <Link to={`/projects?projectId=${row.projectId}`} className="font-bold text-cyan-300">{row.title} · {row.durationDays}d</Link> : isTask(row) ? <Link to={`/tasks?taskId=${row.id}&projectId=${row.projectId}`} className={row.critical ? 'font-bold text-red-600' : 'font-bold text-primary'}>{row.wbs} · {row.title}</Link> : `${row.wbs} · ${row.title} · ${row.durationDays}d`}</span><Timeline row={row} start={master.startDate} span={timelineSpan} /></div>)}</div></div> : <div className="rounded-2xl border bg-card shadow-sm"><div className="overflow-auto" style={{ maxHeight: viewportHeight }}><table className="min-w-[1500px] border-separate border-spacing-0 text-left text-xs"><thead><tr>{header('WBS', 'wbs')}{header('Task Name', 'name')}{header('Duration', 'durationDays')}{header('Start', 'startDate')}{header('Finish', 'endDate')}<th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Predecessors</th><th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Work</th><th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Status</th>{header('% Complete', 'progress')}{header('Critical', 'critical')}<th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Action</th></tr></thead><tbody>{visibleRows.map(renderRow)}</tbody></table></div></div>}
    </div></AppLayout>;
};

export default ScheduleMSPlanRollup;
