import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useProjects';
import { tasks as mockTasks } from '@/lib/mock-data';
import { toast } from 'sonner';

const columns = [
  { id: 'backlog', label: 'Backlog', color: 'bg-muted-foreground' },
  { id: 'todo', label: 'To Do', color: 'bg-info' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-primary' },
  { id: 'review', label: 'Review', color: 'bg-warning' },
  { id: 'done', label: 'Done', color: 'bg-success' },
];

const priorityColor: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-warning/10 text-warning border-warning/30',
  medium: 'bg-info/10 text-info border-info/30',
  low: 'bg-muted text-muted-foreground',
};

const Tasks = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', status: 'todo' });
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState(mockTasks);

  const { data: dbTasks } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const allTasks = dbTasks?.length ? dbTasks : localTasks;

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask.mutateAsync(newTask);
      toast.success('Task created!');
      setDialogOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    
    // Update local state for mock data
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    
    // Try updating in DB
    try {
      await updateTask.mutateAsync({ id: taskId, status: newStatus });
    } catch {
      // Mock data fallback - already handled above
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Tasks" subtitle="Manage and track all your tasks" />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{(allTasks as any[]).length} tasks</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-1" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input placeholder="Task title" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
                <Input placeholder="Description" value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newTask.status} onValueChange={v => setNewTask(t => ({ ...t, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={createTask.isPending} className="w-full gradient-primary text-primary-foreground">
                  {createTask.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colTasks = (allTasks as any[]).filter((t: any) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="min-w-[260px] w-[260px] shrink-0 flex flex-col"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${col.color}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{colTasks.length}</Badge>
                </div>
                <div className="flex-1 space-y-2 bg-muted/30 rounded-xl p-2 min-h-[300px]">
                  {colTasks.map((task: any) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                      className="glass cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium mb-2 line-clamp-2">{task.title}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-[10px] ${priorityColor[task.priority] || ''}`}>
                            {task.priority}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {task.dueDate || task.due_date || ''}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Tasks;
