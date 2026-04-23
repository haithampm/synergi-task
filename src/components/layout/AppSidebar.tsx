import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, MessageSquare,
  BarChart3, Ticket, Settings, ChevronLeft, ChevronRight, Sparkles,
  Sun, Moon, LogOut, Search, FileUp, GanttChart, CalendarDays, Files, BriefcaseBusiness, StickyNote, User, Activity, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateWorkspaceSettings, useWorkspaceSettings } from '@/hooks/useProjects';
import { translateText } from '@/lib/i18n';

const navSections = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: BarChart3, label: 'Reports', path: '/reports' },
    ],
  },
  {
    title: 'Management',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: GanttChart, label: 'Schedule', path: '/schedule' },
      { icon: CheckSquare, label: 'To Do', path: '/tasks' },
      { icon: Files, label: 'Documents', path: '/documents' },
      { icon: BriefcaseBusiness, label: 'Resources', path: '/resources' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { icon: Users, label: 'Team', path: '/team' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
      { icon: MessageSquare, label: 'AI Agent', path: '/ai-chat', highlight: true },
      { icon: StickyNote, label: 'Sticky Notes', path: '/sticky-notes' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Shield, label: 'User Accounts', path: '/user-accounts' },
      { icon: Activity, label: 'App Monitor', path: '/app-monitor' },
      { icon: FileUp, label: 'Import/Export', path: '/import-export' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const [collapsed, setCollapsed] = useState(settings?.appearance.sidebarCollapsed ?? false);

  useEffect(() => {
    if (settings) {
      setCollapsed(settings.appearance.sidebarCollapsed);
    }
  }, [settings]);

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
    <div className={`flex flex-col h-full bg-sidebar border-r transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && <span className="font-bold text-lg truncate">{settings?.branding.appName || 'IMS'}</span>}
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</h3>}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${location.pathname === item.path ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'} ${item.highlight ? 'text-primary' : ''}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <Link
          to="/profile"
          className={`flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors hover:bg-accent ${location.pathname === '/profile' ? 'bg-accent' : ''}`}
        >
          <User className="h-4 w-4" />
          {!collapsed && <span>Profile</span>}
        </Link>
        <Button variant="ghost" className="w-full justify-start gap-3 mt-1" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
};

export default AppSidebar;
