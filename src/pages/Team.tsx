import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mail, MoreHorizontal, LayoutGrid, Table as TableIcon, CheckCircle, Clock, AlertCircle, Plus, Pencil, UserPlus, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { teamMembers as initialMembers, tasks as initialTasks, projects as mockProjects, type TeamMember, type Task } from '@/lib/mock-data';

const statusDot: Record<string, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-muted-foreground/40',
};

const priorityColor: Record<string, string> = {
  urgent: 'text-destructive',
  high: 'text-warning',
  medium: 'text-primary',
  low: 'text-muted-foreground',
};

const avatarColors = [
  { label: 'Primary', class: 'gradient-primary' },
  { label: 'Blue', class: 'bg-blue-600' },
  { label: 'Green', class: 'bg-emerald-600' },
  { label: 'Purple', class: 'bg-purple-600' },
  { label: 'Orange', class: 'bg-orange-500' },
  { label: 'Pink', class: 'bg-pink-500' },
  { label: 'Teal', class: 'bg-teal-600' },
  { label: 'Red', class: 'bg-red-600' },
];

interface ExtendedMember extends TeamMember {
  phone?: string;
  department?: string;
  avatarColor?: string;
  assignedProjectIds?: string[];
}

const emptyForm = (): Omit<ExtendedMember, 'id'> => ({
  name: '', role: '', avatar: '', email: '', phone: '', department: '',
  tasksAssigned: 0, tasksCompleted: 0, status: 'online' as const, avatarColor: 'gradient-primary', assignedProjectIds: [],
});

