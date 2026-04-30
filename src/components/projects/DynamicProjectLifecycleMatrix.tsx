import { useMemo, useState } from 'react';
import { Download, Filter, Search, Table2, X } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useProjects, useTasks } from '@/hooks/useProjects';
import { getProjectLifecycleActivityTotal, getProjectLifecycleStageCounts, lifecycleStageCatalog } from '@/lib/project-activities';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatDate = (value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text) return 'Not set';
  const date = new Date(`${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusClass: Record<string, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  planning: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'on-hold': 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'at-risk': 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  completed: 'border-border bg-muted text-muted-foreground',
  archived: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
};

const DynamicProjectLifecycleMatrix = () => {
  const location = useLocation();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const isProjectsPage = location.pathname.replace(/\/$/, '') === '/projects';

  const statusOptions = useMemo(
    () => Array.from(new Set(projects.map((project) => normalize(project.status)).filter(Boolean))).sort(),
    [projects],
  );

  const rows = useMemo(() => {
    const search = normalize(query);
    return projects
      .filter((project) => {
        const matchesSearch = !search || normalize(project.name).includes(search) || normalize(project.department).includes(search);
        const matchesStatus = statusFilter === 'all' || normalize(project.status) === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map((project, index) => {
        const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === project.id);
        const stageCounts = getProjectLifecycleStageCounts(project, tasks);
        const totalActivities = getProjectLifecycleActivityTotal(project, tasks);
        const completedTasks = projectTasks.filter((task) => task.status === 'done').length;
        const completion = projectTasks.length
          ? Math.round((completedTasks / projectTasks.length) * 100)
          : project.radarLifecycle?.completionPct ?? project.progress ?? 0;

        return {
          rank: index + 1,
          project,
          projectTasks,
          completedTasks,
          completion: Math.max(0, Math.min(100, completion)),
          totalActivities,
          stageCounts,
          startDate: project.start_date ?? project.startDate,
          endDate: project.end_date ?? project.endDate,
        };
      });
  }, [projects, query, statusFilter, tasks]);

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const exportCsv = () => {
    const headers = [
      'Rank',
      'Project Name',
      'Status',
      'Start Date',
      'End Date',
      'Progress',
      'Tasks',
      'Completed Tasks',
      'Total Lifecycle Activities',
      ...lifecycleStageCatalog.map((stage) => stage.label),
    ];
    const lines = rows.map((row) => [
      row.rank,
      row.project.name,
      row.project.status,
      row.startDate ?? '',
      row.endDate ?? '',
      `${row.completion}%`,
      row.projectTasks.length,
      row.completedTasks,
      row.totalActivities,
      ...lifecycleStageCatalog.map((stage) => row.stageCounts[stage.key] ?? 0),
    ].map(csvCell).join(','));
    const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'project-lifecycle-matrix.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isProjectsPage) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="fixed right-4 top-[430px] z-[55] gap-2 rounded-2xl shadow-xl"
        onClick={() => setOpen(true)}
      >
        <Table2 className="h-4 w-4" /> Live Matrix ({projects.length})
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[95] bg-background/98 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl sm:h-[calc(100vh-2rem)]">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-3 sm:p-4">
              <div>
                <p className="text-lg font-black">Implementation Lifecycle Matrix</p>
                <p className="text-sm text-muted-foreground">
                  Live project list · {rows.length}/{projects.length} projects shown · dynamic from database
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={resetFilters}>
                  <Filter className="h-4 w-4" /> Show All
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export Filtered
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="shrink-0 border-b bg-background p-3 sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by project name or department" className="pl-9" />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">All project statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status.replace('-', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <table className="min-w-[1300px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">#</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Project</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Status</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Start</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">End</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Progress</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Tasks</th>
                    {lifecycleStageCatalog.map((stage) => (
                      <th key={stage.key} className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{stage.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.project.id} className="odd:bg-muted/20">
                      <td className="border-b px-3 py-2 text-xs font-black text-muted-foreground">{row.rank}</td>
                      <td className="border-b px-3 py-2 font-semibold">
                        <Link to={`/projects?projectId=${row.project.id}`} onClick={() => setOpen(false)} className="text-primary underline-offset-4 hover:underline">
                          {row.project.name}
                        </Link>
                      </td>
                      <td className="border-b px-3 py-2">
                        <Badge variant="outline" className={statusClass[normalize(row.project.status)] ?? 'border-border bg-muted text-muted-foreground'}>
                          {String(row.project.status ?? 'active').replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(row.startDate)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(row.endDate)}</td>
                      <td className="border-b px-3 py-2">
                        <div className="flex min-w-[150px] items-center gap-2">
                          <Progress value={row.completion} className="h-2" />
                          <span className="w-10 text-xs font-black text-muted-foreground">{row.completion}%</span>
                        </div>
                      </td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{row.completedTasks}/{row.projectTasks.length}</td>
                      {lifecycleStageCatalog.map((stage) => (
                        <td key={`${row.project.id}-${stage.key}`} className="border-b px-3 py-2 text-center font-black">
                          {row.stageCounts[stage.key] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No projects match the current filters.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DynamicProjectLifecycleMatrix;
