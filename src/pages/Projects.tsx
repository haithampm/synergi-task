import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Calendar, Download, ExternalLink, FileText, Filter, FolderKanban, GitBranch, LayoutGrid, MessageSquare, Milestone, Plus, Save, Search, Table2, Tags, Ticket, Trash2, Upload, Wand2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppHeader from "@/components/layout/AppHeader";
import AppLayout from "@/components/layout/AppLayout";
import PageSection from "@/components/layout/PageSection";
import DynamicCustomFields from "@/components/forms/DynamicCustomFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useChatChannels, useCreateChatChannel, useCreateChatMessage, useCreateProject, useCreateTask, useDeleteProject, useProjects, useTasks, useTeamMembers, useTickets, useUpdateChatChannel, useUpdateProject, useUserAccounts, useWorkspaceSettings, useWorkflows } from "@/hooks/useProjects";
import { streamAgentChat } from "@/lib/ai-agent";
import { getActiveCustomFields, normalizeCustomFieldValues } from "@/lib/custom-fields";
import { getProjectLifecycleActivityTotal, getProjectLifecycleStageCounts, lifecycleStageCatalog } from "@/lib/project-activities";
import { generateProjectTemplateDocuments, type DocumentTemplateStandard } from "@/lib/project-documents";
import { generateScheduleFromProjectNature } from "@/lib/project-schedule";
import { getProjectLinkedUserAccounts, resolveProjectLeader } from "@/lib/workspace-access";
import {
  makeId,
  type WorkspaceProject,
  type WorkspaceProjectDocument,
  type WorkspaceProjectResource,
  type WorkspaceProjectRisk,
  type WorkspaceProjectStakeholder,
  type WorkspaceProjectTeamNode,
} from "@/lib/workspace-store";
import { toast } from "sonner";

type ViewMode = "card" | "table" | "tree";
type DraftResource = { id: string; name: string; role: string; allocation: string; plannedHours: string; memberId?: string };
type DraftTeamNode = { id: string; name: string; title: string; reportsTo: string; responsibilities: string; memberId?: string };
type DraftStakeholder = { id: string; name: string; role: string; influence: "high" | "medium" | "low"; interest: "high" | "medium" | "low"; engagement: "manage closely" | "keep satisfied" | "keep informed" | "monitor"; notes: string };
type DraftRisk = { id: string; title: string; description: string; category: string; probability: "high" | "medium" | "low"; impact: "high" | "medium" | "low"; owner: string; mitigation: string; status: "open" | "monitoring" | "mitigated" | "closed" };
type Draft = {
  name: string;
  description: string;
  priority: WorkspaceProject["priority"];
  status: WorkspaceProject["status"];
  startDate: string;
  endDate: string;
  budget: string;
  department: string;
  projectNature: string;
  namespace: string;
  workflowId: string;
  progress: number;
  tagsText: string;
  customFieldValues: Record<string, string | number | boolean>;
  milestones: Array<{ title: string; date: string }>;
  resources: DraftResource[];
  teamStructure: DraftTeamNode[];
  stakeholders: DraftStakeholder[];
  risks: DraftRisk[];
  documents: WorkspaceProjectDocument[];
};

const today = new Date().toISOString().slice(0, 10);
const statusColor: Record<WorkspaceProject["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  "on-hold": "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  completed: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
  "at-risk": "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  archived: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20 dark:text-zinc-300",
};
const statusChartColor: Record<WorkspaceProject["status"], string> = {
  active: "#10b981",
  "on-hold": "#f59e0b",
  completed: "#64748b",
  "at-risk": "#f43f5e",
  archived: "#71717a",
};

