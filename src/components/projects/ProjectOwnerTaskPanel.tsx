import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, ExternalLink, Plus, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type ProjectRow = {
  id: string;
  workspace_id?: string | null;
  name: string;
  status?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  assignee_id?: string | null;
  assignee?: string | null;
  progress?: number | null;
};

const isProjectsPage = () => window.location.pathname.replace(/\/$/, '') === '/projects';
const formatDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusClass: Record<string, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  todo: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'in-progress': 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  completed: 'border-border bg-muted text-muted-foreground',
  'at-risk': 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  'on-hold': 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const ProjectOwnerTaskPanel = () => {
  const [visible, setVisible] = useState(isProjectsPage);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const updateVisibility = () => setVisible(isProjectsPage());
    const patchHistory = (method: 'pushState' | 'replaceState') => {
      const original = window.history[method];
      window.history[method] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('workspace-route-changed'));
        return result;
      };
      return () => {
        window.history[method] = original;
      };
    };
    const restorePush = patchHistory('pushState');
    const restoreReplace = patchHistory('replaceState');
    updateVisibility();
    window.addEventListener('workspace-route-changed', updateVisibility);
    window.addEventListener('popstate', updateVisibility);
    window.addEventListener('hashchange', updateVisibility);
    return () => {
      restorePush();
      restoreReplace();
      window.removeEventListener('workspace-route-changed', updateVisibility);
      window.removeEventListener('popstate', updateVisibility);
      window.removeEventListener('hashchange', updateVisibility);
    };
  }, []);

  const loadData = async () => {
    if (!isProjectsPage()) return;
    setLoading(true);
    setMessage('');
    try {
      const [projectResult, taskResult] = await Promise.all([
        supabase.from('projects').select('id,workspace_id,name,status,priority,start_date,end_date,progress').order('name', { ascending: true }),
        supabase.from('tasks').select('id,title,status,priority,due_date,project_id,assignee_id,progress').order('due_date', { ascending: true, nullsFirst: false }),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (taskResult.error) throw taskResult.error;
      const nextProjects = (projectResult.data ?? []) as ProjectRow[];
      const nextTasks = (taskResult.data ?? []) as TaskRow[];
      setProjects(nextProjects);
      setTasks(nextTasks);
      const urlProjectId = new URLSearchParams(window.location.search).get('projectId');
      const nextSelected =
        nextProjects.find((project) => project.id === selectedProjectId)?.id ??
        nextProjects.find((project) => project.id === urlProjectId)?.id ??
        nextProjects[0]?.id ??
        '';
      setSelectedProjectId(nextSelected);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load project tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && open) void loadData();
  }, [visible, open]);

  const filteredProjects = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(search));
  }, [projects, query]);

  const selectedProjectIndex = filteredProjects.findIndex((project) => project.id === selectedProjectId);
  const selectedProject = filteredProjects[selectedProjectIndex] ?? filteredProjects[0] ?? projects[0];
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.project_id === selectedProject?.id),
    [selectedProject?.id, tasks],
  );

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', projectId);
    window.history.replaceState({}, '', url.toString());
  };

  const goProject = (direction: -1 | 1) => {
    const index = selectedProjectIndex < 0 ? 0 : selectedProjectIndex;
    const next = filteredProjects[index + direction];
    if (next) selectProject(next.id);
  };

  const createTask = async () => {
    if (!selectedProject || !taskTitle.trim()) return;
    setCreating(true);
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          workspace_id: selectedProject.workspace_id,
          project_id: selectedProject.id,
          title: taskTitle.trim(),
          status: 'todo',
          priority: 'medium',
          phase: 'Execution',
          progress: 0,
        })
        .select('id,title,status,priority,due_date,project_id,assignee_id,progress')
        .single();
      if (error) throw error;
      setTasks((current) => [...current, data as TaskRow]);
      setTaskTitle('');
      setMessage('Task added to selected project.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add task.');
    } finally {
      setCreating(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="fixed right-4 top-[490px] z-[55] gap-2 rounded-2xl shadow-xl"
        onClick={() => setOpen(true)}
      >
        <ClipboardList className="h-4 w-4" /> Project Tasks
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[96] bg-background/98 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl sm:h-[calc(100vh-2rem)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-4">
              <div>
                <p className="text-xl font-black">Project owner task view</p>
                <p className="text-sm text-muted-foreground">View linked project tasks, add a task, and move to next or previous project.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void loadData()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-hidden rounded-2xl border bg-muted/15">
                <div className="border-b p-3">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" className="pl-9" />
                  </label>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">{filteredProjects.length}/{projects.length} projects</p>
                </div>
                <div className="max-h-full overflow-auto p-2">
                  {filteredProjects.map((project, index) => (
                    <button
                      key={project.id}
                      type="button"
                      className={`mb-2 w-full rounded-2xl border px-3 py-2 text-left transition hover:bg-muted ${project.id === selectedProject?.id ? 'border-primary bg-primary/10' : 'bg-background'}`}
                      onClick={() => selectProject(project.id)}
                    >
                      <span className="block text-xs font-black text-muted-foreground">Project {index + 1} of {filteredProjects.length}</span>
                      <span className="block truncate text-sm font-black">{project.name}</span>
                      <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{project.status ?? 'active'}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-hidden rounded-2xl border">
                {selectedProject ? (
                  <div className="flex h-full flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/15 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black">{selectedProject.name}</h2>
                          <Badge variant="outline" className={statusClass[String(selectedProject.status ?? 'active')] ?? 'bg-muted'}>
                            {selectedProject.status ?? 'active'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Project {(selectedProjectIndex < 0 ? 0 : selectedProjectIndex) + 1} of {filteredProjects.length} · {formatDate(selectedProject.start_date)} to {formatDate(selectedProject.end_date)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => goProject(-1)} disabled={selectedProjectIndex <= 0}>
                          <ArrowLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => goProject(1)} disabled={selectedProjectIndex < 0 || selectedProjectIndex >= filteredProjects.length - 1}>
                          Next <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="border-b p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Project Tasks sub-tab</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New linked task title" />
                        <Button type="button" className="gap-2" onClick={() => void createTask()} disabled={creating || !taskTitle.trim()}>
                          <Plus className="h-4 w-4" /> Add Task
                        </Button>
                        <a href={`/tasks?projectId=${selectedProject.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                          Open Tasks <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      {message ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{message}</p> : null}
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-4">
                      {projectTasks.length ? (
                        <div className="overflow-hidden rounded-2xl border">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-muted/40 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2">Task</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Priority</th>
                                <th className="px-3 py-2">Due</th>
                                <th className="px-3 py-2">Progress</th>
                              </tr>
                            </thead>
                            <tbody>
                              {projectTasks.map((task) => (
                                <tr key={task.id} className="border-t odd:bg-muted/15">
                                  <td className="px-3 py-2 font-semibold">{task.title}</td>
                                  <td className="px-3 py-2"><Badge variant="outline" className={statusClass[String(task.status ?? 'todo')] ?? 'bg-muted'}>{task.status ?? 'todo'}</Badge></td>
                                  <td className="px-3 py-2 capitalize text-muted-foreground">{task.priority ?? 'medium'}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{formatDate(task.due_date)}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{task.progress ?? 0}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                          No linked tasks yet. Add the first task above or open the Tasks page filtered by this project.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-sm text-muted-foreground">No projects available.</div>
                )}
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ProjectOwnerTaskPanel;
