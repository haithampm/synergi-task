import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Database, Download, FileArchive, RefreshCw, UploadCloud } from "lucide-react";
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
import { workspaceKeys, useMeetings, useProjects, useStickyNotes, useTasks, useTeamMembers, useTickets, useUserAccounts } from "@/hooks/useProjects";
import { makeId, readWorkspaceData, updateWorkspaceData, type WorkspaceData } from "@/lib/workspace-store";
import { toast } from "sonner";

type DatasetKey = "all" | "projects" | "tasks" | "tickets" | "teamMembers" | "userAccounts" | "meetings" | "stickyNotes";
type SingleDatasetKey = Exclude<DatasetKey, "all">;
type ImportMode = "merge" | "replace";
type StepKey = "idle" | "reading" | "parsing" | "validating" | "saving" | "refreshing" | "complete" | "error";

const datasets: Array<{ key: SingleDatasetKey; label: string; required: string[]; prefix: string }> = [
  { key: "projects", label: "Projects", required: ["name"], prefix: "project" },
  { key: "tasks", label: "Tasks / Activities", required: ["title"], prefix: "task" },
  { key: "tickets", label: "Tickets / Open Points", required: ["title"], prefix: "ticket" },
  { key: "teamMembers", label: "Resources / Team", required: ["name", "email"], prefix: "member" },
  { key: "userAccounts", label: "User Accounts", required: ["fullName", "email"], prefix: "user" },
  { key: "meetings", label: "Schedule / Meetings", required: ["title"], prefix: "meeting" },
  { key: "stickyNotes", label: "Sticky Notes", required: ["content"], prefix: "note" },
];

const scopeOptions: Array<{ key: DatasetKey; label: string }> = [{ key: "all", label: "All System Data" }, ...datasets];

const aliases: Record<string, string> = {
  projectname: "name",
  project_name: "name",
  taskname: "title",
  task_name: "title",
  tickettitle: "title",
  ticket_title: "title",
  ticketnumber: "ticketNumber",
  ticket_number: "ticketNumber",
  descriptioncase: "descriptionCase",
  description_case: "descriptionCase",
  requestedby: "requestedBy",
  requested_by: "requestedBy",
  requestdate: "requestDate",
  request_date: "requestDate",
  closuredate: "closureDate",
  closure_date: "closureDate",
  replay: "reply",
  note1: "note1",
  note2: "note2",
  application: "application",
  fullname: "fullName",
  full_name: "fullName",
  emailaddress: "email",
  email_address: "email",
  notes: "content",
  note: "content",
  owner: "ownerName",
  role: "roleId",
  privilege: "roleId",
  project_id: "projectId",
  projectid: "projectId",
  due_date: "due_date",
  duedate: "due_date",
  start: "startsAt",
  end: "endsAt",
};

const normalizeHeader = (header: string) => {
  const compact = header.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  return aliases[compact.toLowerCase()] ?? compact;
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
  const rows = text.split(/\r?\n/).filter((row) => row.trim());
  if (rows.length < 2) return [];
  const headers = splitCsvLine(rows[0]).map(normalizeHeader);
  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
};

const parseValue = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (["true", "false"].includes(trimmed.toLowerCase())) return trimmed.toLowerCase() === "true";
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return trimmed;
};

const cleanRecord = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, parseValue(value)]).filter(([, value]) => value !== undefined && value !== ""));
const ensureId = (value: unknown, prefix: string) => typeof value === "string" && value.trim() ? value.trim() : makeId(prefix);

const normalizeTicketStatus = (value: unknown) => {
  const key = String(value ?? "open").trim().toLowerCase().replace(/\s+/g, "-");
  if (["done", "cancelled", "canceled", "closed"].includes(key)) return "closed";
  if (key === "inprogress") return "in-progress";
  if (["open", "in-progress", "resolved", "closed"].includes(key)) return key;
  return "open";
};

