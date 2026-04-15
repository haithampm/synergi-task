import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, ZoomIn, ZoomOut, Calendar, Milestone, Users, MessageSquare, Filter, Share2, Eye, LayoutDashboard, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useProjects, useTasks } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState('gantt');
  const [watchingPhases, setWatchingPhases] = useState<string[]>([]);
  
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();

  const currentProject = useMemo(() => projects?.find((p: any) => p.id === projectId) || projects?.[0], [projects, projectId]);
  const projectTasks = useMemo(() => tasks?.filter((t: any) => t.project_id === currentProject?.id) || [], [tasks, currentProject]);

  const toggleWatchPhase = (phase: string) => {
    if (watchingPhases.includes(phase)) {
      setWatchingPhases(p => p.filter(item => item !== phase));
      toast.info(`Stopped watching ${phase} phase`);
    } else {
      setWatchingPhases(p => [...p, phase]);
      toast.success(`Now watching ${phase} phase for updates`);
    }
  };

  const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment'];

  return (
    <AppLayout>
      <AppHeader 
        title={currentProject?.name || "Master Schedule"} 
        subtitle="MS Project Professional Interface • Real-time Collaboration" 
      />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Schedule Timeline</p>
              <h2 className="text-xl font-black tracking-tight">{currentProject?.name}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border mr-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-[10px] font-black px-2">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(Math.min(2, zoom + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold border-muted/50"><Filter className="h-4 w-4 mr-2" /> Critical Path</Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold border-muted/50"><Share2 className="h-4 w-4 mr-2" /> Export XML</Button>
            <Button className="gradient-primary text-primary-foreground h-10 px-5 rounded-xl font-bold shadow-glow"><Plus className="h-4 w-4 mr-2" /> New Task</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/20 p-1 rounded-2xl mb-6 inline-flex border border-muted/30">
            <TabsTrigger value="gantt" className="rounded-xl px-8 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow">Gantt Chart</TabsTrigger>
            <TabsTrigger value="wbs" className="rounded-xl px-8 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow">Work Breakdown (WBS)</TabsTrigger>
            <TabsTrigger value="milestones" className="rounded-xl px-8 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow">Milestones</TabsTrigger>
            <TabsTrigger value="collab" className="rounded-xl px-8 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow">Collaboration Forum</TabsTrigger>
          </TabsList>

          <TabsContent value="gantt" className="space-y-6">
            <Card className="rounded-3xl border-none shadow-2xl overflow-hidden glass-light">
              <div className="flex">
                {/* WBS Side Table */}
                <div className="w-[450px] border-r border-muted/20 shrink-0">
                  <div className="p-4 bg-muted/10 border-b flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Work Items & Hierarchy</span>
                    <Badge variant="outline" className="text-[9px] font-black tracking-tighter">TASK MODE: AUTO</Badge>
                  </div>
                  <div className="divide-y divide-muted/10 overflow-y-auto max-h-[600px]">
                    {phases.map((phase) => (
                      <div key={phase} className="group">
                        <div className="p-4 flex items-center gap-3 bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer">
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          <div className="bg-primary/10 p-1.5 rounded-lg"><LayoutDashboard className="h-3.5 w-3.5 text-primary" /></div>
                          <span className="text-sm font-black flex-1">{phase} Phase</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-lg", watchingPhases.includes(phase) && "text-primary bg-primary/10")} onClick={() => toggleWatchPhase(phase)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"><MessageSquare className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="pl-12 pr-4 py-2 space-y-1 bg-background/50">
                          {projectTasks.filter((t: any) => t.phase === phase || (!t.phase && phase === 'Execution')).map((task: any) => (
                            <div key={task.id} className="flex items-center gap-3 py-2 border-l-2 border-primary/20 pl-4 hover:bg-primary/5 transition-colors rounded-r-lg group/item">
                              <span className="text-[11px] font-bold text-foreground/80 flex-1 truncate">{task.title}</span>
                              <div className="flex items-center gap-3">
                                {task.isMilestone && <Milestone className="h-3 w-3 text-primary" />}
                                <span className="text-[10px] text-muted-foreground font-bold">{task.duration || '2d'}</span>
                                <Badge variant="secondary" className="text-[8px] h-4 font-black uppercase px-1.5">{task.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gantt Timeline View */}
                <div className="flex-1 overflow-x-auto bg-muted/5 min-h-[600px] relative">
                  <div className="sticky top-0 z-10 p-4 border-b bg-muted/10 flex items-center justify-between">
                    <div className="flex gap-8 px-4">
                      {['Oct 24', 'Oct 25', 'Oct 26', 'Oct 27', 'Oct 28', 'Oct 29', 'Oct 30'].map(d => (
                        <div key={d} className="w-32 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l border-muted/20 pl-4">{d}</div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-8 space-y-12">
                    {phases.map((phase, idx) => (
                      <div key={phase} className="relative h-6 flex items-center">
                        <div className="absolute left-0 top-0 h-full bg-primary/20 rounded-full border border-primary/30 flex items-center px-4" style={{ width: `${300 + idx * 50}px`, left: `${idx * 80}px` }}>
                          <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{phase} Timeline</span>
                          <div className="absolute -right-12 top-1/2 -translate-y-1/2 flex items-center gap-1">
                             <CheckCircle2 className="h-3 w-3 text-success" />
                             <span className="text-[8px] font-bold">100%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Milestones in Timeline */}
                    <div className="flex gap-40 pt-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-4 h-4 rotate-45 bg-primary shadow-glow mb-1" />
                        <span className="text-[9px] font-black uppercase text-center w-24">Project Charter Approval</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-4 h-4 rotate-45 bg-amber-500 shadow-glow mb-1" />
                        <span className="text-[9px] font-black uppercase text-center w-24">Site Inspection</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="milestones">
             <div className="grid grid-cols-4 gap-6">
                {phases.map(p => (
                   <Card key={p} className="rounded-2xl shadow-sm border-muted/50 overflow-hidden">
                      <div className="p-4 bg-muted/5 border-b flex items-center justify-between">
                         <h4 className="text-xs font-black uppercase tracking-widest">{p} Gates</h4>
                         <Milestone className="h-4 w-4 text-primary" />
                      </div>
                      <CardContent className="p-4 space-y-4">
                         <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <div className="flex-1">
                               <p className="text-xs font-bold">{p} Kickoff</p>
                               <p className="text-[9px] text-muted-foreground uppercase font-black">Oct 24 • Verified</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3 p-3 bg-muted/20 border rounded-xl opacity-50">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                               <p className="text-xs font-bold">{p} Review Gate</p>
                               <p className="text-[9px] text-muted-foreground uppercase font-black">Nov 02 • Pending</p>
                            </div>
                         </div>
                      </CardContent>
                   </Card>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="collab">
            <div className="grid grid-cols-12 gap-8 h-[600px]">
              <div className="col-span-8 flex flex-col border rounded-3xl bg-muted/5 overflow-hidden">
                <div className="p-6 border-b bg-muted/10 flex items-center justify-between">
                  <h4 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="h-4 w-4" /> Schedule Watch Forum</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => <div key={i} className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-black">{i}</div>)}
                    </div>
                    <Badge variant="secondary" className="font-black text-[9px] uppercase">Active Board</Badge>
                  </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto space-y-6">
                  {watchingPhases.map(phase => (
                    <div key={phase} className="flex gap-4 animate-in slide-in-from-left duration-500">
                      <div className="bg-primary/10 p-2.5 h-fit rounded-xl border border-primary/20"><Eye className="h-5 w-5 text-primary" /></div>
                      <div className="space-y-2 flex-1">
                        <div className="bg-background p-5 rounded-2xl border border-muted/50 shadow-sm relative">
                          <div className="absolute -left-2 top-4 w-4 h-4 bg-background border-l border-t border-muted/50 rotate-[-45deg]" />
                          <p className="text-sm font-black text-primary mb-1 tracking-tight">System Notification: Watch Mode</p>
                          <p className="text-xs font-medium leading-relaxed">You are now watching the <span className="font-black underline">{phase}</span> phase. You will receive real-time push notifications for any WBS changes, task updates, or cost overruns in this segment of the schedule.</p>
                          <p className="text-[9px] text-muted-foreground mt-3 font-black uppercase tracking-widest">Just Now • Automated Control</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-4 opacity-50 grayscale">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-xs">PM</div>
                    <div className="space-y-2">
                       <div className="bg-muted/30 p-4 rounded-2xl">
                          <p className="text-xs">Schedule baselines were updated by the administrator. Reviewing critical path changes for the Execution phase.</p>
                       </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t bg-background">
                  <div className="flex gap-4">
                    <Input placeholder="Sync a schedule update or ask a question to the watch group..." className="h-14 rounded-2xl shadow-sm border-muted/50 text-sm font-medium" />
                    <Button className="h-14 px-10 rounded-2xl font-black gradient-primary text-primary-foreground shadow-glow">Post Sync</Button>
                  </div>
                </div>
              </div>
              
              <div className="col-span-4 space-y-6">
                 <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-primary/5">
                    <CardContent className="p-8 space-y-6">
                       <div className="flex items-center gap-3">
                          <Users className="h-6 w-6 text-primary" />
                          <h4 className="text-lg font-black tracking-tight">Phase Watchers</h4>
                       </div>
                       <div className="space-y-4">
                          {phases.map(p => (
                             <div key={p} className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-primary/10">
                                <span className="text-[11px] font-black uppercase tracking-widest">{p}</span>
                                <div className="flex items-center gap-2">
                                   <Badge variant={watchingPhases.includes(p) ? "default" : "secondary"} className="text-[9px] font-black">{watchingPhases.includes(p) ? 'WATCHING' : 'IDLE'}</Badge>
                                </div>
                             </div>
                          ))}
                       </div>
                    </CardContent>
                 </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Schedule;
