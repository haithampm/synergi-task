import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, User, GripVertical } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { tasks, type Task } from '@/lib/mock-data';

const columns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-muted-foreground' },
  { id: 'todo', title: 'To Do', color: 'bg-info' },
  { id: 'in-progress', title: 'In Progress', color: 'bg-primary' },
  { id: 'review', title: 'Review', color: 'bg-warning' },
  { id: 'done', title: 'Done', color: 'bg-success' },
] as const;

const priorityColor: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-info/10 text-info border-info/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const TaskCard = ({ task, onDragStart }: { task: Task; onDragStart: (e: React.DragEvent, task: Task) => void }) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, task)}
    className="p-3 rounded-lg bg-card border border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing group"
  >
    <div className="flex items-start gap-2">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${priorityColor[task.priority]}`}>{task.priority}</Badge>
          {task.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" /> {task.assignee}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {task.dueDate.slice(5)}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Tasks = () => {
  const [taskList, setTaskList] = useState<Task[]>(tasks);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <AppLayout>
      <AppHeader title="Tasks" subtitle="Drag and drop to manage task workflow." />
      <div className="p-6 animate-fade-in">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTasks = taskList.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                className="min-w-[280px] w-[280px] shrink-0"
                onDrop={(e) => handleDrop(e, col.id as Task['status'])}
                onDragOver={handleDragOver}
              >
                <Card className="bg-muted/30 border-transparent">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                      <CardTitle className="text-sm font-semibold">{col.title}</CardTitle>
                      <span className="text-xs text-muted-foreground ml-auto bg-muted rounded-full px-2 py-0.5">{colTasks.length}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2.5 min-h-[200px]">
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task} onDragStart={handleDragStart} />
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Tasks;
