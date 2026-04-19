import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { translateText } from '@/lib/i18n';
import { getWorkspaceSearchResults } from '@/lib/workspace-search';

type SearchOpenEvent = CustomEvent<{ query?: string }>;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data: settings } = useWorkspaceSettings();
  const language = settings?.appearance.language ?? 'en';
  const isArabic = language === 'ar';

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    const openListener = (event: Event) => {
      const detail = (event as SearchOpenEvent).detail;
      setSearch(detail?.query ?? '');
      setOpen(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('workspace-search-open', openListener as EventListener);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('workspace-search-open', openListener as EventListener);
    };
  }, [handleKeyDown]);

  const filtered = useMemo(() => getWorkspaceSearchResults(search), [search]);
  const grouped = filtered.reduce((acc, result) => {
    (acc[result.section] = acc[result.section] || []).push(result);
    return acc;
  }, {} as Record<string, typeof filtered>);

  const runCommand = (path: string) => {
    navigate(path);
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={translateText(language, 'Type a command or search...')}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[28rem] overflow-y-auto py-2">
          {Object.entries(grouped).map(([section, results]) => (
            <div key={section}>
              <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {translateText(language, section)}
              </p>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => runCommand(result.path)}
                  className="w-full px-4 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className={`flex items-start justify-between gap-3 ${isArabic ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-1">
                      <p className="font-medium">{translateText(language, result.title)}</p>
                      <p className="text-xs text-muted-foreground">{translateText(language, result.subtitle)}</p>
                      {result.preview && (
                        <p className="line-clamp-1 text-xs text-muted-foreground/80">{result.preview}</p>
                      )}
                    </div>
                    <ArrowRight className={`mt-1 h-3 w-3 shrink-0 text-muted-foreground ${isArabic ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{translateText(language, 'No results found.')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
