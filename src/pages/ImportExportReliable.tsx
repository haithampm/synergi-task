import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, RefreshCw, UploadCloud } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import {
  workspaceKeys,
  useChatChannels,
  useMeetings,
  useProjects,
  useStickyNotes,
  useTasks,
  useTeamMembers,
  useTickets,
  useUserAccounts,
  useWorkspaceSettings,
} from "@/hooks/useProjects";
import {
  makeId,
  readWorkspaceData,
  updateWorkspaceData,
  type WorkspaceChatChannel,
  type WorkspaceData,
  type WorkspaceMeeting,
  type WorkspaceProject,
  type WorkspaceStickyNote,
  type WorkspaceTask,
  type WorkspaceTeamMember,
  type WorkspaceTicket,
  type WorkspaceUserAccount,
} from "@/lib/workspace-store";
import { toast } from "sonner";

type DatasetKey =
  | "projects"
  | "tasks"
  | "tickets"
  | "teamMembers"
  | "userAccounts"
  | "meetings"
  | "chatChannels"
  | "stickyNotes";

type ImportMode = "merge" | "replace";

type ImportResult = {
  accepted: number;
  skipped: number;
  errors: string[];
};

const datasets: Array<{ key: DatasetKey; label: string; description: string }> = [
  { key: "projects", label: "Projects", description: "Project names, dates, priority, progress, budget, and metadata." },
  { key: "tasks", label: "Tasks", description: "Task title, project, owner, priority, dates, and status." },
  { key: "tickets", label: "Tickets", description: "Support or delivery tickets with priority, status, owner, and SLA." },
  { key: "teamMembers", label: "Team Members", description: "People, departments, roles, capacity, and privilege role." },
  { key: "userAccounts", label: "User Accounts", description: "Application access profiles, admin roles, and account status." },
  { key: "meetings", label: "Schedule / Meetings", description: "Workspace meetings and scheduled events." },
  { key: "chatChannels", label: "Chat Channels", description: "Project or workspace communication channels." },
  { key: "stickyNotes", label: "Sticky Notes", description: "Quick notes, reminders, and personal/team actions." },
];

const requiredFields: Record<DatasetKey, string[]> = {
  projects: ["name"],
  tasks: ["title"],
  tickets: ["title"],
  teamMembers: ["name", "email"],
  userAccounts: ["fullName", "email"],
  meetings: ["title"],
  chatChannels: ["name"],
  stickyNotes: ["content"],
};

const headerAliases: Record<string, string> = {
  projectname: "name",
  project_name: "name",
  taskname: "title",
  task_name: "title",
  tickettitle: "title",
  ticket_title: "title",
  fullname: "fullName",
  full_name: "fullName",
  emailaddress: "email",
  email_address: "email",
  projectid: "projectId",
  project_id: "projectId",
  taskid: "taskId",
  task_id: "taskId",
  start: "startsAt",
  startdate: "start_date",
  start_date: "start_date",
  end: "endsAt",
  enddate: "end_date",
  end_date: "end_date",
  due: "due_date",
  duedate: "due_date",
  due_date: "due_date",
  owner: "ownerName",
  note: "content",
  notes: "content",
  sticky: "content",
  role: "roleId",
  privilege: "roleId",
};

const listLikeKeys = new Set(["tags", "assignees", "assignedProjectIds", "memberIds"]);
const numericKeys = new Set(["progress", "tasksTotal", "tasksCompleted", "capacityHours", "utilizationTarget", "workloadHours"]);
const booleanKeys = new Set(["done", "readOnly", "isMilestone"]);

const normalizeHeader = (header: string) => {
  const compact = header.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const aliasKey = compact.toLowerCase();
  return headerAliases[aliasKey] ?? compact;
};

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsv = (text: string) => {
  const rows = text.split(/\r?\n/).filter((row) => row.trim().length > 0);
  if (rows.length < 2) return [];
  const headers = splitCsvLine(rows[0]).map(normalizeHeader);
  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
};

