import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceAccessBootstrap } from "@/hooks/useWorkspaceAccessBootstrap";

const mocks = vi.hoisted(() => ({
  ensureRemoteWorkspaceMembership: vi.fn(),
  fetchRemoteWorkspaceContext: vi.fn(),
  syncWorkspaceSettings: vi.fn(),
  invalidateWorkspace: vi.fn(),
}));

const seededSettings = {
  profile: { firstName: "Haitham", lastName: "Elmohamady", email: "haitham.pm@gmail.com" },
  currentUser: { displayName: "Haitham Elmohamady", roleId: "admin" },
};

vi.mock("@/integrations/supabase/workspace-data", () => ({
  ensureRemoteWorkspaceMembership: mocks.ensureRemoteWorkspaceMembership,
  fetchRemoteWorkspaceContext: mocks.fetchRemoteWorkspaceContext,
  isSupabaseReady: vi.fn(() => true),
  syncWorkspaceSettings: mocks.syncWorkspaceSettings,
}));

vi.mock("@/hooks/useProjects", () => ({
  invalidateWorkspace: mocks.invalidateWorkspace,
}));

vi.mock("@/lib/workspace-store", () => ({
  readWorkspaceData: () => ({
    settings: seededSettings,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useWorkspaceAccessBootstrap", () => {
  it("seeds canonical workspace settings after creating the first production workspace", async () => {
    mocks.ensureRemoteWorkspaceMembership.mockResolvedValue({
      status: "created",
      workspaceId: "workspace-1",
      role: "organization_admin",
    });
    mocks.fetchRemoteWorkspaceContext.mockResolvedValue({
      membership: { workspace_id: "workspace-1" },
      workspace: { id: "workspace-1" },
    });
    mocks.syncWorkspaceSettings.mockResolvedValue(seededSettings);
    mocks.invalidateWorkspace.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useWorkspaceAccessBootstrap({
          id: "user-1",
          email: "haitham.pm@gmail.com",
        } as never),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mocks.syncWorkspaceSettings).toHaveBeenCalledWith(seededSettings);
    expect(mocks.invalidateWorkspace).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
