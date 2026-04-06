import { TrendingUp, FolderKanban, CheckSquare, Users, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { dashboardStats, chartData, projects, tasks } from '@/lib/mock-data';

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

const StatCard = ({ icon: Icon, label, value, trend, color }: { icon: any; label: string; value: number; trend?: string; color: string }) => (
  <Card className="glass hover:shadow-lg transition-all duration-300 group">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-1 text-xs text-success font-medium">
              <TrendingUp className="h-3 w-3" /> {trend}
            </div>
          )}
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const upcomingTasks = tasks.filter(t => t.status !== 'done').slice(0, 5);

  return (
    <AppLayout>
      <AppHeader title="Dashboard" subtitle="Welcome back! Here's your project overview." />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FolderKanban} label="Active Projects" value={dashboardStats.activeProjects} trend="+2 this month" color="bg-primary/10 text-primary" />
          <StatCard icon={CheckSquare} label="Total Tasks" value={dashboardStats.totalTasks} color="bg-accent/10 text-accent" />
          <StatCard icon={Users} label="Team Members" value={dashboardStats.teamSize} color="bg-info/10 text-info" />
          <StatCard icon={AlertTriangle} label="Overdue Tasks" value={dashboardStats.overdueTasks} color="bg-destructive/10 text-destructive" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Weekly Progress</CardTitle>
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
              <CardTitle className="text-base font-semibold">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={chartData.tasksByStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {chartData.tasksByStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
            <div className="px-6 pb-4 flex flex-wrap gap-2">
              {chartData.tasksByStatus.map((s) => (
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Active Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.filter(p => p.status !== 'completed').map((project) => (
                <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${statusColor[project.status]}`}>{project.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Progress value={project.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground font-medium">{project.progress}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-1.5 h-8 rounded-full ${task.priority === 'urgent' ? 'bg-destructive' : task.priority === 'high' ? 'bg-warning' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{task.projectName}</span>
                      <span className="text-muted-foreground">·</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {task.dueDate}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${priorityColor[task.priority]}`}>{task.priority}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