const parseValue = (key: string, value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (booleanKeys.has(key)) return ["true", "yes", "1", "done"].includes(trimmed.toLowerCase());
  if (numericKeys.has(key)) {
    const numberValue = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
  if (listLikeKeys.has(key)) {
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.split(/[;|]/).map((item) => item.trim()).filter(Boolean);
      }
    }
    return trimmed.split(/[;|]/).map((item) => item.trim()).filter(Boolean);
  }
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const cleanRecord = (record: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key, parseValue(key, value)])
      .filter(([, value]) => value !== undefined && value !== ""),
  ) as Record<string, unknown>;

const ensureId = (value: unknown, prefix: string) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || makeId(prefix);
};

const normalizeStatus = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => {
  const candidate = String(value ?? "").trim().toLowerCase();
  return allowed.includes(candidate as T) ? (candidate as T) : fallback;
};

const normalizePriority = (value: unknown) => normalizeStatus(value, ["high", "medium", "low"] as const, "medium");

const toProject = (record: Record<string, unknown>): WorkspaceProject | null => {
  const name = String(record.name ?? "").trim();
  if (!name) return null;
  return {
    id: ensureId(record.id, "project"),
    name,
    description: String(record.description ?? ""),
    status: normalizeStatus(record.status, ["active", "on-hold", "completed", "at-risk", "archived"] as const, "active"),
    progress: Number(record.progress ?? 0),
    team: Array.isArray(record.team) ? record.team as string[] : [],
    startDate: String(record.startDate ?? record.start_date ?? ""),
    endDate: String(record.endDate ?? record.end_date ?? ""),
    tasksTotal: Number(record.tasksTotal ?? 0),
    tasksCompleted: Number(record.tasksCompleted ?? 0),
    priority: normalizePriority(record.priority),
    start_date: String(record.start_date ?? record.startDate ?? ""),
    end_date: String(record.end_date ?? record.endDate ?? ""),
    budget: String(record.budget ?? ""),
    department: String(record.department ?? ""),
    projectNature: String(record.projectNature ?? ""),
    tags: Array.isArray(record.tags) ? record.tags as string[] : [],
    files: [],
    milestones: [],
    resources: [],
    teamStructure: [],
    stakeholders: [],
    risks: [],
    documents: [],
    risk_level: normalizeStatus(record.risk_level, ["low", "medium", "high"] as const, "medium"),
    namespace: String(record.namespace ?? ""),
    workflowId: typeof record.workflowId === "string" && record.workflowId.trim() ? record.workflowId : undefined,
    customFieldValues: {},
  };
};

const toTask = (record: Record<string, unknown>): WorkspaceTask | null => {
  const title = String(record.title ?? "").trim();
  if (!title) return null;
  return {
    id: ensureId(record.id, "task"),
    title,
    description: String(record.description ?? ""),
    status: normalizeStatus(record.status, ["backlog", "todo", "in-progress", "review", "done"] as const, "todo"),
    priority: normalizePriority(record.priority),
    assignee: String(record.assignee ?? ""),
    projectId: String(record.projectId ?? record.project_id ?? ""),
    project_id: String(record.project_id ?? record.projectId ?? ""),
    projectName: String(record.projectName ?? "Unassigned"),
    dueDate: String(record.dueDate ?? record.due_date ?? ""),
    due_date: String(record.due_date ?? record.dueDate ?? ""),
    start_date: String(record.start_date ?? ""),
    end_date: String(record.end_date ?? ""),
    tags: Array.isArray(record.tags) ? record.tags as string[] : [],
    phase: String(record.phase ?? "Execution"),
    progress: Number(record.progress ?? 0),
    isMilestone: Boolean(record.isMilestone),
    predecessors: Array.isArray(record.predecessors) ? record.predecessors as string[] : [],
    assignees: Array.isArray(record.assignees) ? record.assignees as string[] : [],
    comments: [],
    files: [],
    duration: String(record.duration ?? "1d"),
    workloadHours: Number(record.workloadHours ?? 8),
    workflowStage: String(record.workflowStage ?? record.status ?? "todo"),
    timesheetEntries: [],
    customFieldValues: {},
  };
};

const toTicket = (record: Record<string, unknown>): WorkspaceTicket | null => {
  const title = String(record.title ?? "").trim();
  if (!title) return null;
  return {
    id: ensureId(record.id, "ticket"),
    title,
    description: String(record.description ?? ""),
    status: normalizeStatus(record.status, ["open", "in-progress", "resolved", "closed"] as const, "open"),
    priority: normalizePriority(record.priority),
    assignee: String(record.assignee ?? ""),
    projectId: String(record.projectId ?? ""),
    taskId: String(record.taskId ?? ""),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    sla: String(record.sla ?? "Not set"),
    comments: [],
    customFieldValues: {},
  };
};

