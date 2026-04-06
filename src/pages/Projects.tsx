import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Calendar, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { projects } from '@/lib/mock-data';

const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-muted text-muted-foreground border-border',
  'at-risk': 'bg-destructive/10 text-destructive border-destructive/20',
};

const priorityBadge: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const Projects = () => {
  const [search, setSearch] = useState('');
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <AppHeader title="Projects" subtitle="Manage all your projects in one place." />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="gradient-primary text-primary-foreground shadow-glow gap-1.5">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="glass hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{project.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className={`text-[10px] ${statusColor[project.status]}`}>{project.status}</Badge>
                    <Badge variant="secondary" className={`text-[10px] ${priorityBadge[project.priority]}`}>{project.priority}</Badge>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <Progress value={project.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground font-medium w-9 text-right">{project.progress}%</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.tasksCompleted}/{project.tasksTotal} tasks</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {project.endDate}
                    </div>
                  </div>

                  <div className="flex -space-x-2 mt-3">
                    {project.team.slice(0, 3).map((member, i) => (
                      <div key={i} className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border-2 border-card">
                        {member.charAt(0)}
                      </div>
                    ))}
                    {project.team.length > 3 && (
                      <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                        +{project.team.length - 3}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Projects;
