import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, ExternalLink, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useProjects, useTasks, useTeamMembers, useUserAccounts } from "@/hooks/useProjects";
import { getProjectLifecycleActivityTotal, getProjectLifecycleStageCounts, lifecycleStageCatalog, type LifecycleStageKey } from "@/lib/project-activities";
import { resolveProjectLeader } from "@/lib/workspace-access";
import type { WorkspaceProject } from "@/lib/workspace-store";

type ProjectStatus = WorkspaceProject["status"];

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const statusBadge: Record<ProjectStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  "on-hold": "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  completed: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
  "at-risk": "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  archived: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const statusLabel = (value: ProjectStatus) => value.replace("-", " ");

const ProjectLifecycleMatrixTabContent = () => {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [year, setYear] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const rows = useMemo(
    () => projects.map((project) => ({
      project,
      leader: resolveProjectLeader(project, teamMembers, userAccounts)?.name ?? "Unassigned",
      stageCounts: getProjectLifecycleStageCounts(project, tasks),
      totalActivities: getProjectLifecycleActivityTotal(project, tasks),
    })),
    [projects, tasks, teamMembers, userAccounts],
  );

  const departments = useMemo(
    () => Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[],
    [projects],
  );

  const years = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => [
      project.start_date ?? project.startDate ?? "",
      project.end_date ?? project.endDate ?? "",
    ].filter(Boolean).map((value) => value.slice(0, 4))))).sort(),
    [projects],
  );

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    return rows.filter((row) => {
      const project = row.project;
      const matchesSearch = !search || [
        project.name,
        project.description,
        project.department,
        project.projectNature,
        ...(project.tags ?? []),
        row.leader,
      ].filter(Boolean).some((value) => normalize(String(value)).includes(search));
      const matchesDepartment = department === "all" || project.department === department;
      const matchesYear =
        year === "all" ||
        (project.start_date ?? project.startDate ?? "").startsWith(year) ||
        (project.end_date ?? project.endDate ?? "").startsWith(year);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
    });
  }, [department, query, rows, statusFilter, year]);

  const resetFilters = () => {
    setQuery("");
    setDepartment("all");
    setYear("all");
    setStatusFilter("all");
  };

  const openProjectTasks = (projectId: string, stageKey?: LifecycleStageKey) => {
    navigate(stageKey ? `/tasks?projectId=${projectId}&stage=${stageKey}` : `/tasks?projectId=${projectId}`);
  };

  const exportCsv = () => {
    const header = ["Project Name", "Department", "Leader", "Start Date", "End Date", "Status", "Progress", "Activities", ...lifecycleStageCatalog.map((stage) => stage.label)];
    const csv = [
      header.map(csvCell).join(","),
      ...filteredRows.map((row) => [
        row.project.name,
        row.project.department ?? "",
        row.leader,
        row.project.start_date ?? row.project.startDate ?? "",
        row.project.end_date ?? row.project.endDate ?? "",
        statusLabel(row.project.status),
        `${row.project.progress ?? 0}%`,
        row.totalActivities,
        ...lifecycleStageCatalog.map((stage) => row.stageCounts[stage.key]),
      ].map(csvCell).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "implementation-lifecycle-matrix.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-0">
      <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Implementation Lifecycle Matrix</p>
            <h2 className="mt-1 text-2xl font-black">Lifecycle Matrix</h2>
            <p className="text-sm text-muted-foreground">Task-style lifecycle table for all projects in the workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={resetFilters}><Filter className="h-4 w-4" /> Reset Filters</Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          </div>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_150px_190px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, department, leader, or tag" className="pl-9" />
            </label>
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All departments</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All years</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ProjectStatus)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="at-risk">At Risk</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="max-h-[68vh] overflow-auto rounded-2xl border">
            <table className="min-w-[1600px] w-full border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 border-b border-r bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Project</th>
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Owner</th>
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Dates</th>
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 font-black uppercase tracking-[0.12em] text-muted-foreground">Progress</th>
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Total</th>
                  {lifecycleStageCatalog.map((stage) => (
                    <th key={stage.key} className="sticky top-0 z-10 min-w-[110px] border-b bg-background px-2 py-2 text-center font-black uppercase tracking-[0.08em] text-muted-foreground">{stage.label}</th>
                  ))}
                  <th className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-center font-black uppercase tracking-[0.12em] text-muted-foreground">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const project = row.project;
                  return (
                    <tr key={project.id} className="odd:bg-muted/20 hover:bg-muted/40">
                      <td className="sticky left-0 z-10 max-w-[280px] border-b border-r bg-inherit px-3 py-3 align-top">
                        <div className="font-semibold leading-snug">{project.name}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{project.department || "No department"}</div>
                        <div className="mt-2 flex flex-wrap gap-1">{(project.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</div>
                      </td>
                      <td className="border-b px-3 py-3 align-top"><div className="font-medium">{row.leader}</div><div className="text-[11px] text-muted-foreground">Project lead</div></td>
                      <td className="border-b px-3 py-3 align-top text-muted-foreground"><div>{formatDate(project.start_date ?? project.startDate)}</div><div>{formatDate(project.end_date ?? project.endDate)}</div></td>
                      <td className="border-b px-3 py-3 align-top"><Badge variant="outline" className={`capitalize ${statusBadge[project.status]}`}>{statusLabel(project.status)}</Badge></td>
                      <td className="min-w-[170px] border-b px-3 py-3 align-top"><div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>Completion</span><span>{project.progress ?? 0}%</span></div><Progress value={project.progress ?? 0} className="h-2" /></td>
                      <td className="border-b px-3 py-3 text-center align-top"><button type="button" onClick={() => openProjectTasks(project.id)} className="rounded-xl border px-3 py-1 font-black hover:bg-background">{row.totalActivities}</button></td>
                      {lifecycleStageCatalog.map((stage) => {
                        const count = row.stageCounts[stage.key];
                        return <td key={stage.key} className="border-b px-2 py-3 text-center align-top"><button type="button" onClick={() => openProjectTasks(project.id, stage.key)} className={`mx-auto flex h-9 min-w-12 items-center justify-center rounded-xl border px-3 font-black transition hover:bg-background ${stage.border} ${stage.text}`}>{count}</button></td>;
                      })}
                      <td className="border-b px-3 py-3 text-center align-top"><Button size="sm" variant="outline" className="gap-2" onClick={() => openProjectTasks(project.id)}><ExternalLink className="h-3.5 w-3.5" /> Open</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground"><Filter className="mx-auto mb-2 h-5 w-5" /> No projects match the current filters.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ProjectExperienceEnhancer = () => {
  const location = useLocation();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (location.pathname !== "/projects") {
      setActive(false);
      setContainer(null);
      return undefined;
    }

    let cancelled = false;
    const setup = () => {
      if (cancelled) return;
      const tabList = document.querySelector<HTMLElement>('[role="tablist"]');
      if (!tabList) return;

      let button = document.getElementById("projects-lifecycle-matrix-tab") as HTMLButtonElement | null;
      if (!button) {
        button = document.createElement("button");
        button.id = "projects-lifecycle-matrix-tab";
        button.type = "button";
        button.setAttribute("role", "tab");
        button.className = "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:bg-background/80 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm";
        button.textContent = "Lifecycle Matrix";
        tabList.appendChild(button);
      }

      let portal = document.getElementById("projects-lifecycle-matrix-panel") as HTMLElement | null;
      if (!portal) {
        portal = document.createElement("div");
        portal.id = "projects-lifecycle-matrix-panel";
        portal.className = "hidden p-0";
        const tabsRoot = tabList.closest(".space-y-4, .space-y-6, [data-orientation]") ?? tabList.parentElement;
        tabsRoot?.appendChild(portal);
      }

      const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
      const nativeTabs = Array.from(tabList.querySelectorAll<HTMLElement>('[role="tab"]')).filter((tab) => tab.id !== "projects-lifecycle-matrix-tab");

      const showMatrix = () => {
        setActive(true);
        portal!.classList.remove("hidden");
        button!.dataset.state = "active";
        nativeTabs.forEach((tab) => { tab.dataset.state = "inactive"; });
        tabPanels.forEach((panel) => { panel.style.display = "none"; });
      };

      const hideMatrix = () => {
        setActive(false);
        portal!.classList.add("hidden");
        button!.dataset.state = "inactive";
        tabPanels.forEach((panel) => { panel.style.display = ""; });
      };

      button.onclick = showMatrix;
      nativeTabs.forEach((tab) => tab.addEventListener("click", hideMatrix));
      setContainer(portal);
    };

    const timers = [100, 500, 1200].map((delay) => window.setTimeout(setup, delay));
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [location.pathname]);

  if (location.pathname !== "/projects" || !container || !active) return null;
  return createPortal(<ProjectLifecycleMatrixTabContent />, container);
};

export default ProjectExperienceEnhancer;
