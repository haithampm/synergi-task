import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Download, FileText, Gauge, RefreshCw, Target, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ProjectRow = {
  id: string;
  name: string;
  status: string | null;
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  project_id: string | null;
  progress: number | null;
  workload_hours: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
};

type TicketRow = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  project_id: string | null;
  sla_deadline: string | null;
};

type TeamMemberRow = {
  id: string;
  name: string;
  role_title: string | null;
  capacity_hours: number | null;
  utilization_target: number | null;
};

type MeetingRow = {
  id: string;
  title: string;
  status: string | null;
  starts_at: string | null;
  project_id: string | null;
};

type DashboardData = {
  projects: ProjectRow[];
  tasks: TaskRow[];
  tickets: TicketRow[];
  teamMembers: TeamMemberRow[];
  meetings: MeetingRow[];
};

const visiblePaths = new Set(['/dashboard', '/app-monitor', '/projects', '/tasks']);
const isVisiblePath = () => visiblePaths.has(window.location.pathname.replace(/\/$/, '') || '/dashboard');
const todayDate = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value.length > 10 ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const getTaskHours = (task: TaskRow) => Number(task.actual_hours ?? task.workload_hours ?? task.estimated_hours ?? 0) || 0;

const statusTone: Record<string, string> = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  neutral: 'border-border bg-muted text-muted-foreground',
};

