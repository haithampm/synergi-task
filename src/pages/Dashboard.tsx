import { useMemo } from 'react';
import { ArrowRight, BarChart3, CheckSquare, FolderKanban, MessageSquare, Sparkles, Ticket, TrendingUp, Users, Workflow } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStats, useDashboards, useProjects, useTasks, useUpdateDashboard, useUserAccounts, useWorkspaceSettings } from '@/hooks/useProjects';
import { getProjectLifecycleActivityTotal, getProjectLifecycleStageCounts, lifecycleStageCatalog } from '@/lib/project-activities';
import { getProjectLinkedUserAccounts, resolveProjectLeader } from '@/lib/workspace-access';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-muted text-muted-foreground border-border',
  'at-risk': 'bg-destructive/10 text-destructive border-destructive/20',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const { data: settings } = useWorkspaceSettings();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: dashboards = [] } = useDashboards();
  const updateDashboard = useUpdateDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const isArabic = settings?.appearance.language === 'ar';

  const defaultDashboard = dashboards.find((dashboard) => dashboard.isDefault) ?? dashboards[0];
  const activeDashboardId = searchParams.get('dashboard');
  const selectedDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboardId) ?? defaultDashboard;
  const tasksByStatusData = useMemo(
    () => [
      { name: 'Backlog', value: stats?.tasksByStatus.backlog ?? 0, fill: 'hsl(var(--muted-foreground))' },
      { name: 'To Do', value: stats?.tasksByStatus.todo ?? 0, fill: 'hsl(var(--info))' },
      { name: 'In Progress', value: stats?.tasksByStatus['in-progress'] ?? 0, fill: 'hsl(var(--primary))' },
      { name: 'Review', value: stats?.tasksByStatus.review ?? 0, fill: 'hsl(var(--warning))' },
      { name: 'Done', value: stats?.tasksByStatus.done ?? 0, fill: 'hsl(var(--success))' },
    ],
    [stats],
  );

  const resourceData = useMemo(() => {
    const teamMembers = stats?.teamSize ?? 0;
    const capacity = stats?.totalCapacity ?? 0;
    const assignedHours = stats?.assignedHours ?? 0;
    return [
      { label: 'Capacity', value: capacity },
      { label: 'Assigned', value: assignedHours },
      { label: 'Available', value: Math.max(capacity - assignedHours, 0) },
      { label: 'People', value: teamMembers * 40 },
    ];
  }, [stats]);

  const workflowData = useMemo(
    () =>
      stats?.activeWorkflow?.stages.map((stage) => ({
        name: stage.name,
        value: tasks.filter((task) => (task.workflowStage ?? task.status) === stage.id).length,
        fill: stage.color.includes('slate') ? '#64748b' : stage.color.includes('sky') ? '#0ea5e9' : stage.color.includes('indigo') ? '#6366f1' : stage.color.includes('amber') ? '#f59e0b' : '#10b981',
      })) ?? [],
    [stats, tasks],
  );
  const portfolioProgressData = useMemo(
    () =>
      [...projects]
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 8)
        .map((project) => ({
          name: project.name.length > 18 ? `${project.name.slice(0, 18)}...` : project.name,
          progress: project.progress,
          risk: project.risk_level === 'high' ? 100 : project.risk_level === 'medium' ? 65 : 35,
        })),
    [projects],
  );
  const portfolioStatusData = useMemo(
    () =>
      (['active', 'on-hold', 'completed', 'at-risk'] as const).map((status) => ({
        name: status.replace('-', ' '),
        value: projects.filter((project) => project.status === status).length,
        fill: status === 'active' ? '#10b981' : status === 'on-hold' ? '#f59e0b' : status === 'completed' ? '#64748b' : '#f43f5e',
      })),
    [projects],
  );
  const lifecycleTotals = useMemo(
    () =>
      lifecycleStageCatalog.map((stage) => ({
        ...stage,
        total: projects.reduce((sum, project) => sum + getProjectLifecycleStageCounts(project, tasks)[stage.key], 0),
      })),
    [projects, tasks],
  );
  const displayedLifecycleStages = useMemo(
    () => (isArabic ? [...lifecycleStageCatalog].reverse() : lifecycleStageCatalog),
    [isArabic],
  );
  const lifecycleMatrix = useMemo(
    () =>
      projects.slice(0, 18).map((project, index) => {
        const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === project.id);
        const stageCounts = getProjectLifecycleStageCounts(project, tasks);
        const totalActivities = getProjectLifecycleActivityTotal(project, tasks);
        const completion = project.radarLifecycle?.completionPct ?? (totalActivities ? Math.round((projectTasks.filter((task) => task.status === 'done').length / totalActivities) * 100) : project.progress);
        const statusCounts = {
          backlog: projectTasks.filter((task) => task.status === 'backlog').length,
          todo: projectTasks.filter((task) => task.status === 'todo').length,
          'in-progress': projectTasks.filter((task) => task.status === 'in-progress').length,
          review: projectTasks.filter((task) => task.status === 'review').length,
          done: projectTasks.filter((task) => task.status === 'done').length,
        };
        const leader = resolveProjectLeader(project, stats?.teamMembers ?? [], userAccounts);
        const linkedUsers = getProjectLinkedUserAccounts(project, stats?.teamMembers ?? [], userAccounts);

        return {
          rank: index + 1,
          project,
          completion,
          totalActivities,
          statusCounts,
          leader,
          linkedUsers,
          stageCounts,
        };
      }),
    [projects, stats?.teamMembers, tasks, userAccounts],
  );
  const lifecycleSummary = useMemo(() => {
    const totalActivities = lifecycleTotals.reduce((sum, stage) => sum + stage.total, 0);
    const liveStages = lifecycleTotals.filter((stage) => stage.total > 0).length;
    const dominantStage = [...lifecycleTotals].sort((a, b) => b.total - a.total)[0];
    const highlyLoadedProjects = lifecycleMatrix.filter((row) => row.totalActivities >= 20).length;

    return {
      totalActivities,
      liveStages,
      dominantStage,
      highlyLoadedProjects,
    };
  }, [lifecycleMatrix, lifecycleTotals]);
  const lifecycleStatusTotals = useMemo(
    () =>
      lifecycleMatrix.reduce(
        (acc, row) => ({
          backlog: acc.backlog + row.statusCounts.backlog,
          todo: acc.todo + row.statusCounts.todo,
          'in-progress': acc['in-progress'] + row.statusCounts['in-progress'],
          review: acc.review + row.statusCounts.review,
          done: acc.done + row.statusCounts.done,
        }),
        { backlog: 0, todo: 0, 'in-progress': 0, review: 0, done: 0 },
      ),
    [lifecycleMatrix],
  );

  const atRiskProjects = projects.filter((project) => project.status === 'at-risk' || project.risk_level === 'high');

  const toggleWidget = async (widgetId: string) => {
    if (!selectedDashboard) return;
    await updateDashboard.mutateAsync({
      id: selectedDashboard.id,
      widgets: selectedDashboard.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, enabled: !widget.enabled } : widget,
      ),
    });
    toast.success('Dashboard layout updated');
  };

  const selectDashboard = (dashboardId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!dashboardId || dashboardId === defaultDashboard?.id) next.delete('dashboard');
      else next.set('dashboard', dashboardId);
      return next;
    }, { replace: true });
  };
  const openLifecycleActivities = (projectId: string, stageKey?: string) => {
    const project = projects.find((item) => item.id === projectId);
    const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === projectId);
    if (!projectTasks.length && project?.radarLifecycle) {
      toast.info('This project currently has imported radar counts only. Open the project to add detailed tasks.');
      navigate(`/projects?projectId=${projectId}`);
      return;
    }
    const next = stageKey ? `/tasks?projectId=${projectId}&stage=${stageKey}` : `/tasks?projectId=${projectId}`;
    navigate(next);
  };
  const openStatusActivities = (projectId: string, statusKey: string) => {
    const project = projects.find((item) => item.id === projectId);
    const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === projectId);
    if (!projectTasks.length && project?.radarLifecycle) {
      toast.info('This project currently has imported radar counts only. Open the project to add detailed tasks.');
      navigate(`/projects?projectId=${projectId}`);
      return;
    }
    navigate(`/tasks?projectId=${projectId}&status=${statusKey}`);
  };
  return (
    <AppLayout>
      <AppHeader
        title="Advanced Dashboard"
        subtitle={`${settings?.namespace.organization ?? 'Workspace'} portfolio command center and workflow intelligence.`}
      />
      <div className="p-6 space-y-6 animate-fade-in">
        <Card className="gradient-hero text-primary-foreground overflow-hidden relative">
          <CardContent className="p-6 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium opacity-90">{settings?.namespace.slug}</span>
              </div>
              <h3 className="text-2xl font-bold">Portfolio control room is live</h3>
              <p className="text-sm opacity-80 mt-2 max-w-2xl">
                Track resource utilization, workflow SLA, dynamic reports, team collaboration, and AI schedule guidance from one professional workspace.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to="/ai-chat">
                <Button variant="secondary" size="sm">
                  Open AI Copilot <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
              <Link to="/schedule">
                <Button variant="secondary" size="sm">
                  Open Master Schedule
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="focus">My Focus</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
        <PageSection
          title="Portfolio Overview"
          description="High-level delivery metrics, health signals, and executive summary cards for the active workspace."
          actions={selectedDashboard ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedDashboard.id} onValueChange={selectDashboard}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={dashboard.id}>{dashboard.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedDashboard.isDefault ? (
                <Button size="sm" variant="outline" onClick={() => void updateDashboard.mutateAsync({ id: selectedDashboard.id, isDefault: true })}>
                  Set Default
                </Button>
              ) : null}
            </div>
          ) : null}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { icon: FolderKanban, label: 'Active Projects', value: stats?.activeProjects ?? 0, meta: `${projects.length} total`, color: 'bg-primary/10 text-primary' },
            { icon: CheckSquare, label: 'Tasks', value: stats?.totalTasks ?? 0, meta: `${stats?.completedTasks ?? 0} completed`, color: 'bg-accent/10 text-accent' },
            { icon: Users, label: 'Utilization', value: `${stats?.utilizationPct ?? 0}%`, meta: `${stats?.assignedHours ?? 0}/${stats?.totalCapacity ?? 0}h`, color: 'bg-info/10 text-info' },
            { icon: Ticket, label: 'Open Tickets', value: stats?.openTickets ?? 0, meta: `${stats?.tickets?.length ?? 0} total`, color: 'bg-warning/10 text-warning' },
            { icon: Workflow, label: 'Workflow SLA', value: `${workflowData.reduce((sum, stage) => sum + stage.value, 0)}`, meta: stats?.activeWorkflow?.name ?? 'No workflow', color: 'bg-success/10 text-success' },
          ].map((item) => (
            <Card key={item.label} className="glass">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                    <p className="text-3xl font-bold mt-1 tracking-tight">{item.value}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground font-medium">
                      <TrendingUp className="h-3 w-3" /> {item.meta}
                    </div>
                  </div>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Progress Graph</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={portfolioProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} interval={0} angle={-15} textAnchor="end" height={56} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                  <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Progress" />
                  <Bar dataKey="risk" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="Risk Signal" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Status Mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={portfolioStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={86} paddingAngle={3} dataKey="value">
                    {portfolioStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-2 sm:grid-cols-2">
                {portfolioStatusData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="capitalize">{entry.name}</span>
                    </div>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="glass overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 pb-4 text-slate-50">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">PMO Operations View</p>
                <CardTitle className="text-lg font-semibold tracking-tight text-white">Implementation Activities Matrix</CardTitle>
                <p className="max-w-3xl text-sm text-slate-300">
                  Executive matrix for implementation life cycle workload, project ownership, and activity status. Each stage cell and status chip opens the related activities directly.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Total Activities</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{lifecycleSummary.totalActivities}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Active Stages</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{lifecycleSummary.liveStages}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Dominant Stage</p>
                  <p className="mt-1 text-sm font-semibold text-white">{lifecycleSummary.dominantStage?.label ?? 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Large Workstreams</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{lifecycleSummary.highlyLoadedProjects}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div>
              <div className={cn('mb-3 flex items-center justify-between gap-3', isArabic && 'flex-row-reverse')}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Implementation Life Cycle</p>
                <Badge variant="outline" className="bg-muted/40 text-[11px] font-semibold">
                  Click any stage to open related activities
                </Badge>
              </div>
              <div
                dir={isArabic ? 'rtl' : 'ltr'}
                className={cn('grid gap-3 md:grid-cols-5 xl:grid-cols-10', isArabic && 'text-right')}
              >
                {displayedLifecycleStages.map((stage) => (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => navigate(`/tasks?stage=${stage.key}`)}
                    className={cn(
                      'group rounded-[1.35rem] border bg-gradient-to-b from-background to-muted/20 px-3 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                      stage.border,
                      stage.text,
                      isArabic && 'text-right',
                    )}
                  >
                    <span className="block">{stage.label}</span>
                    <span className="mt-2 block text-lg font-bold">{lifecycleTotals.find((item) => item.key === stage.key)?.total ?? 0}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">activities</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 xl:hidden">
              {lifecycleMatrix.map((row) => (
                <div key={`mobile-${row.project.id}`} className="rounded-[1.5rem] border bg-gradient-to-b from-background to-muted/20 p-4 shadow-sm">
                  <div className={cn("flex items-start justify-between gap-3", isArabic && "flex-row-reverse text-right")}>
                    <div className="space-y-1">
                      <Link
                        to={`/projects?projectId=${row.project.id}`}
                        className="text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={`Open ${row.project.name} project workspace`}
                      >
                        {row.project.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.leader.name}
                        {row.linkedUsers.length ? ` · ${row.linkedUsers.length} linked user${row.linkedUsers.length === 1 ? '' : 's'}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-muted/40 text-[11px] font-semibold">
                      #{row.rank}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className={cn("flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground", isArabic && "flex-row-reverse")}>
                      <span>{isArabic ? "نسبة الإنجاز" : "Completion"}</span>
                      <span>{row.completion}%</span>
                    </div>
                    <Progress value={row.completion} className="h-2" />
                  </div>

                  <div className={cn("mt-4 flex flex-wrap gap-1.5", isArabic && "justify-end")}>
                    {[
                      { key: 'backlog', value: row.statusCounts.backlog, className: 'bg-slate-200 text-slate-700' },
                      { key: 'todo', value: row.statusCounts.todo, className: 'bg-sky-100 text-sky-700' },
                      { key: 'in-progress', value: row.statusCounts['in-progress'], className: 'bg-indigo-100 text-indigo-700' },
                      { key: 'review', value: row.statusCounts.review, className: 'bg-amber-100 text-amber-700' },
                      { key: 'done', value: row.statusCounts.done, className: 'bg-emerald-100 text-emerald-700' },
                    ].map((status) => (
                      <button
                        key={`mobile-${row.project.id}-${status.key}`}
                        type="button"
                        onClick={() => openStatusActivities(row.project.id, status.key)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-85 ${status.className}`}
                      >
                        {status.key}: {status.value}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {displayedLifecycleStages.map((stage) => (
                      <button
                        key={`mobile-stage-${row.project.id}-${stage.key}`}
                        type="button"
                        onClick={() => openLifecycleActivities(row.project.id, stage.key)}
                        className={cn(
                          "rounded-2xl border px-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                          row.stageCounts[stage.key] > 0 ? `${stage.color} border-transparent text-white` : "border-border bg-background/70 text-foreground",
                          isArabic && "text-right",
                        )}
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] opacity-80">{stage.label}</span>
                        <span className="mt-2 block text-xl font-bold">{row.stageCounts[stage.key]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div
              dir={isArabic ? 'rtl' : 'ltr'}
              className="hidden overflow-x-auto rounded-[1.5rem] border bg-gradient-to-b from-background to-muted/10 shadow-inner xl:block"
            >
              <table className={cn('min-w-[1320px] w-full text-sm', isArabic && 'text-right')}>
                <thead className={cn('bg-slate-900 text-xs uppercase tracking-[0.16em] text-slate-200', isArabic && 'text-right')}>
                  <tr>
                    {isArabic ? (
                      <>
                        <th className="px-4 py-4">#</th>
                        <th className="px-4 py-4">Project</th>
                        <th className="px-4 py-4">Lead</th>
                        <th className="px-4 py-4">Activity Status</th>
                        {displayedLifecycleStages.map((stage) => (
                          <th key={stage.key} className="px-3 py-4">{stage.label}</th>
                        ))}
                        <th className="px-4 py-4">% Done</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-4">% Done</th>
                        {displayedLifecycleStages.map((stage) => (
                          <th key={stage.key} className="px-3 py-4">{stage.label}</th>
                        ))}
                        <th className="px-4 py-4">Activity Status</th>
                        <th className="px-4 py-4">Lead</th>
                        <th className="px-4 py-4">Project</th>
                        <th className="px-4 py-4">#</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lifecycleMatrix.map((row, rowIndex) => (
                    <tr key={row.project.id} className={cn('border-t transition-colors hover:bg-muted/20', rowIndex % 2 === 0 && 'bg-background/70')}>
                      {isArabic ? (
                        <>
                          <td className="px-4 py-4 font-semibold text-muted-foreground">{row.rank}</td>
                          <td className="px-4 py-4">
                            <Link
                              to={`/projects?projectId=${row.project.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              aria-label={`Open ${row.project.name} project workspace`}
                            >
                              {row.project.name}
                            </Link>
                          </td>
                          <td className="px-4 py-4 font-medium">
                            <div className="space-y-1">
                              <p>{row.leader.name}</p>
                              <p className="text-xs text-muted-foreground">{row.leader.roleLabel}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {[
                                { key: 'backlog', value: row.statusCounts.backlog, className: 'bg-slate-200 text-slate-700' },
                                { key: 'todo', value: row.statusCounts.todo, className: 'bg-sky-100 text-sky-700' },
                                { key: 'in-progress', value: row.statusCounts['in-progress'], className: 'bg-indigo-100 text-indigo-700' },
                                { key: 'review', value: row.statusCounts.review, className: 'bg-amber-100 text-amber-700' },
                                { key: 'done', value: row.statusCounts.done, className: 'bg-emerald-100 text-emerald-700' },
                              ].map((status) => (
                                <button
                                  key={`${row.project.id}-${status.key}`}
                                  type="button"
                                  onClick={() => openStatusActivities(row.project.id, status.key)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-85 ${status.className}`}
                                >
                                  {status.key}: {status.value}
                                </button>
                              ))}
                            </div>
                          </td>
                          {displayedLifecycleStages.map((stage) => (
                            <td key={`${row.project.id}-${stage.key}`} className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => openLifecycleActivities(row.project.id, stage.key)}
                                className={`min-w-[52px] rounded-xl px-3 py-2 text-center font-semibold shadow-sm transition-colors hover:opacity-85 ${row.stageCounts[stage.key] > 0 ? `${stage.color} text-white` : 'bg-muted/30 text-muted-foreground'}`}
                              >
                                {row.stageCounts[stage.key]}
                              </button>
                            </td>
                          ))}
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-end gap-2 text-xs font-semibold text-muted-foreground">
                                <span>{row.completion}%</span>
                                <span>Done</span>
                              </div>
                              <Progress value={row.completion} className="h-2" />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                                <span>Done</span>
                                <span>{row.completion}%</span>
                              </div>
                              <Progress value={row.completion} className="h-2" />
                            </div>
                          </td>
                          {displayedLifecycleStages.map((stage) => (
                            <td key={`${row.project.id}-${stage.key}`} className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => openLifecycleActivities(row.project.id, stage.key)}
                                className={`min-w-[52px] rounded-xl px-3 py-2 text-center font-semibold shadow-sm transition-colors hover:opacity-85 ${row.stageCounts[stage.key] > 0 ? `${stage.color} text-white` : 'bg-muted/30 text-muted-foreground'}`}
                              >
                                {row.stageCounts[stage.key]}
                              </button>
                            </td>
                          ))}
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { key: 'backlog', value: row.statusCounts.backlog, className: 'bg-slate-200 text-slate-700' },
                                { key: 'todo', value: row.statusCounts.todo, className: 'bg-sky-100 text-sky-700' },
                                { key: 'in-progress', value: row.statusCounts['in-progress'], className: 'bg-indigo-100 text-indigo-700' },
                                { key: 'review', value: row.statusCounts.review, className: 'bg-amber-100 text-amber-700' },
                                { key: 'done', value: row.statusCounts.done, className: 'bg-emerald-100 text-emerald-700' },
                              ].map((status) => (
                                <button
                                  key={`${row.project.id}-${status.key}`}
                                  type="button"
                                  onClick={() => openStatusActivities(row.project.id, status.key)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-85 ${status.className}`}
                                >
                                  {status.key}: {status.value}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-medium">
                            <div className="space-y-1">
                              <p>{row.leader.name}</p>
                              <p className="text-xs text-muted-foreground">{row.leader.roleLabel}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              to={`/projects?projectId=${row.project.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              aria-label={`Open ${row.project.name} project workspace`}
                            >
                              {row.project.name}
                            </Link>
                          </td>
                          <td className="px-4 py-4 font-semibold text-muted-foreground">{row.rank}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t bg-slate-950/95 font-semibold text-slate-50">
                    {isArabic ? (
                      <>
                        <td className="px-4 py-4">{lifecycleMatrix.length}</td>
                        <td className="px-4 py-4" colSpan={2}>Portfolio Rollup</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">backlog: {lifecycleStatusTotals.backlog}</span>
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">todo: {lifecycleStatusTotals.todo}</span>
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">in-progress: {lifecycleStatusTotals['in-progress']}</span>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">review: {lifecycleStatusTotals.review}</span>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">done: {lifecycleStatusTotals.done}</span>
                          </div>
                        </td>
                        {displayedLifecycleStages.map((stage) => (
                          <td key={`total-${stage.key}`} className="px-3 py-4">{lifecycleTotals.find((item) => item.key === stage.key)?.total ?? 0}</td>
                        ))}
                        <td className="px-4 py-4">100%</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4">100%</td>
                        {displayedLifecycleStages.map((stage) => (
                          <td key={`total-${stage.key}`} className="px-3 py-4">{lifecycleTotals.find((item) => item.key === stage.key)?.total ?? 0}</td>
                        ))}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">backlog: {lifecycleStatusTotals.backlog}</span>
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">todo: {lifecycleStatusTotals.todo}</span>
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">in-progress: {lifecycleStatusTotals['in-progress']}</span>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">review: {lifecycleStatusTotals.review}</span>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">done: {lifecycleStatusTotals.done}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4" colSpan={2}>Portfolio Rollup</td>
                        <td className="px-4 py-4">{lifecycleMatrix.length}</td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selectedDashboard && (
          <div className="space-y-3">
            <PageSection
              title="Workspace Layout"
              description={`Choose which widgets stay visible for "${selectedDashboard.name}".`}
            />
            <Card className="glass" id="sticky-notes-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Custom Dashboard Widgets
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {selectedDashboard.widgets.map((widget) => (
                <Button
                  key={widget.id}
                  variant={widget.enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleWidget(widget.id)}
                >
                  {widget.title}
                </Button>
              ))}
            </CardContent>
            </Card>
          </div>
        )}

          </TabsContent>
          <TabsContent value="analytics" className="space-y-6">

        <PageSection
          title="Portfolio Analytics"
          description="Charts and visual signals for portfolio health, workflow performance, and resourcing."
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {selectedDashboard?.widgets.find((widget) => widget.key === 'portfolioHealth' && widget.enabled) && (
            <Card className="glass xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={projects.map((project) => ({ name: project.name.slice(0, 14), progress: project.progress, risk: project.risk_level === 'high' ? 100 : project.risk_level === 'medium' ? 65 : 35 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                    <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Progress" />
                    <Bar dataKey="risk" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="Risk Signal" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {selectedDashboard?.widgets.find((widget) => widget.key === 'workflowSla' && widget.enabled) && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow SLA</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={workflowData} cx="50%" cy="50%" innerRadius={50} outerRadius={86} paddingAngle={3} dataKey="value">
                      {workflowData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

          </TabsContent>
          <TabsContent value="focus" className="space-y-6">
        <PageSection
          title="Personal Focus"
          description="Resource utilization and portfolio risk watchlist in one focused dashboard view."
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {selectedDashboard?.widgets.find((widget) => widget.key === 'resourceUtilization' && widget.enabled) && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resource Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={resourceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground mt-3">
                  Assigned effort is tracked dynamically from task workload hours and team capacity.
                </p>
              </CardContent>
            </Card>
          )}

          {selectedDashboard?.widgets.find((widget) => widget.key === 'riskRadar' && widget.enabled) ? (
          <Card className="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dynamic Risk Radar</CardTitle>
              <Link to="/reports" className="text-xs text-primary hover:underline">Report</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {atRiskProjects.map((project) => (
                <div key={project.id} className="rounded-xl border p-3 bg-card/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.department} - Budget ${project.budget}</p>
                    </div>
                    <Badge variant="outline" className={statusColor[project.status]}>{project.status}</Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                  </div>
                </div>
              ))}
              {atRiskProjects.length === 0 && <p className="text-sm text-muted-foreground">No high-risk projects are currently flagged.</p>}
            </CardContent>
          </Card>
          ) : null}
        </div>

          </TabsContent>
          <TabsContent value="controls" className="space-y-6">
        <PageSection
          title="Workspace Controls"
          description="Operational shortcuts, workflow visibility, and governance cards for the active workspace."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow Design</CardTitle>
              <Link to="/settings" className="text-xs text-primary hover:underline">Manage</Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 bg-card/40">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  <p className="font-medium">{stats?.activeWorkflow?.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{stats?.activeWorkflow?.description}</p>
              </div>
              <div className="space-y-2">
                {stats?.activeWorkflow?.stages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px]">{stage.slaHours}h SLA</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Task Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={tasksByStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={86} paddingAngle={3} dataKey="value">
                    {tasksByStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Professional Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: BarChart3, label: 'Dynamic reports', detail: 'Report templates can be regenerated from live project and resource data.' },
                { icon: MessageSquare, label: 'Team chat', detail: 'Channels support coordination between PMO, engineering, and support.' },
                { icon: Workflow, label: 'Workflow engine', detail: 'Stages, SLA targets, and automation rules are managed from settings.' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-3 bg-card/40">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{item.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
