import { useState, useMemo } from 'react';
import { Plus, Search, Calendar, FileText, MessageSquare, Users, Settings as SettingsIcon, MoreHorizontal, Download, Upload, Trash2, Milestone, ChevronRight, LayoutDashboard, Share2, Check, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import { projects as mockProjects } from '@/lib/mock-data';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const statusColor: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-muted text-muted-foreground border-border',
  'at-risk': 'bg-destructive/10 text-destructive border-destructive/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

const Projects = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    priority: 'medium',
    status: 'active',
    startDate: '',
    endDate: '',
    teamMembers: '',
    budget: '',
    department: '',
    files: [] as any[],
    milestones: [{ title: 'Initial Kickoff', date: '' }]
  });

  const { data: dbProjects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const allProjects = useMemo(() => {
    return dbProjects?.length ? dbProjects : mockProjects;
  }, [dbProjects]);

  const filtered = (allProjects as any[]).filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      await createProject.mutateAsync(newProject);
      toast.success('Project provisioned successfully');
      setDialogOpen(false);
      setNewProject({
        name: '', description: '', priority: 'medium', status: 'active',
        startDate: '', endDate: '', teamMembers: '', budget: '',
        department: '', files: [], milestones: [{ title: 'Initial Kickoff', date: '' }]
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProject) return;
    try {
      await updateProject.mutateAsync(selectedProject);
      toast.success('Project master updated');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  const openProjectDetail = (project: any) => {
    setSelectedProject({ ...project });
    setDetailOpen(true);
    setIsEditing(true);
  };

  return (
    <AppLayout>
      <AppHeader title="Enterprise Projects" subtitle={`${filtered.length} active portfolios`} />
      
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search master list..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-10 h-11 rounded-xl shadow-sm" 
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-11 rounded-xl shadow-sm bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-11 rounded-xl"><Share2 className="h-4 w-4 mr-2" /> Export</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground shadow-glow h-11 px-6 rounded-xl font-bold">
                  <Plus className="h-5 w-5 mr-2" /> Create ERP Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background p-0 border-none shadow-2xl">
                <div className="p-8 border-b bg-muted/5">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Project Master Definition</DialogTitle>
                  <CardDescription className="mt-1 text-sm">Define the complete project lifecycle, resource allocation, and initial schedule.</CardDescription>
                </div>
                
                <div className="p-8">
                  <Tabs defaultValue="details">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/20 p-1 rounded-xl mb-8">
                      <TabsTrigger value="details" className="rounded-lg py-2.5 font-bold">General Info</TabsTrigger>
                      <TabsTrigger value="schedule" className="rounded-lg py-2.5 font-bold">Schedule & Milestones</TabsTrigger>
                      <TabsTrigger value="files" className="rounded-lg py-2.5 font-bold">Governance & Files</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="space-y-6">
                      <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-12 space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Project Name *</label>
                          <Input placeholder="Enter high-level project title" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} className="h-12 text-lg rounded-xl" />
                        </div>
                        <div className="col-span-12 space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Detailed Scope</label>
                          <Textarea placeholder="Define project objectives, scope boundaries, and primary deliverables..." value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} rows={5} className="rounded-xl resize-none" />
                        </div>
                        <div className="col-span-6 space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Business Unit / Dept</label>
                          <Input placeholder="e.g. Strategic Engineering" value={newProject.department} onChange={e => setNewProject(p => ({ ...p, department: e.target.value }))} className="h-11 rounded-xl" />
                        </div>
                        <div className="col-span-6 space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Allocated Budget (USD)</label>
                          <Input placeholder="0.00" value={newProject.budget} onChange={e => setNewProject(p => ({ ...p, budget: e.target.value }))} className="h-11 rounded-xl" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-8">
                      <div className="grid grid-cols-2 gap-8 p-6 bg-muted/10 rounded-2xl border border-muted/50">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Target Start Date</label>
                          <Input type="date" value={newProject.startDate} onChange={e => setNewProject(p => ({ ...p, startDate: e.target.value }))} className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground">Target Completion Date</label>
                          <Input type="date" value={newProject.endDate} onChange={e => setNewProject(p => ({ ...p, endDate: e.target.value }))} className="h-11 rounded-xl" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2"><Milestone className="h-4 w-4 text-primary" /> Project Milestones</h4>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setNewProject(p => ({ ...p, milestones: [...p.milestones, { title: '', date: '' }] }))}>+ Add Milestone</Button>
                        </div>
                        <div className="space-y-3">
                          {newProject.milestones.map((m, i) => (
                            <div key={i} className="flex gap-3 items-center">
                              <Input placeholder="Milestone Title" className="flex-1 h-10 rounded-xl" value={m.title} onChange={e => {
                                const ms = [...newProject.milestones];
                                ms[i].title = e.target.value;
                                setNewProject({ ...newProject, milestones: ms });
                              }} />
                              <Input type="date" className="w-40 h-10 rounded-xl" value={m.date} onChange={e => {
                                const ms = [...newProject.milestones];
                                ms[i].date = e.target.value;
                                setNewProject({ ...newProject, milestones: ms });
                              }} />
                              <Button variant="ghost" size="icon" onClick={() => {
                                const ms = newProject.milestones.filter((_, idx) => idx !== i);
                                setNewProject({ ...newProject, milestones: ms });
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="files" className="space-y-6">
                      <div className="border-2 border-dashed rounded-3xl p-12 text-center space-y-4 bg-muted/5 hover:bg-muted/10 transition-colors border-muted/50">
                        <div className="bg-background p-5 rounded-2xl w-fit mx-auto shadow-glow">
                          <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-bold">Project Governance Documents</p>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Upload Project Charter, BOQ, Contracts, and Site Plans (Max 100MB per file)</p>
                        </div>
                        <Button variant="outline" className="h-10 px-8 rounded-xl font-bold">Browse Local Files</Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Resource Collaboration Group</label>
                        <Select defaultValue="all">
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Full Enterprise Access</SelectItem>
                            <SelectItem value="internal">Restricted Internal Only</SelectItem>
                            <SelectItem value="client">Client-Facing Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <DialogFooter className="p-8 border-t bg-muted/5">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 px-8 rounded-xl font-bold">Discard Changes</Button>
                  <Button onClick={handleCreate} disabled={createProject.isPending} className="gradient-primary text-primary-foreground px-12 h-11 rounded-xl font-bold shadow-glow">
                    {createProject.isPending ? 'Processing...' : 'Provision Project'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-64 bg-muted/30 animate-pulse rounded-3xl border border-muted/50" />)
          ) : (
            filtered.map((project: any) => (
              <Card 
                key={project.id} 
                className="glass-light hover:shadow-2xl transition-all duration-500 group cursor-pointer border-transparent hover:border-primary/20 overflow-hidden rounded-3xl"
                onClick={() => openProjectDetail(project)}
              >
                <CardHeader className="p-7 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-primary opacity-50" />
                        <CardTitle className="text-xl font-black group-hover:text-primary transition-colors tracking-tight">{project.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase font-black tracking-[0.2em] px-2.5 py-1 ${statusColor[project.status] || ''}`}>
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-7 pt-0 space-y-6">
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed min-h-[60px]">{project.description}</p>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      <span>Execution Health</span>
                      <span className="text-foreground">{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} className="h-2 rounded-full bg-muted/50" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-muted/10">
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-9 h-9 rounded-full border-4 border-background bg-muted flex items-center justify-center text-[10px] font-black shadow-sm">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <Calendar className="h-4 w-4 text-primary" />
                      {project.end_date || project.endDate || 'No deadline'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col bg-background border-none shadow-2xl">
          {selectedProject && (
            <>
              <div className="p-8 border-b bg-muted/5 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="bg-primary/10 p-4 rounded-2xl shadow-sm">
                    <LayoutDashboard className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-4">
                      <h2 className="text-3xl font-black tracking-tight">{selectedProject.name}</h2>
                      <Badge className={cn("px-4 py-1 font-black uppercase tracking-widest", statusColor[selectedProject.status])}>{selectedProject.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Enterprise Portfolio • ID: {selectedProject.id?.substring(0, 8)} • Modified Today</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="h-11 rounded-xl px-6 font-bold" variant="outline" onClick={() => navigate(`/schedule?projectId=${selectedProject.id}`)}>
                    <Calendar className="h-5 w-5 mr-2" /> Master Schedule
                  </Button>
                  <Button variant={isEditing ? "default" : "outline"} className="h-11 rounded-xl px-8 font-bold" onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}>
                    {isEditing ? 'Sync Changes' : 'Open Editor'}
                  </Button>
                  <Button variant="ghost" className="h-11 w-11 rounded-xl text-destructive border border-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                <Tabs defaultValue="overview" className="h-full flex flex-col">
                  <div className="px-8 bg-background border-b sticky top-0 z-10">
                    <TabsList className="bg-transparent gap-8 h-16">
                      <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-sm">Dashboard</TabsTrigger>
                      <TabsTrigger value="tasks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-sm">Execution & WBS</TabsTrigger>
                      <TabsTrigger value="forum" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-sm">Collaboration Forum</TabsTrigger>
                      <TabsTrigger value="files" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-sm">Document Library</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 p-8">
                    <TabsContent value="overview" className="mt-0 space-y-8">
                      <div className="grid grid-cols-12 gap-8">
                        <div className="col-span-8 space-y-8">
                          <Card className="shadow-none border-muted/50 rounded-3xl bg-muted/5 overflow-hidden">
                            <CardHeader className="p-8 pb-4">
                              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Scope & Deliverables
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 pt-0">
                              {isEditing ? (
                                <Textarea 
                                  value={selectedProject.description} 
                                  onChange={e => setSelectedProject({ ...selectedProject, description: e.target.value })}
                                  className="min-h-[200px] text-base leading-relaxed rounded-2xl bg-background border-muted/50 focus:border-primary/30"
                                  placeholder="Define project scope..."
                                />
                              ) : (
                                <p className="text-lg leading-relaxed font-medium text-foreground/80">{selectedProject.description || 'No formal scope definition provided.'}</p>
                              )}
                            </CardContent>
                          </Card>

                          <div className="grid grid-cols-2 gap-8">
                            <Card className="shadow-none border-muted/50 rounded-3xl overflow-hidden">
                              <CardHeader className="p-6 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Milestones</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-4">
                                {selectedProject.milestones?.length ? (
                                  selectedProject.milestones.map((m: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 bg-muted/10 rounded-xl border border-muted/30">
                                      <Milestone className="h-5 w-5 text-primary" />
                                      <div className="flex-1">
                                        <p className="text-sm font-bold">{m.title}</p>
                                        <p className="text-[10px] text-muted-foreground">{m.date || 'TBD'}</p>
                                      </div>
                                      <Check className="h-4 w-4 text-success opacity-50" />
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-6 text-muted-foreground text-xs italic">No milestones defined.</div>
                                )}
                              </CardContent>
                            </Card>
                            
                            <Card className="shadow-none border-muted/50 rounded-3xl overflow-hidden">
                              <CardHeader className="p-6 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Budget Performance</CardTitle></CardHeader>
                              <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Approved Budget</span>
                                    <span className="text-sm font-black">${selectedProject.budget || '0.00'}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Committed Cost</span>
                                    <span className="text-sm font-black">$0.00</span>
                                  </div>
                                  <Progress value={0} className="h-2" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        <div className="col-span-4 space-y-8">
                          <Card className="shadow-none border-muted/50 rounded-3xl bg-muted/5">
                            <CardHeader className="p-6 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Schedule Control</CardTitle></CardHeader>
                            <CardContent className="p-6 space-y-5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-muted-foreground">Start Date</span>
                                {isEditing ? <Input type="date" className="h-9 w-36 text-xs rounded-xl" value={selectedProject.start_date || ''} onChange={e => setSelectedProject({...selectedProject, start_date: e.target.value})} /> : <span className="text-sm font-black">{selectedProject.start_date || 'TBD'}</span>}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-muted-foreground">End Date</span>
                                {isEditing ? <Input type="date" className="h-9 w-36 text-xs rounded-xl" value={selectedProject.end_date || ''} onChange={e => setSelectedProject({...selectedProject, end_date: e.target.value})} /> : <span className="text-sm font-black">{selectedProject.end_date || 'TBD'}</span>}
                              </div>
                              <div className="flex justify-between items-center border-t border-muted/20 pt-4">
                                <span className="text-xs font-bold text-muted-foreground">Priority</span>
                                {isEditing ? (
                                  <Select value={selectedProject.priority} onValueChange={v => setSelectedProject({...selectedProject, priority: v})}>
                                    <SelectTrigger className="h-9 w-36 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="high">Critical</SelectItem>
                                      <SelectItem value="medium">Standard</SelectItem>
                                      <SelectItem value="low">Support</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : <Badge className="px-4 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedProject.priority}</Badge>}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-none border-muted/50 rounded-3xl">
                            <CardHeader className="p-6 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Project Team</CardTitle></CardHeader>
                            <CardContent className="p-6 space-y-4">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-[10px]">TM</div>
                                  <div className="flex-1">
                                    <p className="text-xs font-bold">Resource Name {i}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Lead Architect</p>
                                  </div>
                                </div>
                              ))}
                              <Button variant="outline" className="w-full h-9 rounded-xl text-xs font-bold mt-2">+ Add Resource</Button>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="tasks" className="mt-0 h-full">
                      <div className="bg-muted/10 rounded-3xl p-16 text-center border-2 border-dashed border-muted/50 flex flex-col items-center justify-center">
                        <div className="bg-background p-6 rounded-3xl shadow-glow mb-6">
                          <LayoutDashboard className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-black mb-3 tracking-tight">Enterprise WBS & Schedule</h3>
                        <p className="text-muted-foreground max-w-lg mb-8 text-sm font-medium">Full MS Project integrated schedule with Gantt charts, critical path analysis, and milestone management is available on the master schedule module.</p>
                        <Button className="h-12 px-10 rounded-2xl font-black gradient-primary text-primary-foreground shadow-glow" onClick={() => navigate(`/schedule?projectId=${selectedProject.id}`)}>
                          Switch to Master Schedule
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="forum" className="mt-0 h-full">
                      <div className="grid grid-cols-12 gap-8 h-[500px]">
                        <div className="col-span-12 flex flex-col border rounded-3xl bg-muted/5 overflow-hidden">
                          <div className="p-6 border-b bg-muted/10 flex items-center justify-between">
                            <h4 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="h-4 w-4" /> Discussion Board</h4>
                            <Badge variant="secondary" className="font-mono text-[10px]">12 Active Participants</Badge>
                          </div>
                          <div className="flex-1 p-8 flex flex-col justify-center items-center text-muted-foreground space-y-3 opacity-40 text-center">
                            <MessageSquare className="h-16 w-16 mb-2" />
                            <p className="text-lg font-black tracking-tight">Initialize Project Forum</p>
                            <p className="text-sm max-w-xs font-medium">Start the conversation about deliverables and blockers here. All team members will be notified.</p>
                          </div>
                          <div className="p-6 border-t bg-background">
                            <div className="flex gap-4">
                              <Input placeholder="Compose a detailed update or question for the team..." className="h-14 rounded-2xl shadow-sm text-sm border-muted/50" />
                              <Button className="h-14 px-10 rounded-2xl font-black gradient-primary text-primary-foreground shadow-glow">Post Message</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="files" className="mt-0">
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xl font-black tracking-tight">Project Governance Assets</h4>
                          <Button className="h-10 rounded-xl font-bold" variant="outline"><Upload className="h-4 w-4 mr-2" /> Upload Deliverable</Button>
                        </div>
                        <div className="grid grid-cols-4 gap-6">
                          {['Contract_signed.pdf', 'Charter_V2.docx', 'BOQ_Detailed.xlsx', 'Infrastructure_Plan.dwg'].map((file, i) => (
                            <Card key={i} className="shadow-none border-muted/50 hover:border-primary/50 hover:bg-muted/5 transition-all duration-300 rounded-3xl overflow-hidden group">
                              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div className="bg-primary/5 p-5 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm">
                                  <FileText className="h-10 w-10 text-primary" />
                                </div>
                                <div className="space-y-1 w-full">
                                  <p className="text-xs font-black truncate w-full tracking-tight">{file}</p>
                                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">3.2 MB • Oct 24</p>
                                </div>
                                <div className="flex gap-2 w-full pt-2">
                                  <Button size="sm" variant="secondary" className="h-10 px-0 flex-1 rounded-xl"><Download className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="ghost" className="h-10 px-0 flex-1 rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Projects;
