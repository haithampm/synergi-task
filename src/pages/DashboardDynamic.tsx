import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, FolderKanban, ListChecks, Search, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useDashboardStats, useProjects, useTasks, useWorkspaceSettings } from '@/hooks/useProjects';
import { useState } from 'react';

const getProjectDate = (project: Record<string, unknown>, key: 'start' | 'end') => {
  const snake = key === 'start' ? 'start_date' : 'end_date';
  const camel = key === 'start' ? 'startDate' : 'endDate';
  return String(project[snake] ?? project[camel] ?? '');
};

const formatDate = (value: string) => {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const statusBadgeClass: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  planning: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  'on-hold': 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  'at-risk': 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30 dark:text-zinc-300',
  archived: 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30 dark:text-zinc-300',
};

const DashboardDynamic = () => {
  const { data: settings } = useWorkspaceSettings();
  const { data: stats } = useDashboardStats();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusOptions = useMemo(
    () => Array.from(new Set(projects.map((project) => normalize((project as Record<string, unknown>).status)).filter(Boolean))).sort(),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const search = normalize(query);
    return projects.filter((project) => {
      const row = project as Record<string, unknown>;
      const matchesSearch = !search || normalize(row.name).includes(search);
      const matchesStatus = statusFilter === 'all' || normalize(row.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, query, statusFilter]);

  const projectRows = useMemo(
    () =>
      filteredProjects.map((project, index) => {
        const row = project as Record<string, unknown>;
        const projectId = String(row.id ?? '');
        const projectTasks = tasks.filter((task) => {
          const taskRow = task as Record<string, unknown>;
          return String(taskRow.project_id ?? taskRow.projectId ?? '') === projectId;
        });
        const doneTasks = projectTasks.filter((task) => normalize((task as Record<string, unknown>).status) === 'done').length;
        const taskCompletion = projectTasks.length ? Math.round((doneTasks / projectTasks.length) * 100) : Number(row.progress ?? 0);
        return {
          rank: index + 1,
          id: projectId,
          name: String(row.name ?? 'Untitled Project'),
          status: normalize(row.status) || 'active',
          risk: normalize(row.risk_level ?? row.riskLevel) || 'normal',
          progress: Math.max(0, Math.min(100, Number.isFinite(taskCompletion) ? taskCompletion : 0)),
          startDate: getProjectDate(row, 'start'),
          endDate: getProjectDate(row, 'end'),
          tasks: projectTasks.length,
          doneTasks,
        };
      }),
    [filteredProjects, tasks],
  );

  const activeProjects = projects.filter((project) => normalize((project as Record<string, unknown>).status) === 'active').length;
  const atRiskProjects = projects.filter((project) => {
    const row = project as Record<string, unknown>;
    return normalize(row.status) === 'at-risk' || normalize(row.risk_level ?? row.riskLevel) === 'high';
  }).length;

  return (
    <AppLayout>
      <AppHeader
        title="Advanced Dashboard"
        subtitle={`${settings?.namespace.organization ?? 'Workspace'} dynamic portfolio dashboard powered by the live project list.`}
      />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="glass">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Total Projects</p>
                <p className="mt-1 text-3xl font-black">{projects.length}</p>
              </div>
              <FolderKanban className="h-9 w-9 text-primary" />
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Active Projects</p>
                <p className="mt-1 text-3xl font-black">{activeProjects}</p>
              </div>
              <TrendingUp className="h-9 w-9 text-emerald-500" />
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Tasks</p>
                <p className="mt-1 text-3xl font-black">{stats?.totalTasks ?? tasks.length}</p>
              </div>
              <ListChecks className="h-9 w-9 text-sky-500" />
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Needs Attention</p>
                <p className="mt-1 text-3xl font-black">{atRiskProjects}</p>
              </div>
              <AlertTriangle className="h-9 w-9 text-amber-500" />
            </CardContent>
          </Card>
        </div>

        <Card className="glass overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">PMO Operations View</p>
                <CardTitle className="mt-1 text-xl font-black">Implementation Activities Matrix</CardTitle>
                <p className="mt-2 text-sm text-slate-300">
                  Dynamic matrix from live projects. Showing {projectRows.length}/{projects.length} projects. No hard-coded project cap.
                </p>
              </div>
              <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                Live list
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter projects by name" className="pl-9" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">All project statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status.replace('-', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="max-h-[68vh] overflow-auto rounded-2xl border">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">#</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Project</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Status</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Start</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">End</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tasks</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((project) => (
                    <tr key={project.id || project.name} className="odd:bg-muted/20">
                      <td className="border-b px-3 py-2 text-xs font-black text-muted-foreground">{project.rank}</td>
                      <td className="border-b px-3 py-2 font-semibold">
                        <Link to={`/projects?projectId=${project.id}`} className="text-primary underline-offset-4 hover:underline">
                          {project.name}
                        </Link>
                      </td>
                      <td className="border-b px-3 py-2">
                        <Badge variant="outline" className={statusBadgeClass[project.status] ?? 'bg-muted text-muted-foreground border-border'}>
                          {project.status.replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatDate(project.startDate)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(project.endDate)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{project.doneTasks}/{project.tasks}</td>
                      <td className="border-b px-3 py-2">
                        <div className="flex min-w-[160px] items-center gap-2">
                          <Progress value={project.progress} className="h-2" />
                          <span className="w-10 text-xs font-black text-muted-foreground">{project.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {projectRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5" /> No projects match the current filter.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardDynamic;
