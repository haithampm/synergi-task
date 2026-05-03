import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateWorkspace, workspaceKeys } from "@/hooks/useProjects";
import { isSupabaseReady } from "@/integrations/supabase/workspace-data";

const CASCADE_REFRESH_DEBOUNCE_MS = 800;
const ACTIVE_SYNC_INTERVAL_MS = 120_000;
const MIN_REFRESH_GAP_MS = 5_000;

const workspaceMutationKeywords = [
  "project",
  "task",
  "ticket",
  "team",
  "member",
  "resource",
  "meeting",
  "schedule",
  "sticky",
  "document",
  "dashboard",
  "timesheet",
  "workflow",
  "report",
  "setting",
];

const isWorkspaceRelatedMutation = (mutation: any) => {
  const key = mutation?.options?.mutationKey;
  const name = Array.isArray(key) ? key.join("-") : String(key ?? "");
  const metaName = String(mutation?.options?.meta?.entity ?? mutation?.options?.meta?.workspaceEntity ?? "");
  const mutationName = `${name}-${metaName}`.toLowerCase();
  if (!mutationName || mutationName === "-") return true;
  return workspaceMutationKeywords.some((keyword) => mutationName.includes(keyword));
};

export const useWorkspaceDataBridge = () => {
  const queryClient = useQueryClient();
  const lastRefreshAtRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof window.setTimeout> | null = null;
    let interval: ReturnType<typeof window.setInterval> | null = null;

    const notify = (status: string, reason: string) => {
      window.dispatchEvent(
        new CustomEvent("workspace-sync-status", {
          detail: { source: "workspace-data-bridge", status, reason, syncedAt: status === "synced" ? new Date().toISOString() : undefined },
        }),
      );
    };

    const refreshLinkedWorkspaceData = (reason: string, immediate = false) => {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);

      const run = () => {
        if (cancelled) return;
        const now = Date.now();
        if (runningRef.current || now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) return;

        runningRef.current = true;
        lastRefreshAtRef.current = now;
        notify("syncing", reason);

        void Promise.all([
          invalidateWorkspace(queryClient),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.projects }),
          queryClient.invalidateQueries({ queryKey: ["tasks"] }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.team }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.tickets }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.meetings }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.stickyNotes }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboards }),
          queryClient.invalidateQueries({ queryKey: workspaceKeys.reports }),
        ])
          .then(() => notify("synced", reason))
          .catch(() => notify("error", reason))
          .finally(() => {
            runningRef.current = false;
          });
      };

      if (immediate) run();
      else timer = window.setTimeout(run, CASCADE_REFRESH_DEBOUNCE_MS);
    };

    const unsubscribeMutationCache = queryClient.getMutationCache().subscribe((event: any) => {
      const mutation = event?.mutation;
      const status = mutation?.state?.status;
      if (status === "success" && isWorkspaceRelatedMutation(mutation)) {
        refreshLinkedWorkspaceData("mutation-success", true);
        try {
          window.localStorage.setItem("synergi-workspace-sync", String(Date.now()));
        } catch {
          // Storage can be unavailable in private mode; realtime/polling still handles sync.
        }
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "synergi-workspace-sync") refreshLinkedWorkspaceData("cross-tab-update");
    };
    const handleManualRefresh = () => refreshLinkedWorkspaceData("manual-workspace-refresh", true);
    const handleWorkspaceSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.source === "workspace-data-bridge") return;
      if (detail?.status === "live" || detail?.reason === "remote-change") {
        refreshLinkedWorkspaceData(`realtime-${detail.reason ?? "remote-change"}`);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("workspace-data-changed", handleManualRefresh);
    window.addEventListener("workspace-sync-status", handleWorkspaceSyncStatus);

    interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && isSupabaseReady()) {
        refreshLinkedWorkspaceData("background-health-refresh");
      }
    }, ACTIVE_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
      unsubscribeMutationCache();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("workspace-data-changed", handleManualRefresh);
      window.removeEventListener("workspace-sync-status", handleWorkspaceSyncStatus);
    };
  }, [queryClient]);
};
