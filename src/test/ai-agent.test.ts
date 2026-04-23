import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamAgentChat } from "@/lib/ai-agent";
import { initialWorkspaceData } from "@/lib/workspace-store";

const workspace = initialWorkspaceData();

vi.mock("@/integrations/supabase/workspace-data", () => ({
  fetchMergedProjects: vi.fn(async () => workspace.projects),
  fetchMergedTasks: vi.fn(async () => workspace.tasks),
  fetchMergedTickets: vi.fn(async () => workspace.tickets),
  fetchMergedTeamMembers: vi.fn(async () => workspace.teamMembers),
  fetchMergedUserAccounts: vi.fn(async () => workspace.userAccounts),
  fetchMergedStickyNotes: vi.fn(async () => workspace.stickyNotes),
  fetchMergedChatChannels: vi.fn(async () => workspace.chatChannels),
  fetchMergedDashboards: vi.fn(async () => workspace.dashboards),
  fetchMergedMeetings: vi.fn(async () => workspace.meetings),
  fetchMergedPersonalEvents: vi.fn(async () => workspace.personalEvents),
  mergeSettingsWithRemoteContext: vi.fn(async () => workspace.settings),
}));

vi.mock("@/lib/workspace-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-store")>("@/lib/workspace-store");
  return {
    ...actual,
    readWorkspaceData: () => workspace,
  };
});

describe("AI agent grounding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers from persisted workspace data when remote AI is unavailable", async () => {
    let answer = "";

    await streamAgentChat({
      messages: [{ role: "user", content: "find sample full cycle" }],
      onDelta: (chunk) => {
        answer += chunk;
      },
      onDone: () => undefined,
    });

    expect(answer).toContain("Sample Full Cycle Program");
    expect(answer).toContain("Workspace search results");
  });
});
