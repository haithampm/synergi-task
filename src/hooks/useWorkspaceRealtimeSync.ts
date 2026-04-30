import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateWorkspace } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRemoteWorkspaceContext,
  isSupabaseReady,
} from "@/integrations/supabase/workspace-data";

const LIVE_SYNC_POLL_INTERVAL_MS = 30_000;
const LIVE_SYNC_DEBOUNCE_MS = 650;

const buildWorkspaceRealtimeSources = (
  workspaceId: string,
  authUserId?: string | null,
) => {
  const sources: Array<{ filter: string; table: string }> = [
    { table: "workspaces", filter: `id=eq.${workspaceId}` },
    { table: "workspace_memberships", filter: `workspace_id=eq.${workspaceId}` },
    { table: "projects", filter: `workspace_id=eq.${workspaceId}` },
    { table: "project_documents", filter: `workspace_id=eq.${workspaceId}` },
    { table: "tasks", filter: `workspace_id=eq.${workspaceId}` },
    { table: "tickets", filter: `workspace_id=eq.${workspaceId}` },
    { table: "team_members", filter: `workspace_id=eq.${workspaceId}` },
    { table: "meetings", filter: `workspace_id=eq.${workspaceId}` },
    { table: "personal_events", filter: `workspace_id=eq.${workspaceId}` },
    { table: "sticky_notes", filter: `workspace_id=eq.${workspaceId}` },
    { table: "workflows", filter: `workspace_id=eq.${workspaceId}` },
    { table: "dashboards", filter: `workspace_id=eq.${workspaceId}` },
    { table: "chat_channels", filter: `workspace_id=eq.${workspaceId}` },
    { table: "project_documents", filter: `workspace_id=eq.${workspaceId}` },
    { table: "workspace_integrations", filter: `workspace_id=eq.${workspaceId}` },
    { table: "custom_fields", filter: `workspace_id=eq.${workspaceId}` },
    { table: "audit_events", filter: `workspace_id=eq.${workspaceId}` },
  ];

  if (authUserId) {
    sources.push({ table: "profiles", filter: `user_id=eq.${authUserId}` });
    sources.push({ table: "user_roles", filter: `user_id=eq.${authUserId}` });
  }

  return sources.filter(
    (source, index, list) =>
      list.findIndex((item) => item.table === source.table && item.filter === source.filter) === index,
  );
};

export const useWorkspaceRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseReady()) return undefined;

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof window.setTimeout> | null = null;
    let pollTimer: ReturnType<typeof window.setInterval> | null = null;

    const refreshWorkspace = (reason: string, immediate = false) => {
      if (cancelled) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);

      const runRefresh = () => {
        if (cancelled) return;
        window.dispatchEvent(
          new CustomEvent("workspace-sync-status", {
            detail: { reason, status: "syncing" },
          }),
        );

        void invalidateWorkspace(queryClient).finally(() => {
          if (cancelled) return;
          window.dispatchEvent(
            new CustomEvent("workspace-sync-status", {
              detail: { reason, status: "synced", syncedAt: new Date().toISOString() },
            }),
          );
        });
      };

      if (immediate) {
        runRefresh();
        return;
      }

      refreshTimer = window.setTimeout(runRefresh, LIVE_SYNC_DEBOUNCE_MS);
    };

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
          () => refreshWorkspace(`database:${source.table}`),
        );
      }

      activeChannel = channel;
      await channel.subscribe((status) => {
        if (cancelled) return;
        window.dispatchEvent(
          new CustomEvent("workspace-sync-status", {
            detail: { status: status === "SUBSCRIBED" ? "live" : "connecting", reason: "realtime" },
          }),
        );
        if (status === "SUBSCRIBED") refreshWorkspace("realtime-connected", true);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshWorkspace("window-focus", true);
      }
    };

    const handleOnline = () => refreshWorkspace("network-online", true);
    const handleFocus = () => refreshWorkspace("window-focus", true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshWorkspace("polling-refresh");
      }
    }, LIVE_SYNC_POLL_INTERVAL_MS);

    void subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      if (activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    };
  }, [queryClient]);
};
