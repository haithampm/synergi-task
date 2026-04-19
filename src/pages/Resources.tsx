import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarRange, FolderKanban, Gauge, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, useTasks, useTeamMembers } from "@/hooks/useProjects";

const ResourcesPage = () => {
  const navigate = useNavigate();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const [projectFilter, setProjectFilter] = useState("all");

  const resourceRows = useMemo(() => {
    return teamMembers
      .map((member) => {
        const assignedTasks = tasks.filter((task) => (task.assignee_id === member.id || task.assignees?.includes(member.id) || task.assignee === member.name.split(" ")[0]));
        const assignedHours = assignedTasks.reduce((sum, task) => sum + (task.workloadHours ?? 0), 0);
        const assignedProjectIds = Array.from(new Set(assignedTasks.map((task) => task.project_id ?? task.projectId).filter(Boolean))) as string[];
        const relatedProjects = projects.filter((project) => assignedProjectIds.includes(project.id));
        const filteredProjects = projectFilter === "all" ? relatedProjects : relatedProjects.filter((project) => project.id === projectFilter);
        const visibleTaskCount = projectFilter === "all" ? assignedTasks.length : assignedTasks.filter((task) => (task.project_id ?? task.projectId) === projectFilter).length;
        const capacity = member.capacityHours ?? 40;
        const utilizationPct = Math.round((assignedHours / Math.max(1, capacity)) * 100);

        return {
          member,
          assignedHours,
          visibleTaskCount,
          relatedProjects: filteredProjects,
          utilizationPct,
          capacity,
        };
      })
      .filter((row) => projectFilter === "all" || row.relatedProjects.length > 0);
  }, [projectFilter, projects, tasks, teamMembers]);

  return (
    <AppLayout>
      <AppHeader title="Resources" subtitle="Enterprise resource allocation, capacity tracking, assignment roles, and linked schedule visibility." />
      <div className="p-6 space-y-6">
        <Card className="glass">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resource Control Center</p>
              <h2 className="text-2xl font-semibold mt-1">{teamMembers.length} team resources tracked</h2>
              <p className="text-sm text-muted-foreground mt-1">Assign project managers, contributors, reviewers, observers, and external collaborators from one workspace.</p>
            </div>
            <div className="w-72">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Capacity", value: `${resourceRows.reduce((sum, row) => sum + row.capacity, 0)}h`, icon: Gauge },
            { label: "Assigned Hours", value: `${resourceRows.reduce((sum, row) => sum + row.assignedHours, 0)}h`, icon: BriefcaseBusiness },
            { label: "Projects Covered", value: Array.from(new Set(resourceRows.flatMap((row) => row.relatedProjects.map((project) => project.id)))).length, icon: FolderKanban },
          ].map((metric) => (
            <Card key={metric.label} className="glass">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                  <p className="text-3xl font-semibold mt-1">{metric.value}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <metric.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {resourceRows.map((row) => (
              <Card key={row.member.id} className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full ${row.member.avatarColor || "gradient-primary"} flex items-center justify-center text-xs font-bold text-primary-foreground`}>
                        {row.member.avatar}
                      </div>
                      <div>
                        <p>{row.member.name}</p>
                        <p className="text-sm font-normal text-muted-foreground">{row.member.role} • {row.member.department || "Project Delivery"}</p>
                      </div>
                    </div>
                    <Badge variant={row.utilizationPct > (row.member.utilizationTarget ?? 85) ? "destructive" : "outline"}>
                      {row.utilizationPct}% utilization
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border p-3 bg-card/40">
                      <p className="text-xs text-muted-foreground">Role Access</p>
                      <p className="mt-1 font-medium">{row.member.privilegeRole || "lead"}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-card/40">
                      <p className="text-xs text-muted-foreground">Assigned Tasks</p>
                      <p className="mt-1 font-medium">{row.visibleTaskCount}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-card/40">
                      <p className="text-xs text-muted-foreground">Hours</p>
                      <p className="mt-1 font-medium">{row.assignedHours}h / {row.capacity}h</p>
                    </div>
                  </div>
                  <Progress value={row.utilizationPct} className="h-2" />
                  <div className="flex flex-wrap gap-2">
                    {row.relatedProjects.map((project) => (
                      <Button key={project.id} variant="outline" size="sm" onClick={() => navigate(`/schedule?projectId=${project.id}`)}>
                        <CalendarRange className="h-4 w-4 mr-2" /> {project.name}
                      </Button>
                    ))}
                    {row.relatedProjects.length === 0 ? <Badge variant="secondary">No linked projects</Badge> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Assignment Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Assign project managers, contributors, reviewers, observers, and external collaborators from Projects, Team, or Resources.",
                "Use utilization and capacity together to avoid overloading critical specialists before committing schedule dates.",
                "Open Schedule directly from a resource row to rebalance dependencies and timing around current assignments.",
                "Linked tasks and projects stay navigable so no assignment becomes a dead-end record.",
              ].map((item) => (
                <div key={item} className="rounded-xl border p-3 bg-card/40 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default ResourcesPage;
