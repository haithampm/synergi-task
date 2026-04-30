import { useEffect, useState } from 'react';
import { BadgePlus, GitMerge, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WorkspaceImportMode = 'merge' | 'update-only' | 'create-only';

const importModeStorageKey = 'synergi-import-mode';

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

const ImportModeSelector = () => {
  const [mode, setMode] = useState<WorkspaceImportMode>(() => getStoredImportMode());

  useEffect(() => {
    window.localStorage.setItem(importModeStorageKey, mode);
    window.dispatchEvent(new CustomEvent('workspace-import-mode-changed', { detail: { mode } }));
  }, [mode]);

  return (
    <div className="fixed left-1/2 top-20 z-[75] w-[calc(100vw-1.5rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Import mode</p>
          <p className="text-xs text-muted-foreground">Choose how imported rows are applied before importing data.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">
          {modeOptions.find((option) => option.value === mode)?.label ?? 'Merge'}
        </span>
      </div>
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
              className="h-auto justify-start gap-2 rounded-xl px-3 py-2 text-left"
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
    </div>
  );
};

export default ImportModeSelector;
