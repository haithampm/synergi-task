import { useMemo, useRef, useState } from "react";
import { Database, Download, FileArchive, RefreshCw, UploadCloud } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import {
  workspaceKeys,
  useCreateMeeting,
  useCreateProject,
  useCreateStickyNote,
  useCreateTask,
  useCreateTeamMember,
  useCreateTicket,
  useMeetings,
  useProjects,
  useStickyNotes,
  useTasks,
  useTeamMembers,
  useTickets,
  useUpdateMeeting,
  useUpdateProject,
  useUpdateStickyNote,
  useUpdateTask,
  useUpdateTeamMember,
  useUpdateTicket,
  useUpdateUserAccount,
  useUserAccounts,
} from "@/hooks/useProjects";
import {
  readWorkspaceData,
  updateWorkspaceData,
  type WorkspaceData,
  type WorkspaceMeeting,
  type WorkspaceProject,
  type WorkspaceStickyNote,
  type WorkspaceTask,
  type WorkspaceTeamMember,
  type WorkspaceTicket,
  type WorkspaceUserAccount,
} from "@/lib/workspace-store";
import { mapTicketToRegisterExportRow, ticketRegisterExportColumns, ticketRowsToCsv } from "@/lib/ticket-register-export";
import { toast } from "sonner";

type DatasetKey = "all" | "projects" | "tasks" | "tickets" | "teamMembers" | "userAccounts" | "meetings" | "stickyNotes";
type ImportMode = "merge" | "replace";

const datasets = [
  { key: "projects", label: "Projects", required: "name" },
  { key: "tasks", label: "Tasks / Activities", required: "title" },
  { key: "tickets", label: "Tickets / Open Points", required: "Ticket Number, Description (Case)" },
  { key: "teamMembers", label: "Resources / Team", required: "name, email" },
  { key: "userAccounts", label: "User Accounts", required: "fullName, email" },
  { key: "meetings", label: "Schedule / Meetings", required: "title" },
  { key: "stickyNotes", label: "Sticky Notes", required: "content" },
] as const;

const scopeOptions: Array<{ key: DatasetKey; label: string }> = [{ key: "all", label: "All System Data" }, ...datasets];

const headerAliases: Record<string, string> = {
  id: "id",
  project: "projectName",
  projectname: "projectName",
  projectid: "projectId",
  project_id: "projectId",
  application: "application",
  requestedby: "requestedBy",
  requestdate: "requestDate",
  descriptioncase: "descriptionCase",
  priority: "priority",
  ticketnumber: "ticketNumber",
  status: "status",
  closuredate: "closureDate",
  replay: "replay",
  reply: "replay",
  note1: "note1",
  note2: "note2",
  name: "name",
  projecttitle: "name",
  employeename: "name",
  membername: "name",
  resourcename: "name",
  title: "title",
  taskname: "title",
  activityname: "title",
  meetingtitle: "title",
  subject: "title",
  content: "content",
  note: "content",
  notes: "content",
  jobtitle: "role",
  position: "role",
  role: "role",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  mobile: "phone",
  department: "department",
  statusmember: "status",
  capacity: "capacityHours",
  capacityhours: "capacityHours",
  utilizationtarget: "utilizationTarget",
  privilege: "privilegeRole",
  privilegerole: "privilegeRole",
  assignedprojects: "assignedProjectIds",
  assignedprojectids: "assignedProjectIds",
  fullname: "fullName",
  full_name: "fullName",
  startdate: "start_date",
  start_date: "start_date",
  enddate: "end_date",
  end_date: "end_date",
  duedate: "due_date",
  due_date: "due_date",
  assignee: "assignee",
  owner: "assignee",
  phase: "phase",
  progress: "progress",
  description: "description",
  budget: "budget",
  type: "type",
  startsat: "startsAt",
  starts_at: "startsAt",
  endsat: "endsAt",
  ends_at: "endsAt",
  attendees: "attendeeIds",
  attendeeids: "attendeeIds",
  color: "color",
  done: "done",
};

const normalizeHeader = (header: string) => {
  const key = header.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return headerAliases[key] ?? header.trim().replace(/\s+/g, "_");
};

