import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Search, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const importExportPath = '/import-export';
const statusStorageKey = 'synergi-implementation-matrix-project-status';

type ProjectStatus = 'active' | 'planning' | 'on-hold' | 'at-risk' | 'completed' | 'cancelled';

type MatrixProject = {
  projectName: string;
  startDate: string;
  endDate: string;
};

const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const legacyStatusMap: Record<string, ProjectStatus> = {
  'not-started': 'planning',
  'in-progress': 'active',
  'at-risk': 'at-risk',
  blocked: 'on-hold',
  completed: 'completed',
};

const matrixProjects: MatrixProject[] = [
  { projectName: 'EPM-940 Phase 5', startDate: '2025-12-10', endDate: '2028-12-09' },
  { projectName: 'EPM-Cleaning P4', startDate: '2025-11-03', endDate: '2028-11-02' },
  { projectName: 'EPM-IDT Phase 3', startDate: '2023-12-31', endDate: '2026-12-30' },
  { projectName: 'EPM-Smart City', startDate: '2024-07-01', endDate: '2027-06-30' },
  { projectName: 'EPM-Smart Lighting', startDate: '2024-09-01', endDate: '2026-08-31' },
  { projectName: 'EPM-Visual Distortion Services', startDate: '2024-07-01', endDate: '2027-06-30' },
  { projectName: 'EPM-Webportal 2022-2025', startDate: '2022-08-14', endDate: '2025-11-30' },
  { projectName: 'EPM-Zain Phase 3', startDate: '2024-11-01', endDate: '2027-10-31' },
  { projectName: 'HBM-Cleaning', startDate: '2024-11-26', endDate: '2025-12-31' },
  { projectName: 'HBM-SMO', startDate: '2025-02-17', endDate: '2026-02-16' },
  { projectName: 'Hail-940', startDate: '2025-03-09', endDate: '2026-03-08' },
  { projectName: 'Hail-Archiving P2', startDate: '2024-10-09', endDate: '2026-10-08' },
  { projectName: 'Hail-Cleaning', startDate: '2023-02-14', endDate: '2026-06-01' },
  { projectName: 'Hail-Cyber Security', startDate: '2023-10-22', endDate: '2026-01-02' },
  { projectName: 'Hail-Etmam', startDate: '2025-04-09', endDate: '2026-04-08' },
  { projectName: 'Hail-Gardening Old', startDate: '2023-02-16', endDate: '2026-06-04' },
  { projectName: 'Hail-Infra 80%', startDate: '2025-02-27', endDate: '2027-08-26' },
  { projectName: 'Hail-Investment-ICOG', startDate: '2024-12-12', endDate: '2026-12-11' },
  { projectName: 'Hail-Revenue Collection', startDate: '2023-08-06', endDate: '2026-08-05' },
  { projectName: 'Hail-Zain (Axionic - ERP)', startDate: '2023-03-30', endDate: '2026-03-29' },
  { projectName: 'JRM development & Operation', startDate: '2024-01-10', endDate: '2027-01-09' },
  { projectName: 'MRM-Operate & Maintenance 940', startDate: '2023-11-15', endDate: '2026-11-14' },
  { projectName: 'EPM-940 Phase 4', startDate: '2022-08-24', endDate: '2025-12-07' },
  { projectName: 'EPM-Digital Transformation', startDate: '2022-09-04', endDate: '2025-12-21' },
];

const normalize = (value: string) => value.trim().toLowerCase();
const getCurrentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/$/, '') || '/');
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const isProjectStatus = (value: unknown): value is ProjectStatus =>
  typeof value === 'string' && projectStatusOptions.some((option) => option.value === value);

const readStatusMap = () => {
  if (typeof window === 'undefined') return {} as Record<string, ProjectStatus>;
  try {
    const raw = JSON.parse(window.localStorage.getItem(statusStorageKey) || '{}') as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(raw).map(([projectName, value]) => [
        projectName,
        isProjectStatus(value) ? value : legacyStatusMap[String(value)] ?? 'active',
      ]),
    ) as Record<string, ProjectStatus>;
  } catch {
    return {} as Record<string, ProjectStatus>;
  }
};

const getStatusLabel = (value: ProjectStatus) => projectStatusOptions.find((option) => option.value === value)?.label ?? value;

