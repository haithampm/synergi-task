import { useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Search, TicketCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import TicketRegisterImporter from '@/components/tickets/TicketRegisterImporter';
import { useCreateTicket, useProjects, useTeamMembers, useTickets, useUpdateTicket } from '@/hooks/useProjects';
import { toast } from 'sonner';
import type { WorkspaceTicket } from '@/lib/workspace-store';

const ticketStatuses = ['open', 'in-progress', 'resolved', 'closed'];
const priorities = ['urgent', 'high', 'medium', 'low'];

const ticketRegisterColumns = [
  'ID',
  'Project',
  'Application',
  'Requested By',
  'Request Date',
  'Description (Case)',
  'Priority',
  'Ticket Number',
  'Status',
  'Closure Date',
  'Replay',
  'Note1',
  'Note2',
  'Actions',
];

const emptyDraft = {
  idText: '',
  projectId: '',
  application: '',
  requestedBy: '',
  requestDate: new Date().toISOString().slice(0, 10),
  descriptionCase: '',
  priority: 'medium',
  ticketNumber: '',
  status: 'open',
  closureDate: '',
  reply: '',
  note1: '',
  note2: '',
};

const getField = (ticket: any, key: string, fallback = '') => ticket?.[key] ?? ticket?.customFieldValues?.[key] ?? fallback;
const projectIdOf = (ticket: any) => ticket.projectId ?? ticket.project_id ?? getField(ticket, 'projectId', '');
const caseText = (ticket: any) => getField(ticket, 'descriptionCase', ticket.description ?? ticket.title ?? '');
const ticketNo = (ticket: any) => getField(ticket, 'ticketNumber', ticket.id ?? '');
const requestDate = (ticket: any) => getField(ticket, 'requestDate', ticket.createdAt?.slice?.(0, 10) ?? '');
const requestedBy = (ticket: any) => getField(ticket, 'requestedBy', ticket.assignee ?? '');
const application = (ticket: any) => getField(ticket, 'application', '');
const closureDate = (ticket: any) => getField(ticket, 'closureDate', '');
const replay = (ticket: any) => getField(ticket, 'replay', getField(ticket, 'reply', ''));
const note1 = (ticket: any) => getField(ticket, 'note1', '');
const note2 = (ticket: any) => getField(ticket, 'note2', '');

export default function TicketsPMORegister() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<WorkspaceTicket | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const { data: tickets = [] } = useTickets();
  const { data: projects = [] } = useProjects();
  const { data: teamMembers = [] } = useTeamMembers();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const projectFilterId = searchParams.get('projectId') ?? '';
  const projectNameById = useMemo(() => new Map(projects.map((project: any) => [project.id, project.name])), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket: any) => {
      const projectId = projectIdOf(ticket);
      const matchesProject = !projectFilterId || projectId === projectFilterId;
      const haystack = [ticket.id, ticketNo(ticket), projectNameById.get(projectId), application(ticket), requestedBy(ticket), requestDate(ticket), caseText(ticket), ticket.priority, ticket.status, closureDate(ticket), replay(ticket), note1(ticket), note2(ticket)].join(' ').toLowerCase();
      return matchesProject && (!q || haystack.includes(q));
    });
  }, [projectFilterId, projectNameById, search, tickets]);

  const openCreate = () => {
    setEditingTicket(null);
    setDraft({ ...emptyDraft, projectId: projectFilterId });
    setDialogOpen(true);
  };

  const openEdit = (ticket: WorkspaceTicket) => {
    const source = ticket as any;
    setEditingTicket(ticket);
    setDraft({
      idText: getField(source, 'idText', source.id),
      projectId: projectIdOf(source),
      application: application(source),
      requestedBy: requestedBy(source),
      requestDate: requestDate(source) || new Date().toISOString().slice(0, 10),
      descriptionCase: caseText(source),
      priority: source.priority ?? 'medium',
      ticketNumber: ticketNo(source),
      status: source.status ?? 'open',
      closureDate: closureDate(source),
      reply: replay(source),
      note1: note1(source),
      note2: note2(source),
    });
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const title = draft.ticketNumber?.trim() || draft.descriptionCase.trim().slice(0, 80) || 'New ticket case';
    const customFieldValues = {
      ...(editingTicket as any)?.customFieldValues,
      idText: draft.idText,
      projectId: draft.projectId,
      application: draft.application,
      requestedBy: draft.requestedBy,
      requestDate: draft.requestDate,
      descriptionCase: draft.descriptionCase,
      ticketNumber: draft.ticketNumber,
      closureDate: draft.closureDate,
      replay: draft.reply,
      reply: draft.reply,
      note1: draft.note1,
      note2: draft.note2,
    };
    return { title, description: draft.descriptionCase, priority: draft.priority as WorkspaceTicket['priority'], status: draft.status as WorkspaceTicket['status'], assignee: draft.requestedBy || 'Unassigned', projectId: draft.projectId || undefined, sla: draft.status === 'closed' ? 'Closed' : 'Active', customFieldValues, idText: draft.idText, application: draft.application, requestedBy: draft.requestedBy, requestDate: draft.requestDate, descriptionCase: draft.descriptionCase, ticketNumber: draft.ticketNumber, closureDate: draft.closureDate, replay: draft.reply, reply: draft.reply, note1: draft.note1, note2: draft.note2 } as any;
  };

  const saveTicket = async () => {
    if (!draft.descriptionCase.trim()) return toast.error('Description (Case) is required');
    if (!draft.ticketNumber.trim()) return toast.error('Ticket Number is required');
    const payload = buildPayload();
    if (editingTicket) {
      await updateTicket.mutateAsync({ id: editingTicket.id, ...payload });
      toast.success('Ticket case updated');
    } else {
      await createTicket.mutateAsync(payload as Partial<WorkspaceTicket> & { title: string });
      toast.success('Ticket case created');
    }
    window.dispatchEvent(new CustomEvent('workspace-data-changed', { detail: { entity: 'tickets', reason: 'ticket-form-save' } }));
    setDialogOpen(false);
    setEditingTicket(null);
  };

  const updateStatus = async (ticket: WorkspaceTicket, status: string) => {
    const closeDate = status === 'closed' ? new Date().toISOString().slice(0, 10) : closureDate(ticket as any);
    await updateTicket.mutateAsync({ id: ticket.id, status: status as WorkspaceTicket['status'], sla: status === 'closed' ? 'Closed' : 'Active', customFieldValues: { ...(ticket as any).customFieldValues, closureDate: closeDate }, closureDate: closeDate } as any);
    toast.success('Ticket status updated');
  };

  return (
    <AppLayout>
      <AppHeader title="Ticket Register" subtitle="PMO ticketing register using the approved ticket columns and form fields." />
      <div className="space-y-6 p-6 animate-fade-in">
        <div className="rounded-[1.75rem] border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Ticketing System</p>
              <h1 className="text-2xl font-black">Case Register</h1>
              <p className="text-sm text-muted-foreground">Columns: ID, Project, Application, Requested By, Request Date, Description (Case), Priority, Ticket Number, Status, Closure Date, Replay, Note1, Note2.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TicketRegisterImporter projects={projects as any} tickets={tickets as any} createTicket={createTicket as any} updateTicket={updateTicket as any} />
              <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Create Ticket Case</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search ID, project, application, requested by, ticket number, status, replay, notes..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Select value={projectFilterId || 'all'} onValueChange={(value) => setSearchParams(value === 'all' ? {} : { projectId: value }, { replace: true })}>
            <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Projects</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setSearch(''); setSearchParams({}, { replace: true }); }}>Reset</Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Total Cases</p><p className="mt-1 text-2xl font-bold">{filtered.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Open</p><p className="mt-1 text-2xl font-bold">{filtered.filter((ticket: any) => ticket.status === 'open').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">In Progress</p><p className="mt-1 text-2xl font-bold">{filtered.filter((ticket: any) => ticket.status === 'in-progress').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Closed</p><p className="mt-1 text-2xl font-bold">{filtered.filter((ticket: any) => ticket.status === 'closed').length}</p></CardContent></Card>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1900px] w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{ticketRegisterColumns.map((header) => <th key={header} className="px-3 py-3 text-left last:text-right">{header}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((ticket: any) => {
                  const projectId = projectIdOf(ticket);
                  return (
                    <tr key={ticket.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-3 font-mono text-xs">{getField(ticket, 'idText', ticket.id)}</td>
                      <td className="px-3 py-3 min-w-[180px]">{projectId ? <Link className="font-medium text-primary hover:underline" to={`/projects?projectId=${projectId}`}>{projectNameById.get(projectId) || 'Project'}</Link> : 'Not linked'}</td>
                      <td className="px-3 py-3">{application(ticket)}</td>
                      <td className="px-3 py-3">{requestedBy(ticket)}</td>
                      <td className="px-3 py-3"><CalendarDays className="mr-1 inline h-3 w-3" />{requestDate(ticket)}</td>
                      <td className="px-3 py-3 max-w-[320px]"><p className="line-clamp-2">{caseText(ticket)}</p></td>
                      <td className="px-3 py-3"><Badge variant="outline" className="capitalize">{ticket.priority}</Badge></td>
                      <td className="px-3 py-3 font-semibold">{ticketNo(ticket)}</td>
                      <td className="px-3 py-3"><Select value={ticket.status} onValueChange={(value) => updateStatus(ticket, value)}><SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{ticketStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/-/g, ' ')}</SelectItem>)}</SelectContent></Select></td>
                      <td className="px-3 py-3">{closureDate(ticket)}</td>
                      <td className="px-3 py-3 max-w-[260px]"><p className="line-clamp-2">{replay(ticket)}</p></td>
                      <td className="px-3 py-3 max-w-[220px]"><p className="line-clamp-2">{note1(ticket)}</p></td>
                      <td className="px-3 py-3 max-w-[220px]"><p className="line-clamp-2">{note2(ticket)}</p></td>
                      <td className="px-3 py-3 text-right"><Button variant="outline" size="sm" onClick={() => openEdit(ticket)}><Pencil className="mr-1 h-3 w-3" />Open</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length ? <div className="p-10 text-center text-sm text-muted-foreground">No ticket cases match the current filters.</div> : null}
          </div>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>{editingTicket ? 'Edit Ticket Case' : 'Create Ticket Case'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2 lg:grid-cols-3">
              <Input placeholder="ID" value={draft.idText} onChange={(e) => setDraft((p) => ({ ...p, idText: e.target.value }))} />
              <Select value={draft.projectId || '__none__'} onValueChange={(value) => setDraft((p) => ({ ...p, projectId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent><SelectItem value="__none__">No project</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Application" value={draft.application} onChange={(e) => setDraft((p) => ({ ...p, application: e.target.value }))} />
              <Select value={draft.requestedBy || '__manual__'} onValueChange={(value) => setDraft((p) => ({ ...p, requestedBy: value === '__manual__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Requested By" /></SelectTrigger><SelectContent><SelectItem value="__manual__">Manual entry</SelectItem>{teamMembers.map((member: any) => <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Requested By - manual" value={draft.requestedBy} onChange={(e) => setDraft((p) => ({ ...p, requestedBy: e.target.value }))} />
              <Input type="date" placeholder="Request Date" value={draft.requestDate} onChange={(e) => setDraft((p) => ({ ...p, requestDate: e.target.value }))} />
              <div className="lg:col-span-3"><Textarea rows={4} placeholder="Description (Case) *" value={draft.descriptionCase} onChange={(e) => setDraft((p) => ({ ...p, descriptionCase: e.target.value }))} /></div>
              <Select value={draft.priority} onValueChange={(value) => setDraft((p) => ({ ...p, priority: value }))}><SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Ticket Number *" value={draft.ticketNumber} onChange={(e) => setDraft((p) => ({ ...p, ticketNumber: e.target.value }))} />
              <Select value={draft.status} onValueChange={(value) => setDraft((p) => ({ ...p, status: value }))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{ticketStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/-/g, ' ')}</SelectItem>)}</SelectContent></Select>
              <Input type="date" placeholder="Closure Date" value={draft.closureDate} onChange={(e) => setDraft((p) => ({ ...p, closureDate: e.target.value }))} />
              <div className="lg:col-span-2"><Textarea rows={3} placeholder="Replay" value={draft.reply} onChange={(e) => setDraft((p) => ({ ...p, reply: e.target.value }))} /></div>
              <Textarea rows={3} placeholder="Note1" value={draft.note1} onChange={(e) => setDraft((p) => ({ ...p, note1: e.target.value }))} />
              <Textarea rows={3} placeholder="Note2" value={draft.note2} onChange={(e) => setDraft((p) => ({ ...p, note2: e.target.value }))} />
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm lg:col-span-3"><div className="flex items-center gap-2 font-semibold"><TicketCheck className="h-4 w-4 text-primary" /> Ticket Register Mapping</div><p className="mt-1 text-muted-foreground">All requested fields are saved with the ticket record and mirrored into custom field values for import/export compatibility.</p></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={saveTicket}>{editingTicket ? 'Save Ticket Case' : 'Create Ticket Case'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
