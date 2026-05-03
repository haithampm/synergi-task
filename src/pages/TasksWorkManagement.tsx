import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Clock, Filter, LayoutGrid, Plus, PlayCircle, Search, Square, Table as TableIcon, Timer, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTask, useProjects, useTasks, useTeamMembers, useUpdateTask } from '@/hooks/useProjects';
import { getTaskLifecycleStage } from '@/lib/project-activities';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type GroupBy = 'project' | 'assignee' | 'date' | 'status' | 'priority' | 'phase' | 'none';
type ViewMode = 'table' | 'board';

type FlatRow = {
  type: 'group' | 'task';
  id: string;
  label?: string;
  count?: number;
  completed?: number;
  level?: number;
  task?: any;
};

const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment', 'Closure'];
const statusColumns = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'todo', label: 'Tasks', color: 'bg-sky-500' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-indigo-500' },
  { id: 'review', label: 'Review', color: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' },
];

const priorityColor: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-warning/10 text-warning border-warning/30',
  medium: 'bg-info/10 text-info border-info/30',
  low: 'bg-muted text-muted-foreground',
};

const taskProjectId = (task: any) => task.project_id ?? task.projectId ?? '';
const taskDate = (task: any) => task.due_date ?? task.dueDate ?? task.end_date ?? '';
const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);
const hoursBetween = (startMs: number, endMs: number) => Math.max(0.01, Math.round(((endMs - startMs) / 3600000) * 100) / 100);

const formatDateGroup = (value?: string) => {
  if (!value) return 'No date';
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const date = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(date)) return 'No date';
  const diffDays = Math.round((date - today) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays <= 7) return 'Due this week';
  if (diffDays <= 30) return 'Due this month';
  return 'Future';
};

const defaultNewTask = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
  assignee: '',
  project_id: '',
  parentTaskId: '',
  phase: 'Execution',
  isMilestone: false,
};

const TasksWorkManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<GroupBy>((searchParams.get('groupBy') as GroupBy) || 'project');
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [collapsedTasks, setCollapsedTasks] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [newTask, setNewTask] = useState(defaultNewTask);
  const [runningTimers, setRunningTimers] = useState<Record<string, number>>({});
  const [manualEntry, setManualEntry] = useState({ date: new Date().toISOString().slice(0, 10), member: '', hours: '1', activity: '', notes: '' });

  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const projectFilterId = searchParams.get('projectId') ?? '';
  const stageFilter = searchParams.get('stage') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const taskIdParam = searchParams.get('taskId') ?? '';
  const filteredProject = projects.find((project: any) => project.id === projectFilterId);
  const projectNameById = useMemo(() => new Map(projects.map((project: any) => [project.id, project.name])), [projects]);

  const visibleTasks = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tasks.filter((task: any) => {
      const matchesProject = !projectFilterId || taskProjectId(task) === projectFilterId;
      const matchesStage = !stageFilter || getTaskLifecycleStage(task) === stageFilter;
      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesSearch = !search || [task.title, task.description, task.assignee, task.projectName, task.phase, task.status, task.priority]
        .some((value) => String(value ?? '').toLowerCase().includes(search));
      return matchesProject && matchesStage && matchesStatus && matchesSearch;
    });
  }, [projectFilterId, query, stageFilter, statusFilter, tasks]);

  const childMap = useMemo(() => visibleTasks.reduce<Record<string, any[]>>((acc, task: any) => {
    if (!task.parentTaskId) return acc;
    acc[task.parentTaskId] = acc[task.parentTaskId] ?? [];
    acc[task.parentTaskId].push(task);
    return acc;
  }, {}), [visibleTasks]);

  const rootTasks = useMemo(() => visibleTasks.filter((task: any) => !task.parentTaskId || !visibleTasks.some((candidate: any) => candidate.id === task.parentTaskId)), [visibleTasks]);
  const selectedProjectTasks = useMemo(() => tasks.filter((task: any) => !newTask.project_id || taskProjectId(task) === newTask.project_id), [newTask.project_id, tasks]);

  const getGroupLabel = (task: any) => {
    if (groupBy === 'none') return 'All Tasks';
    if (groupBy === 'project') return projectNameById.get(taskProjectId(task)) || task.projectName || 'Unassigned Project';
    if (groupBy === 'assignee') return task.assignee || 'Unassigned';
    if (groupBy === 'date') return formatDateGroup(taskDate(task));
    if (groupBy === 'status') return String(task.status || 'No status').replace(/-/g, ' ');
    if (groupBy === 'priority') return task.priority || 'No priority';
    if (groupBy === 'phase') return task.phase || 'No phase';
    return 'All Tasks';
  };

  const groupedRows = useMemo<FlatRow[]>(() => {
    const grouped = new Map<string, any[]>();
    rootTasks.forEach((task: any) => {
      const label = getGroupLabel(task);
      grouped.set(label, [...(grouped.get(label) ?? []), task]);
    });
    const rows: FlatRow[] = [];
    Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).forEach(([label, groupTasks]) => {
      const groupTaskIds = new Set<string>();
      const collect = (task: any) => { groupTaskIds.add(task.id); (childMap[task.id] ?? []).forEach(collect); };
      groupTasks.forEach(collect);
      const allGroupTasks = visibleTasks.filter((task: any) => groupTaskIds.has(task.id));
      const completed = allGroupTasks.filter((task: any) => task.status === 'done').length;
      const groupId = `group-${groupBy}-${label}`;
      rows.push({ type: 'group', id: groupId, label, count: allGroupTasks.length, completed });
      if (collapsedGroups.includes(groupId)) return;
      const appendTask = (task: any, level: number) => {
        rows.push({ type: 'task', id: task.id, task, level });
        if (collapsedTasks.includes(task.id)) return;
        (childMap[task.id] ?? []).forEach((child) => appendTask(child, level + 1));
      };
      groupTasks.sort((a: any, b: any) => String(taskDate(a) || '').localeCompare(String(taskDate(b) || '')) || String(a.title).localeCompare(String(b.title))).forEach((task: any) => appendTask(task, 0));
    });
    return rows;
  }, [childMap, collapsedGroups, collapsedTasks, groupBy, rootTasks, visibleTasks, projectNameById]);

  const openCreate = (parentTask?: any) => {
    const projectId = parentTask ? taskProjectId(parentTask) : projectFilterId;
    setNewTask({
      ...defaultNewTask,
      project_id: projectId,
      parentTaskId: parentTask?.id ?? '',
      phase: parentTask?.phase ?? 'Execution',
      assignee: parentTask?.assignee ?? '',
      priority: parentTask?.priority ?? 'medium',
      status: parentTask?.status ?? 'todo',
      dueDate: parentTask ? taskDate(parentTask) : '',
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newTask.title.trim()) return toast.error('Task title is required');
    if (!newTask.project_id) return toast.error('Select a project');
    await createTask.mutateAsync({
      ...newTask,
      projectId: newTask.project_id,
      projectName: projectNameById.get(newTask.project_id) ?? '',
      parentTaskId: newTask.parentTaskId || undefined,
      phase: newTask.phase || 'Execution',
      due_date: newTask.dueDate || undefined,
      timesheetEntries: [],
      actualHours: 0,
    });
    toast.success(newTask.parentTaskId ? 'Subtask created' : 'Task created');
    setCreateOpen(false);
    setNewTask(defaultNewTask);
  };

  const openTask = (task: any) => {
    setSelectedTask({ ...task, actualHours: task.actualHours ?? task.actual_hours ?? 0, timesheetEntries: task.timesheetEntries ?? task.timesheet_entries ?? [] });
    setManualEntry({ date: new Date().toISOString().slice(0, 10), member: task.assignee || '', hours: '1', activity: '', notes: '' });
    const next = new URLSearchParams(searchParams);
    next.set('taskId', task.id);
    next.set('projectId', taskProjectId(task));
    setSearchParams(next, { replace: true });
    setDetailOpen(true);
  };

  const saveSelectedTask = async (taskOverride?: any) => {
    const task = taskOverride ?? selectedTask;
    if (!task) return;
    await updateTask.mutateAsync(task);
    setSelectedTask(task);
    toast.success('Task details saved');
  };

  const addTimesheetEntry = async (entry: { date: string; member: string; hours: number; activity: string; notes?: string; source?: string; startedAt?: string; stoppedAt?: string }) => {
    if (!selectedTask) return;
    if (!entry.activity.trim()) return toast.error('Enter activity description');
    const existing = selectedTask.timesheetEntries ?? selectedTask.timesheet_entries ?? [];
    const nextEntry = { id: `timesheet-${Date.now()}`, ...entry };
    const actualHours = Math.round((Number(selectedTask.actualHours ?? selectedTask.actual_hours ?? 0) + Number(entry.hours || 0)) * 100) / 100;
    const updated = { ...selectedTask, timesheetEntries: [...existing, nextEntry], actualHours };
    await saveSelectedTask(updated);
    setManualEntry({ date: new Date().toISOString().slice(0, 10), member: selectedTask.assignee || '', hours: '1', activity: '', notes: '' });
  };

  const startTimer = (task: any) => {
    setRunningTimers((current) => ({ ...current, [task.id]: Date.now() }));
    toast.success(`Timer started for ${task.title}`);
  };

  const stopTimer = async (task: any) => {
    const startMs = runningTimers[task.id];
    if (!startMs) return;
    const endMs = Date.now();
    setRunningTimers((current) => { const next = { ...current }; delete next[task.id]; return next; });
    const detailTask = selectedTask?.id === task.id ? selectedTask : task;
    setSelectedTask({ ...detailTask, actualHours: detailTask.actualHours ?? detailTask.actual_hours ?? 0, timesheetEntries: detailTask.timesheetEntries ?? detailTask.timesheet_entries ?? [] });
    const hours = hoursBetween(startMs, endMs);
    await addTimesheetEntry({
      date: new Date().toISOString().slice(0, 10),
      member: task.assignee || 'Unassigned',
      hours,
      activity: `Timer work on ${task.title}`,
      notes: 'Auto-calculated from task timer',
      source: 'timer',
      startedAt: new Date(startMs).toISOString(),
      stoppedAt: new Date(endMs).toISOString(),
    });
  };

  const updateGroupBy = (value: GroupBy) => {
    setGroupBy(value);
    setCollapsedGroups([]);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('groupBy', value); return next; }, { replace: true });
  };

  const toggleGroup = (id: string) => setCollapsedGroups((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleTask = (id: string) => setCollapsedTasks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <AppLayout>
      <AppHeader title="Tasks" subtitle="Project tasks, subtasks, detail tracking, and timer-based actual hours" />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-[1.5rem] border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Task Control</p>
              <h1 className="text-2xl font-black">Grouped Task Table</h1>
              <p className="text-sm text-muted-foreground">Create project tasks, select phase, choose main/subtask, and track actual work with timer timesheets.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setCollapsedGroups([]); setCollapsedTasks([]); }}>Expand all</Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsedGroups(groupedRows.filter((row) => row.type === 'group').map((row) => row.id))}>Collapse groups</Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-2" onClick={() => openCreate()}><Plus className="h-4 w-4" /> New Task</Button></DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader><DialogTitle>Create Project Task</DialogTitle></DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <Input placeholder="Task title *" value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} />
                      <Textarea placeholder="Task details / scope" value={newTask.description} onChange={(event) => setNewTask((current) => ({ ...current, description: event.target.value }))} rows={5} />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={newTask.status} onValueChange={(value) => setNewTask((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusColumns.map((status) => <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={newTask.priority} onValueChange={(value) => setNewTask((current) => ({ ...current, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Select value={newTask.project_id || '__none__'} onValueChange={(value) => setNewTask((current) => ({ ...current, project_id: value === '__none__' ? '' : value, parentTaskId: '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select Project *" /></SelectTrigger>
                        <SelectContent><SelectItem value="__none__">Select project</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={newTask.phase} onValueChange={(value) => setNewTask((current) => ({ ...current, phase: value }))}><SelectTrigger><SelectValue placeholder="Project Phase" /></SelectTrigger><SelectContent>{phases.map((phase) => <SelectItem key={phase} value={phase}>{phase}</SelectItem>)}</SelectContent></Select>
                      <Select value={newTask.parentTaskId || '__main__'} onValueChange={(value) => setNewTask((current) => ({ ...current, parentTaskId: value === '__main__' ? '' : value }))}>
                        <SelectTrigger><SelectValue placeholder="Main task or subtask" /></SelectTrigger>
                        <SelectContent><SelectItem value="__main__">Main task</SelectItem>{selectedProjectTasks.map((task: any) => <SelectItem key={task.id} value={task.id}>Subtask of: {task.title}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="date" value={newTask.dueDate} onChange={(event) => setNewTask((current) => ({ ...current, dueDate: event.target.value }))} />
                      <Select value={newTask.assignee || '__unassigned__'} onValueChange={(value) => setNewTask((current) => ({ ...current, assignee: value === '__unassigned__' ? '' : value }))}>
                        <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                        <SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={createTask.isPending}>Create Task</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid gap-2 rounded-2xl border bg-card p-3 lg:grid-cols-[auto_220px_minmax(0,1fr)_180px_180px_auto]">
          <div className="flex rounded-xl border p-1"><Button size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} onClick={() => setViewMode('table')}><TableIcon className="mr-1 h-4 w-4" /> Table</Button><Button size="sm" variant={viewMode === 'board' ? 'default' : 'ghost'} onClick={() => setViewMode('board')}><LayoutGrid className="mr-1 h-4 w-4" /> Board</Button></div>
          <Select value={groupBy} onValueChange={(value) => updateGroupBy(value as GroupBy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project">Group by Project</SelectItem><SelectItem value="assignee">Group by Assignee</SelectItem><SelectItem value="date">Group by Date</SelectItem><SelectItem value="status">Group by Status</SelectItem><SelectItem value="priority">Group by Priority</SelectItem><SelectItem value="phase">Group by Phase</SelectItem><SelectItem value="none">No Grouping</SelectItem></SelectContent></Select>
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, assignee, project, phase" className="pl-9" /></label>
          <Select value={statusFilter || 'all'} onValueChange={(value) => setSearchParams((current) => { const next = new URLSearchParams(current); value === 'all' ? next.delete('status') : next.set('status', value); return next; }, { replace: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statusColumns.map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}</SelectContent></Select>
          <Select value={projectFilterId || 'all'} onValueChange={(value) => setSearchParams((current) => { const next = new URLSearchParams(current); value === 'all' ? next.delete('projectId') : next.set('projectId', value); return next; }, { replace: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" onClick={() => { setQuery(''); setSearchParams({}, { replace: true }); setGroupBy('project'); }}><Filter className="mr-1 h-4 w-4" /> Reset</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visible Tasks</p><p className="text-2xl font-black">{visibleTasks.length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Completed</p><p className="text-2xl font-black">{visibleTasks.filter((task: any) => task.status === 'done').length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Running Timers</p><p className="text-2xl font-black">{Object.keys(runningTimers).length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Filter</p><p className="truncate text-sm font-black">{filteredProject?.name ?? 'All Projects'}</p></CardContent></Card></div>

        {viewMode === 'board' ? <div className="flex gap-5 overflow-x-auto pb-6">{statusColumns.map((column) => <div key={column.id} className="min-w-[320px] rounded-3xl bg-muted/30 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded-full', column.color)} /><b className="text-sm uppercase tracking-wide">{column.label}</b></div><Badge>{visibleTasks.filter((task: any) => task.status === column.id).length}</Badge></div><div className="space-y-3">{visibleTasks.filter((task: any) => task.status === column.id).map((task: any) => <button key={task.id} onClick={() => openTask(task)} className="w-full rounded-2xl border bg-background p-4 text-left hover:bg-muted/20"><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{projectNameById.get(taskProjectId(task)) ?? 'Unassigned'} · {task.assignee || 'Unassigned'}</p></button>)}</div></div>)}</div> : <Card className="overflow-hidden shadow-sm"><div className="overflow-auto"><table className="min-w-[1200px] w-full text-sm"><thead className="bg-muted/40"><tr><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Task / Group</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Project</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Status</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Priority</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Due</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Assignee</th><th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Actual</th><th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-muted-foreground">Actions</th></tr></thead><tbody>{groupedRows.map((row) => { if (row.type === 'group') { const collapsed = collapsedGroups.includes(row.id); const progress = percent(row.completed ?? 0, row.count ?? 0); return <tr key={row.id} className="border-t bg-slate-950 text-white"><td colSpan={8} className="px-4 py-2"><button type="button" onClick={() => toggleGroup(row.id)} className="flex w-full items-center justify-between gap-3 text-left"><span className="flex items-center gap-2"><span className="rounded border border-white/30 px-1 text-cyan-300">{collapsed ? '+' : '-'}</span><span className="font-black">{row.label}</span><span className="text-xs text-slate-300">{row.count} tasks · {row.completed} done</span></span><span className="flex min-w-[180px] items-center gap-2 text-xs"><span>{progress}%</span><span className="h-2 flex-1 overflow-hidden rounded bg-white/20"><span className="block h-full rounded bg-cyan-300" style={{ width: `${progress}%` }} /></span></span></button></td></tr>; } const task = row.task; const children = childMap[task.id] ?? []; const collapsed = collapsedTasks.includes(task.id); const isRunning = Boolean(runningTimers[task.id]); return <tr key={task.id} className="border-t hover:bg-muted/20"><td className="px-4 py-2"><div className="flex items-center gap-2" style={{ paddingLeft: `${(row.level ?? 0) * 20}px` }}>{children.length ? <button type="button" onClick={() => toggleTask(task.id)} className="rounded border px-1 text-primary">{collapsed ? '+' : '-'}</button> : <span className="w-5" />}<button type="button" className="text-left font-semibold hover:text-primary" onClick={() => openTask(task)}>{task.title}</button>{task.parentTaskId ? <Badge variant="outline">Subtask</Badge> : <Badge variant="secondary">Main</Badge>}</div></td><td className="px-4 py-2 text-xs text-muted-foreground"><Link to={`/projects?projectId=${taskProjectId(task)}`} className="font-medium text-primary hover:underline">{projectNameById.get(taskProjectId(task)) || task.projectName || 'Unassigned'}</Link></td><td className="px-4 py-2"><Badge variant="outline">{String(task.status || 'todo').replace(/-/g, ' ')}</Badge></td><td className="px-4 py-2"><Badge variant="outline" className={cn('capitalize', priorityColor[task.priority] ?? '')}>{task.priority || 'medium'}</Badge></td><td className="px-4 py-2 text-xs text-muted-foreground"><Calendar className="mr-1 inline h-3 w-3" />{taskDate(task) || 'No date'}</td><td className="px-4 py-2 text-xs text-muted-foreground"><User className="mr-1 inline h-3 w-3" />{task.assignee || 'Unassigned'}</td><td className="px-4 py-2 text-xs font-bold">{task.actualHours ?? task.actual_hours ?? 0}h</td><td className="px-4 py-2 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openTask(task)}>Open</Button><Button size="sm" variant={isRunning ? 'destructive' : 'outline'} onClick={() => isRunning ? stopTimer(task) : startTimer(task)}>{isRunning ? <Square className="mr-1 h-3 w-3" /> : <PlayCircle className="mr-1 h-3 w-3" />}{isRunning ? 'Stop' : 'Start'}</Button><Button size="sm" variant="outline" onClick={() => openCreate(task)}>Subtask</Button></div></td></tr>; })}</tbody></table>{!groupedRows.length ? <div className="p-10 text-center text-sm text-muted-foreground">No tasks match the current filters.</div> : null}</div></Card>}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl">
          {selectedTask ? <><DialogHeader><DialogTitle>{selectedTask.title}</DialogTitle></DialogHeader><Tabs defaultValue="details"><TabsList><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="timesheet">Timesheet</TabsTrigger></TabsList><TabsContent value="details" className="space-y-4 pt-4"><div className="grid gap-3 md:grid-cols-2"><Input value={selectedTask.title ?? ''} onChange={(event) => setSelectedTask((current: any) => ({ ...current, title: event.target.value }))} /><Select value={selectedTask.status ?? 'todo'} onValueChange={(value) => setSelectedTask((current: any) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusColumns.map((status) => <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>)}</SelectContent></Select><Select value={selectedTask.phase ?? 'Execution'} onValueChange={(value) => setSelectedTask((current: any) => ({ ...current, phase: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{phases.map((phase) => <SelectItem key={phase} value={phase}>{phase}</SelectItem>)}</SelectContent></Select><Select value={selectedTask.assignee || '__unassigned__'} onValueChange={(value) => setSelectedTask((current: any) => ({ ...current, assignee: value === '__unassigned__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent></Select><Input type="date" value={taskDate(selectedTask)} onChange={(event) => setSelectedTask((current: any) => ({ ...current, dueDate: event.target.value, due_date: event.target.value }))} /><Input value={`${selectedTask.actualHours ?? selectedTask.actual_hours ?? 0} actual hours`} readOnly /></div><Textarea rows={5} value={selectedTask.description ?? ''} onChange={(event) => setSelectedTask((current: any) => ({ ...current, description: event.target.value }))} /><div className="flex justify-between"><Button variant={runningTimers[selectedTask.id] ? 'destructive' : 'outline'} onClick={() => runningTimers[selectedTask.id] ? stopTimer(selectedTask) : startTimer(selectedTask)}>{runningTimers[selectedTask.id] ? <Square className="mr-2 h-4 w-4" /> : <Timer className="mr-2 h-4 w-4" />}{runningTimers[selectedTask.id] ? 'Stop timer and add actual hours' : 'Start timer'}</Button><Button onClick={() => saveSelectedTask()}>Save Details</Button></div></TabsContent><TabsContent value="timesheet" className="space-y-4 pt-4"><div className="grid gap-3 md:grid-cols-5"><Input type="date" value={manualEntry.date} onChange={(event) => setManualEntry((current) => ({ ...current, date: event.target.value }))} /><Select value={manualEntry.member || '__unassigned__'} onValueChange={(value) => setManualEntry((current) => ({ ...current, member: value === '__unassigned__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" step="0.25" value={manualEntry.hours} onChange={(event) => setManualEntry((current) => ({ ...current, hours: event.target.value }))} /><Input className="md:col-span-2" placeholder="Activity completed" value={manualEntry.activity} onChange={(event) => setManualEntry((current) => ({ ...current, activity: event.target.value }))} /></div><Textarea placeholder="Notes" value={manualEntry.notes} onChange={(event) => setManualEntry((current) => ({ ...current, notes: event.target.value }))} /><Button onClick={() => addTimesheetEntry({ date: manualEntry.date, member: manualEntry.member || selectedTask.assignee || 'Unassigned', hours: Number(manualEntry.hours || 0), activity: manualEntry.activity, notes: manualEntry.notes, source: 'manual' })}><Clock className="mr-2 h-4 w-4" />Add Timesheet Entry</Button><div className="space-y-2">{(selectedTask.timesheetEntries ?? []).map((entry: any) => <div key={entry.id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between"><b>{entry.activity}</b><span>{entry.hours}h</span></div><p className="text-xs text-muted-foreground">{entry.date} · {entry.member} · {entry.source ?? 'manual'}</p>{entry.notes ? <p className="mt-1 text-xs">{entry.notes}</p> : null}</div>)}</div></TabsContent></Tabs></> : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TasksWorkManagement;
