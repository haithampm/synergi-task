import { useEffect, useMemo, useState } from 'react';
import { Bell, Palette, Shield, User, Workflow, LayoutDashboard, KeyRound, Building2, MailPlus, Pencil, ShieldCheck, Users } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useAuditLogs,
  useCreateDashboard,
  useCreateUserAccount,
  useDashboards,
  useProjectTemplates,
  useTeamMembers,
  useUpdateDashboard,
  useUpdateUserAccount,
  useUpdateWorkflow,
  useUpdateWorkspaceSettings,
  useUserAccounts,
  useWorkflows,
  useWorkspaceSettings,
} from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { languageLabel } from '@/lib/i18n';
import type { WorkspaceCustomFieldConfig, WorkspaceUserAccount } from '@/lib/workspace-store';
import { buildDashboardWidgets, dashboardWidgetCatalog } from '@/lib/dashboard-widgets';
import { customFieldOptionsToStrings, normalizeCustomFieldKey } from '@/lib/custom-fields';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const emptyUserForm = {
  fullName: '',
  email: '',
  roleId: 'viewer',
  status: 'invited' as const,
  authProvider: 'email' as const,
  teamMemberId: '',
  title: '',
  department: '',
  notes: '',
};

const emptyCustomFieldDraft = {
  entity: 'project' as WorkspaceCustomFieldConfig['entity'],
  type: 'text' as WorkspaceCustomFieldConfig['type'],
  label: '',
  key: '',
  placeholder: '',
  helpText: '',
  required: false,
  optionsText: '',
};

const statusVariant: Record<WorkspaceUserAccount['status'], 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  invited: 'secondary',
  suspended: 'destructive',
};

