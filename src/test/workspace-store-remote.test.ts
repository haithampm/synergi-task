import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialWorkspaceData, readWorkspaceData } from "@/lib/workspace-store";

const STORAGE_KEY = "synergi-workspace-data";
const STORAGE_META_KEY = "synergi-workspace-data-meta";

describe("workspace storage in connected mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("VITE_SUPABASE_URL", "https://jmumywuugtrxqmpidaab.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("drops legacy seeded browser data when Supabase is configured", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialWorkspaceData()));

    const hydrated = readWorkspaceData();

    expect(hydrated.projects).toEqual([]);
    expect(hydrated.tasks).toEqual([]);
    expect(hydrated.teamMembers).toEqual([]);
    expect(hydrated.tickets).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_META_KEY) ?? "{}")).toMatchObject({
      remoteSchemaVersion: "remote-cache-v1",
    });
  });
});
