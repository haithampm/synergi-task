import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, ShieldCheck, Users } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUpdateWorkspaceSettings, useUserAccounts, useWorkspaceSettings } from '@/hooks/useProjects';
import type { WorkspacePermissionRole } from '@/lib/workspace-store';
import { toast } from 'sonner';

const permissionCatalog = [
  {
    group: 'Dashboard & Reports',
    items: [
      { key: 'view_dashboard', label: 'View Dashboard', description: 'Open dashboard and see workspace summary.' },
      { key: 'view_reports', label: 'View Reports', description: 'Open reports and analytics.' },
      { key: 'export', label: 'Export Data', description: 'Use export and download actions.' },
    ],
  },
  {
    group: 'Projects & Delivery',
    items: [
      { key: 'manage_projects', label: 'Manage Projects', description: 'Create, edit, archive, and open project records.' },
      { key: 'manage_schedule', label: 'Manage Schedule', description: 'Open schedule, generate plans, sync dates, and edit schedule items.' },
      { key: 'manage_tasks', label: 'Manage Tasks & Tickets', description: 'Create and update tasks and support tickets.' },
      { key: 'manage_documents', label: 'Manage Documents', description: 'Generate, upload, and manage project documents.' },
      { key: 'manage_resources', label: 'Manage Resources', description: 'Manage resources, capacity, and assignment views.' },
    ],
  },
  {
    group: 'People & Collaboration',
    items: [
      { key: 'manage_team', label: 'Manage Team', description: 'Create and update team profiles.' },
      { key: 'manage_users', label: 'Manage User Access', description: 'Manage user accounts, status, and role assignment.' },
      { key: 'team_chat', label: 'Team Chat', description: 'Use project and team chat channels.' },
      { key: 'moderate_channels', label: 'Moderate Channels', description: 'Moderate shared channels and pinned messages.' },
      { key: 'share', label: 'Share Workspace Items', description: 'Share project records, files, and updates.' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { key: 'manage_workflows', label: 'Manage Workflows', description: 'Edit workflow stages and SLA rules.' },
      { key: 'manage_privileges', label: 'Manage Settings & Permissions', description: 'Edit workspace settings, roles, and permission policies.' },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure integrations, app monitor, and sync settings.' },
    ],
  },
];

const allPermissionItems = permissionCatalog.flatMap((group) => group.items);

const cloneRoles = (roles: WorkspacePermissionRole[] = []) =>
  roles.map((role) => ({ ...role, permissions: Array.from(new Set(role.permissions ?? [])) }));

const Permissions = () => {
  const { data: settings } = useWorkspaceSettings();
  const { data: userAccounts = [] } = useUserAccounts();
  const updateSettings = useUpdateWorkspaceSettings();
  const [roles, setRoles] = useState<WorkspacePermissionRole[]>([]);

  useEffect(() => {
    setRoles(cloneRoles(settings?.privilegeRoles ?? []));
  }, [settings?.privilegeRoles]);

  const roleUsage = useMemo(
    () => roles.reduce<Record<string, number>>((acc, role) => {
      acc[role.id] = userAccounts.filter((account) => account.roleId === role.id).length;
      return acc;
    }, {}),
    [roles, userAccounts],
  );

  const togglePermission = (roleId: string, permissionKey: string) => {
    setRoles((current) =>
      current.map((role) => {
        if (role.id !== roleId) return role;
        const hasPermission = role.permissions.includes(permissionKey);
        return {
          ...role,
          permissions: hasPermission
            ? role.permissions.filter((permission) => permission !== permissionKey)
            : [...role.permissions, permissionKey],
        };
      }),
    );
  };

  const updateRoleName = (roleId: string, name: string) => {
    setRoles((current) => current.map((role) => (role.id === roleId ? { ...role, name } : role)));
  };

  const savePermissions = async () => {
    if (!settings) return;
    await updateSettings.mutateAsync({
      ...settings,
      privilegeRoles: roles.map((role) => ({
        ...role,
        name: role.name.trim() || role.id,
        permissions: Array.from(new Set(role.permissions)),
      })),
    });
    toast.success('Role permissions updated');
  };

  if (!settings) return null;

  return (
    <AppLayout>
      <AppHeader title="Permission Settings" subtitle="Control user role access for every major workspace page and function." />
      <div className="space-y-6 p-4 animate-fade-in sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Settings
            </Button>
          </Link>
          <Button className="gap-2" onClick={savePermissions} disabled={updateSettings.isPending}>
            <Save className="h-4 w-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Permissions'}
          </Button>
        </div>

        <PageSection
          title="Role Permission Matrix"
          description="Enable or disable access by role. These permissions control sidebar visibility and protected workspace functions that use the role policy."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roles.map((role) => (
            <Card key={role.id} className="glass">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                    <p className="font-bold">{role.name}</p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3.5 w-3.5" /> {roleUsage[role.id] ?? 0}
                  </Badge>
                </div>
                <p className="mt-3 text-2xl font-black">{role.permissions.length}</p>
                <p className="text-xs text-muted-foreground">enabled permissions</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Access by Role
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Function / Access</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.id} className="min-w-[180px]">
                        <Input
                          value={role.name}
                          onChange={(event) => updateRoleName(role.id, event.target.value)}
                          className="h-8 font-semibold"
                          aria-label={`Role name for ${role.id}`}
                        />
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{role.id}</p>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionCatalog.map((group) => (
                    <>
                      <TableRow key={group.group} className="bg-muted/25">
                        <TableCell colSpan={roles.length + 1} className="py-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                          {group.group}
                        </TableCell>
                      </TableRow>
                      {group.items.map((permission) => (
                        <TableRow key={permission.key}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold">{permission.label}</p>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                              <Badge variant="outline" className="text-[10px]">{permission.key}</Badge>
                            </div>
                          </TableCell>
                          {roles.map((role) => (
                            <TableCell key={`${role.id}-${permission.key}`}>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={role.permissions.includes(permission.key)}
                                  onCheckedChange={() => togglePermission(role.id, permission.key)}
                                  disabled={role.id === 'admin' && permission.key === 'manage_privileges'}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {role.permissions.includes(permission.key) ? 'Allowed' : 'Blocked'}
                                </span>
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-semibold">Configured permission keys</p>
            <div className="flex flex-wrap gap-2">
              {allPermissionItems.map((permission) => (
                <Badge key={permission.key} variant="outline">{permission.key}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Changes are saved to workspace settings and are used by role checks such as sidebar visibility, settings access, project management, schedule, documents, team chat, and administration functions.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Permissions;
