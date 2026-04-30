import { useEffect, useState } from 'react';
import { BadgePlus, Download, FileDown, FileUp, GitMerge, RefreshCcw, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WorkspaceImportMode = 'merge' | 'update-only' | 'create-only';

const importModeStorageKey = 'synergi-import-mode';
const importExportPath = '/import-export';

const modeOptions: Array<{
  value: WorkspaceImportMode;
  label: string;
  description: string;
  icon: typeof GitMerge;
}> = [
  {
    value: 'merge',
    label: 'Merge',
    description: 'Update matching records and create missing records.',
    icon: GitMerge,
  },
  {
    value: 'update-only',
    label: 'Update only',
    description: 'Update existing records only. Skip records that do not already exist.',
    icon: RefreshCcw,
  },
  {
    value: 'create-only',
    label: 'Create new',
    description: 'Create new records only. Skip records that already exist.',
    icon: BadgePlus,
  },
];

export const getStoredImportMode = (): WorkspaceImportMode => {
  if (typeof window === 'undefined') return 'merge';
  const stored = window.localStorage.getItem(importModeStorageKey);
  return stored === 'update-only' || stored === 'create-only' || stored === 'merge' ? stored : 'merge';
};

const getCurrentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname);

const ImportModeSelector = () => {
  const [mode, setMode] = useState<WorkspaceImportMode>(() => getStoredImportMode());
  const [currentPath, setCurrentPath] = useState(getCurrentPath);

  useEffect(() => {
    window.localStorage.setItem(importModeStorageKey, mode);
    window.dispatchEvent(new CustomEvent('workspace-import-mode-changed', { detail: { mode } }));
  }, [mode]);

  useEffect(() => {
    const updatePath = () => setCurrentPath(getCurrentPath());
    window.addEventListener('popstate', updatePath);
    window.addEventListener('hashchange', updatePath);
    window.addEventListener('workspace-route-changed', updatePath as EventListener);

    const clickTimer = window.setTimeout(updatePath, 0);
    const handleClick = () => window.setTimeout(updatePath, 0);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.clearTimeout(clickTimer);
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('hashchange', updatePath);
      window.removeEventListener('workspace-route-changed', updatePath as EventListener);
      window.removeEventListener('click', handleClick, true);
    };
  }, []);

  if (currentPath !== importExportPath) return null;

  return (
    <div className="fixed left-1/2 top-20 z-[75] w-[calc(100vw-1.5rem)] max-w-5xl -translate-x-1/2 rounded-3xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">Import / Export controls</p>
            <p className="truncate text-xs text-muted-foreground">Choose import behavior, then use the page sections below for file import and data export.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
            <FileUp className="h-3.5 w-3.5" /> Import: {modeOptions.find((option) => option.value === mode)?.label ?? 'Merge'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
            <FileDown className="h-3.5 w-3.5" /> Export ready
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-2 sm:grid-cols-3">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const active = mode === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="h-auto justify-start gap-2 rounded-2xl px-3 py-2 text-left"
                onClick={() => setMode(option.value)}
                title={option.description}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black">{option.label}</span>
                  <span className="block truncate text-[10px] opacity-75">{option.description}</span>
                </span>
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/20 p-2">
          <a href="#import-data" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-black text-foreground hover:bg-muted">
            <FileUp className="h-4 w-4 text-primary" /> Import
          </a>
          <a href="#export-data" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-black text-foreground hover:bg-muted">
            <Download className="h-4 w-4 text-primary" /> Export
          </a>
        </div>
      </div>
    </div>
  );
};

export default ImportModeSelector;
