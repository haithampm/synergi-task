import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, GripVertical, Plus, Trash2,
  ZoomIn, ZoomOut, Calendar, Save, Milestone, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useProjects, useTasks, useCreateTask, useUpdateTask } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScheduleTask {
  id: string;
  title: string;
  start: string;
  finish: string;
  progress: number;
  priority: string;
  status: string;
  isSummary: boolean;
  isMilestone: boolean;
  outlineLevel: number;
  collapsed: boolean;
  children: string[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'hsl(0 84% 60%)',
  high: 'hsl(25 95% 53%)',
  medium: 'hsl(221 83% 53%)',
  low: 'hsl(142 71% 45%)',
};

const STATUS_COLORS: Record<string, string> = {
  done: 'hsl(142 71% 45%)',
  'in-progress': 'hsl(221 83% 53%)',
  review: 'hsl(45 93% 47%)',
  todo: 'hsl(220 9% 46%)',
  backlog: 'hsl(220 9% 66%)',
};

const DAY_MS = 86400000;

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const projectFilter = searchParams.get('project') || '';
  const [selectedProject, setSelectedProject] = useState(projectFilter);
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('week');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<ScheduleTask>>>(new Map());

  const timelineRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  const { data: projects } = useProjects();
  const { data: rawTasks, refetch: refetchTasks } = useTasks(selectedProject || undefined);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // Sync scroll between task list and timeline
  const handleScroll = useCallback((source: 'tasks' | 'timeline') => {
    const taskEl = taskListRef.current;
    const timeEl = timelineRef.current;
    if (!taskEl || !timeEl) return;
    if (source === 'tasks') {
      timeEl.scrollTop = taskEl.scrollTop;
    } else {
      taskEl.scrollTop = timeEl.scrollTop;
    }
  }, []);

  // Build schedule tasks from raw data
  const scheduleTasks: ScheduleTask[] = useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks.map((t: any) => {
      const pending = pendingChanges.get(t.id);
      return {
        id: t.id,
        title: pending?.title ?? t.title,
        start: pending?.start ?? t.due_date ?? '',
        finish: pending?.finish ?? t.due_date ?? '',
        progress: t.status === 'done' ? 100 : t.status === 'in-progress' ? 50 : t.status === 'review' ? 75 : 0,
        priority: pending?.priority ?? t.priority ?? 'medium',
        status: pending?.status ?? t.status ?? 'todo',
        isSummary: false,
        isMilestone: false,
        outlineLevel: 1,
        collapsed: collapsedIds.has(t.id),
        children: [],
      };
    });
  }, [rawTasks, pendingChanges, collapsedIds]);

  // Timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const now = new Date();
    let minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let maxDate = addDays(minDate, 90);

    scheduleTasks.forEach(t => {
      const s = parseDate(t.start);
      const f = parseDate(t.finish);
      if (s && s < minDate) minDate = addDays(s, -7);
      if (f && f > maxDate) maxDate = addDays(f, 7);
    });

    // Pad
    minDate = addDays(minDate, -3);
    maxDate = addDays(maxDate, 14);

    return {
      timelineStart: minDate,
      timelineEnd: maxDate,
      totalDays: diffDays(minDate, maxDate),
    };
  }, [scheduleTasks]);

  // Column widths
  const dayWidth = zoomLevel === 'day' ? 36 : zoomLevel === 'week' ? 18 : 6;
  const timelineWidth = totalDays * dayWidth;

  // Generate timeline headers
  const headers = useMemo(() => {
    const months: { label: string; width: number; x: number }[] = [];
    const days: { label: string; x: number; isWeekend: boolean; isToday: boolean }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentMonth = '';
    let monthStart = 0;
    let monthDays = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(timelineStart, i);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const dayOfWeek = d.getDay();

      if (monthKey !== currentMonth) {
        if (currentMonth) {
          months.push({ label: currentMonth, width: monthDays * dayWidth, x: monthStart });
        }
        currentMonth = monthKey;
        monthStart = i * dayWidth;
        monthDays = 0;
      }
      monthDays++;

      if (zoomLevel === 'day' || zoomLevel === 'week') {
        days.push({
          label: zoomLevel === 'day' ? d.getDate().toString() : (dayOfWeek === 1 ? d.getDate().toString() : ''),
          x: i * dayWidth,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isToday: d.getTime() === today.getTime(),
        });
      }
    }

    if (currentMonth) {
      months.push({ label: currentMonth, width: monthDays * dayWidth, x: monthStart });
    }

    // Convert month keys to labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => {
      const [y, mo] = m.label.split('-');
      m.label = `${monthNames[parseInt(mo)]} ${y}`;
    });

    return { months, days };
  }, [totalDays, timelineStart, dayWidth, zoomLevel]);

  // Today line position
  const todayX = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return diffDays(timelineStart, today) * dayWidth;
  }, [timelineStart, dayWidth]);

  // Inline editing
  const startEdit = (id: string, field: string, value: string) => {
    setEditingCell({ id, field });
    setEditValue(value);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const current = pendingChanges.get(id) || {};
    setPendingChanges(new Map(pendingChanges.set(id, { ...current, [field]: editValue })));
    setEditingCell(null);
  };

  const saveAllChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      for (const [id, changes] of pendingChanges) {
        const updates: any = {};
        if (changes.title) updates.title = changes.title;
        if (changes.priority) updates.priority = changes.priority;
        if (changes.status) updates.status = changes.status;
        if (changes.start) updates.due_date = changes.start;
        await updateTask.mutateAsync({ id, ...updates });
      }
      setPendingChanges(new Map());
      refetchTasks();
      toast.success(`Saved ${pendingChanges.size} changes`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const addNewTask = async () => {
    if (!selectedProject) {
      toast.error('Select a project first');
      return;
    }
    try {
      await createTask.mutateAsync({
        title: 'New Task',
        project_id: selectedProject,
        status: 'todo',
        priority: 'medium',
        due_date: formatDate(new Date()),
      });
      refetchTasks();
      toast.success('Task added');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateTaskField = (id: string, field: string, value: string) => {
    const current = pendingChanges.get(id) || {};
    setPendingChanges(new Map(pendingChanges.set(id, { ...current, [field]: value })));
  };

  const ROW_HEIGHT = 36;

  return (
    <AppLayout>
      <AppHeader title="Project Schedule" subtitle="Interactive Gantt chart — view and edit your project plan" />
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0 flex-wrap">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {(projects || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center border border-border rounded-md overflow-hidden">
            {(['day', 'week', 'month'] as const).map(z => (
              <button
                key={z}
                onClick={() => setZoomLevel(z)}
                className={cn(
                  'px-3 py-1 text-xs font-medium capitalize transition-colors',
                  zoomLevel === z
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                {z}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addNewTask}>
            <Plus className="h-3 w-3 mr-1" /> Add Task
          </Button>

          {pendingChanges.size > 0 && (
            <Button size="sm" className="h-8 text-xs gradient-primary text-primary-foreground" onClick={saveAllChanges}>
              <Save className="h-3 w-3 mr-1" /> Save ({pendingChanges.size})
            </Button>
          )}
        </div>

        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-sm">Select a project to view its schedule</p>
            </div>
          </div>
        ) : scheduleTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-sm">No tasks yet. Add tasks to build your schedule.</p>
              <Button size="sm" onClick={addNewTask}>
                <Plus className="h-3 w-3 mr-1" /> Add First Task
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Task List (left panel) */}
            <div className="w-[420px] shrink-0 border-r border-border flex flex-col bg-card">
              {/* Task list header */}
              <div className="flex items-center border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground shrink-0" style={{ height: 56 }}>
                <div className="w-8 px-1">#</div>
                <div className="flex-1 px-2">Task Name</div>
                <div className="w-20 px-1 text-center">Start</div>
                <div className="w-20 px-1 text-center">Finish</div>
                <div className="w-14 px-1 text-center">%</div>
                <div className="w-16 px-1 text-center">Priority</div>
              </div>

              {/* Task rows */}
              <div
                ref={taskListRef}
                className="flex-1 overflow-y-auto overflow-x-hidden"
                onScroll={() => handleScroll('tasks')}
              >
                {scheduleTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center border-b border-border text-xs hover:bg-muted/30 cursor-pointer transition-colors',
                      selectedTaskId === task.id && 'bg-primary/10',
                      pendingChanges.has(task.id) && 'bg-accent/5'
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="w-8 px-1 text-muted-foreground text-center">{idx + 1}</div>

                    {/* Task name - editable */}
                    <div className="flex-1 px-2 truncate">
                      {editingCell?.id === task.id && editingCell.field === 'title' ? (
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          className="h-6 text-xs py-0 px-1"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="block truncate"
                          onDoubleClick={() => startEdit(task.id, 'title', task.title)}
                        >
                          {task.title}
                        </span>
                      )}
                    </div>

                    {/* Start date */}
                    <div className="w-20 px-1 text-center text-muted-foreground">
                      {editingCell?.id === task.id && editingCell.field === 'start' ? (
                        <Input
                          type="date"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          className="h-6 text-[10px] py-0 px-0.5"
                          autoFocus
                        />
                      ) : (
                        <span onDoubleClick={() => startEdit(task.id, 'start', task.start || '')}>
                          {task.start?.slice(0, 10) || '—'}
                        </span>
                      )}
                    </div>

                    {/* Finish date */}
                    <div className="w-20 px-1 text-center text-muted-foreground">
                      {editingCell?.id === task.id && editingCell.field === 'finish' ? (
                        <Input
                          type="date"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          className="h-6 text-[10px] py-0 px-0.5"
                          autoFocus
                        />
                      ) : (
                        <span onDoubleClick={() => startEdit(task.id, 'finish', task.finish || '')}>
                          {task.finish?.slice(0, 10) || '—'}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="w-14 px-1 text-center">
                      <span className={cn(
                        'text-[10px] font-medium',
                        task.progress >= 100 ? 'text-success' : 'text-muted-foreground'
                      )}>
                        {task.progress}%
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="w-16 px-1 text-center">
                      <Select
                        value={task.priority}
                        onValueChange={v => updateTaskField(task.id, 'priority', v)}
                      >
                        <SelectTrigger className="h-5 text-[10px] border-0 bg-transparent px-0.5 w-full">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium }}
                          />
                          <span className="capitalize">{task.priority}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {['low', 'medium', 'high', 'urgent'].map(p => (
                            <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Timeline (right panel) */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Timeline header */}
              <div className="shrink-0 border-b border-border bg-muted/50 overflow-hidden" style={{ height: 56 }}>
                <div className="overflow-x-auto" style={{ width: '100%' }}>
                  <div style={{ width: timelineWidth, position: 'relative', height: 56 }}>
                    {/* Month row */}
                    <div className="flex" style={{ height: 28 }}>
                      {headers.months.map((m, i) => (
                        <div
                          key={i}
                          className="text-[10px] font-medium text-muted-foreground border-r border-border flex items-center justify-center"
                          style={{ width: m.width, position: 'absolute', left: m.x, height: 28 }}
                        >
                          {m.label}
                        </div>
                      ))}
                    </div>
                    {/* Day row */}
                    <div className="flex" style={{ height: 28, position: 'absolute', top: 28 }}>
                      {headers.days.map((d, i) => (
                        <div
                          key={i}
                          className={cn(
                            'text-[9px] text-center border-r border-border flex items-center justify-center',
                            d.isWeekend && 'bg-muted/80',
                            d.isToday && 'bg-primary/20 font-bold text-primary'
                          )}
                          style={{ width: dayWidth, position: 'absolute', left: d.x, height: 28 }}
                        >
                          {d.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline body */}
              <div
                ref={timelineRef}
                className="flex-1 overflow-auto"
                onScroll={() => handleScroll('timeline')}
              >
                <div style={{ width: timelineWidth, position: 'relative', minHeight: scheduleTasks.length * ROW_HEIGHT }}>
                  {/* Weekend stripes */}
                  {headers.days.filter(d => d.isWeekend).map((d, i) => (
                    <div
                      key={`we-${i}`}
                      className="absolute top-0 bottom-0 bg-muted/40"
                      style={{ left: d.x, width: dayWidth }}
                    />
                  ))}

                  {/* Today line */}
                  {todayX > 0 && todayX < timelineWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-destructive/70 z-10"
                      style={{ left: todayX }}
                    >
                      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-destructive" />
                    </div>
                  )}

                  {/* Task bars */}
                  {scheduleTasks.map((task, idx) => {
                    const start = parseDate(task.start);
                    const finish = parseDate(task.finish);
                    if (!start) return null;

                    const end = finish || addDays(start, 1);
                    const barLeft = diffDays(timelineStart, start) * dayWidth;
                    const barWidth = Math.max(diffDays(start, end) * dayWidth, dayWidth);
                    const barTop = idx * ROW_HEIGHT + 8;
                    const barHeight = ROW_HEIGHT - 16;
                    const progressWidth = (barWidth * task.progress) / 100;

                    const barColor = STATUS_COLORS[task.status] || STATUS_COLORS.todo;

                    return (
                      <g key={task.id}>
                        {/* Bar background */}
                        <div
                          className={cn(
                            'absolute rounded-sm cursor-pointer transition-all hover:brightness-110',
                            selectedTaskId === task.id && 'ring-2 ring-primary ring-offset-1'
                          )}
                          style={{
                            left: barLeft,
                            top: barTop,
                            width: barWidth,
                            height: barHeight,
                            backgroundColor: `${barColor}33`,
                            border: `1px solid ${barColor}66`,
                          }}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {/* Progress fill */}
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm transition-all"
                            style={{
                              width: progressWidth,
                              backgroundColor: barColor,
                              opacity: 0.7,
                            }}
                          />
                          {/* Label */}
                          {barWidth > 60 && (
                            <span
                              className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate"
                              style={{ color: task.progress > 50 ? 'white' : 'currentColor' }}
                            >
                              {task.title}
                            </span>
                          )}
                        </div>
                      </g>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Schedule;
