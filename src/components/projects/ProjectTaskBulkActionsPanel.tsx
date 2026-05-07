import { useMemo, useState } from "react";
import { Archive, CheckSquare, ExternalLink, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjects, useTasks, useTeamMembers, useUpdateTask } from "@/hooks/useProjects";
import { toast } from "sonner";

const taskStatuses = ["backlog", "todo", "in-progress", "review", "done"];
const taskPriorities = ["urgent", "high", "medium", "low"];
const supportedPaths = ["/tasks"];

const taskProjectId = (task: any) => task.project_id ?? task.projectId ?? "";
const taskDueDate = (task: any) => task.due_date ?? task.dueDate ?? task.end_date ?? "";
const isTaskArchived = (task: any) => task.customFieldValues?.archived === true || task.customFieldValues?.cancelled === true;

export default function ProjectTaskBulkActionsPanel() {
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("no-change");
  const [bulkPriority, setBulkPriority] = useState("no-change");
  const [bulkAssignee, setBulkAssignee] = useState("no-change");

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const updateTask = useUpdateTask();

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const visible = supportedPaths.includes(pathname);
  const pageLabel = "Tasks";
  const projectNameById = useMemo(() => new Map(projects.map((project: any) => [project.id, project.name])), [projects]);
  const projectTasks = useMemo(() => tasks.filter((task: any) => !isTaskArchived(task)).filter((task: any) => selectedProjectId === "all" || taskProjectId(task) === selectedProjectId).sort((a: any, b: any) => String(projectNameById.get(taskProjectId(a)) ?? "").localeCompare(String(projectNameById.get(taskProjectId(b)) ?? "")) || String(a.title).localeCompare(String(b.title))), [projectNameById, selectedProjectId, tasks]);
  const selectedTasks = useMemo(() => projectTasks.filter((task: any) => selectedTaskIds.includes(task.id)), [projectTasks, selectedTaskIds]);

  if (!visible) return null;

  const toggleTask = (taskId: string) => setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  const selectAllVisible = () => setSelectedTaskIds(projectTasks.map((task: any) => task.id));
  const clearSelection = () => setSelectedTaskIds([]);

  const applyBulkUpdate = async () => {
    if (!selectedTasks.length) return toast.error("Select at least one task first.");
    const updates: Record<string, unknown> = {};
    if (bulkStatus !== "no-change") updates.status = bulkStatus;
    if (bulkPriority !== "no-change") updates.priority = bulkPriority;
    if (bulkAssignee !== "no-change") updates.assignee = bulkAssignee === "unassigned" ? "" : bulkAssignee;
    if (!Object.keys(updates).length) return toast.error("Choose at least one action to apply.");
    for (const task of selectedTasks) await updateTask.mutateAsync({ id: task.id, ...updates });
    window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: "tasks", reason: "task-bulk-edit" } }));
    toast.success(`Updated ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}.`);
    setBulkStatus("no-change");
    setBulkPriority("no-change");
    setBulkAssignee("no-change");
  };

  const archiveSelected = async () => {
    if (!selectedTasks.length) return toast.error("Select at least one task first.");
    const ok = window.confirm(`Cancel / archive ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}? History, timesheets, and linked references will be preserved.`);
    if (!ok) return;
    for (const task of selectedTasks) {
      await updateTask.mutateAsync({
        id: task.id,
        status: task.status === "done" ? "done" : "review",
        workloadHours: task.timesheetEntries?.length ? task.workloadHours : 0,
        customFieldValues: {
          ...(task.customFieldValues ?? {}),
          archived: true,
          cancelled: task.status !== "done",
          archivedAt: new Date().toISOString(),
          archiveReason: "Cancelled/archived from task bulk actions. History preserved for PMO reporting.",
        },
      } as any);
    }
    window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: "tasks", reason: "task-bulk-archive" } }));
    toast.success(`Archived ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}.`);
    clearSelection();
  };

  return (
    <div className="mx-4 mb-3 rounded-2xl border bg-card/95 p-3 shadow-sm print:hidden sm:mx-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Task Actions</p>
            <p className="text-sm text-muted-foreground">Bulk edit status, priority, owner, or archive tasks from inside the Tasks page.</p>
          </div>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm" variant="default"><CheckSquare className="h-4 w-4" /> Open Task Actions</Button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>{pageLabel} Bulk Edit / Archive</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
              <Select value={selectedProjectId} onValueChange={(value) => { setSelectedProjectId(value); setSelectedTaskIds([]); }}><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent><SelectItem value="all">All Projects</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2 text-sm"><Badge variant="secondary">{projectTasks.length} active visible tasks</Badge><Badge>{selectedTasks.length} selected</Badge><Button variant="outline" size="sm" onClick={selectAllVisible}>Select All</Button><Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button></div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
              <Select value={bulkStatus} onValueChange={setBulkStatus}><SelectTrigger><SelectValue placeholder="Change status" /></SelectTrigger><SelectContent><SelectItem value="no-change">Status: no change</SelectItem>{taskStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/-/g, " ")}</SelectItem>)}</SelectContent></Select>
              <Select value={bulkPriority} onValueChange={setBulkPriority}><SelectTrigger><SelectValue placeholder="Change priority" /></SelectTrigger><SelectContent><SelectItem value="no-change">Priority: no change</SelectItem>{taskPriorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select>
              <Select value={bulkAssignee} onValueChange={setBulkAssignee}><SelectTrigger><SelectValue placeholder="Change owner" /></SelectTrigger><SelectContent><SelectItem value="no-change">Owner: no change</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent></Select>
              <Button className="gap-2" onClick={applyBulkUpdate} disabled={!selectedTasks.length || updateTask.isPending}><Wand2 className="h-4 w-4" /> Apply Edit</Button>
              <Button variant="secondary" className="gap-2" onClick={archiveSelected} disabled={!selectedTasks.length || updateTask.isPending}><Archive className="h-4 w-4" /> Archive</Button>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">Archive is the default PMO-safe action. It hides cancelled work from active views, keeps history/timesheets, and preserves reporting integrity.</div>
            <div className="max-h-[55vh] overflow-auto rounded-2xl border"><Table><TableHeader className="sticky top-0 bg-background"><TableRow><TableHead className="w-12">Select</TableHead><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Owner</TableHead><TableHead>Target Date</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader><TableBody>{projectTasks.map((task: any) => { const projectId = taskProjectId(task); return <TableRow key={task.id} className={selectedTaskIds.includes(task.id) ? "bg-primary/5" : undefined}><TableCell><input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTask(task.id)} aria-label={`Select ${task.title}`} /></TableCell><TableCell className="font-medium">{task.title}</TableCell><TableCell className="text-muted-foreground">{projectNameById.get(projectId) ?? "Unassigned"}</TableCell><TableCell><Badge variant="outline">{String(task.status ?? "todo").replace(/-/g, " ")}</Badge></TableCell><TableCell><Badge variant="secondary">{task.priority ?? "medium"}</Badge></TableCell><TableCell>{task.assignee || "Unassigned"}</TableCell><TableCell>{taskDueDate(task) || "-"}</TableCell><TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link to={`/tasks?taskId=${task.id}&projectId=${projectId}`}><ExternalLink className="mr-1 h-3 w-3" />Edit</Link></Button></TableCell></TableRow>; })}</TableBody></Table>{!projectTasks.length ? <div className="p-8 text-center text-sm text-muted-foreground">No active tasks found for the selected project.</div> : null}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
