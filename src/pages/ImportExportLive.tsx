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
  useCreateTicket,
  useMeetings,
  useProjects,
  useStickyNotes,
  useTasks,
  useTeamMembers,
  useTickets,
  useUpdateTicket,
  useUserAccounts,
} from "@/hooks/useProjects";
import { makeId, readWorkspaceData, updateWorkspaceData, type WorkspaceData, type WorkspaceTicket } from "@/lib/workspace-store";
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

const normalizeTicketImport = (record: Record<string, unknown>, projectNameToId: Map<string, string>) => {
  const idText = String(record.idText ?? record.ID ?? "").trim();
  const projectName = String(record.projectName ?? record.Project ?? "").trim();
  const ticketNumber = String(record.ticketNumber ?? "").trim();
  const descriptionCase = String(record.descriptionCase ?? "").trim();
  const replay = String(record.replay ?? record.reply ?? "").trim();
  const projectId = projectNameToId.get(projectName.toLowerCase()) ?? "";
  const status = normalizeStatus(record.status);

  return {
    title: ticketNumber || idText || descriptionCase.slice(0, 80) || "Ticket Case",
    description: descriptionCase,
    status,
    priority: normalizePriority(record.priority),
    assignee: String(record.requestedBy ?? ""),
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

const upsertGeneric = (existing: any[], incoming: any[], prefix: string) => {
  const next = [...existing];
  incoming.forEach((raw) => {
    const record = { ...raw, id: raw.id || makeId(prefix) };
    const index = next.findIndex((item) => item.id === record.id || (record.email && item.email?.toLowerCase?.() === String(record.email).toLowerCase()) || (record.name && item.name?.toLowerCase?.() === String(record.name).toLowerCase()));
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
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

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

  const handleImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const parsed = ext === "json" ? JSON.parse(text) : parseTableText(text);
      let accepted = 0;

      if (dataset === "tickets") {
        const rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.tickets) ? parsed.tickets : [];
        const normalized = rawRows.map((row: Record<string, unknown>) => normalizeTicketImport(row, projectNameToId));
        for (const ticket of normalized) {
          const existing = findExistingTicket(ticket, tickets as WorkspaceTicket[]);
          if (existing && mode !== "replace") {
            await updateTicket.mutateAsync({ id: existing.id, ...ticket });
          } else {
            await createTicket.mutateAsync(ticket);
          }
          accepted += 1;
        }
      } else if (dataset === "all") {
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("All System Data import requires JSON backup exported from this page.");
        updateWorkspaceData((current: WorkspaceData) => {
          const next = { ...current } as any;
          datasets.forEach((item) => {
            const incoming = Array.isArray(parsed[item.key]) ? parsed[item.key] : [];
            accepted += incoming.length;
            next[item.key] = mode === "replace" ? incoming : upsertGeneric(next[item.key] ?? [], incoming, item.key);
          });
          return next as WorkspaceData;
        });
      } else {
        if (!selectedDataset) throw new Error("Select a dataset first.");
        const rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed[dataset]) ? parsed[dataset] : [];
        accepted = rawRows.length;
        updateWorkspaceData((current: WorkspaceData) => ({ ...current, [dataset]: mode === "replace" ? rawRows : upsertGeneric((current as any)[dataset] ?? [], rawRows, selectedDataset.key) }));
      }

      await refreshWorkspace();
      setLastResult(`Imported / updated ${accepted} records`);
      toast.success(`Imported / updated ${accepted} records`);
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
    const records = ((current as any)[dataset] as Record<string, unknown>[]) ?? [];
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
      <AppHeader title="Import / Export" subtitle="Live import/export. Ticket uploads now use real create/update ticket actions." />
      <div className="space-y-6 p-4 sm:p-6">
        <PageSection title="System Data Import / Export Center" description="Use this page for all import and export actions. Ticket import writes through the ticket system and refreshes the Tickets page." />
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
          <Card className="glass border-accent/20 shadow-xl"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileArchive className="h-5 w-5 text-accent" /> Export Data</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Ticket exports are mapped to the updated ticket form columns only.</p><div className="grid gap-2"><Button className="justify-start gap-2" onClick={() => exportData("csv")} disabled={dataset === "all"}><Download className="h-4 w-4" /> Export Selected Scope as CSV</Button><Button variant="outline" className="justify-start gap-2" onClick={() => exportData("json")}><Download className="h-4 w-4" /> Export Selected Scope as JSON</Button><Button variant="secondary" className="justify-start gap-2" onClick={exportAllSystemData}><Download className="h-4 w-4" /> Export All System Data Backup</Button></div><Button variant="ghost" className="w-full" onClick={() => void refreshWorkspace()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh all pages</Button></CardContent></Card>
        </div>
        <Card className="glass overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> System counts</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Export fields</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{datasets.map((item) => <TableRow key={item.key}><TableCell className="font-semibold">{item.label}</TableCell><TableCell className="text-muted-foreground">{item.key === "tickets" ? ticketRegisterExportColumns.join(" | ") : item.required}</TableCell><TableCell className="text-right font-black">{counts[item.key]}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </div>
    </AppLayout>
  );
}
