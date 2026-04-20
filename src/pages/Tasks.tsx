import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Calendar, User, Tag, Clock, MessageSquare, Paperclip, PlayCircle, MoreVertical, Milestone, FileText, ChevronRight, Share2, GitBranch, LayoutGrid, Table as TableIcon, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import DynamicCustomFields from '@/components/forms/DynamicCustomFields';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useProjects, useTeamMembers, useWorkspaceSettings } from '@/hooks/useProjects';
import { getActiveCustomFields, normalizeCustomFieldValues } from '@/lib/custom-fields';
import { getTaskLifecycleStage } from '@/lib/project-activities';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

const columns = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'todo', label: 'To Do', color: 'bg-sky-500' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-indigo-500' },
  { id: 'review', label: 'Review', color: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' },
];

const priorityColor: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-warning/10 text-warning border-warning/30',
  medium: 'bg-info/10 text-info border-info/30',
  low: 'bg-muted text-muted-foreground',
};

const Tasks = () => {
  const [viewMode, setViewMode] = useState<'board' | 'table' | 'tree'>('board');
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newTimesheetEntry, setNewTimesheetEntry] = useState({ date: new Date().toISOString().slice(0, 10), member: '', hours: '8', activity: '', notes: '' });
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    status: 'todo', 
    dueDate: '', 
    assignee: '', 
    project_id: '',
    parentTaskId: '',
    phase: 'Execution',
    isMilestone: false,
    customFieldValues: {} as Record<string, string | number | boolean>,
  });

  const { data: dbTasks, isLoading } = useTasks();
  const { data: projects } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: settings } = useWorkspaceSettings();
  const taskCustomFields = useMemo(() => getActiveCustomFields(settings, 'task'), [settings]);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const projectFilterId = searchParams.get('projectId') ?? '';
  const stageFilter = searchParams.get('stage') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const filteredProject = projects?.find((project: any) => project.id === projectFilterId);

  const allTasks = useMemo(() => dbTasks ?? [], [dbTasks]);

  const visibleTasks = useMemo(
    () =>
      allTasks.filter((task: any) => {
        const matchesProject = !projectFilterId || (task.project_id ?? task.projectId) === projectFilterId;
        const matchesStage = !stageFilter || getTaskLifecycleStage(task) === stageFilter;
        const matchesStatus = !statusFilter || task.status === statusFilter;
        return matchesProject && matchesStage && matchesStatus;
      }),
    [allTasks, projectFilterId, stageFilter, statusFilter],
  );
  const parentTaskOptions = useMemo(
    () => visibleTasks.filter((task: any) => !selectedTask || task.id !== selectedTask.id),
    [selectedTask, visibleTasks],
  );
  const taskChildrenMap = useMemo(
    () => visibleTasks.reduce<Record<string, any[]>>((acc, task: any) => {
      if (!task.parentTaskId) return acc;
      acc[task.parentTaskId] = acc[task.parentTaskId] ?? [];
      acc[task.parentTaskId].push(task);
      return acc;
    }, {}),
    [visibleTasks],
  );
  const rootTasks = useMemo(
    () => visibleTasks.filter((task: any) => !task.parentTaskId || !visibleTasks.some((candidate: any) => candidate.id === task.parentTaskId)),
    [visibleTasks],
  );
  const flattenedTasks = useMemo(() => {
    const ordered: Array<{ task: any; level: number }> = [];
    const appendTask = (task: any, level: number) => {
      ordered.push({ task, level });
      if (collapsedTaskIds.includes(task.id)) return;
      (taskChildrenMap[task.id] ?? []).forEach((child) => appendTask(child, level + 1));
    };
    rootTasks.forEach((task) => appendTask(task, 0));
    return ordered;
  }, [collapsedTaskIds, rootTasks, taskChildrenMap]);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setNewTask((current) => ({
      ...current,
      customFieldValues: normalizeCustomFieldValues(taskCustomFields, current.customFieldValues),
    }));
  }, [taskCustomFields]);

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask.mutateAsync(newTask);
      toast.success('Task created successfully');
      setDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assignee: '', project_id: '', parentTaskId: '', phase: 'Execution', isMilestone: false, customFieldValues: normalizeCustomFieldValues(taskCustomFields, {}) });
    } catch { toast.error('Create failed'); }
  };

  const handleUpdate = async () => {
    if (!selectedTask) return;
    try {
      await updateTask.mutateAsync(selectedTask);
      toast.success('Changes saved');
      setIsEditing(false);
    } catch { toast.error('Update failed'); }
  };

  const openTaskDetail = (task: any) => {
    setSelectedTask({ ...task, customFieldValues: normalizeCustomFieldValues(taskCustomFields, task.customFieldValues) });
    setNewTimesheetEntry({ date: new Date().toISOString().slice(0, 10), member: task.assignee || '', hours: '8', activity: '', notes: '' });
    setTaskDetailOpen(true);
    setIsEditing(true);
  };

  const openCreateSubtask = (parentTask: any) => {
    setNewTask({
      title: '',
      description: '',
      priority: parentTask.priority ?? 'medium',
      status: parentTask.status ?? 'todo',
      dueDate: parentTask.due_date ?? parentTask.dueDate ?? '',
      assignee: parentTask.assignee ?? '',
      project_id: parentTask.project_id ?? parentTask.projectId ?? '',
      parentTaskId: parentTask.id,
      phase: parentTask.phase ?? 'Execution',
      isMilestone: false,
      customFieldValues: normalizeCustomFieldValues(taskCustomFields, {}),
    });
    setDialogOpen(true);
  };

  const addTimesheetEntry = () => {
    if (!selectedTask || !newTimesheetEntry.activity.trim()) return;
    const entry = {
      id: `timesheet-${Date.now()}`,
      date: newTimesheetEntry.date,
      member: newTimesheetEntry.member || selectedTask.assignee || 'Unassigned',
      hours: Number(newTimesheetEntry.hours || 0),
      activity: newTimesheetEntry.activity.trim(),
      notes: newTimesheetEntry.notes.trim(),
    };
    setSelectedTask((current: any) => ({
      ...current,
      timesheetEntries: [...(current?.timesheetEntries || []), entry],
    }));
    setNewTimesheetEntry({ date: new Date().toISOString().slice(0, 10), member: selectedTask.assignee || '', hours: '8', activity: '', notes: '' });
    toast.success('Daily timesheet entry added');
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) await updateTask.mutateAsync({ id: taskId, status: newStatus });
  };

  return (
    <AppLayout>
      <AppHeader title="Tasks" subtitle="Enterprise Workload Management" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Workspace Pipeline</h2>
            <Badge variant="secondary" className="rounded-full">{visibleTasks.length}</Badge>
            {filteredProject ? <Button variant="outline" size="sm" onClick={() => setSearchParams({}, { replace: true })}>{filteredProject.name}</Button> : null}
            {stageFilter ? <Button variant="outline" size="sm" onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('stage'); return next; }, { replace: true })}>{stageFilter}</Button> : null}
            {statusFilter ? <Button variant="outline" size="sm" onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('status'); return next; }, { replace: true })}>{statusFilter}</Button> : null}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border bg-muted/30 p-1">
              <Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('board')}><LayoutGrid className="h-4 w-4 mr-2" />Board</Button>
              <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('table')}><TableIcon className="h-4 w-4 mr-2" />Table</Button>
              <Button variant={viewMode === 'tree' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('tree')}><GitBranch className="h-4 w-4 mr-2" />Tree</Button>
            </div>
            <Button variant="outline" size="sm"><Share2 className="h-4 w-4 mr-2" /> Export</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground shadow-glow">
                  <Plus className="h-4 w-4 mr-2" /> New Task / Milestone
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl">Create Enterprise Task</DialogTitle>
                  <CardDescription>Assign to projects, set milestones, and define schedule.</CardDescription>
                </DialogHeader>
                
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Basic Info</label>
                      <Input placeholder="Title *" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
                      <Textarea placeholder="Scope of work..." value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} rows={4} />
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 border rounded-xl bg-muted/20">
                      <input 
                        type="checkbox" 
                        checked={newTask.isMilestone} 
                        onChange={e => setNewTask(t => ({ ...t, isMilestone: e.target.checked }))}
                        className="h-4 w-4 rounded border-primary"
                      />
                      <div>
                        <p className="text-sm font-bold">Mark as Milestone</p>
                        <p className="text-[10px] text-muted-foreground">Zero-duration task for the project schedule</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Planning</label>
                      <Select value={newTask.project_id} onValueChange={v => setNewTask(t => ({ ...t, project_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select Project *" /></SelectTrigger>
                        <SelectContent>{projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>

                      <Select value={newTask.parentTaskId || '__none__'} onValueChange={v => setNewTask(t => ({ ...t, parentTaskId: v === '__none__' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Parent Task (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Main task</SelectItem>
                          {visibleTasks
                            .filter((task: any) => !newTask.project_id || (task.project_id ?? task.projectId) === newTask.project_id)
                            .map((task: any) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      
                      <Select value={newTask.phase} onValueChange={v => setNewTask(t => ({ ...t, phase: v }))}>
                        <SelectTrigger><SelectValue placeholder="Project Phase" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Discovery">Discovery</SelectItem>
                          <SelectItem value="Planning">Planning</SelectItem>
                          <SelectItem value="Execution">Execution</SelectItem>
                          <SelectItem value="Testing">Testing</SelectItem>
                          <SelectItem value="Deployment">Deployment</SelectItem>
                        </SelectContent>
                      </Select>
                      
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input type="date" value={newTask.dueDate} onChange={e => setNewTask(t => ({ ...t, dueDate: e.target.value }))} className="text-xs" />
                        <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Input placeholder="Assignee Resource" value={newTask.assignee} onChange={e => setNewTask(t => ({ ...t, assignee: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DynamicCustomFields
                  fields={taskCustomFields}
                  values={normalizeCustomFieldValues(taskCustomFields, newTask.customFieldValues)}
                  onChange={(key, value) => setNewTask((current) => ({ ...current, customFieldValues: { ...current.customFieldValues, [key]: value } }))}
                />
                
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createTask.isPending} className="gradient-primary text-primary-foreground px-8">Create Work Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {viewMode === 'board' ? (
        <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide">
          {columns.map(col => (
            <div key={col.id} className="min-w-[320px] w-[320px] bg-muted/30 rounded-3xl p-4 flex flex-col h-[calc(100vh-280px)]" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", col.color)} />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{col.label}</span>
                </div>
                <Badge variant="secondary" className="rounded-md font-mono">{visibleTasks.filter((t: any) => t.status === col.id).length}</Badge>
              </div>
              
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {visibleTasks.filter((t: any) => t.status === col.id).map((task: any) => (
                  <Card 
                    key={task.id} 
                    draggable 
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)} 
                    onClick={() => openTaskDetail(task)} 
                    className="glass hover:shadow-glow transition-all duration-300 cursor-pointer group border-transparent hover:border-primary/30"
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-bold group-hover:text-primary transition-colors leading-snug">{task.title}</p>
                          {task.isMilestone && <Milestone className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-muted/20">
                        <Badge variant="outline" className={cn("text-[9px] uppercase font-bold tracking-tighter", priorityColor[task.priority])}>
                          {task.priority}
                        </Badge>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {task.assignee && <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">{task.assignee[0]}</div>}
                          <span className="text-[9px] font-medium">{task.due_date || task.dueDate || 'No date'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="ghost" className="w-full border-2 border-dashed border-muted/50 text-muted-foreground hover:text-primary h-12 rounded-xl text-xs" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>
            </div>
          ))}
        </div>
        ) : viewMode === 'table' ? (
          <Card className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Task</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Project</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Due</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Assignee</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flattenedTasks.map(({ task, level }) => {
                    const children = taskChildrenMap[task.id] ?? [];
                    const collapsed = collapsedTaskIds.includes(task.id);
                    return (
                      <tr key={task.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
                            {children.length ? (
                              <button type="button" onClick={() => setCollapsedTaskIds((prev) => collapsed ? prev.filter((item) => item !== task.id) : [...prev, task.id])}>
                                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            ) : <span className="w-4" />}
                            <button type="button" className="text-left font-medium hover:text-primary" onClick={() => openTaskDetail(task)}>
                              {task.title}
                            </button>
                            {task.parentTaskId ? <Badge variant="outline">Subtask</Badge> : <Badge variant="secondary">Main</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{projects?.find((project: any) => project.id === (task.project_id ?? task.projectId))?.name || 'Unassigned'}</td>
                        <td className="px-4 py-3"><Badge variant="outline">{task.status}</Badge></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{task.due_date || task.dueDate || 'No date'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{task.assignee || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openTaskDetail(task)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => openCreateSubtask(task)}>Add Subtask</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {rootTasks.map((task: any) => (
              <Card key={task.id} className="glass">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button type="button" className="text-left text-lg font-semibold hover:text-primary" onClick={() => openTaskDetail(task)}>{task.title}</button>
                      <p className="mt-1 text-sm text-muted-foreground">{task.description || 'No description entered yet.'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Main Task</Badge>
                      <Button size="sm" variant="outline" onClick={() => openCreateSubtask(task)}>Add Subtask</Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(taskChildrenMap[task.id] ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No subtasks yet.</div>
                    ) : (
                      (taskChildrenMap[task.id] ?? []).map((child: any) => (
                        <button key={child.id} type="button" className="rounded-2xl border p-4 text-left hover:bg-muted/20" onClick={() => openTaskDetail(child)}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{child.title}</p>
                            <Badge variant="outline">{child.status}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{child.due_date || child.dueDate || 'No due date'} | {child.assignee || 'Unassigned'}</p>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={taskDetailOpen} onOpenChange={setTaskDetailOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          {selectedTask && (
            <>
              <div className="p-6 border-b bg-muted/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl">
                    {selectedTask.isMilestone ? <Milestone className="h-6 w-6 text-primary" /> : <PlayCircle className="h-6 w-6 text-primary" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
                      ID: {selectedTask.id?.substring(0, 8)} • {selectedTask.phase || 'Execution Phase'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant={isEditing ? "default" : "outline"} size="sm" onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}>
                    {isEditing ? 'Save Work' : 'Open Editor'}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 rounded-xl border border-destructive/20" onClick={() => { deleteTaskMutation.mutate(selectedTask.id); setTaskDetailOpen(false); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="grid h-full grid-cols-1 xl:grid-cols-12">
                  <div className="space-y-8 border-b p-6 xl:col-span-8 xl:border-b-0 xl:border-r xl:p-8">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Description & Scope
                      </h3>
                      {isEditing ? (
                        <Textarea 
                          value={selectedTask.description} 
                          onChange={e => setSelectedTask({ ...selectedTask, description: e.target.value })} 
                          className="min-h-[200px] text-sm leading-relaxed" 
                          placeholder="Describe the technical scope and requirements..."
                        />
                      ) : (
                        <div className="bg-muted/10 p-6 rounded-2xl border border-muted/50">
                          <p className="text-sm leading-relaxed">{selectedTask.description || 'No detailed scope provided for this work item.'}</p>
                        </div>
                      )}
                    </div>

                    <Tabs defaultValue="activity" className="w-full">
                      <TabsList className="bg-muted/20 p-1 rounded-xl">
                        <TabsTrigger value="activity" className="flex-1 rounded-lg text-xs font-bold">Activity Feed</TabsTrigger>
                        <TabsTrigger value="files" className="flex-1 rounded-lg text-xs font-bold">Files ({selectedTask.files?.length || 0})</TabsTrigger>
                        <TabsTrigger value="timesheets" className="flex-1 rounded-lg text-xs font-bold">Timesheets ({selectedTask.timesheetEntries?.length || 0})</TabsTrigger>
                        <TabsTrigger value="checklists" className="flex-1 rounded-lg text-xs font-bold">Checklist</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="activity" className="pt-6">
                        <div className="space-y-6">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs">U</div>
                            <div className="flex-1 space-y-2">
                              <div className="bg-muted/20 p-4 rounded-2xl border border-muted/30">
                                <p className="text-xs">Changed status from <span className="font-bold">To Do</span> to <span className="font-bold">In Progress</span></p>
                                <p className="text-[10px] text-muted-foreground mt-1">2 hours ago</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-4">
                            <Input placeholder="Post a comment or update..." className="rounded-xl h-11" />
                            <Button className="h-11 px-6 rounded-xl">Post</Button>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="files" className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2 bg-muted/10">
                            <Paperclip className="h-6 w-6 text-muted-foreground" />
                            <p className="text-xs font-bold">Drop files to attach</p>
                            <Button variant="ghost" size="sm" className="text-[10px]">Browse Storage</Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="timesheets" className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-muted/40 bg-muted/10 p-4 sm:grid-cols-2">
                          <Input type="date" value={newTimesheetEntry.date} onChange={e => setNewTimesheetEntry((current) => ({ ...current, date: e.target.value }))} />
                          <Select value={newTimesheetEntry.member} onValueChange={value => setNewTimesheetEntry((current) => ({ ...current, member: value }))}>
                            <SelectTrigger><SelectValue placeholder="Team member" /></SelectTrigger>
                            <SelectContent>
                              {teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input type="number" min="0.5" step="0.5" placeholder="Hours" value={newTimesheetEntry.hours} onChange={e => setNewTimesheetEntry((current) => ({ ...current, hours: e.target.value }))} />
                          <Input placeholder="Daily activity" value={newTimesheetEntry.activity} onChange={e => setNewTimesheetEntry((current) => ({ ...current, activity: e.target.value }))} />
                          <div className="col-span-2 flex gap-3">
                            <Textarea rows={2} placeholder="Notes" value={newTimesheetEntry.notes} onChange={e => setNewTimesheetEntry((current) => ({ ...current, notes: e.target.value }))} />
                            <Button className="self-end" onClick={addTimesheetEntry}>Add Entry</Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(selectedTask.timesheetEntries?.length || 0) === 0 ? (
                            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No daily task entries yet.</div>
                          ) : (
                            selectedTask.timesheetEntries.map((entry: any) => (
                              <div key={entry.id} className="rounded-2xl border p-4 bg-muted/10">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold">{entry.activity}</p>
                                    <p className="text-[11px] text-muted-foreground">{entry.member} • {entry.date}</p>
                                  </div>
                                  <Badge variant="secondary">{entry.hours}h</Badge>
                                </div>
                                {entry.notes && <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="space-y-8 bg-muted/10 p-6 xl:col-span-4 xl:p-8">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <User className="h-3 w-3" /> Responsibility
                        </span>
                        {isEditing ? (
                          <Input value={selectedTask.assignee || ''} onChange={e => setSelectedTask({...selectedTask, assignee: e.target.value})} className="h-10 text-xs rounded-xl" />
                        ) : (
                          <div className="flex items-center gap-3 bg-background p-3 rounded-xl border border-muted/50">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{selectedTask.assignee ? selectedTask.assignee[0] : '?'}</div>
                            <span className="text-sm font-bold">{selectedTask.assignee || 'Unassigned'}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Clock className="h-3 w-3" /> Schedule Control
                        </span>
                        <div className="space-y-3 bg-background p-4 rounded-2xl border border-muted/50">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Deadline</span>
                            {isEditing ? (
                              <Input type="date" value={selectedTask.due_date || selectedTask.dueDate || ''} onChange={e => setSelectedTask({...selectedTask, due_date: e.target.value})} className="h-8 w-32 text-[10px] rounded-lg" />
                            ) : (
                              <span className="text-xs font-bold">{selectedTask.due_date || selectedTask.dueDate || 'Not set'}</span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Priority</span>
                            {isEditing ? (
                              <Select value={selectedTask.priority} onValueChange={v => setSelectedTask({...selectedTask, priority: v})}>
                                <SelectTrigger className="h-8 w-32 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={cn("text-[8px] uppercase font-bold", priorityColor[selectedTask.priority])}>{selectedTask.priority}</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <GitBranch className="h-3 w-3" /> Hierarchy
                        </span>
                        <div className="space-y-3 bg-background p-4 rounded-2xl border border-muted/50">
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">Project</span>
                            {isEditing ? (
                              <Select value={selectedTask.project_id ?? selectedTask.projectId ?? '__none__'} onValueChange={v => setSelectedTask({ ...selectedTask, project_id: v === '__none__' ? '' : v, projectId: v === '__none__' ? '' : v })}>
                                <SelectTrigger className="h-8 w-40 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">No project</SelectItem>
                                  {projects?.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs font-bold">{projects?.find((project: any) => project.id === (selectedTask.project_id ?? selectedTask.projectId))?.name || 'No project'}</span>
                            )}
                          </div>
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">Parent</span>
                            {isEditing ? (
                              <Select value={selectedTask.parentTaskId || '__none__'} onValueChange={v => setSelectedTask({ ...selectedTask, parentTaskId: v === '__none__' ? '' : v })}>
                                <SelectTrigger className="h-8 w-40 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Main task</SelectItem>
                                  {parentTaskOptions
                                    .filter((task: any) => task.id !== selectedTask.id && (!selectedTask.project_id || (task.project_id ?? task.projectId) === (selectedTask.project_id ?? selectedTask.projectId)))
                                    .map((task: any) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs font-bold">{visibleTasks.find((task: any) => task.id === selectedTask.parentTaskId)?.title || 'Main task'}</span>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openCreateSubtask(selectedTask)}>Add Subtask</Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <ChevronRight className="h-3 w-3" /> Status Pipeline
                        </span>
                        <Select value={selectedTask.status} onValueChange={v => setSelectedTask({...selectedTask, status: v})} disabled={!isEditing}>
                          <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <DynamicCustomFields
                        fields={taskCustomFields}
                        values={normalizeCustomFieldValues(taskCustomFields, selectedTask.customFieldValues)}
                        disabled={!isEditing}
                        columnsClassName="grid gap-3"
                        onChange={(key, value) => setSelectedTask({ ...selectedTask, customFieldValues: { ...(selectedTask.customFieldValues ?? {}), [key]: value } })}
                      />
                    </div>

                    <Card className="shadow-none bg-primary/5 border-primary/10 mt-6">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-[10px] font-bold uppercase text-primary">Progress Tracking</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-3">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>Task Completion</span>
                          <span>{selectedTask.status === 'done' ? '100%' : '35%'}</span>
                        </div>
                        <Progress value={selectedTask.status === 'done' ? 100 : 35} className="h-2" />
                        <p className="text-[9px] text-muted-foreground">Based on sub-tasks and checklists completion.</p>
                      </CardContent>
                    </Card>

                    <Card className="shadow-none bg-muted/20 border-muted/30 mt-6">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">Subtasks</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-2">
                        {(taskChildrenMap[selectedTask.id] ?? []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No subtasks linked yet.</p>
                        ) : (
                          (taskChildrenMap[selectedTask.id] ?? []).map((child: any) => (
                            <button key={child.id} type="button" className="w-full rounded-xl border p-3 text-left hover:bg-background/80" onClick={() => openTaskDetail(child)}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold">{child.title}</span>
                                <Badge variant="outline" className="text-[9px]">{child.status}</Badge>
                              </div>
                            </button>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Tasks;
