import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateWorkspaceDataMock: vi.fn(),
  fetchMergedChatChannelsMock: vi.fn(),
  fetchMergedAuditLogsMock: vi.fn(),
  upsertRemoteChatMessageMock: vi.fn(),
  createRemoteAuditLogMock: vi.fn(),
  upsertRemoteProjectMock: vi.fn(),
  upsertRemoteProjectDocumentsMock: vi.fn(),
}));

let workspaceState = {
  chatChannels: [] as Array<{ id: string; name: string; topic: string; memberIds: string[]; messages: Array<{ id: string; authorName: string; message: string; createdAt: string }>; kind?: "general" | "deliverables" | "announcements"; readOnly?: boolean; quickLinks?: Array<unknown> }>,
  auditLogs: [] as Array<{ id: string; action: string }>,
  settings: {
    currentUser: { displayName: "Admin User" },
    namespace: { slug: "synergi-task" },
  },
};

vi.mock("@/lib/workspace-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-store")>("@/lib/workspace-store");
  return {
    ...actual,
    readWorkspaceData: () => workspaceState,
    updateWorkspaceData: mocks.updateWorkspaceDataMock,
    makeId: vi.fn((prefix: string) => `${prefix}-local`),
  };
});

vi.mock("@/integrations/supabase/workspace-data", () => ({
  checkSupabaseConnection: vi.fn(),
  createRemoteAuditLog: mocks.createRemoteAuditLogMock,
  deleteRemoteTicket: vi.fn(),
  deleteRemoteStickyNote: vi.fn(),
  deleteRemoteProject: vi.fn(),
  deleteRemoteTask: vi.fn(),
  fetchMergedAuditLogs: mocks.fetchMergedAuditLogsMock,
  fetchMergedChatChannels: mocks.fetchMergedChatChannelsMock,
  fetchMergedDashboards: vi.fn(async () => []),
  fetchMergedMeetings: vi.fn(async () => []),
  fetchMergedPersonalEvents: vi.fn(async () => []),
  fetchMergedProjectTemplates: vi.fn(async () => []),
  fetchMergedProjects: vi.fn(async () => []),
  fetchMergedReportTemplates: vi.fn(async () => []),
  fetchMergedStickyNotes: vi.fn(async () => []),
  fetchMergedTasks: vi.fn(async () => []),
  fetchMergedTeamMembers: vi.fn(async () => []),
  fetchMergedTickets: vi.fn(async () => []),
  fetchMergedUserAccounts: vi.fn(async () => []),
  fetchMergedWorkflows: vi.fn(async () => []),
  generatePersistentEntityId: vi.fn((prefix: string) => `${prefix}-persisted`),
  isSupabaseReady: vi.fn(() => true),
  mergeSettingsWithRemoteContext: vi.fn(async (settings: unknown) => settings),
  syncRemoteWorkspaceState: vi.fn(),
  syncWorkspaceSettings: vi.fn(),
  syncWorkspaceUserAccount: vi.fn(),
  upsertRemoteChatChannel: vi.fn(),
  upsertRemoteChatMessage: mocks.upsertRemoteChatMessageMock,
  upsertRemoteDashboard: vi.fn(),
  upsertRemoteMeeting: vi.fn(),
  upsertRemotePersonalEvent: vi.fn(),
  upsertRemoteProject: mocks.upsertRemoteProjectMock,
  upsertRemoteProjectDocuments: mocks.upsertRemoteProjectDocumentsMock,
  upsertRemoteStickyNote: vi.fn(),
  upsertRemoteTask: vi.fn(),
  upsertRemoteTicket: vi.fn(),
  upsertRemoteTeamMember: vi.fn(),
}));

import { useCreateChatMessage, useImportWorkspaceData } from "@/hooks/useProjects";

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

describe("useProjects DB-first mutations", () => {
  beforeEach(() => {
    workspaceState = {
      chatChannels: [],
      auditLogs: [],
      settings: {
        currentUser: { displayName: "Admin User" },
        namespace: { slug: "synergi-task" },
      },
    };

    vi.clearAllMocks();
    mocks.updateWorkspaceDataMock.mockImplementation((updater: (current: typeof workspaceState) => typeof workspaceState) => {
      workspaceState = updater(workspaceState);
      return workspaceState;
    });
  });

  it("rejects destructive replace imports when production DB sync is enabled", async () => {
    const { result } = renderHook(() => useImportWorkspaceData(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        entity: "projects",
        mode: "replace",
        records: [{ id: "project-1", name: "Website Redesign" }] as any,
      }),
    ).rejects.toThrow(/replace import is disabled/i);

    expect(mocks.upsertRemoteProjectMock).not.toHaveBeenCalled();
    expect(mocks.upsertRemoteProjectDocumentsMock).not.toHaveBeenCalled();
  });

  it("rehydrates chat messages from canonical remote data after save", async () => {
    mocks.fetchMergedChatChannelsMock.mockResolvedValue([
      {
        id: "channel-1",
        name: "Team Chat",
        topic: "Daily updates",
        memberIds: [],
        messages: [
          {
            id: "chat-persisted",
            authorName: "Admin User",
            message: "Production sync verified",
            createdAt: "2026-04-24T08:00:00.000Z",
          },
        ],
      },
    ]);
    mocks.fetchMergedAuditLogsMock.mockResolvedValue([
      {
        id: "audit-1",
        action: "Chat message posted",
      },
    ]);

    const { result } = renderHook(() => useCreateChatMessage(), {
      wrapper: createWrapper(),
    });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        channelId: "channel-1",
        authorName: "Admin User",
        message: "Production sync verified",
      });
    });

    expect(mocks.upsertRemoteChatMessageMock).toHaveBeenCalled();
    expect(mocks.createRemoteAuditLogMock).toHaveBeenCalled();
    expect(mocks.updateWorkspaceDataMock).toHaveBeenCalled();
    expect(workspaceState.chatChannels[0]?.messages[0]?.id).toBe("chat-persisted");
    expect(response).toMatchObject({ id: "channel-1" });
  });
});
