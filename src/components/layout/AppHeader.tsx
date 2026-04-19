import { Bell, Search, Plus, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { translateText } from '@/lib/i18n';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

const initialNotifications = [
  { id: 1, title: 'Task overdue', message: '"Design Review" is 2 days overdue', time: '2h ago', read: false },
  { id: 2, title: 'New comment', message: 'Ahmed left a comment on "Sprint Planning"', time: '5h ago', read: false },
  { id: 3, title: 'Project update', message: 'EPM 940 Phase 5 status changed to Active', time: '1d ago', read: false },
];

const AppHeader = ({ title, subtitle }: AppHeaderProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState(initialNotifications);
  const navigate = useNavigate();
  const { data: settings } = useWorkspaceSettings();
  const language = settings?.appearance.language ?? 'en';
  const isArabic = language === 'ar';
  const localizedTitle = useMemo(() => translateText(language, title), [language, title]);
  const localizedSubtitle = useMemo(() => (subtitle ? translateText(language, subtitle) : undefined), [language, subtitle]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const openWorkspaceSearch = (query = search) => {
    window.dispatchEvent(new CustomEvent('workspace-search-open', { detail: { query } }));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className={isArabic ? 'text-right' : ''}>
        <h1 className="text-xl font-semibold tracking-tight">{localizedTitle}</h1>
        {localizedSubtitle && <p className="text-sm text-muted-foreground">{localizedSubtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isArabic ? 'right-3' : 'left-3'}`} />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) openWorkspaceSearch(e.target.value);
            }}
            onFocus={() => openWorkspaceSearch(search)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                openWorkspaceSearch(search);
              }
            }}
            placeholder={translateText(language, 'Search anything...')}
            className={`w-64 bg-muted/50 border-transparent focus:border-primary/30 focus:bg-card ${isArabic ? 'pr-9 text-right' : 'pl-9'}`}
          />
        </div>
        <div className="relative">
          <Button size="sm" variant="outline" className="relative" onClick={() => setOpen((o) => !o)}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">{translateText(language, 'Notifications')}</span>
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <CheckCheck className="h-3 w-3" /> {translateText(language, 'Mark all read')}
                </button>
              </div>
              <ul className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${n.read ? 'opacity-60' : ''}`}
                    onClick={() => markRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      {n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {notifications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">{translateText(language, 'No notifications')}</p>
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          className="gradient-primary text-primary-foreground shadow-glow gap-1.5"
          onClick={() => navigate('/projects?action=create')}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{translateText(language, 'New Project')}</span>
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
