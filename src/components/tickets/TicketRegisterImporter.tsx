import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { WorkspaceProject, WorkspaceTicket } from "@/lib/workspace-store";
import { buildSupportTicketImportPreview, parseSupportTicketRegisterTsv } from "@/lib/support-ticket-register-import";

type TicketRegisterImporterProps = {
  projects: WorkspaceProject[];
  tickets: WorkspaceTicket[];
  createTicket: { mutateAsync: (payload: Partial<WorkspaceTicket> & { title: string }) => Promise<unknown>; isPending?: boolean };
  updateTicket: { mutateAsync: (payload: Partial<WorkspaceTicket> & { id: string }) => Promise<unknown>; isPending?: boolean };
};

const expectedHeader = "ID\tProject\tApplication\tRequested By\tRequest Date\tDescription (Case)\tPriority\tTicket Number\tStatus\tClosure Date\tReplay\tNote1\tNote2";

export default function TicketRegisterImporter({ projects, tickets, createTicket, updateTicket }: TicketRegisterImporterProps) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);

  const rows = useMemo(() => {
    const parsed = parseSupportTicketRegisterTsv(rawText);
    const first = parsed[0];
    if (first?.id?.trim().toLowerCase() === "id" || first?.project?.trim().toLowerCase() === "project") return parsed.slice(1);
    return parsed;
  }, [rawText]);

  const preview = useMemo(() => buildSupportTicketImportPreview(rows, projects, tickets), [projects, rows, tickets]);

  const runImport = async () => {
    if (!preview.total) return toast.error("Paste the ticket register first");
    setImporting(true);
    try {
      for (const item of preview.rows) {
        if (item.action === "update" && item.existingTicketId) {
          await updateTicket.mutateAsync({ id: item.existingTicketId, ...item.ticket });
        } else {
          await createTicket.mutateAsync(item.ticket as Partial<WorkspaceTicket> & { title: string });
        }
      }
      window.dispatchEvent(new CustomEvent("workspace-data-changed", { detail: { entity: "tickets", reason: "ticket-register-import" } }));
      toast.success(`Imported ${preview.total} ticket rows`);
      setRawText("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ticket import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><UploadCloud className="h-4 w-4" />Import Register</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Import Ticket Register</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
            <p className="font-semibold">Expected tab-separated columns</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{expectedHeader}</p>
            <p className="mt-2 text-xs text-muted-foreground">Missing form fields are stored in ticket custom fields. Project is linked only when confidently matched to the approved project list.</p>
          </div>
          <Button variant="outline" type="button" onClick={() => setRawText(expectedHeader + "\n")}>Insert Header Template</Button>
          <Textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Paste ticket rows here" rows={12} className="font-mono text-xs" />
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Rows</p><p className="text-xl font-bold">{preview.total}</p></div>
            <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Create</p><p className="text-xl font-bold">{preview.createCount}</p></div>
            <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Update</p><p className="text-xl font-bold">{preview.updateCount}</p></div>
            <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Linked</p><p className="text-xl font-bold">{preview.linkedProjectCount}</p></div>
            <div className="rounded-xl border p-3"><p className="text-[10px] uppercase text-muted-foreground">Open Points</p><p className="text-xl font-bold">{preview.openPointCount}</p></div>
          </div>
          {preview.unlinkedProjectCount ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">{preview.unlinkedProjectCount} rows will be imported without project assignment for manual review.</div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={runImport} disabled={importing || !preview.total}>{importing ? "Importing..." : "Upsert Tickets"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
