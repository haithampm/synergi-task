import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mail, MoreHorizontal, LayoutGrid, Table as TableIcon, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { teamMembers, tasks, type TeamMember } from '@/lib/mock-data';

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

const Team = () => {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const getMemberTasks = (memberName: string) => {
    const firstName = memberName.split(' ')[0];
    return tasks.filter(t => t.assignee === firstName);
  };

  return (
    <AppLayout>
      <AppHeader title="Team" subtitle="Manage your team and track performance." />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{teamMembers.length} team members</p>
          <div className="flex gap-2">
            <Button variant={view === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setView('cards')} className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Cards
            </Button>
            <Button variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')} className="gap-2">
              <TableIcon className="h-4 w-4" /> Table
            </Button>
          </div>
        </div>

        {/* Cards View */}
        {view === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {teamMembers.map((member) => {
              const completion = member.tasksAssigned > 0 ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100) : 0;
              return (
                <Card
                  key={member.id}
                  className="glass hover:shadow-lg transition-all duration-300 group cursor-pointer"
                  onClick={() => setSelectedMember(member)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-11 w-11 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                            {member.avatar}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${statusDot[member.status]}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
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
                {teamMembers.map((member) => {
                  const completion = member.tasksAssigned > 0 ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100) : 0;
                  return (
                    <TableRow key={member.id} className="cursor-pointer" onClick={() => setSelectedMember(member)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                              {member.avatar}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusDot[member.status]}`} />
                          </div>
                          <span className="font-medium text-sm">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.role}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{member.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{member.tasksCompleted}/{member.tasksAssigned}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={completion} className="h-2 w-20" />
                          <span className="text-xs font-medium">{completion}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                            <Mail className="h-3 w-3" /> Message
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
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

      {/* Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
        <SheetContent className="overflow-y-auto">
          {selectedMember && (() => {
            const completion = selectedMember.tasksAssigned > 0 ? Math.round((selectedMember.tasksCompleted / selectedMember.tasksAssigned) * 100) : 0;
            const memberTasks = getMemberTasks(selectedMember.name);
            return (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
                        {selectedMember.avatar}
                      </div>
                      <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background ${statusDot[selectedMember.status]}`} />
                    </div>
                    <div>
                      <SheetTitle className="text-lg">{selectedMember.name}</SheetTitle>
                      <p className="text-sm text-muted-foreground">{selectedMember.role}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{selectedMember.status}</Badge>
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Contact */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                    <p className="text-sm">{selectedMember.email}</p>
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

                  {/* Assigned Tasks */}
                  <div>
                    <p className="text-sm font-semibold mb-3">Assigned Tasks ({memberTasks.length})</p>
                    {memberTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tasks found in mock data.</p>
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
    </AppLayout>
  );
};

export default Team;
