import { useMemo, useState } from "react";
import { CheckSquare, Plus, StickyNote, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateStickyNote, useDeleteStickyNote, useStickyNotes, useUpdateStickyNote, useWorkspaceSettings } from "@/hooks/useProjects";
import { toast } from "sonner";

const StickyNotesPage = () => {
  const { data: settings } = useWorkspaceSettings();
  const { data: stickyNotes = [] } = useStickyNotes();
  const createStickyNote = useCreateStickyNote();
  const updateStickyNote = useUpdateStickyNote();
  const deleteStickyNote = useDeleteStickyNote();
  const [stickyTitle, setStickyTitle] = useState("");
  const [stickyContent, setStickyContent] = useState("");

  const userStickyNotes = useMemo(
    () =>
      stickyNotes.filter((note) => {
        if (settings?.currentUser.userAccountId && note.ownerUserAccountId === settings.currentUser.userAccountId) return true;
        if (settings?.currentUser.teamMemberId && note.ownerTeamMemberId === settings.currentUser.teamMemberId) return true;
        return note.ownerName === settings?.currentUser.displayName;
      }),
    [settings, stickyNotes],
  );

  const addStickyNote = async () => {
    if (!stickyTitle.trim() && !stickyContent.trim()) return;
    await createStickyNote.mutateAsync({
      ownerUserAccountId: settings?.currentUser.userAccountId,
      ownerTeamMemberId: settings?.currentUser.teamMemberId,
      ownerName: settings?.currentUser.displayName ?? "Workspace User",
      title: stickyTitle.trim() || "Quick note",
      content: stickyContent.trim() || "New reminder",
      color: "amber",
      done: false,
    });
    setStickyTitle("");
    setStickyContent("");
    toast.success("Sticky note added");
  };

  return (
    <AppLayout>
      <AppHeader title="Sticky Notes" subtitle="Personal reminders and quick notes in one dedicated workspace page." />
      <div className="space-y-6 p-6 animate-fade-in">
        <PageSection
          title="My Sticky Notes"
          description="Create, complete, and manage your personal notes here only."
        />

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4" /> New Sticky Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={stickyTitle} onChange={(event) => setStickyTitle(event.target.value)} placeholder="Title" />
            <Textarea value={stickyContent} onChange={(event) => setStickyContent(event.target.value)} placeholder="Reminder, action, or quick note" className="min-h-[110px]" />
            <Button className="gap-2" onClick={addStickyNote}>
              <Plus className="h-4 w-4" /> Add Sticky Note
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {userStickyNotes.length === 0 ? (
            <Card className="glass md:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No sticky notes yet. Add your first note above.
              </CardContent>
            </Card>
          ) : (
            userStickyNotes.map((note) => (
              <Card key={note.id} className="glass">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-medium ${note.done ? "line-through text-muted-foreground" : ""}`}>{note.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{note.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={note.done ? "outline" : "default"}
                      className="gap-2"
                      onClick={() => void updateStickyNote.mutateAsync({ id: note.id, done: !note.done })}
                    >
                      <CheckSquare className="h-4 w-4" />
                      {note.done ? "Reopen" : "Done"}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2" onClick={() => void deleteStickyNote.mutateAsync(note.id)}>
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
