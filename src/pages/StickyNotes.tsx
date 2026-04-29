import { useMemo, useState } from "react";
import { CheckSquare, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { workspaceKeys, useCreateStickyNote, useDeleteStickyNote, useStickyNotes, useUpdateStickyNote, useWorkspaceSettings } from "@/hooks/useProjects";
import { makeId, updateWorkspaceData, type WorkspaceStickyNote } from "@/lib/workspace-store";
import { toast } from "sonner";

const StickyNotesPage = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useWorkspaceSettings();
  const { data: stickyNotes = [] } = useStickyNotes();
  const createStickyNote = useCreateStickyNote();
  const updateStickyNote = useUpdateStickyNote();
  const deleteStickyNote = useDeleteStickyNote();
  const [stickyTitle, setStickyTitle] = useState("");
  const [stickyContent, setStickyContent] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedStickyNotes = useMemo(
    () => [...stickyNotes].sort((a, b) => Number(b.done) - Number(a.done) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    [stickyNotes],
  );

  const openNotes = sortedStickyNotes.filter((note) => !note.done).length;
  const doneNotes = sortedStickyNotes.filter((note) => note.done).length;

  const saveLocalStickyNote = (note: WorkspaceStickyNote) => {
    updateWorkspaceData((current) => ({
      ...current,
      stickyNotes: [note, ...current.stickyNotes.filter((item) => item.id !== note.id)],
      auditLogs: [
        {
          id: makeId("audit"),
          action: "Sticky note created",
          entityType: "sticky-note",
          entityId: note.id,
          actorName: current.settings.currentUser.displayName || current.settings.profile.email || "Workspace User",
          detail: `${note.title} was added to Sticky Notes.`,
          createdAt: new Date().toISOString(),
        },
        ...current.auditLogs,
      ].slice(0, 300),
    }));
  };

  const addStickyNote = async () => {
    if (!stickyTitle.trim() && !stickyContent.trim()) return;
    setSaving(true);
    const note: WorkspaceStickyNote = {
      id: makeId("note"),
      ownerUserAccountId: settings?.currentUser.userAccountId || undefined,
      ownerTeamMemberId: settings?.currentUser.teamMemberId || undefined,
      ownerName: settings?.currentUser.displayName || settings?.profile.email || "Workspace User",
      title: stickyTitle.trim() || "Quick note",
      content: stickyContent.trim() || "New reminder",
      color: "amber",
      done: false,
      createdAt: new Date().toISOString(),
    };

    try {
      saveLocalStickyNote(note);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes });
      setStickyTitle("");
      setStickyContent("");
      toast.success("Sticky note added");
      try {
        await createStickyNote.mutateAsync(note);
      } catch (remoteError) {
        console.warn("Sticky note server sync skipped after local save", remoteError);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add sticky note");
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (note: WorkspaceStickyNote) => {
    updateWorkspaceData((current) => ({
      ...current,
      stickyNotes: current.stickyNotes.map((item) => item.id === note.id ? { ...item, done: !note.done } : item),
    }));
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes });
    toast.success(note.done ? "Sticky note reopened" : "Sticky note completed");
    try {
      await updateStickyNote.mutateAsync({ id: note.id, done: !note.done });
    } catch (error) {
      console.warn("Sticky note server sync skipped after local update", error);
    }
  };

  const removeNote = async (note: WorkspaceStickyNote) => {
    updateWorkspaceData((current) => ({
      ...current,
      stickyNotes: current.stickyNotes.filter((item) => item.id !== note.id),
    }));
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes });
    toast.success("Sticky note removed");
    try {
      await deleteStickyNote.mutateAsync(note.id);
    } catch (error) {
      console.warn("Sticky note server sync skipped after local remove", error);
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Sticky Notes" subtitle="Notion-style quick notes, reminders, and pinned actions." />
      <div className="space-y-6 p-4 animate-fade-in sm:p-6">
        <PageSection
          title="Sticky Notes Board"
          description="Create, complete, and manage quick notes. Notes are saved locally first so they do not disappear if server sync is delayed."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="glass"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Notes</p><p className="mt-2 text-2xl font-black">{stickyNotes.length}</p></CardContent></Card>
          <Card className="glass"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Open</p><p className="mt-2 text-2xl font-black">{openNotes}</p></CardContent></Card>
          <Card className="glass"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Done</p><p className="mt-2 text-2xl font-black">{doneNotes}</p></CardContent></Card>
        </div>

        <Card className="glass border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4 text-primary" /> Quick Add</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={stickyTitle} onChange={(event) => setStickyTitle(event.target.value)} placeholder="Title" />
            <Textarea value={stickyContent} onChange={(event) => setStickyContent(event.target.value)} placeholder="Reminder, action, or quick note" className="min-h-[110px]" />
            <Button className="gap-2" onClick={addStickyNote} disabled={saving || createStickyNote.isPending || (!stickyTitle.trim() && !stickyContent.trim())}>
              <Plus className="h-4 w-4" /> {saving || createStickyNote.isPending ? "Adding..." : "Add Sticky Note"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedStickyNotes.length === 0 ? (
            <Card className="glass md:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No sticky notes yet. Add your first note above.
              </CardContent>
            </Card>
          ) : (
            sortedStickyNotes.map((note) => (
              <Card key={note.id} className="glass border-amber-200/30 bg-gradient-to-br from-amber-50/40 to-background dark:from-amber-950/10">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pin className="h-3.5 w-3.5 text-amber-500" />
                        <p className={`font-semibold ${note.done ? "line-through text-muted-foreground" : ""}`}>{note.title}</p>
                        {note.done ? <Badge variant="secondary">Done</Badge> : <Badge>Open</Badge>}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "Today"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={note.done ? "outline" : "default"} className="gap-2" onClick={() => void toggleDone(note)}>
                      <CheckSquare className="h-4 w-4" /> {note.done ? "Reopen" : "Done"}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2" onClick={() => void removeNote(note)}>
                      <Trash2 className="h-4 w-4 text-rose-500" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default StickyNotesPage;
