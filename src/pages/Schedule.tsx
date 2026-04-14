import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, ZoomIn, ZoomOut, Calendar, Milestone, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { useProjects, useTasks } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [zoom, setZoom] = useState(1);
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();

  const currentProject = useMemo(() => projects?.find((p: any) => p.id === projectId) || projects?.[0], [projects, projectId]);
  const projectTasks = useMemo(() => tasks?.filter((t: any) => t.project_id === currentProject?.id) || [], [tasks, currentProject]);

  return (
    <AppLayout>
      <AppHeader title=\"Project Schedule\" subtitle={currentProject?.name || \"Master Schedule\"} />
      <div className=\"p-6 space-y-6\">
        <div className=\"flex items-center justify-between bg-muted/30 p-4 rounded-2xl border\">
          <div className=\"flex items-center gap-4\">
            <div className=\"flex items-center gap-2\"><Calendar className=\"h-4 w-4 text-primary\" /><span className=\"text-sm font-bold\">{currentProject?.name} Timeline</span></div>
            <Badge variant=\"outline\" className=\"bg-background\">{projectTasks.length} Work Items</Badge>
          </div>
          <div className=\"flex items-center gap-2\">
            <Button variant=\"outline\" size=\"sm\" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}><ZoomOut className=\"h-4 w-4\" /></Button>
            <Button variant=\"outline\" size=\"sm\" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className=\"h-4 w-4\" /></Button>
            <Button className=\"gradient-primary text-primary-foreground h-8 px-4\"><Plus className=\"h-3 w-3 mr-1\" /> Milestone</Button>
          </div>
        </div>

        <Tabs defaultValue=\"gantt\">
          <TabsList className=\"mb-4\">
            <TabsTrigger value=\"gantt\">Gantt Chart</TabsTrigger>
            <TabsTrigger value=\"milestones\">Milestones</TabsTrigger>
            <TabsTrigger value=\"collaboration\">Group Watch</TabsTrigger>
          </TabsList>

          <TabsContent value=\"gantt\" className=\"border rounded-2xl bg-card overflow-hidden\">
            <div className=\"flex h-[600px]\">
              <div className=\"w-80 border-r flex flex-col\">
                <div className=\"p-3 border-b bg-muted/10 font-bold text-[10px] uppercase tracking-widest\">Task Sheet</div>
                <div className=\"flex-1 overflow-y-auto\">
                  {projectTasks.map((task: any) => (
                    <div key={task.id} className=\"p-3 border-b hover:bg-muted/5 cursor-pointer flex items-center justify-between group\">
                      <div className=\"flex items-center gap-2 min-w-0\">
                        {task.priority === 'high' ? <ChevronRight className=\"h-3 w-3 text-primary\" /> : <div className=\"w-3\" />}
                        <span className=\"text-xs font-medium truncate\">{task.title}</span>
                      </div>
                      <Badge className=\"text-[8px] h-4\">{task.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className=\"flex-1 relative overflow-x-auto bg-muted/5\">
                <div className=\"absolute inset-0 grid grid-cols-12 opacity-10 pointer-events-none\"><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /><div className=\"border-r h-full\" /></div>
                <div className=\"p-4 space-y-6 pt-12\">
                  {projectTasks.map((task: any, i: number) => (
                    <div key={task.id} className=\"relative h-8 flex items-center\">
                      <div 
                        className={cn(\"h-6 rounded-md shadow-sm flex items-center px-2 text-[10px] font-bold text-white transition-all\", i % 2 === 0 ? \"bg-primary\" : \"bg-indigo-500\")}
                        style={{ marginLeft: `${(i * 40) * zoom}px`, width: `${(150 + (i * 20)) * zoom}px` }}
                      >
                        {task.progress}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value=\"milestones\">
            <div className=\"grid grid-cols-3 gap-6 pt-4\">
              <div className=\"col-span-2 space-y-4\">
                <div className=\"flex items-center justify-between\"><h3 className=\"font-bold\">Critical Path Milestones</h3><Button size=\"sm\" variant=\"outline\"><Plus className=\"h-3 w-3 mr-1\" /> New Milestone</Button></div>
                {[1, 2, 3].map(i => (
                  <div key={i} className=\"p-4 border rounded-2xl flex items-center justify-between bg-card hover:border-primary/30 transition-colors\">
                    <div className=\"flex items-center gap-4\">
                      <div className=\"p-3 rounded-xl bg-primary/10 text-primary\"><Milestone className=\"h-5 w-5\" /></div>
                      <div><p className=\"font-bold\">Phase {i} Completion</p><p className=\"text-xs text-muted-foreground\">Target Date: Dec {10 + i}, 2024</p></div>
                    </div>
                    <Badge className=\"bg-success/10 text-success border-success/20\">On Track</Badge>
                  </div>
                ))}
              </div>
              <div className=\"space-y-4\">
                <h3 className=\"font-bold\">Phase Summary</h3>
                <div className=\"p-6 bg-muted/20 rounded-2xl border space-y-6\">
                  <div className=\"space-y-2\"><div className=\"flex justify-between text-xs font-bold\"><span>Execution Phase</span><span>65%</span></div><Progress value={65} className=\"h-2\" /></div>
                  <div className=\"space-y-2\"><div className=\"flex justify-between text-xs font-bold\"><span>Testing Phase</span><span>12%</span></div><Progress value={12} className=\"h-2\" /></div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value=\"collaboration\">
            <div className=\"grid grid-cols-4 gap-6 pt-4\">
              <div className=\"col-span-3 space-y-4\">
                <div className=\"flex items-center justify-between\"><h3 className=\"font-bold\">Phase Watchers</h3><Button size=\"sm\"><Users className=\"h-3 w-3 mr-1\" /> Manage Group</Button></div>
                <div className=\"grid grid-cols-3 gap-4\">
                  {[1, 2, 3].map(i => (
                    <div key={i} className=\"p-4 border rounded-2xl bg-card space-y-3\">
                      <div className=\"flex items-center gap-2\"><div className=\"w-2 h-2 rounded-full bg-success\" /><span className=\"text-xs font-bold\">Phase {i} Watch</span></div>
                      <div className=\"flex -space-x-2\">{[1, 2, 3, 4].map(u => <div key={u} className=\"w-6 h-6 rounded-full border-2 border-background bg-muted text-[8px] flex items-center justify-center font-bold\">{u}</div>)}</div>
                      <Button variant=\"ghost\" className=\"w-full text-[10px] h-7\" size=\"sm\"><MessageSquare className=\"h-3 w-3 mr-1\" /> Discussion</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Schedule;
