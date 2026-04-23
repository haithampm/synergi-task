import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar from "@/components/layout/AppSidebar";
import { initialWorkspaceData } from "@/lib/workspace-store";

const baseData = initialWorkspaceData();
const signOut = vi.fn();
const updateSettings = {
  mutateAsync: vi.fn(async () => undefined),
};

let mockSettings = structuredClone(baseData.settings);
let mockUserAccounts = structuredClone(baseData.userAccounts);
let mockUser = { email: "admin@company.com" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    signOut,
  }),
}));

vi.mock("@/hooks/useProjects", () => ({
  useWorkspaceSettings: () => ({ data: mockSettings }),
  useUserAccounts: () => ({ data: mockUserAccounts }),
  useUpdateWorkspaceSettings: () => updateSettings,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    mockSettings = structuredClone(baseData.settings);
    mockUserAccounts = structuredClone(baseData.userAccounts);
    mockUser = { email: "admin@company.com" };
    signOut.mockReset();
    updateSettings.mutateAsync.mockClear();
  });

  it("shows the current account details in the sidebar footer", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("admin@company.com")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });

  it("hides admin-only controls for viewer accounts while keeping dashboard navigation", () => {
    const viewerAccount = mockUserAccounts.find((account) => account.id !== "user-admin");
    expect(viewerAccount).toBeDefined();

    mockSettings.currentUser.roleId = "viewer";
    mockSettings.currentUser.userAccountId = viewerAccount?.id ?? "";
    mockUser = { email: viewerAccount?.email ?? "" };
    mockUserAccounts = mockUserAccounts.map((account) =>
      account.id === viewerAccount?.id
        ? { ...account, roleId: "viewer" }
        : account,
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User Accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