const Team = () => {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [members, setMembers] = useState<ExtendedMember[]>(initialMembers.map(m => ({ ...m, phone: '', department: '', avatarColor: 'gradient-primary', assignedProjectIds: [] })));
  const [localTasks, setLocalTasks] = useState<Task[]>([...initialTasks]);
  const [selectedMember, setSelectedMember] = useState<ExtendedMember | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  // Assign dialogs
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [assignProjectOpen, setAssignProjectOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const getMemberTasks = (memberName: string) => {
    const firstName = memberName.split(' ')[0];
    return localTasks.filter(t => t.assignee === firstName);
  };

  const getMemberProjects = (member: ExtendedMember) => {
    const ids = member.assignedProjectIds || [];
    const fromTasks = getMemberTasks(member.name).map(t => t.projectId);
    const allIds = [...new Set([...ids, ...fromTasks])];
    return mockProjects.filter(p => allIds.includes(p.id));
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEditForm = (member: ExtendedMember) => {
    setEditingId(member.id);
    setForm({ ...member });
    setFormOpen(true);
  };

  const handleFormSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const initials = form.name.split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2);

    if (editingId) {
      setMembers(prev => prev.map(m => m.id === editingId ? { ...m, ...form, avatar: initials } : m));
      if (selectedMember?.id === editingId) {
        setSelectedMember(prev => prev ? { ...prev, ...form, avatar: initials } : null);
      }
      toast.success('Member updated');
    } else {
      const newMember: ExtendedMember = {
        ...form,
        id: `m${Date.now()}`,
        avatar: initials,
        assignedProjectIds: [],
      };
      setMembers(prev => [...prev, newMember]);
      toast.success('Member added');
    }
    setFormOpen(false);
  };

  const handleAssignTask = () => {
    if (!selectedTaskId || !selectedMember) return;
    const firstName = selectedMember.name.split(' ')[0];
    setLocalTasks(prev => prev.map(t => t.id === selectedTaskId ? { ...t, assignee: firstName } : t));
    setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, tasksAssigned: m.tasksAssigned + 1 } : m));
    setSelectedMember(prev => prev ? { ...prev, tasksAssigned: prev.tasksAssigned + 1 } : null);
    toast.success('Task assigned');
    setAssignTaskOpen(false);
    setSelectedTaskId('');
  };

  const handleAssignProject = () => {
    if (!selectedProjectId || !selectedMember) return;
    setMembers(prev => prev.map(m => {
      if (m.id !== selectedMember.id) return m;
      const ids = new Set(m.assignedProjectIds || []);
      ids.add(selectedProjectId);
      return { ...m, assignedProjectIds: [...ids] };
    }));
    setSelectedMember(prev => {
      if (!prev) return null;
      const ids = new Set(prev.assignedProjectIds || []);
      ids.add(selectedProjectId);
      return { ...prev, assignedProjectIds: [...ids] };
    });
    toast.success('Project assigned');
    setAssignProjectOpen(false);
    setSelectedProjectId('');
  };

  return (
    <AppLayout>
      <AppHeader title="Team" subtitle="Manage your team and track performance." />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* View Toggle + Add */}
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

        {/* Cards View */}
        {view === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {members.map((member) => {
              const completion = member.tasksAssigned > 0 ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100) : 0;
              return (
                <Card key={member.id} className="glass hover:shadow-lg transition-all duration-300 group cursor-pointer" onClick={() => setSelectedMember(member)}>
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
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditForm(member); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Task completion</span>
                          <span className="font-medium">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{member.tasksCompleted}/{member.tasksAssigned} tasks</span>
                        <Badge variant="outline" className="text-[10px]">{member.status}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-4 gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                      <Mail className="h-3 w-3" /> Send Message
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Table View */}
        {view === 'table' && (
          <Card className="glass">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const completion = member.tasksAssigned > 0 ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100) : 0;
                  return (
                    <TableRow key={member.id} className="cursor-pointer" onClick={() => setSelectedMember(member)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`h-9 w-9 rounded-full ${member.avatarColor || 'gradient-primary'} flex items-center justify-center text-xs font-bold text-primary-foreground`}>
                              {member.avatar}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusDot[member.status]}`} />
                          </div>
                          <span className="font-medium text-sm">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.role}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{member.status}</Badge></TableCell>
                      <TableCell className="text-sm">{member.tasksCompleted}/{member.tasksAssigned}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={completion} className="h-2 w-20" />
                          <span className="text-xs font-medium">{completion}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => openEditForm(member)}>
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                            <Mail className="h-3 w-3" /> Message
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Add/Edit Member Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Member' : 'Add New Member'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Role / Title</Label>
                <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Developer" />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input value={form.department || ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Engineering" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 234 567 890" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Avatar Color</Label>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {avatarColors.map(c => (
                    <button
                      key={c.class}
                      type="button"
                      className={`h-7 w-7 rounded-full ${c.class} border-2 transition-all ${form.avatarColor === c.class ? 'border-foreground scale-110' : 'border-transparent'}`}
                      onClick={() => setForm(f => ({ ...f, avatarColor: c.class }))}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleFormSave}>{editingId ? 'Save Changes' : 'Add Member'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
        <SheetContent className="overflow-y-auto">
          {selectedMember && (() => {
            const completion = selectedMember.tasksAssigned > 0 ? Math.round((selectedMember.tasksCompleted / selectedMember.tasksAssigned) * 100) : 0;
            const memberTasks = getMemberTasks(selectedMember.name);
            const memberProjects = getMemberProjects(selectedMember);
            return (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="relative">
                      <div className={`h-16 w-16 rounded-full ${selectedMember.avatarColor || 'gradient-primary'} flex items-center justify-center text-xl font-bold text-primary-foreground`}>
                        {selectedMember.avatar}
                      </div>
                      <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background ${statusDot[selectedMember.status]}`} />
                    </div>
                    <div className="flex-1">
                      <SheetTitle className="text-lg">{selectedMember.name}</SheetTitle>
                      <p className="text-sm text-muted-foreground">{selectedMember.role}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{selectedMember.status}</Badge>
                        {selectedMember.department && <Badge variant="secondary" className="text-xs">{selectedMember.department}</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { openEditForm(selectedMember); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                      <p className="text-sm">{selectedMember.email}</p>
                    </div>
                    {selectedMember.phone && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Phone</p>
                        <p className="text-sm">{selectedMember.phone}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Stats */}
                  <div>
                    <p className="text-sm font-semibold mb-3">Task Completion</p>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{selectedMember.tasksCompleted} of {selectedMember.tasksAssigned} tasks</span>
                      <span className="font-medium">{completion}%</span>
                    </div>
                    <Progress value={completion} className="h-2" />
                  </div>

                  <Separator />

                  {/* Assign Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setSelectedTaskId(''); setAssignTaskOpen(true); }}>
                      <UserPlus className="h-3.5 w-3.5" /> Assign to Task
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setSelectedProjectId(''); setAssignProjectOpen(true); }}>
                      <FolderPlus className="h-3.5 w-3.5" /> Assign to Project
                    </Button>
                  </div>

                  {/* Assigned Projects */}
                  {memberProjects.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-semibold mb-3">Projects ({memberProjects.length})</p>
                        <div className="space-y-2">
                          {memberProjects.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{p.progress}% complete</span>
                                </div>
                              </div>
                              <Progress value={p.progress} className="h-1.5 w-16" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Assigned Tasks */}
                  <div>
                    <p className="text-sm font-semibold mb-3">Assigned Tasks ({memberTasks.length})</p>
                    {memberTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tasks assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {memberTasks.map(task => (
                          <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                            {task.status === 'done' ? (
                              <CheckCircle className="h-4 w-4 mt-0.5 text-success shrink-0" />
                            ) : task.status === 'in-progress' ? (
                              <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
                                <span className={`text-[10px] font-medium ${priorityColor[task.priority]}`}>{task.priority}</span>
                                <span className="text-[10px] text-muted-foreground">{task.projectName}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button className="w-full gap-2 mt-2">
                    <Mail className="h-4 w-4" /> Send Message
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Assign to Task Dialog */}
      <Dialog open={assignTaskOpen} onOpenChange={setAssignTaskOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Task to {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">Select a task</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger><SelectValue placeholder="Choose a task..." /></SelectTrigger>
              <SelectContent>
                {localTasks.filter(t => t.assignee !== selectedMember?.name.split(' ')[0] && t.status !== 'done').map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="truncate">{t.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs">({t.projectName})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignTask} disabled={!selectedTaskId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Project Dialog */}
      <Dialog open={assignProjectOpen} onOpenChange={setAssignProjectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Project to {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">Select a project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger><SelectValue placeholder="Choose a project..." /></SelectTrigger>
              <SelectContent>
                {mockProjects.filter(p => !selectedMember?.assignedProjectIds?.includes(p.id)).map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    <span className="text-muted-foreground ml-2 text-xs">({p.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignProject} disabled={!selectedProjectId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Team;
