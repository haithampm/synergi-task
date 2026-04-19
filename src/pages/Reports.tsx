import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet, FileText } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useProjects, useReportTemplates, useTasks, useTeamMembers, useTickets, useWorkspaceSettings } from '@/hooks/useProjects';
import { toast } from 'sonner';

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' };

const Reports = () => {
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: tickets = [] } = useTickets();
  const { data: templates = [] } = useReportTemplates();
  const { data: settings } = useWorkspaceSettings();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('report-exec');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [reportCadence, setReportCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedProject = selectedProjectId === 'all' ? null : projects.find((project) => project.id === selectedProjectId);
  const filteredTasks = selectedProject ? tasks.filter((task) => task.project_id === selectedProject.id) : tasks;
  const filteredTickets = selectedProject ? tickets.filter((ticket) => ticket.projectId === selectedProject.id) : tickets;

  const reportRows = useMemo(() => {
    if (!selectedTemplate) return [];

    if (selectedTemplate.focus === 'resource') {
      return teamMembers.map((member) => {
        const aliases = [member.name, member.name.split(' ')[0]];
        const assignedTasks = filteredTasks.filter((task) => aliases.includes(task.assignee));
        const assignedHours = assignedTasks.reduce((sum, task) => sum + (task.workloadHours ?? 0), 0);
        const capacity = member.capacityHours ?? 40;
        return {
          member: member.name,
          capacity,
          assignedHours,
          utilization: `${Math.round((assignedHours / Math.max(1, capacity)) * 100)}%`,
          target: `${member.utilizationTarget ?? 85}%`,
        };
      });
    }

    if (selectedTemplate.focus === 'risk') {
      return (selectedProject ? [selectedProject] : projects).map((project) => {
        const projectTasks = tasks.filter((task) => task.project_id === project.id);
        const overdueTasks = projectTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done').length;
        const openTickets = tickets.filter((ticket) => ticket.projectId === project.id && ticket.status !== 'closed').length;
        return {
          project: project.name,
          risk: project.risk_level ?? 'medium',
          overdueTasks,
          openTickets,
        };
      });
    }

    if (selectedTemplate.focus === 'schedule') {
      return (selectedProject ? [selectedProject] : projects).map((project) => {
        const projectTasks = tasks.filter((task) => task.project_id === project.id);
        const dependencies = projectTasks.reduce((sum, task) => sum + (task.predecessors?.length ?? 0), 0);
        const duration = projectTasks.reduce((sum, task) => sum + (task.workloadHours ?? 0), 0) / 8;
        return {
          project: project.name,
          start: project.start_date ?? project.startDate,
          end: project.end_date ?? project.endDate,
          duration: `${duration || 0}d`,
          dependencies,
        };
      });
    }

    return (selectedProject ? [selectedProject] : projects).map((project) => ({
      project: project.name,
      status: project.status,
      progress: `${project.progress}%`,
      budget: `$${project.budget ?? '0'}`,
      risk: project.risk_level ?? 'medium',
    }));
  }, [filteredTasks, projects, selectedProject, selectedTemplate, tasks, teamMembers, tickets]);

  const chartData = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.focus === 'resource') {
      return reportRows.map((row) => ({
        name: row.member,
        value: Number.parseInt(String(row.utilization).replace('%', ''), 10) || 0,
      }));
    }
    if (selectedTemplate.focus === 'risk') {
      return reportRows.map((row) => ({
        name: row.project,
        overdue: row.overdueTasks,
        tickets: row.openTickets,
      }));
    }
    if (selectedTemplate.focus === 'schedule') {
      return reportRows.map((row) => ({
        name: row.project,
        duration: Number.parseInt(String(row.duration).replace('d', ''), 10) || 0,
        dependencies: row.dependencies,
      }));
    }
    return reportRows.map((row) => ({
      name: row.project,
      progress: Number.parseInt(String(row.progress).replace('%', ''), 10) || 0,
    }));
  }, [reportRows, selectedTemplate]);

  const exportSelected = () => {
    if (!selectedTemplate) return;
    const header = selectedTemplate.columns.join(',');
    const rows = reportRows.map((row) => selectedTemplate.columns.map((column) => `"${row[column as keyof typeof row] ?? ''}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedTemplate.name} exported`);
  };

  const projectStatusReport = useMemo(() => {
    if (!selectedProject) return null;
    const projectTasks = tasks.filter((task) => task.project_id === selectedProject.id);
    const completedTasks = projectTasks.filter((task) => task.status === 'done').length;
    const openTickets = tickets.filter((ticket) => ticket.projectId === selectedProject.id && ticket.status !== 'closed').length;
    const totalTimesheetHours = projectTasks.reduce(
      (sum, task) => sum + (task.timesheetEntries ?? []).reduce((hours, entry) => hours + (entry.hours ?? 0), 0),
      0,
    );
    const risks = selectedProject.risks ?? [];
    const stakeholders = selectedProject.stakeholders ?? [];
    return {
      title: `${reportCadence[0].toUpperCase()}${reportCadence.slice(1)} Status Report`,
      cadence: reportCadence,
      lines: [
        `Project: ${selectedProject.name}`,
        `Cadence: ${reportCadence}`,
        `Status: ${selectedProject.status}`,
        `Progress: ${selectedProject.progress}%`,
        `Tasks completed: ${completedTasks}/${projectTasks.length}`,
        `Open tickets: ${openTickets}`,
        `Timesheet hours logged: ${totalTimesheetHours}h`,
        `Open risks: ${risks.filter((risk) => risk.status !== 'closed').length}`,
        `Stakeholders tracked: ${stakeholders.length}`,
        `Reporting note: ${selectedProject.projectNature || selectedProject.description || 'Project context not defined.'}`,
      ],
    };
  }, [reportCadence, selectedProject, tasks, tickets]);

  const exportStatusReport = () => {
    if (!projectStatusReport || !selectedProject) return;
    const content = projectStatusReport.lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedProject.name.toLowerCase().replace(/\s+/g, '-')}-${reportCadence}-status-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${projectStatusReport.title} exported`);
  };

  return (
    <AppLayout>
      <AppHeader title="Dynamic Reports" subtitle={`${settings?.namespace.organization ?? 'Workspace'} reporting, executive views, resource analytics, and schedule controls.`} />
      <div className="p-6 space-y-6 animate-fade-in">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Project Status Report Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reportCadence} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setReportCadence(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Cadence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportStatusReport} disabled={!selectedProject}>
                <FileText className="h-4 w-4 mr-2" />Export Status Report
              </Button>
            </div>
            {projectStatusReport ? (
              <div className="rounded-2xl border border-border bg-muted/10 p-4">
                <p className="font-medium">{projectStatusReport.title}</p>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {projectStatusReport.lines.map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a project to generate a daily, weekly, or monthly status report.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Choose report template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && <Badge variant="secondary">{selectedTemplate.focus}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button onClick={exportSelected} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />Export CSV
            </Button>
            <Button onClick={() => toast.info('PDF packaging is not added yet. CSV remains the live export format.')} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />Export PDF
            </Button>
          </div>
        </div>

        {selectedTemplate && (
          <Card className="glass">
            <CardContent className="p-5">
              <p className="text-sm font-medium">{selectedTemplate.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Generated Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                {selectedTemplate?.focus === 'risk' ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="overdue" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tickets" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : selectedTemplate?.focus === 'schedule' ? (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="duration" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                    <Area type="monotone" dataKey="dependencies" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.12)" />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey={selectedTemplate?.focus === 'resource' ? 'value' : 'progress'} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Report Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTemplate?.focus === 'resource' && (
                <>
                  <p className="text-sm">Average utilization: {Math.round(reportRows.reduce((sum, row) => sum + (Number.parseInt(String(row.utilization).replace('%', ''), 10) || 0), 0) / Math.max(1, reportRows.length))}%</p>
                  <p className="text-sm">Members over target: {reportRows.filter((row) => (Number.parseInt(String(row.utilization).replace('%', ''), 10) || 0) > (Number.parseInt(String(row.target).replace('%', ''), 10) || 0)).length}</p>
                </>
              )}
              {selectedTemplate?.focus === 'risk' && (
                <>
                  <p className="text-sm">Projects with open delivery pressure: {reportRows.filter((row) => row.overdueTasks > 0 || row.openTickets > 0).length}</p>
                  <p className="text-sm">Highest risk count: {Math.max(...reportRows.map((row) => row.overdueTasks + row.openTickets), 0)}</p>
                </>
              )}
              {selectedTemplate?.focus === 'schedule' && (
                <>
                  <p className="text-sm">Total planned duration: {reportRows.reduce((sum, row) => sum + (Number.parseInt(String(row.duration).replace('d', ''), 10) || 0), 0)} days</p>
                  <p className="text-sm">Tracked dependencies: {reportRows.reduce((sum, row) => sum + (row.dependencies || 0), 0)}</p>
                </>
              )}
              {selectedTemplate?.focus === 'executive' && (
                <>
                  <p className="text-sm">Active portfolios: {projects.filter((project) => project.status === 'active').length}</p>
                  <p className="text-sm">Average progress: {Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / Math.max(1, projects.length))}%</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Generated Data Table</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="border-b bg-muted/20">
                <tr>
                  {selectedTemplate?.columns.map((column) => (
                    <th key={column} className="p-3 text-xs font-black uppercase tracking-widest">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, index) => (
                  <tr key={`${selectedTemplateId}-${index}`} className="border-b">
                    {selectedTemplate?.columns.map((column) => (
                      <td key={column} className="p-3 text-sm">{String(row[column as keyof typeof row] ?? '-')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reports;