const normalizeRecord = (dataset: SingleDatasetKey, record: Record<string, unknown>) => {
  const data = cleanRecord(record);
  const datasetConfig = datasets.find((item) => item.key === dataset) ?? datasets[0];
  const id = ensureId(data.id, datasetConfig.prefix);
  const now = new Date().toISOString();

  switch (dataset) {
    case "projects":
      return { id, name: data.name, description: data.description ?? "", status: data.status ?? "active", progress: Number(data.progress ?? 0), team: [], startDate: data.startDate ?? data.start_date ?? "", endDate: data.endDate ?? data.end_date ?? "", tasksTotal: 0, tasksCompleted: 0, priority: data.priority ?? "medium", start_date: data.start_date ?? data.startDate ?? "", end_date: data.end_date ?? data.endDate ?? "", budget: data.budget ?? "", department: data.department ?? "", projectNature: data.projectNature ?? "", tags: [], files: [], milestones: [], resources: [], teamStructure: [], stakeholders: [], risks: [], documents: [], risk_level: data.risk_level ?? "medium", namespace: data.namespace ?? "", customFieldValues: data.customFieldValues ?? {} };
    case "tasks":
      return { id, title: data.title, description: data.description ?? "", status: data.status ?? "todo", priority: data.priority ?? "medium", assignee: data.assignee ?? "", projectId: data.projectId ?? "", project_id: data.projectId ?? data.project_id ?? "", projectName: data.projectName ?? "Unassigned", dueDate: data.dueDate ?? data.due_date ?? "", due_date: data.due_date ?? data.dueDate ?? "", tags: [], phase: data.phase ?? "Execution", progress: Number(data.progress ?? 0), comments: [], files: [], duration: data.duration ?? "1d", workloadHours: Number(data.workloadHours ?? 8), workflowStage: data.workflowStage ?? data.status ?? "todo", timesheetEntries: data.timesheetEntries ?? [], actualHours: Number(data.actualHours ?? 0), customFieldValues: data.customFieldValues ?? {} };
    case "tickets": {
      const ticketNumber = data.ticketNumber ?? data.title ?? id;
      return { id, title: data.title ?? ticketNumber, description: data.description ?? data.descriptionCase ?? "", status: normalizeTicketStatus(data.status), priority: data.priority ?? "medium", assignee: data.assignee ?? data.requestedBy ?? "", projectId: data.projectId ?? "", taskId: data.taskId ?? "", createdAt: data.createdAt ?? data.requestDate ?? now, sla: data.sla ?? "Active", comments: data.comments ?? [], customFieldValues: { ...(typeof data.customFieldValues === "object" ? data.customFieldValues as object : {}), idText: data.idText ?? data.id ?? "", application: data.application ?? "", requestedBy: data.requestedBy ?? "", requestDate: data.requestDate ?? data.createdAt ?? "", descriptionCase: data.descriptionCase ?? data.description ?? "", ticketNumber, closureDate: data.closureDate ?? "", reply: data.reply ?? "", note1: data.note1 ?? "", note2: data.note2 ?? "" } };
    }
    case "teamMembers": {
      const name = String(data.name ?? "");
      return { id, name, email: data.email, role: data.role ?? "", avatar: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), tasksAssigned: 0, tasksCompleted: 0, status: data.status ?? "online", phone: data.phone ?? "", department: data.department ?? "", avatarColor: "gradient-primary", assignedProjectIds: data.assignedProjectIds ?? [], capacityHours: Number(data.capacityHours ?? 40), utilizationTarget: Number(data.utilizationTarget ?? 85), privilegeRole: data.privilegeRole ?? data.roleId ?? "lead", customFieldValues: data.customFieldValues ?? {} };
    }
    case "userAccounts":
      return { id, fullName: data.fullName ?? data.name, email: data.email, roleId: data.roleId ?? "viewer", status: data.status ?? "active", authProvider: data.authProvider ?? "email", title: data.title ?? "", department: data.department ?? "", createdAt: data.createdAt ?? now, notes: data.notes ?? "" };
    case "meetings":
      return { id, title: data.title, type: data.type ?? "Planning", attendeeIds: data.attendeeIds ?? [], startsAt: data.startsAt ?? now, endsAt: data.endsAt ?? data.startsAt ?? now, provider: data.provider ?? "workspace", status: data.status ?? "scheduled", notes: data.notes ?? "" };
    case "stickyNotes":
      return { id, title: data.title ?? "Quick note", content: data.content ?? data.title, ownerName: data.ownerName ?? "Workspace User", color: data.color ?? "amber", done: Boolean(data.done), createdAt: data.createdAt ?? now };
    default:
      return { ...data, id };
  }
};

