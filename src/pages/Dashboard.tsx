import { TrendingUp, FolderKanban, CheckSquare, AlertTriangle, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useDashboardStats } from '@/hooks/useProjects';
import { projects as mockProjects, tasks as mockTasks, dashboardStats as mockStats, chartData } from '@/lib/mock-data';

const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-muted text-muted-foreground border-border',
  'at-risk': 'bg-destructive/10 text-destructive border-destructive/20',
};

const priorityColor: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-info/10 text-info',
  low: 'bg-muted text-muted-foreground',
};

const StatCard = ({ icon: Icon, label, value, trend, color, to }: { icon: any; label: string; value: number; trend?: string; color: string; to?: string }) => {
  const content = (
    <Card className="glass hover:shadow-lg transition-all duration-300 group cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-success font-medium">
                <TrendingUp className="h-3 w-3" /> {trend}
              </div>
            )}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const Dashboard = () => {
  const { data: stats } = useDashboardStats();

  const activeProjects = stats?.activeProjects ?? mockStats.activeProjects;
  const totalTasks = stats?.totalTasks ?? mockStats.totalTasks;
  const overdueTasks = stats?.overdueTasks ?? mockStats.overdueTasks;
  const openTickets = stats?.openTickets ?? 0;
  const projects = stats?.projects ?? mockProjects;
  const tasks = stats?.tasks ?? mockTasks;

  const upcomingTasks = (tasks as any[]).filter((t: any) => t.status !== 'done').slice(0, 5);

  const tasksByStatusData = stats?.tasksByStatus
    ? [
        { name: 'Backlog', value: stats.tasksByStatus.backlog, fill: 'hsl(var(--muted-foreground))' },
        { name: 'To Do', value: stats.tasksByStatus.todo, fill: 'hsl(var(--info))' },
        { name: 'In Progress', value: stats.tasksByStatus['in-progress'], fill: 'hsl(var(--primary))' },
        { name: 'Review', value: stats.tasksByStatus.review, fill: 'hsl(var(--warning))' },
        { name: 'Done', value: stats.tasksByStatus.done, fill: 'hsl(var(--success))' },
      ]
    : chartData.tasksByStatus;

  return (
    <AppLayout>
      <AppHeader title="Dashboard" subtitle="Welcome back! Here's your project overview." />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* AI Agent Banner */}
        <Card className="gradient-hero text-primary-foreground overflow-hidden relative">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium opacity-90">AI Agent</span>
              </div>
              <h3 className="text-lg font-bold">Your AI Project Manager is ready</h3>
              <p className="text-sm opacity-80 mt-1">It can create tasks, analyze risks, and manage your projects autonomously.</p>
            </div>
            <Link to="/ai-chat">
              <Button variant="secondary" size="sm" className="shrink-0">
                Open Agent <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FolderKanban} label="Active Projects" value={activeProjects} trend="+2 this month" color="bg-primary/10 text-primary" to="/projects" />
          <StatCard icon={CheckSquare} label="Total Tasks" value={totalTasks} color="bg-accent/10 text-accent" to="/tasks" />
          <StatCard icon={AlertTriangle} label="Overdue" value={overdueTasks} color="bg-destructive/10 text-destructive" to="/tasks" />
          <StatCard icon={Ticket} label="Open Tickets" value={openTickets} color="bg-warning/10 text-warning" to="/tickets" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Weekly Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData.weeklyProgress} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Completed" />
                  <Bar dataKey="created" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Created" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={tasksByStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {tasksByStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
            <div className="px-6 pb-4 flex flex-wrap gap-2">
              {tasksByStatusData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                  {s.name} ({s.value})
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Projects + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</CardTitle>
              <Link to="/projects" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {(projects as any[]).filter((p: any) => p.status !== 'completed' && p.status !== 'archived').slice(0, 4).map((project: any) => (
                <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${statusColor[project.status] || ''}`}>{project.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Progress value={project.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground font-medium">{project.progress}%</span>
                    </div>
                  </div>
                </div>
              ))}
              {(projects as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No projects yet. Create one to get started!</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Tasks</CardTitle>
              <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-1 h-8 rounded-full ${task.priority === 'urgent' ? 'bg-destructive' : task.priority === 'high' ? 'bg-warning' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {task.projectName || task.projects?.name || 'No project'} · Due {task.dueDate || task.due_date || 'TBD'}
                    </p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${priorityColor[task.priority] || ''}`}>{task.priority}</Badge>
                </div>
              ))}
              {upcomingTasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming tasks. You're all caught up!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
