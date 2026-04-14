import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { toast } from 'sonner';

const monthlyData = [
  { month: 'Jan', tasks: 45, completed: 38 },
  { month: 'Feb', tasks: 52, completed: 44 },
  { month: 'Mar', tasks: 61, completed: 55 },
  { month: 'Apr', tasks: 38, completed: 22 },
];

const velocityData = [
  { sprint: 'S1', points: 21 },
  { sprint: 'S2', points: 28 },
  { sprint: 'S3', points: 25 },
  { sprint: 'S4', points: 34 },
  { sprint: 'S5', points: 31 },
  { sprint: 'S6', points: 38 },
];

const burndownData = [
  { day: 'Day 1', ideal: 100, actual: 100 },
  { day: 'Day 3', ideal: 80, actual: 85 },
  { day: 'Day 5', ideal: 60, actual: 70 },
  { day: 'Day 7', ideal: 40, actual: 55 },
  { day: 'Day 9', ideal: 20, actual: 30 },
  { day: 'Day 10', ideal: 0, actual: 15 },
];

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' };

const Reports = () => {
  const exportCSV = () => {
    const csv = `Month,Tasks Created,Tasks Completed\n${monthlyData.map(d => `${d.month},${d.tasks},${d.completed}`).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    toast.success('CSV report exported!');
  };

  const exportPDF = () => {
    toast.info('PDF export feature coming soon!');
  };

  return (
    <AppLayout>
      <AppHeader title="Reports" subtitle="AI-generated insights and analytics." />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Export Buttons */}
        <div className="flex gap-2 justify-end">
          <Button onClick={exportCSV} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />Export CSV
          </Button>
          <Button onClick={exportPDF} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />Export PDF
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'On-time Delivery', value: '87%', sub: '+3% vs last month', color: 'text-success' },
            { label: 'Sprint Velocity', value: '34 pts', sub: 'Avg last 3 sprints', color: 'text-primary' },
            { label: 'Team Utilization', value: '76%', sub: 'Across all projects', color: 'text-info' },
            { label: 'Overdue Rate', value: '8%', sub: '-2% vs last month', color: 'text-warning' },
          ].map((kpi) => (
            <Card key={kpi.label} className="glass">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader><CardTitle className="text-base">Monthly Task Completion</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Created" />
                  <Bar dataKey="completed" fill="hsl(var(--success))" radius={[4,4,0,0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader><CardTitle className="text-base">Sprint Velocity</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sprint" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="points" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Sprint Burndown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={burndownData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" name="Ideal" />
                  <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
