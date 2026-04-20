import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { Bot, Calendar as CalendarIcon, ChevronDown, ChevronRight, Link2, Milestone, Plus, Save, Users, Workflow } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { exportToMsProjectXml } from '@/lib/ms-project';
import { generateScheduleFromProjectNature } from '@/lib/project-schedule';
import { useCreateTask, useProjects, useTasks, useTeamMembers, useUpdateProject, useUpdateTask, useWorkspaceSettings } from '@/hooks/useProjects';
import { toast } from 'sonner';

type ScheduleStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

type ScheduleTask = {
  id: string;
  persisted: boolean;
  title: string;
  description: string;
  wbs: string;
  parentTaskId?: string;
  phase: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  status: ScheduleStatus;
  priority: Priority;
  progress: number;
  predecessors: string[];
  assigneeIds: string[];
  workloadHours: number;
  isMilestone: boolean;
};

const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment'];

const parseDate = (value?: string | null, fallback = new Date()) => {
  if (!value) return fallback;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : fallback;
};

const getDurationDays = (startDate: Date, endDate: Date) => Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
const toDateInputValue = (value: Date) => format(value, 'yyyy-MM-dd');
const parseDependencyInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);

const buildScheduleWbsMap = (tasks: Array<{ id: string; parentTaskId?: string; phase?: string }>) => {
  const byParent = tasks.reduce<Record<string, Array<{ id: string; parentTaskId?: string; phase?: string }>>>((acc, task) => {
    const key = task.parentTaskId ?? '__root__';
    acc[key] = acc[key] ?? [];
    acc[key].push(task);
    return acc;
  }, {});

  const rootTaskIds = new Set(tasks.map((task) => task.id));
  const result = new Map<string, string>();

  const assignChildren = (parentId: string, parentWbs: string) => {
    (byParent[parentId] ?? []).forEach((child, index) => {
      const childWbs = `${parentWbs}.${index + 1}`;
      result.set(child.id, childWbs);
      assignChildren(child.id, childWbs);
    });
  };

  phases.forEach((phase, phaseIndex) => {
    const roots = tasks.filter((task) => {
      if (task.phase !== phase) return false;
      return !task.parentTaskId || !rootTaskIds.has(task.parentTaskId);
    });

    roots.forEach((task, index) => {
      const rootWbs = `${Math.max(1, phaseIndex + 1)}.${index + 1}`;
      result.set(task.id, rootWbs);
      assignChildren(task.id, rootWbs);
    });
  });

  return result;
};

