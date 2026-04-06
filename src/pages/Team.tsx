import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mail, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { teamMembers } from '@/lib/mock-data';

const statusDot: Record<string, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-muted-foreground/40',
};

const Team = () => {
  return (
    <AppLayout>
      <AppHeader title="Team" subtitle="Manage your team and track performance." />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {teamMembers.map((member) => {
            const completion = member.tasksAssigned > 0 ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100) : 0;
            return (
              <Card key={member.id} className="glass hover:shadow-lg transition-all duration-300 group">
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
                    <Button variant="ghost" size="icon" className="h-7 w-7">
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

                  <Button variant="outline" size="sm" className="w-full mt-4 gap-1.5 text-xs">
                    <Mail className="h-3 w-3" /> Send Message
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Team;