const parseTags = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);
const toRiskLevel = (status: WorkspaceProject["status"], priority: WorkspaceProject["priority"]): NonNullable<WorkspaceProject["risk_level"]> => {
  if (status === "at-risk" || priority === "urgent") return "high";
  if (priority === "high" || priority === "medium") return "medium";
  return "low";
};
const createDraft = (namespace: string, workflowId: string): Draft => ({
  name: "",
  description: "",
  priority: "medium",
  status: "active",
  startDate: today,
  endDate: "",
  budget: "",
  department: "",
  projectNature: "",
  namespace,
  workflowId,
  progress: 0,
  tagsText: "",
  customFieldValues: {},
  milestones: [{ title: "Kickoff", date: today }],
  resources: [{ id: makeId("resource"), name: "", role: "", allocation: "100", plannedHours: "40", memberId: "" }],
  teamStructure: [
    { id: makeId("team"), name: "", title: "PMO Director", reportsTo: "", responsibilities: "Executive governance, funding decisions, and PMO oversight", memberId: "" },
    { id: makeId("team"), name: "", title: "Project Manager", reportsTo: "PMO Director", responsibilities: "Day-to-day delivery leadership, planning, and reporting", memberId: "" },
  ],
  stakeholders: [{ id: makeId("stakeholder"), name: "", role: "", influence: "medium", interest: "high", engagement: "keep informed", notes: "" }],
  risks: [{ id: makeId("risk"), title: "", description: "", category: "Schedule", probability: "medium", impact: "medium", owner: "", mitigation: "", status: "open" }],
  documents: [],
});
const mapProjectToDraft = (project: WorkspaceProject): Draft => ({
  name: project.name,
  description: project.description ?? "",
  priority: project.priority,
  status: project.status,
  startDate: project.start_date ?? project.startDate ?? today,
  endDate: project.end_date ?? project.endDate ?? "",
  budget: project.budget ?? "",
  department: project.department ?? "",
  projectNature: project.projectNature ?? "",
  namespace: project.namespace ?? "synergi-main",
  workflowId: project.workflowId ?? "",
  progress: project.progress ?? 0,
  tagsText: (project.tags ?? []).join(", "),
  customFieldValues: project.customFieldValues ?? {},
  milestones: (project.milestones ?? []).map((m) => ({ title: m.title, date: m.date ?? "" })),
  resources: (project.resources ?? []).map((r) => ({ id: r.id, name: r.name, role: r.role, allocation: String(r.allocation), plannedHours: String(r.plannedHours), memberId: r.memberId ?? "" })),
  teamStructure: (project.teamStructure ?? []).map((node) => ({ id: node.id, name: node.name, title: node.title, reportsTo: node.reportsTo ?? "", responsibilities: node.responsibilities ?? "", memberId: node.memberId ?? "" })),
  stakeholders: (project.stakeholders ?? []).map((stakeholder) => ({ ...stakeholder, notes: stakeholder.notes ?? "" })),
  risks: (project.risks ?? []).map((risk) => ({ ...risk })),
  documents: project.documents ?? [],
});
const mergeDocuments = (current: WorkspaceProjectDocument[], incoming: WorkspaceProjectDocument[]) => {
  const next = [...current];
  incoming.forEach((document) => {
    const index = next.findIndex((item) => document.category === "template" ? item.category === "template" && item.type === document.type : item.category === "attachment" && item.name === document.name);
    if (index >= 0) next[index] = document;
    else next.unshift(document);
  });
  return next;
};
const attachmentDocs = (files: File[]) => files.map((file) => ({
  id: makeId("doc"),
  name: file.name,
  type: "attachment",
  category: "attachment" as const,
  content: `Uploaded file reference for ${file.name}.`,
  uploadedAt: new Date().toISOString(),
  generated: false,
}));

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectAssistantInput, setProjectAssistantInput] = useState("");
  const [projectAssistantReply, setProjectAssistantReply] = useState("");
  const [projectAssistantLoading, setProjectAssistantLoading] = useState(false);
  const { data: projects = [], isLoading } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: chatChannels = [] } = useChatChannels();
  const { data: settings } = useWorkspaceSettings();
  const { data: workflows = [] } = useWorkflows();
  const projectCustomFields = useMemo(() => getActiveCustomFields(settings, "project"), [settings]);
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createChatChannel = useCreateChatChannel();
  const updateChatChannel = useUpdateChatChannel();
  const createChatMessage = useCreateChatMessage();
  const [draft, setDraft] = useState<Draft>(() => createDraft("synergi-main", ""));
  const [communityTopic, setCommunityTopic] = useState("Project community, announcements, and shared links");
  const [whatsAppLink, setWhatsAppLink] = useState("");
  const [communityMessage, setCommunityMessage] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [autoGenerateSchedule, setAutoGenerateSchedule] = useState(true);
  const [documentTemplateStandard, setDocumentTemplateStandard] = useState<DocumentTemplateStandard>("PMI");

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      setEditingProjectId(null);
      setDraft({
        ...createDraft(settings?.namespace.slug ?? "synergi-main", workflows[0]?.id ?? ""),
        customFieldValues: normalizeCustomFieldValues(projectCustomFields, {}),
      });
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [projectCustomFields, searchParams, setSearchParams, settings?.namespace.slug, workflows]);    useEffect(() => {     const handler = () => {       setEditingProjectId(null);       setDraft({         ...createDraft(settings?.namespace.slug ?? "synergi-main", workflows[0]?.id ?? ""),         customFieldValues: normalizeCustomFieldValues(projectCustomFields, {}),       });       setDialogOpen(true);     };     window.addEventListener('open-create-project', handler);     return () => window.removeEventListener('open-create-project', handler);   }, [projectCustomFields, settings?.namespace.slug, workflows]);

  useEffect(() => {
    const requestedProjectId = searchParams.get("projectId");
    if (!requestedProjectId) return;

    const project = projects.find((item) => item.id === requestedProjectId);
    if (!project) return;

    setEditingProjectId(project.id);
    setDraft({
      ...mapProjectToDraft(project),
      customFieldValues: normalizeCustomFieldValues(projectCustomFields, project.customFieldValues),
    });
    setDialogOpen(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("projectId");
      return next;
    }, { replace: true });
  }, [projectCustomFields, projects, searchParams, setSearchParams]);

  const activeProject = useMemo(() => projects.find((project) => project.id === editingProjectId) ?? null, [editingProjectId, projects]);
  const projectChannels = useMemo(
    () => chatChannels.filter((channel) => channel.projectId === editingProjectId),
    [chatChannels, editingProjectId],
  );
  const projectCommunityChannel = useMemo(
    () => projectChannels.find((channel) => (channel.kind ?? "general") === "general") ?? projectChannels[0] ?? null,
    [projectChannels],
  );
  const linkedTasks = useMemo(() => tasks.filter((task) => (task.project_id ?? task.projectId) === editingProjectId), [editingProjectId, tasks]);
  const linkedTickets = useMemo(() => tickets.filter((ticket) => ticket.projectId === editingProjectId), [editingProjectId, tickets]);
  const departments = useMemo(() => Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[], [projects]);
  const tags = useMemo(() => Array.from(new Set(projects.flatMap((project) => project.tags ?? []).filter(Boolean))) as string[], [projects]);
  const filtered = useMemo(() => projects.filter((project) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [project.name, project.description, project.department, ...(project.tags ?? [])].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "all" ? project.status !== "archived" : project.status === statusFilter;
    return matchesSearch && matchesStatus && (departmentFilter === "all" || project.department === departmentFilter) && (tagFilter === "all" || (project.tags ?? []).includes(tagFilter));
  }), [departmentFilter, projects, search, statusFilter, tagFilter]);
  const groups = useMemo(() => filtered.reduce<Record<string, WorkspaceProject[]>>((acc, project) => {
    acc[project.status] = acc[project.status] ?? [];
    acc[project.status].push(project);
    return acc;
  }, {}), [filtered]);
  const taskCountByProject = useMemo(() => tasks.reduce<Record<string, number>>((acc, task) => {
    const key = task.project_id ?? task.projectId;
    if (key) acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}), [tasks]);
  const ticketCountByProject = useMemo(() => tickets.reduce<Record<string, number>>((acc, ticket) => {
    if (ticket.projectId) acc[ticket.projectId] = (acc[ticket.projectId] ?? 0) + 1;
    return acc;
  }, {}), [tickets]);
  const portfolioProgressData = useMemo(
    () =>
      [...projects]
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 8)
        .map((project) => ({
          name: project.name.length > 18 ? `${project.name.slice(0, 18)}...` : project.name,
          progress: project.progress,
          tasks: taskCountByProject[project.id] ?? 0,
        })),
    [projects, taskCountByProject],
  );
  const portfolioStatusData = useMemo(
    () =>
      (["active", "on-hold", "completed", "at-risk", "archived"] as WorkspaceProject["status"][]).map((status) => ({
        name: status.replace("-", " "),
        value: projects.filter((project) => project.status === status).length,
        color: statusChartColor[status],
      })),
    [projects],
  );
  const lifecycleTotals = useMemo(
    () =>
      lifecycleStageCatalog.map((stage) => ({
        ...stage,
        total: projects.reduce((sum, project) => sum + getProjectLifecycleStageCounts(project, tasks)[stage.key], 0),
      })),
    [projects, tasks],
  );
  const portfolioLifecycleRows = useMemo(
    () =>
      projects.slice(0, 18).map((project, index) => {
        const totalActivities = getProjectLifecycleActivityTotal(project, tasks);
        const leader = resolveProjectLeader(project, teamMembers, userAccounts);
        const linkedUsers = getProjectLinkedUserAccounts(project, teamMembers, userAccounts);
        return {
          rank: index + 1,
          project,
          leader,
          linkedUsers,
          totalActivities,
          stageCounts: getProjectLifecycleStageCounts(project, tasks),
        };
      }),
    [projects, tasks, teamMembers, userAccounts],
  );
  const openProjectTasks = (projectId: string) => navigate(`/tasks?projectId=${projectId}`);
  const openProjectTickets = (projectId: string) => navigate(`/tickets?projectId=${projectId}`);
  const openProjectLifecycle = (projectId: string, stageKey?: string) => {
    const project = projects.find((item) => item.id === projectId);
    const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === projectId);
    if (!projectTasks.length && project?.radarLifecycle) {
      toast.info("This project currently has imported radar counts only. Open the project record to add detailed tasks.");
      openProject(project);
      return;
    }

    navigate(stageKey ? `/tasks?projectId=${projectId}&stage=${stageKey}` : `/tasks?projectId=${projectId}`);
  };

  const openCreate = () => {
    setEditingProjectId(null);
    setDraft({
      ...createDraft(settings?.namespace.slug ?? "synergi-main", workflows[0]?.id ?? ""),
      customFieldValues: normalizeCustomFieldValues(projectCustomFields, {}),
    });
    setProjectAssistantInput("");
    setProjectAssistantReply("");
    setCommunityTopic("Project community, announcements, and shared links");
    setWhatsAppLink("");
    setAnnouncementText("");
    setCommunityMessage("");
    setAutoGenerateSchedule(true);
    setDocumentTemplateStandard("PMI");
    setDialogOpen(true);
  };
  const openProject = (project: WorkspaceProject) => {
    setEditingProjectId(project.id);
    setDraft({
      ...mapProjectToDraft(project),
      customFieldValues: normalizeCustomFieldValues(projectCustomFields, project.customFieldValues),
    });
    setProjectAssistantInput("");
    setProjectAssistantReply("");
    const existingChannel = chatChannels.find((channel) => channel.projectId === project.id);
    setCommunityTopic(existingChannel?.topic ?? "Project community, announcements, and shared links");
    setWhatsAppLink(existingChannel?.whatsappGroupUrl ?? "");
    setAnnouncementText(existingChannel?.messages.find((message) => message.pinned)?.message ?? "");
    setCommunityMessage("");
    setAutoGenerateSchedule(false);
    setDocumentTemplateStandard((project.documents ?? []).find((document) => document.category === "template")?.standardTemplate === "SAP" ? "SAP" : "PMI");
    setDialogOpen(true);
  };
  const updateResource = (id: string, field: keyof DraftResource, value: string) => setDraft((current) => ({ ...current, resources: current.resources.map((resource) => resource.id === id ? { ...resource, [field]: value } : resource) }));
  const updateMilestone = (index: number, field: "title" | "date", value: string) => setDraft((current) => ({ ...current, milestones: current.milestones.map((milestone, milestoneIndex) => milestoneIndex === index ? { ...milestone, [field]: value } : milestone) }));
  const updateTeamNode = (id: string, field: keyof DraftTeamNode, value: string) => setDraft((current) => ({ ...current, teamStructure: current.teamStructure.map((node) => node.id === id ? { ...node, [field]: value } : node) }));
  const updateStakeholder = <K extends keyof DraftStakeholder>(id: string, field: K, value: DraftStakeholder[K]) => setDraft((current) => ({ ...current, stakeholders: current.stakeholders.map((stakeholder) => stakeholder.id === id ? { ...stakeholder, [field]: value } : stakeholder) }));
  const updateRisk = <K extends keyof DraftRisk>(id: string, field: K, value: DraftRisk[K]) => setDraft((current) => ({ ...current, risks: current.risks.map((risk) => risk.id === id ? { ...risk, [field]: value } : risk) }));
  const setResourceMember = (id: string, memberId: string) => {
    const member = teamMembers.find((item) => item.id === memberId);
    updateResource(id, "memberId", memberId === "custom" ? "" : memberId);
    if (member && memberId !== "custom") {
      updateResource(id, "name", member.name);
      updateResource(id, "role", member.role);
    }
  };
  const saveProject = async () => {
    const resources: WorkspaceProjectResource[] = draft.resources.filter((resource) => resource.name.trim()).map((resource) => ({
      id: resource.id,
      name: resource.name.trim(),
      role: resource.role.trim() || "Contributor",
      allocation: Number(resource.allocation || 0),
      plannedHours: Number(resource.plannedHours || 0),
      memberId: resource.memberId || undefined,
    }));
    const teamStructure: WorkspaceProjectTeamNode[] = draft.teamStructure.filter((node) => node.name.trim() || node.title.trim()).map((node) => ({
      id: node.id,
      name: node.name.trim() || "Unassigned",
      title: node.title.trim() || "Team Member",
      reportsTo: node.reportsTo.trim(),
      responsibilities: node.responsibilities.trim(),
      memberId: node.memberId || undefined,
    }));
    const stakeholders: WorkspaceProjectStakeholder[] = draft.stakeholders.filter((stakeholder) => stakeholder.name.trim()).map((stakeholder) => ({
      ...stakeholder,
      name: stakeholder.name.trim(),
      role: stakeholder.role.trim() || "Stakeholder",
      notes: stakeholder.notes.trim(),
    }));
    const risks: WorkspaceProjectRisk[] = draft.risks.filter((risk) => risk.title.trim()).map((risk) => ({
      ...risk,
      title: risk.title.trim(),
      description: risk.description.trim(),
      category: risk.category.trim() || "General",
      owner: risk.owner.trim() || "Project Manager",
      mitigation: risk.mitigation.trim() || "To be defined",
    }));
    const documents = draft.documents;
    const assignedProjectMemberIds = Array.from(
      new Set(
        [
          ...resources.map((resource) => resource.memberId).filter((memberId): memberId is string => Boolean(memberId)),
          ...teamStructure.map((node) => node.memberId).filter((memberId): memberId is string => Boolean(memberId)),
        ],
      ),
    );
    const channelMemberIds =
      assignedProjectMemberIds.length > 0
        ? assignedProjectMemberIds
        : teamMembers.slice(0, 5).map((member) => member.id);
    const payload: Partial<WorkspaceProject> = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      status: draft.status,
      startDate: draft.startDate,
      endDate: draft.endDate,
      start_date: draft.startDate,
      end_date: draft.endDate,
      budget: draft.budget,
      department: draft.department,
      projectNature: draft.projectNature.trim(),
      namespace: draft.namespace,
      workflowId: draft.workflowId,
      progress: draft.progress,
      tags: parseTags(draft.tagsText),
      customFieldValues: draft.customFieldValues,
      milestones: draft.milestones.filter((milestone) => milestone.title.trim()),
      resources,
      teamStructure,
      stakeholders,
      risks,
      documents,
      files: documents.map((document) => ({ name: document.name, size: document.generated ? "Generated" : "Uploaded", uploadedAt: document.uploadedAt })),
      team: Array.from(new Set([...resources.map((resource) => resource.name), ...teamStructure.map((node) => node.name)].filter(Boolean))),
      risk_level: toRiskLevel(draft.status, draft.priority),
    };
    if (!payload.name) return toast.error("Project name is required.");
    const savedProject = editingProjectId
      ? await updateProject.mutateAsync({ id: editingProjectId, ...payload })
      : await createProject.mutateAsync(payload as Partial<WorkspaceProject> & { name: string });

    const projectId = editingProjectId ?? savedProject?.id;
    const quickLinks = projectId ? [
      { id: `${projectId}-docs`, label: "Documents", type: "document" as const, url: `/documents?projectId=${projectId}` },
      { id: `${projectId}-calendar`, label: "Calendar", type: "meeting" as const, url: `/calendar` },
      { id: `${projectId}-schedule`, label: "Schedule", type: "file" as const, url: `/schedule?projectId=${projectId}` },
    ] : [];

    if (projectId) {
      const channelDefinitions = [
        {
          kind: "general" as const,
          name: `${draft.name || savedProject?.name || "Project"} Community`,
          topic: communityTopic,
          readOnly: false,
        },
        {
          kind: "deliverables" as const,
          name: `${draft.name || savedProject?.name || "Project"} Deliverables Review`,
          topic: "Review deliverables, project documents, and team comments for each phase output.",
          readOnly: false,
        },
        {
          kind: "announcements" as const,
          name: `${draft.name || savedProject?.name || "Project"} Approvals`,
          topic: "Final approvals, sign-off updates, and formal project notices.",
          readOnly: true,
        },
      ];

      if (!editingProjectId && autoGenerateSchedule) {
        const generatedSchedule = generateScheduleFromProjectNature({
          startDate: draft.startDate || new Date().toISOString().slice(0, 10),
          projectName: draft.name.trim() || savedProject?.name || "Project",
          projectNature: draft.projectNature,
        });
        for (const scheduleTask of generatedSchedule) {
          await createTask.mutateAsync({
            ...scheduleTask,
            project_id: projectId,
            projectId,
          });
        }
      }

      for (const channelDefinition of channelDefinitions) {
        const existingChannel = chatChannels.find((channel) => channel.projectId === projectId && (channel.kind ?? "general") === channelDefinition.kind);
        const nextMessages =
          channelDefinition.kind === "announcements" && announcementText
            ? existingChannel?.messages?.some((message) => message.pinned && message.message === announcementText)
              ? existingChannel.messages
              : [
                  ...(existingChannel?.messages ?? []),
                  {
                    id: makeId("chat"),
                    authorName: settings?.currentUser.displayName ?? "Project Admin",
                    message: announcementText,
                    createdAt: new Date().toISOString(),
                    pinned: true,
                  },
                ]
            : existingChannel?.messages ?? [];

        if (existingChannel) {
          await updateChatChannel.mutateAsync({
            id: existingChannel.id,
            name: channelDefinition.name,
            topic: channelDefinition.topic,
            kind: channelDefinition.kind,
            readOnly: channelDefinition.readOnly,
            whatsappGroupUrl: channelDefinition.kind === "general" ? whatsAppLink : existingChannel.whatsappGroupUrl,
            quickLinks,
            memberIds: channelMemberIds,
            messages: nextMessages,
          });
        } else {
          await createChatChannel.mutateAsync({
            name: channelDefinition.name,
            topic: channelDefinition.topic,
            kind: channelDefinition.kind,
            readOnly: channelDefinition.readOnly,
            memberIds: channelMemberIds,
            projectId,
            whatsappGroupUrl: channelDefinition.kind === "general" ? whatsAppLink : undefined,
            quickLinks,
            messages: nextMessages,
          });
        }
      }
    }
    toast.success(editingProjectId ? "Project updated." : autoGenerateSchedule ? "Project created with a starter schedule plan." : "Project created.");
    setDialogOpen(false);
  };
  const removeProject = async () => {
    if (!editingProjectId) return;
    await deleteProject.mutateAsync(editingProjectId);
    toast.success("Project archived.");
    setDialogOpen(false);
  };
  const addUploads = (files: File[]) => {
    setDraft((current) => ({ ...current, documents: mergeDocuments(current.documents, attachmentDocs(files)) }));
    toast.success(`${files.length} attachment${files.length > 1 ? "s" : ""} added.`);
  };
  const generateTemplates = () => {
    setDraft((current) => ({
      ...current,
      documents: mergeDocuments(
        current.documents,
        generateProjectTemplateDocuments({
          name: current.name,
          description: current.description,
          priority: current.priority,
          status: current.status,
          startDate: current.startDate,
          endDate: current.endDate,
          start_date: current.startDate,
          end_date: current.endDate,
          budget: current.budget,
          department: current.department,
          projectNature: current.projectNature,
          namespace: current.namespace,
          tags: parseTags(current.tagsText),
          milestones: current.milestones,
          resources: current.resources.filter((resource) => resource.name.trim()).map((resource) => ({
            id: resource.id,
            name: resource.name.trim(),
            role: resource.role.trim() || "Contributor",
            allocation: Number(resource.allocation || 0),
            plannedHours: Number(resource.plannedHours || 0),
            memberId: resource.memberId || undefined,
          })),
          teamStructure: current.teamStructure.filter((node) => node.name.trim() || node.title.trim()),
          stakeholders: current.stakeholders.filter((stakeholder) => stakeholder.name.trim()),
          risks: current.risks.filter((risk) => risk.title.trim()),
        }, documentTemplateStandard, {
          tasks: linkedTasks,
          tickets: linkedTickets,
          currentUserName: settings?.currentUser.displayName,
          organizationName: settings?.namespace.organization,
          portfolioOffice: settings?.namespace.portfolioOffice,
        }),
      ),
    }));
    toast.success(`${documentTemplateStandard} project document package generated from project, stakeholder, and risk data.`);
  };
  const askProjectAssistant = async () => {
    if (!projectAssistantInput.trim()) return;
    setProjectAssistantLoading(true);
    setProjectAssistantReply("");
    const context = [
      `Project: ${draft.name}`,
      `Nature: ${draft.projectNature || draft.description || "Not defined"}`,
      `Status: ${draft.status}`,
      `Progress: ${draft.progress}%`,
      `Resources: ${draft.resources.filter((resource) => resource.name.trim()).map((resource) => `${resource.name} (${resource.role})`).join(", ") || "None"}`,
      `Stakeholders: ${draft.stakeholders.filter((stakeholder) => stakeholder.name.trim()).map((stakeholder) => `${stakeholder.name} (${stakeholder.role})`).join(", ") || "None"}`,
      `Risks: ${draft.risks.filter((risk) => risk.title.trim()).map((risk) => risk.title).join(", ") || "None"}`,
    ].join("\n");

    await streamAgentChat({
      messages: [{ role: "user", content: `Project context:\n${context}\n\nQuestion: ${projectAssistantInput}` }],
      onDelta: (chunk) => setProjectAssistantReply((current) => current + chunk),
      onDone: () => setProjectAssistantLoading(false),
      onError: () => setProjectAssistantLoading(false),
    });
  };

  const postProjectCommunityMessage = async () => {
    if (!editingProjectId || !communityMessage.trim()) return;
    const channel = projectCommunityChannel ?? await createChatChannel.mutateAsync({
      name: `${draft.name || "Project"} Community`,
      topic: communityTopic,
      memberIds: teamMembers.slice(0, 5).map((member) => member.id),
      projectId: editingProjectId,
      whatsappGroupUrl: whatsAppLink,
      quickLinks: [
        { id: `${editingProjectId}-docs`, label: "Documents", type: "document", url: `/documents?projectId=${editingProjectId}` },
        { id: `${editingProjectId}-calendar`, label: "Calendar", type: "meeting", url: "/calendar" },
      ],
    });

    await createChatMessage.mutateAsync({
      channelId: channel.id,
      authorName: settings?.currentUser.displayName ?? "Project Admin",
      authorId: settings?.currentUser.teamMemberId,
      message: communityMessage.trim(),
    });
    setCommunityMessage("");
    toast.success("Project community message posted");
  };

  return (
    <AppLayout>
      <AppHeader title="Projects Workspace" subtitle={`${filtered.length} filtered projects connected to schedule, reports, team, tickets, and AI search.`} />
      <input
        ref={uploadRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) addUploads(files);
          event.currentTarget.value = "";
        }}
      />
      <div className="space-y-6 p-6">
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 lg:max-w-md">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="registry">Registry</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-6">
        <PageSection
          title="Portfolio Summary"
          description="Workspace totals for projects, linked delivery records, templates, and planned resource effort."
        />
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl"><CardHeader className="pb-3"><CardDescription>Projects</CardDescription><CardTitle className="text-3xl"><Link to="/projects" className="hover:text-blue-600 hover:underline">{projects.length}</Link></CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Portfolio records across the workspace.</CardContent></Card>
          <Card className="rounded-3xl"><CardHeader className="pb-3"><CardDescription>Tasks + Tickets</CardDescription><CardTitle className="text-3xl"><Link to="/tasks" className="hover:text-blue-600 hover:underline">{tasks.length + tickets.length}</Link></CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Inquiry data available for reporting and AI search.</CardContent></Card>
          <Card className="rounded-3xl"><CardHeader className="pb-3"><CardDescription>PMI Templates</CardDescription><CardTitle className="text-3xl">{projects.reduce((sum, project) => sum + (project.documents ?? []).filter((document) => document.category === "template").length, 0)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Generated charter, BRD, schedule, and scope documents.</CardContent></Card>
          <Card className="rounded-3xl"><CardHeader className="pb-3"><CardDescription>Planned Resource Hours</CardDescription><CardTitle className="text-3xl">{projects.reduce((sum, project) => sum + (project.resources ?? []).reduce((hours, resource) => hours + (resource.plannedHours ?? 0), 0), 0)}h</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Resource loading linked directly to projects.</CardContent></Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Portfolio Progress Graph</CardTitle>
              <CardDescription>Top projects by current progress with linked work-item volume.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={portfolioProgressData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={56} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <Tooltip />
                  <Bar dataKey="progress" radius={[10, 10, 0, 0]} fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Portfolio Status Mix</CardTitle>
              <CardDescription>Distribution of active, on-hold, completed, and at-risk projects.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={portfolioStatusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={86} paddingAngle={4}>
                    {portfolioStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-2 sm:grid-cols-2">
                {portfolioStatusData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="capitalize">{entry.name}</span>
                    </div>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle>Implementation Lifecycle Matrix</CardTitle>
            <CardDescription>Portfolio radar view for imported lifecycle counts and task-derived stage totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-10">
              {lifecycleTotals.map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => navigate(`/tasks?stage=${stage.key}`)}
                  className={`rounded-2xl border-2 bg-background px-3 py-3 text-sm font-semibold transition-colors hover:bg-muted/20 ${stage.border} ${stage.text}`}
                >
                  <span>{stage.label}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{stage.total} activities</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {lifecycleStageCatalog.map((stage) => (
                      <th key={stage.key} className="px-3 py-3">{stage.label}</th>
                    ))}
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Lead</th>
                    <th className="px-3 py-3">Project</th>
                    <th className="px-3 py-3">#</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioLifecycleRows.map((row) => (
                    <tr key={row.project.id} className="border-t">
                      {lifecycleStageCatalog.map((stage) => (
                        <td key={`${row.project.id}-${stage.key}`} className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => openProjectLifecycle(row.project.id, stage.key)}
                            className={`min-w-[48px] rounded-lg px-3 py-1.5 text-center font-semibold transition-colors hover:opacity-85 ${row.stageCounts[stage.key] > 0 ? `${stage.color} text-white` : 'bg-muted/30 text-muted-foreground'}`}
                          >
                            {row.stageCounts[stage.key]}
                          </button>
                        </td>
                      ))}
                      <td className="px-3 py-3 font-semibold">{row.totalActivities}</td>
                      <td className="px-3 py-3">
                        <div className="min-w-[180px]">
                          <p className="font-medium">{row.leader.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.leader.roleLabel}
                            {row.linkedUsers.length ? ` | ${row.linkedUsers.length} linked user${row.linkedUsers.length === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/projects?projectId=${row.project.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          aria-label={`Open ${row.project.name} project workspace`}
                        >
                          {row.project.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{row.rank}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/20 font-semibold">
                    {lifecycleTotals.map((stage) => (
                      <td key={`portfolio-total-${stage.key}`} className="px-3 py-3">{stage.total}</td>
                    ))}
                    <td className="px-3 py-3">{portfolioLifecycleRows.reduce((sum, row) => sum + row.totalActivities, 0)}</td>
                    <td className="px-3 py-3" colSpan={2}>Portfolio Rollup</td>
                    <td className="px-3 py-3">{portfolioLifecycleRows.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="registry" className="space-y-6">
        <div className="space-y-3">
          <PageSection
            title="Project Explorer"
            description="Search, filter, switch views, and jump into project workspaces from one control area."
          />
          <Card className="rounded-3xl">
          <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 xl:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search project, department, tag, description" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="at-risk">At risk</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[170px]"><Tags className="mr-2 h-4 w-4" /><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border bg-muted/30 p-1">
                <Button variant={viewMode === "card" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("card")}><LayoutGrid className="mr-2 h-4 w-4" />Card</Button>
                <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")}><Table2 className="mr-2 h-4 w-4" />Table</Button>
                <Button variant={viewMode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tree")}><GitBranch className="mr-2 h-4 w-4" />Tree</Button>
              </div>
              <Button variant="outline" onClick={() => navigate("/reports")}><Download className="mr-2 h-4 w-4" />Reports</Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create Project</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
                  <div className="border-b p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <DialogTitle className="text-2xl font-semibold">{editingProjectId ? "Project Workspace" : "Create Project"}</DialogTitle>
                        <p className="mt-2 text-sm text-muted-foreground">Resources, schedule, attachments, PMI templates, tags, and inquiry details all live in one project record.</p>
                      </div>
                      {editingProjectId && (
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => navigate(`/schedule?projectId=${editingProjectId}`)}><Calendar className="mr-2 h-4 w-4" />Schedule</Button>
                          <Button variant="outline" onClick={() => navigate("/ai-chat")}><Bot className="mr-2 h-4 w-4" />AI Chat</Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6">
                    <Tabs defaultValue="overview" className="space-y-6">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="resources">Resources</TabsTrigger>
                        <TabsTrigger value="documents">Documents</TabsTrigger>
                        <TabsTrigger value="community">Projects Community</TabsTrigger>
                        <TabsTrigger value="inquiry">Inquiry</TabsTrigger>
                      </TabsList>
                      <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Project Name</label><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div>
                          <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Description</label><Textarea rows={5} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Objectives, scope, benefits, and delivery notes" /></div>
                          <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Project Nature</label><Textarea rows={3} value={draft.projectNature} onChange={(event) => setDraft((current) => ({ ...current, projectNature: event.target.value }))} placeholder="Describe the nature of the project so AI-generated templates reflect the right business and delivery context" /></div>
                          <div className="md:col-span-2 rounded-3xl border p-4 bg-muted/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">Auto-generate schedule plan</p>
                                <p className="text-xs text-muted-foreground mt-1">Create a starter WBS, dependencies, and timeline from the project nature when this project is first saved.</p>
                              </div>
                              <Button type="button" variant={autoGenerateSchedule ? "default" : "outline"} onClick={() => setAutoGenerateSchedule((current) => !current)}>
                                {autoGenerateSchedule ? "Enabled" : "Disabled"}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Department</label><Input value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} /></div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Budget</label><Input value={draft.budget} onChange={(event) => setDraft((current) => ({ ...current, budget: event.target.value }))} /></div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Namespace</label><Input value={draft.namespace} onChange={(event) => setDraft((current) => ({ ...current, namespace: event.target.value }))} /></div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Workflow</label>
                            <Select value={draft.workflowId || workflows[0]?.id || ""} onValueChange={(value) => setDraft((current) => ({ ...current, workflowId: value }))}>
                              <SelectTrigger><SelectValue placeholder="Workflow" /></SelectTrigger>
                              <SelectContent>{workflows.map((workflow) => <SelectItem key={workflow.id} value={workflow.id}>{workflow.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Status</label>
                            <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as WorkspaceProject["status"] }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="on-hold">On hold</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="at-risk">At risk</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Priority</label>
                            <Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value as WorkspaceProject["priority"] }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Start Date</label><Input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">End Date</label><Input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></div>
                          <div className="space-y-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Progress %</label><Input type="number" min="0" max="100" value={draft.progress} onChange={(event) => setDraft((current) => ({ ...current, progress: Number(event.target.value) || 0 }))} /></div>
                          <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase text-muted-foreground">Tags</label><Input value={draft.tagsText} onChange={(event) => setDraft((current) => ({ ...current, tagsText: event.target.value }))} placeholder="erp, pmo, finance, transformation" /></div>
                          <div className="md:col-span-2">
                            <DynamicCustomFields
                              fields={projectCustomFields}
                              values={normalizeCustomFieldValues(projectCustomFields, draft.customFieldValues)}
                              onChange={(key, value) => setDraft((current) => ({ ...current, customFieldValues: { ...current.customFieldValues, [key]: value } }))}
                            />
                          </div>
                          <div className="space-y-3 md:col-span-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold uppercase text-muted-foreground">Milestones</label>
                              <Button variant="outline" size="sm" onClick={() => setDraft((current) => ({ ...current, milestones: [...current.milestones, { title: "", date: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add</Button>
                            </div>
                            {draft.milestones.map((milestone, index) => (
                              <div key={`${milestone.title}-${index}`} className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_220px_auto]">
                                <Input placeholder="Milestone title" value={milestone.title} onChange={(event) => updateMilestone(index, "title", event.target.value)} />
                                <Input type="date" value={milestone.date} onChange={(event) => updateMilestone(index, "date", event.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, milestones: current.milestones.filter((_, milestoneIndex) => milestoneIndex !== index) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="resources" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div><h3 className="font-semibold">Project Resources</h3><p className="text-sm text-muted-foreground">Working resource rows linked to utilization and reports.</p></div>
                          <Button variant="outline" onClick={() => setDraft((current) => ({ ...current, resources: [...current.resources, { id: makeId("resource"), name: "", role: "", allocation: "100", plannedHours: "40", memberId: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add Resource</Button>
                        </div>
                        {draft.resources.map((resource) => (
                          <div key={resource.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-5">
                            <Select value={resource.memberId || "custom"} onValueChange={(value) => setResourceMember(resource.id, value)}>
                              <SelectTrigger><SelectValue placeholder="Team member" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custom">Custom resource</SelectItem>
                                {teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input placeholder="Name" value={resource.name} onChange={(event) => updateResource(resource.id, "name", event.target.value)} />
                            <Input placeholder="Role" value={resource.role} onChange={(event) => updateResource(resource.id, "role", event.target.value)} />
                            <Input placeholder="Allocation %" type="number" value={resource.allocation} onChange={(event) => updateResource(resource.id, "allocation", event.target.value)} />
                            <div className="flex gap-2">
                              <Input placeholder="Hours" type="number" value={resource.plannedHours} onChange={(event) => updateResource(resource.id, "plannedHours", event.target.value)} />
                              <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, resources: current.resources.filter((item) => item.id !== resource.id) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                            </div>
                          </div>
                        ))}
                        <div className="space-y-3 pt-3">
                          <div className="flex items-center justify-between">
                            <div><h3 className="font-semibold">Project Team Structure</h3><p className="text-sm text-muted-foreground">Define reporting lines and accountabilities inside the project.</p></div>
                            <Button variant="outline" onClick={() => setDraft((current) => ({ ...current, teamStructure: [...current.teamStructure, { id: makeId("team"), name: "", title: "", reportsTo: "", responsibilities: "", memberId: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add Team Role</Button>
                          </div>
                          {draft.teamStructure.map((node) => (
                            <div key={node.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-5">
                              <Select value={node.memberId || "custom"} onValueChange={(value) => {
                                const member = teamMembers.find((item) => item.id === value);
                                updateTeamNode(node.id, "memberId", value === "custom" ? "" : value);
                                if (member && value !== "custom") {
                                  updateTeamNode(node.id, "name", member.name);
                                  updateTeamNode(node.id, "title", member.role);
                                }
                              }}>
                                <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="custom">Custom role</SelectItem>
                                  {teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input placeholder="Name" value={node.name} onChange={(event) => updateTeamNode(node.id, "name", event.target.value)} />
                              <Input placeholder="Title" value={node.title} onChange={(event) => updateTeamNode(node.id, "title", event.target.value)} />
                              <Input placeholder="Reports to" value={node.reportsTo} onChange={(event) => updateTeamNode(node.id, "reportsTo", event.target.value)} />
                              <div className="flex gap-2">
                                <Input placeholder="Responsibilities" value={node.responsibilities} onChange={(event) => updateTeamNode(node.id, "responsibilities", event.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, teamStructure: current.teamStructure.filter((item) => item.id !== node.id) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 pt-3">
                          <div className="flex items-center justify-between">
                            <div><h3 className="font-semibold">Stakeholder Register</h3><p className="text-sm text-muted-foreground">Capture stakeholders for AI-generated stakeholder registers and communication planning.</p></div>
                            <Button variant="outline" onClick={() => setDraft((current) => ({ ...current, stakeholders: [...current.stakeholders, { id: makeId("stakeholder"), name: "", role: "", influence: "medium", interest: "medium", engagement: "keep informed", notes: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add Stakeholder</Button>
                          </div>
                          {draft.stakeholders.map((stakeholder) => (
                            <div key={stakeholder.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-6">
                              <Input placeholder="Name" value={stakeholder.name} onChange={(event) => updateStakeholder(stakeholder.id, "name", event.target.value)} />
                              <Input placeholder="Role" value={stakeholder.role} onChange={(event) => updateStakeholder(stakeholder.id, "role", event.target.value)} />
                              <Select value={stakeholder.influence} onValueChange={(value) => updateStakeholder(stakeholder.id, "influence", value as DraftStakeholder["influence"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High influence</SelectItem><SelectItem value="medium">Medium influence</SelectItem><SelectItem value="low">Low influence</SelectItem></SelectContent></Select>
                              <Select value={stakeholder.interest} onValueChange={(value) => updateStakeholder(stakeholder.id, "interest", value as DraftStakeholder["interest"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High interest</SelectItem><SelectItem value="medium">Medium interest</SelectItem><SelectItem value="low">Low interest</SelectItem></SelectContent></Select>
                              <Select value={stakeholder.engagement} onValueChange={(value) => updateStakeholder(stakeholder.id, "engagement", value as DraftStakeholder["engagement"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manage closely">Manage closely</SelectItem><SelectItem value="keep satisfied">Keep satisfied</SelectItem><SelectItem value="keep informed">Keep informed</SelectItem><SelectItem value="monitor">Monitor</SelectItem></SelectContent></Select>
                              <div className="flex gap-2">
                                <Input placeholder="Notes" value={stakeholder.notes} onChange={(event) => updateStakeholder(stakeholder.id, "notes", event.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, stakeholders: current.stakeholders.filter((item) => item.id !== stakeholder.id) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 pt-3">
                          <div className="flex items-center justify-between">
                            <div><h3 className="font-semibold">Risk Register</h3><p className="text-sm text-muted-foreground">Capture project risks so generated templates include a working risk register.</p></div>
                            <Button variant="outline" onClick={() => setDraft((current) => ({ ...current, risks: [...current.risks, { id: makeId("risk"), title: "", description: "", category: "General", probability: "medium", impact: "medium", owner: "", mitigation: "", status: "open" }] }))}><Plus className="mr-2 h-4 w-4" />Add Risk</Button>
                          </div>
                          {draft.risks.map((risk) => (
                            <div key={risk.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-7">
                              <Input placeholder="Risk title" value={risk.title} onChange={(event) => updateRisk(risk.id, "title", event.target.value)} />
                              <Input placeholder="Category" value={risk.category} onChange={(event) => updateRisk(risk.id, "category", event.target.value)} />
                              <Select value={risk.probability} onValueChange={(value) => updateRisk(risk.id, "probability", value as DraftRisk["probability"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High probability</SelectItem><SelectItem value="medium">Medium probability</SelectItem><SelectItem value="low">Low probability</SelectItem></SelectContent></Select>
                              <Select value={risk.impact} onValueChange={(value) => updateRisk(risk.id, "impact", value as DraftRisk["impact"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High impact</SelectItem><SelectItem value="medium">Medium impact</SelectItem><SelectItem value="low">Low impact</SelectItem></SelectContent></Select>
                              <Input placeholder="Owner" value={risk.owner} onChange={(event) => updateRisk(risk.id, "owner", event.target.value)} />
                              <Select value={risk.status} onValueChange={(value) => updateRisk(risk.id, "status", value as DraftRisk["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="monitoring">Monitoring</SelectItem><SelectItem value="mitigated">Mitigated</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select>
                              <div className="flex gap-2">
                                <Input placeholder="Mitigation" value={risk.mitigation} onChange={(event) => updateRisk(risk.id, "mitigation", event.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, risks: current.risks.filter((item) => item.id !== risk.id) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                              </div>
                              <div className="md:col-span-7">
                                <Textarea rows={2} placeholder="Risk description" value={risk.description} onChange={(event) => updateRisk(risk.id, "description", event.target.value)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="documents" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="rounded-3xl border-dashed"><CardHeader><CardTitle className="text-lg">Project Attachments</CardTitle><CardDescription>Upload project files directly into the project record.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => uploadRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Browse Files</Button></CardContent></Card>
                          <Card className="rounded-3xl border-dashed">
                            <CardHeader>
                              <CardTitle className="text-lg">AI Project Templates</CardTitle>
                              <CardDescription>Generate charter, BRD, schedule plan, scope statement, risk register, stakeholder register, and team structure from project data.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <Select value={documentTemplateStandard} onValueChange={(value) => setDocumentTemplateStandard(value as DocumentTemplateStandard)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PMI">PMI Template</SelectItem>
                                  <SelectItem value="SAP">SAP Template</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={generateTemplates}><Wand2 className="mr-2 h-4 w-4" />Generate Package</Button>
                            </CardContent>
                          </Card>
                        </div>
                        {draft.documents.length === 0 ? (
                          <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">No project documents yet.</div>
                        ) : (
                          <div className="space-y-3">
                            {draft.documents.map((document) => (
                              <Card key={document.id} className="rounded-2xl">
                                <CardContent className="flex items-start justify-between gap-4 p-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-primary" />
                                      <p className="font-medium">{document.name}</p>
                                      <Badge variant="outline">{document.category}</Badge>
                                      {document.phase ? <Badge variant="secondary">{document.phase}</Badge> : null}
                                      {document.outputFormat ? <Badge variant="outline">{document.outputFormat.toUpperCase()}</Badge> : null}
                                      {document.standardTemplate ? <Badge variant="outline">{document.standardTemplate}</Badge> : null}
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">{document.content.slice(0, 160)}...</p>
                                    <p className="mt-2 text-[11px] text-muted-foreground">{document.deliverableType || document.type} | {document.reviewStatus ?? "draft"} | {document.linkedChannelName || "Project Community"}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/documents?projectId=${editingProjectId ?? ""}`)}>Open</Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, documents: current.documents.filter((item) => item.id !== document.id) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="community" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="rounded-3xl">
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Community Configuration</CardTitle>
                              <CardDescription>Manage the project group channel, announcements, WhatsApp reference, and quick navigation.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Channel Topic</label>
                                <Input value={communityTopic} onChange={(event) => setCommunityTopic(event.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">WhatsApp Group Link</label>
                                <Input value={whatsAppLink} onChange={(event) => setWhatsAppLink(event.target.value)} placeholder="https://chat.whatsapp.com/..." />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Pinned Announcement</label>
                                <Textarea rows={3} value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} placeholder="Project-wide announcement or read-only bulletin" />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => navigate("/documents")}>Open Document Drive</Button>
                                <Button variant="outline" onClick={() => navigate("/calendar")}>Open Calendar</Button>
                                {whatsAppLink ? (
                                  <Button variant="outline" onClick={() => window.open(whatsAppLink, "_blank", "noopener,noreferrer")}>
                                    <ExternalLink className="h-4 w-4 mr-2" />Open WhatsApp
                                  </Button>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="rounded-3xl">
                            <CardHeader>
                              <CardTitle className="text-lg">Shared Shortcuts</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {[
                                { label: "Document Drive", path: `/documents?projectId=${editingProjectId ?? ""}` },
                                { label: "Calendar & Meetings", path: "/calendar" },
                                { label: "Schedule Board", path: `/schedule?projectId=${editingProjectId ?? ""}` },
                                { label: "Resources", path: "/resources" },
                              ].map((link) => (
                                <button key={link.label} type="button" className="flex w-full items-center justify-between rounded-2xl border p-4 text-left hover:bg-muted/30" onClick={() => navigate(link.path)}>
                                  <span className="font-medium">{link.label}</span>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </button>
                              ))}
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="rounded-3xl">
                          <CardHeader>
                            <CardTitle className="text-lg">Project Communication Streams</CardTitle>
                            <CardDescription>Each project keeps separate channels for general collaboration, deliverables review, and approvals.</CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-3 md:grid-cols-3">
                            {(projectChannels.length ? projectChannels : [
                              { id: "general-preview", name: "Project Community", topic: "General team collaboration", kind: "general", messages: [] },
                              { id: "deliverables-preview", name: "Deliverables Review", topic: "Review generated documents and phase outputs", kind: "deliverables", messages: [] },
                              { id: "approvals-preview", name: "Approvals", topic: "Formal notices and sign-off updates", kind: "announcements", messages: [] },
                            ]).map((channel) => (
                              <div key={channel.id} className="rounded-2xl border p-4 bg-card/40">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{channel.name}</p>
                                  <Badge variant={channel.kind === "announcements" ? "secondary" : "outline"}>{channel.kind ?? "general"}</Badge>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{channel.topic}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Badge variant="outline">{channel.messages.length} messages</Badge>
                                  {channel.kind === "deliverables" ? <Badge variant="outline">{draft.documents.filter((document) => document.phase).length} deliverables</Badge> : null}
                                  {channel.kind === "announcements" ? <Badge variant="outline">{draft.documents.filter((document) => document.reviewStatus === "approved" || document.reviewStatus === "signed").length} approvals</Badge> : null}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        <Card className="rounded-3xl">
                          <CardHeader>
                            <CardTitle className="text-lg">Project Group Channel</CardTitle>
                            <CardDescription>Threaded updates, quick mentions, and project-specific collaboration.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {projectCommunityChannel?.messages.length ? (
                              <div className="space-y-3">
                                {projectCommunityChannel.messages.map((message) => (
                                  <div key={message.id} className="rounded-2xl border p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">{message.authorName}</p>
                                        {message.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                                      </div>
                                      <span className="text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">{message.message}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No project community messages yet.</div>
                            )}
                            <div className="flex gap-3">
                              <Input value={communityMessage} onChange={(event) => setCommunityMessage(event.target.value)} placeholder="Post a project community update..." />
                              <Button onClick={postProjectCommunityMessage}>Post</Button>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                      <TabsContent value="inquiry" className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Card className="rounded-3xl"><CardHeader><CardTitle className="text-lg">Project Inquiry Template</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="font-medium">Project:</span> {draft.name || "Untitled"}</p><p><span className="font-medium">Nature:</span> {draft.projectNature || "Not defined"}</p><p><span className="font-medium">Department:</span> {draft.department || "Not assigned"}</p><p><span className="font-medium">Namespace:</span> {draft.namespace || "default"}</p><p><span className="font-medium">Workflow:</span> {workflows.find((workflow) => workflow.id === draft.workflowId)?.name || "Default workflow"}</p><p><span className="font-medium">Tags:</span> {parseTags(draft.tagsText).join(", ") || "None"}</p></CardContent></Card>
                          <Card className="rounded-3xl"><CardHeader><CardTitle className="text-lg">Delivery Inquiry Template</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="font-medium">Linked Tasks:</span> {linkedTasks.length}</p><p><span className="font-medium">Linked Tickets:</span> {linkedTickets.length}</p><p><span className="font-medium">Resources:</span> {draft.resources.filter((resource) => resource.name.trim()).length}</p><p><span className="font-medium">Team Structure Roles:</span> {draft.teamStructure.filter((node) => node.name.trim() || node.title.trim()).length}</p><p><span className="font-medium">Stakeholders:</span> {draft.stakeholders.filter((stakeholder) => stakeholder.name.trim()).length}</p><p><span className="font-medium">Risks:</span> {draft.risks.filter((risk) => risk.title.trim()).length}</p><p><span className="font-medium">Documents:</span> {draft.documents.length}</p><p><span className="font-medium">Open Project:</span> {activeProject ? "Existing workspace record" : "New project draft"}</p></CardContent></Card>
                        </div>
                        <Card className="rounded-3xl">
                          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" />Project AI Assistant</CardTitle></CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex gap-3">
                              <Input value={projectAssistantInput} onChange={(event) => setProjectAssistantInput(event.target.value)} placeholder="Ask about project status, risks, resources, stakeholders, or documents..." />
                              <Button onClick={askProjectAssistant} disabled={projectAssistantLoading}>{projectAssistantLoading ? "Thinking..." : "Ask AI"}</Button>
                            </div>
                            <div className="rounded-2xl border border-muted/40 bg-muted/10 p-4 text-sm whitespace-pre-wrap min-h-[100px]">
                              {projectAssistantReply || "Project AI can answer questions about the current project and the wider application data."}
                            </div>
                          </CardContent>
                        </Card>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Milestone className="h-5 w-5 text-primary" />Linked Tasks</CardTitle></CardHeader><CardContent className="space-y-3">{linkedTasks.length === 0 ? <p className="text-sm text-muted-foreground">No linked tasks yet.</p> : linkedTasks.map((task) => <div key={task.id} className="rounded-2xl border p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.assignee || "Unassigned"}</p></div><Badge variant="outline">{task.status}</Badge></div></div>)}</CardContent></Card>
                          <Card className="rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Ticket className="h-5 w-5 text-primary" />Linked Tickets</CardTitle></CardHeader><CardContent className="space-y-3">{linkedTickets.length === 0 ? <p className="text-sm text-muted-foreground">No linked tickets yet.</p> : linkedTickets.map((ticket) => <div key={ticket.id} className="rounded-2xl border p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{ticket.title}</p><p className="text-xs text-muted-foreground">{ticket.assignee}</p></div><Badge variant="outline">{ticket.status}</Badge></div></div>)}</CardContent></Card>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                  <DialogFooter className="border-t p-6">
                    {editingProjectId ? <Button variant="ghost" onClick={removeProject}><Trash2 className="mr-2 h-4 w-4 text-rose-500" />Delete</Button> : <div />}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button className="gradient-primary text-primary-foreground" onClick={saveProject} disabled={createProject.isPending || updateProject.isPending}><Save className="mr-2 h-4 w-4" />{editingProjectId ? "Save Project" : "Create Project"}</Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl border bg-muted/30" />)}</div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-3xl border-dashed"><CardContent className="py-16 text-center"><FolderKanban className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h3 className="text-lg font-semibold">No matching projects</h3><p className="mt-2 text-sm text-muted-foreground">Adjust the filters or create a new project.</p></CardContent></Card>
        ) : viewMode === "card" ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => <Card key={project.id} className="cursor-pointer rounded-3xl transition-all hover:-translate-y-1 hover:shadow-lg" onClick={() => openProject(project)}><CardHeader className="space-y-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-xl">{project.name}</CardTitle><CardDescription className="mt-2">{project.department || "No department assigned"}</CardDescription></div><Badge variant="outline" className={statusColor[project.status]}>{project.status}</Badge></div><p className="line-clamp-3 text-sm text-muted-foreground">{project.description || "No description entered yet."}</p></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><span>Delivery progress</span><span>{project.progress}%</span></div><Progress value={project.progress} /></div><div className="grid grid-cols-2 gap-3 text-sm"><button type="button" className="rounded-2xl bg-muted/40 p-3 text-left transition-colors hover:bg-primary/10" onClick={(event) => { event.stopPropagation(); openProjectTasks(project.id); }}><p className="text-xs text-muted-foreground">Tasks</p><p className="mt-1 font-semibold">{taskCountByProject[project.id] ?? 0}</p></button><button type="button" className="rounded-2xl bg-muted/40 p-3 text-left transition-colors hover:bg-primary/10" onClick={(event) => { event.stopPropagation(); openProjectTickets(project.id); }}><p className="text-xs text-muted-foreground"><Link to="/tickets" className="hover:text-blue-600 hover:underline">Tickets</Link></p><p className="mt-1 font-semibold">{ticketCountByProject[project.id] ?? 0}</p></button><div className="rounded-2xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Resources</p><p className="mt-1 font-semibold">{(project.resources ?? []).length}</p></div><div className="rounded-2xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Documents</p><p className="mt-1 font-semibold">{(project.documents ?? []).length}</p></div></div><div className="flex flex-wrap gap-2">{(project.tags ?? []).length ? (project.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <Badge variant="secondary">No tags</Badge>}</div></CardContent></Card>)}
          </div>
        ) : viewMode === "table" ? (
          <Card className="overflow-hidden rounded-3xl"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Tasks</th><th className="px-4 py-3"><Link to="/tickets" className="hover:text-blue-600 hover:underline">Tickets</Link></th><th className="px-4 py-3">Resources</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{filtered.map((project) => <tr key={project.id} className="border-t"><td className="px-4 py-3"><div><p className="font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.department || "No department"}</p></div></td><td className="px-4 py-3"><Select value={project.status} onValueChange={(value) => updateProject.mutate({ id: project.id, status: value as WorkspaceProject["status"] })}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="on-hold">On hold</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="at-risk">At risk</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></td><td className="px-4 py-3"><Input type="number" min="0" max="100" defaultValue={project.progress} className="w-24" onBlur={(event) => updateProject.mutate({ id: project.id, progress: Number(event.target.value) || 0 })} /></td><td className="px-4 py-3 text-muted-foreground">{project.start_date ?? project.startDate ?? "TBD"} to {project.end_date ?? project.endDate ?? "TBD"}</td><td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => openProjectTasks(project.id)}>{taskCountByProject[project.id] ?? 0}</Button></td><td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => openProjectTickets(project.id)}>{ticketCountByProject[project.id] ?? 0}</Button></td><td className="px-4 py-3">{(project.resources ?? []).length}</td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => openProject(project)}>Open</Button></td></tr>)}</tbody></table></div></Card>
        ) : (
          <div className="space-y-4">{Object.entries(groups).map(([status, items]) => <Card key={status} className="rounded-3xl"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="capitalize">{status.replace("-", " ")}</CardTitle><CardDescription>{items.length} project(s) in this branch.</CardDescription></div><Badge variant="outline" className={statusColor[status as WorkspaceProject["status"]]}>{status}</Badge></div></CardHeader><CardContent className="space-y-3">{items.map((project) => <button key={project.id} type="button" className="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors hover:bg-muted/30" onClick={() => openProject(project)}><div><p className="font-medium">{project.name}</p><p className="text-sm text-muted-foreground">{(project.resources ?? []).length} resources, {(project.documents ?? []).length} documents, {(project.tags ?? []).length} tags</p></div><div className="text-right text-xs text-muted-foreground"><p>{project.start_date ?? project.startDate ?? "TBD"} to {project.end_date ?? project.endDate ?? "TBD"}</p><p>{project.progress}% progress</p></div></button>)}</CardContent></Card>)}</div>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Projects;
