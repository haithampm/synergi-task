import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Filter, Search, Table2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useProjects, useTasks, useTeamMembers, useUserAccounts } from '@/hooks/useProjects';
import {
  getProjectLifecycleActivityTotal,
  getProjectLifecycleStageCounts,
  lifecycleStageCatalog,
  type LifecycleStageKey,
} from '@/lib/project-activities';
import { resolveProjectLeader } from '@/lib/workspace-access';
import type { WorkspaceProject } from '@/lib/workspace-store';

const projectPath = '/projects';
const importExportPath = '/import-export';

type ProjectStatus = WorkspaceProject['status'];

const projectStatusOptions: Array<{ value: 'all' | ProjectStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const statusBadge: Record<ProjectStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300',
  'on-hold': 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
  completed: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300',
  'at-risk': 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300',
  archived: 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-300',
};

const getCurrentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/$/, '') || '/');
const normalize = (value: string) => value.trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusLabel = (value: ProjectStatus) => value.replace('-', ' ');

const buildCsv = (rows: ReturnType<typeof buildMatrixRows>) => {
  const header = [
    'Project Name',
    'Department',
    'Leader',
    'Start Date',
    'End Date',
    'Status',
    'Progress',
    'Activities',
    ...lifecycleStageCatalog.map((stage) => stage.label),
  ];
  return [
    header.map(csvCell).join(','),
    ...rows.map((row) => [
      row.project.name,
      row.project.department ?? '',
      row.leader,
      row.project.start_date ?? row.project.startDate ?? '',
      row.project.end_date ?? row.project.endDate ?? '',
      statusLabel(row.project.status),
      `${row.project.progress ?? 0}%`,
      row.totalActivities,
      ...lifecycleStageCatalog.map((stage) => row.stageCounts[stage.key]),
    ].map(csvCell).join(',')),
  ].join('\n');
};

const downloadCsv = (rows: ReturnType<typeof buildMatrixRows>) => {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'implementation-lifecycle-matrix.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildMatrixRows = (
  projects: WorkspaceProject[],
  tasks: ReturnType<typeof useTasks>['data'] extends Array<infer T> ? T[] : never[],
  teamMembers: ReturnType<typeof useTeamMembers>['data'] extends Array<infer T> ? T[] : never[],
  userAccounts: ReturnType<typeof useUserAccounts>['data'] extends Array<infer T> ? T[] : never[],
) =>
  projects.map((project) => {
    const stageCounts = getProjectLifecycleStageCounts(project, tasks);
    const totalActivities = getProjectLifecycleActivityTotal(project, tasks);
    const leader = resolveProjectLeader(project, teamMembers, userAccounts)?.name ?? 'Unassigned';
    return { project, stageCounts, totalActivities, leader };
  });

