import { useEffect, useState } from 'react';
import { BadgePlus, Download, FileUp, GitMerge, RefreshCcw, UploadCloud } from 'lucide-react';
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
    description: 'Update existing records only. Skip new records.',
    icon: RefreshCcw,
  },
  {
    value: 'create-only',
    label: 'Create new',
    description: 'Create new records only. Skip existing records.',
    icon: BadgePlus,
  },
];

export const getStoredImportMode = (): WorkspaceImportMode => {
  if (typeof window === 'undefined') return 'merge';
  const stored = window.localStorage.getItem(importModeStorageKey);
  return stored === 'update-only' || stored === 'create-only' || stored === 'merge' ? stored : 'merge';
};

const getCurrentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/$/, '') || '/');

const ImportModeSelector = () => {
  const [mode, setMode] = useState<WorkspaceImportMode>(() => getStoredImportMode());
  const [currentPath, setCurrentPath] = useState(getCurrentPath);

  useEffect(() => {
    window.localStorage.setItem(importModeStorageKey, mode);
    window.dispatchEvent(new CustomEvent('workspace-import-mode-changed', { detail: { mode } }));
  }, [mode]);

  useEffect(() => {
    const updatePath = () => setCurrentPath(getCurrentPath());
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

  if (currentPath !== importExportPath) return null;

  return (
    <div className="fixed right-4 top-24 z-[55] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black">Import / Export controls</p>
          <p className="text-xs text-muted-foreground">Page tools only. Select how import should apply rows.</p>
        </div>
      </div>

      <div className="space-y-2">
        {modeOptions.map((option) => {
          const Icon = option.icon;
          const active = mode === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-2xl px-3 py-2 text-left"
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

      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
        <a href="#import-data" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-black text-foreground hover:bg-muted">
          <FileUp className="h-4 w-4 text-primary" /> Import
        </a>
        <a href="#export-data" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-black text-foreground hover:bg-muted">
          <Download className="h-4 w-4 text-primary" /> Export
        </a>
      </div>
    </div>
  );
};

export default ImportModeSelector;