const PMODeliveryCyclePanel = () => {
  const [visible, setVisible] = useState(isVisiblePath);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [data, setData] = useState<DashboardData>({ projects: [], tasks: [], tickets: [], teamMembers: [], meetings: [] });

  useEffect(() => {
    const updateVisibility = () => setVisible(isVisiblePath());
    const patchHistory = (method: 'pushState' | 'replaceState') => {
      const original = window.history[method];
      window.history[method] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('workspace-route-changed'));
        return result;
      };
      return () => {
        window.history[method] = original;
      };
    };
    const restorePush = patchHistory('pushState');
    const restoreReplace = patchHistory('replaceState');
    updateVisibility();
    window.addEventListener('workspace-route-changed', updateVisibility);
    window.addEventListener('popstate', updateVisibility);
    window.addEventListener('hashchange', updateVisibility);
    return () => {
      restorePush();
      restoreReplace();
      window.removeEventListener('workspace-route-changed', updateVisibility);
      window.removeEventListener('popstate', updateVisibility);
      window.removeEventListener('hashchange', updateVisibility);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [projectResult, taskResult, ticketResult, teamResult, meetingResult] = await Promise.all([
        supabase.from('projects').select('id,name,status,progress,start_date,end_date').order('name', { ascending: true }),
        supabase.from('tasks').select('id,title,status,priority,due_date,project_id,progress,workload_hours,estimated_hours,actual_hours').order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('tickets').select('id,title,status,priority,project_id,sla_deadline').order('created_at', { ascending: false }),
        supabase.from('team_members').select('id,name,role_title,capacity_hours,utilization_target').order('name', { ascending: true }),
        supabase.from('meetings').select('id,title,status,starts_at,project_id').order('starts_at', { ascending: true }),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (taskResult.error) throw taskResult.error;
      if (ticketResult.error) throw ticketResult.error;
      if (teamResult.error) throw teamResult.error;
      if (meetingResult.error) throw meetingResult.error;
      setData({
        projects: (projectResult.data ?? []) as ProjectRow[],
        tasks: (taskResult.data ?? []) as TaskRow[],
        tickets: (ticketResult.data ?? []) as TicketRow[],
        teamMembers: (teamResult.data ?? []) as TeamMemberRow[],
        meetings: (meetingResult.data ?? []) as MeetingRow[],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load PMO delivery cycle data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && open) void loadData();
  }, [visible, open]);

  const metrics = useMemo(() => {
    const today = todayDate();
    const soon = plusDays(7);
    const activeProjects = data.projects.filter((project) => normalize(project.status) === 'active');
    const overdueTasks = data.tasks.filter((task) => task.due_date && task.due_date < today && normalize(task.status) !== 'done');
    const dueSoonTasks = data.tasks.filter((task) => task.due_date && task.due_date >= today && task.due_date <= soon && normalize(task.status) !== 'done');
    const openTickets = data.tickets.filter((ticket) => !['closed', 'resolved', 'done'].includes(normalize(ticket.status)));
    const urgentTickets = openTickets.filter((ticket) => ['high', 'urgent', 'critical'].includes(normalize(ticket.priority)));
    const upcomingMeetings = data.meetings.filter((meeting) => meeting.starts_at && meeting.starts_at.slice(0, 10) >= today && normalize(meeting.status) !== 'cancelled');
    const plannedHours = data.tasks.reduce((sum, task) => sum + getTaskHours(task), 0);
    const teamCapacity = data.teamMembers.reduce((sum, member) => sum + (Number(member.capacity_hours ?? 40) || 40), 0);
    const utilization = teamCapacity > 0 ? Math.round((plannedHours / teamCapacity) * 100) : 0;
    const completedTasks = data.tasks.filter((task) => normalize(task.status) === 'done').length;
    const taskCompletion = data.tasks.length ? Math.round((completedTasks / data.tasks.length) * 100) : 0;
    return {
      activeProjects,
      overdueTasks,
      dueSoonTasks,
      openTickets,
      urgentTickets,
      upcomingMeetings,
      plannedHours,
      teamCapacity,
      utilization,
      completedTasks,
      taskCompletion,
    };
  }, [data]);

  const recommendations = useMemo(() => {
    const items = [
      metrics.overdueTasks.length
        ? `Recover ${metrics.overdueTasks.length} overdue tasks before the weekly PMO report.`
        : 'No overdue tasks detected. Keep daily follow-up running.',
      metrics.urgentTickets.length
        ? `Escalate ${metrics.urgentTickets.length} urgent open points/tickets with owners and target dates.`
        : 'No urgent tickets detected. Keep open-points log updated.',
      metrics.utilization > 95
        ? `Team utilization is ${metrics.utilization}%. Rebalance workload or shift low-priority activities.`
        : metrics.utilization < 65
          ? `Team utilization is ${metrics.utilization}%. Assign planned activities to available capacity.`
          : `Team utilization is ${metrics.utilization}%. Capacity is in a healthy operating range.`,
      metrics.dueSoonTasks.length
        ? `Review ${metrics.dueSoonTasks.length} tasks due within 7 days in the next standup.`
        : 'No near-term task pressure for the next 7 days.',
    ];
    return items;
  }, [metrics]);

  const exportWeeklyReport = () => {
    const lines = [
      ['Section', 'Metric', 'Value'],
      ['Portfolio', 'Total Projects', data.projects.length],
      ['Portfolio', 'Active Projects', metrics.activeProjects.length],
      ['Tasks', 'Total Tasks', data.tasks.length],
      ['Tasks', 'Completed Tasks', metrics.completedTasks],
      ['Tasks', 'Completion %', `${metrics.taskCompletion}%`],
      ['Tasks', 'Overdue Tasks', metrics.overdueTasks.length],
      ['Tasks', 'Due Soon Tasks', metrics.dueSoonTasks.length],
      ['Open Points', 'Open Tickets', metrics.openTickets.length],
      ['Open Points', 'Urgent Tickets', metrics.urgentTickets.length],
      ['Team', 'Team Members', data.teamMembers.length],
      ['Team', 'Planned Hours', metrics.plannedHours],
      ['Team', 'Capacity Hours', metrics.teamCapacity],
      ['Team', 'Utilization %', `${metrics.utilization}%`],
      ['Schedule', 'Upcoming Meetings', metrics.upcomingMeetings.length],
      ...recommendations.map((item, index) => ['Recommendations', `R${index + 1}`, item]),
    ];
    const blob = new Blob([lines.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pmo-weekly-report-${todayDate()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="fixed right-4 top-[550px] z-[55] gap-2 rounded-2xl shadow-xl"
        onClick={() => setOpen(true)}
      >
        <Target className="h-4 w-4" /> PMO Cycle
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[97] bg-background/98 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl sm:h-[calc(100vh-2rem)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-4">
              <div>
                <p className="text-xl font-black">PMO Delivery Cycle Assistant</p>
                <p className="text-sm text-muted-foreground">Senior PM / program manager view for projects, tasks, timesheets, open points, testing, and weekly reporting.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void loadData()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportWeeklyReport}>
                  <Download className="h-4 w-4" /> Weekly Report CSV
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {message ? <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">{message}</div> : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  { label: 'Projects', value: data.projects.length, icon: BarChart3, tone: 'neutral' },
                  { label: 'Active', value: metrics.activeProjects.length, icon: CheckCircle2, tone: 'good' },
                  { label: 'Tasks', value: data.tasks.length, icon: ClipboardCheck, tone: 'neutral' },
                  { label: 'Overdue', value: metrics.overdueTasks.length, icon: AlertTriangle, tone: metrics.overdueTasks.length ? 'danger' : 'good' },
                  { label: 'Open Points', value: metrics.openTickets.length, icon: FileText, tone: metrics.urgentTickets.length ? 'warning' : 'neutral' },
                  { label: 'Utilization', value: `${metrics.utilization}%`, icon: Gauge, tone: metrics.utilization > 95 ? 'warning' : 'good' },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="rounded-2xl border bg-background p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <p className="mt-2 text-3xl font-black">{card.value}</p>
                      <Badge variant="outline" className={`mt-3 ${statusTone[card.tone]}`}>{card.tone}</Badge>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-3xl border bg-muted/10 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-black">Recommended operating cycle</h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { title: '1. Plan', detail: 'Confirm scope, milestones, baseline schedule, owners, risks, and acceptance criteria for every project.' },
                      { title: '2. Assign & execute', detail: 'Break work into tasks and activities. Assign owners, priorities, due dates, and planned hours.' },
                      { title: '3. Timesheet capture', detail: 'Team members update actual hours weekly against the right project task/activity.' },
                      { title: '4. Open points follow-up', detail: 'Track client, PMO, and development open points as tickets with owner, SLA, and next action.' },
                      { title: '5. Functional testing', detail: 'After developer handover, create test tasks, record defects as tickets, and confirm acceptance.' },
                      { title: '6. Weekly reporting', detail: 'Export weekly PMO/client report: progress, risks, open points, utilization, and next-week plan.' },
                    ].map((item) => (
                      <div key={item.title} className="rounded-2xl border bg-background p-4">
                        <p className="font-black">{item.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border bg-muted/10 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-black">Auto recommendations</h2>
                  </div>
                  <div className="space-y-3">
                    {recommendations.map((item, index) => (
                      <div key={item} className="rounded-2xl border bg-background p-3 text-sm">
                        <p className="font-semibold">R{index + 1}</p>
                        <p className="mt-1 text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <section className="rounded-3xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    <h3 className="font-black">This week task focus</h3>
                  </div>
                  <div className="space-y-2">
                    {metrics.dueSoonTasks.slice(0, 8).map((task) => (
                      <div key={task.id} className="rounded-xl border bg-muted/10 px-3 py-2 text-sm">
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-xs text-muted-foreground">Due {formatDate(task.due_date)} · {task.priority ?? 'medium'} · {task.status ?? 'Tasks'}</p>
                      </div>
                    ))}
                    {!metrics.dueSoonTasks.length ? <p className="text-sm text-muted-foreground">No tasks due in the next 7 days.</p> : null}
                  </div>
                </section>

                <section className="rounded-3xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-black">Open points</h3>
                  </div>
                  <div className="space-y-2">
                    {metrics.openTickets.slice(0, 8).map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border bg-muted/10 px-3 py-2 text-sm">
                        <p className="font-semibold">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground">{ticket.status ?? 'open'} · {ticket.priority ?? 'medium'} · SLA {formatDate(ticket.sla_deadline)}</p>
                      </div>
                    ))}
                    {!metrics.openTickets.length ? <p className="text-sm text-muted-foreground">No open tickets.</p> : null}
                  </div>
                </section>

                <section className="rounded-3xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <h3 className="font-black">Follow-up schedule</h3>
                  </div>
                  <div className="space-y-2">
                    {metrics.upcomingMeetings.slice(0, 8).map((meeting) => (
                      <div key={meeting.id} className="rounded-xl border bg-muted/10 px-3 py-2 text-sm">
                        <p className="font-semibold">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(meeting.starts_at)} · {meeting.status ?? 'scheduled'}</p>
                      </div>
                    ))}
                    {!metrics.upcomingMeetings.length ? <p className="text-sm text-muted-foreground">No upcoming meetings loaded.</p> : null}
                  </div>
                </section>
              </div>

              <div className="mt-5 rounded-3xl border bg-slate-950 p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Weekly reporting pack</p>
                    <h3 className="mt-1 text-xl font-black">PMO / Management / Client report structure</h3>
                    <p className="mt-2 max-w-3xl text-sm text-slate-300">Use this cycle every week: executive summary, progress by project, overdue tasks, open points, development follow-up, functional test status, team utilization, key risks, and next-week plan.</p>
                  </div>
                  <div className="flex gap-2">
                    <a href="/reports" className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-100">Open Reports</a>
                    <a href="/tasks" className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-black text-white hover:bg-white/10">Open Tasks</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default PMODeliveryCyclePanel;