const splitDelimitedLine = (line: string, delimiter: "," | "\t") => {
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
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

const parseTableText = (text: string) => {
  const rows = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((row) => row.trim());
  if (rows.length < 2) return [];
  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(rows[0], delimiter).map(normalizeHeader);
  return rows.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
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

const genericCsv = (records: Record<string, unknown>[]) => {
  if (!records.length) return "";
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const escapeValue = (value: unknown) => `"${(typeof value === "object" ? JSON.stringify(value ?? "") : String(value ?? "")).replace(/"/g, '""')}"`;
  return [headers.join(","), ...records.map((record) => headers.map((header) => escapeValue(record[header])).join(","))].join("\n");
};

const asArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  return String(value ?? "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
};

const asBool = (value: unknown) => ["true", "yes", "1", "done", "closed"].includes(String(value ?? "").trim().toLowerCase());
const asNumber = (value: unknown, fallback: number) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || fallback;
const dateValue = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

const dateTimeValue = (value: unknown, fallback = new Date().toISOString()) => {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const normalizeStatus = (value: unknown): WorkspaceTicket["status"] => {
  const key = String(value ?? "open").trim().toLowerCase().replace(/\s+/g, "-");
  if (["done", "cancelled", "canceled", "closed"].includes(key)) return "closed";
  if (key === "inprogress") return "in-progress";
  if (["open", "in-progress", "resolved", "closed"].includes(key)) return key as WorkspaceTicket["status"];
  return "open";
};

const normalizePriority = (value: unknown): WorkspaceTicket["priority"] => {
  const key = String(value ?? "medium").trim().toLowerCase();
  if (["urgent", "high", "medium", "low"].includes(key)) return key as WorkspaceTicket["priority"];
  if (key.includes("high")) return "high";
  if (key.includes("low")) return "low";
  return "medium";
};

const normalizeProjectImport = (record: Record<string, unknown>) => ({
  name: String(record.name ?? "").trim(),
  description: String(record.description ?? ""),
  status: String(record.status ?? "active").trim().toLowerCase() || "active",
  priority: normalizePriority(record.priority),
  progress: asNumber(record.progress, 0),
  start_date: dateValue(record.start_date ?? record.startDate, new Date().toISOString().slice(0, 10)),
  startDate: dateValue(record.start_date ?? record.startDate, new Date().toISOString().slice(0, 10)),
  end_date: dateValue(record.end_date ?? record.endDate, ""),
  endDate: dateValue(record.end_date ?? record.endDate, ""),
  department: String(record.department ?? ""),
  budget: String(record.budget ?? ""),
  customFieldValues: { source: "import-export-project-upload", importedAt: new Date().toISOString() },
} as Partial<WorkspaceProject> & { name: string });

const normalizeTaskImport = (record: Record<string, unknown>, projectNameToId: Map<string, string>) => {
  const projectName = String(record.projectName ?? "").trim();
  const projectId = String(record.projectId ?? "").trim() || projectNameToId.get(projectName.toLowerCase()) || "";
  const title = String(record.title ?? "").trim();
  return {
    title,
    description: String(record.description ?? ""),
    status: String(record.status ?? "todo").trim().toLowerCase().replace(/\s+/g, "-") || "todo",
    priority: normalizePriority(record.priority),
    assignee: String(record.assignee ?? ""),
    project_id: projectId,
    projectId,
    projectName,
    due_date: dateValue(record.due_date ?? record.dueDate, ""),
    dueDate: dateValue(record.due_date ?? record.dueDate, ""),
    start_date: dateValue(record.start_date ?? record.startDate, ""),
    end_date: dateValue(record.end_date ?? record.endDate, dateValue(record.due_date ?? record.dueDate, "")),
    phase: String(record.phase ?? "Execution"),
    progress: asNumber(record.progress, 0),
    duration: String(record.duration ?? "3d"),
    workloadHours: asNumber(record.workloadHours, 24),
    customFieldValues: { source: "import-export-task-upload", importedAt: new Date().toISOString() },
  } as Partial<WorkspaceTask> & { title: string };
};

const normalizeTicketImport = (record: Record<string, unknown>, projectNameToId: Map<string, string>) => {
  const idText = String(record.idText ?? record.id ?? "").trim();
  const projectName = String(record.projectName ?? "").trim();
  const ticketNumber = String(record.ticketNumber ?? "").trim();
  const descriptionCase = String(record.descriptionCase ?? record.description ?? "").trim();
  const replay = String(record.replay ?? record.reply ?? "").trim();
  const projectId = projectNameToId.get(projectName.toLowerCase()) ?? "";
  const status = normalizeStatus(record.status);

  return {
    title: ticketNumber || idText || descriptionCase.slice(0, 80) || "Ticket Case",
    description: descriptionCase,
    status,
    priority: normalizePriority(record.priority),
    assignee: String(record.requestedBy ?? record.assignee ?? ""),
    projectId: projectId || undefined,
    createdAt: String(record.requestDate ?? new Date().toISOString()).slice(0, 10),
    sla: status === "closed" ? "Closed" : "Active",
    comments: [],
    customFieldValues: {
      idText,
      projectName,
      projectId,
      application: String(record.application ?? ""),
      requestedBy: String(record.requestedBy ?? ""),
      requestDate: String(record.requestDate ?? ""),
      descriptionCase,
      ticketNumber,
      closureDate: String(record.closureDate ?? ""),
      replay,
      reply: replay,
      note1: String(record.note1 ?? ""),
      note2: String(record.note2 ?? ""),
      isOpenPoint: status !== "closed" && status !== "resolved",
    },
  } as Partial<WorkspaceTicket> & { title: string };
};

const normalizeTeamMemberImport = (record: Record<string, unknown>) => {
  const name = String(record.name ?? "").trim();
  return {
    name,
    email: String(record.email ?? "").trim().toLowerCase(),
    role: String(record.role ?? record.title ?? "").trim(),
    phone: String(record.phone ?? "").trim(),
    department: String(record.department ?? "").trim(),
    status: String(record.status ?? "online").trim().toLowerCase() || "online",
    capacityHours: asNumber(record.capacityHours, 40),
    utilizationTarget: asNumber(record.utilizationTarget, 85),
    privilegeRole: String(record.privilegeRole ?? "lead").trim() || "lead",
    assignedProjectIds: asArray(record.assignedProjectIds),
    customFieldValues: { source: "import-export-team-upload", importedAt: new Date().toISOString() },
  } as Partial<WorkspaceTeamMember> & { name: string };
};

const normalizeMeetingImport = (record: Record<string, unknown>) => {
  const startsAt = dateTimeValue(record.startsAt ?? record.start_date ?? record.startDate);
  const endsAt = dateTimeValue(record.endsAt ?? record.end_date ?? record.endDate, startsAt);
  return {
    title: String(record.title ?? "").trim(),
    type: String(record.type ?? "Planning"),
    attendeeIds: asArray(record.attendeeIds),
    startsAt,
    endsAt,
    provider: String(record.provider ?? "workspace"),
    status: String(record.status ?? "scheduled"),
    notes: String(record.notes ?? record.description ?? ""),
    projectId: String(record.projectId ?? ""),
  } as Partial<WorkspaceMeeting> & { title: string };
};

const normalizeStickyImport = (record: Record<string, unknown>) => ({
  title: String(record.title ?? "Quick note").trim() || "Quick note",
  content: String(record.content ?? record.title ?? "").trim(),
  ownerName: String(record.ownerName ?? record.assignee ?? "Workspace User"),
  color: String(record.color ?? "amber"),
  done: asBool(record.done),
  createdAt: dateTimeValue(record.createdAt),
} as Partial<WorkspaceStickyNote> & { content: string });

const findExistingProject = (record: Partial<WorkspaceProject> & { name: string }, rows: WorkspaceProject[]) => rows.find((item) => item.name.trim().toLowerCase() === record.name.trim().toLowerCase());
const findExistingTask = (record: Partial<WorkspaceTask> & { title: string }, rows: WorkspaceTask[]) => rows.find((item) => item.title.trim().toLowerCase() === record.title.trim().toLowerCase() && String(item.projectId ?? item.project_id ?? "") === String(record.projectId ?? record.project_id ?? ""));
const findExistingTeamMember = (record: Partial<WorkspaceTeamMember> & { name: string }, rows: WorkspaceTeamMember[]) => rows.find((item) => (record.email && item.email.trim().toLowerCase() === String(record.email).trim().toLowerCase()) || item.name.trim().toLowerCase() === record.name.trim().toLowerCase());
const findExistingMeeting = (record: Partial<WorkspaceMeeting> & { title: string }, rows: WorkspaceMeeting[]) => rows.find((item) => item.title.trim().toLowerCase() === record.title.trim().toLowerCase() && String(item.startsAt).slice(0, 10) === String(record.startsAt).slice(0, 10));
const findExistingSticky = (record: Partial<WorkspaceStickyNote> & { content: string }, rows: WorkspaceStickyNote[]) => rows.find((item) => (item.title ?? "").trim().toLowerCase() === String(record.title ?? "").trim().toLowerCase() && item.content.trim().toLowerCase() === record.content.trim().toLowerCase());

const findExistingTicket = (record: Partial<WorkspaceTicket> & { title: string }, tickets: WorkspaceTicket[]) => {
  const custom = record.customFieldValues ?? {};
  const ticketNumber = String(custom.ticketNumber ?? "").trim().toLowerCase();
  const idText = String(custom.idText ?? "").trim().toLowerCase();
  return tickets.find((ticket: any) => {
    const existingCustom = ticket.customFieldValues ?? {};
    return (
      (ticketNumber && String(existingCustom.ticketNumber ?? "").trim().toLowerCase() === ticketNumber) ||
      (idText && String(existingCustom.idText ?? "").trim().toLowerCase() === idText) ||
      (ticketNumber && String(ticket.id ?? "").trim().toLowerCase() === ticketNumber) ||
      (ticketNumber && String(ticket.title ?? "").trim().toLowerCase().includes(ticketNumber))
    );
  });
};

const upsertGeneric = (existing: any[], incoming: any[]) => {
  const next = [...existing];
  incoming.forEach((record) => {
    const index = next.findIndex((item) => item.id === record.id || (record.email && item.email?.toLowerCase?.() === String(record.email).toLowerCase()) || (record.name && item.name?.toLowerCase?.() === String(record.name).toLowerCase()) || (record.title && item.title?.toLowerCase?.() === String(record.title).toLowerCase()));
    if (index >= 0) next[index] = { ...next[index], ...record };
    else next.unshift(record);
  });
  return next;
};

export default function ImportExportLive() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<DatasetKey>("tickets");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState("Ready");

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: meetings = [] } = useMeetings();
  const { data: stickyNotes = [] } = useStickyNotes();

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const createTeamMember = useCreateTeamMember();
  const updateTeamMember = useUpdateTeamMember();
  const updateUserAccount = useUpdateUserAccount();
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const createStickyNote = useCreateStickyNote();
  const updateStickyNote = useUpdateStickyNote();

  const projectNameById = useMemo(() => new Map(projects.map((project: any) => [project.id, project.name])), [projects]);
  const projectNameToId = useMemo(() => new Map(projects.map((project: any) => [String(project.name).toLowerCase(), project.id])), [projects]);
  const counts = useMemo(() => ({ projects: projects.length, tasks: tasks.length, tickets: tickets.length, teamMembers: teamMembers.length, userAccounts: userAccounts.length, meetings: meetings.length, stickyNotes: stickyNotes.length }), [projects, tasks, tickets, teamMembers, userAccounts, meetings, stickyNotes]);
  const selectedDataset = datasets.find((item) => item.key === dataset);

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projects }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.tickets }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.team }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.users }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.meetings }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
    ]);
    window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: dataset, reason: "live-import-export" } }));
  };

  const importRowsForScope = async (scope: DatasetKey, rawRows: Record<string, unknown>[]) => {
    let accepted = 0;
    if (scope === "projects") {
      for (const row of rawRows.map(normalizeProjectImport).filter((item) => item.name.trim())) {
        const existing = findExistingProject(row, projects as WorkspaceProject[]);
        if (existing && mode !== "replace") await updateProject.mutateAsync({ id: existing.id, ...row });
        else await createProject.mutateAsync(row);
        accepted += 1;
      }
    } else if (scope === "tasks") {
      for (const row of rawRows.map((item) => normalizeTaskImport(item, projectNameToId)).filter((item) => item.title.trim())) {
        const existing = findExistingTask(row, tasks as WorkspaceTask[]);
        if (existing && mode !== "replace") await updateTask.mutateAsync({ id: existing.id, ...row });
        else await createTask.mutateAsync(row);
        accepted += 1;
      }
    } else if (scope === "tickets") {
      for (const row of rawRows.map((item) => normalizeTicketImport(item, projectNameToId))) {
        const existing = findExistingTicket(row, tickets as WorkspaceTicket[]);
        if (existing && mode !== "replace") await updateTicket.mutateAsync({ id: existing.id, ...row });
        else await createTicket.mutateAsync(row);
        accepted += 1;
      }
    } else if (scope === "teamMembers") {
      for (const row of rawRows.map(normalizeTeamMemberImport).filter((item) => item.name.trim())) {
        const existing = findExistingTeamMember(row, teamMembers as WorkspaceTeamMember[]);
        if (existing && mode !== "replace") await updateTeamMember.mutateAsync({ id: existing.id, ...row });
        else await createTeamMember.mutateAsync(row);
        accepted += 1;
      }
    } else if (scope === "userAccounts") {
      for (const raw of rawRows) {
        const email = String(raw.email ?? "").trim().toLowerCase();
        const fullName = String(raw.fullName ?? raw.name ?? "").trim();
        const existing = (userAccounts as WorkspaceUserAccount[]).find((item) => item.email.trim().toLowerCase() === email || item.fullName.trim().toLowerCase() === fullName.toLowerCase());
        if (existing) {
          await updateUserAccount.mutateAsync({ id: existing.id, fullName: fullName || existing.fullName, email: email || existing.email, roleId: String(raw.roleId ?? raw.role ?? existing.roleId), status: String(raw.status ?? existing.status), title: String(raw.title ?? existing.title ?? ""), department: String(raw.department ?? existing.department ?? ""), notes: String(raw.notes ?? existing.notes ?? "") });
          accepted += 1;
        }
      }
    } else if (scope === "meetings") {
      for (const row of rawRows.map(normalizeMeetingImport).filter((item) => item.title.trim())) {
        const existing = findExistingMeeting(row, meetings as WorkspaceMeeting[]);
        if (existing && mode !== "replace") await updateMeeting.mutateAsync({ id: existing.id, ...row });
        else await createMeeting.mutateAsync(row);
        accepted += 1;
      }
    } else if (scope === "stickyNotes") {
      for (const row of rawRows.map(normalizeStickyImport).filter((item) => item.content.trim())) {
        const existing = findExistingSticky(row, stickyNotes as WorkspaceStickyNote[]);
        if (existing && mode !== "replace") await updateStickyNote.mutateAsync({ id: existing.id, ...row });
        else await createStickyNote.mutateAsync(row);
        accepted += 1;
      }
    }
    return accepted;
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const parsed = ext === "json" ? JSON.parse(text) : parseTableText(text);
      let accepted = 0;

      if (dataset === "all") {
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("All System Data import requires JSON backup exported from this page.");
        for (const item of datasets) {
          const rows = Array.isArray(parsed[item.key]) ? parsed[item.key] : [];
          accepted += await importRowsForScope(item.key as DatasetKey, rows);
        }
        updateWorkspaceData((current: WorkspaceData) => ({ ...current, auditLogs: current.auditLogs }));
      } else {
        const rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed[dataset]) ? parsed[dataset] : [];
        accepted = await importRowsForScope(dataset, rawRows);
      }

      await refreshWorkspace();
      setLastResult(`Live imported / updated ${accepted} records`);
      toast.success(`Live imported / updated ${accepted} records`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setLastResult(message);
      toast.error(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const exportData = (format: "csv" | "json") => {
    const current = readWorkspaceData();
    const stamp = new Date().toISOString().slice(0, 10);
    if (dataset === "all") {
      const backup = Object.fromEntries(datasets.map((item) => [item.key, (current as any)[item.key] ?? []]));
      downloadText(`synergi-all-system-data-${stamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      return;
    }
    if (dataset === "tickets") {
      const sourceTickets = tickets.length ? tickets : current.tickets ?? [];
      const exportRows = sourceTickets.map((ticket: any) => mapTicketToRegisterExportRow(ticket, projectNameById));
      if (!exportRows.length) return toast.error("No tickets to export.");
      downloadText(`tickets-register-${stamp}.${format}`, format === "json" ? JSON.stringify(exportRows, null, 2) : ticketRowsToCsv(exportRows), format === "json" ? "application/json" : "text/csv;charset=utf-8");
      return;
    }
    const liveRecords = dataset === "projects" ? projects : dataset === "tasks" ? tasks : dataset === "teamMembers" ? teamMembers : dataset === "meetings" ? meetings : dataset === "stickyNotes" ? stickyNotes : undefined;
    const records = ((liveRecords?.length ? liveRecords : (current as any)[dataset]) as Record<string, unknown>[]) ?? [];
    if (!records.length) return toast.error("No records to export.");
    downloadText(`${dataset}-${stamp}.${format}`, format === "json" ? JSON.stringify(records, null, 2) : genericCsv(records), format === "json" ? "application/json" : "text/csv;charset=utf-8");
  };

  const exportAllSystemData = () => {
    const current = readWorkspaceData();
    const stamp = new Date().toISOString().slice(0, 10);
    const backup = Object.fromEntries(datasets.map((item) => [item.key, (current as any)[item.key] ?? []]));
    downloadText(`synergi-all-system-data-${stamp}.json`, JSON.stringify(backup, null, 2), "application/json");
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Live import/export. All imports now use create/update system actions where available." />
      <div className="space-y-6 p-4 sm:p-6">
        <PageSection title="System Data Import / Export Center" description="Use this page for all import and export actions. Imports now write through the live system for projects, tasks, tickets, team, meetings, sticky notes and existing user accounts." />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="glass border-primary/20 shadow-xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Import Data</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data scope</Label><Select value={dataset} onValueChange={(value) => setDataset(value as DatasetKey)} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopeOptions.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Import mode</Label><Select value={mode} onValueChange={(value) => setMode(value as ImportMode)} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merge">Merge / update existing</SelectItem><SelectItem value="replace">Create as new / replace selected scope</SelectItem></SelectContent></Select></div>
              </div>
              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5"><Input ref={inputRef} type="file" accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); }} /><p className="mt-3 text-sm text-muted-foreground">{dataset === "tickets" ? `Tickets columns: ${ticketRegisterExportColumns.join(" | ")}` : dataset === "all" ? "All System Data requires JSON exported from this page." : `Required fields: ${selectedDataset?.required}`}</p></div>
              <div className="rounded-2xl border bg-muted/20 p-4"><Badge>{busy ? "Processing" : lastResult}</Badge></div>
            </CardContent>
          </Card>
          <Card className="glass border-accent/20 shadow-xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileArchive className="h-5 w-5 text-accent" /> Export Data</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Exports use live records first, then local fallback data.</p><div className="grid gap-2"><Button className="justify-start gap-2" onClick={() => exportData("csv")} disabled={dataset === "all"}><Download className="h-4 w-4" /> Export Selected Scope as CSV</Button><Button variant="outline" className="justify-start gap-2" onClick={() => exportData("json")}><Download className="h-4 w-4" /> Export Selected Scope as JSON</Button><Button variant="secondary" className="justify-start gap-2" onClick={exportAllSystemData}><Download className="h-4 w-4" /> Export All System Data Backup</Button></div><Button variant="ghost" className="w-full" onClick={() => void refreshWorkspace()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh all pages</Button></CardContent></Card>
        </div>
        <Card className="glass overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> System counts</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Export fields</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{datasets.map((item) => <TableRow key={item.key}><TableCell className="font-semibold">{item.label}</TableCell><TableCell className="text-muted-foreground">{item.key === "tickets" ? ticketRegisterExportColumns.join(" | ") : item.required}</TableCell><TableCell className="text-right font-black">{counts[item.key]}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </div>
    </AppLayout>
  );
}
