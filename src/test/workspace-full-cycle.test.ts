import { describe, expect, it } from "vitest";
import { initialWorkspaceData } from "@/lib/workspace-store";

describe("workspace full cycle sample scenario", () => {
  it("includes one cross-linked sample program across core PM modules", () => {
    const data = initialWorkspaceData();
    const projectId = "sample-full-cycle-program";

    const project = data.projects.find((item) => item.id === projectId);
    expect(project).toBeDefined();
    expect(project?.documents?.length).toBeGreaterThanOrEqual(3);
    expect(project?.resources?.length).toBeGreaterThanOrEqual(3);
    expect(project?.stakeholders?.length).toBeGreaterThanOrEqual(2);
    expect(project?.customFieldValues?.["project-sponsor"]).toBe("Admin User");

    const projectTasks = data.tasks.filter((task) => (task.project_id ?? task.projectId) === projectId);
    expect(projectTasks).toHaveLength(4);
    expect(projectTasks.some((task) => task.isMilestone)).toBe(true);
    expect(projectTasks.some((task) => (task.timesheetEntries?.length ?? 0) > 0)).toBe(true);
    expect(projectTasks.every((task) => task.projectName === project?.name)).toBe(true);

    const ticket = data.tickets.find((item) => item.projectId === projectId);
    expect(ticket).toBeDefined();
    expect(ticket?.taskId).toBeTruthy();
    expect(projectTasks.some((task) => task.id === ticket?.taskId)).toBe(true);
    expect(ticket?.customFieldValues?.["ticket-source"]).toBe("Portal");

    const channel = data.chatChannels.find((item) => item.projectId === projectId && item.id === "chat-sample-full-cycle");
    expect(channel).toBeDefined();
    expect(channel?.quickLinks?.length).toBeGreaterThanOrEqual(3);
    expect(channel?.messages.some((message) => message.pinned)).toBe(true);

    const meeting = data.meetings.find((item) => item.projectId === projectId);
    expect(meeting).toBeDefined();
    expect(meeting?.channelId).toBe(channel?.id);

    const stickyNote = data.stickyNotes.find((item) => item.id === "note-sample-full-cycle");
    expect(stickyNote).toBeDefined();
    expect(stickyNote?.content).toContain("Sample Full Cycle Program");

    const personalEvent = data.personalEvents.find((item) => item.id === "event-sample-full-cycle-focus");
    expect(personalEvent).toBeDefined();
    expect(channel?.memberIds.includes(personalEvent?.memberId ?? "")).toBe(true);

    const auditLog = data.auditLogs.find((item) => item.entityId === projectId);
    expect(auditLog?.action).toBe("project.sampleScenarioLoaded");
  });
});
