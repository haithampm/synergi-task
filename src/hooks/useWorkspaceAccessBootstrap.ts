import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { invalidateWorkspace } from "@/hooks/useProjects";
import {
  ensureRemoteWorkspaceMembership,
  fetchRemoteWorkspaceContext,
  isSupabaseReady,
  syncWorkspaceSettings,
} from "@/integrations/supabase/workspace-data";
import { readWorkspaceData } from "@/lib/workspace-store";

type WorkspaceAccessBootstrapState = {
  error: string | null;
  loading: boolean;
};

const needsWorkspaceSeed = (branding: unknown) => {
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
    return true;
  }

  const record = branding as Record<string, unknown>;
  return !Array.isArray(record.privilegeRoles) || !Array.isArray(record.integrations);
};

export const useWorkspaceAccessBootstrap = (user: User | null): WorkspaceAccessBootstrapState => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<WorkspaceAccessBootstrapState>({
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!user || !isSupabaseReady()) {
      setState({ loading: false, error: null });
      return;
    }

    let cancelled = false;

    const run = async () => {
      setState({ loading: true, error: null });
      try {
        const result = await ensureRemoteWorkspaceMembership();
        if (cancelled) return;

        const context = await fetchRemoteWorkspaceContext();
        if (!context?.membership?.workspace_id) {
          setState({
            loading: false,
            error:
              result.message ??
              "This signed-in account is not linked to a workspace yet. Ask the workspace owner to link your account.",
          });
          return;
        }

        if (result.status === "created" || needsWorkspaceSeed(context.workspace?.branding)) {
          await syncWorkspaceSettings(readWorkspaceData().settings);
        }

        await invalidateWorkspace(queryClient);
        if (!cancelled) {
          setState({ loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Failed to connect this account to the workspace.",
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [queryClient, user]);

  return state;
};
