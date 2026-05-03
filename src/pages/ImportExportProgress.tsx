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
import { workspaceKeys, useMeetings, useProjects, useStickyNotes, useTasks, useTeamMembers, useTickets, useUserAccounts } from "@/hooks/useProjects";
import { makeId, readWorkspaceData, updateWorkspaceData, type WorkspaceData } from "@/lib/workspace-store";
import { mapTicketToRegisterExportRow, ticketRegisterExportColumns, ticketRowsToCsv } from "@/lib/ticket-register-export";
import { toast } from "sonner";

type DatasetKey = "all" | "projects" | "tasks" | "tickets" | "teamMembers" | "userAccounts" | "meetings" | "stickyNotes";
type SingleDatasetKey = Exclude<DatasetKey, "all">;
type ImportMode = "merge" | "replace";

const datasets: Array<{ key: SingleDatasetKey; label: string; required: string[]; prefix: string }> = [
  { key: "projects", label: "Projects", required: ["name"], prefix: "project" },
  { key: "tasks", label: "Tasks / Activities", required: ["title"], prefix: "task" },
  { key: "tickets", label: "Tickets / Open Points", required: ["Ticket Number", "Description (Case)"], prefix: "ticket" },
  { key: "teamMembers", label: "Resources / Team", required: ["name", "email"], prefix: "member" },
  { key: "userAccounts", label: "User Accounts", required: ["fullName", "email"], prefix: "user" },
  { key: "meetings", label: "Schedule / Meetings", required: ["title"], prefix: "meeting" },
  { key: "stickyNotes", label: "Sticky Notes", required: ["content"], prefix: "note" },
];

const scopeOptions: Array<{ key: DatasetKey; label: string }> = [{ key: "all", label: "All System Data" }, ...datasets];

const headerAliases: Record<string, string> = {
  id: "idText",
  project: "projectName",
  projectname: "projectName",
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
  title: "title",
  email: "email",
  fullname: "fullName",
};

