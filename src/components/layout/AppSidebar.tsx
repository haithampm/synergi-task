import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, MessageSquare,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut, FileUp, GanttChart, Files, BriefcaseBusiness, StickyNote, User, Activity, Shield, Ticket, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings } from '@/hooks/useProjects';
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
      { icon: FolderKanban, label: 'Projects', path: '/projects', permission: 'manage_projects' },
      { icon: GanttChart, label: 'Schedule', path: '/schedule', permission: 'manage_schedule' },
      { icon: CheckSquare, label: 'To Do', path: '/tasks', permission: 'manage_tasks' },
      { icon: Files, label: 'Documents', path: '/documents', permission: 'manage_documents' },
      { icon: BriefcaseBusiness, label: 'Resources', path: '/resources', permission: 'manage_resources' },       { icon: Ticket, label: 'Tickets', path: '/tickets', permission: 'manage_tasks' },
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
      { icon: Shield, label: 'User Accounts', path: '/user-accounts', permission: 'manage_users' },
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
  const [collapsed, setCollapsed] = useState(settings?.appearance.sidebarCollapsed ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isArabic = settings?.appearance.language === 'ar';
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
  const activeRoleLabel =
    settings?.privilegeRoles.find((role) => role.id === currentRoleId)?.name ?? currentRoleId ?? 'Workspace User';
  const initials =
    activeProfileName
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
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 z-50 flex flex-col border-r bg-sidebar/95 shadow-2xl backdrop-blur transition-transform duration-300 ${sideClasses} ${
          mobileOpen
            ? 'translate-x-0'
            : isArabic
              ? 'translate-x-full lg:translate-x-0'
              : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          {!collapsed && <span className="truncate text-lg font-bold">{settings?.branding.appName || 'IMS'}</span>}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:inline-flex">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-6">
              {!collapsed && (
                <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1 px-2">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={
                      item.path === '/dashboard'
                        ? location.pathname === '/dashboard'
                          ? 'page'
                          : undefined
                        : location.pathname.startsWith(item.path)
                          ? 'page'
                          : undefined
                    }
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                      ((item.path === '/dashboard' && location.pathname === '/dashboard') || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)))
                        ? 'bg-accent text-accent-foreground font-medium shadow-sm'
                        : 'text-muted-foreground'
                    } ${item.highlight ? 'text-primary' : ''}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <div className={`mb-3 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-3 py-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{activeProfileName}</p>
                <p className="truncate text-xs text-muted-foreground">{activeProfileEmail}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{activeRoleLabel}</p>
              </div>
            )}
          </div>
          <Link
            to="/profile"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent ${
              location.pathname === '/profile' ? 'bg-accent' : ''
            }`}
          >
            <User className="h-4 w-4" />
            {!collapsed && <span>Profile</span>}
          </Link>
          <Button variant="ghost" className="mt-1 w-full justify-start gap-3 rounded-xl" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
