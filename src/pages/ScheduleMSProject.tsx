import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, ExternalLink, Filter, GanttChart, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

type ProjectRow = {
  id: string;
  name: string;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  phase?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  due_date?: string | null;
  duration_days?: number | null;
  progress?: number | null;
  project_id?: string | null;
  parent_task_id?: string | null;
  assignee_id?: string | null;
  workload_hours?: number | null;
  estimated_hours?: number | null;
  is_milestone?: boolean | null;
};

type ScheduleRow = TaskRow & {
  projectName: string;
  wbs: string;
  startValue: string;
  endValue: string;
  durationValue: number;
  plannedHours: number;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const today = new Date().toISOString().slice(0, 10);

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getDuration = (task: TaskRow) => {
  if (task.duration_days) return task.duration_days;
  const start = task.start_date;
  const end = task.end_date ?? task.due_date;
  if (start && end) {
    const startDate = new Date(`${start.slice(0, 10)}T00:00:00`);
    const endDate = new Date(`${end.slice(0, 10)}T00:00:00`);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    return Math.max(1, days);
  }
  return 1;
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

const ScheduleMSProject = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [query, setQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [projectResult, taskResult] = await Promise.all([
        supabase.from('projects').select('id,name,status,start_date,end_date,progress').order('name', { ascending: true }),
        supabase
          .from('tasks')
          .select('id,title,status,priority,phase,start_date,end_date,due_date,duration_days,progress,project_id,parent_task_id,assignee_id,workload_hours,estimated_hours,is_milestone')
          .order('start_date', { ascending: true, nullsFirst: false }),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (taskResult.error) throw taskResult.error;
      setProjects((projectResult.data ?? []) as ProjectRow[]);
      setTasks((taskResult.data ?? []) as TaskRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load schedule data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const rows = useMemo<ScheduleRow[]>(() => {
    const phaseCounters = new Map<string, number>();
    return tasks.map((task) => {
      const project = projectMap.get(task.project_id ?? '');
      const phase = task.phase || 'Execution';
      const next = (phaseCounters.get(`${task.project_id}-${phase}`) ?? 0) + 1;
      phaseCounters.set(`${task.project_id}-${phase}`, next);
      const projectIndex = Math.max(1, projects.findIndex((item) => item.id === task.project_id) + 1);
      const phaseIndex = Math.max(1, ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment'].indexOf(phase) + 1);
      const startValue = task.start_date ?? task.due_date ?? project?.start_date ?? '';
      const endValue = task.end_date ?? task.due_date ?? project?.end_date ?? '';
      return {
        ...task,
        projectName: project?.name ?? 'Unassigned Project',
        wbs: `${projectIndex}.${phaseIndex}.${next}`,
        startValue,
        endValue,
        durationValue: getDuration(task),
        plannedHours: Number(task.workload_hours ?? task.estimated_hours ?? 0) || getDuration(task) * 8,
      };
    });
  }, [projectMap, projects, tasks]);

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => normalize(row.status)).filter(Boolean))).sort(), [rows]);
  const priorityOptions = useMemo(() => Array.from(new Set(rows.map((row) => normalize(row.priority)).filter(Boolean))).sort(), [rows]);
  const phaseOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.phase || 'Execution'))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    return rows.filter((row) => {
      const matchesProject = projectFilter === 'all' || row.project_id === projectFilter;
      const matchesStatus = statusFilter === 'all' || normalize(row.status) === statusFilter;
      const matchesPriority = priorityFilter === 'all' || normalize(row.priority) === priorityFilter;
      const matchesPhase = phaseFilter === 'all' || (row.phase || 'Execution') === phaseFilter;
      const matchesSearch = !search || normalize(row.title).includes(search) || normalize(row.projectName).includes(search) || normalize(row.wbs).includes(search);
      return matchesProject && matchesStatus && matchesPriority && matchesPhase && matchesSearch;
    });
  }, [phaseFilter, priorityFilter, projectFilter, query, rows, statusFilter]);

  const metrics = useMemo(() => {
    const overdue = filteredRows.filter((row) => row.endValue && row.endValue.slice(0, 10) < today && normalize(row.status) !== 'done').length;
    const milestones = filteredRows.filter((row) => row.is_milestone).length;
    const plannedHours = filteredRows.reduce((sum, row) => sum + row.plannedHours, 0);
    const completed = filteredRows.filter((row) => normalize(row.status) === 'done').length;
    const completion = filteredRows.length ? Math.round((completed / filteredRows.length) * 100) : 0;
    return { overdue, milestones, plannedHours, completed, completion };
  }, [filteredRows]);

  const resetFilters = () => {
    setProjectFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setPhaseFilter('all');
    setQuery('');
  };

  const exportCsv = () => {
    const lines = [
      ['WBS', 'Project', 'Task / Activity', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration Days', 'Progress', 'Planned Hours', 'Milestone'],
      ...filteredRows.map((row) => [
        row.wbs,
        row.projectName,
        row.title,
        row.phase || 'Execution',
        getStatusLabel(row.status),
        row.priority || 'medium',
        row.startValue,
        row.endValue,
        row.durationValue,
        `${row.progress ?? 0}%`,
        row.plannedHours,
        row.is_milestone ? 'Yes' : 'No',
      ]),
    ];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ms-project-style-schedule.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <AppHeader
        title="Master Schedule"
        subtitle="MS Project-style schedule grid with WBS, phases, dates, duration, progress, filters, links, and export."
      />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-5 text-white shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-300">MS Project Style Grid</p>
              <h1 className="mt-2 text-2xl font-black">Master Schedule Table View</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Manage schedule activities in one easy table: project, WBS, task/activity, phase, dates, duration, status, priority, progress, hours, and related links.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="gap-2" onClick={() => void loadData()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button type="button" variant="secondary" className="gap-2" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Activities', filteredRows.length],
            ['Completed', metrics.completed],
            ['Completion', `${metrics.completion}%`],
            ['Overdue', metrics.overdue],
            ['Planned Hours', metrics.plannedHours],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-card p-3 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px_160px_160px_160px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search WBS, project, task, or activity" className="pl-9" />
            </label>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All phases</option>
              {phaseOptions.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All priorities</option>
              {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            <Button type="button" variant="outline" className="gap-2" onClick={resetFilters}>
              <Filter className="h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        {message ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">{message}</div> : null}

        <div className="rounded-3xl border bg-card shadow-sm">
          <div className="max-h-[70vh] overflow-auto p-3">
            <table className="min-w-[1450px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {['WBS', 'Project', 'Task / Activity', 'Phase', 'Status', 'Priority', 'Start', 'Finish', 'Duration', 'Progress', 'Hours', 'Links'].map((header) => (
                    <th key={header} className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isOverdue = row.endValue && row.endValue.slice(0, 10) < today && normalize(row.status) !== 'done';
                  return (
                    <tr key={row.id} className={`odd:bg-muted/20 hover:bg-primary/5 ${isOverdue ? 'bg-red-500/5' : ''}`}>
                      <td className="border-b px-3 py-2 font-mono text-xs font-black text-muted-foreground">{row.wbs}</td>
                      <td className="max-w-[240px] border-b px-3 py-2 font-semibold">
                        <Link to={`/projects?projectId=${row.project_id}`} className="text-primary underline-offset-4 hover:underline">
                          {row.projectName}
                        </Link>
                      </td>
                      <td className="max-w-[320px] border-b px-3 py-2">
                        <div className="flex items-center gap-2">
                          {row.is_milestone ? <CalendarDays className="h-4 w-4 text-amber-500" /> : null}
                          <span className="font-semibold">{row.title}</span>
                        </div>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{row.phase || 'Execution'}</td>
                      <td className="border-b px-3 py-2"><Badge variant="outline" className={statusClass[normalize(row.status)] ?? 'border-border bg-muted text-muted-foreground'}>{getStatusLabel(row.status)}</Badge></td>
                      <td className="border-b px-3 py-2"><Badge variant="outline" className={priorityClass[normalize(row.priority)] ?? 'border-border bg-muted text-muted-foreground'}>{row.priority || 'medium'}</Badge></td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(row.startValue)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(row.endValue)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{row.durationValue}d</td>
                      <td className="border-b px-3 py-2">
                        <div className="flex min-w-[150px] items-center gap-2">
                          <Progress value={row.progress ?? 0} className="h-2" />
                          <span className="w-10 text-xs font-black text-muted-foreground">{row.progress ?? 0}%</span>
                        </div>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{row.plannedHours}h</td>
                      <td className="border-b px-3 py-2">
                        <div className="flex gap-2">
                          <Link to={`/tasks?projectId=${row.project_id}`} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-bold hover:bg-muted">
                            Task <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Link to={`/projects?projectId=${row.project_id}`} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-bold hover:bg-muted">
                            Project <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No schedule activities match the current filters.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ScheduleMSProject;