const upsertRecords = (existing: any[], incoming: any[]) => {
  const next = [...existing];
  incoming.forEach((record) => {
    const index = next.findIndex((item) => item.id === record.id || (record.email && item.email?.toLowerCase() === String(record.email).toLowerCase()) || (record.customFieldValues?.ticketNumber && item.customFieldValues?.ticketNumber === record.customFieldValues.ticketNumber) || (record.name && item.name?.toLowerCase() === String(record.name).toLowerCase()) || (record.title && item.title?.toLowerCase() === String(record.title).toLowerCase()));
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

const stepLabels: Record<StepKey, string> = { idle: "Ready", reading: "Reading file", parsing: "Parsing rows", validating: "Validating required fields", saving: "Saving workspace data", refreshing: "Refreshing all pages", complete: "Import complete", error: "Import failed" };

const ImportExportProgress = () => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<DatasetKey>("all");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<StepKey>("idle");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ accepted: number; skipped: number; errors: string[] } | null>(null);

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: meetings = [] } = useMeetings();
  const { data: stickyNotes = [] } = useStickyNotes();

  const counts = useMemo(() => ({ projects: projects.length, tasks: tasks.length, tickets: tickets.length, teamMembers: teamMembers.length, userAccounts: userAccounts.length, meetings: meetings.length, stickyNotes: stickyNotes.length }), [projects, tasks, tickets, teamMembers, userAccounts, meetings, stickyNotes]);
  const selectedDataset = datasets.find((item) => item.key === dataset);

  const setImportStep = (nextStep: StepKey, nextProgress: number, label?: string) => {
    setStep(nextStep);
    setProgress(nextProgress);
    window.dispatchEvent(new CustomEvent("workspace-import-progress", { detail: { label: label ?? stepLabels[nextStep], progress: nextProgress, done: nextStep === "complete" } }));
  };

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
    window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: dataset, reason: "import-export-center" } }));
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setFileName(file.name);
    setResult(null);
    setImportStep("reading", 8, `Reading ${file.name}`);
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      setImportStep("parsing", 30);
      const parsed = ext === "json" ? JSON.parse(text) : parseCsv(text);
      const errors: string[] = [];
      let accepted = 0;
      setImportStep("validating", 55);

      if (dataset === "all") {
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("All System Data import requires a JSON backup exported from this page.");
        updateWorkspaceData((current: WorkspaceData) => {
          const next = { ...current } as WorkspaceData;
          datasets.forEach((item) => {
            const incomingRaw = Array.isArray(parsed[item.key]) ? parsed[item.key] : [];
            const normalized = incomingRaw.map((record: Record<string, unknown>) => normalizeRecord(item.key, record));
            accepted += normalized.length;
            (next as any)[item.key] = mode === "replace" ? normalized : upsertRecords(((current as any)[item.key] as any[]) ?? [], normalized);
          });
          next.auditLogs = [{ id: makeId("audit"), action: "All system data imported", entityType: "settings", entityId: "all", actorName: current.settings.currentUser.displayName || current.settings.profile.email || "Workspace User", detail: `${accepted} records imported from ${file.name}.`, createdAt: new Date().toISOString() }, ...current.auditLogs].slice(0, 300);
          return next;
        });
      } else {
        if (!selectedDataset) throw new Error("Select a dataset first.");
        const rawRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed[dataset]) ? parsed[dataset] : [];
        if (!rawRecords.length) throw new Error("No rows found for the selected dataset.");
        const normalized = rawRecords.map((record: Record<string, unknown>, index: number) => {
          const missing = selectedDataset.required.filter((field) => !String(record[field] ?? "").trim());
          if (missing.length) {
            errors.push(`Row ${index + 2}: missing ${missing.join(", ")}`);
            return null;
          }
          return normalizeRecord(dataset, record);
        }).filter(Boolean) as any[];
        accepted = normalized.length;
        setImportStep("saving", 78);
        updateWorkspaceData((current: WorkspaceData) => ({ ...current, [dataset]: mode === "replace" ? normalized : upsertRecords((current[dataset] as any[]) ?? [], normalized), auditLogs: [{ id: makeId("audit"), action: "Workspace data imported", entityType: "settings", entityId: dataset, actorName: current.settings.currentUser.displayName || current.settings.profile.email || "Workspace User", detail: `${normalized.length} ${selectedDataset.label.toLowerCase()} imported from ${file.name}.`, createdAt: new Date().toISOString() }, ...current.auditLogs].slice(0, 300) }));
      }

      setImportStep("refreshing", 92);
      await refreshWorkspace();
      setResult({ accepted, skipped: errors.length, errors: errors.slice(0, 10) });
      setImportStep("complete", 100);
      toast.success(`Import completed: ${accepted} records saved${errors.length ? `, ${errors.length} skipped` : ""}.`);
    } catch (error) {
      setStep("error");
      setProgress(100);
      setResult({ accepted: 0, skipped: 0, errors: [error instanceof Error ? error.message : "Import failed"] });
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
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
    const records = ((current as any)[dataset] as Record<string, unknown>[]) ?? [];
    if (!records.length) {
      toast.error("No records to export.");
      return;
    }
    downloadText(`${dataset}-${stamp}.${format}`, format === "json" ? JSON.stringify(records, null, 2) : recordsToCsv(records), format === "json" ? "application/json" : "text/csv");
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Import/export one dataset or all system data with progress, validation, and linked page refresh." />
      <div className="space-y-6 p-4 sm:p-6">
        <PageSection title="System Data Import / Export Center" description="Use All System Data for a full JSON backup/restore, or select one dataset for CSV/JSON import and export." />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="glass border-primary/20 shadow-xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Import data</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data scope</Label><Select value={dataset} onValueChange={(value) => setDataset(value as DatasetKey)} disabled={importing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopeOptions.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Import mode</Label><Select value={mode} onValueChange={(value) => setMode(value as ImportMode)} disabled={importing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merge">Merge / update existing</SelectItem><SelectItem value="replace">Replace selected scope</SelectItem></SelectContent></Select></div>
              </div>
              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5"><Input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); }} /><p className="mt-3 text-sm text-muted-foreground">{dataset === "all" ? "All System Data requires JSON exported from this page." : <>Required fields: <span className="font-semibold text-foreground">{selectedDataset?.required.join(", ")}</span></>}</p></div>
              <div className={`rounded-3xl border p-5 ${importing || result ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10"}`}><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black">{stepLabels[step]}</p><p className="text-xs text-muted-foreground">{fileName || "No file selected"}</p></div><Badge variant={step === "error" ? "destructive" : step === "complete" ? "default" : "secondary"}>{Math.round(progress)}%</Badge></div><Progress value={progress} className="h-3" /></div>
              {result && <div className="rounded-2xl border bg-muted/20 p-4"><div className="flex flex-wrap gap-2"><Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> {result.accepted} accepted</Badge><Badge variant={result.errors.length ? "destructive" : "secondary"} className="gap-1"><AlertCircle className="h-3 w-3" /> {result.errors.length} issues</Badge></div>{result.errors.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</div>}
            </CardContent>
          </Card>
          <Card className="glass"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileArchive className="h-5 w-5 text-primary" /> Export / backup</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Export the selected scope. All System Data exports a complete JSON backup for restore.</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => exportData("csv")} disabled={dataset === "all"}><Download className="mr-2 h-4 w-4" /> CSV</Button><Button variant="outline" onClick={() => exportData("json")}><Download className="mr-2 h-4 w-4" /> JSON</Button></div><Button variant="ghost" className="w-full" onClick={() => void refreshWorkspace()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh all pages</Button></CardContent></Card>
        </div>
        <Card className="glass overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> System counts</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Required fields</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{datasets.map((item) => <TableRow key={item.key}><TableCell className="font-semibold">{item.label}</TableCell><TableCell className="text-muted-foreground">{item.required.join(", ")}</TableCell><TableCell className="text-right font-black">{counts[item.key]}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default ImportExportProgress;
