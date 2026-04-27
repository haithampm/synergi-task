import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, MessageSquare,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut, FileUp, GanttChart, Files, BriefcaseBusiness, StickyNote, User, Activity, Shield, Ticket, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings, useProjects, useTasks, useTickets } from '@/hooks/useProjects';
import { hasWorkspacePermission } from '@/lib/workspace-access';

const navSections = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permission: 'view_dashboard' },
      { icon: BarChart3, label: 'Reports', path: '/reports', permission: 'view_reports' },
    ],
  },
  {
    title: 'Management',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects', permission: 'manage_projects', countKey: 'projects' },
      { icon: GanttChart, label: 'Schedule', path: '/schedule', permission: 'manage_schedule' },
      { icon: CheckSquare, label: 'To Do', path: '/tasks', permission: 'manage_tasks', countKey: 'tasks' },
      { icon: Files, label: 'Documents', path: '/documents', permission: 'manage_documents' },
      { icon: BriefcaseBusiness, label: 'Resources', path: '/resources', permission: 'manage_resources' },
      { icon: Ticket, label: 'Tickets', path: '/tickets', permission: 'manage_tasks', countKey: 'tickets' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { icon: Users, label: 'Team', path: '/team', permission: 'manage_team' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat', permission: 'team_chat' },
      { icon: MessageSquare, label: 'AI Agent', path: '/ai-chat', highlight: true },
      { icon: StickyNote, label: 'Sticky Notes', path: '/sticky-notes' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Shield, label: 'User Accounts', path: '/user-accounts', permission: 'manage_users', countKey: 'users' },
      { icon: Activity, label: 'App Monitor', path: '/app-monitor', permission: 'manage_integrations' },
      { icon: FileUp, label: 'Import/Export', path: '/import-export', permission: 'export' },
      { icon: Settings, label: 'Settings', path: '/settings', permission: 'manage_privileges' },
    ],
  },
];

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const AppSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const { data: userAccounts = [] } = useUserAccounts();
  const updateSettings = useUpdateWorkspaceSettings();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const [collapsed, setCollapsed] = useState(settings?.appearance.sidebarCollapsed ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isArabic = settings?.appearance.language === 'ar';

  const counts: Record<string, number> = {
    projects: projects.length,
    tasks: tasks.length,
    tickets: tickets.length,
    users: userAccounts.length,
  };

  const currentUserAccount = useMemo(
    () =>
      userAccounts.find((account) => account.id === settings?.currentUser.userAccountId) ??
      userAccounts.find((account) => normalizeText(account.email) === normalizeText(user?.email ?? settings?.profile.email)),
    [settings?.currentUser.userAccountId, settings?.profile.email, user?.email, userAccounts],
  );

  const currentRoleId = currentUserAccount?.roleId ?? settings?.currentUser.roleId;

  const filteredSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            hasWorkspacePermission(currentRoleId, settings?.privilegeRoles, item.permission),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [currentRoleId, settings?.privilegeRoles],
  );

  const activeProfileName = currentUserAccount?.fullName ?? settings?.currentUser.displayName ?? 'Workspace User';
  const activeProfileEmail = user?.email ?? currentUserAccount?.email ?? settings?.profile.email ?? '';
  const activeRoleLabel = settings?.privilegeRoles.find((role) => role.id === currentRoleId)?.name ?? currentRoleId ?? 'Workspace User';
  const initials = activeProfileName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'WU';

  const sideClasses = useMemo(
    () =>
      isArabic
        ? collapsed
          ? 'lg:right-0 lg:w-16'
          : 'lg:right-0 lg:w-64'
        : collapsed
          ? 'lg:left-0 lg:w-16'
          : 'lg:left-0 lg:w-64',
    [collapsed, isArabic],
  );

  useEffect(() => {
    if (settings) {
      setCollapsed(settings.appearance.sidebarCollapsed);
    }
  }, [settings]);

  useEffect(() => {
    const handleSidebarToggle = () => {
      setMobileOpen((current) => !current);
    };
    window.addEventListener('workspace-sidebar-toggle', handleSidebarToggle);
    return () => window.removeEventListener('workspace-sidebar-toggle', handleSidebarToggle);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleSidebar = async () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    if (settings) {
      await updateSettings.mutateAsync({
        ...settings,
        appearance: {
          ...settings.appearance,
          sidebarCollapsed: nextState,
        },
      });
    }
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          sideClasses
        } ${mobileOpen ? 'translate-x-0' : isArabic ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border min-h-[56px]">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2 font-bold text-sm text-sidebar-foreground truncate">
              <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {(settings?.branding.appName || 'IMS').slice(0, 2).toUpperCase()}
              </span>
              <span>{settings?.branding.appName || 'IMS'}</span>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="ml-auto h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Mobile close */}
        <button
          className="absolute top-3 right-3 lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-1">
          {filteredSections.map((section) => (
            <div key={section.title} className="px-2">
              {!collapsed && (
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const count = item.countKey ? counts[item.countKey] : undefined;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : item.highlight
                          ? 'text-purple-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {count !== undefined && count > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User profile */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{activeProfileName}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{activeProfileEmail}</p>
                <p className="text-[10px] text-primary/80 truncate">{activeRoleLabel}</p>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Link to="/settings" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground h-8">
                <User className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="ml-2 text-xs">Profile</span>}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="flex-1 justify-start text-sidebar-foreground/70 hover:text-destructive h-8">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && <span className="ml-2 text-xs">Sign Out</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
