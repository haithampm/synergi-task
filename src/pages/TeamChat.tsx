import { useMemo, useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import PageSection from "@/components/layout/PageSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useChatChannels,
  useCreateChatChannel,
  useCreateChatMessage,
  useProjects,
  useTeamMembers,
  useWorkspaceSettings,
} from "@/hooks/useProjects";
import { toast } from "sonner";

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const TeamChatPage = () => {
  const [selectedChannelId, setSelectedChannelId] = useState("chat-pmo");
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const [groupChatProjectId, setGroupChatProjectId] = useState("");
  const [groupChatTopic, setGroupChatTopic] = useState("");
  const [chatDraft, setChatDraft] = useState("");

  const { data: settings } = useWorkspaceSettings();
  const { data: members = [] } = useTeamMembers();
  const { data: projects = [] } = useProjects();
  const { data: channels = [] } = useChatChannels();
  const createChatMessage = useCreateChatMessage();
  const createChatChannel = useCreateChatChannel();

  const currentProfileMember = useMemo(
    () =>
      members.find((member) => member.id === settings?.currentUser.teamMemberId) ??
      members.find((member) => normalizeText(member.email) === normalizeText(settings?.profile.email)),
    [members, settings],
  );

  const activeChannel = channels.find((channel) => channel.id === selectedChannelId) ?? channels[0];

  const postMessage = async () => {
    if (!activeChannel || !chatDraft.trim()) return;
    await createChatMessage.mutateAsync({
      channelId: activeChannel.id,
      authorId: currentProfileMember?.id,
      authorName: currentProfileMember?.name ?? settings?.currentUser.displayName ?? "PM Office",
      message: chatDraft.trim(),
    });
    setChatDraft("");
    toast.success("Message posted");
  };

  const createProjectGroupChat = async () => {
    const project = projects.find((item) => item.id === groupChatProjectId);
    if (!project) {
      toast.error("Select a project first");
      return;
    }

    const existing = channels.find((channel) => channel.projectId === project.id && (channel.kind ?? "general") === "general");
    if (existing) {
      setSelectedChannelId(existing.id);
      setGroupChatOpen(false);
      toast.success("Opened the existing project group chat");
      return;
    }

    const assignedMembers = members.filter((member) => (member.assignedProjectIds ?? []).includes(project.id));
    const newChannel = await createChatChannel.mutateAsync({
      name: `${project.name} Team Group`,
      topic: groupChatTopic.trim() || `Project group chat for ${project.name}`,
      projectId: project.id,
      kind: "general",
      memberIds: assignedMembers.length ? assignedMembers.map((member) => member.id) : members.slice(0, 6).map((member) => member.id),
      messages: [
        {
          id: `chat-${Date.now()}`,
          authorName: settings?.currentUser.displayName ?? "Team Workspace",
          authorId: currentProfileMember?.id,
          message: `Project team group created for ${project.name}. Use this channel for coordination, document review, and delivery updates.`,
          createdAt: new Date().toISOString(),
          pinned: true,
        },
      ],
      quickLinks: [
        { id: `${project.id}-docs`, label: "Documents", type: "document", url: `/documents?projectId=${project.id}` },
        { id: `${project.id}-schedule`, label: "Schedule", type: "file", url: `/schedule?projectId=${project.id}` },
      ],
    });

    setSelectedChannelId(newChannel?.id ?? selectedChannelId);
    setGroupChatOpen(false);
    setGroupChatProjectId("");
    setGroupChatTopic("");
    toast.success("Project team group chat created");
  };

  return (
    <AppLayout>
      <AppHeader title="Team Chat" subtitle="Dedicated communication workspace for channels, updates, and project group chat." />
      <div className="space-y-6 p-6 animate-fade-in">
        <PageSection
          title="Team Communication"
          description="Project channels and team chat live here only."
          actions={
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setGroupChatOpen(true)}>
              <Plus className="h-4 w-4" /> Create Project Group
            </Button>
          }
        />

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Channel Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="min-h-[360px] space-y-3 overflow-y-auto rounded-xl border bg-card/40 p-4">
              {activeChannel?.messages.length ? (
                activeChannel.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border bg-background/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{message.authorName}</p>
                      <span className="text-[10px] text-muted-foreground">{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-1 text-sm">{message.message}</p>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">No messages in this channel yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <Textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Send update to the channel..." className="min-h-[120px]" />
              <Button className="w-full gap-2 gradient-primary text-primary-foreground" onClick={postMessage}>
                <Send className="h-4 w-4" /> Post Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={groupChatOpen} onOpenChange={setGroupChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project Group Chat</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={groupChatProjectId} onValueChange={setGroupChatProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Channel Topic</Label>
              <Textarea value={groupChatTopic} onChange={(event) => setGroupChatTopic(event.target.value)} placeholder="Coordination, deliverables, blockers, and project updates" className="min-h-[96px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupChatOpen(false)}>Cancel</Button>
            <Button onClick={createProjectGroupChat}>Create Group Chat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeamChatPage;
