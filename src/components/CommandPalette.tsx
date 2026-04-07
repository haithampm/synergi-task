import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const commands = [
  { label: 'Go to Dashboard', path: '/', section: 'Navigation' },
  { label: 'Go to Projects', path: '/projects', section: 'Navigation' },
  { label: 'Go to Tasks', path: '/tasks', section: 'Navigation' },
  { label: 'Go to Team', path: '/team', section: 'Navigation' },
  { label: 'Go to AI Agent', path: '/ai-chat', section: 'Navigation' },
  { label: 'Go to Reports', path: '/reports', section: 'Navigation' },
  { label: 'Go to Tickets', path: '/tickets', section: 'Navigation' },
  { label: 'Go to Settings', path: '/settings', section: 'Navigation' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const filtered = commands.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered.reduce((acc, cmd) => {
    (acc[cmd.section] = acc[cmd.section] || []).push(cmd);
    return acc;
  }, {} as Record<string, typeof commands>);

  const runCommand = (path: string) => {
    navigate(path);
    setOpen(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {Object.entries(grouped).map(([section, cmds]) => (
            <div key={section}>
              <p className="px-4 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{section}</p>
              {cmds.map(cmd => (
                <button
                  key={cmd.path}
                  onClick={() => runCommand(cmd.path)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span>{cmd.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No results found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
