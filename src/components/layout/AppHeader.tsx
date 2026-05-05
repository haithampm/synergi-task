import { Bell, Search, Plus, CheckCheck, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditLogs, useTasks, useWorkspaceSettings } from '@/hooks/useProjects';
import { translateText } from '@/lib/i18n';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

const entityPathMap: Record<string, string> = {
  project: '/projects',
  task: '/tasks',
  ticket: '/tickets',
  team: '/team',
  meeting: '/calendar',
  event: '/calendar',
  chat: '/team-chat',
  document: '/documents',
  settings: '/settings',
  user: '/settings',
  'sticky-note': '/sticky-notes',
};

const formatRelativeTime = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (60 * 1000)));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const AppHeader = ({ title, subtitle }: AppHeaderProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { data: settings } = useWorkspaceSettings();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: tasks = [] } = useTasks();
  const language = settings?.appearance.language ?? 'en';
  const isArabic = language === 'ar';
  const localizedTitle = useMemo(() => translateText(language, title), [language, title]);
  const localizedSubtitle = useMemo(() => (subtitle ? translateText(language, subtitle) : undefined), [language, subtitle]);

  const notifications = useMemo(() => {
    if (settings?.notifications.inApp === false) return [];
    const overdueTaskItems = tasks
      .filter((task) => {
        const dueDate = task.due_date ?? task.dueDate;
        return dueDate && new Date(dueDate) < new Date() && task.status !== 'done';
      })
      .slice(0, 3)
      .map((task) => ({
        id: `task-overdue-${task.id}`,
        title: 'Task overdue',
        message: `${task.title} is overdue for ${task.assignee || 'the assigned owner'}.`,
        time: task.due_date ?? task.dueDate ?? new Date().toISOString(),
        path: `/tasks?projectId=${task.project_id ?? task.projectId ?? ''}`,
      }));

    const auditItems = auditLogs.slice(0, 7).map((log) => ({
      id: `audit-${log.id}`,
      title: log.action,
      message: log.detail,
      time: log.createdAt,
      path: entityPathMap[log.entityType] ?? '/app-monitor',
    }));

    return [...overdueTaskItems, ...auditItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [auditLogs, settings?.notifications.inApp, tasks]);

  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length;
  const markAllRead = () => setReadIds(notifications.map((notification) => notification.id));
  const markRead = (id: string) => setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const openWorkspaceSearch = (query = search) => window.dispatchEvent(new CustomEvent('workspace-search-open', { detail: { query } }));

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 px-3 py-3 backdrop-blur-xl sm:px-4 lg:px-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex min-h-[64px] w-full max-w-[1800px] flex-col gap-3 rounded-2xl border border-border/60 bg-card/85 px-3 py-3 shadow-sm backdrop-blur sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : ''}`}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="lg:hidden" onClick={() => window.dispatchEvent(new CustomEvent('workspace-sidebar-toggle'))}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{localizedTitle}</h1>
              {localizedSubtitle && <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{localizedSubtitle}</p>}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap lg:gap-3">
          <div className="relative hidden min-w-[220px] flex-1 md:block lg:w-72 lg:flex-none">
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
              className={`h-10 w-full rounded-xl bg-muted/50 border-transparent focus:border-primary/30 focus:bg-card ${isArabic ? 'pr-9 text-right' : 'pl-9'}`}
            />
          </div>
          <div className="relative">
            <Button size="sm" variant="outline" className="relative h-10 rounded-xl" onClick={() => setOpen((o) => !o)}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{unreadCount}</span>}
            </Button>
            {open && (
              <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-semibold text-sm">{translateText(language, 'Notifications')}</span>
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <CheckCheck className="h-3 w-3" /> {translateText(language, 'Mark all read')}
                  </button>
                </div>
                <ul className="max-h-72 overflow-y-auto divide-y divide-border">
                  {notifications.map((n) => (
                    <li key={n.id} className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${readIds.includes(n.id) ? 'opacity-60' : ''}`} onClick={() => { markRead(n.id); if (n.path) { navigate(n.path); setOpen(false); } }}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${readIds.includes(n.id) ? '' : 'bg-primary'}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{n.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(n.time)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {notifications.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{translateText(language, 'No notifications')}</p>}
              </div>
            )}
          </div>
          <Button size="sm" className="h-10 gap-1.5 rounded-xl gradient-primary text-primary-foreground shadow-glow" onClick={() => { if (window.location.pathname === '/projects') { window.dispatchEvent(new CustomEvent('open-create-project')); } else { navigate('/projects'); setTimeout(() => window.dispatchEvent(new CustomEvent('open-create-project')), 500); } }}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{translateText(language, 'New Project')}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
