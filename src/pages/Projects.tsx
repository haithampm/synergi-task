import { useState } from 'react';
import { Plus, Search, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { projects as mockProjects } from '@/lib/mock-data';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-muted text-muted-foreground border-border',
  'at-risk': 'bg-destructive/10 text-destructive border-destructive/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

const Projects = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', priority: 'medium' });

  const { data: dbProjects } = useProjects();
  const createProject = useCreateProject();

  const allProjects = dbProjects?.length ? dbProjects : mockProjects;
  const filtered = (allProjects as any[]).filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      await createProject.mutateAsync(newProject);
      toast.success('Project created!');
      setDialogOpen(false);
      setNewProject({ name: '', description: '', priority: 'medium' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Projects" subtitle={`${filtered.length} projects`} />
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input placeholder="Project name" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Description" value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} />
                <Select value={newProject.priority} onValueChange={v => setNewProject(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreate} disabled={createProject.isPending} className="w-full gradient-primary text-primary-foreground">
                  {createProject.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project: any) => (
            <Card key={project.id} className="glass hover:shadow-lg transition-all duration-300 group cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor[project.status] || ''}`}>
                    {project.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Progress value={project.progress} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{project.progress}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {project.end_date || project.endDate || 'No deadline'}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{project.priority}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No projects found. Create your first project!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Projects;
