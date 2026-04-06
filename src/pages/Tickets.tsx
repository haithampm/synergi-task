import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Clock, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  createdAt: string;
  sla: string;
}

const tickets: Ticket[] = [
  { id: 'TK-001', title: 'Login page not loading on mobile', description: 'Users report blank screen on iOS Safari', status: 'open', priority: 'high', assignee: 'Bob Smith', createdAt: '2026-04-05', sla: '4h remaining' },
  { id: 'TK-002', title: 'Dashboard charts rendering slowly', description: 'Performance degradation with large datasets', status: 'in-progress', priority: 'medium', assignee: 'Hank Brown', createdAt: '2026-04-04', sla: '12h remaining' },
  { id: 'TK-003', title: 'Export CSV feature broken', description: 'File downloads as empty CSV', status: 'open', priority: 'high', assignee: 'Carol Davis', createdAt: '2026-04-06', sla: '2h remaining' },
  { id: 'TK-004', title: 'Update user profile API', description: 'Add support for avatar upload', status: 'resolved', priority: 'low', assignee: 'Dave Wilson', createdAt: '2026-04-01', sla: 'Met' },
  { id: 'TK-005', title: 'Email notification delay', description: 'Notifications arriving 30+ minutes late', status: 'in-progress', priority: 'medium', assignee: 'Eve Martinez', createdAt: '2026-04-03', sla: '8h remaining' },
];

const statusIcon: Record<string, React.ReactNode> = {
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

const Tickets = () => {
  const [search, setSearch] = useState('');
  const filtered = tickets.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <AppHeader title="Support Tickets" subtitle="Track and resolve support issues." />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tickets..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="gradient-primary text-primary-foreground shadow-glow gap-1.5">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>

        <div className="space-y-3">
          {filtered.map((ticket) => (
            <Card key={ticket.id} className="glass hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {statusIcon[ticket.status]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{ticket.id}</span>
                      <h3 className="font-medium text-sm">{ticket.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${statusStyle[ticket.status]}`}>{ticket.status}</Badge>
                      <span className="text-xs text-muted-foreground">Assigned: {ticket.assignee}</span>
                      <span className="text-xs text-muted-foreground">SLA: {ticket.sla}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs">
                    <MessageSquare className="h-3 w-3" /> Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Tickets;
