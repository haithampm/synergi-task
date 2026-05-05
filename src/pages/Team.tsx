import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, FolderPlus, LayoutGrid, Mail, Pencil, Plus, Table as TableIcon, UserMinus, UserPlus } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import DynamicCustomFields from '@/components/forms/DynamicCustomFields';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCreateTeamMember,
  useProjects,
  useTasks,
  useTeamMembers,
  useUpdateTask,
  useUpdateTeamMember,
  useWorkspaceSettings,
} from '@/hooks/useProjects';
import { getActiveCustomFields, normalizeCustomFieldValues } from '@/lib/custom-fields';
import { toast } from 'sonner';
import type { WorkspaceTeamMember } from '@/lib/workspace-store';

const statusDot: Record<string, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-muted-foreground/40',
};

const avatarColors = [
  'gradient-primary',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-orange-500',
  'bg-red-600',
  'bg-teal-600',
];

const emptyForm = {
  name: '',
  role: '',
  email: '',
  phone: '',
  department: '',
  status: 'online',
  avatarColor: 'gradient-primary',
  capacityHours: 40,
  utilizationTarget: 85,
  privilegeRole: 'lead',
  customFieldValues: {} as Record<string, string | number | boolean>,
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';
const isInactiveMember = (member: WorkspaceTeamMember) => member.status === 'offline' || member.customFieldValues?.deactivated === true;

const Team = () => {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [selectedMember, setSelectedMember] = useState<WorkspaceTeamMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [assignProjectOpen, setAssignProjectOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reassignToMemberId, setReassignToMemberId] = useState('');
  const [editingMember, setEditingMember] = useState<WorkspaceTeamMember | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<'directory' | 'ownership'>('directory');

  const { data: settings } = useWorkspaceSettings();
  const { data: members = [] } = useTeamMembers();
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const teamCustomFields = useMemo(() => getActiveCustomFields(settings, 'teamMember'), [settings]);
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const updateTask = useUpdateTask();

  const taskStats = useMemo(() => {
    return members.map((member) => {
      const aliases = [member.name, member.name.split(' ')[0]];
      const assignedTasks = tasks.filter((task) => aliases.includes(task.assignee) || task.assignee_id === member.id || task.assignees?.includes(member.id));
      const completed = assignedTasks.filter((task) => task.status === 'done').length;
      const assignedHours = isInactiveMember(member) ? 0 : assignedTasks.reduce((sum, task) => sum + (task.workloadHours ?? 0), 0);
      const capacity = isInactiveMember(member) ? 0 : member.capacityHours ?? 40;
      const assignedProjectIds = new Set([
        ...(member.assignedProjectIds ?? []),
        ...assignedTasks.map((task) => task.project_id).filter(Boolean) as string[],
      ]);

      return {
        ...member,
        tasksAssigned: assignedTasks.length,
        tasksCompleted: completed,
        assignedTasks,
        assignedHours,
        utilizationPct: isInactiveMember(member) ? 0 : Math.round((assignedHours / Math.max(1, capacity)) * 100),
        assignedProjects: projects.filter((project) => assignedProjectIds.has(project.id)),
      };
    });
  }, [members, projects, tasks]);
  const activeMember = selectedMember ? taskStats.find((member) => member.id === selectedMember.id) ?? null : null;
  const activeMembersForReassign = taskStats.filter((member) => activeMember?.id !== member.id && !isInactiveMember(member));
  const currentProfileMember =
    taskStats.find((member) => member.id === settings?.currentUser.teamMemberId) ??
    taskStats.find((member) => normalizeText(member.email) === normalizeText(settings?.profile.email));

  const openAddForm = () => {
    setEditingMember(null);
    setForm({ ...emptyForm, customFieldValues: normalizeCustomFieldValues(teamCustomFields, {}) });
    setFormOpen(true);
  };

  const openEditForm = (member: WorkspaceTeamMember) => {
    setEditingMember(member);
    setForm({
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone ?? '',
      department: member.department ?? '',
      status: member.status,
      avatarColor: member.avatarColor ?? 'gradient-primary',
      capacityHours: member.capacityHours ?? 40,
      utilizationTarget: member.utilizationTarget ?? 85,
      privilegeRole: member.privilegeRole ?? 'lead',
      customFieldValues: normalizeCustomFieldValues(teamCustomFields, member.customFieldValues),
    });
    setFormOpen(true);
  };

  const saveMember = async () => {
    if (!form.name.trim()) {
      toast.error('Member name is required');
      return;
    }

    if (editingMember) {
      await updateMember.mutateAsync({ id: editingMember.id, ...form });
      toast.success('Team member updated');
    } else {
      await createMember.mutateAsync(form);
      toast.success('Team member added');
    }

    window.dispatchEvent(new CustomEvent('workspace-data-changed', { detail: { entity: 'teamMembers', reason: 'team-member-save' } }));
    setFormOpen(false);
  };

  const assignTask = async () => {
    if (!activeMember || !selectedTaskId) return;
    await updateTask.mutateAsync({
      id: selectedTaskId,
      assignee: activeMember.name,
      assignee_id: activeMember.id,
      assignees: [activeMember.id],
    });
    toast.success('Task assigned');
    window.dispatchEvent(new CustomEvent('workspace-data-changed', { detail: { entity: 'tasks', reason: 'team-task-assignment' } }));
    setAssignTaskOpen(false);
    setSelectedTaskId('');
  };

  const assignProject = async () => {
    if (!activeMember || !selectedProjectId) return;
    const ids = new Set(activeMember.assignedProjectIds ?? []);
    ids.add(selectedProjectId);
    await updateMember.mutateAsync({ id: activeMember.id, assignedProjectIds: [...ids] });
    toast.success('Project assigned');
    window.dispatchEvent(new CustomEvent('workspace-data-changed', { detail: { entity: 'teamMembers', reason: 'team-project-assignment' } }));
    setAssignProjectOpen(false);
    setSelectedProjectId('');
  };

  const deactivateMember = async () => {
    if (!activeMember) return;
    if (activeMember.assignedTasks.length > 0 && !reassignToMemberId) {
      toast.error('Reassign active tasks before deactivating this member.');
      return;
    }

    const targetMember = activeMembersForReassign.find((member) => member.id === reassignToMemberId);
    if (targetMember) {
      for (const task of activeMember.assignedTasks) {
        await updateTask.mutateAsync({
          id: task.id,
          assignee: targetMember.name,
          assignee_id: targetMember.id,
          assignees: [targetMember.id],
          customFieldValues: {
            ...(task.customFieldValues ?? {}),
            reassignedFromMemberId: activeMember.id,
            reassignedFromMemberName: activeMember.name,
            reassignedAt: new Date().toISOString(),
          },
        } as any);
      }
    }

    await updateMember.mutateAsync({
      id: activeMember.id,
      status: 'offline',
      assignedProjectIds: [],
      capacityHours: 0,
      customFieldValues: {
        ...(activeMember.customFieldValues ?? {}),
        deactivated: true,
        deactivatedAt: new Date().toISOString(),
        deactivationMode: activeMember.assignedTasks.length > 0 ? 'reassigned-and-deactivated' : 'deactivated-no-active-tasks',
      },
    });

    window.dispatchEvent(new CustomEvent('workspace-data-changed', { detail: { entity: 'teamMembers', reason: 'team-member-deactivate' } }));
    toast.success(`${activeMember.name} deactivated${targetMember ? ` and tasks reassigned to ${targetMember.name}` : ''}.`);
    setDeactivateOpen(false);
    setSelectedMember(null);
    setReassignToMemberId('');
  };

  return (
    <AppLayout>
      <AppHeader title="Team Workspace" subtitle="Manage resources, utilization, team chat, and assignment privileges." />
      <div className="p-6 space-y-6 animate-fade-in">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'directory' | 'ownership')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2">
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-6">
        <PageSection
          title="Capacity & Team Directory"
          description="Review team capacity, resource utilization, and member assignments before making changes."
        />
        <div className="grid grid-cols-1 gap-6">
          <Card className="glass">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{members.length} team members</p>
                <div className="flex gap-2">
                  <Button variant={view === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setView('cards')} className="gap-2">
                    <LayoutGrid className="h-4 w-4" /> Cards
                  </Button>
                  <Button variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')} className="gap-2">
                    <TableIcon className="h-4 w-4" /> Table
                  </Button>
                  <Button size="sm" onClick={openAddForm} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Member
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Members', value: `${taskStats.filter((member) => !isInactiveMember(member)).length}` },
                  { label: 'Total Capacity', value: `${taskStats.reduce((sum, member) => sum + (isInactiveMember(member) ? 0 : member.capacityHours ?? 40), 0)}h` },
                  { label: 'Assigned Hours', value: `${taskStats.reduce((sum, member) => sum + member.assignedHours, 0)}h` },
                  { label: 'Average Utilization', value: `${Math.round(taskStats.filter((member) => !isInactiveMember(member)).reduce((sum, member) => sum + member.utilizationPct, 0) / Math.max(1, taskStats.filter((member) => !isInactiveMember(member)).length))}%` },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border p-4 bg-card/40">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-bold mt-1">{metric.value}</p>
                  </div>
                ))}
              </div>

              {view === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {taskStats.map((member) => (
                    <Card key={member.id} className={`glass hover:shadow-lg transition-all duration-300 group cursor-pointer ${isInactiveMember(member) ? 'opacity-60' : ''}`} onClick={() => setSelectedMember(member)}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`h-11 w-11 rounded-full ${member.avatarColor || 'gradient-primary'} flex items-center justify-center text-sm font-bold text-primary-foreground`}>
                                {member.avatar}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusDot[member.status]}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{member.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <p className="text-xs text-muted-foreground">{member.role}</p>
                                {isInactiveMember(member) ? <Badge variant="destructive" className="text-[10px]">Inactive</Badge> : null}
                                {currentProfileMember?.id === member.id ? (
                                  <Badge className="text-[10px]">Profile Access</Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditForm(member); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Utilization</span>
                            <span className="font-medium">{member.utilizationPct}%</span>
                          </div>
                          <Progress value={member.utilizationPct} className="h-1.5" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{member.assignedHours}/{isInactiveMember(member) ? 0 : member.capacityHours ?? 40}h</span>
                            <Badge variant="outline" className="text-[10px]">{member.privilegeRole}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="glass">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Privilege</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taskStats.map((member) => (
                        <TableRow key={member.id} className={`cursor-pointer ${isInactiveMember(member) ? 'opacity-60' : ''}`} onClick={() => setSelectedMember(member)}>
                          <TableCell className="font-medium">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{member.name}</span>
                              {isInactiveMember(member) ? <Badge variant="destructive" className="text-[10px]">Inactive</Badge> : null}
                              {currentProfileMember?.id === member.id ? (
                                <Badge className="text-[10px]">Profile Access</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{member.role}</TableCell>
                          <TableCell>{member.assignedHours}/{isInactiveMember(member) ? 0 : member.capacityHours ?? 40}h</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={member.utilizationPct} className="h-2 w-20" />
                              <span className="text-xs font-medium">{member.utilizationPct}%</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{member.privilegeRole}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditForm(member); }}>Edit</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="ownership" className="space-y-6">
        <PageSection
          title="Delivery Ownership"
          description="Cross-project workload and assignment visibility for every team member."
        />
        <Card className="glass">
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Task Ownership Snapshot</h3>
              <p className="text-xs text-muted-foreground">Cross-project assignment and professional utilization controls.</p>
            </div>
            <div className="space-y-3">
              {taskStats.map((member) => (
                <div key={member.id} className={`rounded-lg border p-3 bg-card/40 ${isInactiveMember(member) ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium">{member.name}</p>
                    <Badge variant={member.utilizationPct > (member.utilizationTarget ?? 85) ? 'destructive' : isInactiveMember(member) ? 'secondary' : 'outline'} className="text-[10px]">
                      {isInactiveMember(member) ? 'Inactive' : `${member.utilizationPct}% / target ${member.utilizationTarget ?? 85}%`}
                    </Badge>
                  </div>
                  {member.assignedTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No assigned tasks.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {member.assignedTasks.map((task) => (
                        <Badge key={task.id} variant="secondary" className="text-[10px]">
                          {task.title} - {task.workloadHours ?? 0}h
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Role / Title</Label>
                <Input value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Capacity Hours</Label>
                <Input type="number" value={form.capacityHours} onChange={(e) => setForm((prev) => ({ ...prev, capacityHours: Number(e.target.value) || 40 }))} />
              </div>
              <div className="grid gap-2">
                <Label>Utilization Target %</Label>
                <Input type="number" value={form.utilizationTarget} onChange={(e) => setForm((prev) => ({ ...prev, utilizationTarget: Number(e.target.value) || 85 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                    <SelectItem value="offline">Offline / Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Privilege Role</Label>
                <Select value={form.privilegeRole} onValueChange={(value) => setForm((prev) => ({ ...prev, privilegeRole: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings?.privilegeRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Avatar Color</Label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {avatarColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-7 w-7 rounded-full ${color} border-2 transition-all ${form.avatarColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                    onClick={() => setForm((prev) => ({ ...prev, avatarColor: color }))}
                  />
                ))}
              </div>
            </div>
            <DynamicCustomFields
              fields={teamCustomFields}
              values={normalizeCustomFieldValues(teamCustomFields, form.customFieldValues)}
              onChange={(key, value) => setForm((prev) => ({ ...prev, customFieldValues: { ...(prev.customFieldValues ?? {}), [key]: value } }))}
              columnsClassName="grid gap-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveMember}>{editingMember ? 'Save Changes' : 'Add Member'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!activeMember} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
        <SheetContent className="overflow-y-auto">
          {activeMember && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4 pt-2">
                  <div className={`h-16 w-16 rounded-full ${activeMember.avatarColor || 'gradient-primary'} flex items-center justify-center text-xl font-bold text-primary-foreground`}>
                    {activeMember.avatar}
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-lg">{activeMember.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{activeMember.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={isInactiveMember(activeMember) ? 'destructive' : 'outline'} className="text-xs capitalize">{isInactiveMember(activeMember) ? 'inactive' : activeMember.status}</Badge>
                      <Badge variant="secondary" className="text-xs">{activeMember.privilegeRole}</Badge>
                      {currentProfileMember?.id === activeMember.id ? (
                        <Badge className="text-xs">Linked Profile Access</Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => openEditForm(activeMember)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                    <p className="text-sm">{activeMember.email || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Capacity</p>
                    <p className="text-sm">{isInactiveMember(activeMember) ? 0 : activeMember.capacityHours ?? 40}h / target {activeMember.utilizationTarget ?? 85}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-3">Professional Utilization</p>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{activeMember.assignedHours} assigned hours</span>
                    <span className="font-medium">{activeMember.utilizationPct}%</span>
                  </div>
                  <Progress value={activeMember.utilizationPct} className="h-2" />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setSelectedTaskId(''); setAssignTaskOpen(true); }} disabled={isInactiveMember(activeMember)}>
                    <UserPlus className="h-3.5 w-3.5" /> Assign Task
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setSelectedProjectId(''); setAssignProjectOpen(true); }} disabled={isInactiveMember(activeMember)}>
                    <FolderPlus className="h-3.5 w-3.5" /> Assign Project
                  </Button>
                </div>

                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Safe member lifecycle</p>
                      <p className="mt-1 text-xs text-muted-foreground">Deactivate keeps history, preserves auditability, and prevents deleting project/timesheet history. Active tasks must be reassigned before deactivation.</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" className="mt-3 gap-2" onClick={() => setDeactivateOpen(true)} disabled={isInactiveMember(activeMember)}>
                    <UserMinus className="h-4 w-4" /> Deactivate / Reassign
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-3">Projects ({activeMember.assignedProjects.length})</p>
                  <div className="space-y-2">
                    {activeMember.assignedProjects.map((project) => (
                      <div key={project.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{project.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{project.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{project.progress}% complete</span>
                          </div>
                        </div>
                        <Progress value={project.progress} className="h-1.5 w-16" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-3">Assigned Tasks ({activeMember.assignedTasks.length})</p>
                  <div className="space-y-2">
                    {activeMember.assignedTasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                        {task.status === 'done' ? (
                          <CheckCircle className="h-4 w-4 mt-0.5 text-success shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{task.projectName} - {task.workloadHours ?? 0}h</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full gap-2 mt-2">
                  <Mail className="h-4 w-4" /> Open direct channel
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={assignTaskOpen} onOpenChange={setAssignTaskOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">Select a task</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger><SelectValue placeholder="Choose a task..." /></SelectTrigger>
              <SelectContent>
                {tasks.filter((task) => task.status !== 'done').map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTaskOpen(false)}>Cancel</Button>
            <Button onClick={assignTask} disabled={!selectedTaskId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignProjectOpen} onOpenChange={setAssignProjectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assign Project</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">Select a project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger><SelectValue placeholder="Choose a project..." /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignProjectOpen(false)}>Cancel</Button>
            <Button onClick={assignProject} disabled={!selectedProjectId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Deactivate Team Member Safely</DialogTitle></DialogHeader>
          {activeMember ? (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                <p className="font-semibold">{activeMember.name} has {activeMember.assignedTasks.length} assigned task(s).</p>
                <p className="mt-1 text-muted-foreground">Deactivation preserves historical data. If tasks exist, choose a replacement owner before continuing.</p>
              </div>
              {activeMember.assignedTasks.length > 0 ? (
                <div className="grid gap-2">
                  <Label>Reassign active tasks to</Label>
                  <Select value={reassignToMemberId || '__none__'} onValueChange={(value) => setReassignToMemberId(value === '__none__' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Select replacement member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select replacement member</SelectItem>
                      {activeMembersForReassign.map((member) => (
                        <SelectItem key={member.id} value={member.id}>{member.name} - {member.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deactivateMember} disabled={!!activeMember?.assignedTasks.length && !reassignToMemberId}>Deactivate Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Team;