const downloadCsv = (rows: Array<MatrixProject & { projectStatus: ProjectStatus }>) => {
  const csv = [
    'Project Name,Start Date,End Date,Project Status',
    ...rows.map((row) => [row.projectName, row.startDate, row.endDate, getStatusLabel(row.projectStatus)].map(csvCell).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'implementation-activities-matrix-project-list.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const ImplementationActivitiesMatrix = () => {
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [year, setYear] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [statusMap, setStatusMap] = useState<Record<string, ProjectStatus>>(readStatusMap);

  useEffect(() => {
    const updatePath = () => {
      const nextPath = getCurrentPath();
      setCurrentPath(nextPath);
      if (nextPath === importExportPath) setOpen(true);
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

  const groups = useMemo(() => Array.from(new Set(matrixProjects.map((project) => project.projectName.split('-')[0]))).sort(), []);
  const years = useMemo(
    () =>
      Array.from(
        new Set(matrixProjects.flatMap((project) => [project.startDate.slice(0, 4), project.endDate.slice(0, 4)])),
      ).sort(),
    [],
  );

  const resetFilters = () => {
    setQuery('');
    setGroup('all');
    setYear('all');
    setStatusFilter('all');
  };

  const openAllProjects = () => {
    resetFilters();
    setOpen(true);
  };

  const rowsWithStatus = useMemo(
    () => matrixProjects.map((project) => ({ ...project, projectStatus: statusMap[project.projectName] ?? 'active' })),
    [statusMap],
  );

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    return rowsWithStatus.filter((project) => {
      const matchesSearch = !search || normalize(project.projectName).includes(search);
      const matchesGroup = group === 'all' || project.projectName.startsWith(`${group}-`);
      const matchesYear = year === 'all' || project.startDate.startsWith(year) || project.endDate.startsWith(year);
      const matchesStatus = statusFilter === 'all' || project.projectStatus === statusFilter;
      return matchesSearch && matchesGroup && matchesYear && matchesStatus;
    });
  }, [group, query, rowsWithStatus, statusFilter, year]);

  const updateProjectStatus = (projectName: string, projectStatus: ProjectStatus) => {
    setStatusMap((current) => {
      const next = { ...current, [projectName]: projectStatus };
      window.localStorage.setItem(statusStorageKey, JSON.stringify(next));
      return next;
    });
  };

  if (currentPath !== importExportPath) return null;

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="sm"
          className="fixed right-4 top-[370px] z-[55] gap-2 rounded-2xl shadow-xl"
          onClick={openAllProjects}
        >
          <Table2 className="h-4 w-4" /> Matrix ({matrixProjects.length})
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] bg-background/98 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl sm:h-[calc(100vh-2rem)]">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-3 sm:p-4">
              <div>
                <p className="text-lg font-black">Implementation Activities Matrix</p>
                <p className="text-sm text-muted-foreground">
                  Updated project list · {filteredRows.length}/{matrixProjects.length} rows shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={resetFilters}>
                  <Filter className="h-4 w-4" /> Show All Projects
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCsv(filteredRows)}>
                  <Download className="h-4 w-4" /> Export Filtered
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="shrink-0 border-b bg-background p-3 sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_180px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by project name" className="pl-9" />
                </label>
                <select value={group} onChange={(event) => setGroup(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">All groups</option>
                  {groups.map((item) => (
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
                  <option value="all">All project statuses</option>
                  {projectStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">#</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Project Name</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Start Date</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">End Date</th>
                    <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Project Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((project, index) => (
                    <tr key={project.projectName} className="odd:bg-muted/20">
                      <td className="border-b px-3 py-2 text-xs font-black text-muted-foreground">{index + 1}</td>
                      <td className="border-b px-3 py-2 font-semibold">{project.projectName}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(project.startDate)}</td>
                      <td className="border-b px-3 py-2 text-muted-foreground">{formatDate(project.endDate)}</td>
                      <td className="border-b px-3 py-2">
                        <select
                          value={project.projectStatus}
                          onChange={(event) => updateProjectStatus(project.projectName, event.target.value as ProjectStatus)}
                          className="h-9 min-w-[150px] rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                        >
                          {projectStatusOptions.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
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
