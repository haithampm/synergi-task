import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask, useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";

const phases = ["Discovery", "Planning", "Execution", "Testing", "Deployment", "Closure"];
const statuses = ["backlog", "todo", "in-progress", "review", "done"];
const priorities = ["low", "medium", "high", "urgent"];
const today = new Date().toISOString().slice(0, 10);
const headerTemplate = "Task Name\tPhase\tStart Date\tEnd Date\tDuration\tStatus\tPriority\tProgress\tAssignee\tMilestone";

const splitLine = (line: string, delimiter: "," | "\t") => {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') { current += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { out.push(current.trim()); current = ""; }
    else current += char;
  }
  out.push(current.trim());
  return out;
};

const headerKey = (header: string) => {
  const key = header.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const map: Record<string, string> = {
    task: "title", taskname: "title", activity: "title", activityname: "title", name: "title", title: "title",
    phase: "phase", stage: "phase", start: "startDate", startdate: "startDate",
    finish: "endDate", end: "endDate", enddate: "endDate", finishdate: "endDate",
    duration: "duration", durationdays: "duration", status: "status", priority: "priority",
    progress: "progress", percentcomplete: "progress", percentage: "progress", complete: "progress",
    assignee: "assignee", owner: "assignee", resource: "assignee", assignedto: "assignee",
    milestone: "isMilestone", ismilestone: "isMilestone",
  };
  return map[key] ?? header.trim();
};

const dateValue = (value?: string) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const addDays = (start: string, days: number) => {
  const date = new Date(`${start || today}T00:00:00`);
  date.setDate(date.getDate() + Math.max(0, days - 1));
  return date.toISOString().slice(0, 10);
};

const durationDays = (start: string, end: string) => {
  const s = new Date(`${start || today}T00:00:00`).getTime();
  const e = new Date(`${end || start || today}T00:00:00`).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1 || 1);
};

const normalizePhase = (value?: string) => phases.find((phase) => phase.toLowerCase() === String(value ?? "").trim().toLowerCase()) ?? "Execution";
const normalizeStatus = (value?: string) => {
  const raw = String(value ?? "todo").trim().toLowerCase().replace(/\s+/g, "-");
  if (raw === "inprogress") return "in-progress";
  if (raw === "complete" || raw === "completed") return "done";
  return statuses.includes(raw) ? raw : "todo";
};
const normalizePriority = (value?: string) => {
  const raw = String(value ?? "medium").trim().toLowerCase();
  if (raw.includes("urgent")) return "urgent";
  if (raw.includes("high")) return "high";
  if (raw.includes("low")) return "low";
  return priorities.includes(raw) ? raw : "medium";
};
const asBool = (value?: string) => ["yes", "true", "1", "milestone", "y"].includes(String(value ?? "").trim().toLowerCase());

const parseSchedule = (text: string) => {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitLine(lines[0], delimiter).map(headerKey);
  return lines.slice(1).map((line, index) => {
    const cells = splitLine(line, delimiter);
    const raw = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""])) as Record<string, string>;
    const startDate = dateValue(raw.startDate) || today;
    const parsedDuration = Number(String(raw.duration ?? "").replace(/[^0-9.]/g, "")) || 1;
    const endDate = dateValue(raw.endDate) || addDays(startDate, parsedDuration);
    return {
      rowNumber: index + 2,
      title: String(raw.title ?? "").trim(),
      phase: normalizePhase(raw.phase),
      startDate,
      endDate,
      status: normalizeStatus(raw.status),
      priority: normalizePriority(raw.priority),
      progress: Math.max(0, Math.min(100, Number(String(raw.progress ?? "0").replace(/[^0-9.]/g, "")) || 0)),
      assignee: String(raw.assignee ?? "").trim(),
      isMilestone: asBool(raw.isMilestone),
    };
  });
};

