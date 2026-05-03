import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Filter, GitBranch, LayoutGrid, Plus, Search, Table as TableIcon, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, useTasks, useTeamMembers, useUpdateTask } from '@/hooks/useProjects';
import { getTaskLifecycleStage } from '@/lib/project-activities';
import { cn } from '@/lib/utils';

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

const formatDateGroup = (value?: string) => {
  if (!value) return 'No date';
  const today = new Date();
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'No date';
  const diffDays = Math.round((date.getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays <= 7) return 'Due this week';
  if (diffDays <= 30) return 'Due this month';
  return 'Future';
};

const taskDate = (task: any) => task.due_date ?? task.dueDate ?? task.end_date ?? '';
const taskProjectId = (task: any) => task.project_id ?? task.projectId ?? '';
const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

const TasksGroupedTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<GroupBy>((searchParams.get('groupBy') as GroupBy) || 'project');
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [collapsedTasks, setCollapsedTasks] = useState<string[]>([]);
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const updateTask = useUpdateTask();

  const projectFilterId = searchParams.get('projectId') ?? '';
  const stageFilter = searchParams.get('stage') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
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
    const roots = groupBy === 'none' ? rootTasks : rootTasks;
    roots.forEach((task: any) => {
      const label = getGroupLabel(task);
      grouped.set(label, [...(grouped.get(label) ?? []), task]);
    });

    const rows: FlatRow[] = [];
    Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach(([label, groupTasks]) => {
        const groupTaskIds = new Set<string>();
        const collect = (task: any) => {
          groupTaskIds.add(task.id);
          (childMap[task.id] ?? []).forEach(collect);
        };
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
        groupTasks
          .sort((a: any, b: any) => String(taskDate(a) || '').localeCompare(String(taskDate(b) || '')) || String(a.title).localeCompare(String(b.title)))
          .forEach((task: any) => appendTask(task, 0));
      });
    return rows;
  }, [childMap, collapsedGroups, collapsedTasks, groupBy, rootTasks, visibleTasks, projectNameById]);

  const updateGroupBy = (value: GroupBy) => {
    setGroupBy(value);
    setCollapsedGroups([]);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('groupBy', value);
      return next;
    }, { replace: true });
  };

  const toggleGroup = (id: string) => setCollapsedGroups((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleTask = (id: string) => setCollapsedTasks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const expandAll = () => { setCollapsedGroups([]); setCollapsedTasks([]); };
  const collapseAll = () => setCollapsedGroups(groupedRows.filter((row) => row.type === 'group').map((row) => row.id));

  const openTask = (task: any) => {
    const next = new URLSearchParams(searchParams);
    next.set('taskId', task.id);
    next.set('projectId', taskProjectId(task));
    setSearchParams(next, { replace: true });
    window.dispatchEvent(new CustomEvent('synergi-open-task', { detail: { taskId: task.id, projectId: taskProjectId(task) } }));
  };

  return (
    <AppLayout>
      <AppHeader title="Tasks" subtitle="Grouped workload table with collapsible project, assignee, date, status, priority and phase views" />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-[1.5rem] border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Task Control</p>
              <h1 className="text-2xl font-black">Grouped Task Table</h1>
              <p className="text-sm text-muted-foreground">Default view groups by project. Change grouping by assignee, date, status, priority, or phase.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>Expand all</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Collapse groups</Button>
              <Button asChild size="sm" className="gap-2"><Link to="/tasks?action=create"><Plus className="h-4 w-4" /> New Task</Link></Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 rounded-2xl border bg-card p-3 lg:grid-cols-[auto_220px_minmax(0,1fr)_180px_180px_auto]">
          <div className="flex rounded-xl border p-1">
            <Button size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} onClick={() => setViewMode('table')}><TableIcon className="mr-1 h-4 w-4" /> Table</Button>
            <Button size="sm" variant={viewMode === 'board' ? 'default' : 'ghost'} onClick={() => setViewMode('board')}><LayoutGrid className="mr-1 h-4 w-4" /> Board</Button>
          </div>
          <Select value={groupBy} onValueChange={(value) => updateGroupBy(value as GroupBy)}>
            <SelectTrigger><SelectValue placeholder="Group by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Group by Project</SelectItem>
              <SelectItem value="assignee">Group by Assignee</SelectItem>
              <SelectItem value="date">Group by Date</SelectItem>
              <SelectItem value="status">Group by Status</SelectItem>
              <SelectItem value="priority">Group by Priority</SelectItem>
              <SelectItem value="phase">Group by Phase</SelectItem>
              <SelectItem value="none">No Grouping</SelectItem>
            </SelectContent>
          </Select>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, assignee, project, phase" className="pl-9" />
          </label>
          <Select value={statusFilter || 'all'} onValueChange={(value) => setSearchParams((current) => { const next = new URLSearchParams(current); value === 'all' ? next.delete('status') : next.set('status', value); return next; }, { replace: true })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{statusColumns.map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={projectFilterId || 'all'} onValueChange={(value) => setSearchParams((current) => { const next = new URLSearchParams(current); value === 'all' ? next.delete('projectId') : next.set('projectId', value); return next; }, { replace: true })}>
            <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setQuery(''); setSearchParams({}, { replace: true }); setGroupBy('project'); }}><Filter className="mr-1 h-4 w-4" /> Reset</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visible Tasks</p><p className="text-2xl font-black">{visibleTasks.length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Completed</p><p className="text-2xl font-black">{visibleTasks.filter((task: any) => task.status === 'done').length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Groups</p><p className="text-2xl font-black">{groupedRows.filter((row) => row.type === 'group').length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Filter</p><p className="truncate text-sm font-black">{filteredProject?.name ?? 'All Projects'}</p></CardContent></Card>
        </div>

        {viewMode === 'board' ? (
          <div className="flex gap-5 overflow-x-auto pb-6">
            {statusColumns.map((column) => (
              <div key={column.id} className="min-w-[320px] rounded-3xl bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded-full', column.color)} /><b className="text-sm uppercase tracking-wide">{column.label}</b></div><Badge>{visibleTasks.filter((task: any) => task.status === column.id).length}</Badge></div>
                <div className="space-y-3">
                  {visibleTasks.filter((task: any) => task.status === column.id).map((task: any) => <button key={task.id} onClick={() => openTask(task)} className="w-full rounded-2xl border bg-background p-4 text-left hover:bg-muted/20"><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{projectNameById.get(taskProjectId(task)) ?? 'Unassigned'} · {task.assignee || 'Unassigned'}</p></button>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden shadow-sm">
            <div className="overflow-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Task / Group</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Due</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-muted-foreground">Assignee</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((row) => {
                    if (row.type === 'group') {
                      const collapsed = collapsedGroups.includes(row.id);
                      const progress = percent(row.completed ?? 0, row.count ?? 0);
                      return (
                        <tr key={row.id} className="border-t bg-slate-950 text-white">
                          <td colSpan={7} className="px-4 py-2">
                            <button type="button" onClick={() => toggleGroup(row.id)} className="flex w-full items-center justify-between gap-3 text-left">
                              <span className="flex items-center gap-2"><span className="rounded border border-white/30 px-1 text-cyan-300">{collapsed ? '+' : '-'}</span><span className="font-black">{row.label}</span><span className="text-xs text-slate-300">{row.count} tasks · {row.completed} done</span></span>
                              <span className="flex min-w-[180px] items-center gap-2 text-xs"><span>{progress}%</span><span className="h-2 flex-1 overflow-hidden rounded bg-white/20"><span className="block h-full rounded bg-cyan-300" style={{ width: `${progress}%` }} /></span></span>
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    const task = row.task;
                    const children = childMap[task.id] ?? [];
                    const collapsed = collapsedTasks.includes(task.id);
                    return (
                      <tr key={task.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${(row.level ?? 0) * 20}px` }}>
                            {children.length ? <button type="button" onClick={() => toggleTask(task.id)} className="rounded border px-1 text-primary">{collapsed ? '+' : '-'}</button> : <span className="w-5" />}
                            <button type="button" className="text-left font-semibold hover:text-primary" onClick={() => openTask(task)}>{task.title}</button>
                            {task.parentTaskId ? <Badge variant="outline">Subtask</Badge> : <Badge variant="secondary">Main</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground"><Link to={`/projects?projectId=${taskProjectId(task)}`} className="font-medium text-primary hover:underline">{projectNameById.get(taskProjectId(task)) || task.projectName || 'Unassigned'}</Link></td>
                        <td className="px-4 py-2"><Badge variant="outline">{String(task.status || 'todo').replace(/-/g, ' ')}</Badge></td>
                        <td className="px-4 py-2"><Badge variant="outline" className={cn('capitalize', priorityColor[task.priority] ?? '')}>{task.priority || 'medium'}</Badge></td>
                        <td className="px-4 py-2 text-xs text-muted-foreground"><Calendar className="mr-1 inline h-3 w-3" />{taskDate(task) || 'No date'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground"><User className="mr-1 inline h-3 w-3" />{task.assignee || 'Unassigned'}</td>
                        <td className="px-4 py-2 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openTask(task)}>Open</Button><Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' })}>{task.status === 'done' ? 'Reopen' : 'Done'}</Button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!groupedRows.length ? <div className="p-10 text-center text-sm text-muted-foreground">No tasks match the current filters.</div> : null}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default TasksGroupedTable;
