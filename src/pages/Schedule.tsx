import React, { useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ChevronRight, ChevronDown, Plus, ZoomIn, ZoomOut, Calendar, 
  Milestone, Users, MessageSquare, Filter, Share2, Eye, 
  LayoutDashboard, Clock, CheckCircle2, Edit3, Trash2, 
  Maximize2, Minimize2, Network, Table as TableIcon, List,
  GripVertical, Settings, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [activeTab, setActiveTab] = useState('table');
  const [collapsedPhases, setCollapsedPhases] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  
  const currentProject = useMemo(() => 
    projects?.find((p: any) => p.id === projectId) || projects?.[0], 
    [projects, projectId]
  );
  
  const projectTasks = useMemo(() => 
    tasks?.filter((t: any) => t.project_id === currentProject?.id) || [], 
    [tasks, currentProject]
  );

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => 
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const phases = ['Discovery', 'Planning', 'Execution', 'Testing', 'Deployment'];

  const TableView = () => (
    <Card className="rounded-3xl border shadow-xl overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12">WBS</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Task Name</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">Duration</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Start</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Finish</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Status</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-40">Progress</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/10">
            {phases.map((phase, pIdx) => (
              <Fragment key={phase}>
                <tr className="bg-muted/5 group cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => togglePhase(phase)}>
                  <td className="p-4 font-bold text-xs">{pIdx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {collapsedPhases.includes(phase) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="font-black text-sm">{phase} Phase</span>
                    </div>
                  </td>
                  <td className="p-4"></td>
                  <td className="p-4"></td>
                  <td className="p-4"></td>
                  <td className="p-4"></td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Progress value={75} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-black">75%</span>
                    </div>
                  </td>
                  <td className="p-4"></td>
                </tr>
                {!collapsedPhases.includes(phase) && projectTasks.filter(t => t.phase === phase || (!t.phase && phase === 'Execution')).map((task, tIdx) => (
                  <tr key={task.id} className="group hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-[10px] font-bold text-muted-foreground pl-8">{pIdx + 1}.{tIdx + 1}</td>
                    <td className="p-4">
                      {editingTaskId === task.id ? (
                        <Input defaultValue={task.title} className="h-8 text-xs font-bold" autoFocus onBlur={() => setEditingTaskId(null)} />
                      ) : (
                        <div className="flex items-center gap-2 group/title">
                          <span className="text-sm font-bold">{task.title}</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover/title:opacity-100" onClick={() => setEditingTaskId(task.id)}>
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="p-4"><Input defaultValue={task.duration || '2d'} className="h-8 text-[11px] font-bold bg-transparent border-none focus:bg-background" /></td>
                    <td className="p-4"><Input type="date" className="h-8 text-[11px] font-bold bg-transparent border-none" /></td>
                    <td className="p-4"><Input type="date" className="h-8 text-[11px] font-bold bg-transparent border-none" /></td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0.5">{task.status}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Progress value={task.progress || 0} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-black">{task.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><Settings className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const CADView = () => (
    <div className="w-full h-[600px] bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20 relative flex items-center justify-center overflow-hidden p-8">
      <div className="absolute inset-0 grid grid-cols-[repeat(40,1fr)] grid-rows-[repeat(40,1fr)] opacity-5 pointer-events-none">
        {Array.from({ length: 1600 }).map((_, i) => <div key={i} className="border-[0.5px] border-foreground" />)}
      </div>
      <div className="flex gap-20 relative scale-[0.8] origin-center" style={{ transform: `scale(${zoom})` }}>
        {phases.map((phase, idx) => (
          <div key={phase} className="relative">
            <Card className="w-64 rounded-2xl border-2 border-primary/20 shadow-xl overflow-hidden bg-background relative z-10">
              <div className="p-4 bg-primary/5 border-b flex items-center justify-between">
                <Badge className="font-black">PHASE {idx + 1}</Badge>
                <Network className="h-4 w-4 text-primary" />
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-black text-sm uppercase tracking-tight">{phase} Phase</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground">
                    <span>Progress</span>
                    <span>100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
              </div>
            </Card>
            {idx < phases.length - 1 && (
              <div className="absolute top-1/2 left-full w-20 h-[2px] bg-primary/20 -translate-y-1/2">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
              </div>
            )}
            <div className="mt-8 space-y-4">
               {projectTasks.slice(0, 2).map(task => (
                 <Card key={task.id} className="w-64 rounded-xl border border-muted/50 p-3 hover:border-primary/50 transition-colors cursor-pointer">
                   <p className="text-xs font-bold truncate">{task.title}</p>
                   <div className="flex items-center gap-2 mt-2">
                     <Badge variant="secondary" className="text-[8px] font-black">{task.status}</Badge>
                     <span className="text-[9px] font-bold text-muted-foreground">{task.duration || '2d'}</span>
                   </div>
                 </Card>
               ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-background/80 backdrop-blur-md p-2 rounded-2xl border shadow-lg">
        <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize2 className="h-4 w-4" /></Button>
        <div className="w-[1px] h-4 bg-muted mx-1" />
        <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
        <span className="text-[10px] font-black min-w-[30px] text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(2, zoom + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <AppHeader 
        title={currentProject?.name || "Master Schedule"} 
        subtitle="Enterprise Project Governance • Smart WBS Management" 
      />
      
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap bg-card p-4 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Active Workspace</p>
              <h2 className="text-xl font-black tracking-tight">{currentProject?.name}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-muted/20 p-1 rounded-2xl inline-flex border border-muted/30">
              <TabsTrigger value="table" className="rounded-xl px-6 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow flex items-center gap-2">
                <TableIcon className="h-3.5 w-3.5" /> Table View
              </TabsTrigger>
              <TabsTrigger value="gantt" className="rounded-xl px-6 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5" /> Gantt Chart
              </TabsTrigger>
              <TabsTrigger value="cad" className="rounded-xl px-6 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow flex items-center gap-2">
                <Network className="h-3.5 w-3.5" /> CAD View
              </TabsTrigger>
              <TabsTrigger value="milestones" className="rounded-xl px-6 py-2.5 font-black text-xs uppercase tracking-widest data-[state=active]:shadow-glow flex items-center gap-2">
                <Milestone className="h-3.5 w-3.5" /> Milestones
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-tighter" onClick={() => setCollapsedPhases(phases)}>Collapse All</Button>
               <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-tighter" onClick={() => setCollapsedPhases([])}>Expand All</Button>
            </div>
          </div>

          <TabsContent value="table" className="mt-0">
            <TableView />
          </TabsContent>

          <TabsContent value="gantt" className="mt-0 space-y-6">
            <Card className="rounded-3xl border shadow-2xl overflow-hidden bg-background">
              <div className="flex h-[600px]">
                <div className="w-[350px] border-r border-muted/20 flex flex-col">
                  <div className="p-4 bg-muted/10 border-b font-black text-[10px] uppercase tracking-widest">Task Structure</div>
                  <div className="flex-1 overflow-y-auto divide-y divide-muted/10">
                    {phases.map(phase => (
                      <div key={phase} className="p-4 flex items-center gap-3 hover:bg-muted/5 cursor-pointer" onClick={() => togglePhase(phase)}>
                        {collapsedPhases.includes(phase) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="text-sm font-black">{phase} Phase</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto bg-muted/5 relative p-8">
                  <div className="absolute top-0 left-0 right-0 h-10 border-b bg-muted/10 flex items-center">
                     {['Oct 24', 'Oct 25', 'Oct 26', 'Oct 27', 'Oct 28', 'Oct 29'].map(d => (
                       <div key={d} className="w-40 border-l px-4 text-[10px] font-black uppercase text-muted-foreground">{d}</div>
                     ))}
                  </div>
                  <div className="mt-12 space-y-12">
                    {phases.map((p, i) => (
                      <div key={p} className="h-8 bg-primary/20 rounded-full border border-primary/30 relative" style={{ width: '400px', marginLeft: `${i * 60}px` }}>
                        <div className="absolute inset-y-0 left-0 bg-primary/40 rounded-full" style={{ width: '70%' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="cad" className="mt-0">
            <CADView />
          </TabsContent>

          <TabsContent value="milestones" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {phases.map(p => (
                <Card key={p} className="rounded-2xl shadow-sm border overflow-hidden">
                  <div className="p-4 bg-muted/5 border-b flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest">{p} Milestones</h4>
                    <Milestone className="h-4 w-4 text-primary" />
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <div>
                        <p className="text-xs font-bold uppercase">Gate Approved</p>
                        <p className="text-[9px] text-muted-foreground font-black">COMPLETED • OCT 26</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Schedule;