export default function ProjectScheduleImporter() {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: projects = [] } = useProjects();
  const createTask = useCreateTask();
  const visible = typeof window !== "undefined" && window.location.pathname === "/schedule";
  const selectedProject = projects.find((project: any) => project.id === projectId);
  const parsedRows = useMemo(() => parseSchedule(rawText), [rawText]);
  const validRows = parsedRows.filter((row) => row.title);
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (rawText.trim() && parsedRows.length === 0) issues.push("No valid schedule rows were found. Check the header row and delimiter.");
    parsedRows.forEach((row) => {
      if (!row.title) issues.push(`Row ${row.rowNumber}: Task Name is required.`);
      if (new Date(row.endDate) < new Date(row.startDate)) issues.push(`Row ${row.rowNumber}: End Date is before Start Date.`);
    });
    const duplicateTitles = new Set<string>();
    const seen = new Set<string>();
    validRows.forEach((row) => {
      const key = row.title.toLowerCase();
      if (seen.has(key)) duplicateTitles.add(row.title);
      seen.add(key);
    });
    duplicateTitles.forEach((title) => issues.push(`Duplicate task name in import: ${title}`));
    return issues;
  }, [parsedRows, rawText, validRows]);
  const milestones = validRows.filter((row) => row.isMilestone).length;

  if (!visible) return null;

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read schedule file");
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!selectedProject) return toast.error("Select a project first.");
    if (!validRows.length) return toast.error("Paste or upload valid schedule rows first.");
    if (validationIssues.length) return toast.error("Fix validation issues before importing.");
    setImporting(true);
    try {
      for (const row of validRows) {
        const days = durationDays(row.startDate, row.endDate);
        await createTask.mutateAsync({
          title: row.title,
          description: "Imported from Master Schedule page",
          project_id: selectedProject.id,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          phase: row.phase,
          status: row.status as any,
          priority: row.priority as any,
          start_date: row.startDate,
          end_date: row.endDate,
          due_date: row.endDate,
          duration: `${days}d`,
          progress: row.progress,
          workloadHours: row.isMilestone ? 0 : days * 8,
          isMilestone: row.isMilestone,
          assignee: row.assignee,
          customFieldValues: { source: "master-schedule-import", importedAt: new Date().toISOString() },
        } as any);
      }
      window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: "tasks", reason: "project-schedule-import" } }));
      toast.success(`Imported ${validRows.length} schedule rows to ${selectedProject.name}`);
      setRawText("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schedule import failed");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="sticky top-24 z-20 mx-4 mb-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur print:hidden sm:mx-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Master Schedule Import</p>
            <p className="text-sm text-muted-foreground">Import activities, milestones, dates, priority, progress, and assignee for one selected project.</p>
          </div>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm" variant="secondary"><UploadCloud className="h-4 w-4" /> Import Project Schedule</Button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Import Schedule for Specific Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Target Project</Label>
                <Select value={projectId || "__none__"} onValueChange={(value) => setProjectId(value === "__none__" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Select project</SelectItem>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <Button variant="outline" className="w-full" onClick={() => setRawText(`${headerTemplate}\nKickoff\tDiscovery\t${today}\t${today}\t1d\ttodo\thigh\t0\t\tYes\nRequirements Workshop\tDiscovery\t${today}\t${addDays(today, 5)}\t5d\ttodo\tmedium\t0\t\tNo\nDevelopment Sprint\tExecution\t${addDays(today, 6)}\t${addDays(today, 15)}\t10d\ttodo\tmedium\t0\t\tNo`)}>Insert Sample Template</Button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed bg-background p-5 text-sm hover:bg-muted/20">
              <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
              <span className="flex items-center gap-2"><FileUp className="h-4 w-4" /> Upload CSV / TSV Schedule File</span>
            </label>
            <Textarea rows={8} value={rawText} onChange={(event) => setRawText(event.target.value)} className="font-mono text-xs" placeholder={headerTemplate} />
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Valid Rows</p><p className="text-xl font-bold">{validRows.length}</p></div>
              <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Milestones</p><p className="text-xl font-bold">{milestones}</p></div>
              <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Activities</p><p className="text-xl font-bold">{validRows.length - milestones}</p></div>
              <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Project</p><p className="truncate text-sm font-bold">{selectedProject?.name ?? "Not selected"}</p></div>
            </div>
            {validationIssues.length ? <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Validation issues</div><ul className="space-y-1 text-xs text-muted-foreground">{validationIssues.slice(0, 8).map((issue) => <li key={issue}>- {issue}</li>)}</ul></div> : rawText.trim() ? <div className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/5 p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> Schedule import preview is valid.</div> : null}
            {validRows.length ? <div className="max-h-52 overflow-auto rounded-2xl border"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Phase</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead></TableRow></TableHeader><TableBody>{validRows.slice(0, 20).map((row) => <TableRow key={`${row.rowNumber}-${row.title}`}><TableCell className="font-medium">{row.title}</TableCell><TableCell><Badge variant="outline">{row.phase}</Badge></TableCell><TableCell>{row.startDate}</TableCell><TableCell>{row.endDate}</TableCell><TableCell>{row.status}</TableCell><TableCell>{row.priority}</TableCell></TableRow>)}</TableBody></Table></div> : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={runImport} disabled={importing || !selectedProject || !validRows.length || validationIssues.length > 0}>{importing ? "Importing..." : "Validate & Import to Project Schedule"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
