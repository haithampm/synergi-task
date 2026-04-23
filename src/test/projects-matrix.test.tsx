import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Projects from "@/pages/Projects";
import { initialWorkspaceData } from "@/lib/workspace-store";

const data = initialWorkspaceData();
const projects = [
  ...data.projects,
  {
    ...data.projects[0],
    id: "archived-project",
    name: "Archived Legacy Rollout",
    status: "archived" as const,
  },
];
const baseMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(async (value?: unknown) => value),
  isPending: false,
};

vi.mock("recharts", () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    PieChart: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Bar: Mock,
    Pie: Mock,
    Cell: Mock,
  };
});

vi.mock("@/components/layout/AppLayout", () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/AppHeader", () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/layout/PageSection", () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/ai-agent", () => ({
  streamAgentChat: vi.fn(),
}));

vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({ data: projects, isLoading: false }),
  useTasks: () => ({ data: data.tasks }),
  useTickets: () => ({ data: data.tickets }),
  useTeamMembers: () => ({ data: data.teamMembers }),
  useUserAccounts: () => ({ data: data.userAccounts }),
  useChatChannels: () => ({ data: data.chatChannels }),
  useWorkspaceSettings: () => ({ data: data.settings }),
  useWorkflows: () => ({ data: data.workflows }),
  useCreateProject: () => baseMutation,
  useCreateTask: () => baseMutation,
  useUpdateProject: () => baseMutation,
  useDeleteProject: () => baseMutation,
  useCreateChatChannel: () => baseMutation,
  useUpdateChatChannel: () => baseMutation,
  useCreateChatMessage: () => baseMutation,
}));

describe("Projects implementation matrix", () => {
  it("renders an accessible project workspace link for matrix rows", () => {
    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <Projects />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: /open website redesign project workspace/i,
    });

    expect(link).toHaveAttribute("href", "/projects?projectId=1");
    expect(screen.getAllByText(/linked user/i).length).toBeGreaterThan(0);
  });

  it("hides archived projects from the default active view", () => {
    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <Projects />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Archived Legacy Rollout")).not.toBeInTheDocument();
  });
});
