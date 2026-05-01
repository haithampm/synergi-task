import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileText, FolderKanban, ListChecks, Search, Ticket, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useDashboardStats, useProjects, useTasks, useTickets, useWorkspaceSettings } from '@/hooks/useProjects';

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
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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
  const { data: tickets = [] } = useTickets();
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
  const openTickets = tickets.filter((ticket) => !['closed', 'resolved', 'done'].includes(normalize((ticket as Record<string, unknown>).status))).length;

  const exportVisibleMatrix = () => {
    const rows = [
      ['Rank', 'Project Name', 'Status', 'Start Date', 'End Date', 'Done Tasks', 'Total Tasks', 'Progress'],
      ...projectRows.map((project) => [
        project.rank,
        project.name,
        project.status,
        project.startDate,
        project.endDate,
        project.doneTasks,
        project.tasks,
        `${project.progress}%`,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'synergi-powerbi-portfolio-matrix.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    {
      label: 'Projects Portfolio',
      value: projects.length,
      hint: 'Open project register',
      to: '/projects',
      icon: FolderKanban,
      tone: 'from-blue-600 to-cyan-500',
    },
    {
      label: 'Active Projects',
      value: activeProjects,
      hint: 'Review active delivery',
      to: '/projects?status=active',
      icon: TrendingUp,
      tone: 'from-emerald-600 to-teal-500',
    },
    {
      label: 'Tasks & Activities',
      value: stats?.totalTasks ?? tasks.length,
      hint: 'Open tasks board',
      to: '/tasks',
      icon: ListChecks,
      tone: 'from-indigo-600 to-violet-500',
    },
    {
      label: 'Open Points / Tickets',
      value: openTickets,
      hint: 'Review open points',
      to: '/tickets',
      icon: Ticket,
      tone: 'from-amber-600 to-orange-500',
    },
    {
      label: 'Needs Management Attention',
      value: atRiskProjects,
      hint: 'At-risk projects',
      to: '/projects?status=at-risk',
      icon: AlertTriangle,
      tone: 'from-red-600 to-rose-500',
    },
  ];

  return (
    <AppLayout>
      <AppHeader
        title="PMO BI Dashboard"
        subtitle={`${settings?.namespace.organization ?? 'Workspace'} PowerBI-style portfolio dashboard with live linked projects, tasks, tickets, and reports.`}
      />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">Executive Portfolio Intelligence</p>
              <h1 className="mt-2 text-2xl font-black">Projects, tasks, open points, and reports are linked to live forms</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Click any KPI count or project name to open the related project, task, ticket, or report view. Export the visible matrix for PowerBI/Excel analysis.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="gap-2" onClick={exportVisibleMatrix}>
                <Download className="h-4 w-4" /> Export BI CSV
              </Button>
              <Button asChild type="button" variant="outline" className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link to="/reports"><FileText className="h-4 w-4" /> Reports</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="group block rounded-[1.6rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <Card className="overflow-hidden border-0 shadow-xl transition-all group-hover:-translate-y-1 group-hover:shadow-2xl">
                  <CardContent className={`bg-gradient-to-br ${item.tone} p-5 text-white`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">{item.label}</p>
                        <p className="mt-3 text-4xl font-black tracking-tight">{item.value}</p>
                        <p className="mt-2 text-xs font-semibold text-white/85">{item.hint}</p>
                      </div>
                      <div className="rounded-2xl bg-white/15 p-3 shadow-inner">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card className="glass overflow-hidden border-0 shadow-2xl">
          <CardHeader className="border-b bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">PMO BI Matrix</p>
                <CardTitle className="mt-1 text-xl font-black">Implementation Activities Matrix</CardTitle>
                <p className="mt-2 text-sm text-slate-300">
                  Showing {projectRows.length}/{projects.length} live projects. Counts and names are clickable through related project and task views.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/20 bg-white/10 text-white">Live list</Badge>
                <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={exportVisibleMatrix}>
                  <Download className="h-4 w-4" /> Export Visible
                </Button>
              </div>
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
                    <tr key={project.id || project.name} className="odd:bg-muted/20 hover:bg-primary/5">
                      <td className="border-b px-3 py-2 text-xs font-black text-muted-foreground">{project.rank}</td>
                      <td className="border-b px-3 py-2 font-semibold">
                        <Link to={`/projects?projectId=${project.id}`} className="text-primary underline-offset-4 hover:underline">
                          {project.name}
                        </Link>
                      </td>
                      <td className="border-b px-3 py-2">
                        <Link to={`/projects?status=${project.status}`}>
                          <Badge variant="outline" className={statusBadgeClass[project.status] ?? 'bg-muted text-muted-foreground border-border'}>
                            {project.status.replace('-', ' ')}
                          </Badge>
                        </Link>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatDate(project.startDate)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(project.endDate)}</td>
                      <td className="border-b px-3 py-2">
                        <Link to={`/tasks?projectId=${project.id}`} className="font-black text-primary underline-offset-4 hover:underline">
                          {project.doneTasks}/{project.tasks}
                        </Link>
                      </td>
                      <td className="border-b px-3 py-2">
                        <div className="flex min-w-[160px] items-center gap-2">
                          <Progress value={project.progress} className="h-2" />
                          <Link to={`/projects?projectId=${project.id}`} className="w-10 text-xs font-black text-primary underline-offset-4 hover:underline">{project.progress}%</Link>
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