const normalizeHeader = (header: string) => {
  const key = header.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return headerAliases[key] ?? header.trim().replace(/\s+/g, "_");
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

const csvForGenericRows = (records: Record<string, unknown>[]) => {
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

const ensureId = (value: unknown, prefix: string) => typeof value === "string" && value.trim() ? value.trim() : makeId(prefix);

const normalizeTicketImport = (record: Record<string, unknown>, projectNameToId: Map<string, string>) => {
  const idText = String(record.idText ?? "").trim();
  const projectName = String(record.projectName ?? "").trim();
  const ticketNumber = String(record.ticketNumber ?? "").trim();
  const descriptionCase = String(record.descriptionCase ?? "").trim();
  const replay = String(record.replay ?? "").trim();
  const projectId = projectNameToId.get(projectName.toLowerCase()) ?? "";
  return {
    id: ticketNumber || idText || makeId("ticket"),
    title: ticketNumber || idText || descriptionCase.slice(0, 80) || "Ticket Case",
    description: descriptionCase,
    status: String(record.status ?? "open").toLowerCase().replace(/\s+/g, "-") || "open",
    priority: String(record.priority ?? "medium").toLowerCase(),
    assignee: String(record.requestedBy ?? ""),
    projectId: projectId || undefined,
    createdAt: String(record.requestDate ?? new Date().toISOString()).slice(0, 10),
    sla: String(record.status ?? "").toLowerCase() === "closed" ? "Closed" : "Active",
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
    },
  };
};

const normalizeGenericRecord = (dataset: SingleDatasetKey, record: Record<string, unknown>) => {
  const config = datasets.find((item) => item.key === dataset) ?? datasets[0];
  return { ...record, id: ensureId(record.id, config.prefix) };
};

const upsertRecords = (existing: any[], incoming: any[]) => {
  const next = [...existing];
  incoming.forEach((record) => {
    const ticketNumber = record.customFieldValues?.ticketNumber;
    const idText = record.customFieldValues?.idText;
    const index = next.findIndex((item) =>
      item.id === record.id ||
      (ticketNumber && item.customFieldValues?.ticketNumber === ticketNumber) ||
      (idText && item.customFieldValues?.idText === idText) ||
      (record.email && item.email?.toLowerCase?.() === String(record.email).toLowerCase()) ||
      (record.name && item.name?.toLowerCase?.() === String(record.name).toLowerCase())
    );
    if (index >= 0) next[index] = { ...next[index], ...record };
    else next.unshift(record);
  });
  return next;
};

const ImportExportProgress = () => {
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
    window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: dataset, reason: "import-export-center" } }));
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const parsed = ext === "json" ? JSON.parse(text) : parseCsv(text);
      let accepted = 0;

      if (dataset === "all") {
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("All System Data import requires JSON backup exported from this page.");
        updateWorkspaceData((current: WorkspaceData) => {
          const next = { ...current } as any;
          datasets.forEach((item) => {
            const incoming = Array.isArray(parsed[item.key]) ? parsed[item.key] : [];
            accepted += incoming.length;
            next[item.key] = mode === "replace" ? incoming : upsertRecords(next[item.key] ?? [], incoming);
          });
          return next as WorkspaceData;
        });
      } else if (dataset === "tickets") {
        const rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.tickets) ? parsed.tickets : [];
        const normalized = rawRows.map((row: Record<string, unknown>) => normalizeTicketImport(row, projectNameToId));
        accepted = normalized.length;
        updateWorkspaceData((current: WorkspaceData) => ({ ...current, tickets: mode === "replace" ? normalized : upsertRecords(current.tickets ?? [], normalized) }));
      } else {
        if (!selectedDataset) throw new Error("Select a dataset first.");
        const rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed[dataset]) ? parsed[dataset] : [];
        const normalized = rawRows.map((row: Record<string, unknown>) => normalizeGenericRecord(dataset, row));
        accepted = normalized.length;
        updateWorkspaceData((current: WorkspaceData) => ({ ...current, [dataset]: mode === "replace" ? normalized : upsertRecords((current as any)[dataset] ?? [], normalized) }));
      }

      await refreshWorkspace();
      setLastResult(`Imported ${accepted} records`);
      toast.success(`Imported ${accepted} records`);
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
      if (!exportRows.length) {
        toast.error("No tickets to export.");
        return;
      }
      downloadText(`tickets-register-${stamp}.${format}`, format === "json" ? JSON.stringify(exportRows, null, 2) : ticketRowsToCsv(exportRows), format === "json" ? "application/json" : "text/csv;charset=utf-8");
      return;
    }
    const records = ((current as any)[dataset] as Record<string, unknown>[]) ?? [];
    if (!records.length) {
      toast.error("No records to export.");
      return;
    }
    downloadText(`${dataset}-${stamp}.${format}`, format === "json" ? JSON.stringify(records, null, 2) : csvForGenericRows(records), format === "json" ? "application/json" : "text/csv;charset=utf-8");
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Import and export system data. Ticket exports use the exact approved Ticket Register form columns." />
      <div className="space-y-6 p-4 sm:p-6">
        <PageSection title="System Data Import / Export Center" description="Select Tickets / Open Points to export the exact ticket form columns: ID, Project, Application, Requested By, Request Date, Description (Case), Priority, Ticket Number, Status, Closure Date, Replay, Note1, Note2." />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="glass border-primary/20 shadow-xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Import data</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data scope</Label><Select value={dataset} onValueChange={(value) => setDataset(value as DatasetKey)} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopeOptions.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Import mode</Label><Select value={mode} onValueChange={(value) => setMode(value as ImportMode)} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merge">Merge / update existing</SelectItem><SelectItem value="replace">Replace selected scope</SelectItem></SelectContent></Select></div>
              </div>
              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5"><Input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); }} /><p className="mt-3 text-sm text-muted-foreground">{dataset === "tickets" ? `Tickets import/export columns: ${ticketRegisterExportColumns.join(" | ")}` : dataset === "all" ? "All System Data requires JSON exported from this page." : `Required fields: ${selectedDataset?.required.join(", ")}`}</p></div>
              <div className="rounded-2xl border bg-muted/20 p-4"><Badge>{busy ? "Processing" : lastResult}</Badge></div>
            </CardContent>
          </Card>
          <Card className="glass"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileArchive className="h-5 w-5 text-primary" /> Export / backup</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Ticket CSV and JSON exports are mapped to the updated ticket form columns only.</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => exportData("csv")} disabled={dataset === "all"}><Download className="mr-2 h-4 w-4" /> CSV</Button><Button variant="outline" onClick={() => exportData("json")}><Download className="mr-2 h-4 w-4" /> JSON</Button></div><Button variant="ghost" className="w-full" onClick={() => void refreshWorkspace()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh all pages</Button></CardContent></Card>
        </div>
        <Card className="glass overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> System counts</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Export fields</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{datasets.map((item) => <TableRow key={item.key}><TableCell className="font-semibold">{item.label}</TableCell><TableCell className="text-muted-foreground">{item.key === "tickets" ? ticketRegisterExportColumns.join(" | ") : item.required.join(", ")}</TableCell><TableCell className="text-right font-black">{counts[item.key]}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </div>
    </AppLayout>
  );
};

export default ImportExportProgress;
