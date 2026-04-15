import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, X, Calendar, User, Tag, Clock, MessageSquare, Paperclip, PlayCircle, MoreVertical, Milestone, FileText, ChevronRight, Share2 } from 'lucide-react';
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
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useProjects } from '@/hooks/useProjects';
import { tasks as mockTasks } from '@/lib/mock-data';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    status: 'todo', 
    dueDate: '', 
    assignee: '', 
    project_id: '',
    phase: 'Execution',
    isMilestone: false
  });

  const { data: dbTasks, isLoading } = useTasks();
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const allTasks = useMemo(() => {
    return dbTasks?.length ? dbTasks : mockTasks;
  }, [dbTasks]);

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask.mutateAsync(newTask);
      toast.success('Task created successfully');
      setDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assignee: '', project_id: '', phase: 'Execution', isMilestone: false });
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
    setSelectedTask({ ...task });
    setTaskDetailOpen(true);
    setIsEditing(true);
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
            <Badge variant="secondary" className="rounded-full">{allTasks.length}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
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
                
                <div className="grid grid-cols-2 gap-6 mt-4">
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
                      
                      <div className="grid grid-cols-2 gap-2">
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
                
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createTask.isPending} className="gradient-primary text-primary-foreground px-8">Create Work Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide">
          {columns.map(col => (
            <div key={col.id} className="min-w-[320px] w-[320px] bg-muted/30 rounded-3xl p-4 flex flex-col h-[calc(100vh-280px)]" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", col.color)} />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{col.label}</span>
                </div>
                <Badge variant="secondary" className="rounded-md font-mono">{allTasks.filter((t: any) => t.status === col.id).length}</Badge>
              </div>
              
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {allTasks.filter((t: any) => t.status === col.id).map((task: any) => (
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
                <div className="grid grid-cols-12 h-full">
                  <div className="col-span-8 p-8 space-y-8 border-r">
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
                    </Tabs>
                  </div>

                  <div className="col-span-4 bg-muted/10 p-8 space-y-8">
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
