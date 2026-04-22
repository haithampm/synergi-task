import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateWorkspace } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRemoteWorkspaceContext,
  isSupabaseReady,
} from "@/integrations/supabase/workspace-data";

const buildWorkspaceRealtimeSources = (
  workspaceId: string,
  authUserId?: string | null,
) => {
  const sources: Array<{ filter: string; table: string }> = [
    { table: "projects", filter: `workspace_id=eq.${workspaceId}` },
    { table: "project_documents", filter: `workspace_id=eq.${workspaceId}` },
    { table: "tasks", filter: `workspace_id=eq.${workspaceId}` },
    { table: "team_members", filter: `workspace_id=eq.${workspaceId}` },
    { table: "meetings", filter: `workspace_id=eq.${workspaceId}` },
    { table: "personal_events", filter: `workspace_id=eq.${workspaceId}` },
    { table: "sticky_notes", filter: `workspace_id=eq.${workspaceId}` },
    { table: "workspace_memberships", filter: `workspace_id=eq.${workspaceId}` },
    { table: "workspaces", filter: `id=eq.${workspaceId}` },
  ];

  if (authUserId) {
    sources.push({ table: "profiles", filter: `user_id=eq.${authUserId}` });
  }

  return sources;
};

export const useWorkspaceRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseReady()) return undefined;

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const subscribe = async () => {
      const context = await fetchRemoteWorkspaceContext();
      if (cancelled) return;

      const workspaceId = context?.membership?.workspace_id ?? context?.workspace?.id ?? null;
      const authUserId = context?.profile?.user_id ?? null;
      if (!workspaceId) return;

      let channel = supabase.channel(`workspace-live-sync:${workspaceId}`);
      for (const source of buildWorkspaceRealtimeSources(workspaceId, authUserId)) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            filter: source.filter,
            schema: "public",
            table: source.table,
          },
          () => {
            void invalidateWorkspace(queryClient);
          },
        );
      }

      activeChannel = channel;
      await channel.subscribe();
    };

    void subscribe();

    return () => {
      cancelled = true;
      if (activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    };
  }, [queryClient]);
};