const toTeamMember = (record: Record<string, unknown>): WorkspaceTeamMember | null => {
  const name = String(record.name ?? "").trim();
  const email = String(record.email ?? "").trim();
  if (!name || !email) return null;
  return {
    id: ensureId(record.id, "member"),
    name,
    email,
    role: String(record.role ?? ""),
    avatar: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    tasksAssigned: 0,
    tasksCompleted: 0,
    status: normalizeStatus(record.status, ["online", "away", "offline"] as const, "online"),
    phone: String(record.phone ?? ""),
    department: String(record.department ?? ""),
    avatarColor: "gradient-primary",
    assignedProjectIds: Array.isArray(record.assignedProjectIds) ? record.assignedProjectIds as string[] : [],
    capacityHours: Number(record.capacityHours ?? 40),
    utilizationTarget: Number(record.utilizationTarget ?? 85),
    privilegeRole: String(record.privilegeRole ?? record.roleId ?? "lead"),
    customFieldValues: {},
  };
};

const toUserAccount = (record: Record<string, unknown>): WorkspaceUserAccount | null => {
  const fullName = String(record.fullName ?? record.name ?? "").trim();
  const email = String(record.email ?? "").trim();
  if (!fullName || !email) return null;
  return {
    id: ensureId(record.id, "user"),
    fullName,
    email,
    roleId: String(record.roleId ?? "viewer"),
    status: normalizeStatus(record.status, ["active", "invited", "suspended"] as const, "active"),
    authProvider: normalizeStatus(record.authProvider, ["email", "google", "hybrid"] as const, "email"),
    teamMemberId: String(record.teamMemberId ?? ""),
    title: String(record.title ?? ""),
    department: String(record.department ?? ""),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    notes: String(record.notes ?? ""),
  };
};

const toMeeting = (record: Record<string, unknown>): WorkspaceMeeting | null => {
  const title = String(record.title ?? "").trim();
  if (!title) return null;
  const startsAt = String(record.startsAt ?? new Date().toISOString());
  return {
    id: ensureId(record.id, "meeting"),
    title,
    type: String(record.type ?? "Planning"),
    projectId: String(record.projectId ?? ""),
    taskId: String(record.taskId ?? ""),
    channelId: String(record.channelId ?? ""),
    organizerId: String(record.organizerId ?? ""),
    attendeeIds: Array.isArray(record.attendeeIds) ? record.attendeeIds as string[] : [],
    startsAt,
    endsAt: String(record.endsAt ?? startsAt),
    provider: normalizeStatus(record.provider, ["workspace", "outlook", "teams"] as const, "workspace"),
    joinUrl: String(record.joinUrl ?? ""),
    notes: String(record.notes ?? ""),
    status: normalizeStatus(record.status, ["scheduled", "completed", "cancelled"] as const, "scheduled"),
  };
};

const toChatChannel = (record: Record<string, unknown>): WorkspaceChatChannel | null => {
  const name = String(record.name ?? "").trim();
  if (!name) return null;
  return {
    id: ensureId(record.id, "channel"),
    name,
    topic: String(record.topic ?? ""),
    memberIds: Array.isArray(record.memberIds) ? record.memberIds as string[] : [],
    messages: [],
    projectId: String(record.projectId ?? ""),
    kind: normalizeStatus(record.kind, ["general", "deliverables", "announcements"] as const, "general"),
    readOnly: Boolean(record.readOnly),
    quickLinks: [],
  };
};

const toStickyNote = (record: Record<string, unknown>): WorkspaceStickyNote | null => {
  const content = String(record.content ?? record.title ?? "").trim();
  if (!content) return null;
  return {
    id: ensureId(record.id, "note"),
    title: String(record.title ?? "Quick note"),
    content,
    ownerName: String(record.ownerName ?? "Workspace User"),
    ownerUserAccountId: String(record.ownerUserAccountId ?? ""),
    ownerTeamMemberId: String(record.ownerTeamMemberId ?? ""),
    color: normalizeStatus(record.color, ["amber", "sky", "emerald", "rose"] as const, "amber"),
    done: Boolean(record.done),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
  };
};

