import { useMemo, useState } from "react";
import { CheckSquare, Palette, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
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

type StickyColor = "amber" | "sky" | "emerald" | "rose";

const noteColorOptions: Array<{ value: StickyColor; label: string; dot: string; card: string; icon: string; badge: string }> = [
  {
    value: "amber",
    label: "Amber",
    dot: "bg-amber-400",
    card: "border-amber-200/70 bg-gradient-to-br from-amber-50 via-yellow-50/70 to-background dark:border-amber-800/40 dark:from-amber-950/35 dark:via-yellow-950/10 dark:to-background",
    icon: "text-amber-600 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800",
  },
  {
    value: "sky",
    label: "Sky",
    dot: "bg-sky-400",
    card: "border-sky-200/70 bg-gradient-to-br from-sky-50 via-cyan-50/70 to-background dark:border-sky-800/40 dark:from-sky-950/35 dark:via-cyan-950/10 dark:to-background",
    icon: "text-sky-600 dark:text-sky-300",
    badge: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800",
  },
  {
    value: "emerald",
    label: "Emerald",
    dot: "bg-emerald-400",
    card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-lime-50/70 to-background dark:border-emerald-800/40 dark:from-emerald-950/35 dark:via-lime-950/10 dark:to-background",
    icon: "text-emerald-600 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800",
  },
  {
    value: "rose",
    label: "Rose",
    dot: "bg-rose-400",
    card: "border-rose-200/70 bg-gradient-to-br from-rose-50 via-pink-50/70 to-background dark:border-rose-800/40 dark:from-rose-950/35 dark:via-pink-950/10 dark:to-background",
    icon: "text-rose-600 dark:text-rose-300",
    badge: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800",
  },
];

const getNoteColor = (color?: string) => noteColorOptions.find((item) => item.value === color) ?? noteColorOptions[0];

const StickyNotesPage = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useWorkspaceSettings();
  const { data: stickyNotes = [] } = useStickyNotes();
  const createStickyNote = useCreateStickyNote();
  const updateStickyNote = useUpdateStickyNote();
  const deleteStickyNote = useDeleteStickyNote();
  const [stickyTitle, setStickyTitle] = useState("");
  const [stickyContent, setStickyContent] = useState("");
  const [stickyColor, setStickyColor] = useState<StickyColor>("amber");
  const [saving, setSaving] = useState(false);

  const sortedStickyNotes = useMemo(
    () => [...stickyNotes].sort((a, b) => Number(a.done) - Number(b.done) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
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
      color: stickyColor,
      done: false,
      createdAt: new Date().toISOString(),
    };

    try {
      saveLocalStickyNote(note);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes });
      setStickyTitle("");
      setStickyContent("");
      toast.success("Colorful sticky note added");
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

  const updateNoteColor = async (note: WorkspaceStickyNote, color: StickyColor) => {
    updateWorkspaceData((current) => ({
      ...current,
      stickyNotes: current.stickyNotes.map((item) => item.id === note.id ? { ...item, color } : item),
    }));
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes });
    toast.success("Sticky note color updated");
    try {
      await updateStickyNote.mutateAsync({ id: note.id, color });
    } catch (error) {
      console.warn("Sticky note color server sync skipped after local update", error);
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
      <AppHeader title="Sticky Notes" subtitle="Colorful Notion-style quick notes, reminders, and pinned actions." />
      <div className="space-y-6 p-4 animate-fade-in sm:p-6">
        <PageSection
          title="Colorful Sticky Notes Board"
          description="Create, complete, and manage quick notes with colorful cards. Notes are saved locally first so they do not disappear if server sync is delayed."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="glass border-sky-200/40 bg-gradient-to-br from-sky-50/60 to-background dark:from-sky-950/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Notes</p><p className="mt-2 text-2xl font-black">{stickyNotes.length}</p></CardContent></Card>
          <Card className="glass border-emerald-200/40 bg-gradient-to-br from-emerald-50/60 to-background dark:from-emerald-950/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Open</p><p className="mt-2 text-2xl font-black">{openNotes}</p></CardContent></Card>
          <Card className="glass border-amber-200/40 bg-gradient-to-br from-amber-50/60 to-background dark:from-amber-950/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Done</p><p className="mt-2 text-2xl font-black">{doneNotes}</p></CardContent></Card>
        </div>

        <Card className={`glass border-primary/20 ${getNoteColor(stickyColor).card}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><StickyNote className={`h-4 w-4 ${getNoteColor(stickyColor).icon}`} /> Quick Add</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={stickyTitle} onChange={(event) => setStickyTitle(event.target.value)} placeholder="Title" className="bg-background/80" />
            <Textarea value={stickyContent} onChange={(event) => setStickyContent(event.target.value)} placeholder="Reminder, action, or quick note" className="min-h-[110px] bg-background/80" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><Palette className="h-3.5 w-3.5" /> Color</span>
              {noteColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStickyColor(option.value)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${stickyColor === option.value ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-background/70 text-muted-foreground"}`}
                >
                  <span className={`h-3 w-3 rounded-full ${option.dot}`} />
                  {option.label}
                </button>
              ))}
            </div>
            <Button className="gap-2" onClick={addStickyNote} disabled={saving || createStickyNote.isPending || (!stickyTitle.trim() && !stickyContent.trim())}>
              <Plus className="h-4 w-4" /> {saving || createStickyNote.isPending ? "Adding..." : "Add Colorful Sticky Note"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedStickyNotes.length === 0 ? (
            <Card className="glass md:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No sticky notes yet. Add your first colorful note above.
              </CardContent>
            </Card>
          ) : (
            sortedStickyNotes.map((note) => {
              const color = getNoteColor(note.color);
              return (
                <Card key={note.id} className={`group overflow-hidden border-2 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${color.card} ${note.done ? "opacity-75" : ""}`}>
                  <div className={`h-1.5 ${color.dot}`} />
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pin className={`h-3.5 w-3.5 ${color.icon}`} />
                          <p className={`font-semibold ${note.done ? "line-through text-muted-foreground" : ""}`}>{note.title}</p>
                          {note.done ? <Badge variant="secondary">Done</Badge> : <Badge className={color.badge}>Open</Badge>}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/75">{note.content}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "Today"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                      <Button size="sm" variant={note.done ? "outline" : "default"} className="gap-2" onClick={() => void toggleDone(note)}>
                        <CheckSquare className="h-4 w-4" /> {note.done ? "Reopen" : "Done"}
                      </Button>
                      <div className="flex items-center gap-1">
                        {noteColorOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            title={`Change to ${option.label}`}
                            onClick={() => void updateNoteColor(note, option.value)}
                            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${option.dot} ${note.color === option.value ? "border-primary ring-2 ring-primary/20" : "border-background"}`}
                          />
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" className="gap-2" onClick={() => void removeNote(note)}>
                        <Trash2 className="h-4 w-4 text-rose-500" /> Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default StickyNotesPage;
