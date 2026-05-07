import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, FolderKanban, Save, SquareCheckBig, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProjects, useTasks, useTeamMembers, useUpdateProject, useUpdateTask } from "@/hooks/useProjects";
import type { WorkspaceProject, WorkspaceTask } from "@/lib/workspace-store";
import { toast } from "sonner";

const GLOBAL_POLISH_ID = "workspace-interaction-polish-style";

const globalPolishCss = `
  :root {
    --ui-control-height: 2.55rem;
    --ui-card-gap: 0.9rem;
    --ui-card-pad: 1rem;
  }

  main .grid,
  main .flex { min-width: 0; }
  main .card,
  main [class*="rounded-2xl"],
  main [class*="rounded-3xl"] { overflow-wrap: anywhere; }
  main .glass,
  main .workspace-card,
  main [class*="bg-card"] { border-color: hsl(var(--border) / 0.72) !important; }
  main [class*="rounded-3xl"][class*="p-4"],
  main [class*="rounded-2xl"][class*="p-4"],
  main [class*="bg-card"][class*="p-4"] { padding: var(--ui-card-pad) !important; }
  main .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem !important; }
  main .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.9rem !important; }
  main .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.05rem !important; }
  main .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.15rem !important; }

  main input,
  main textarea,
  main [role="combobox"] {
    min-height: var(--ui-control-height);
    border-radius: 0.85rem !important;
    border-color: hsl(var(--border) / 0.85) !important;
    background: hsl(var(--background)) !important;
  }
  main input:focus,
  main textarea:focus,
  main [role="combobox"]:focus,
  main [data-state="open"][role="combobox"] {
    border-color: hsl(var(--primary) / 0.55) !important;
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12) !important;
  }
  main button { border-radius: 0.8rem; }
  main table { border-collapse: separate !important; border-spacing: 0 !important; }
  main thead th { background: hsl(var(--muted) / 0.72); border-bottom: 1px solid hsl(var(--border) / 0.9); }
  main tbody td,
  main tbody th { border-bottom: 1px solid hsl(var(--border) / 0.58); }
  main tbody tr:hover td { background: hsl(var(--muted) / 0.24); }

  main .kanban-column,
  main [data-board-column="true"] { min-width: 21rem; max-width: 22.5rem; padding: 0.9rem !important; gap: 0.85rem; }
  main .kanban-card,
  main [data-board-card="true"] { padding: 0.95rem !important; border: 1px solid hsl(var(--border) / 0.72) !important; box-shadow: 0 8px 18px -14px rgb(15 23 42 / 0.45) !important; }

  .workspace-clickable-record {
    cursor: pointer !important;
    color: hsl(var(--primary)) !important;
    font-weight: 700 !important;
    text-decoration: none !important;
  }
  .workspace-clickable-record:hover { text-decoration: underline !important; }
  .workspace-polished-toolbar,
  main [class*="lg:grid-cols-"][class*="bg-card"][class*="p-3"] {
    align-items: center;
    gap: 0.75rem !important;
    border-radius: 1.15rem !important;
    background: hsl(var(--card) / 0.94) !important;
    box-shadow: 0 8px 18px -18px rgb(15 23 42 / 0.45);
  }
  main [class*="grid"][class*="gap-2"] { gap: 0.75rem !important; }
  main [class*="min-w-[320px]"] { min-width: 21rem !important; }
`;

const normalize = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
const compact = (value?: string | null) => normalize(value).replace(/[^a-z0-9]+/g, "");
const snapshot = (value: unknown) => JSON.stringify(value ?? null);

const taskProjectId = (task?: Partial<WorkspaceTask> | null) => task?.project_id ?? task?.projectId ?? "";
const taskDueDate = (task?: Partial<WorkspaceTask> | null) => task?.due_date ?? task?.dueDate ?? "";
const taskEndDate = (task?: Partial<WorkspaceTask> | null) => task?.end_date ?? taskDueDate(task);

type TaskFormMode = "quick" | "full";
type ProjectFormMode = "quick" | "full";