const normalizeForDataset = (dataset: DatasetKey, record: Record<string, unknown>) => {
  const clean = cleanRecord(record);
  switch (dataset) {
    case "projects": return toProject(clean);
    case "tasks": return toTask(clean);
    case "tickets": return toTicket(clean);
    case "teamMembers": return toTeamMember(clean);
    case "userAccounts": return toUserAccount(clean);
    case "meetings": return toMeeting(clean);
    case "chatChannels": return toChatChannel(clean);
    case "stickyNotes": return toStickyNote(clean);
    default: return null;
  }
};

const upsertByIdentity = <T extends { id: string; email?: string; name?: string; title?: string }>(existing: T[], incoming: T[]) => {
  const next = [...existing];
  incoming.forEach((record) => {
    const index = next.findIndex((item) =>
      item.id === record.id ||
      (record.email && item.email?.toLowerCase() === record.email.toLowerCase()) ||
      (record.name && item.name?.toLowerCase() === record.name.toLowerCase()) ||
      (record.title && item.title?.toLowerCase() === record.title.toLowerCase()),
    );
    if (index >= 0) next[index] = { ...next[index], ...record };
    else next.unshift(record);
  });
  return next;
};

const recordsToCsv = (records: Record<string, unknown>[]) => {
  if (!records.length) return "";
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const escapeValue = (value: unknown) => `"${(typeof value === "object" ? JSON.stringify(value ?? "") : String(value ?? "")).replace(/"/g, '""')}"`;
  return [headers.join(","), ...records.map((record) => headers.map((header) => escapeValue(record[header])).join(","))].join("\n");
};

