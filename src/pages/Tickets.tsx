import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, LayoutGrid, Link2, MessageSquare, Pencil, Plus, Search, Table2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import PageSection from '@/components/layout/PageSection';
import DynamicCustomFields from '@/components/forms/DynamicCustomFields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTicket, useProjects, useTasks, useTeamMembers, useTickets, useUpdateTicket, useWorkspaceSettings } from '@/hooks/useProjects';
import { getActiveCustomFields, normalizeCustomFieldValues } from '@/lib/custom-fields';
import { toast } from 'sonner';
import type { WorkspaceTicket } from '@/lib/workspace-store';

const statusIcon = {
  open: <AlertCircle className="h-4 w-4 text-destructive" />,
  'in-progress': <Clock className="h-4 w-4 text-warning" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const statusStyle: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  'in-progress': 'bg-warning/10 text-warning border-warning/20',
  resolved: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-border',
};

const emptyDraft = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'open',
  assignee: '',
  taskId: '',
  projectId: '',
  sla: '24h remaining',
  customFieldValues: {} as Record<string, string | number | boolean>,
};

const Tickets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [editingTicket, setEditingTicket] = useState<WorkspaceTicket | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const { data: tickets = [] } = useTickets();
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: settings } = useWorkspaceSettings();
  const ticketCustomFields = useMemo(() => getActiveCustomFields(settings, 'ticket'), [settings]);
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const projectFilterId = searchParams.get('projectId') ?? '';
  const filtered = useMemo(
    () =>
      tickets.filter((ticket) => {
        const linkedTask = tasks.find((task) => task.id === ticket.taskId);
        const matchesProject =
          !projectFilterId ||
          ticket.projectId === projectFilterId ||
          (linkedTask && (linkedTask.project_id ?? linkedTask.projectId) === projectFilterId);
        const haystack = `${ticket.id} ${ticket.title} ${ticket.description} ${ticket.assignee} ${ticket.sla}`.toLowerCase();
        return matchesProject && haystack.includes(search.toLowerCase());
      }),
    [projectFilterId, search, tasks, tickets],
  );

  const openCreate = () => {
    setEditingTicket(null);
    setDraft({ ...emptyDraft, customFieldValues: normalizeCustomFieldValues(ticketCustomFields, {}) });
    setDialogOpen(true);
  };

  const openEdit = (ticket: WorkspaceTicket) => {
    setEditingTicket(ticket);
    setDraft({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      assignee: ticket.assignee,
      taskId: ticket.taskId ?? '',
      projectId: ticket.projectId ?? '',
      sla: ticket.sla,
      customFieldValues: normalizeCustomFieldValues(ticketCustomFields, ticket.customFieldValues),
    });
    setDialogOpen(true);
  };

  const saveTicket = async () => {
    if (!draft.title.trim()) {
      toast.error('Ticket title is required');
      return;
    }

    const linkedTask = tasks.find((task) => task.id === draft.taskId);
    const payload: Partial<WorkspaceTicket> = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority as WorkspaceTicket['priority'],
      status: draft.status as WorkspaceTicket['status'],
      assignee: draft.assignee || 'Unassigned',
      taskId: draft.taskId || undefined,
      projectId: draft.projectId || linkedTask?.project_id || linkedTask?.projectId,
      sla: draft.sla || '24h remaining',
      customFieldValues: draft.customFieldValues,
    };

    if (editingTicket) {
      await updateTicket.mutateAsync({ id: editingTicket.id, ...payload });
      toast.success('Ticket updated');
    } else {
      await createTicket.mutateAsync(payload as Partial<WorkspaceTicket> & { title: string });
      toast.success('Ticket created');
    }

    setDialogOpen(false);
    setEditingTicket(null);
  };

  const addFollowUp = async (ticket: WorkspaceTicket) => {
    await updateTicket.mutateAsync({
      id: ticket.id,
      comments: [
        ...ticket.comments,
        {
          id: `${ticket.id}-comment-${ticket.comments.length + 1}`,
          author: settings?.currentUser.displayName ?? 'PM Office',
          message: 'Follow-up requested from support queue.',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    toast.success(`Added follow-up note to ${ticket.id}`);
  };

  return (
    <AppLayout>
      <AppHeader title="Support Tickets" subtitle="Editable ticket tracking with portfolio links, multiple views, and admin-configured form fields." />
      <div className="space-y-6 p-6 animate-fade-in">
        <PageSection
          title="Ticket Operations"
          description="Review service issues in list or table view, edit records quickly, and keep project blockers linked to tasks and projects."
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search tickets, assignee, SLA, or ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center rounded-xl border bg-muted/30 p-1">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}><LayoutGrid className="mr-2 h-4 w-4" />List</Button>
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('table')}><Table2 className="mr-2 h-4 w-4" />Table</Button>
          </div>
          {projectFilterId ? <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>Clear Project Filter</Button> : null}
          <Button className="gradient-primary text-primary-foreground shadow-glow gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Open', value: tickets.filter((ticket) => ticket.status === 'open').length },
            { label: 'In Progress', value: tickets.filter((ticket) => ticket.status === 'in-progress').length },
            { label: 'Resolved', value: tickets.filter((ticket) => ticket.status === 'resolved').length },
            { label: 'Linked To Tasks', value: tickets.filter((ticket) => ticket.taskId).length },
          ].map((item) => (
            <Card key={item.label} className="glass">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {viewMode === 'list' ? (
          <div className="space-y-3">
            {filtered.map((ticket) => {
              const linkedTask = tasks.find((task) => task.id === ticket.taskId);
              const linkedProject = projects.find((project) => project.id === (ticket.projectId ?? linkedTask?.project_id ?? linkedTask?.projectId));
              return (
                <Card key={ticket.id} className="glass transition-all hover:shadow-md">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-3">
                        {statusIcon[ticket.status]}
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                            <h3 className="font-medium">{ticket.title}</h3>
                            <Badge variant="outline" className={statusStyle[ticket.status]}>{ticket.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{ticket.description || 'No issue summary entered yet.'}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>Assigned: {ticket.assignee}</span>
                            <span>SLA: {ticket.sla}</span>
                            {linkedProject ? <span>Project: {linkedProject.name}</span> : null}
                            {linkedTask ? <span>Task: {linkedTask.title}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={ticket.status}
                          onValueChange={(value) =>
                            updateTicket.mutate(
                              { id: ticket.id, status: value as WorkspaceTicket['status'] },
                              { onSuccess: () => toast.success(`Ticket ${ticket.id} updated`) },
                            )
                          }
                        >
                          <SelectTrigger className="h-9 w-[150px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => openEdit(ticket)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => addFollowUp(ticket)}><MessageSquare className="mr-2 h-3.5 w-3.5" />Follow Up</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3">SLA</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => {
                    const linkedTask = tasks.find((task) => task.id === ticket.taskId);
                    const linkedProject = projects.find((project) => project.id === (ticket.projectId ?? linkedTask?.project_id ?? linkedTask?.projectId));
                    return (
                      <tr key={ticket.id} className="border-t">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground">{ticket.id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{linkedProject?.name || 'Not linked'}</td>
                        <td className="px-4 py-3">{linkedTask?.title || 'Not linked'}</td>
                        <td className="px-4 py-3">
                          <Select value={ticket.priority} onValueChange={(value) => updateTicket.mutate({ id: ticket.id, priority: value as WorkspaceTicket['priority'] })}>
                            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Select value={ticket.status} onValueChange={(value) => updateTicket.mutate({ id: ticket.id, status: value as WorkspaceTicket['status'] })}>
                            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">{ticket.assignee}</td>
                        <td className="px-4 py-3">{ticket.sla}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(ticket)}>Open</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingTicket ? 'Edit Ticket' : 'Create Ticket'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Input placeholder="Ticket title" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Textarea placeholder="Describe the issue, impact, and expected fix." value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <Select value={draft.projectId || '__none__'} onValueChange={(value) => setDraft((prev) => ({ ...prev, projectId: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={draft.taskId || '__none__'} onValueChange={(value) => setDraft((prev) => ({ ...prev, taskId: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Linked task" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No linked task</SelectItem>
                    {tasks
                      .filter((task) => !draft.projectId || (task.project_id ?? task.projectId) === draft.projectId)
                      .map((task) => (
                        <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={draft.priority} onValueChange={(value) => setDraft((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={draft.status} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={draft.assignee || '__none__'} onValueChange={(value) => setDraft((prev) => ({ ...prev, assignee: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="SLA" value={draft.sla} onChange={(e) => setDraft((prev) => ({ ...prev, sla: e.target.value }))} />
              </div>

              <DynamicCustomFields
                fields={ticketCustomFields}
                values={normalizeCustomFieldValues(ticketCustomFields, draft.customFieldValues)}
                onChange={(key, value) => setDraft((prev) => ({ ...prev, customFieldValues: { ...prev.customFieldValues, [key]: value } }))}
              />

              {draft.taskId ? (
                <div className="rounded-2xl border border-muted/60 bg-muted/10 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Link2 className="h-4 w-4 text-primary" />
                    Linked delivery record
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {tasks.find((task) => task.id === draft.taskId)?.title || 'Task selected'} • {projects.find((project) => project.id === draft.projectId)?.name || 'Project will be inferred from the linked task'}
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveTicket} className="gradient-primary text-primary-foreground">{editingTicket ? 'Save Ticket' : 'Create Ticket'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Tickets;
