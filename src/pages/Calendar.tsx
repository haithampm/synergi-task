import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, Filter, GripVertical, Link2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMeetings, usePersonalEvents, useProjects, useTasks, useTeamMembers, useUpdateMeeting, useUpdatePersonalEvent, useUpdateTask, useWorkspaceSettings } from "@/hooks/useProjects";
import { toast } from "sonner";

type CalendarItem = {
  id: string;
  title: string;
  type: "task" | "project" | "meeting" | "personal";
  start: Date;
  end: Date;
  projectId?: string;
  taskId?: string;
  memberId?: string;
  status?: string;
  source?: string;
  notes?: string;
};

const getItemTone = (item: CalendarItem) => {
  if (item.type === "meeting") return "bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300";
  if (item.type === "personal") return "bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300";
  if (item.status === "done") return "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  if (item.status === "review") return "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300";
  return "bg-primary/10 border-primary/30 text-primary";
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { data: settings } = useWorkspaceSettings();
  const { data: members = [] } = useTeamMembers();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: meetings = [] } = useMeetings();
  const { data: personalEvents = [] } = usePersonalEvents();
  const updateTask = useUpdateTask();
  const updateMeeting = useUpdateMeeting();
  const updatePersonalEvent = useUpdatePersonalEvent();

  const linkedMemberId = settings?.currentUser.teamMemberId || members[0]?.id || "";
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [memberFilter, setMemberFilter] = useState(linkedMemberId || "all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showTasks, setShowTasks] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showPersonal, setShowPersonal] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [completedOnly, setCompletedOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  const canReschedule = (settings?.currentUser.roleId ?? "viewer") !== "viewer";

  const items = useMemo<CalendarItem[]>(() => {
    const taskItems = tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      type: "task" as const,
      start: parseISO(task.start_date ?? task.due_date ?? new Date().toISOString()),
      end: parseISO(task.end_date ?? task.due_date ?? new Date().toISOString()),
      projectId: task.project_id ?? task.projectId,
      taskId: task.id,
      memberId: task.assignee_id ?? task.assignees?.[0],
      status: task.status,
      notes: task.description,
    }));

    const projectItems = projects.map((project) => ({
      id: `project-${project.id}`,
      title: `${project.name} Timeline`,
      type: "project" as const,
      start: parseISO(project.start_date ?? project.startDate ?? new Date().toISOString()),
      end: parseISO(project.end_date ?? project.endDate ?? new Date().toISOString()),
      projectId: project.id,
      status: project.status,
      notes: project.description,
    }));

    const meetingItems = meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      type: "meeting" as const,
      start: parseISO(meeting.startsAt),
      end: parseISO(meeting.endsAt),
      projectId: meeting.projectId,
      taskId: meeting.taskId,
      memberId: meeting.organizerId,
      status: meeting.status,
      source: meeting.provider,
      notes: meeting.notes,
    }));

    const personalItemList = personalEvents.map((event) => ({
      id: `personal-${event.id}`,
      title: event.title,
      type: "personal" as const,
      start: parseISO(event.startsAt),
      end: parseISO(event.endsAt),
      memberId: event.memberId,
      source: event.type,
      notes: event.notes,
    }));

    return [...taskItems, ...projectItems, ...meetingItems, ...personalItemList];
  }, [meetings, personalEvents, projects, tasks]);

  const filteredItems = useMemo(() => {
    const today = new Date();
    return items.filter((item) => {
      if (!showTasks && item.type === "task") return false;
      if (!showProjects && item.type === "project") return false;
      if (!showMeetings && item.type === "meeting") return false;
      if (!showPersonal && item.type === "personal") return false;
      if (projectFilter !== "all" && item.projectId !== projectFilter) return false;
      if (memberFilter !== "all" && item.memberId && item.memberId !== memberFilter) return false;
      if (taskStatusFilter !== "all" && item.type === "task" && item.status !== taskStatusFilter) return false;
      if (completedOnly && item.status !== "done" && item.status !== "completed") return false;
      if (overdueOnly && !(item.end < today && item.status !== "done" && item.status !== "completed")) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [item.title, item.notes, item.status, item.source].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [completedOnly, items, memberFilter, overdueOnly, projectFilter, search, showMeetings, showPersonal, showProjects, showTasks, taskStatusFilter]);

  const rangeDays = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [anchorDate, view]);

  const moveItem = async (itemId: string, targetDate: Date) => {
    const item = filteredItems.find((entry) => entry.id === itemId);
    if (!item || !canReschedule) return;

    const dayDelta = Math.round((targetDate.getTime() - item.start.getTime()) / (1000 * 60 * 60 * 24));
    const nextStart = addDays(item.start, dayDelta);
    const nextEnd = addDays(item.end, dayDelta);

    if (item.type === "task" && item.taskId) {
      await updateTask.mutateAsync({
        id: item.taskId,
        start_date: format(nextStart, "yyyy-MM-dd"),
        end_date: format(nextEnd, "yyyy-MM-dd"),
        due_date: format(nextEnd, "yyyy-MM-dd"),
      });
    } else if (item.type === "meeting") {
      await updateMeeting.mutateAsync({
        id: item.id.replace("meeting-", ""),
        startsAt: nextStart.toISOString(),
        endsAt: nextEnd.toISOString(),
      });
    } else if (item.type === "personal") {
      await updatePersonalEvent.mutateAsync({
        id: item.id.replace("personal-", ""),
        startsAt: nextStart.toISOString(),
        endsAt: nextEnd.toISOString(),
      });
    } else {
      return;
    }

    toast.success("Calendar item rescheduled");
  };

  const itemsForDate = (date: Date) =>
    filteredItems.filter((item) => isSameDay(item.start, date) || (item.start < date && item.end >= date));

  return (
    <AppLayout>
      <AppHeader title="User Calendar" subtitle="Profile calendar for tasks, project activities, meetings, and personal events with enterprise sync readiness." />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <Card className="glass">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Calendar Workspace</p>
                <h2 className="text-2xl font-semibold mt-1">{format(anchorDate, view === "month" ? "MMMM yyyy" : "dd MMM yyyy")}</h2>
                <p className="text-sm text-muted-foreground mt-1">Drag an item onto another date to reschedule when permissions allow.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setAnchorDate(view === "month" ? addMonths(anchorDate, -1) : addDays(anchorDate, view === "week" ? -7 : -1))}>Previous</Button>
                <Button variant="outline" onClick={() => setAnchorDate(new Date())}>Today</Button>
                <Button variant="outline" onClick={() => setAnchorDate(view === "month" ? addMonths(anchorDate, 1) : addDays(anchorDate, view === "week" ? 7 : 1))}>Next</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <p className="font-medium">Integration Readiness</p>
              </div>
              {[
                settings?.integrations.outlook,
                settings?.integrations.teams,
                settings?.integrations.googleCalendar,
              ].filter(Boolean).map((integration) => (
                <div key={integration?.providerLabel} className="rounded-xl border p-3 bg-card/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{integration?.providerLabel}</p>
                    <Badge variant={integration?.connected ? "default" : "outline"}>{integration?.connected ? "Connected" : "Ready"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{integration?.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="glass">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs value={view} onValueChange={(value) => setView(value as "day" | "week" | "month")}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
                {canReschedule ? "Rescheduling enabled" : "Read-only calendar"}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-6">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search calendar" />
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Task status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All task status</SelectItem>
                  {["backlog", "todo", "in-progress", "review", "done"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger><SelectValue placeholder="Team member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-xl border px-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <button type="button" className={`text-xs ${overdueOnly ? "font-semibold text-primary" : "text-muted-foreground"}`} onClick={() => setOverdueOnly((current) => !current)}>Overdue</button>
                <button type="button" className={`text-xs ${completedOnly ? "font-semibold text-primary" : "text-muted-foreground"}`} onClick={() => setCompletedOnly((current) => !current)}>Completed</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: "Tasks", active: showTasks, onToggle: () => setShowTasks((current) => !current) },
                  { label: "Projects", active: showProjects, onToggle: () => setShowProjects((current) => !current) },
                  { label: "Meetings", active: showMeetings, onToggle: () => setShowMeetings((current) => !current) },
                  { label: "Personal", active: showPersonal, onToggle: () => setShowPersonal((current) => !current) },
                ].map(({ label, active, onToggle }) => (
                  <Button key={label} variant={active ? "default" : "outline"} size="sm" onClick={onToggle}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`grid gap-4 ${view === "month" ? "grid-cols-7" : view === "week" ? "grid-cols-7" : "grid-cols-1"}`}>
          {rangeDays.map((date) => (
            <Card
              key={date.toISOString()}
              className={`glass ${view === "month" && !isSameMonth(date, anchorDate) ? "opacity-55" : ""}`}
              onDragOver={(event) => canReschedule && event.preventDefault()}
              onDrop={(event) => {
                if (!canReschedule) return;
                event.preventDefault();
                const itemId = event.dataTransfer.getData("calendar-item-id");
                if (itemId) void moveItem(itemId, date);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{format(date, view === "month" ? "dd EEE" : "EEE dd")}</span>
                  <Badge variant="outline">{itemsForDate(date).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[180px]">
                {itemsForDate(date).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">No items scheduled.</div>
                ) : (
                  itemsForDate(date).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      draggable={canReschedule && item.type !== "project"}
                      onDragStart={(event) => event.dataTransfer.setData("calendar-item-id", item.id)}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full rounded-xl border p-3 text-left ${getItemTone(item)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-[11px] opacity-80 mt-1">{format(item.start, "HH:mm")} - {format(item.end, "HH:mm")}</p>
                        </div>
                        {item.status === "done" || item.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedItem.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedItem.type}</Badge>
                  {selectedItem.status ? <Badge variant="secondary">{selectedItem.status}</Badge> : null}
                  {selectedItem.source ? <Badge variant="outline">{selectedItem.source}</Badge> : null}
                </div>
                <Card className="glass">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <p><span className="font-medium">Starts:</span> {format(selectedItem.start, "dd MMM yyyy HH:mm")}</p>
                    <p><span className="font-medium">Ends:</span> {format(selectedItem.end, "dd MMM yyyy HH:mm")}</p>
                    {selectedItem.notes ? <p><span className="font-medium">Notes:</span> {selectedItem.notes}</p> : null}
                  </CardContent>
                </Card>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.projectId ? (
                    <Button variant="outline" onClick={() => navigate(`/projects`)}>Open Project</Button>
                  ) : null}
                  {selectedItem.taskId ? (
                    <Button variant="outline" onClick={() => navigate(`/tasks`)}>Open Task</Button>
                  ) : null}
                  {selectedItem.type === "meeting" && selectedItem.source === "teams" ? (
                    <Button variant="outline" className="gap-2">
                      <Link2 className="h-4 w-4" /> Open Teams Link
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => navigate("/schedule")} className="gap-2">
                    <CalendarDays className="h-4 w-4" /> Open Schedule
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/documents")} className="gap-2">
                    <Users className="h-4 w-4" /> Related Documents
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default CalendarPage;