const ImplementationActivitiesMatrix = () => {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [year, setYear] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');

  useEffect(() => {
    const updatePath = () => {
      const nextPath = getCurrentPath();
      setCurrentPath(nextPath);
      if (nextPath === projectPath || nextPath === importExportPath) setOpen(true);
    };
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

    const restorePushState = patchHistory('pushState');
    const restoreReplaceState = patchHistory('replaceState');
    updatePath();
    window.addEventListener('popstate', updatePath);
    window.addEventListener('hashchange', updatePath);
    window.addEventListener('workspace-route-changed', updatePath);

    return () => {
      restorePushState();
      restoreReplaceState();
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('hashchange', updatePath);
      window.removeEventListener('workspace-route-changed', updatePath);
    };
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[],
    [projects],
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          projects.flatMap((project) => [
            project.start_date ?? project.startDate ?? '',
            project.end_date ?? project.endDate ?? '',
          ].filter(Boolean).map((value) => value.slice(0, 4))),
        ),
      ).sort(),
    [projects],
  );

  const rows = useMemo(
    () => buildMatrixRows(projects, tasks, teamMembers, userAccounts),
    [projects, tasks, teamMembers, userAccounts],
  );

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    return rows.filter((row) => {
      const project = row.project;
      const matchesSearch = !search || [
        project.name,
        project.description,
        project.department,
        project.projectNature,
        ...(project.tags ?? []),
        row.leader,
      ].filter(Boolean).some((value) => normalize(String(value)).includes(search));
      const matchesDepartment = department === 'all' || project.department === department;
      const matchesYear =
        year === 'all' ||
        (project.start_date ?? project.startDate ?? '').startsWith(year) ||
        (project.end_date ?? project.endDate ?? '').startsWith(year);
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
    });
  }, [department, query, rows, statusFilter, year]);

  const resetFilters = () => {
    setQuery('');
    setDepartment('all');
    setYear('all');
    setStatusFilter('all');
  };

  const openProjectTasks = (projectId: string, stageKey?: LifecycleStageKey) => {
    navigate(stageKey ? `/tasks?projectId=${projectId}&stage=${stageKey}` : `/tasks?projectId=${projectId}`);
  };

  const isSupportedPath = currentPath === projectPath || currentPath === importExportPath;
  if (!isSupportedPath) return null;

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="sm"
          className="fixed right-4 top-[370px] z-[55] gap-2 rounded-2xl shadow-xl"
          onClick={() => setOpen(true)}
        >
          <Table2 className="h-4 w-4" /> Lifecycle Matrix ({projects.length})
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] bg-background/98 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl sm:h-[calc(100vh-2rem)]">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-3 sm:p-4">
              <div>
                <p className="text-lg font-black">Implementation Lifecycle Matrix</p>
                <p className="text-sm text-muted-foreground">
                  Portfolio task-style lifecycle table · {filteredRows.length}/{projects.length} projects shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={resetFilters}>
                  <Filter className="h-4 w-4" /> Reset Filters
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCsv(filteredRows)}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="shrink-0 border-b bg-background p-3 sm:p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_150px_190px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, department, leader, or tag" className="pl-9" />
                </label>
                <select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">All departments</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">All years</option>
                  {years.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectStatus)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  {projectStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <table className="min-w-[1600px] w-full border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 border-b border-r bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Project</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Owner</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Dates</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Progress</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Total</th>
                    {lifecycleStageCatalog.map((stage) => (
                      <th key={stage.key} className="sticky top-0 z-10 min-w-[110px] border-b bg-background px-2 py-2 text-center font-black uppercase tracking-[0.08em] text-muted-foreground">
                        {stage.label}
                      </th>
                    ))}
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const project = row.project;
                    return (
                      <tr key={project.id} className="odd:bg-muted/20 hover:bg-muted/40">
                        <td className="sticky left-0 z-10 max-w-[280px] border-b border-r bg-inherit px-3 py-3 align-top">
                          <div className="font-semibold leading-snug">{project.name}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{project.department || 'No department'}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(project.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                          </div>
                        </td>
                        <td className="border-b px-3 py-3 align-top">
                          <div className="font-medium">{row.leader}</div>
                          <div className="text-[11px] text-muted-foreground">Project lead</div>
                        </td>
                        <td className="border-b px-3 py-3 align-top text-muted-foreground">
                          <div>{formatDate(project.start_date ?? project.startDate)}</div>
                          <div>{formatDate(project.end_date ?? project.endDate)}</div>
                        </td>
                        <td className="border-b px-3 py-3 align-top">
                          <Badge variant="outline" className={`capitalize ${statusBadge[project.status]}`}>{statusLabel(project.status)}</Badge>
                        </td>
                        <td className="min-w-[170px] border-b px-3 py-3 align-top">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Completion</span>
                            <span>{project.progress ?? 0}%</span>
                          </div>
                          <Progress value={project.progress ?? 0} className="h-2" />
                        </td>
                        <td className="border-b px-3 py-3 text-center align-top">
                          <button type="button" onClick={() => openProjectTasks(project.id)} className="rounded-xl border px-3 py-1 font-black hover:bg-background">
                            {row.totalActivities}
                          </button>
                        </td>
                        {lifecycleStageCatalog.map((stage) => {
                          const count = row.stageCounts[stage.key];
                          return (
                            <td key={stage.key} className="border-b px-2 py-3 text-center align-top">
                              <button
                                type="button"
                                onClick={() => openProjectTasks(project.id, stage.key)}
                                className={`mx-auto flex h-9 min-w-12 items-center justify-center rounded-xl border px-3 font-black transition hover:bg-background ${stage.border} ${stage.text}`}
                                title={`Open ${stage.label} tasks`}
                              >
                                {count}
                              </button>
                            </td>
                          );
                        })}
                        <td className="border-b px-3 py-3 text-center align-top">
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => openProjectTasks(project.id)}>
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRows.length === 0 && (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Filter className="mx-auto mb-2 h-5 w-5" /> No projects match the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImplementationActivitiesMatrix;
