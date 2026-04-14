import { useState } from 'react';
import { Plus, Search, Calendar, FileText, MessageSquare, Users, Settings as SettingsIcon, MoreHorizontal, Download, Upload, Trash2 } from 'lucide-react';
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
    files: [] as any[]
  });

  const { data: dbProjects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

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
      toast.success('Project created successfully');
      setDialogOpen(false);
      setNewProject({
        name: '',
        description: '',
        priority: 'medium',
        status: 'active',
        startDate: '',
        endDate: '',
        teamMembers: '',
        budget: '',
        department: '',
        files: []
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProject) return;
    try {
      await updateProject.mutateAsync(selectedProject);
      toast.success('Project updated');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  const openProjectDetail = (project: any) => {
    setSelectedProject({ ...project });
    setDetailOpen(true);
    setIsEditing(false);
  };

  return (
    <AppLayout>
      <AppHeader title=\"Projects\" subtitle={`${filtered.length} total projects`} />
      
      <div className=\"p-6 space-y-6 animate-fade-in\">
        <div className=\"flex items-center justify-between gap-4 flex-wrap\">
          <div className=\"flex items-center gap-3 flex-1 min-w-[300px]\">
            <div className=\"relative flex-1 max-w-sm\">
              <Search className=\"absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground\" />
              <Input 
                placeholder=\"Search projects...\" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className=\"pl-10 h-10\" 
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className=\"w-40 h-10\">
                <SelectValue placeholder=\"Status\" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=\"all\">All Status</SelectItem>
                <SelectItem value=\"active\">Active</SelectItem>
                <SelectItem value=\"at-risk\">At Risk</SelectItem>
                <SelectItem value=\"on-hold\">On Hold</SelectItem>
                <SelectItem value=\"completed\">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className=\"gradient-primary text-primary-foreground shadow-glow h-10 px-5\">
                <Plus className=\"h-4 w-4 mr-2\" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className=\"max-w-3xl max-h-[90vh] overflow-y-auto\">
              <DialogHeader>
                <DialogTitle className=\"text-xl\">Create New Project</DialogTitle>
                <CardDescription>Enter project details, schedule, and attach initial documents.</CardDescription>
              </DialogHeader>
              
              <Tabs defaultValue=\"details\" className=\"mt-4\">
                <TabsList className=\"grid w-full grid-cols-3\">
                  <TabsTrigger value=\"details\">General Info</TabsTrigger>
                  <TabsTrigger value=\"schedule\">Schedule & Team</TabsTrigger>
                  <TabsTrigger value=\"files\">Files & Setup</TabsTrigger>
                </TabsList>
                
                <TabsContent value=\"details\" className=\"space-y-4 pt-4\">
                  <div className=\"space-y-2\">
                    <label className=\"text-sm font-medium\">Project Name *</label>
                    <Input placeholder=\"Enter project title\" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className=\"space-y-2\">
                    <label className=\"text-sm font-medium\">Description</label>
                    <Textarea placeholder=\"Project scope and goals...\" value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} rows={4} />
                  </div>
                  <div className=\"grid grid-cols-2 gap-4\">
                    <div className=\"space-y-2\">
                      <label className=\"text-sm font-medium\">Department</label>
                      <Input placeholder=\"e.g. Engineering\" value={newProject.department} onChange={e => setNewProject(p => ({ ...p, department: e.target.value }))} />
                    </div>
                    <div className=\"space-y-2\">
                      <label className=\"text-sm font-medium\">Budget</label>
                      <Input placeholder=\"0.00\" value={newProject.budget} onChange={e => setNewProject(p => ({ ...p, budget: e.target.value }))} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value=\"schedule\" className=\"space-y-4 pt-4\">
                  <div className=\"grid grid-cols-2 gap-4\">
                    <div className=\"space-y-2\">
                      <label className=\"text-sm font-medium\">Start Date</label>
                      <Input type=\"date\" value={newProject.startDate} onChange={e => setNewProject(p => ({ ...p, startDate: e.target.value }))} />
                    </div>
                    <div className=\"space-y-2\">
                      <label className=\"text-sm font-medium\">End Date</label>
                      <Input type=\"date\" value={newProject.endDate} onChange={e => setNewProject(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className=\"space-y-2\">
                    <label className=\"text-sm font-medium\">Priority</label>
                    <Select value={newProject.priority} onValueChange={v => setNewProject(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value=\"high\">High Priority</SelectItem>
                        <SelectItem value=\"medium\">Medium Priority</SelectItem>
                        <SelectItem value=\"low\">Low Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className=\"space-y-2\">
                    <label className=\"text-sm font-medium\">Team Members (emails)</label>
                    <Input placeholder=\"user1@company.com, user2@company.com\" value={newProject.teamMembers} onChange={e => setNewProject(p => ({ ...p, teamMembers: e.target.value }))} />
                  </div>
                </TabsContent>

                <TabsContent value=\"files\" className=\"space-y-4 pt-4\">
                  <div className=\"border-2 border-dashed rounded-xl p-8 text-center space-y-3 bg-muted/20\">
                    <div className=\"bg-background p-3 rounded-full w-fit mx-auto shadow-sm\">
                      <Upload className=\"h-6 w-6 text-primary\" />
                    </div>
                    <div>
                      <p className=\"font-medium\">Upload project documents</p>
                      <p className=\"text-xs text-muted-foreground\">Charter, BOQ, Contracts, or Plans (Max 50MB)</p>
                    </div>
                    <Button variant=\"outline\" size=\"sm\">Browse Files</Button>
                  </div>
                  
                  <div className=\"space-y-2\">
                    <label className=\"text-sm font-medium\">Collaboration Group</label>
                    <Select defaultValue=\"all\">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value=\"all\">Entire Team</SelectItem>
                        <SelectItem value=\"internal\">Internal Only</SelectItem>
                        <SelectItem value=\"client\">Client & Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className=\"mt-6\">
                <Button variant=\"outline\" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createProject.isPending} className=\"gradient-primary text-primary-foreground px-8\">
                  {createProject.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\">
            {[1, 2, 3].map(i => <div key={i} className=\"h-48 bg-muted animate-pulse rounded-xl\" />)}
          </div>
        ) : (
          <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\">
            {filtered.map((project: any) => (
              <Card 
                key={project.id} 
                className=\"glass hover:shadow-xl transition-all duration-300 group cursor-pointer border-transparent hover:border-primary/20\"
                onClick={() => openProjectDetail(project)}
              >
                <CardHeader className=\"pb-3\">
                  <div className=\"flex items-start justify-between\">
                    <div className=\"space-y-1\">
                      <CardTitle className=\"text-lg font-bold group-hover:text-primary transition-colors\">{project.name}</CardTitle>
                      <CardDescription className=\"line-clamp-2\">{project.description}</CardDescription>
                    </div>
                    <Badge variant=\"outline\" className={`text-[10px] uppercase font-bold tracking-wider shrink-0 ${statusColor[project.status] || ''}`}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className=\"space-y-4\">
                  <div className=\"space-y-2\">
                    <div className=\"flex justify-between text-xs font-medium\">
                      <span className=\"text-muted-foreground\">Completion</span>
                      <span>{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} className=\"h-2\" />
                  </div>
                  
                  <div className=\"flex items-center justify-between pt-2\">
                    <div className=\"flex -space-x-2\">
                      {[1, 2, 3].map(i => (
                        <div key={i} className=\"w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold\">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                      <div className=\"w-7 h-7 rounded-full border-2 border-background bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold\">
                        +2
                      </div>
                    </div>
                    <div className=\"flex items-center gap-1.5 text-xs text-muted-foreground font-medium\">
                      <Calendar className=\"h-3.5 w-3.5\" />
                      {project.end_date || project.endDate || 'No deadline'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className=\"text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed\">
            <div className=\"bg-background p-4 rounded-full w-fit mx-auto shadow-sm mb-4\">
              <FileText className=\"h-8 w-8 text-muted-foreground\" />
            </div>
            <h3 className=\"text-lg font-bold\">No projects found</h3>
            <p className=\"text-muted-foreground max-w-xs mx-auto mt-1\">Try adjusting your search or create a new project to get started.</p>
            <Button variant=\"outline\" className=\"mt-6\" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Clear Filters</Button>
          </div>
        )}
      </div>

      {/* Project Detail Drawer/Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className=\"max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col\">
          {selectedProject && (
            <>
              <div className=\"p-6 border-b bg-muted/10 flex items-center justify-between\">
                <div className=\"space-y-1\">
                  <div className=\"flex items-center gap-3\">
                    <h2 className=\"text-2xl font-bold\">{selectedProject.name}</h2>
                    <Badge className={statusColor[selectedProject.status]}>{selectedProject.status}</Badge>
                  </div>
                  <p className=\"text-sm text-muted-foreground\">Project ID: {selectedProject.id.substring(0, 8)} • Created 2 days ago</p>
                </div>
                <div className=\"flex gap-2\">
                  <Button variant=\"outline\" size=\"sm\" onClick={() => navigate(`/schedule?projectId=${selectedProject.id}`)}>
                    <Calendar className=\"h-4 w-4 mr-2\" /> View Schedule
                  </Button>
                  <Button variant={isEditing ? \"default\" : \"outline\"} size=\"sm\" onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}>
                    {isEditing ? 'Save Changes' : 'Edit Project'}
                  </Button>
                  <Button variant=\"ghost\" size=\"icon\" className=\"text-destructive\"><Trash2 className=\"h-4 w-4\" /></Button>
                </div>
              </div>

              <div className=\"flex-1 overflow-y-auto p-6\">
                <Tabs defaultValue=\"overview\">
                  <TabsList className=\"mb-6\">
                    <TabsTrigger value=\"overview\">Overview</TabsTrigger>
                    <TabsTrigger value=\"tasks\">Tasks & Schedule</TabsTrigger>
                    <TabsTrigger value=\"team\">Team & Collab</TabsTrigger>
                    <TabsTrigger value=\"files\">Documents ({selectedProject.files?.length || 0})</TabsTrigger>
                    <TabsTrigger value=\"activity\">History</TabsTrigger>
                  </TabsList>

                  <TabsContent value=\"overview\" className=\"space-y-8\">
                    <div className=\"grid grid-cols-3 gap-6\">
                      <Card className=\"col-span-2 shadow-none border-muted/50\">
                        <CardHeader>
                          <CardTitle className=\"text-sm font-bold uppercase tracking-wider text-muted-foreground\">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {isEditing ? (
                            <Textarea 
                              value={selectedProject.description} 
                              onChange={e => setSelectedProject({ ...selectedProject, description: e.target.value })}
                              className=\"min-h-[150px]\"
                            />
                          ) : (
                            <p className=\"text-sm leading-relaxed\">{selectedProject.description || 'No description provided for this project.'}</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      <div className=\"space-y-6\">
                        <Card className=\"shadow-none border-muted/50\">
                          <CardHeader className=\"pb-2\"><CardTitle className=\"text-xs font-bold uppercase text-muted-foreground\">Schedule Details</CardTitle></CardHeader>
                          <CardContent className=\"space-y-4\">
                            <div className=\"flex justify-between\">
                              <span className=\"text-xs text-muted-foreground\">Start</span>
                              {isEditing ? <Input type=\"date\" className=\"h-7 w-32 text-xs\" value={selectedProject.start_date || ''} onChange={e => setSelectedProject({...selectedProject, start_date: e.target.value})} /> : <span className=\"text-xs font-bold\">{selectedProject.start_date || '-'}</span>}
                            </div>
                            <div className=\"flex justify-between\">
                              <span className=\"text-xs text-muted-foreground\">End</span>
                              {isEditing ? <Input type=\"date\" className=\"h-7 w-32 text-xs\" value={selectedProject.end_date || ''} onChange={e => setSelectedProject({...selectedProject, end_date: e.target.value})} /> : <span className=\"text-xs font-bold\">{selectedProject.end_date || '-'}</span>}
                            </div>
                            <div className=\"flex justify-between\">
                              <span className=\"text-xs text-muted-foreground\">Priority</span>
                              {isEditing ? (
                                <Select value={selectedProject.priority} onValueChange={v => setSelectedProject({...selectedProject, priority: v})}>
                                  <SelectTrigger className=\"h-7 w-32 text-xs\"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value=\"high\">High</SelectItem><SelectItem value=\"medium\">Medium</SelectItem><SelectItem value=\"low\">Low</SelectItem></SelectContent>
                                </Select>
                              ) : <Badge variant=\"secondary\" className=\"text-[10px]\">{selectedProject.priority}</Badge>}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className=\"shadow-none border-muted/50\">
                          <CardHeader className=\"pb-2\"><CardTitle className=\"text-xs font-bold uppercase text-muted-foreground\">Budget & Cost</CardTitle></CardHeader>
                          <CardContent className=\"space-y-4\">
                            <div className=\"flex justify-between\">
                              <span className=\"text-xs text-muted-foreground\">Total Budget</span>
                              {isEditing ? <Input className=\"h-7 w-32 text-xs\" value={selectedProject.budget || ''} onChange={e => setSelectedProject({...selectedProject, budget: e.target.value})} /> : <span className=\"text-xs font-bold\">${selectedProject.budget || '0.00'}</span>}
                            </div>
                            <div className=\"flex justify-between\">
                              <span className=\"text-xs text-muted-foreground\">Current Spent</span>
                              <span className=\"text-xs font-bold\">$0.00</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value=\"tasks\">
                    <div className=\"bg-muted/20 rounded-xl p-12 text-center\">
                      <Calendar className=\"h-12 w-12 text-muted-foreground mx-auto mb-4\" />
                      <h3 className=\"font-bold\">Schedule Visualization</h3>
                      <p className=\"text-sm text-muted-foreground mt-1\">Switch to the dedicated Schedule page for full MS Project capabilities including Gantt, milestones, and dependencies.</p>
                      <Button className=\"mt-6\" variant=\"outline\" onClick={() => navigate(`/schedule?projectId=${selectedProject.id}`)}>Open Full Schedule</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value=\"team\">
                    <div className=\"grid grid-cols-2 gap-8\">
                      <div className=\"space-y-4\">
                        <h4 className=\"text-sm font-bold flex items-center gap-2\"><Users className=\"h-4 w-4\" /> Project Team</h4>
                        <div className=\"space-y-2\">
                          {[1, 2, 3].map(i => (
                            <div key={i} className=\"flex items-center justify-between p-3 border rounded-xl\">
                              <div className=\"flex items-center gap-3\">
                                <div className=\"w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold\">{i}</div>
                                <div>
                                  <p className=\"text-sm font-bold\">Team Member {i}</p>
                                  <p className=\"text-xs text-muted-foreground\">Software Engineer</p>
                                </div>
                              </div>
                              <Badge variant=\"secondary\" className=\"text-[10px]\">Owner</Badge>
                            </div>
                          ))}
                        </div>
                        <Button variant=\"outline\" className=\"w-full text-xs h-9\"><Plus className=\"h-3 w-3 mr-2\" /> Invite Member</Button>
                      </div>

                      <div className=\"space-y-4\">
                        <h4 className=\"text-sm font-bold flex items-center gap-2\"><MessageSquare className=\"h-4 w-4\" /> Collaboration Forum</h4>
                        <div className=\"border rounded-xl flex flex-col h-[300px]\">
                          <div className=\"flex-1 p-4 flex flex-col justify-center items-center text-muted-foreground text-center\">
                            <MessageSquare className=\"h-8 w-8 mb-2 opacity-20\" />
                            <p className=\"text-xs\">No project discussions yet.</p>
                            <p className=\"text-[10px]\">Start a group chat for this project phase.</p>
                          </div>
                          <div className=\"p-3 border-t bg-muted/5\">
                            <div className=\"flex gap-2\">
                              <Input placeholder=\"Type a message...\" className=\"h-9 text-xs\" />
                              <Button size=\"sm\" className=\"h-9\">Send</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value=\"files\">
                    <div className=\"space-y-6\">
                      <div className=\"flex items-center justify-between\">
                        <h4 className=\"text-sm font-bold\">Project Attachments</h4>
                        <Button size=\"sm\" variant=\"outline\"><Upload className=\"h-3 w-3 mr-2\" /> Upload File</Button>
                      </div>
                      
                      <div className=\"grid grid-cols-4 gap-4\">
                        {['Contract.pdf', 'Charter_Final.docx', 'BOQ_Sheet.xlsx', 'Site_Plan.png'].map((file, i) => (
                          <Card key={i} className=\"shadow-none hover:border-primary/50 transition-colors\">
                            <CardContent className=\"p-4 flex flex-col items-center text-center gap-3\">
                              <div className=\"bg-primary/5 p-3 rounded-xl\">
                                <FileText className=\"h-8 w-8 text-primary\" />
                              </div>
                              <div className=\"space-y-1\">
                                <p className=\"text-xs font-bold truncate w-full max-w-[120px]\">{file}</p>
                                <p className=\"text-[10px] text-muted-foreground\">2.4 MB • Oct 24</p>
                              </div>
                              <div className=\"flex gap-1 w-full\">
                                <Button size=\"sm\" variant=\"ghost\" className=\"h-7 px-0 flex-1\"><Download className=\"h-3 w-3\" /></Button>
                                <Button size=\"sm\" variant=\"ghost\" className=\"h-7 px-0 flex-1 text-destructive\"><Trash2 className=\"h-3 w-3\" /></Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
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