const downloadText = (filename: string, text: string, type = "text/plain") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ImportExportReliable = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<DatasetKey>("projects");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: meetings = [] } = useMeetings();
  const { data: chatChannels = [] } = useChatChannels();
  const { data: stickyNotes = [] } = useStickyNotes();
  const { data: settings } = useWorkspaceSettings();

  const counts = useMemo(() => ({
    projects: projects.length,
    tasks: tasks.length,
    tickets: tickets.length,
    teamMembers: teamMembers.length,
    userAccounts: userAccounts.length,
    meetings: meetings.length,
    chatChannels: chatChannels.length,
    stickyNotes: stickyNotes.length,
  }), [projects, tasks, tickets, teamMembers, userAccounts, meetings, chatChannels, stickyNotes]);

  const currentDataset = datasets.find((item) => item.key === dataset) ?? datasets[0];

  const getCurrentRecords = () => {
    const current = readWorkspaceData();
    return current[dataset] as unknown as Record<string, unknown>[];
  };

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projects }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.tickets }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.team }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.users }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.meetings }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.chat }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
    ]);
  };

  const importRecords = async (records: Array<Record<string, unknown>>) => {
    const errors: string[] = [];
    const normalized = records
      .map((record, index) => {
        const missing = requiredFields[dataset].filter((field) => !String(record[field] ?? "").trim());
        if (missing.length) {
          errors.push(`Row ${index + 2}: missing ${missing.join(", ")}`);
          return null;
        }
        return normalizeForDataset(dataset, record);
      })
      .filter(Boolean) as any[];

    updateWorkspaceData((current: WorkspaceData) => ({
      ...current,
      [dataset]: mode === "replace" ? normalized : upsertByIdentity((current[dataset] as any[]) ?? [], normalized),
      auditLogs: [
        {
          id: makeId("audit"),
          action: "Workspace import completed",
          entityType: "settings",
          entityId: dataset,
          actorName: current.settings.currentUser.displayName || current.settings.profile.email || "Workspace User",
          detail: `${normalized.length} ${currentDataset.label.toLowerCase()} imported using ${mode} mode.`,
          createdAt: new Date().toISOString(),
        },
        ...current.auditLogs,
      ].slice(0, 300),
    }));

    setLastResult({ accepted: normalized.length, skipped: errors.length, errors: errors.slice(0, 8) });
    await refreshWorkspace();
    return { accepted: normalized.length, skipped: errors.length, errors };
  };

  const handleFileImport = async (file: File) => {
    setImporting(true);
    setProgress(5);
    setLastResult(null);
    window.dispatchEvent(new CustomEvent("workspace-import-progress", { detail: { label: `Reading ${file.name}`, progress: 5 } }));

    try {
      const text = await file.text();
      setProgress(25);
      window.dispatchEvent(new CustomEvent("workspace-import-progress", { detail: { label: "Parsing import file", progress: 25 } }));
      const ext = file.name.split(".").pop()?.toLowerCase();
      let records: Array<Record<string, unknown>> = [];

      if (ext === "json") {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) records = parsed;
        else if (Array.isArray(parsed[dataset])) records = parsed[dataset];
        else throw new Error(`JSON must be an array or contain a ${dataset} array.`);
      } else if (ext === "csv") {
        records = parseCsv(text);
      } else {
        throw new Error("Use CSV or JSON for reliable import. For Microsoft Project, export to CSV first.");
      }

      setProgress(60);
      window.dispatchEvent(new CustomEvent("workspace-import-progress", { detail: { label: "Saving workspace data", progress: 60 } }));
      const result = await importRecords(records);
      setProgress(100);
      window.dispatchEvent(new CustomEvent("workspace-import-progress", { detail: { label: "Import complete", progress: 100, done: true } }));
      toast.success(`Imported ${result.accepted} ${currentDataset.label.toLowerCase()}${result.skipped ? `, skipped ${result.skipped}` : ""}.`);
    } catch (error) {
      setLastResult({ accepted: 0, skipped: 0, errors: [error instanceof Error ? error.message : "Import failed"] });
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportDataset = (format: "csv" | "json") => {
    const records = getCurrentRecords();
    if (!records.length) {
      toast.error(`No ${currentDataset.label.toLowerCase()} to export.`);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadText(`${dataset}-${stamp}.json`, JSON.stringify(records, null, 2), "application/json");
    } else {
      downloadText(`${dataset}-${stamp}.csv`, recordsToCsv(records), "text/csv");
    }
    toast.success(`Exported ${records.length} ${currentDataset.label.toLowerCase()}.`);
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Reliable workspace data import with validation, progress, and safe merge or replace mode." />
      <div className="space-y-6 p-4 sm:p-6">
        <PageSection
          title="Professional Import Center"
          description="Use CSV or JSON imports for production-safe workspace updates. Blank IDs are repaired automatically and required fields are validated before save."
        />

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UploadCloud className="h-5 w-5 text-primary" /> Import workspace data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dataset</Label>
                  <Select value={dataset} onValueChange={(value) => setDataset(value as DatasetKey)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {datasets.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{currentDataset.description}</p>
                </div>
                <div className="space-y-2">
                  <Label>Import mode</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">Merge / update existing</SelectItem>
                      <SelectItem value="replace">Replace this dataset</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Merge is recommended for production. Replace only affects the selected dataset.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFileImport(file);
                  }}
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  Required fields for {currentDataset.label}: <span className="font-semibold text-foreground">{requiredFields[dataset].join(", ")}</span>
                </p>
              </div>

              {importing && <Progress value={progress} className="h-2" />}

              {lastResult && (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> {lastResult.accepted} accepted</Badge>
                    <Badge variant={lastResult.skipped ? "destructive" : "secondary"} className="gap-1"><AlertCircle className="h-3 w-3" /> {lastResult.skipped} skipped</Badge>
                  </div>
                  {lastResult.errors.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {lastResult.errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Download className="h-5 w-5 text-primary" /> Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Export the selected dataset for backup, cleaning, or re-import.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={() => exportDataset("csv")}><Download className="h-4 w-4" /> CSV</Button>
                <Button variant="outline" className="gap-2" onClick={() => exportDataset("json")}><Download className="h-4 w-4" /> JSON</Button>
              </div>
              <Button variant="ghost" className="w-full gap-2" onClick={() => void refreshWorkspace()}><RefreshCw className="h-4 w-4" /> Refresh counts</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="glass overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Workspace counts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Dataset</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Current count</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-semibold">{item.label}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description}</TableCell>
                    <TableCell className="text-right font-black">{counts[item.key]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ImportExportReliable;
