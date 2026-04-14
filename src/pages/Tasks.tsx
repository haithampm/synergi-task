import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Calendar, User, Tag, Clock, MessageSquare, Paperclip, PlayCircle, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assignee: '', project_id: '' });

  const { data: dbTasks, isLoading } = useTasks();
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const allTasks = dbTasks?.length ? dbTasks : mockTasks;

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask.mutateAsync(newTask);
      toast.success('Task created');
      setDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assignee: '', project_id: '' });
    } catch { toast.error('Create failed'); }
  };

  const handleUpdate = async () => {
    if (!selectedTask) return;
    try {
      await updateTask.mutateAsync(selectedTask);
      toast.success('Task updated');
      setIsEditing(false);
    } catch { toast.error('Update failed'); }
  };

  const openTaskDetail = (task: any) => {
    setSelectedTask({ ...task });
    setTaskDetailOpen(true);
    setIsEditing(false);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) await updateTask.mutateAsync({ id: taskId, status: newStatus });
  };

  return (
    <AppLayout>
      <AppHeader title=\"Tasks\" subtitle=\"Pipeline and workload management\" />
      <div className=\"p-6 space-y-6 animate-fade-in\">
        <div className=\"flex items-center justify-between\">
          <p className=\"text-sm text-muted-foreground\">{allTasks.length} tasks</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className=\"gradient-primary text-primary-foreground\"><Plus className=\"h-4 w-4 mr-1\" /> New Task</Button></DialogTrigger>
            <DialogContent className=\"max-w-xl\">
              <DialogHeader><DialogTitle>New Workspace Task</DialogTitle></DialogHeader>
              <div className=\"space-y-4 mt-4\">
                <Input placeholder=\"Title *\" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
                <Textarea placeholder=\"Description\" value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} rows={3} />
                <div className=\"grid grid-cols-2 gap-4\">
                  <Select value={newTask.project_id} onValueChange={v => setNewTask(t => ({ ...t, project_id: v }))}>
                    <SelectTrigger><SelectValue placeholder=\"Project\" /></SelectTrigger>
                    <SelectContent>{projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder=\"Assignee\" value={newTask.assignee} onChange={e => setNewTask(t => ({ ...t, assignee: e.target.value }))} />
                </div>
                <div className=\"grid grid-cols-2 gap-4\">
                  <Input type=\"date\" value={newTask.dueDate} onChange={e => setNewTask(t => ({ ...t, dueDate: e.target.value }))} />
                  <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value=\"urgent\">Urgent</SelectItem><SelectItem value=\"high\">High</SelectItem><SelectItem value=\"medium\">Medium</SelectItem><SelectItem value=\"low\">Low</SelectItem></SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant=\"outline\" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={createTask.isPending} className=\"gradient-primary text-primary-foreground\">Create Task</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className=\"flex gap-5 overflow-x-auto pb-6\">
          {columns.map(col => (
            <div key={col.id} className=\"min-w-[300px] w-[300px] bg-muted/20 rounded-2xl p-3\" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
              <div className=\"flex items-center justify-between mb-4 px-2\">
                <div className=\"flex items-center gap-2\"><div className={cn(\"w-2 h-2 rounded-full\", col.color)} /><span className=\"text-xs font-bold uppercase tracking-widest text-muted-foreground\">{col.label}</span></div>
                <Badge variant=\"secondary\" className=\"text-[10px]\">{allTasks.filter((t: any) => t.status === col.id).length}</Badge>
              </div>
              <div className=\"space-y-3\">
                {allTasks.filter((t: any) => t.status === col.id).map((task: any) => (
                  <Card key={task.id} draggable onDragStart={e => e.dataTransfer.setData('taskId', task.id)} onClick={() => openTaskDetail(task)} className=\"glass-light border-transparent hover:border-primary/20 cursor-pointer group\">
                    <CardContent className=\"p-4 space-y-3\">
                      <p className=\"text-sm font-bold group-hover:text-primary\">{task.title}</p>
                      <div className=\"flex items-center gap-2\">
                        <Badge variant=\"outline\" className={cn(\"text-[9px] uppercase font-bold\", priorityColor[task.priority])}>{task.priority}</Badge>
                        <span className=\"text-[9px] text-muted-foreground\">{task.due_date || task.dueDate}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={taskDetailOpen} onOpenChange={setTaskDetailOpen}>
        <DialogContent className=\"max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden\">
          {selectedTask && (
            <>
              <div className=\"p-6 border-b bg-muted/10 flex items-center justify-between\">
                <div className=\"flex items-center gap-3\"><PlayCircle className=\"h-5 w-5 text-primary\" /><h2 className=\"text-lg font-bold\">{selectedTask.title}</h2></div>
                <div className=\"flex gap-2\">
                  <Button variant={isEditing ? \"default\" : \"outline\"} size=\"sm\" onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}>{isEditing ? 'Save Changes' : 'Edit Task'}</Button>
                  <Button variant=\"ghost\" size=\"icon\" className=\"text-destructive\" onClick={() => deleteTaskMutation.mutate(selectedTask.id)}><Trash2 className=\"h-4 w-4\" /></Button>
                </div>
              </div>
              <div className=\"flex-1 overflow-y-auto\">
                <div className=\"grid grid-cols-3 h-full\">
                  <div className=\"col-span-2 p-6 space-y-6 border-r\">
                    <h3 className=\"text-xs font-bold uppercase text-muted-foreground\">Description</h3>
                    {isEditing ? <Textarea value={selectedTask.description} onChange={e => setSelectedTask({ ...selectedTask, description: e.target.value })} className=\"min-h-[150px]\" /> : <p className=\"text-sm\">{selectedTask.description || 'No description provided.'}</p>}
                    <Tabs defaultValue=\"activity\"><TabsList className=\"w-full\"><TabsTrigger value=\"activity\" className=\"flex-1\">Activity</TabsTrigger><TabsTrigger value=\"files\" className=\"flex-1\">Attachments</TabsTrigger></TabsList><TabsContent value=\"activity\" className=\"pt-4\"><div className=\"text-center py-10 text-muted-foreground text-xs\">No recent activity</div></TabsContent></Tabs>
                  </div>
                  <div className=\"bg-muted/5 p-6 space-y-6\">
                    <div className=\"space-y-4\">
                      <div className=\"flex flex-col gap-1\"><span className=\"text-[10px] font-bold text-muted-foreground uppercase\"><User className=\"h-3 w-3 inline mr-1\" /> Assignee</span>{isEditing ? <Input value={selectedTask.assignee || ''} onChange={e => setSelectedTask({...selectedTask, assignee: e.target.value})} className=\"h-8 text-xs\" /> : <span className=\"text-sm font-medium\">{selectedTask.assignee || 'Unassigned'}</span>}</div>
                      <div className=\"flex flex-col gap-1\"><span className=\"text-[10px] font-bold text-muted-foreground uppercase\"><Clock className=\"h-3 w-3 inline mr-1\" /> Due Date</span>{isEditing ? <Input type=\"date\" value={selectedTask.due_date || selectedTask.dueDate || ''} onChange={e => setSelectedTask({...selectedTask, due_date: e.target.value})} className=\"h-8 text-xs\" /> : <span className=\"text-sm font-medium\">{selectedTask.due_date || selectedTask.dueDate || 'None'}</span>}</div>
                      <div className=\"flex flex-col gap-1\"><span className=\"text-[10px] font-bold text-muted-foreground uppercase\"><Tag className=\"h-3 w-3 inline mr-1\" /> Status</span><Select value={selectedTask.status} onValueChange={v => setSelectedTask({...selectedTask, status: v})} disabled={!isEditing}><SelectTrigger className=\"h-8 text-xs\"><SelectValue /></SelectTrigger><SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
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
