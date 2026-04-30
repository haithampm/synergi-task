import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Download, GanttChart, MessageSquare, StickyNote, UploadCloud, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import WorkspaceAssistant from '@/components/WorkspaceAssistant';
import DataExportOverlay from '@/components/DataExportOverlay';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

interface AppLayoutProps {
  children: ReactNode;
}

const importActionPattern = /\b(import|upload|parse|load|sync)\b/i;
const legacyAdminMailbox = 'Admin mailbox: admin@company.com';
const currentAdminMailbox = 'Admin mailbox: haitham.pm@gmail.com';
const workspaceStorageKey = 'synergi-workspace-data';
const archivedStorageKey = 'synergi-archived-projects';
const importColumnPreferencesKey = 'synergi-import-column-preferences';
const adminEmails = ['haitham.pm@gmail.com', 'haitham.pm@hotmail.com'];
const fullAdminPermissions = [
  'view_dashboard',
  'view_reports',
  'manage_projects',
  'manage_schedule',
  'manage_tasks',
  'manage_documents',
  'manage_resources',
  'manage_team',
  'manage_users',
  'team_chat',
  'moderate_channels',
  'share',
  'manage_workflows',
  'manage_privileges',
  'manage_integrations',
  'export',
];

type ImportPreviewState = {
  columns: string[];
  fileName: string;
  records: Array<Record<string, string>>;
  selectedColumns: string[];
  visible: boolean;
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';
const isKnownAdminEmail = (email?: string | null) => adminEmails.includes(normalizeEmail(email));

const readWorkspaceStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const parseCsvPreview = (text: string) => {
  const rows = text.split(/\r?\n/).filter((row) => row.trim().length > 0);
  if (rows.length < 2) return { columns: [], records: [] as Array<Record<string, string>> };
  const columns = parseCsvLine(rows[0]).map((column) => column.trim()).filter(Boolean);
  const records = rows.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
  return { columns, records };
};

const stringifyCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const recordsToFilteredCsv = (records: Array<Record<string, string>>, columns: string[]) => {
  if (!records.length || !columns.length) return '';
  return [
    columns.join(','),
    ...records.map((record) => columns.map((column) => stringifyCsvCell(record[column])).join(',')),
  ].join('\n');
};

const isAdminSessionFromStorage = () => {
  const data = readWorkspaceStorage() as {
    settings?: { profile?: { email?: string }; currentUser?: { roleId?: string } };
    userAccounts?: Array<{ email?: string; roleId?: string; status?: string }>;
  } | null;
  if (!data) return false;

  const profileEmail = normalizeEmail(data.settings?.profile?.email);
  const currentRole = normalizeEmail(data.settings?.currentUser?.roleId);
  const hasKnownAdminAccount = data.userAccounts?.some(
    (account) => isKnownAdminEmail(account.email) && account.status !== 'suspended',
  );

  return (
    isKnownAdminEmail(profileEmail) ||
    hasKnownAdminAccount ||
    ['admin', 'super_admin', 'organization_admin', 'project_admin'].includes(currentRole)
  );
};

const normalizeArchivedProjectsInStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return;
    const data = JSON.parse(raw) as { projects?: Array<{ id?: string; status?: string }> };
    if (!Array.isArray(data.projects)) return;

    const archivedProjects = data.projects.filter((project) => project.status === 'archived');
    if (!archivedProjects.length) return;

    const existingArchive = JSON.parse(window.localStorage.getItem(archivedStorageKey) || '[]');
    const archiveById = new Map<string, unknown>();
    if (Array.isArray(existingArchive)) {
      existingArchive.forEach((project) => {
        const id = (project as { id?: string })?.id;
        if (id) archiveById.set(id, project);
      });
    }
    archivedProjects.forEach((project) => {
      if (project.id) archiveById.set(project.id, project);
    });

    data.projects = data.projects.filter((project) => project.status !== 'archived');
    window.localStorage.setItem(archivedStorageKey, JSON.stringify(Array.from(archiveById.values())));
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(data));
  } catch (error) {
    console.warn('Could not normalize archived projects in workspace settings', error);
  }
};

const normalizeAdminRolesInStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return;

    const data = JSON.parse(raw) as {
      settings?: {
        privilegeRoles?: Array<{ id: string; name: string; permissions: string[] }>;
        currentUser?: { roleId?: string };
        profile?: { email?: string };
      };
      userAccounts?: Array<{ email?: string; roleId?: string; status?: string }>;
      teamMembers?: Array<{ email?: string; privilegeRole?: string }>;
    };
    if (!data.settings) return;

    const roles = Array.isArray(data.settings.privilegeRoles) ? data.settings.privilegeRoles : [];
    const roleMap = new Map(roles.map((role) => [role.id, role]));

    roleMap.set('admin', {
      id: 'admin',
      name: 'Admin',
      permissions: Array.from(new Set([...(roleMap.get('admin')?.permissions ?? []), ...fullAdminPermissions])),
    });

    roleMap.set('super_admin', {
      id: 'super_admin',
      name: 'Super Admin',
      permissions: Array.from(new Set([...(roleMap.get('super_admin')?.permissions ?? []), ...fullAdminPermissions])),
    });

    const profileEmail = normalizeEmail(data.settings.profile?.email);
    const shouldForceAdmin = profileEmail === 'admin@company.com' || isKnownAdminEmail(profileEmail);

    data.settings.privilegeRoles = Array.from(roleMap.values());
    data.settings.currentUser = {
      ...(data.settings.currentUser ?? {}),
      roleId: shouldForceAdmin ? 'admin' : data.settings.currentUser?.roleId || 'admin',
    };
    data.settings.profile = {
      ...(data.settings.profile ?? {}),
      email: profileEmail === 'admin@company.com' ? 'haitham.pm@gmail.com' : data.settings.profile?.email,
    };

    if (Array.isArray(data.userAccounts)) {
      data.userAccounts = data.userAccounts.map((account) =>
        isKnownAdminEmail(account.email)
          ? { ...account, roleId: 'admin', status: 'active' }
          : account,
      );
    }

    if (Array.isArray(data.teamMembers)) {
      data.teamMembers = data.teamMembers.map((member) =>
        isKnownAdminEmail(member.email)
          ? { ...member, privilegeRole: 'admin' }
          : member,
      );
    }

    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(data));
  } catch (error) {
    console.warn('Could not normalize admin roles in workspace settings', error);
  }
};

const unlockKnownAdminSettingsControls = () => {
  if (typeof document === 'undefined' || !isAdminSessionFromStorage()) return;

  const actionLabels = ['add user', 'edit', 'invite', 'reset password', 'notify', 'grant admin', 'set viewer', 'suspend', 'activate'];
  document.querySelectorAll('button[disabled], button[aria-disabled="true"]').forEach((button) => {
    const label = button.textContent?.trim().toLowerCase() ?? '';
    if (actionLabels.some((actionLabel) => label.includes(actionLabel))) {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-disabled');
      button.classList.remove('disabled:pointer-events-none', 'disabled:opacity-50');
    }
  });
};

const AppLayout = ({ children }: AppLayoutProps) => {
  const { data: settings } = useWorkspaceSettings();
  const isArabic = settings?.appearance.language === 'ar';
  const sidebarCollapsed = settings?.appearance.sidebarCollapsed ?? false;
  const navigate = useNavigate();
  const location = useLocation();
  const [fileProgressVisible, setFileProgressVisible] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [fileProgressLabel, setFileProgressLabel] = useState('Preparing import...');
  const [exportOpen, setExportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewState>({
    columns: [],
    fileName: '',
    records: [],
    selectedColumns: [],
    visible: false,
  });
  const progressTimer = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const previewRows = useMemo(() => importPreview.records.slice(0, 10), [importPreview.records]);

  useEffect(() => {
    normalizeAdminRolesInStorage();
    normalizeArchivedProjectsInStorage();
  }, []);

  useEffect(() => {
    document.documentElement.lang = isArabic ? 'ar' : 'en';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic]);

  useEffect(() => {
    if (location.pathname !== '/settings') return undefined;

    let frameId = 0;
    const patchSettingsPage = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          if (node.textContent?.includes(legacyAdminMailbox)) {
            node.textContent = node.textContent.replace(legacyAdminMailbox, currentAdminMailbox);
          }
          node = walker.nextNode();
        }
        unlockKnownAdminSettingsControls();
      });
    };

    patchSettingsPage();
    const observer = new MutationObserver(patchSettingsPage);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [location.pathname]);

  useEffect(() => {
    const clearTimers = () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      progressTimer.current = null;
      hideTimer.current = null;
    };

    const startProgress = (label: string) => {
      clearTimers();
      setFileProgressLabel(label);
      setFileProgressVisible(true);
      setFileProgress(8);

      progressTimer.current = window.setInterval(() => {
        setFileProgress((current) => {
          if (current >= 92) return current;
          if (current < 35) return current + 9;
          if (current < 70) return current + 5;
          return current + 2;
        });
      }, 350);
    };

    const completeProgress = () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      progressTimer.current = null;
      setFileProgress(100);
      hideTimer.current = window.setTimeout(() => {
        setFileProgressVisible(false);
        setFileProgress(0);
      }, 900);
    };

    const handleFileChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.type !== 'file' || !target.files?.length) return;
      const file = target.files[0];
      const fileName = file?.name;
      startProgress(fileName ? `Loading ${fileName}...` : 'Loading import file...');

      if (file) {
        void file.text().then((text) => {
          const extension = file.name.split('.').pop()?.toLowerCase();
          let columns: string[] = [];
          let records: Array<Record<string, string>> = [];

          if (extension === 'csv') {
            const parsed = parseCsvPreview(text);
            columns = parsed.columns;
            records = parsed.records;
          } else if (extension === 'json') {
            try {
              const parsed = JSON.parse(text);
              const arrayData = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.projects)
                  ? parsed.projects
                  : Array.isArray(parsed?.tasks)
                    ? parsed.tasks
                    : Array.isArray(parsed?.tickets)
                      ? parsed.tickets
                      : [];
              records = arrayData.slice(0, 250).map((item: Record<string, unknown>) =>
                Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')])),
              );
              columns = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
            } catch {
              columns = [];
              records = [];
            }
          }

          if (columns.length && records.length) {
            setImportPreview({
              columns,
              fileName: file.name,
              records,
              selectedColumns: columns,
              visible: true,
            });
          }
        });
      }

      window.setTimeout(completeProgress, 2200);
    };

    const handleImportClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const label = button.textContent?.trim() ?? '';
      if (!importActionPattern.test(label)) return;
      if (button.disabled) return;
      startProgress(label ? `${label} in progress...` : 'Import in progress...');
      window.setTimeout(completeProgress, 4500);
    };

    const handleManualProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; progress?: number; done?: boolean }>).detail;
      if (detail?.done) {
        completeProgress();
        return;
      }
      if (!fileProgressVisible) startProgress(detail?.label ?? 'Import in progress...');
      if (typeof detail?.progress === 'number') {
        setFileProgress(Math.max(0, Math.min(100, detail.progress)));
      }
      if (detail?.label) setFileProgressLabel(detail.label);
    };

    window.addEventListener('change', handleFileChange, true);
    window.addEventListener('click', handleImportClick, true);
    window.addEventListener('workspace-import-progress', handleManualProgress as EventListener);

    return () => {
      clearTimers();
      window.removeEventListener('change', handleFileChange, true);
      window.removeEventListener('click', handleImportClick, true);
      window.removeEventListener('workspace-import-progress', handleManualProgress as EventListener);
    };
  }, [fileProgressVisible]);

  const toggleImportPreviewColumn = (column: string, checked: boolean) => {
    setImportPreview((current) => ({
      ...current,
      selectedColumns: checked
        ? Array.from(new Set([...current.selectedColumns, column]))
        : current.selectedColumns.filter((item) => item !== column),
    }));
  };

  const applyImportPreviewColumns = () => {
    const payload = {
      columns: importPreview.selectedColumns,
      fileName: importPreview.fileName,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(importColumnPreferencesKey, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('workspace-import-columns-selected', { detail: payload }));
    setImportPreview((current) => ({ ...current, visible: false }));
  };

  const downloadFilteredImportPreview = () => {
    const csv = recordsToFilteredCsv(importPreview.records, importPreview.selectedColumns);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = importPreview.fileName.replace(/\.[^.]+$/, '') + '-selected-columns.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.10),_transparent_42%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))]" />
      <DataExportOverlay open={exportOpen} onClose={() => setExportOpen(false)} />
      {fileProgressVisible && (
        <div className={`fixed top-3 z-[70] w-[calc(100vw-1.5rem)] max-w-md ${isArabic ? 'left-3 sm:left-5' : 'right-3 sm:right-5'}`}>
          <div className="rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UploadCloud className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">File import progress</p>
                  <p className="truncate text-xs text-muted-foreground">{fileProgressLabel}</p>
                </div>
              </div>
              <span className="text-xs font-black text-primary">{Math.round(fileProgress)}%</span>
            </div>
            <Progress value={fileProgress} className="h-2" />
          </div>
        </div>
      )}
      {importPreview.visible && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-4">
              <div>
                <p className="text-lg font-black">Review import table</p>
                <p className="text-sm text-muted-foreground">
                  {importPreview.fileName} · {importPreview.records.length} rows · {importPreview.selectedColumns.length}/{importPreview.columns.length} columns selected
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportPreview((current) => ({ ...current, selectedColumns: current.columns }))}>Select All</Button>
                <Button variant="outline" size="sm" onClick={() => setImportPreview((current) => ({ ...current, selectedColumns: current.columns.slice(0, 2) }))}>Required Only</Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={downloadFilteredImportPreview} disabled={!importPreview.selectedColumns.length}>
                  <Download className="h-4 w-4" /> Download Selected CSV
                </Button>
                <Button size="sm" onClick={applyImportPreviewColumns} disabled={!importPreview.selectedColumns.length}>Apply Columns</Button>
                <Button variant="ghost" size="icon" onClick={() => setImportPreview((current) => ({ ...current, visible: false }))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="max-h-[32vh] overflow-y-auto border-b p-4 lg:max-h-none lg:border-b-0 lg:border-r">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Optional columns</p>
                <div className="space-y-2">
                  {importPreview.columns.map((column) => (
                    <label key={column} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-2 text-sm">
                      <Checkbox checked={importPreview.selectedColumns.includes(column)} onCheckedChange={(checked) => toggleImportPreviewColumn(column, checked === true)} />
                      <span className="truncate font-medium">{column}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="min-w-0 overflow-auto p-4">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr>
                      {importPreview.selectedColumns.map((column) => (
                        <th key={column} className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="odd:bg-muted/20">
                        {importPreview.selectedColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="max-w-[240px] truncate border-b px-3 py-2 text-muted-foreground" title={row[column]}>
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">Preview shows first 10 rows. Download selected CSV to import only the chosen columns, or Apply Columns to save the selected-column rule for this import session.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <AppSidebar />
      <main
        className={`min-w-0 w-full pb-28 transition-all duration-300 ${
          isArabic
            ? sidebarCollapsed
              ? 'lg:pr-[68px]'
              : 'lg:pr-72'
            : sidebarCollapsed
              ? 'lg:pl-[68px]'
              : 'lg:pl-72'
        }`}
      >
        <div className="mx-auto min-w-0 w-full max-w-[1800px] overflow-x-hidden">
          {children}
        </div>
        <div className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground sm:px-6">
          {`© ${new Date().getFullYear()} ${settings?.branding.appName ?? 'Synergi PM Workspace'} by Haitham Elmohamady`}
        </div>
      </main>
      <div className={`fixed bottom-4 z-40 ${isArabic ? 'left-3 sm:left-4 md:left-8' : 'right-3 sm:right-4 md:right-8'}`}>
        <div className="flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/90 p-2 shadow-xl backdrop-blur-xl sm:max-w-[calc(100vw-2rem)] md:max-w-none">
          <WorkspaceAssistant isArabic={isArabic} />
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Data</span>
          </Button>
          <Button size="sm" variant={location.pathname === '/schedule' ? 'default' : 'outline'} className="gap-2" onClick={() => navigate('/schedule')}>
            <GanttChart className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Button>
          <Button size="sm" variant={location.pathname === '/sticky-notes' ? 'default' : 'outline'} className="gap-2" onClick={() => navigate('/sticky-notes')}>
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Sticky Notes</span>
          </Button>
          <Button size="sm" variant={location.pathname === '/tasks' ? 'default' : 'outline'} className="gap-2" onClick={() => navigate('/tasks')}>
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">To Do</span>
          </Button>
          <Button size="sm" variant={location.pathname === '/team-chat' ? 'default' : 'outline'} className="gap-2" onClick={() => navigate('/team-chat')}>
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Team Chat</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