const WorkspaceInteractionPolish = () => {
  const location = useLocation();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const updateProject = useUpdateProject();
  const updateTask = useUpdateTask();
  const [projectOpen, setProjectOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>("quick");
  const [taskFormMode, setTaskFormMode] = useState<TaskFormMode>("quick");
  const [projectDraft, setProjectDraft] = useState<WorkspaceProject | null>(null);
  const [taskDraft, setTaskDraft] = useState<WorkspaceTask | null>(null);
  const originalProjectSnapshot = useRef("");
  const originalTaskSnapshot = useRef("");

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const taskProjectOptions = useMemo(() => projects.filter((project) => project.status !== "archived"), [projects]);
  const parentTaskOptions = useMemo(() => tasks.filter((task) => task.id !== taskDraft?.id && (!taskDraft || !taskProjectId(taskDraft) || taskProjectId(task) === taskProjectId(taskDraft))), [taskDraft, tasks]);
  const projectDirty = Boolean(projectDraft) && snapshot(projectDraft) !== originalProjectSnapshot.current;
  const taskDirty = Boolean(taskDraft) && snapshot(taskDraft) !== originalTaskSnapshot.current;

  const openProject = (id: string, mode: ProjectFormMode = "quick") => {
    const project = projectById.get(id);
    if (!project) return;
    setProjectDraft({ ...project });
    originalProjectSnapshot.current = snapshot({ ...project });
    setProjectFormMode(mode);
    setProjectOpen(true);
  };

  const openTask = (id: string, mode: TaskFormMode = "quick") => {
    const task = taskById.get(id);
    if (!task) return;
    setTaskDraft({ ...task });
    originalTaskSnapshot.current = snapshot({ ...task });
    setTaskFormMode(mode);
    setTaskOpen(true);
  };

  const confirmDiscard = (type: "project" | "task") => window.confirm(`You have unsaved ${type} changes. Save before moving to another record or closing. Discard changes?`);

  const closeProjectForm = () => {
    if (projectDirty && !confirmDiscard("project")) return false;
    setProjectOpen(false);
    setProjectDraft(null);
    setProjectFormMode("quick");
    originalProjectSnapshot.current = "";
    return true;
  };

  const closeTaskForm = () => {
    if (taskDirty && !confirmDiscard("task")) return false;
    setTaskOpen(false);
    setTaskDraft(null);
    setTaskFormMode("quick");
    originalTaskSnapshot.current = "";
    return true;
  };

  const browseProject = (direction: -1 | 1) => {
    if (!projectDraft) return;
    if (projectDirty && !confirmDiscard("project")) return;
    const currentIndex = projects.findIndex((project) => project.id === projectDraft.id);
    if (currentIndex < 0) return;
    const nextProject = projects[currentIndex + direction];
    if (!nextProject) return toast.info(direction > 0 ? "This is the last project." : "This is the first project.");
    openProject(nextProject.id, projectFormMode);
  };

  const browseTask = (direction: -1 | 1) => {
    if (!taskDraft) return;
    if (taskDirty && !confirmDiscard("task")) return;
    const currentIndex = tasks.findIndex((task) => task.id === taskDraft.id);
    if (currentIndex < 0) return;
    const nextTask = tasks[currentIndex + direction];
    if (!nextTask) return toast.info(direction > 0 ? "This is the last task." : "This is the first task.");
    openTask(nextTask.id, taskFormMode);
  };

  useEffect(() => {
    if (document.getElementById(GLOBAL_POLISH_ID)) return;
    const style = document.createElement("style");
    style.id = GLOBAL_POLISH_ID;
    style.textContent = globalPolishCss;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const projectId = new URLSearchParams(location.search).get("projectId");
    const taskId = new URLSearchParams(location.search).get("taskId");
    if (location.pathname === "/projects" && projectId) openProject(projectId, "full");
    if (location.pathname === "/tasks" && taskId) openTask(taskId, "full");
  }, [location.pathname, location.search, projectById, taskById]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const url = new URL(href, window.location.origin);
      const projectId = url.searchParams.get("projectId");
      const taskId = url.searchParams.get("taskId");
      if (url.pathname === "/projects" && projectId) {
        event.preventDefault();
        event.stopPropagation();
        if (projectDirty && !confirmDiscard("project")) return;
        openProject(projectId, "full");
      }
      if (url.pathname === "/tasks" && taskId) {
        event.preventDefault();
        event.stopPropagation();
        if (taskDirty && !confirmDiscard("task")) return;
        openTask(taskId, "full");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [projectById, taskById, projectDirty, taskDirty]);

  useEffect(() => {
    const decorate = () => {
      const projectNameMap = new Map(projects.map((project) => [compact(project.name), project.id]));
      const taskTitleMap = new Map(tasks.map((task) => [compact(task.title), task.id]));
      const nodes = Array.from(document.querySelectorAll("main td, main th, main span, main p, main h2, main h3, main button")) as HTMLElement[];
      nodes.slice(0, 700).forEach((node) => {
        if (node.dataset.workspacePolished === "true") return;
        if (node.closest("[role='dialog']")) return;
        const key = compact(node.textContent ?? "");
        const projectId = projectNameMap.get(key);
        const taskId = taskTitleMap.get(key);
        if (!projectId && !taskId) return;
        node.dataset.workspacePolished = "true";
        node.classList.add("workspace-clickable-record");
        node.title = projectId ? "Open project form" : "Open task form";
        node.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (projectId) {
            if (projectDirty && !confirmDiscard("project")) return;
            openProject(projectId, "quick");
          } else {
            if (taskDirty && !confirmDiscard("task")) return;
            openTask(taskId as string, "quick");
          }
        });
      });
    };

    const timers = [120, 650, 1500].map((delay) => window.setTimeout(decorate, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [location.pathname, location.search, projects, tasks, projectDirty, taskDirty]);

  const saveProject = async () => {
    if (!projectDraft) return;
    await updateProject.mutateAsync(projectDraft);
    toast.success("Project saved successfully. Form closed.");
    originalProjectSnapshot.current = snapshot(projectDraft);
    setProjectOpen(false);
    setProjectDraft(null);
    setProjectFormMode("quick");
  };

  const saveTask = async () => {
    if (!taskDraft) return;
    await updateTask.mutateAsync(taskDraft);
    toast.success("Task saved successfully. Form closed.");
    originalTaskSnapshot.current = snapshot(taskDraft);
    setTaskOpen(false);
    setTaskDraft(null);
    setTaskFormMode("quick");
  };

  const updateProjectDraft = (updates: Partial<WorkspaceProject>) => setProjectDraft((current) => current ? { ...current, ...updates } : current);
  const updateTaskDraft = (updates: Partial<WorkspaceTask>) => setTaskDraft((current) => current ? { ...current, ...updates } : current);

  return (
    <>
      <Dialog open={projectOpen} onOpenChange={(open) => { if (!open) closeProjectForm(); else setProjectOpen(true); }}>
        <DialogContent className={`${projectFormMode === "full" ? "max-w-6xl" : "max-w-3xl"} gap-0 overflow-hidden p-0`}>
          {projectDraft ? (
            <>
              <DialogHeader className="border-b bg-muted/30 px-6 py-4">
                <DialogTitle className="flex items-center justify-between gap-3 text-xl">
                  <span className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /> {projectFormMode === "full" ? "Project Full Form" : "Project Quick Form"}</span>
                  <div className="flex items-center gap-2"><Badge variant={projectDirty ? "default" : "outline"}>{projectDirty ? "Unsaved changes" : "Saved"}</Badge><Badge variant="outline">{projectDraft.id?.slice(0, 8)}</Badge></div>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[76vh] overflow-y-auto p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/20 p-3">
                  <p className="text-sm text-muted-foreground">Browse projects inside the form. Unsaved changes require confirmation before moving.</p>
                  <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => browseProject(-1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" onClick={() => browseProject(1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Project Name</label><Input value={projectDraft.name ?? ""} onChange={(event) => updateProjectDraft({ name: event.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Description</label><Textarea rows={projectFormMode === "full" ? 6 : 4} value={projectDraft.description ?? ""} onChange={(event) => updateProjectDraft({ description: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Status</label><Select value={projectDraft.status ?? "active"} onValueChange={(value) => updateProjectDraft({ status: value as WorkspaceProject["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="on-hold">On hold</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="at-risk">At risk</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Priority</label><Select value={projectDraft.priority ?? "medium"} onValueChange={(value) => updateProjectDraft({ priority: value as WorkspaceProject["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Start Date</label><Input type="date" value={projectDraft.start_date ?? projectDraft.startDate ?? ""} onChange={(event) => updateProjectDraft({ start_date: event.target.value, startDate: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">End Date</label><Input type="date" value={projectDraft.end_date ?? projectDraft.endDate ?? ""} onChange={(event) => updateProjectDraft({ end_date: event.target.value, endDate: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Department</label><Input value={projectDraft.department ?? ""} onChange={(event) => updateProjectDraft({ department: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Budget</label><Input value={projectDraft.budget ?? ""} onChange={(event) => updateProjectDraft({ budget: event.target.value })} /></div>
                </div>

                {projectFormMode === "full" ? (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <div><p className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">Full Project Planning</p><p className="text-xs text-muted-foreground">Edit the selected project record directly in this form without navigating to the project page.</p></div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Project Nature</label><Input value={projectDraft.projectNature ?? ""} onChange={(event) => updateProjectDraft({ projectNature: event.target.value })} placeholder="Implementation, PMO, operations, system delivery..." /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Namespace</label><Input value={projectDraft.namespace ?? ""} onChange={(event) => updateProjectDraft({ namespace: event.target.value })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Progress %</label><Input type="number" min="0" max="100" value={projectDraft.progress ?? 0} onChange={(event) => updateProjectDraft({ progress: Number(event.target.value || 0) })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Project Manager</label><Input value={(projectDraft as any).projectManager ?? ""} onChange={(event) => updateProjectDraft({ ...( { projectManager: event.target.value } as any ) })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Sponsor</label><Input value={(projectDraft as any).sponsor ?? ""} onChange={(event) => updateProjectDraft({ ...( { sponsor: event.target.value } as any ) })} /></div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Tags</label><Textarea rows={3} value={(projectDraft.tags ?? []).join(", ")} onChange={(event) => updateProjectDraft({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Enter tags separated by commas" /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Key Notes</label><Textarea rows={3} value={(projectDraft as any).notes ?? ""} onChange={(event) => updateProjectDraft({ ...( { notes: event.target.value } as any ) })} placeholder="Governance notes, delivery assumptions, client notes..." /></div>
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                {projectFormMode === "quick" ? <Button variant="outline" onClick={() => setProjectFormMode("full")}>Open Full Project Form</Button> : <Button variant="outline" onClick={() => setProjectFormMode("quick")}>Back to Quick Form</Button>}
                <Button variant="outline" onClick={closeProjectForm}>Cancel</Button>
                <Button onClick={saveProject} disabled={updateProject.isPending}><Save className="mr-2 h-4 w-4" />{updateProject.isPending ? "Saving..." : "Save & Close"}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={(open) => { if (!open) closeTaskForm(); else setTaskOpen(true); }}>
        <DialogContent className={`${taskFormMode === "full" ? "max-w-6xl" : "max-w-3xl"} gap-0 overflow-hidden p-0`}>
          {taskDraft ? (
            <>
              <DialogHeader className="border-b bg-muted/30 px-6 py-4">
                <DialogTitle className="flex items-center justify-between gap-3 text-xl">
                  <span className="flex items-center gap-2"><SquareCheckBig className="h-5 w-5 text-primary" /> {taskFormMode === "full" ? "Task Full Form" : "Task Quick Form"}</span>
                  <div className="flex items-center gap-2"><Badge variant={taskDirty ? "default" : "outline"}>{taskDirty ? "Unsaved changes" : "Saved"}</Badge><Badge variant="outline">{taskDraft.id?.slice(0, 8)}</Badge></div>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[76vh] overflow-y-auto p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/20 p-3">
                  <p className="text-sm text-muted-foreground">Browse tasks inside the form. Unsaved changes require confirmation before moving.</p>
                  <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => browseTask(-1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" onClick={() => browseTask(1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Task Name</label><Input value={taskDraft.title ?? ""} onChange={(event) => updateTaskDraft({ title: event.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Description</label><Textarea rows={taskFormMode === "full" ? 6 : 4} value={taskDraft.description ?? ""} onChange={(event) => updateTaskDraft({ description: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Status</label><Select value={taskDraft.status ?? "todo"} onValueChange={(value) => updateTaskDraft({ status: value as WorkspaceTask["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="backlog">Backlog</SelectItem><SelectItem value="todo">To Do</SelectItem><SelectItem value="in-progress">In Progress</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Priority</label><Select value={taskDraft.priority ?? "medium"} onValueChange={(value) => updateTaskDraft({ priority: value as WorkspaceTask["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Due Date</label><Input type="date" value={taskDueDate(taskDraft)} onChange={(event) => updateTaskDraft({ due_date: event.target.value, dueDate: event.target.value })} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Assignee</label><Select value={taskDraft.assignee || "__unassigned__"} onValueChange={(value) => updateTaskDraft({ assignee: value === "__unassigned__" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{teamMembers.map((member) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Phase</label><Input placeholder="Phase" value={taskDraft.phase ?? ""} onChange={(event) => updateTaskDraft({ phase: event.target.value })} /></div>
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-sm"><Timer className="h-4 w-4 text-primary" /> Actual Hours: {taskDraft.actualHours ?? 0}</div>
                </div>

                {taskFormMode === "full" ? (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <div><p className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">Full Task Planning</p><p className="text-xs text-muted-foreground">Edit the complete task record here without leaving the current page.</p></div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold uppercase text-muted-foreground">Project</label><Select value={taskProjectId(taskDraft) || "__none__"} onValueChange={(value) => { const project = projectById.get(value); updateTaskDraft({ project_id: value === "__none__" ? "" : value, projectId: value === "__none__" ? "" : value, projectName: project?.name ?? "", parentTaskId: undefined }); }}><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent><SelectItem value="__none__">Unassigned project</SelectItem>{taskProjectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Main / Subtask</label><Select value={taskDraft.parentTaskId || "__main__"} onValueChange={(value) => updateTaskDraft({ parentTaskId: value === "__main__" ? undefined : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__main__">Main task</SelectItem>{parentTaskOptions.map((task) => <SelectItem key={task.id} value={task.id}>Subtask of: {task.title}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Start Date</label><Input type="date" value={taskDraft.start_date ?? ""} onChange={(event) => updateTaskDraft({ start_date: event.target.value })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">End Date</label><Input type="date" value={taskEndDate(taskDraft)} onChange={(event) => updateTaskDraft({ end_date: event.target.value })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Duration</label><Input placeholder="Example: 5d" value={taskDraft.duration ?? ""} onChange={(event) => updateTaskDraft({ duration: event.target.value })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Workload Hours</label><Input type="number" min="0" value={taskDraft.workloadHours ?? 0} onChange={(event) => updateTaskDraft({ workloadHours: Number(event.target.value || 0) })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Progress %</label><Input type="number" min="0" max="100" value={taskDraft.progress ?? 0} onChange={(event) => updateTaskDraft({ progress: Number(event.target.value || 0) })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Milestone</label><Select value={taskDraft.isMilestone ? "yes" : "no"} onValueChange={(value) => updateTaskDraft({ isMilestone: value === "yes" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Task</SelectItem><SelectItem value="yes">Milestone</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Predecessors</label><Textarea rows={3} value={(taskDraft.predecessors ?? []).join(", ")} onChange={(event) => updateTaskDraft({ predecessors: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Enter predecessor IDs separated by commas" /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Tags</label><Textarea rows={3} value={(taskDraft.tags ?? []).join(", ")} onChange={(event) => updateTaskDraft({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Enter tags separated by commas" /></div>
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                {taskFormMode === "quick" ? <Button variant="outline" onClick={() => setTaskFormMode("full")}>Open Full Task Form</Button> : <Button variant="outline" onClick={() => setTaskFormMode("quick")}>Back to Quick Form</Button>}
                <Button variant="outline" onClick={closeTaskForm}>Cancel</Button>
                <Button onClick={saveTask} disabled={updateTask.isPending}><Save className="mr-2 h-4 w-4" />{updateTask.isPending ? "Saving..." : "Save & Close"}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkspaceInteractionPolish;