const Settings = () => {
  const { user, updatePassword } = useAuth();
  const { data } = useWorkspaceSettings();
  const { data: members = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: projectTemplates = [] } = useProjectTemplates();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: workflows = [] } = useWorkflows();
  const { data: dashboards = [] } = useDashboards();
  const updateSettings = useUpdateWorkspaceSettings();
  const updateWorkflow = useUpdateWorkflow();
  const updateDashboard = useUpdateDashboard();
  const createDashboard = useCreateDashboard();
  const createUserAccount = useCreateUserAccount();
  const updateUserAccount = useUpdateUserAccount();
  const [draft, setDraft] = useState(data);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WorkspaceUserAccount | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [selectedMetadataKey, setSelectedMetadataKey] = useState('');
  const [metadataDraftLabel, setMetadataDraftLabel] = useState('');
  const [passwordForm, setPasswordForm] = useState({ next: '', confirm: '' });
  const [newDashboardName, setNewDashboardName] = useState('');
  const [dashboardSourceId, setDashboardSourceId] = useState('');
  const [customFieldDraft, setCustomFieldDraft] = useState(emptyCustomFieldDraft);

  useEffect(() => {
    setDraft(data);
  }, [data]);

  useEffect(() => {
    if (!data?.metadata.length) return;
    setSelectedMetadataKey((current) =>
      current && data.metadata.some((field) => field.key === current) ? current : data.metadata[0].key,
    );
  }, [data]);

  useEffect(() => {
    if (!dashboards.length) return;
    setDashboardSourceId((current) => (current && dashboards.some((dashboard) => dashboard.id === current) ? current : dashboards[0].id));
  }, [dashboards]);

  const linkedTeamMember = useMemo(() => {
    if (!draft) return undefined;

    return (
      members.find((member) => member.id === draft.currentUser.teamMemberId) ??
      members.find((member) => normalizeText(member.email) === normalizeText(user?.email ?? draft.profile.email))
    );
  }, [draft, members, user?.email]);

  const linkedUserAccount = useMemo(() => {
    if (!draft) return undefined;

    return (
      userAccounts.find((account) => account.id === draft.currentUser.userAccountId) ??
      userAccounts.find((account) => normalizeText(account.email) === normalizeText(user?.email ?? draft.profile.email))
    );
  }, [draft, user?.email, userAccounts]);

  const linkedRole = useMemo(
    () => draft?.privilegeRoles.find((role) => role.id === (linkedUserAccount?.roleId ?? linkedTeamMember?.privilegeRole ?? draft.currentUser.roleId)),
    [draft, linkedTeamMember, linkedUserAccount],
  );

  const userStats = useMemo(
    () => ({
      total: userAccounts.length,
      admins: userAccounts.filter((account) => account.roleId === 'admin').length,
      active: userAccounts.filter((account) => account.status === 'active').length,
      invited: userAccounts.filter((account) => account.status === 'invited').length,
      suspended: userAccounts.filter((account) => account.status === 'suspended').length,
    }),
    [userAccounts],
  );

  const selectedMetadata = draft.metadata.find((field) => field.key === selectedMetadataKey) ?? draft.metadata[0];

  if (!draft) return null;

  const isAdminUser = (linkedUserAccount?.roleId ?? draft.currentUser.roleId) === 'admin';

  const save = async () => {
    await updateSettings.mutateAsync(draft);
    if (draft.appearance.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success('Workspace settings updated');
  };

  const savePassword = async () => {
    if (!passwordForm.next.trim() || passwordForm.next.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Password confirmation does not match');
      return;
    }

    await updatePassword(passwordForm.next);
    setDraft((prev) => prev ? ({ ...prev, security: { ...prev.security, passwordLastChangedAt: new Date().toISOString() } }) : prev);
    setPasswordForm({ next: '', confirm: '' });
    toast.success('Password updated');
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserDialogOpen(true);
  };

  const openEditUser = (account: WorkspaceUserAccount) => {
    setEditingUser(account);
    setUserForm({
      fullName: account.fullName,
      email: account.email,
      roleId: account.roleId,
      status: account.status,
      authProvider: account.authProvider,
      teamMemberId: account.teamMemberId ?? '',
      title: account.title ?? '',
      department: account.department ?? '',
      notes: account.notes ?? '',
    });
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!userForm.fullName.trim() || !userForm.email.trim()) {
      toast.error('User name and email are required');
      return;
    }

    if (editingUser) {
      await updateUserAccount.mutateAsync({ id: editingUser.id, ...userForm });
      toast.success('User access updated');
    } else {
      await createUserAccount.mutateAsync({
        ...userForm,
        invitedBy: linkedUserAccount?.fullName ?? draft.currentUser.displayName,
      });
      toast.success('User profile created');
    }

    setUserDialogOpen(false);
  };

  const linkedMemberForAccount = (account: WorkspaceUserAccount) =>
    members.find((member) => member.id === account.teamMemberId);

  const toggleAccountStatus = async (account: WorkspaceUserAccount) => {
    const nextStatus = account.status === 'suspended' ? 'active' : 'suspended';
    await updateUserAccount.mutateAsync({ id: account.id, status: nextStatus });
    toast.success(nextStatus === 'suspended' ? 'User suspended' : 'User reactivated');
  };

  const toggleAdminRole = async (account: WorkspaceUserAccount) => {
    const nextRole = account.roleId === 'admin' ? 'viewer' : 'admin';
    await updateUserAccount.mutateAsync({ id: account.id, roleId: nextRole });
    toast.success(nextRole === 'admin' ? 'Admin access granted' : 'Admin access removed');
  };

  const addMetadataOption = () => {
    if (!metadataDraftLabel.trim() || !selectedMetadata) return;
    setDraft((prev) => prev ? ({
      ...prev,
      metadata: prev.metadata.map((field) => field.key === selectedMetadata.key ? {
        ...field,
        options: [
          ...field.options,
          {
            id: `${field.key}-${Date.now()}`,
            label: metadataDraftLabel.trim(),
            value: metadataDraftLabel.trim().toLowerCase().replace(/\s+/g, '-'),
            active: true,
            order: field.options.length + 1,
          },
        ],
      } : field),
    }) : prev);
    setMetadataDraftLabel('');
  };

  const addCustomField = () => {
    if (!isAdminUser) {
      toast.error('Only administrators can add custom fields');
      return;
    }

    if (!customFieldDraft.label.trim()) {
      toast.error('Field label is required');
      return;
    }

    const key = normalizeCustomFieldKey(customFieldDraft.key || customFieldDraft.label);
    if (!key) {
      toast.error('Field key is required');
      return;
    }

    const duplicate = draft.customFields.some(
      (field) => field.entity === customFieldDraft.entity && field.key === key,
    );
    if (duplicate) {
      toast.error('A custom field with this key already exists for the selected form');
      return;
    }

    setDraft((prev) => prev ? ({
      ...prev,
      customFields: [
        ...prev.customFields,
        {
          id: `custom-${customFieldDraft.entity}-${Date.now()}`,
          entity: customFieldDraft.entity,
          key,
          label: customFieldDraft.label.trim(),
          type: customFieldDraft.type,
          placeholder: customFieldDraft.placeholder.trim(),
          helpText: customFieldDraft.helpText.trim(),
          required: customFieldDraft.required,
          active: true,
          options: customFieldDraft.type === 'select'
            ? customFieldDraft.optionsText
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean)
                .map((option, index) => ({
                  id: `${key}-${index + 1}`,
                  label: option,
                  value: option.toLowerCase().replace(/\s+/g, '-'),
                  active: true,
                  order: index + 1,
                }))
            : undefined,
        },
      ],
    }) : prev);
    setCustomFieldDraft(emptyCustomFieldDraft);
    toast.success('Custom field added to the form catalog');
  };

  const toggleCustomField = (fieldId: string) => {
    if (!isAdminUser) return;
    setDraft((prev) => prev ? ({
      ...prev,
      customFields: prev.customFields.map((field) =>
        field.id === fieldId ? { ...field, active: !field.active } : field,
      ),
    }) : prev);
  };

  const toggleMetadataOption = (fieldKey: string, optionId: string) => {
    setDraft((prev) => prev ? ({
      ...prev,
      metadata: prev.metadata.map((field) => field.key === fieldKey ? {
        ...field,
        options: field.options.map((option) => option.id === optionId ? { ...option, active: !option.active } : option),
      } : field),
    }) : prev);
  };

  const createCustomDashboard = async () => {
    if (!newDashboardName.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    const sourceDashboard = dashboards.find((dashboard) => dashboard.id === dashboardSourceId);
    await createDashboard.mutateAsync({
      name: newDashboardName.trim(),
      widgets: sourceDashboard?.widgets.length ? sourceDashboard.widgets : buildDashboardWidgets(),
    });
    setNewDashboardName('');
    toast.success('Custom dashboard created');
  };

  const toggleDashboardWidget = async (dashboardId: string, widgetKey: string) => {
    const dashboard = dashboards.find((item) => item.id === dashboardId);
    if (!dashboard) return;

    const existingWidget = dashboard.widgets.find((widget) => widget.key === widgetKey);
    const nextWidgets = existingWidget
      ? dashboard.widgets.map((widget) =>
          widget.key === widgetKey ? { ...widget, enabled: !widget.enabled } : widget,
        )
      : [...dashboard.widgets, ...buildDashboardWidgets([widgetKey])];

    await updateDashboard.mutateAsync({
      id: dashboardId,
      widgets: nextWidgets,
    });
    toast.success('Dashboard layout updated');
  };

  const duplicateDashboard = async (dashboardId: string) => {
    const sourceDashboard = dashboards.find((dashboard) => dashboard.id === dashboardId);
    if (!sourceDashboard) return;

    await createDashboard.mutateAsync({
      name: `${sourceDashboard.name} Copy`,
      widgets: sourceDashboard.widgets,
      isDefault: false,
    });
    toast.success('Dashboard duplicated');
  };

  return (
    <AppLayout>
      <AppHeader title="Professional Settings" subtitle="Namespace, privileges, workflows, dashboard configuration, AI, and MS Project controls." />
      <div className="p-6 max-w-5xl space-y-6 animate-fade-in">
        <Tabs defaultValue="workspace" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="administration">Administration</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-6">
        <PageSection
          title="Identity & Workspace"
          description="Manage namespace, profile linking, and the active user context for this workspace."
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Namespace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Organization</Label>
                  <Input value={draft.namespace.organization} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, organization: e.target.value } }) : prev)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Namespace Slug</Label>
                  <Input value={draft.namespace.slug} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, slug: e.target.value } }) : prev)} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Portfolio Office</Label>
                  <Input value={draft.namespace.portfolioOffice} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, portfolioOffice: e.target.value } }) : prev)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Timezone</Label>
                  <Input value={draft.namespace.timezone} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, timezone: e.target.value } }) : prev)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Current User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Display Name</Label>
                  <Input value={draft.currentUser.displayName} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, currentUser: { ...prev.currentUser, displayName: e.target.value } }) : prev)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={draft.currentUser.roleId} onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, currentUser: { ...prev.currentUser, roleId: value } }) : prev)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {draft.privilegeRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={draft.profile.email} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, profile: { ...prev.profile, email: e.target.value } }) : prev)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Profile Image URL</Label>
                <Input value={draft.profile.avatarUrl ?? ''} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, profile: { ...prev.profile, avatarUrl: e.target.value } }) : prev)} className="mt-1" placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Authenticated Account</Label>
                <Input value={user?.email ?? 'No active sign-in detected'} readOnly className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Linked Team Account</Label>
                <Select
                  value={draft.currentUser.teamMemberId || '__none__'}
                  onValueChange={(value) =>
                    setDraft((prev) => {
                      if (!prev) return prev;
                      if (value === '__none__') {
                        return {
                          ...prev,
                          currentUser: { ...prev.currentUser, teamMemberId: '' },
                        };
                      }

                      const member = members.find((item) => item.id === value);
                      return {
                        ...prev,
                        profile: {
                          ...prev.profile,
                          email: user?.email ?? member?.email ?? prev.profile.email,
                        },
                        currentUser: {
                          ...prev.currentUser,
                          teamMemberId: value,
                          displayName: member?.name ?? prev.currentUser.displayName,
                          roleId: member?.privilegeRole ?? prev.currentUser.roleId,
                        },
                      };
                    })
                  }
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not linked</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name} - {member.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border p-4 bg-card/40 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{linkedTeamMember ? linkedTeamMember.name : 'Unlinked profile access'}</p>
                  <Badge variant={linkedTeamMember ? 'default' : 'outline'}>
                    {linkedTeamMember ? 'Linked Team Profile' : 'Manual Link Needed'}
                  </Badge>
                  {linkedUserAccount ? <Badge variant="secondary">{linkedUserAccount.email}</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {linkedTeamMember
                    ? `Access privileges now follow ${linkedTeamMember.role} and the ${linkedRole?.name ?? draft.currentUser.roleId} role policy.`
                    : 'Sign in with a matching team-member email or choose a team account here to bind app access to an internal profile.'}
                </p>
                {linkedTeamMember ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">{linkedTeamMember.department || 'Team Workspace'}</Badge>
                    <Badge variant="secondary">{linkedRole?.name ?? draft.currentUser.roleId}</Badge>
                    <Badge variant="outline">{linkedTeamMember.email}</Badge>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border p-4 bg-card/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Password & Access Security</p>
                    <p className="text-xs text-muted-foreground">Change the signed-in user password and track when it was updated.</p>
                  </div>
                  <Badge variant="outline">{draft.security.passwordLastChangedAt ? new Date(draft.security.passwordLastChangedAt).toLocaleDateString() : 'Not changed yet'}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))} placeholder="New password" />
                  <Input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))} placeholder="Confirm password" />
                </div>
                <Button variant="outline" onClick={savePassword} disabled={!user}>Update Password</Button>
                {!user ? <p className="text-xs text-muted-foreground">Password changes require a signed-in account session.</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>

          </TabsContent>
          <TabsContent value="users" className="space-y-6">
        <Card className="glass">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> User Access Control</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage mail users, admin access, linked team profiles, and workspace permissions from one directory.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin mailbox: admin@company.com
              </Badge>
              <Button size="sm" className="gap-2" onClick={openAddUser} disabled={!isAdminUser}>
                <MailPlus className="h-4 w-4" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                { label: 'Total Users', value: userStats.total },
                { label: 'Admins', value: userStats.admins },
                { label: 'Active', value: userStats.active },
                { label: 'Invited', value: userStats.invited },
                { label: 'Suspended', value: userStats.suspended },
              ].map((metric) => (
                <div key={metric.label} className="rounded-xl border p-4 bg-card/40">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                </div>
              ))}
            </div>

            {!isAdminUser ? (
              <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                Only admin users can create or update user access profiles.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden bg-card/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Linked Team</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userAccounts.map((account) => {
                      const role = draft.privilegeRoles.find((item) => item.id === account.roleId);
                      const member = linkedMemberForAccount(account);

                      return (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{account.fullName}</span>
                                {account.roleId === 'admin' ? <Badge variant="secondary">Admin</Badge> : null}
                              </div>
                              <p className="text-xs text-muted-foreground">{account.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{role?.name ?? account.roleId}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[account.status]}>{account.status}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{account.authProvider}</TableCell>
                          <TableCell>{member?.name ?? 'Not linked'}</TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="text-xs text-muted-foreground">
                              {role?.permissions.slice(0, 3).join(', ') || 'No permissions configured'}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditUser(account)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => void toggleAccountStatus(account)}>
                                {account.status === 'suspended' ? 'Activate' : 'Suspend'}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => void toggleAdminRole(account)}>
                                {account.roleId === 'admin' ? 'Set Viewer' : 'Grant Admin'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

          </TabsContent>
          <TabsContent value="administration" className="space-y-6">
        <PageSection
          title="Administration"
          description="User access, integrations, metadata, templates, and audit visibility for administrators."
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(draft.integrations).map(([key, integration]) => (
                <div key={key} className="rounded-xl border p-4 bg-card/40 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{integration.providerLabel}</p>
                      <p className="text-xs text-muted-foreground">{integration.status}</p>
                    </div>
                    <Badge variant={integration.connected ? 'default' : 'outline'}>{integration.connected ? 'Connected' : 'Ready'}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Enabled</span>
                    <Switch checked={integration.enabled} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, integrations: { ...prev.integrations, [key]: { ...integration, enabled: checked } } }) : prev)} />
                  </div>
                  <Select value={integration.syncMode} onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, integrations: { ...prev.integrations, [key]: { ...integration, syncMode: value as typeof integration.syncMode } } }) : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                      <SelectItem value="two-way">Two-way</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="rounded-xl border p-3 bg-background/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Scopes</span>
                      <span>{integration.scopes.length}</span>
                    </div>
                    <div className="grid gap-2">
                      <Input
                        value={integration.configuration?.clientId ?? ''}
                        onChange={(e) => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              configuration: { ...integration.configuration, clientId: e.target.value },
                            },
                          },
                        }) : prev)}
                        placeholder="Client ID / App ID"
                      />
                      <Input
                        value={integration.configuration?.tenantId ?? ''}
                        onChange={(e) => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              configuration: { ...integration.configuration, tenantId: e.target.value },
                            },
                          },
                        }) : prev)}
                        placeholder="Tenant / Workspace ID"
                      />
                      <Input
                        value={integration.configuration?.redirectUri ?? ''}
                        onChange={(e) => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              configuration: { ...integration.configuration, redirectUri: e.target.value },
                            },
                          },
                        }) : prev)}
                        placeholder="Redirect URI"
                      />
                      <Input
                        value={integration.configuration?.resourceUrl ?? ''}
                        onChange={(e) => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              configuration: { ...integration.configuration, resourceUrl: e.target.value },
                            },
                          },
                        }) : prev)}
                        placeholder="API / Resource URL"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {integration.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-[10px]">{scope}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last sync: {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Not synced yet'}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              connected: !integration.connected,
                              status: integration.connected ? `${integration.providerLabel} disconnected for this workspace.` : `${integration.providerLabel} connected for this workspace.`,
                              lastSyncAt: integration.connected ? integration.lastSyncAt : new Date().toISOString(),
                            },
                          },
                        }) : prev)}
                      >
                        {integration.connected ? 'Disconnect' : 'Connect'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft((prev) => prev ? ({
                          ...prev,
                          integrations: {
                            ...prev.integrations,
                            [key]: {
                              ...integration,
                              connected: true,
                              status: `${integration.providerLabel} configuration verified and ready for sync.`,
                              lastSyncAt: new Date().toISOString(),
                            },
                          },
                        }) : prev)}
                      >
                        Validate Config
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Configurable Dropdowns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.metadata.map((field) => (
                <div key={field.key} className="rounded-xl border p-4 bg-card/40 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.options.length} values</p>
                    </div>
                    <Badge variant="outline">{field.key}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleMetadataOption(field.key, option.id)}
                        className={`rounded-full border px-3 py-1 text-xs ${option.active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-dashed p-4 space-y-3">
                <p className="text-sm font-medium">Add metadata value</p>
                <Select value={selectedMetadata?.key ?? ''} onValueChange={setSelectedMetadataKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose dropdown" />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.metadata.map((field) => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={metadataDraftLabel} onChange={(e) => setMetadataDraftLabel(e.target.value)} placeholder="New dropdown value" />
                <Button variant="outline" onClick={addMetadataOption}>Add Option</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4" /> Custom Form Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 bg-card/40">
                <p className="text-sm font-medium">Admin Form Builder</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add frontend-only custom fields for Projects, Tasks, Team, and Tickets without code changes. These fields appear only for active definitions and remain editable in the app forms.
                </p>
              </div>
              {!isAdminUser ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Custom field management is restricted to administrators.
                </div>
              ) : null}
              <div className="space-y-3">
                {draft.customFields.map((field) => (
                  <div key={field.id} className="rounded-xl border p-4 bg-card/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {field.entity} form • {field.type} • key <span className="font-mono">{field.key}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {field.required ? <Badge variant="outline">Required</Badge> : null}
                        <Button variant={field.active ? 'default' : 'outline'} size="sm" disabled={!isAdminUser} onClick={() => toggleCustomField(field.id)}>
                          {field.active ? 'Active' : 'Inactive'}
                        </Button>
                      </div>
                    </div>
                    {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
                    {field.type === 'select' && field.options?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {customFieldOptionsToStrings(field.options).map((option) => (
                          <Badge key={`${field.id}-${option}`} variant="secondary">{option}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-dashed p-4 space-y-3">
                <p className="text-sm font-medium">Add custom field</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Form</Label>
                    <Select value={customFieldDraft.entity} onValueChange={(value) => setCustomFieldDraft((prev) => ({ ...prev, entity: value as WorkspaceCustomFieldConfig['entity'] }))} disabled={!isAdminUser}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project">Projects</SelectItem>
                        <SelectItem value="task">Tasks</SelectItem>
                        <SelectItem value="teamMember">Team</SelectItem>
                        <SelectItem value="ticket">Tickets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select value={customFieldDraft.type} onValueChange={(value) => setCustomFieldDraft((prev) => ({ ...prev, type: value as WorkspaceCustomFieldConfig['type'] }))} disabled={!isAdminUser}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Field Label</Label>
                    <Input value={customFieldDraft.label} disabled={!isAdminUser} onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, label: e.target.value, key: prev.key || normalizeCustomFieldKey(e.target.value) }))} placeholder="Client reference" />
                  </div>
                  <div className="space-y-2">
                    <Label>Field Key</Label>
                    <Input value={customFieldDraft.key} disabled={!isAdminUser} onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, key: normalizeCustomFieldKey(e.target.value) }))} placeholder="client-reference" />
                  </div>
                  <div className="space-y-2">
                    <Label>Placeholder</Label>
                    <Input value={customFieldDraft.placeholder} disabled={!isAdminUser} onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, placeholder: e.target.value }))} placeholder="Shown in the form" />
                  </div>
                  <div className="space-y-2">
                    <Label>Options</Label>
                    <Input value={customFieldDraft.optionsText} disabled={!isAdminUser || customFieldDraft.type !== 'select'} onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, optionsText: e.target.value }))} placeholder="Option A, Option B, Option C" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Help Text</Label>
                    <Textarea rows={2} value={customFieldDraft.helpText} disabled={!isAdminUser} onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, helpText: e.target.value }))} placeholder="Guidance shown under the field in the form" />
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border p-3 md:col-span-2">
                    <Switch checked={customFieldDraft.required} disabled={!isAdminUser} onCheckedChange={(checked) => setCustomFieldDraft((prev) => ({ ...prev, required: checked }))} />
                    <span className="text-sm">Mark field as required in forms</span>
                  </label>
                </div>
                <Button variant="outline" onClick={addCustomField} disabled={!isAdminUser}>Add Custom Field</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Templates & Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 bg-card/40">
                <p className="font-medium">Project Templates</p>
                <div className="mt-3 space-y-2">
                  {projectTemplates.map((template) => (
                    <div key={template.id} className="rounded-lg border p-3 bg-background/60">
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4 bg-card/40">
                <p className="font-medium">Audit Trail</p>
                <div className="mt-3 space-y-2">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="rounded-lg border p-3 bg-background/60">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">{log.actorName} • {new Date(log.createdAt).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{log.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          </TabsContent>
          <TabsContent value="governance" className="space-y-6">
        <PageSection
          title="Governance & Automation"
          description="Privilege design, notifications, workflow rules, dashboards, appearance, and security controls."
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Privilege Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.privilegeRoles.map((role) => (
                <div key={role.id} className="rounded-xl border p-4 bg-card/40">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{role.name}</p>
                    <span className="text-xs text-muted-foreground">{role.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {role.permissions.map((permission) => (
                      <span key={permission} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ['Email notifications', 'email'],
                ['Push notifications', 'push'],
                ['Task reminders', 'reminders'],
                ['Weekly digest', 'digest'],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={draft.notifications[key as keyof typeof draft.notifications]}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => prev ? ({ ...prev, notifications: { ...prev.notifications, [key]: checked } }) : prev)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Workflow className="h-4 w-4" /> Workflow Studio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-xl border p-4 bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">{workflow.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateWorkflow.mutateAsync({
                          id: workflow.id,
                          automationRules: [...workflow.automationRules, 'Escalate when workload exceeds target utilization.'],
                        });
                        toast.success('Workflow automation rule added');
                      }}
                    >
                      Add automation
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workflow.stages.map((stage) => (
                      <span key={stage.id} className="text-[10px] px-2 py-1 rounded-full bg-muted text-foreground">
                        {stage.name} - {stage.slaHours}h
                      </span>
                    ))}
                  </div>
                  <Textarea value={workflow.automationRules.join('\n')} readOnly className="min-h-[110px] text-xs" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-dashed p-4 bg-card/40 space-y-3">
                <p className="font-medium">Create Custom Dashboard</p>
                <div className="grid gap-3 md:grid-cols-[1.4fr,1fr,auto]">
                  <Input
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="Dashboard name"
                  />
                  <Select value={dashboardSourceId || dashboards[0]?.id || ''} onValueChange={setDashboardSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Source dashboard" />
                    </SelectTrigger>
                    <SelectContent>
                      {dashboards.map((dashboard) => (
                        <SelectItem key={dashboard.id} value={dashboard.id}>{dashboard.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={createCustomDashboard} disabled={createDashboard.isPending}>Create</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Start from an existing dashboard, then toggle widgets and set the one you want as default.
                </p>
              </div>
              {dashboards.map((dashboard) => (
                <div key={dashboard.id} className="rounded-xl border p-4 bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Input
                        defaultValue={dashboard.name}
                        onBlur={(e) => {
                          const nextName = e.target.value.trim();
                          if (nextName && nextName !== dashboard.name) {
                            void updateDashboard.mutateAsync({ id: dashboard.id, name: nextName });
                          }
                        }}
                        className="h-9 max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground">{dashboard.isDefault ? 'Default dashboard' : 'Alternate layout'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={dashboard.isDefault ? 'default' : 'outline'}
                        onClick={() => void updateDashboard.mutateAsync({ id: dashboard.id, isDefault: true })}
                      >
                        {dashboard.isDefault ? 'Default' : 'Set Default'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void duplicateDashboard(dashboard.id)}>
                        Duplicate
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dashboardWidgetCatalog.map((widgetTemplate) => {
                      const widget = dashboard.widgets.find((item) => item.key === widgetTemplate.key);
                      return (
                        <button
                          key={widgetTemplate.key}
                          type="button"
                          onClick={() => void toggleDashboardWidget(dashboard.id, widgetTemplate.key)}
                          className={`rounded-full px-2 py-1 text-[10px] border ${
                            widget?.enabled
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {widgetTemplate.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance & AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Dark mode</span>
                <Switch checked={draft.appearance.darkMode} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, appearance: { ...prev.appearance, darkMode: checked } }) : prev)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Compact view</span>
                <Switch checked={draft.appearance.compactView} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, appearance: { ...prev.appearance, compactView: checked } }) : prev)} />
              </div>
              <div>
                <Label className="text-xs">Language</Label>
                <Select value={draft.appearance.language} onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, appearance: { ...prev.appearance, language: value as 'en' | 'ar' } }) : prev)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['en', 'ar'] as const).map((language) => (
                      <SelectItem key={language} value={language}>{languageLabel(language)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">AI risk scan</span>
                <Switch checked={draft.ai.autoRiskScan} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, ai: { ...prev.ai, autoRiskScan: checked } }) : prev)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">AI schedule advisor</span>
                <Switch checked={draft.ai.scheduleAdvisor} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, ai: { ...prev.ai, scheduleAdvisor: checked } }) : prev)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Narrative reports</span>
                <Switch checked={draft.ai.reportNarratives} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, ai: { ...prev.ai, reportNarratives: checked } }) : prev)} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Security & MS Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Two-factor authentication</span>
                <Switch checked={draft.security.twoFactor} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, security: { ...prev.security, twoFactor: checked } }) : prev)} />
              </div>
              <Separator />
              <div>
                <Label className="text-xs">Default project calendar</Label>
                <Input value={draft.msProject.defaultCalendar} onChange={(e) => setDraft((prev) => prev ? ({ ...prev, msProject: { ...prev.msProject, defaultCalendar: e.target.value } }) : prev)} className="mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto sync project dates</span>
                <Switch checked={draft.msProject.autoSyncProjectDates} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, msProject: { ...prev.msProject, autoSyncProjectDates: checked } }) : prev)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Export dependencies to MS Project</span>
                <Switch checked={draft.msProject.includeDependenciesInExport} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, msProject: { ...prev.msProject, includeDependenciesInExport: checked } }) : prev)} />
              </div>
            </CardContent>
          </Card>
        </div>

          </TabsContent>
        </Tabs>
        <Button size="sm" className="gradient-primary text-primary-foreground" onClick={save}>Save Changes</Button>
      </div>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User Access' : 'Add User Profile'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input value={userForm.fullName} onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={userForm.roleId} onValueChange={(value) => setUserForm((prev) => ({ ...prev, roleId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {draft.privilegeRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={userForm.status} onValueChange={(value) => setUserForm((prev) => ({ ...prev, status: value as WorkspaceUserAccount['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Auth Provider</Label>
                <Select value={userForm.authProvider} onValueChange={(value) => setUserForm((prev) => ({ ...prev, authProvider: value as WorkspaceUserAccount['authProvider'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Linked Team Member</Label>
                <Select value={userForm.teamMemberId || '__none__'} onValueChange={(value) => setUserForm((prev) => ({ ...prev, teamMemberId: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not linked</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name} - {member.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={userForm.title} onChange={(e) => setUserForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input value={userForm.department} onChange={(e) => setUserForm((prev) => ({ ...prev, department: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Access Notes</Label>
              <Textarea value={userForm.notes} onChange={(e) => setUserForm((prev) => ({ ...prev, notes: e.target.value }))} className="min-h-[96px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveUser}>{editingUser ? 'Save Access' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Settings;
