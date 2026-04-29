import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, MessageSquare,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut, FileUp, GanttChart, Files, BriefcaseBusiness, StickyNote, User, Activity, Ticket, X, ShieldCheck, UserCog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMeetings, useProjects, useStickyNotes, useTasks, useTickets, useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings } from '@/hooks/useProjects';
import { hasWorkspacePermission } from '@/lib/workspace-access';

const adminEmails = ['haitham.pm@gmail.com', 'haitham.pm@hotmail.com'];

const navSections = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permission: 'view_dashboard', countKey: 'dashboard', important: true },
      { icon: BarChart3, label: 'Reports', path: '/reports', permission: 'view_reports' },
    ],
  },
  {
    title: 'Management',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects', permission: 'manage_projects', countKey: 'projects' },
      { icon: GanttChart, label: 'Schedule', path: '/schedule', permission: 'manage_schedule', countKey: 'schedule', important: true },
      { icon: CheckSquare, label: 'To Do', path: '/tasks', permission: 'manage_tasks', countKey: 'tasks' },
      { icon: Files, label: 'Documents', path: '/documents', permission: 'manage_documents', countKey: 'documents' },
      { icon: BriefcaseBusiness, label: 'Resources', path: '/resources', permission: 'manage_resources' },
      { icon: Ticket, label: 'Tickets', path: '/tickets', permission: 'manage_tasks', countKey: 'tickets', important: true },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { icon: Users, label: 'Team', path: '/team', permission: 'manage_team' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat', permission: 'team_chat' },
      { icon: MessageSquare, label: 'AI Agent', path: '/ai-chat', highlight: true },
      { icon: StickyNote, label: 'Sticky Notes', path: '/sticky-notes', countKey: 'notes', important: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: UserCog, label: 'User Accounts', path: '/user-accounts', permission: 'manage_users', countKey: 'users', important: true, adminOnly: true },
      { icon: ShieldCheck, label: 'Permissions', path: '/settings/permissions', permission: 'manage_privileges', important: true, adminOnly: true },
      { icon: Settings, label: 'Settings', path: '/settings', permission: 'manage_privileges', important: true, adminOnly: true },
      { icon: Activity, label: 'App Monitor', path: '/app-monitor', permission: 'manage_integrations', adminOnly: true },
      { icon: FileUp, label: 'Import/Export', path: '/import-export', permission: 'export' },
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
  const { data: meetings = [] } = useMeetings();
  const { data: stickyNotes = [] } = useStickyNotes();
  const [collapsed, setCollapsed] = useState(settings?.appearance.sidebarCollapsed ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isArabic = settings?.appearance.language === 'ar';

  const counts: Record<string, number> = {
    dashboard: projects.length + tasks.length + tickets.length,
    projects: projects.length,
    schedule: meetings.length,
    tasks: tasks.length,
    documents: projects.reduce((sum, project) => sum + (project.documents?.length ?? 0) + (project.files?.length ?? 0), 0),
    tickets: tickets.length,
    notes: stickyNotes.length,
    users: userAccounts.length,
  };

  const currentUserAccount = useMemo(
    () =>
      userAccounts.find((account) => account.id === settings?.currentUser.userAccountId) ??
      userAccounts.find((account) => normalizeText(account.email) === normalizeText(user?.email ?? settings?.profile.email)),
    [settings?.currentUser.userAccountId, settings?.profile.email, user?.email, userAccounts],
  );

  const currentEmail = normalizeText(user?.email ?? currentUserAccount?.email ?? settings?.profile.email);
  const currentRoleId = currentUserAccount?.roleId ?? settings?.currentUser.roleId;
  const isKnownAdmin = adminEmails.includes(currentEmail);
  const isAdminRole = ['admin', 'super_admin', 'organization_admin', 'project_admin'].includes(normalizeText(currentRoleId));
  const canSeeAdmin = isKnownAdmin || isAdminRole || hasWorkspacePermission(currentRoleId, settings?.privilegeRoles, 'manage_privileges');

  const filteredSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (item.adminOnly && canSeeAdmin) return true;
            return hasWorkspacePermission(currentRoleId, settings?.privilegeRoles, item.permission);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [canSeeAdmin, currentRoleId, settings?.privilegeRoles],
  );

  const activeProfileName = currentUserAccount?.fullName ?? settings?.currentUser.displayName ?? 'Workspace User';
  const activeProfileEmail = user?.email ?? currentUserAccount?.email ?? settings?.profile.email ?? '';
  const activeRoleLabel = isKnownAdmin ? 'Admin' : settings?.privilegeRoles.find((role) => role.id === currentRoleId)?.name ?? currentRoleId ?? 'Workspace User';
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
          : 'lg:right-0 lg:w-72'
        : collapsed
          ? 'lg:left-0 lg:w-16'
          : 'lg:left-0 lg:w-72',
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 z-50 flex flex-col border-r border-sidebar-border/80 bg-sidebar/95 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all duration-300 ${
          sideClasses
        } ${mobileOpen ? 'translate-x-0' : isArabic ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border/80 bg-gradient-to-r from-primary/15 via-sidebar to-sidebar px-4 py-3 min-h-[64px]">
          {!collapsed && (
            <Link to="/dashboard" className="flex min-w-0 items-center gap-3 text-sidebar-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-black text-primary-foreground shadow-lg shadow-primary/20">
                {(settings?.branding.appName || 'IMS').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-black tracking-tight">{settings?.branding.appName || 'IMS'}</span>
                <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">Workspace menu</span>
              </span>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="ml-auto h-8 w-8 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <button
          className="absolute top-3 right-3 lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {filteredSections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-sidebar-border/40 bg-sidebar-foreground/[0.025] px-2 py-2">
              {!collapsed && (
                <p className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/45">
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
                    title={collapsed ? item.label : undefined}
                    className={`group relative mb-1 flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-primary/20'
                        : item.highlight
                          ? 'text-purple-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          : item.important
                            ? 'text-sidebar-foreground hover:bg-primary/10 hover:text-primary'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : item.important
                          ? 'bg-primary/10 text-primary'
                          : 'bg-sidebar-foreground/5 text-sidebar-foreground/70 group-hover:bg-sidebar-foreground/10'
                    }`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate tracking-tight">{item.label}</span>
                        {count !== undefined && (
                          <span className={`ml-auto flex h-6 min-w-[28px] items-center justify-center rounded-full px-2 text-[11px] font-black ${
                            item.important
                              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                              : 'bg-primary/15 text-primary'
                          }`}>
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

        <div className="border-t border-sidebar-border/80 bg-gradient-to-r from-sidebar to-sidebar-accent/20 px-3 py-3">
          <div className="flex items-center gap-3 mb-2 rounded-2xl border border-sidebar-border/50 bg-sidebar-foreground/[0.035] p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground shadow-md shadow-primary/20">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-sidebar-foreground">{activeProfileName}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">{activeProfileEmail}</p>
                <p className="truncate text-[11px] font-bold text-primary/90">{activeRoleLabel}</p>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Link to="/settings" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground h-9">
                <User className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="ml-2 text-xs font-bold">Profile</span>}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="flex-1 justify-start rounded-xl text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive h-9">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && <span className="ml-2 text-xs font-bold">Sign Out</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
