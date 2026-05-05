import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, LayoutDashboard, ListPlus, MailPlus, Palette, Pencil, Shield, ShieldCheck, Users, Workflow } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import AdminExperienceControls from '@/components/admin/AdminExperienceControls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  useAuditLogs,
  useCreateUserAccount,
  useTeamMembers,
  useUpdateUserAccount,
  useUpdateWorkspaceSettings,
  useUserAccounts,
  useWorkspaceSettings,
} from '@/hooks/useProjects';
import { languageLabel } from '@/lib/i18n';
import type { WorkspaceUserAccount } from '@/lib/workspace-store';
import { toast } from 'sonner';

const emptyUserForm = {
  fullName: '',
  email: '',
  roleId: 'viewer',
  status: 'invited' as WorkspaceUserAccount['status'],
  authProvider: 'email' as WorkspaceUserAccount['authProvider'],
  teamMemberId: '',
  title: '',
  department: '',
  notes: '',
};

const statusVariant: Record<WorkspaceUserAccount['status'], 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  invited: 'secondary',
  suspended: 'destructive',
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';
const formatOptionalDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : 'Not yet');

const Settings = () => {
  const { user, updatePassword, sendInvitationEmail, sendPasswordResetEmail } = useAuth();
  const { data } = useWorkspaceSettings();
  const { data: members = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: auditLogs = [] } = useAuditLogs();
  const updateSettings = useUpdateWorkspaceSettings();
  const createUserAccount = useCreateUserAccount();
  const updateUserAccount = useUpdateUserAccount();
  const [draft, setDraft] = useState(data);
  const [activeTab, setActiveTab] = useState('workspace');
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WorkspaceUserAccount | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [selectedMetadataKey, setSelectedMetadataKey] = useState('');
  const [metadataDraftLabel, setMetadataDraftLabel] = useState('');
  const [passwordForm, setPasswordForm] = useState({ next: '', confirm: '' });

  useEffect(() => {
    setDraft(data);
  }, [data]);

  useEffect(() => {
    if (!data?.metadata.length) return;
    setSelectedMetadataKey((current) => current && data.metadata.some((field) => field.key === current) ? current : data.metadata[0].key);
  }, [data]);

  const linkedTeamMember = useMemo(() => {
    if (!draft) return undefined;
    return members.find((member) => member.id === draft.currentUser.teamMemberId) ?? members.find((member) => normalizeText(member.email) === normalizeText(user?.email ?? draft.profile.email));
  }, [draft, members, user?.email]);

  const linkedUserAccount = useMemo(() => {
    if (!draft) return undefined;
    return userAccounts.find((account) => account.id === draft.currentUser.userAccountId) ?? userAccounts.find((account) => normalizeText(account.email) === normalizeText(user?.email ?? draft.profile.email));
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

  if (!draft) return null;

  const selectedMetadata = draft.metadata.find((field) => field.key === selectedMetadataKey) ?? draft.metadata[0];
  const isAdminUser = (linkedUserAccount?.roleId ?? draft.currentUser.roleId) === 'admin';

  const save = async () => {
    await updateSettings.mutateAsync(draft);
    if (draft.appearance.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.dispatchEvent(new CustomEvent('workspace-theme-changed', { detail: draft.appearance }));
    toast.success('Workspace settings updated');
  };

  const savePassword = async () => {
    if (!passwordForm.next.trim() || passwordForm.next.length < 6) return toast.error('Password must be at least 6 characters');
    if (passwordForm.next !== passwordForm.confirm) return toast.error('Password confirmation does not match');
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
    if (!userForm.fullName.trim() || !userForm.email.trim()) return toast.error('User name and email are required');
    if (editingUser) {
      await updateUserAccount.mutateAsync({ id: editingUser.id, ...userForm });
      toast.success('User access updated');
    } else {
      const created = await createUserAccount.mutateAsync({ ...userForm, invitedBy: linkedUserAccount?.fullName ?? draft.currentUser.displayName });
      if (created?.email) {
        try {
          await sendInvitationEmail(created.email, created.fullName);
          toast.success('User profile created and invitation email sent');
        } catch {
          toast.warning('User profile created, but the invitation email could not be sent.');
        }
      }
    }
    setUserDialogOpen(false);
  };

  const sendResetPasswordLink = async (account: WorkspaceUserAccount) => {
    try {
      await sendPasswordResetEmail(account.email);
      toast.success(`Password reset email sent to ${account.fullName}`);
    } catch {
      toast.error('Password reset email could not be sent. Check Supabase auth configuration.');
    }
  };

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
        options: [...field.options, {
          id: `${field.key}-${Date.now()}`,
          label: metadataDraftLabel.trim(),
          value: metadataDraftLabel.trim().toLowerCase().replace(/\s+/g, '-'),
          active: true,
          order: field.options.length + 1,
        }],
      } : field),
    }) : prev);
    setMetadataDraftLabel('');
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

  const appearanceFont = String((draft.appearance as any).fontFamily ?? 'inter');

  return (
    <AppLayout>
      <AppHeader title="Settings & Form Builder" subtitle="Workspace configuration, user access, lists, governance, branding, and future form fields." />
      <div className="page-shell page-stack">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1 md:grid-cols-3 xl:grid-cols-5">
            <TabsTrigger value="workspace" className="rounded-xl">Workspace</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl">Users</TabsTrigger>
            <TabsTrigger value="administration" className="rounded-xl">Administration</TabsTrigger>
            <TabsTrigger value="governance" className="rounded-xl">Governance</TabsTrigger>
            <TabsTrigger value="form-builder" className="rounded-xl">Form Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-4">
            <PageSection title="Identity & Workspace" description="Manage namespace, branding, profile linking, language, theme, and active user context." actions={<Button onClick={save}>Save Settings</Button>} />
            <div className="responsive-content-grid">
              <Card className="glass">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Namespace</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Organization</Label><Input value={draft.namespace.organization} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, organization: event.target.value } }) : prev)} /></div>
                  <div className="space-y-2"><Label>Namespace Slug</Label><Input value={draft.namespace.slug} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, slug: event.target.value } }) : prev)} /></div>
                  <div className="space-y-2"><Label>Portfolio Office</Label><Input value={draft.namespace.portfolioOffice} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, portfolioOffice: event.target.value } }) : prev)} /></div>
                  <div className="space-y-2"><Label>Timezone</Label><Input value={draft.namespace.timezone} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, namespace: { ...prev.namespace, timezone: event.target.value } }) : prev)} /></div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Appearance</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Language</Label><Select value={draft.appearance.language} onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, appearance: { ...prev.appearance, language: value as any } }) : prev)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">{languageLabel('en')}</SelectItem><SelectItem value="ar">{languageLabel('ar')}</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Font mode</Label><Input value={appearanceFont} readOnly /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">Dark mode</p><p className="text-xs text-muted-foreground">Switch application appearance.</p></div><Switch checked={draft.appearance.darkMode} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, appearance: { ...prev.appearance, darkMode: checked } }) : prev)} /></div>
                  <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">In-app notifications</p><p className="text-xs text-muted-foreground">Show notifications in the header.</p></div><Switch checked={draft.notifications.inApp} onCheckedChange={(checked) => setDraft((prev) => prev ? ({ ...prev, notifications: { ...prev.notifications, inApp: checked } }) : prev)} /></div>
                </CardContent>
              </Card>

              <Card className="glass md:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Current User & Security</CardTitle></CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2"><Label>Display Name</Label><Input value={draft.currentUser.displayName} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, currentUser: { ...prev.currentUser, displayName: event.target.value } }) : prev)} /></div>
                      <div className="space-y-2"><Label>Email</Label><Input value={draft.profile.email} onChange={(event) => setDraft((prev) => prev ? ({ ...prev, profile: { ...prev.profile, email: event.target.value } }) : prev)} /></div>
                    </div>
                    <div className="space-y-2"><Label>Linked Team Account</Label><Select value={draft.currentUser.teamMemberId || '__none__'} onValueChange={(value) => setDraft((prev) => prev ? ({ ...prev, currentUser: { ...prev.currentUser, teamMemberId: value === '__none__' ? '' : value } }) : prev)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Not linked</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} - {member.role}</SelectItem>)}</SelectContent></Select></div>
                    <div className="rounded-xl border bg-card/40 p-4"><p className="font-medium">{linkedTeamMember ? linkedTeamMember.name : 'Unlinked profile access'}</p><p className="text-sm text-muted-foreground">Role policy: {linkedRole?.name ?? draft.currentUser.roleId}</p></div>
                  </div>
                  <div className="space-y-4 rounded-xl border bg-card/40 p-4">
                    <div className="flex items-center justify-between"><div><p className="font-medium">Password & Access Security</p><p className="text-xs text-muted-foreground">Change the signed-in user password.</p></div><Badge variant="outline">{draft.security.passwordLastChangedAt ? new Date(draft.security.passwordLastChangedAt).toLocaleDateString() : 'Not changed'}</Badge></div>
                    <div className="grid gap-3 md:grid-cols-2"><Input type="password" value={passwordForm.next} onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))} placeholder="New password" /><Input type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))} placeholder="Confirm password" /></div>
                    <Button variant="outline" onClick={savePassword} disabled={!user}>Update Password</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <PageSection title="User Access Control" description="Manage app users, admin access, linked team profiles, and account lifecycle." actions={<Button className="gap-2" onClick={openAddUser} disabled={!isAdminUser}><MailPlus className="h-4 w-4" /> Add User</Button>} />
            <div className="responsive-card-grid">
              {[
                { label: 'Total Users', value: userStats.total },
                { label: 'Admins', value: userStats.admins },
                { label: 'Active', value: userStats.active },
                { label: 'Invited', value: userStats.invited },
                { label: 'Suspended', value: userStats.suspended },
              ].map((metric) => <div key={metric.label} className="metric-card"><p className="metric-card-title">{metric.label}</p><p className="metric-card-value">{metric.value}</p></div>)}
            </div>
            <Card className="glass overflow-hidden">
              <CardContent className="p-0">
                <div className="table-scroll">
                  <Table>
                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Linked Team</TableHead><TableHead>Lifecycle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {userAccounts.map((account) => {
                        const role = draft.privilegeRoles.find((item) => item.id === account.roleId);
                        const member = members.find((item) => item.id === account.teamMemberId);
                        return <TableRow key={account.id}><TableCell><div><p className="font-medium">{account.fullName}</p><p className="text-xs text-muted-foreground">{account.email}</p></div></TableCell><TableCell><Badge variant="outline">{role?.name ?? account.roleId}</Badge></TableCell><TableCell><Badge variant={statusVariant[account.status]}>{account.status}</Badge></TableCell><TableCell>{member?.name ?? 'Not linked'}</TableCell><TableCell className="text-xs text-muted-foreground"><p>Created: {formatOptionalDateTime(account.createdAt)}</p><p>Invited: {formatOptionalDateTime(account.invitationSentAt)}</p><p>Last access: {formatOptionalDateTime(account.lastAccessAt)}</p></TableCell><TableCell className="text-right"><div className="action-cluster justify-end"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditUser(account)}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button variant="outline" size="sm" onClick={() => void sendResetPasswordLink(account)}>Reset</Button><Button variant="outline" size="sm" onClick={() => void toggleAccountStatus(account)}>{account.status === 'suspended' ? 'Activate' : 'Suspend'}</Button><Button variant="outline" size="sm" onClick={() => void toggleAdminRole(account)}>{account.roleId === 'admin' ? 'Set Viewer' : 'Grant Admin'}</Button></div></TableCell></TableRow>;
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="administration" className="space-y-4">
            <PageSection title="Administration Lists" description="Manage dropdown lists and metadata values used across PMO forms." actions={<Button onClick={save}>Save Changes</Button>} />
            <Card className="glass">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListPlus className="h-4 w-4" /> Metadata Lists</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2"><Label>List</Label><Select value={selectedMetadataKey} onValueChange={setSelectedMetadataKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{draft.metadata.map((field) => <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>New option</Label><Input value={metadataDraftLabel} onChange={(event) => setMetadataDraftLabel(event.target.value)} placeholder="Example: On Hold" /></div>
                  <div className="flex items-end"><Button className="gap-2" onClick={addMetadataOption}><ListPlus className="h-4 w-4" /> Add</Button></div>
                </div>
                <div className="flex flex-wrap gap-2">{selectedMetadata?.options.map((option) => <Button key={option.id} variant={option.active ? 'secondary' : 'outline'} size="sm" onClick={() => toggleMetadataOption(selectedMetadata.key, option.id)}>{option.label}</Button>)}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <PageSection title="Governance & Permissions" description="Review roles, role permissions, and recent governance activity." />
            <div className="responsive-content-grid">
              <Card className="glass">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Privilege Roles</CardTitle></CardHeader>
                <CardContent className="space-y-3">{draft.privilegeRoles.map((role) => <div key={role.id} className="rounded-xl border p-3"><p className="font-semibold">{role.name}</p><p className="mt-1 text-xs text-muted-foreground">{role.permissions.length} permissions</p><div className="mt-2 flex flex-wrap gap-1">{role.permissions.slice(0, 8).map((permission) => <Badge key={permission} variant="secondary" className="text-[10px]">{permission}</Badge>)}</div></div>)}</CardContent>
              </Card>
              <Card className="glass">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Recent User Audit</CardTitle></CardHeader>
                <CardContent className="space-y-3">{auditLogs.filter((log) => log.entityType === 'user').slice(0, 8).map((log) => <div key={log.id} className="rounded-xl border p-3"><p className="text-sm font-semibold">{log.action}</p><p className="text-xs text-muted-foreground">{log.detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p></div>)}{!auditLogs.length ? <p className="text-sm text-muted-foreground">No audit logs yet.</p> : null}</CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="form-builder" className="space-y-4">
            <PageSection title="Admin Experience & Form Builder" description="Add fields, manage lists, control visual theme, and define document/report branding from one organized settings tab." />
            <AdminExperienceControls embedded />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingUser ? 'Edit User Access' : 'Add User Access'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Full Name</Label><Input value={userForm.fullName} onChange={(event) => setUserForm((prev) => ({ ...prev, fullName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Role</Label><Select value={userForm.roleId} onValueChange={(value) => setUserForm((prev) => ({ ...prev, roleId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{draft.privilegeRoles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Status</Label><Select value={userForm.status} onValueChange={(value) => setUserForm((prev) => ({ ...prev, status: value as WorkspaceUserAccount['status'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="invited">Invited</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Linked Team Member</Label><Select value={userForm.teamMemberId || '__none__'} onValueChange={(value) => setUserForm((prev) => ({ ...prev, teamMemberId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Not linked</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Title</Label><Input value={userForm.title} onChange={(event) => setUserForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea value={userForm.notes} onChange={(event) => setUserForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button><Button onClick={saveUser}>Save User</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Settings;
