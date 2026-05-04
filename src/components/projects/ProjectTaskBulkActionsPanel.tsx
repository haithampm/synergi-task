import { useMemo, useState } from "react";
import { CheckSquare, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeleteTask, useProjects, useTasks, useTeamMembers, useUpdateTask } from "@/hooks/useProjects";
import { toast } from "sonner";

const taskStatuses = ["backlog", "todo", "in-progress", "review", "done"];
const taskPriorities = ["urgent", "high", "medium", "low"];

const taskProjectId = (task: any) => task.project_id ?? task.projectId ?? "";
const taskDueDate = (task: any) => task.due_date ?? task.dueDate ?? "";

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
  const deleteTask = useDeleteTask();

  const visible = typeof window !== "undefined" && window.location.pathname === "/projects";
  const projectNameById = useMemo(() => new Map(projects.map((project: any) => [project.id, project.name])), [projects]);
  const projectTasks = useMemo(() => {
    return tasks
      .filter((task: any) => selectedProjectId === "all" || taskProjectId(task) === selectedProjectId)
      .sort((a: any, b: any) => String(projectNameById.get(taskProjectId(a)) ?? "").localeCompare(String(projectNameById.get(taskProjectId(b)) ?? "")) || String(a.title).localeCompare(String(b.title)));
  }, [projectNameById, selectedProjectId, tasks]);

  const selectedTasks = useMemo(
    () => projectTasks.filter((task: any) => selectedTaskIds.includes(task.id)),
    [projectTasks, selectedTaskIds],
  );

  if (!visible) return null;

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  };

  const selectAllVisible = () => setSelectedTaskIds(projectTasks.map((task: any) => task.id));
  const clearSelection = () => setSelectedTaskIds([]);

  const applyBulkUpdate = async () => {
    if (!selectedTasks.length) return toast.error("Select at least one task first.");
    const updates: Record<string, unknown> = {};
    if (bulkStatus !== "no-change") updates.status = bulkStatus;
    if (bulkPriority !== "no-change") updates.priority = bulkPriority;
    if (bulkAssignee !== "no-change") updates.assignee = bulkAssignee === "unassigned" ? "" : bulkAssignee;
    if (!Object.keys(updates).length) return toast.error("Choose at least one action to apply.");

    for (const task of selectedTasks) {
      await updateTask.mutateAsync({ id: task.id, ...updates });
    }

    toast.success(`Updated ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}.`);
    setBulkStatus("no-change");
    setBulkPriority("no-change");
    setBulkAssignee("no-change");
  };

  const deleteSelected = async () => {
    if (!selectedTasks.length) return toast.error("Select at least one task first.");
    const ok = window.confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}? This action cannot be undone.`);
    if (!ok) return;

    for (const task of selectedTasks) {
      await deleteTask.mutateAsync(task.id);
    }

    toast.success(`Deleted ${selectedTasks.length} selected task${selectedTasks.length > 1 ? "s" : ""}.`);
    clearSelection();
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 rounded-full shadow-lg">
            <CheckSquare className="h-4 w-4" /> Project Task Actions
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Project Task Bulk Actions</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
              <Select value={selectedProjectId} onValueChange={(value) => { setSelectedProjectId(value); setSelectedTaskIds([]); }}>
                <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2 text-sm">
                <Badge variant="secondary">{projectTasks.length} visible tasks</Badge>
                <Badge>{selectedTasks.length} selected</Badge>
                <Button variant="outline" size="sm" onClick={selectAllVisible}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue placeholder="Change status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-change">Status: no change</SelectItem>
                  {taskStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/-/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bulkPriority} onValueChange={setBulkPriority}>
                <SelectTrigger><SelectValue placeholder="Change priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-change">Priority: no change</SelectItem>
                  {taskPriorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
                <SelectTrigger><SelectValue placeholder="Change owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-change">Owner: no change</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="gap-2" onClick={applyBulkUpdate} disabled={!selectedTasks.length || updateTask.isPending}>
                <Wand2 className="h-4 w-4" /> Apply
              </Button>
              <Button variant="destructive" className="gap-2" onClick={deleteSelected} disabled={!selectedTasks.length || deleteTask.isPending}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-2xl border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Target Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectTasks.map((task: any) => (
                    <TableRow key={task.id} className={selectedTaskIds.includes(task.id) ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleTask(task.id)}
                          aria-label={`Select ${task.title}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="text-muted-foreground">{projectNameById.get(taskProjectId(task)) ?? "Unassigned"}</TableCell>
                      <TableCell><Badge variant="outline">{String(task.status ?? "todo").replace(/-/g, " ")}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{task.priority ?? "medium"}</Badge></TableCell>
                      <TableCell>{task.assignee || "Unassigned"}</TableCell>
                      <TableCell>{taskDueDate(task) || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!projectTasks.length ? <div className="p-8 text-center text-sm text-muted-foreground">No tasks found for the selected project.</div> : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
