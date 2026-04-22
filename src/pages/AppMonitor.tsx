import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Clock3, Database, FileText, Link2Off, MessagesSquare, ShieldCheck, Ticket, Unplug, Users } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAuditLogs,
  useChatChannels,
  useMeetings,
  useProjects,
  useTasks,
  useTeamMembers,
  useTickets,
  useUserAccounts,
  useWorkspaceSettings,
  useDatabaseConnection,
} from "@/hooks/useProjects";

const severityTone: Record<"healthy" | "warning" | "critical", string> = {
  healthy: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const AppMonitor = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useWorkspaceSettings();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: dbConnection } = useDatabaseConnection();
  const { data: meetings = [] } = useMeetings();
  const { data: chatChannels = [] } = useChatChannels();
  const { data: auditLogs = [] } = useAuditLogs();
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const activeTab = searchParams.get("tab") ?? "overview";

  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const taskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const documents = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.documents ?? []).map((document) => ({
          ...document,
          projectId: project.id,
          projectName: project.name,
        })),
      ),
    [projects],
  );
  const recentLogs = useMemo(
    () => [...auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [auditLogs],
  );
  const auditLastWeek = useMemo(() => {
    const now = Date.now();
    return recentLogs.filter((log) => now - new Date(log.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  }, [recentLogs]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const due = task.due_date ?? task.dueDate;
        return due && new Date(due) < new Date() && task.status !== "done";
      }),
    [tasks],
  );
  const pendingDocuments = useMemo(
    () => documents.filter((document) => !["approved", "signed"].includes(document.reviewStatus ?? "draft")),
    [documents],
  );
  const disconnectedIntegrations = useMemo(
    () =>
      Object.entries(settings?.integrations ?? {}).filter(([, config]) => config.enabled && !config.connected),
    [settings],
  );
  const orphanTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const projectId = task.project_id ?? task.projectId;
        return Boolean(projectId) && !projectIds.has(projectId);
      }),
    [projectIds, tasks],
  );
  const orphanTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          (ticket.projectId && !projectIds.has(ticket.projectId)) ||
          (ticket.taskId && !taskIds.has(ticket.taskId)),
      ),
    [projectIds, taskIds, tickets],
  );
  const projectChannelsWithoutProjects = useMemo(
    () => chatChannels.filter((channel) => channel.projectId && !projectIds.has(channel.projectId)),
    [chatChannels, projectIds],
  );
  const unscheduledProjectMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          (meeting.projectId && !projectIds.has(meeting.projectId)) ||
          (meeting.taskId && !taskIds.has(meeting.taskId)),
      ),
    [meetings, projectIds, taskIds],
  );
  const suspendedUsers = useMemo(
    () => userAccounts.filter((account) => account.status === "suspended"),
    [userAccounts],
  );
  const projectsWithoutOwner = useMemo(
    () =>
      projects.filter((project) => {
        const hasResourceLead = (project.resources ?? []).some((resource) => /manager|lead|director/i.test(resource.role));
        const hasTeamLead = (project.teamStructure ?? []).some((node) => /manager|lead|director/i.test(node.title));
        return !hasResourceLead && !hasTeamLead;
      }),
    [projects],
  );

  const healthCards = [
    {
      title: "Database Connection",
      value: !dbConnection?.configured
        ? "Offline"
        : dbConnection.operational
          ? (dbConnection.connected ? "Live" : "Offline")
          : "Mismatch",
      hint: dbConnection
        ? `${dbConnection.message}${dbConnection.latencyMs !== null ? ` (${dbConnection.latencyMs} ms)` : ""}`
        : "Checking Supabase connectivity and authentication...",
      meta:
        dbConnection?.linkedProjectRef || dbConnection?.activeProjectRef
          ? [
              `Linked project: ${dbConnection?.linkedProjectRef ?? "not set"}`,
              `App project: ${dbConnection?.activeProjectRef ?? "not set"}`,
            ]
          : [],
      icon: Database,
      actionLabel: "Open Settings",
      action: () => navigate("/settings"),
    },
    {
      title: "Audit Events",
      value: auditLastWeek,
      hint: "activity recorded in the last 7 days",
      icon: Activity,
      actionLabel: "Open History",
      action: () => setSearchParams({ tab: "history" }),
    },
    {
      title: "Overdue Tasks",
      value: overdueTasks.length,
      hint: "tasks behind planned due date",
      icon: Clock3,
      actionLabel: "Open Tasks",
      action: () => navigate("/tasks"),
    },
    {
      title: "Pending Documents",
      value: pendingDocuments.length,
      hint: "documents waiting for review or sign-off",
      icon: FileText,
      actionLabel: "Open Documents",
      action: () => navigate("/documents"),
    },
    {
      title: "Disconnected Integrations",
      value: disconnectedIntegrations.length,
      hint: "enabled connectors not currently linked",
      icon: Unplug,
      actionLabel: "Open Settings",
      action: () => navigate("/settings"),
    },
  ];

  const monitorSignals = [
    {
      title: "Data Integrity",
      tone: (orphanTasks.length || orphanTickets.length || projectChannelsWithoutProjects.length || unscheduledProjectMeetings.length) ? "critical" as const : "healthy" as const,
      value: orphanTasks.length + orphanTickets.length + projectChannelsWithoutProjects.length + unscheduledProjectMeetings.length,
      detail: "linked records that need cleanup",
    },
    {
      title: "Governance Readiness",
      tone: projectsWithoutOwner.length || suspendedUsers.length ? "warning" as const : "healthy" as const,
      value: projects.length ? Math.max(0, 100 - Math.round(((projectsWithoutOwner.length + suspendedUsers.length) / Math.max(projects.length, 1)) * 100)) : 100,
      detail: "projects with clear ownership and active access",
      isPercent: true,
    },
    {
      title: "Collaboration Coverage",
      tone: chatChannels.length ? "healthy" as const : "warning" as const,
      value: chatChannels.length,
      detail: "team and project channels available",
    },
    {
      title: "Team Availability",
      tone: suspendedUsers.length > 0 ? "warning" as const : "healthy" as const,
      value: teamMembers.length - suspendedUsers.length,
      detail: "active people ready for delivery",
    },
  ];

  const integrityIssues = [
    {
      key: "orphan-tasks",
      title: "Tasks linked to missing projects",
      count: orphanTasks.length,
      detail: "These tasks still exist, but their project relationship no longer resolves.",
      path: "/tasks",
    },
    {
      key: "orphan-tickets",
      title: "Tickets linked to missing tasks or projects",
      count: orphanTickets.length,
      detail: "These tickets need their project/task reference corrected.",
      path: "/tickets",
    },
    {
      key: "orphan-channels",
      title: "Project channels without a live project",
      count: projectChannelsWithoutProjects.length,
      detail: "These chat streams point to deleted or missing projects.",
      path: "/team-chat",
    },
    {
      key: "orphan-meetings",
      title: "Meetings linked to missing records",
      count: unscheduledProjectMeetings.length,
      detail: "These meetings reference a task or project that no longer exists.",
      path: "/calendar",
    },
    {
      key: "no-owner-projects",
      title: "Projects without PMO or PM ownership",
      count: projectsWithoutOwner.length,
      detail: "These projects have no manager or lead role in resources or team structure.",
      path: "/projects",
    },
  ];

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return recentLogs.filter((log) => {
      const matchesType = historyFilter === "all" || log.entityType === historyFilter;
      const matchesQuery =
        !query ||
        [log.action, log.entityType, log.actorName, log.detail]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesType && matchesQuery;
    });
  }, [historyFilter, historyQuery, recentLogs]);

  return (
    <AppLayout>
      <AppHeader
        title="App Monitor"
        subtitle={`${settings?.namespace.organization ?? "Workspace"} operations dashboard for audit history, data relationships, and go-live monitoring.`}
      />
      <div className="p-6 space-y-6 animate-fade-in">
        <PageSection
          title="Operations Center"
          description="Track audit activity, data health, integration readiness, and PMO relationship quality from one screen."
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">Open Settings</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/reports">Open Reports</Link>
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {healthCards.map((card) => (
            <Card key={card.title} className="glass">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-semibold mt-2">{card.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{card.hint}</p>
                {"meta" in card && Array.isArray(card.meta)
                  ? card.meta.map((line) => (
                      <p key={line} className="text-[11px] text-muted-foreground">
                        {line}
                      </p>
                    ))
                  : null}
                <Button variant="ghost" size="sm" className="px-0" onClick={card.action}>
                  {card.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => setSearchParams(tab === "overview" ? {} : { tab })} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="integrity">Integrity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" /> Workspace Monitor Signals
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {monitorSignals.map((signal) => (
                    <div key={signal.title} className="rounded-2xl border bg-background/60 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{signal.title}</p>
                        <Badge variant="outline" className={severityTone[signal.tone]}>
                          {signal.tone}
                        </Badge>
                      </div>
                      <p className="text-2xl font-semibold">{signal.isPercent ? `${signal.value}%` : signal.value}</p>
                      <Progress value={signal.isPercent ? signal.value : Math.min(signal.value * 10, 100)} />
                      <p className="text-xs text-muted-foreground">{signal.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Unplug className="h-4 w-4" /> Integration Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(settings?.integrations ?? {}).map(([key, config]) => (
                    <div key={key} className="rounded-2xl border bg-background/60 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{config.providerLabel}</p>
                        <Badge
                          variant="outline"
                          className={config.enabled ? (config.connected ? severityTone.healthy : severityTone.warning) : "border-border text-muted-foreground"}
                        >
                          {config.enabled ? (config.connected ? "connected" : "needs link") : "disabled"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{config.status}</p>
                      <p className="text-xs text-muted-foreground">
                        Sync mode: {config.syncMode} {config.lastSyncAt ? `| Last sync ${formatDateTime(config.lastSyncAt)}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{log.action}</p>
                        <Badge variant="secondary">{log.entityType}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {log.actorName} | {formatDateTime(log.createdAt)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">{log.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" /> PMO Attention Queue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-warning" />
                        <p className="font-medium">Overdue tasks</p>
                      </div>
                      <Badge variant="outline" className={overdueTasks.length ? severityTone.warning : severityTone.healthy}>
                        {overdueTasks.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-primary" />
                        <p className="font-medium">Open tickets</p>
                      </div>
                      <Badge variant="outline">{tickets.filter((ticket) => ticket.status !== "closed").length}</Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-info" />
                        <p className="font-medium">Pending document reviews</p>
                      </div>
                      <Badge variant="outline">{pendingDocuments.length}</Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-destructive" />
                        <p className="font-medium">Suspended users</p>
                      </div>
                      <Badge variant="outline" className={suspendedUsers.length ? severityTone.warning : severityTone.healthy}>
                        {suspendedUsers.length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessagesSquare className="h-4 w-4" /> Activity History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Search audit action, actor, entity, or detail"
                    className="md:max-w-sm"
                  />
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="md:w-[220px]">
                      <SelectValue placeholder="Filter entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All entities</SelectItem>
                      <SelectItem value="project">Projects</SelectItem>
                      <SelectItem value="task">Tasks</SelectItem>
                      <SelectItem value="ticket">Tickets</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="meeting">Meetings</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="sticky-note">Sticky Notes</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                      <SelectItem value="user">Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {filteredHistory.length ? (
                    filteredHistory.slice(0, 50).map((log) => (
                      <div key={log.id} className="rounded-2xl border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{log.action}</p>
                            <Badge variant="secondary">{log.entityType}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{log.actorName}</p>
                        <p className="text-sm text-muted-foreground mt-2">{log.detail}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No audit events matched the current filter.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrity" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {integrityIssues.map((issue) => (
                <Card key={issue.key} className="glass">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-sm text-muted-foreground">{issue.detail}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={issue.count ? severityTone.critical : severityTone.healthy}
                      >
                        {issue.count}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(issue.path)}>
                      Review Records <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Link2Off className="h-4 w-4" /> Relationship Checks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Tasks without project: <span className="font-medium text-foreground">{orphanTasks.length}</span></p>
                  <p>Tickets without task/project: <span className="font-medium text-foreground">{orphanTickets.length}</span></p>
                  <p>Channels without project: <span className="font-medium text-foreground">{projectChannelsWithoutProjects.length}</span></p>
                  <p>Meetings without valid links: <span className="font-medium text-foreground">{unscheduledProjectMeetings.length}</span></p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" /> Ownership Checks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Projects without manager/lead: <span className="font-medium text-foreground">{projectsWithoutOwner.length}</span></p>
                  <p>Suspended user accounts: <span className="font-medium text-foreground">{suspendedUsers.length}</span></p>
                  <p>Team members available: <span className="font-medium text-foreground">{teamMembers.length - suspendedUsers.length}</span></p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" /> Delivery Checks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Documents pending review: <span className="font-medium text-foreground">{pendingDocuments.length}</span></p>
                  <p>Overdue tasks: <span className="font-medium text-foreground">{overdueTasks.length}</span></p>
                  <p>Open tickets: <span className="font-medium text-foreground">{tickets.filter((ticket) => ticket.status !== "closed").length}</span></p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AppMonitor;
