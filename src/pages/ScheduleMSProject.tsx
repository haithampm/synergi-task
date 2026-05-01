import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Download, ExternalLink, Filter, GitBranch, Milestone, Plus, Save, Search, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useCreateTask, useProjects, useTasks, useUpdateTask } from '@/hooks/useProjects';
import { toast } from 'sonner';

type ScheduleStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type ViewMode = 'table' | 'tree' | 'gantt' | 'milestones';

type EditableRow = {
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
  progress: number;
  durationDays: number;
  plannedHours: number;
  isMilestone: boolean;
  parentTaskId?: string;
  wbs: string;
  level: number;
};

const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment'];
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const today = new Date().toISOString().slice(0, 10);
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const durationDays = (start?: string, end?: string) => {
  if (!start || !end) return 1;
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00`);
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00`);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  return Math.max(1, Number.isFinite(days) ? days : 1);
};
const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const getStatusLabel = (status?: string | null) => {
  const value = normalize(status) || 'todo';
  if (value === 'todo') return 'Tasks';
  if (value === 'in-progress') return 'In Progress';
  return value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
const statusClass: Record<string, string> = {
  backlog: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  todo: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'in-progress': 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};
const priorityClass: Record<string, string> = {
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  medium: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  urgent: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

const buildWbs = (tasks: EditableRow[]) => {
  const byParent = tasks.reduce<Record<string, EditableRow[]>>((acc, task) => {
    const key = task.parentTaskId || '__root__';
    acc[key] = acc[key] ?? [];
    acc[key].push(task);
    return acc;
  }, {});
  const result = new Map<string, { wbs: string; level: number }>();
  const assign = (task: EditableRow, wbs: string, level: number) => {
    result.set(task.id, { wbs, level });
    (byParent[task.id] ?? []).forEach((child, index) => assign(child, `${wbs}.${index + 1}`, level + 1));
  };
  phases.forEach((phase, phaseIndex) => {
    (byParent.__root__ ?? [])
      .filter((task) => task.phase === phase)
      .forEach((task, index) => assign(task, `${phaseIndex + 1}.${index + 1}`, 0));
  });
  (byParent.__root__ ?? [])
    .filter((task) => !phases.includes(task.phase))
    .forEach((task, index) => assign(task, `9.${index + 1}`, 0));
  return result;
};

const ScheduleMSProject = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [draftRows, setDraftRows] = useState<Record<string, Partial<EditableRow>>>({});
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const selectedProject = projectFilter === 'all' ? projects[0] : projects.find((project) => project.id === projectFilter);

  const baseRows = useMemo<EditableRow[]>(() => {
    const mapped = tasks.map((task) => {
      const projectId = task.project_id ?? task.projectId ?? '';
      const project = projectMap.get(projectId);
      const startDate = String(task.start_date ?? task.due_date ?? project?.start_date ?? project?.startDate ?? today).slice(0, 10);
      const endDate = String(task.end_date ?? task.due_date ?? addDays(startDate, 2)).slice(0, 10);
      const duration = durationDays(startDate, endDate);
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
        progress: task.progress ?? (task.status === 'done' ? 100 : 0),
        durationDays: duration,
        plannedHours: task.workloadHours ?? duration * 8,
        isMilestone: task.isMilestone ?? false,
        parentTaskId: task.parentTaskId,
        wbs: '',
        level: 0,
      };
    });
    const wbs = buildWbs(mapped);
    return mapped.map((row) => ({ ...row, ...(wbs.get(row.id) ?? { wbs: '9.9', level: 0 }), ...draftRows[row.id] }));
  }, [draftRows, projectMap, tasks]);

  const parentIdsWithChildren = useMemo(() => new Set(baseRows.map((row) => row.parentTaskId).filter(Boolean) as string[]), [baseRows]);

  const visibleTreeRows = useMemo(() => {
    const byParent = baseRows.reduce<Record<string, EditableRow[]>>((acc, row) => {
      const key = row.parentTaskId || '__root__';
      acc[key] = acc[key] ?? [];
      acc[key].push(row);
      return acc;
    }, {});
    const output: EditableRow[] = [];
    const append = (row: EditableRow) => {
      output.push(row);
      if (collapsed.includes(row.id)) return;
      (byParent[row.id] ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(append);
    };
    (byParent.__root__ ?? []).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true })).forEach(append);
    return output;
  }, [baseRows, collapsed]);

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    const source = viewMode === 'tree' ? visibleTreeRows : baseRows;
    return source.filter((row) => {
      const matchesProject = projectFilter === 'all' || row.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || row.priority === priorityFilter;
      const matchesPhase = phaseFilter === 'all' || row.phase === phaseFilter;
      const matchesSearch = !search || normalize(row.title).includes(search) || normalize(row.projectName).includes(search) || normalize(row.wbs).includes(search);
      const matchesMilestone = viewMode !== 'milestones' || row.isMilestone;
      return matchesProject && matchesStatus && matchesPriority && matchesPhase && matchesSearch && matchesMilestone;
    });
  }, [baseRows, phaseFilter, priorityFilter, projectFilter, query, statusFilter, viewMode, visibleTreeRows]);

  const metrics = useMemo(() => {
    const overdue = filteredRows.filter((row) => row.endDate < today && row.status !== 'done').length;
    const milestones = filteredRows.filter((row) => row.isMilestone).length;
    const plannedHours = filteredRows.reduce((sum, row) => sum + Number(row.plannedHours || 0), 0);
    const completed = filteredRows.filter((row) => row.status === 'done').length;
    const completion = filteredRows.length ? Math.round((completed / filteredRows.length) * 100) : 0;
    return { overdue, milestones, plannedHours, completed, completion };
  }, [filteredRows]);

  const updateDraft = (id: string, updates: Partial<EditableRow>) => {
    setDraftRows((current) => ({ ...current, [id]: { ...current[id], ...updates } }));
  };

  const saveRow = async (row: EditableRow) => {
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
      duration: `${row.durationDays}d`,
      progress: row.progress,
      workloadHours: row.plannedHours,
      isMilestone: row.isMilestone,
      parentTaskId: row.parentTaskId,
    };
    if (row.persisted) await updateTask.mutateAsync({ id: row.id, ...payload });
    else await createTask.mutateAsync({ title: row.title, ...payload });
    setDraftRows((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    toast.success('Schedule activity saved');
  };

  const addTask = (parent?: EditableRow, milestone = false) => {
    const project = parent ? projectMap.get(parent.projectId) : selectedProject;
    if (!project) {
      toast.error('Select a project first');
      return;
    }
    const startDate = parent?.startDate ?? String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    const endDate = milestone ? startDate : addDays(startDate, 2);
    const id = `draft-${Date.now()}`;
    const row: EditableRow = {
      id,
      persisted: false,
      projectId: project.id,
      projectName: project.name,
      title: milestone ? 'New milestone' : parent ? `${parent.title} - subtask` : 'New schedule activity',
      phase: parent?.phase ?? 'Execution',
      status: 'todo',
      priority: 'medium',
      startDate,
      endDate,
      progress: 0,
      durationDays: durationDays(startDate, endDate),
      plannedHours: milestone ? 0 : 24,
      isMilestone: milestone,
      parentTaskId: parent?.id,
      wbs: 'draft',
      level: parent ? parent.level + 1 : 0,
    };
    setDraftRows((current) => ({ ...current, [id]: row }));
    toast.info('Draft row added. Edit it, then click Save.');
  };

  const generateProjectSchedule = async () => {
    const project = selectedProject;
    if (!project) {
      toast.error('Select a project first');
      return;
    }
    const start = String(project.start_date ?? project.startDate ?? today).slice(0, 10);
    const templates = [
      ['Discovery', 'Kickoff meeting', 1, true],
      ['Discovery', 'Requirement collection and stakeholder alignment', 5, false],
      ['Planning', 'Baseline schedule and resource plan', 4, false],
      ['Execution', 'Solution configuration and development', 14, false],
      ['Testing', 'Functional testing and defect resolution', 7, false],
      ['Deployment', 'User acceptance and go-live readiness', 5, false],
      ['Deployment', 'Go-live milestone', 1, true],
    ] as const;
    let cursor = start;
    for (const [phase, title, days, milestone] of templates) {
      const endDate = milestone ? cursor : addDays(cursor, days - 1);
      await createTask.mutateAsync({
        title,
        project_id: project.id,
        projectId: project.id,
        projectName: project.name,
        phase,
        status: 'todo',
        priority: milestone ? 'high' : 'medium',
        start_date: cursor,
        end_date: endDate,
        due_date: endDate,
        duration: `${days}d`,
        progress: 0,
        workloadHours: milestone ? 0 : days * 8,
        isMilestone: milestone,
      });
      cursor = addDays(endDate, 1);
    }
    toast.success('Project schedule generated with phases and milestones');
  };

  const resetFilters = () => {
    setProjectFilter('all');
    setSearchParams({}, { replace: true });
    setStatusFilter('all');
    setPriorityFilter('all');
    setPhaseFilter('all');
    setQuery('');
  };

  const exportCsv = () => {
    const lines = [
      ['WBS', 'Project', 'Task / Activity', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration Days', 'Progress', 'Planned Hours', 'Milestone'],
      ...filteredRows.map((row) => [row.wbs, row.projectName, row.title, row.phase, getStatusLabel(row.status), row.priority, row.startDate, row.endDate, row.durationDays, `${row.progress}%`, row.plannedHours, row.isMilestone ? 'Yes' : 'No']),
    ];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ms-project-style-schedule.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const timelineStart = filteredRows.map((row) => row.startDate).sort()[0] ?? today;
  const timelineEnd = filteredRows.map((row) => row.endDate).sort().at(-1) ?? addDays(today, 30);
  const timelineSpan = durationDays(timelineStart, timelineEnd);

  const renderEditableRow = (row: EditableRow) => {
    const dirty = Boolean(draftRows[row.id]);
    const hasChildren = parentIdsWithChildren.has(row.id);
    return (
      <tr key={row.id} className={`odd:bg-muted/20 hover:bg-primary/5 ${row.endDate < today && row.status !== 'done' ? 'bg-red-500/5' : ''}`}>
        <td className="border-b px-3 py-2 font-mono text-xs font-black text-muted-foreground">
          <span className="inline-flex items-center gap-1" style={{ paddingLeft: `${row.level * 16}px` }}>
            {hasChildren ? (
              <button type="button" onClick={() => setCollapsed((current) => current.includes(row.id) ? current.filter((item) => item !== row.id) : [...current, row.id])}>
                {collapsed.includes(row.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            ) : <span className="w-3" />}
            {row.wbs}
          </span>
        </td>
        <td className="max-w-[220px] border-b px-3 py-2 font-semibold"><Link to={`/projects?projectId=${row.projectId}`} className="text-primary underline-offset-4 hover:underline">{row.projectName}</Link></td>
        <td className="min-w-[280px] border-b px-3 py-2"><Input value={row.title} onChange={(event) => updateDraft(row.id, { title: event.target.value })} /></td>
        <td className="border-b px-3 py-2"><select value={row.phase} onChange={(event) => updateDraft(row.id, { phase: event.target.value })} className="h-9 rounded-xl border bg-background px-2 text-sm">{phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></td>
        <td className="border-b px-3 py-2"><select value={row.status} onChange={(event) => updateDraft(row.id, { status: event.target.value as ScheduleStatus })} className="h-9 rounded-xl border bg-background px-2 text-sm"><option value="backlog">Backlog</option><option value="todo">Tasks</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select></td>
        <td className="border-b px-3 py-2"><select value={row.priority} onChange={(event) => updateDraft(row.id, { priority: event.target.value as Priority })} className="h-9 rounded-xl border bg-background px-2 text-sm"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="urgent">urgent</option></select></td>
        <td className="border-b px-3 py-2"><Input type="date" value={row.startDate} onChange={(event) => updateDraft(row.id, { startDate: event.target.value, durationDays: durationDays(event.target.value, row.endDate) })} /></td>
        <td className="border-b px-3 py-2"><Input type="date" value={row.endDate} onChange={(event) => updateDraft(row.id, { endDate: event.target.value, durationDays: durationDays(row.startDate, event.target.value) })} /></td>
        <td className="border-b px-3 py-2 text-muted-foreground">{durationDays(row.startDate, row.endDate)}d</td>
        <td className="border-b px-3 py-2"><Input type="number" min="0" max="100" value={row.progress} onChange={(event) => updateDraft(row.id, { progress: Number(event.target.value) })} className="w-20" /></td>
        <td className="border-b px-3 py-2"><Input type="number" min="0" value={row.plannedHours} onChange={(event) => updateDraft(row.id, { plannedHours: Number(event.target.value) })} className="w-24" /></td>
        <td className="border-b px-3 py-2"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={row.isMilestone} onChange={(event) => updateDraft(row.id, { isMilestone: event.target.checked, plannedHours: event.target.checked ? 0 : row.plannedHours })} /> Milestone</label></td>
        <td className="border-b px-3 py-2"><div className="flex gap-1"><Button size="sm" variant={dirty || !row.persisted ? 'default' : 'outline'} onClick={() => void saveRow(row)}><Save className="mr-1 h-3 w-3" /> Save</Button><Button size="sm" variant="outline" onClick={() => addTask(row)}><GitBranch className="mr-1 h-3 w-3" /> Sub</Button></div></td>
      </tr>
    );
  };

  return (
    <AppLayout>
      <AppHeader title="Master Schedule" subtitle="Editable MS Project-style schedule with table, tree, Gantt, milestones, generation, tasks, subtasks, and export." />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-5 text-white shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-300">MS Project Style Schedule</p>
              <h1 className="mt-2 text-2xl font-black">Editable Master Schedule</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">Use table, tree, Gantt, and milestone views. Add project tasks, subtasks, generate baseline schedules, edit inline, save, and export.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="gap-2" onClick={() => addTask()}><Plus className="h-4 w-4" /> Add Task</Button>
              <Button type="button" variant="secondary" className="gap-2" onClick={() => addTask(undefined, true)}><Milestone className="h-4 w-4" /> Add Milestone</Button>
              <Button type="button" variant="secondary" className="gap-2" onClick={() => void generateProjectSchedule()}><Sparkles className="h-4 w-4" /> Generate Project Plan</Button>
              <Button type="button" variant="secondary" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Activities', filteredRows.length], ['Completed', metrics.completed], ['Completion', `${metrics.completion}%`], ['Overdue', metrics.overdue], ['Milestones', metrics.milestones],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-background p-4 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}
        </div>

        <div className="rounded-3xl border bg-card p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            {(['table', 'tree', 'gantt', 'milestones'] as ViewMode[]).map((view) => <Button key={view} size="sm" variant={viewMode === view ? 'default' : 'outline'} onClick={() => setViewMode(view)} className="capitalize">{view}</Button>)}
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_160px_160px_160px_auto]">
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search WBS, project, task, or activity" className="pl-9" /></label>
            <select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); event.target.value === 'all' ? setSearchParams({}, { replace: true }) : setSearchParams({ projectId: event.target.value }, { replace: true }); }} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
            <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All phases</option>{phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All statuses</option>{(['backlog', 'todo', 'in-progress', 'review', 'done'] as ScheduleStatus[]).map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}</select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm"><option value="all">All priorities</option>{(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
            <Button type="button" variant="outline" className="gap-2" onClick={resetFilters}><Filter className="h-4 w-4" /> Reset</Button>
          </div>
        </div>

        {viewMode === 'gantt' ? (
          <div className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="space-y-3 overflow-x-auto">
              {filteredRows.map((row) => {
                const left = (durationDays(timelineStart, row.startDate) - 1) / Math.max(1, timelineSpan) * 100;
                const width = durationDays(row.startDate, row.endDate) / Math.max(1, timelineSpan) * 100;
                return <div key={row.id} className="grid min-w-[900px] grid-cols-[280px_1fr] items-center gap-3"><div className="truncate text-sm font-semibold">{row.wbs} · {row.title}</div><div className="relative h-9 rounded-xl bg-muted"><div className={`absolute top-1 h-7 rounded-xl ${row.isMilestone ? 'bg-amber-500' : 'bg-primary'}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(row.isMilestone ? 1.5 : 4, width)}%` }} title={`${formatDate(row.startDate)} - ${formatDate(row.endDate)}`} /></div></div>;
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border bg-card shadow-sm">
            <div className="max-h-[70vh] overflow-auto p-3">
              <table className="min-w-[1700px] border-separate border-spacing-0 text-left text-sm">
                <thead><tr>{['WBS', 'Project', 'Task / Activity', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration', 'Progress', 'Hours', 'Milestone', 'Actions'].map((header) => <th key={header} className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{header}</th>)}</tr></thead>
                <tbody>{filteredRows.map(renderEditableRow)}</tbody>
              </table>
              {filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No schedule activities match the current filters.</div> : null}
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">How to use:</p>
          <p className="mt-1">Select a project, click Generate Project Plan for a baseline schedule with milestones, edit any row inline, add subtasks from the Actions column, then click Save for each changed row.</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default ScheduleMSProject;