const DatePickerField = ({ value, onChange }: { value?: Date; onChange: (date?: Date) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="h-8 w-full justify-between text-[11px] font-semibold">
        {value ? format(value, 'dd/MM/yyyy') : 'Pick date'}
        <CalendarIcon className="h-3.5 w-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
    </PopoverContent>
  </Popover>
);

const Schedule = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [activeTab, setActiveTab] = useState('summary');
  const [collapsedPhases, setCollapsedPhases] = useState<string[]>([]);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [draftTask, setDraftTask] = useState<ScheduleTask | null>(null);
  const [localTasks, setLocalTasks] = useState<ScheduleTask[]>([]);

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks(projectId ?? undefined);
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: settings } = useWorkspaceSettings();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateProject = useUpdateProject();

  const currentProject = useMemo(() => projects.find((project) => project.id === projectId) ?? projects[0], [projectId, projects]);

  useEffect(() => {
    if (!currentProject && projects[0]) setSearchParams({ projectId: projects[0].id }, { replace: true });
  }, [currentProject, projects, setSearchParams]);

  useEffect(() => {
    if (!currentProject) return;
    const baseDate = parseDate(currentProject.start_date ?? currentProject.startDate, new Date());
    const wbsMap = buildScheduleWbsMap(tasks);
    const normalized = tasks.map((task, index) => {
      const phase = task.phase ?? phases[index % phases.length];
      const startDate = parseDate(task.start_date ?? task.due_date, addDays(baseDate, index * 3));
      const durationDays = Number.parseInt(String(task.duration ?? '3d').replace('d', ''), 10) || 3;
      const endDate = task.end_date ? parseDate(task.end_date, addDays(startDate, durationDays - 1)) : addDays(startDate, durationDays - 1);
      return {
        id: task.id,
        persisted: true,
        title: task.title,
        description: task.description ?? '',
        wbs: wbsMap.get(task.id) ?? `${Math.max(1, phases.indexOf(phase) + 1)}.${index + 1}`,
        parentTaskId: task.parentTaskId,
        phase,
        startDate,
        endDate,
        durationDays: getDurationDays(startDate, endDate),
        status: task.status,
        priority: task.priority,
        progress: task.progress ?? (task.status === 'done' ? 100 : task.status === 'in-progress' ? 50 : 0),
        predecessors: task.predecessors ?? [],
        assigneeIds: task.assignees ?? (task.assignee_id ? [task.assignee_id] : []),
        workloadHours: task.workloadHours ?? durationDays * 8,
        isMilestone: task.isMilestone ?? false,
      } satisfies ScheduleTask;
    });
    setLocalTasks(normalized);
  }, [currentProject, tasks]);

  const dependencyAdjustedTasks = useMemo(() => {
    const byWbs = new Map(localTasks.map((task) => [task.wbs, { ...task }]));
    const visiting = new Set<string>();
    const resolve = (wbs: string): ScheduleTask | undefined => {
      const task = byWbs.get(wbs);
      if (!task || visiting.has(wbs)) return task;
      visiting.add(wbs);
      const latestDependency = task.predecessors
        .map((dependency) => resolve(dependency)?.endDate)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (latestDependency && latestDependency >= task.startDate) {
        task.startDate = addDays(latestDependency, 1);
        task.endDate = addDays(task.startDate, task.durationDays - 1);
      }
      visiting.delete(wbs);
      byWbs.set(wbs, task);
      return task;
    };
    [...byWbs.keys()].forEach(resolve);
    return Array.from(byWbs.values());
  }, [localTasks]);

  const projectStart = dependencyAdjustedTasks.reduce<Date | null>((acc, task) => !acc || task.startDate < acc ? task.startDate : acc, null);
  const projectEnd = dependencyAdjustedTasks.reduce<Date | null>((acc, task) => !acc || task.endDate > acc ? task.endDate : acc, null);
  const totalDuration = projectStart && projectEnd ? getDurationDays(projectStart, projectEnd) : 0;
  const totalDependencies = dependencyAdjustedTasks.reduce((sum, task) => sum + task.predecessors.length, 0);
  const totalHours = dependencyAdjustedTasks.reduce((sum, task) => sum + task.workloadHours, 0);
  const criticalPath = dependencyAdjustedTasks.filter((task) => task.predecessors.length > 0 || task.endDate.getTime() === projectEnd?.getTime()).map((task) => task.id);

  const phaseTasks = phases.reduce<Record<string, ScheduleTask[]>>((acc, phase) => {
    acc[phase] = dependencyAdjustedTasks.filter((task) => task.phase === phase);
    return acc;
  }, {});
  const taskChildrenMap = useMemo(
    () => dependencyAdjustedTasks.reduce<Record<string, ScheduleTask[]>>((acc, task) => {
      if (!task.parentTaskId) return acc;
      acc[task.parentTaskId] = acc[task.parentTaskId] ?? [];
      acc[task.parentTaskId].push(task);
      return acc;
    }, {}),
    [dependencyAdjustedTasks],
  );
  const phaseFlatTasks = useMemo(() => phases.reduce<Record<string, Array<{ task: ScheduleTask; level: number }>>>((acc, phase) => {
    const phaseItems = phaseTasks[phase];
    const appendTask = (task: ScheduleTask, level: number) => {
      acc[phase].push({ task, level });
      if (collapsedTaskIds.includes(task.id)) return;
      (taskChildrenMap[task.id] ?? []).filter((child) => child.phase === phase).forEach((child) => appendTask(child, level + 1));
    };
    acc[phase] = [];
    phaseItems
      .filter((task) => !task.parentTaskId || !phaseItems.some((candidate) => candidate.id === task.parentTaskId))
      .forEach((task) => appendTask(task, 0));
    return acc;
  }, {} as Record<string, Array<{ task: ScheduleTask; level: number }>>), [collapsedTaskIds, phaseTasks, taskChildrenMap]);

  const phaseProgress = phases.reduce<Record<string, number>>((acc, phase) => {
    const items = phaseTasks[phase];
    acc[phase] = items.length ? Math.round(items.reduce((sum, task) => sum + task.progress, 0) / items.length) : 0;
    return acc;
  }, {});

  const weekColumns = projectStart && projectEnd ? eachWeekOfInterval({ start: startOfWeek(projectStart), end: projectEnd }, { weekStartsOn: 1 }) : [];

  const resourceRows = teamMembers.map((member) => {
    const assignedTasks = dependencyAdjustedTasks.filter((task) => task.assigneeIds.includes(member.id));
    const assignedHours = assignedTasks.reduce((sum, task) => sum + task.workloadHours, 0);
    const capacity = member.capacityHours ?? 40;
    return {
      member,
      assignedHours,
      capacity,
      utilizationPct: Math.round((assignedHours / Math.max(1, capacity)) * 100),
      weeklyLoad: weekColumns.map((week) => ({
        week,
        hours: assignedTasks.filter((task) => task.startDate <= addDays(week, 6) && task.endDate >= week).reduce((sum, task) => sum + task.workloadHours, 0),
      })),
    };
  });

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    if (settings?.ai.scheduleAdvisor) {
      if (totalDependencies > dependencyAdjustedTasks.length) insights.push('Dependency density is high. Validate predecessor logic before locking the baseline.');
      const overloaded = resourceRows.find((row) => row.utilizationPct > (row.member.utilizationTarget ?? 85));
      if (overloaded) insights.push(`${overloaded.member.name} is above target utilization. Rebalance or resequence tasks.`);
      if (criticalPath.length > 0) insights.push(`${criticalPath.length} critical-path activities are still influencing the project finish date.`);
    }
    if (insights.length === 0) insights.push('Schedule health looks balanced. Keep progress and dependency links updated for reliable forecasts.');
    return insights;
  }, [criticalPath.length, dependencyAdjustedTasks.length, resourceRows, settings, totalDependencies]);

  const selectedProjectProgress = dependencyAdjustedTasks.length
    ? Math.round(dependencyAdjustedTasks.reduce((sum, task) => sum + task.progress, 0) / dependencyAdjustedTasks.length)
    : currentProject?.progress ?? 0;
  const overdueTasks = dependencyAdjustedTasks.filter((task) => task.endDate < new Date() && task.progress < 100).length;
  const upcomingMilestones = dependencyAdjustedTasks.filter((task) => task.isMilestone && differenceInCalendarDays(task.startDate, new Date()) >= 0 && differenceInCalendarDays(task.startDate, new Date()) <= 21);
  const phaseTimeline = phases
    .map((phase) => {
      const items = phaseTasks[phase];
      if (!items.length || !projectStart || !projectEnd) return null;
      const phaseStart = items.reduce<Date>((acc, task) => (task.startDate < acc ? task.startDate : acc), items[0].startDate);
      const phaseEnd = items.reduce<Date>((acc, task) => (task.endDate > acc ? task.endDate : acc), items[0].endDate);
      const left = totalDuration > 0 ? (differenceInCalendarDays(phaseStart, projectStart) / totalDuration) * 100 : 0;
      const width = totalDuration > 0 ? (getDurationDays(phaseStart, phaseEnd) / totalDuration) * 100 : 0;
      return { phase, left, width, phaseStart, phaseEnd, tasks: items.length };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const updateLocalTask = (taskId: string, updates: Partial<ScheduleTask>) => {
    setLocalTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...updates } : task));
  };

  const getNextPhaseWbs = (phase: string) => {
    const phaseIndex = Math.max(1, phases.indexOf(phase) + 1);
    const topLevelCount = localTasks.filter((task) => task.phase === phase && !task.parentTaskId).length;
    return `${phaseIndex}.${topLevelCount + 1}`;
  };

  const getNextChildWbs = (parentTask: ScheduleTask) => {
    const childCount = localTasks.filter((task) => task.parentTaskId === parentTask.id).length;
    return `${parentTask.wbs}.${childCount + 1}`;
  };

  const generateNatureSchedule = () => {
    if (!currentProject) return;
    const generatedTasks = generateScheduleFromProjectNature({
      startDate: currentProject.start_date ?? currentProject.startDate ?? new Date().toISOString().slice(0, 10),
      projectName: currentProject.name,
      projectNature: currentProject.projectNature,
    });
    const phaseCounter = new Map<string, number>();
    const mappedTasks: ScheduleTask[] = generatedTasks.map((task, index) => {
      const phasePosition = (phaseCounter.get(task.phase) ?? 0) + 1;
      phaseCounter.set(task.phase, phasePosition);
      const startDate = parseDate(task.start_date);
      const endDate = parseDate(task.end_date);
      return {
        id: `draft-generated-${Date.now()}-${index}`,
        persisted: false,
        title: task.title,
        description: task.description,
        wbs: `${Math.max(1, phases.indexOf(task.phase) + 1)}.${phasePosition}`,
        parentTaskId: undefined,
        phase: task.phase,
        startDate,
        endDate,
        durationDays: getDurationDays(startDate, endDate),
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        predecessors: task.predecessors,
        assigneeIds: [],
        workloadHours: task.workloadHours,
        isMilestone: task.isMilestone,
      };
    });
    setLocalTasks(mappedTasks);
    setActiveTab('table');
    toast.success('Starter schedule generated from the project nature. Review and sync when ready.');
  };

  const addInlineTask = (phase = 'Execution') => {
    const startDate = projectEnd ? addDays(projectEnd, 1) : new Date();
    const newTask: ScheduleTask = {
      id: `draft-${Date.now()}`,
      persisted: false,
      title: 'New schedule activity',
      description: '',
      wbs: getNextPhaseWbs(phase),
      parentTaskId: undefined,
      phase,
      startDate,
      endDate: addDays(startDate, 2),
      durationDays: 3,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      predecessors: [],
      assigneeIds: [],
      workloadHours: 24,
      isMilestone: false,
    };
    setLocalTasks((prev) => [...prev, newTask]);
    setActiveTab('table');
  };

  const addInlineSubtask = (parentTask: ScheduleTask) => {
    const newTask: ScheduleTask = {
      id: `draft-${Date.now()}`,
      persisted: false,
      title: `${parentTask.title} - subtask`,
      description: '',
      wbs: getNextChildWbs(parentTask),
      parentTaskId: parentTask.id,
      phase: parentTask.phase,
      startDate: parentTask.startDate,
      endDate: parentTask.endDate,
      durationDays: parentTask.durationDays,
      status: 'todo',
      priority: parentTask.priority,
      progress: 0,
      predecessors: [],
      assigneeIds: [],
      workloadHours: Math.max(8, Math.round(parentTask.workloadHours / 2)),
      isMilestone: false,
    };
    setLocalTasks((prev) => [...prev, newTask]);
  };

  const openTaskDrawer = (task: ScheduleTask) => {
    setDrawerTaskId(task.id);
    setDraftTask({ ...task });
  };

  const saveDrawerTask = () => {
    if (!draftTask) return;
    updateLocalTask(draftTask.id, { ...draftTask, durationDays: getDurationDays(draftTask.startDate, draftTask.endDate) });
    setDrawerTaskId(null);
    setDraftTask(null);
  };

  const syncSchedule = async () => {
    if (!currentProject) return;
    const syncedTaskMap = new Map<string, ScheduleTask>();
    const persistedIdMap = new Map<string, string>();
    for (const task of dependencyAdjustedTasks) {
      const primaryAssignee = teamMembers.find((member) => task.assigneeIds.includes(member.id));
      const resolvedParentTaskId = task.parentTaskId
        ? persistedIdMap.get(task.parentTaskId) ?? task.parentTaskId
        : undefined;
      const payload = {
        title: task.title,
        description: task.description,
        phase: task.phase,
        start_date: task.startDate.toISOString().slice(0, 10),
        end_date: task.endDate.toISOString().slice(0, 10),
        due_date: task.endDate.toISOString().slice(0, 10),
        duration: `${task.durationDays}d`,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        predecessors: task.predecessors,
        parentTaskId: resolvedParentTaskId,
        assignees: task.assigneeIds,
        assignee: primaryAssignee?.name ?? "",
        workloadHours: task.workloadHours,
        isMilestone: task.isMilestone,
        project_id: currentProject.id,
        projectId: currentProject.id,
      };
      if (task.persisted) {
        const updatedTask = await updateTask.mutateAsync({ id: task.id, ...payload });
        const nextId = updatedTask?.id ?? task.id;
        persistedIdMap.set(task.id, nextId);
        syncedTaskMap.set(task.id, {
          ...task,
          persisted: true,
          id: nextId,
          parentTaskId: resolvedParentTaskId,
        });
      } else {
        const createdTask = await createTask.mutateAsync(payload);
        const nextId = createdTask?.id ?? task.id;
        persistedIdMap.set(task.id, nextId);
        syncedTaskMap.set(task.id, {
          ...task,
          persisted: true,
          id: nextId,
          parentTaskId: resolvedParentTaskId,
        });
      }
    }
    if (settings?.msProject.autoSyncProjectDates && projectStart && projectEnd) {
      await updateProject.mutateAsync({
        id: currentProject.id,
        start_date: projectStart.toISOString().slice(0, 10),
        end_date: projectEnd.toISOString().slice(0, 10),
        startDate: projectStart.toISOString().slice(0, 10),
        endDate: projectEnd.toISOString().slice(0, 10),
      });
    }
    setLocalTasks((prev) =>
      prev.map((task) => {
        const syncedTask = syncedTaskMap.get(task.id);
        return syncedTask ?? task;
      }),
    );
    toast.success('Schedule synced to workspace');
  };

  const exportMsProject = () => {
    if (!currentProject) return;
    const xml = exportToMsProjectXml({
      name: currentProject.name,
      tasks: dependencyAdjustedTasks.map((task) => ({
        title: `${task.wbs} ${task.title}`,
        status: task.status,
        priority: task.priority,
        due_date: task.endDate.toISOString().slice(0, 10),
        description: `${task.description}\nPhase: ${task.phase}\nDependencies: ${task.predecessors.join(', ') || 'None'}`,
        progress: task.progress,
      })),
    });
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${currentProject.name.replace(/\s+/g, '_')}_schedule.xml`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('MS Project XML exported');
  };

  const ganttOrigin = projectStart ?? new Date();

  return (
    <AppLayout>
      <AppHeader title={currentProject?.name ?? 'Master Schedule'} subtitle="Advanced schedule control with dependencies, resource loading, AI guidance, and MS Project export." />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={currentProject?.id} onValueChange={(value) => setSearchParams({ projectId: value }, { replace: true })}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Project Window</p>
              <h2 className="text-xl font-black tracking-tight">{currentProject?.name}</h2>
              <p className="text-[11px] text-muted-foreground font-semibold mt-1">Start: {projectStart ? format(projectStart, 'dd/MM/yyyy') : '--'} - End: {projectEnd ? format(projectEnd, 'dd/MM/yyyy') : '--'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={generateNatureSchedule}>Generate Nature Plan</Button>
            <Button variant="outline" onClick={exportMsProject}>Export MS Project XML</Button>
            <Button variant="outline" onClick={addInlineTask}><Plus className="h-4 w-4 mr-2" /> New Activity</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={syncSchedule}><Save className="h-4 w-4 mr-2" /> Sync Schedule</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { label: 'Total Duration', value: `${totalDuration}d`, detail: 'End-to-end baseline' },
            { label: 'Total Hours', value: `${totalHours}h`, detail: 'Planned workload' },
            { label: 'Dependencies', value: totalDependencies, detail: 'Linked activities' },
            { label: 'Critical Path', value: criticalPath.length, detail: 'Tasks driving finish' },
            { label: 'Milestones', value: dependencyAdjustedTasks.filter((task) => task.isMilestone).length, detail: 'Zero-duration controls' },
          ].map((metric) => (
            <Card key={metric.label} className="glass"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">{metric.label}</p><p className="text-3xl font-bold mt-1">{metric.value}</p><p className="text-xs text-muted-foreground mt-1">{metric.detail}</p></CardContent></Card>
          ))}
        </div>

        <Card className="glass">
          <CardContent className="p-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selected Project Timeline</p>
                    <h3 className="text-xl font-bold mt-1">{currentProject?.name ?? 'Project timeline'}</h3>
                  </div>
                  <Badge variant="outline">{selectedProjectProgress}% progress</Badge>
                </div>
                <Progress value={selectedProjectProgress} className="h-2" />
                <div className="relative h-20 rounded-2xl border bg-muted/10 overflow-hidden">
                  {phaseTimeline.map((segment) => (
                    <button
                      key={segment.phase}
                      type="button"
                      className="absolute top-5 h-10 rounded-xl border bg-primary/15 px-3 text-left text-xs font-semibold text-primary"
                      style={{ left: `${segment.left}%`, width: `${Math.max(segment.width, 8)}%` }}
                      onClick={() => setCollapsedPhases((prev) => prev.filter((item) => item !== segment.phase))}
                    >
                      <span className="block truncate">{segment.phase}</span>
                      <span className="block text-[10px] text-muted-foreground">{format(segment.phaseStart, 'dd MMM')} - {format(segment.phaseEnd, 'dd MMM')}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {phaseTimeline.map((segment) => (
                    <Badge key={segment.phase} variant="secondary">{segment.phase}: {segment.tasks} tasks</Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border p-4 bg-card/40">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Overdue Tasks</p>
                  <p className="mt-1 text-2xl font-bold">{overdueTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Activities behind the current date.</p>
                </div>
                <div className="rounded-2xl border p-4 bg-card/40">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming Milestones</p>
                  <p className="mt-1 text-2xl font-bold">{upcomingMilestones.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{upcomingMilestones[0] ? `${upcomingMilestones[0].title} on ${format(upcomingMilestones[0].startDate, 'dd MMM yyyy')}` : 'No milestone due in the next 21 days.'}</p>
                </div>
                <div className="rounded-2xl border p-4 bg-card/40">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Resource Footprint</p>
                  <p className="mt-1 text-2xl font-bold">{resourceRows.filter((row) => row.assignedHours > 0).length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Assigned team members contributing to this plan.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="glass xl:col-span-2"><CardContent className="p-5 space-y-3"><div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><p className="font-medium">Schedule AI Advisor</p></div>{aiInsights.map((insight) => <div key={insight} className="rounded-xl border p-3 bg-card/40 flex items-start gap-3"><Bot className="h-4 w-4 text-primary mt-0.5" /><p className="text-sm">{insight}</p></div>)}</CardContent></Card>
          <Card className="glass"><CardContent className="p-5 space-y-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><p className="font-medium">Resource Signal</p></div>{resourceRows.slice(0, 4).map((row) => <div key={row.member.id} className="rounded-xl border p-3 bg-card/40"><div className="flex items-center justify-between"><p className="text-sm font-medium">{row.member.name}</p><Badge variant={row.utilizationPct > (row.member.utilizationTarget ?? 85) ? 'destructive' : 'outline'} className="text-[10px]">{row.utilizationPct}%</Badge></div><div className="flex items-center justify-between text-xs text-muted-foreground mt-2"><span>{row.assignedHours}h assigned</span><span>{row.capacity}h capacity</span></div><Progress value={row.utilizationPct} className="h-1.5 mt-2" /></div>)}</CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/20 p-1 rounded-2xl inline-flex border border-muted/30">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass">
                <CardContent className="p-5 space-y-4">
                  <p className="text-sm font-semibold">Phase Performance</p>
                  {phases.map((phase) => (
                    <div key={phase} className="rounded-xl border p-3 bg-card/40">
                      <div className="flex items-center justify-between text-sm">
                        <span>{phase}</span>
                        <span>{phaseTasks[phase].length} tasks</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Progress value={phaseProgress[phase]} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{phaseProgress[phase]}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="p-5 space-y-4">
                  <p className="text-sm font-semibold">Milestones & Dependencies</p>
                  {dependencyAdjustedTasks.slice(0, 6).map((task) => (
                    <div key={task.id} className="rounded-xl border p-3 bg-card/40">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{task.wbs} {task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.phase} - {format(task.startDate, 'dd MMM')} to {format(task.endDate, 'dd MMM')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.isMilestone && <Milestone className="h-4 w-4 text-primary" />}
                          {task.predecessors.length > 0 && <Link2 className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-6">
            <Card className="glass overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/20 border-b">
                    <tr>
                      <th className="p-3 text-xs font-black uppercase">WBS</th>
                      <th className="p-3 text-xs font-black uppercase">Task</th>
                      <th className="p-3 text-xs font-black uppercase">Start</th>
                      <th className="p-3 text-xs font-black uppercase">Finish</th>
                      <th className="p-3 text-xs font-black uppercase">Duration</th>
                      <th className="p-3 text-xs font-black uppercase">Dependencies</th>
                      <th className="p-3 text-xs font-black uppercase">Progress</th>
                      <th className="p-3 text-xs font-black uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases.map((phase, index) => (
                      <Fragment key={phase}>
                        <tr className="bg-muted/5 cursor-pointer" onClick={() => setCollapsedPhases((prev) => prev.includes(phase) ? prev.filter((item) => item !== phase) : [...prev, phase])}>
                          <td className="p-3 font-bold">{index + 1}</td>
                          <td className="p-3 font-bold flex items-center gap-2">{collapsedPhases.includes(phase) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{phase}</td>
                          <td className="p-3" colSpan={5}><div className="flex items-center gap-3"><Progress value={phaseProgress[phase]} className="h-1.5 w-48" /><span className="text-xs text-muted-foreground">{phaseProgress[phase]}%</span></div></td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                addInlineTask(phase);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />Add Task
                            </Button>
                          </td>
                        </tr>
                        {!collapsedPhases.includes(phase) && phaseFlatTasks[phase].map(({ task, level }) => (
                          <tr key={task.id} className={cn('border-b align-top', criticalPath.includes(task.id) && 'bg-amber-50')}>
                            <td className="p-3 text-xs">{task.wbs}</td>
                            <td className="p-3 min-w-[240px]">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 18}px` }}>
                                  {(taskChildrenMap[task.id] ?? []).filter((child) => child.phase === phase).length ? (
                                    <button type="button" onClick={() => setCollapsedTaskIds((prev) => prev.includes(task.id) ? prev.filter((item) => item !== task.id) : [...prev, task.id])}>
                                      {collapsedTaskIds.includes(task.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                  ) : <span className="w-4" />}
                                  <Input
                                    value={task.title}
                                    onChange={(event) => updateLocalTask(task.id, { title: event.target.value })}
                                    className="h-8 text-xs font-medium"
                                  />
                                </div>
                                <Badge variant="outline" className="w-fit">{task.phase}</Badge>
                                {task.parentTaskId ? <Badge variant="secondary" className="w-fit">Subtask</Badge> : null}
                              </div>
                            </td>
                            <td className="p-3 min-w-[135px]">
                              <Input
                                type="date"
                                value={toDateInputValue(task.startDate)}
                                className="h-8 text-xs"
                                onChange={(event) => {
                                  const nextStart = parseDate(event.target.value, task.startDate);
                                  updateLocalTask(task.id, {
                                    startDate: nextStart,
                                    endDate: addDays(nextStart, task.durationDays - 1),
                                  });
                                }}
                              />
                            </td>
                            <td className="p-3 min-w-[135px]">
                              <Input
                                type="date"
                                value={toDateInputValue(task.endDate)}
                                className="h-8 text-xs"
                                onChange={(event) => {
                                  const nextEnd = parseDate(event.target.value, task.endDate);
                                  updateLocalTask(task.id, {
                                    endDate: nextEnd,
                                    durationDays: getDurationDays(task.startDate, nextEnd),
                                  });
                                }}
                              />
                            </td>
                            <td className="p-3 min-w-[170px]">
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={task.durationDays}
                                  className="h-8 text-xs"
                                  onChange={(event) => {
                                    const nextDuration = Math.max(1, Number(event.target.value) || 1);
                                    updateLocalTask(task.id, {
                                      durationDays: nextDuration,
                                      endDate: addDays(task.startDate, nextDuration - 1),
                                    });
                                  }}
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  value={task.workloadHours}
                                  className="h-8 text-xs"
                                  onChange={(event) => updateLocalTask(task.id, { workloadHours: Math.max(0, Number(event.target.value) || 0) })}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">days / hours</p>
                            </td>
                            <td className="p-3 min-w-[180px]">
                              <Input
                                value={task.predecessors.join(', ')}
                                className="h-8 text-xs"
                                placeholder="1.1, 2.3"
                                onChange={(event) => updateLocalTask(task.id, { predecessors: parseDependencyInput(event.target.value) })}
                              />
                            </td>
                            <td className="p-3 min-w-[160px]">
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={task.progress}
                                  className="h-8 text-xs"
                                  onChange={(event) => updateLocalTask(task.id, { progress: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                                />
                                <Progress value={task.progress} className="h-1.5" />
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openTaskDrawer(task)}>Details</Button>
                                <Button size="sm" variant="outline" onClick={() => addInlineSubtask(task)}>Subtask</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="gantt" className="mt-6">
            <Card className="glass overflow-hidden">
              <div className="flex">
                <div className="w-[280px] border-r border-muted/20">
                  {dependencyAdjustedTasks.map((task) => <div key={task.id} className="h-12 border-b px-4 flex items-center text-sm font-medium">{task.wbs} {task.title}</div>)}
                </div>
                <div className="flex-1 overflow-x-auto bg-muted/5">
                  <div className="min-w-[900px]">
                    <div className="flex h-12 border-b bg-muted/10">{weekColumns.map((week) => <div key={week.toISOString()} className="w-40 border-l px-3 py-3 text-xs font-black uppercase text-muted-foreground">{format(week, 'dd MMM')}</div>)}</div>
                    <div>{dependencyAdjustedTasks.map((task) => {
                      const offset = differenceInCalendarDays(task.startDate, ganttOrigin) * 22;
                      const width = Math.max(60, task.durationDays * 22);
                      return <div key={task.id} className="h-12 border-b relative"><button className={cn('absolute top-2 h-8 rounded-full border px-3 text-xs font-medium text-left', criticalPath.includes(task.id) ? 'bg-amber-200 border-amber-300' : 'bg-primary/15 border-primary/30')} style={{ left: `${offset}px`, width: `${width}px` }} onClick={() => openTaskDrawer(task)}>{task.title}</button></div>;
                    })}</div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="mt-6">
            <Card className="glass overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/20 border-b">
                    <tr>
                      <th className="p-3 text-xs font-black uppercase">Team Member</th>
                      <th className="p-3 text-xs font-black uppercase">Assigned</th>
                      <th className="p-3 text-xs font-black uppercase">Capacity</th>
                      <th className="p-3 text-xs font-black uppercase">Utilization</th>
                      {weekColumns.map((week) => <th key={week.toISOString()} className="p-3 text-xs font-black uppercase whitespace-nowrap">{format(week, 'dd MMM')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {resourceRows.map((row) => (
                      <tr key={row.member.id} className="border-b">
                        <td className="p-3 text-sm font-medium">{row.member.name}</td>
                        <td className="p-3 text-sm">{row.assignedHours}h</td>
                        <td className="p-3 text-sm">{row.capacity}h</td>
                        <td className="p-3 text-sm">{row.utilizationPct}%</td>
                        {row.weeklyLoad.map((entry) => <td key={entry.week.toISOString()} className={cn('p-3 text-xs', entry.hours > row.capacity ? 'bg-red-100/70' : entry.hours > row.capacity * 0.8 ? 'bg-amber-100/70' : 'bg-emerald-100/50')}>{entry.hours}h</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Sheet open={!!drawerTaskId} onOpenChange={(open) => { if (!open) { setDrawerTaskId(null); setDraftTask(null); } }}>
          <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
            <SheetHeader><SheetTitle>Schedule Activity</SheetTitle></SheetHeader>
            {draftTask && (
              <div className="mt-6 space-y-4">
                <div><p className="text-xs font-bold mb-1">Task Name</p><Input value={draftTask.title} onChange={(e) => setDraftTask((prev) => prev ? { ...prev, title: e.target.value } : prev)} /></div>
                <div><p className="text-xs font-bold mb-1">Description</p><Textarea value={draftTask.description} onChange={(e) => setDraftTask((prev) => prev ? { ...prev, description: e.target.value } : prev)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs font-bold mb-1">Start Date</p><DatePickerField value={draftTask.startDate} onChange={(date) => date && setDraftTask((prev) => prev ? { ...prev, startDate: date, endDate: addDays(date, prev.durationDays - 1) } : prev)} /></div>
                  <div><p className="text-xs font-bold mb-1">End Date</p><DatePickerField value={draftTask.endDate} onChange={(date) => date && setDraftTask((prev) => prev ? { ...prev, endDate: date, durationDays: getDurationDays(prev.startDate, date) } : prev)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs font-bold mb-1">Duration (days)</p><Input type="number" value={draftTask.durationDays} onChange={(e) => setDraftTask((prev) => prev ? { ...prev, durationDays: Number(e.target.value) || 1, endDate: addDays(prev.startDate, (Number(e.target.value) || 1) - 1) } : prev)} /></div>
                  <div><p className="text-xs font-bold mb-1">Workload Hours</p><Input type="number" value={draftTask.workloadHours} onChange={(e) => setDraftTask((prev) => prev ? { ...prev, workloadHours: Number(e.target.value) || 8 } : prev)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold mb-1">Status</p>
                    <Select value={draftTask.status} onValueChange={(value: ScheduleStatus) => setDraftTask((prev) => prev ? { ...prev, status: value } : prev)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-1">Priority</p>
                    <Select value={draftTask.priority} onValueChange={(value: Priority) => setDraftTask((prev) => prev ? { ...prev, priority: value } : prev)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><p className="text-xs font-bold mb-1">Progress ({draftTask.progress}%)</p><Slider value={[draftTask.progress]} max={100} step={1} onValueChange={([value]) => setDraftTask((prev) => prev ? { ...prev, progress: value } : prev)} /></div>
                <div>
                  <p className="text-xs font-bold mb-2">Predecessors</p>
                  <div className="flex flex-wrap gap-2">
                    {dependencyAdjustedTasks.filter((task) => task.id !== draftTask.id).map((task) => {
                      const checked = draftTask.predecessors.includes(task.wbs);
                      return <Button key={task.id} type="button" size="sm" variant={checked ? 'default' : 'outline'} onClick={() => setDraftTask((prev) => prev ? { ...prev, predecessors: checked ? prev.predecessors.filter((item) => item !== task.wbs) : [...prev.predecessors, task.wbs] } : prev)}>{task.wbs}</Button>;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Assigned Team Members</p>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map((member) => {
                      const checked = draftTask.assigneeIds.includes(member.id);
                      return <Button key={member.id} type="button" size="sm" variant={checked ? 'default' : 'outline'} onClick={() => setDraftTask((prev) => prev ? { ...prev, assigneeIds: checked ? prev.assigneeIds.filter((item) => item !== member.id) : [...prev.assigneeIds, member.id] } : prev)}>{member.name}</Button>;
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold mb-1">Parent Task</p>
                  <Select value={draftTask.parentTaskId || '__none__'} onValueChange={(value) => setDraftTask((prev) => prev ? { ...prev, parentTaskId: value === '__none__' ? undefined : value } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Main task</SelectItem>
                      {dependencyAdjustedTasks.filter((task) => task.id !== draftTask.id && task.phase === draftTask.phase).map((task) => (
                        <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm">Mark as milestone</span>
                  <Button size="sm" variant={draftTask.isMilestone ? 'default' : 'outline'} onClick={() => setDraftTask((prev) => prev ? { ...prev, isMilestone: !prev.isMilestone, durationDays: prev.isMilestone ? prev.durationDays : 1, endDate: prev.isMilestone ? prev.endDate : prev.startDate } : prev)}>{draftTask.isMilestone ? 'Milestone' : 'Standard'}</Button>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDrawerTaskId(null); setDraftTask(null); }}>Cancel</Button>
                  <Button onClick={saveDrawerTask}>Apply</Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
};

export default Schedule;
