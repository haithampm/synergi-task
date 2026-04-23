import { hasArabicText } from "@/lib/i18n";
import { readWorkspaceData } from "@/lib/workspace-store";
import { getWorkspaceSearchResults } from "@/lib/workspace-search";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;
const REMOTE_AI_ENABLED = import.meta.env.VITE_ENABLE_REMOTE_AI === "true";

const localResponse = (messages: Msg[]) => {
  const latest = messages[messages.length - 1]?.content ?? "";
  const prompt = latest.toLowerCase();
  const {
    projects,
    tasks,
    tickets,
    teamMembers,
    userAccounts,
    stickyNotes,
    chatChannels,
    workflows,
    reportTemplates,
    dashboards,
    meetings,
    personalEvents,
    projectTemplates,
    auditLogs,
    settings,
  } =
    readWorkspaceData();
  const includesAny = (...keywords: string[]) => keywords.some((keyword) => prompt.includes(keyword));
  const projectDocs = projects.flatMap((project) => (project.documents ?? []).map((document) => ({ project, document })));
  const arabic = settings.appearance.language === "ar" || hasArabicText(latest);

  const text = {
    noSearch:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0645\u0637\u0627\u0628\u0642\u0629 \u0641\u064a \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u0623\u0648 \u0627\u0644\u0645\u0647\u0627\u0645 \u0623\u0648 \u0627\u0644\u062a\u0630\u0627\u0643\u0631 \u0623\u0648 \u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0623\u0648 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0641\u0631\u064a\u0642.",
    noDocs:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0645\u0634\u0627\u0631\u064a\u0639 \u0645\u062d\u0641\u0648\u0638\u0629 \u0628\u0639\u062f. \u0623\u0646\u0634\u0626 \u0645\u0634\u0631\u0648\u0639\u064b\u0627 \u0623\u0648 \u062d\u062f\u0651\u062b\u0647 \u062b\u0645 \u0627\u0633\u062a\u062e\u062f\u0645 \u062a\u0648\u0644\u064a\u062f \u062d\u0632\u0645\u0629 PMI.",
    searchIntro: "\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0646\u0638\u0627\u0645:",
    docsIntro: "\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u0641\u064a \u0627\u0644\u0646\u0638\u0627\u0645:",
    overview:
      "\u0645\u0644\u062e\u0635 \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644: ",
    risksNone:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062e\u0627\u0637\u0631 \u0643\u0628\u064a\u0631\u0629 \u0645\u0633\u062c\u0644\u0629 \u062d\u0627\u0644\u064a\u064b\u0627.",
    planIntro: "\u062e\u0637\u0629 \u062a\u0646\u0641\u064a\u0630 \u0645\u0642\u062a\u0631\u062d\u0629:",
    teamIntro: "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0641\u0631\u064a\u0642 \u0648\u0627\u0644\u0645\u0648\u0627\u0631\u062f:",
    help:
      "\u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0644\u0628\u062d\u062b \u0641\u064a \u062c\u0645\u064a\u0639 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u062a\u0644\u062e\u064a\u0635 \u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u0648\u0627\u0644\u0645\u062e\u0627\u0637\u0631 \u0648\u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0648\u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0648\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631.",
  };

  if (includesAny("search", "find", "show", "lookup", "locate", "\u0627\u0628\u062d\u062b", "\u0627\u0639\u062b\u0631", "\u0623\u0638\u0647\u0631", "\u0627\u0638\u0647\u0631")) {
    const results = getWorkspaceSearchResults(latest);
    if (!results.length) {
      return arabic
        ? text.noSearch
        : "No matching records were found in projects, tasks, tickets, user accounts, documents, team, dashboards, workflows, or reports.";
    }

    return [
      arabic ? text.searchIntro : "Workspace search results:",
      ...results.slice(0, 12).map((result) => `- ${result.title} | ${result.subtitle}`),
    ].join("\n");
  }

  if (includesAny("document", "charter", "brd", "scope", "schedule plan", "template", "\u0645\u0633\u062a\u0646\u062f", "\u0645\u064a\u062b\u0627\u0642", "\u0646\u0637\u0627\u0642", "\u0642\u0627\u0644\u0628")) {
    if (!projectDocs.length) {
      return arabic ? text.noDocs : "No project documents are stored yet. Create or update a project and generate the PMI package first.";
    }

    return [
      arabic ? text.docsIntro : "Project documents in the workspace:",
      ...projectDocs.slice(0, 8).map(({ project, document }) => `- ${document.name} | ${project.name} | ${document.generated ? "generated" : "uploaded"}`),
    ].join("\n");
  }

  if (includesAny("calendar", "meeting", "agenda", "event", "outlook", "teams", "\u062a\u0642\u0648\u064a\u0645", "\u0627\u062c\u062a\u0645\u0627\u0639", "\u062d\u062f\u062b", "\u0623\u0648\u062a\u0644\u0648\u0643", "\u062a\u064a\u0645\u0632")) {
    const meetingSummary = meetings
      .slice(0, 6)
      .map((meeting) => `- ${meeting.title} | ${meeting.provider} | ${new Date(meeting.startsAt).toLocaleString()}`)
      .join("\n");
    const personalSummary = personalEvents
      .slice(0, 4)
      .map((event) => `- ${event.title} | ${new Date(event.startsAt).toLocaleString()}`)
      .join("\n");

    return arabic
      ? [
          `لديك ${meetings.length} اجتماعًا و${personalEvents.length} حدثًا شخصيًا في مساحة العمل.`,
          settings.integrations.outlook.connected ? "- Outlook Calendar متصل." : "- Outlook Calendar جاهز للربط.",
          settings.integrations.teams.connected ? "- Microsoft Teams متصل." : "- Microsoft Teams جاهز للربط.",
          meetingSummary ? `أقرب الاجتماعات:\n${meetingSummary}` : "لا توجد اجتماعات مجدولة حاليًا.",
          personalSummary ? `الأحداث الشخصية:\n${personalSummary}` : "لا توجد أحداث شخصية مجدولة.",
        ].join("\n")
      : [
          `There are ${meetings.length} tracked meetings and ${personalEvents.length} personal events in the workspace calendar.`,
          settings.integrations.outlook.connected ? "- Outlook Calendar is connected." : "- Outlook Calendar is ready to connect.",
          settings.integrations.teams.connected ? "- Microsoft Teams is connected." : "- Microsoft Teams is ready to connect.",
          meetingSummary ? `Upcoming meetings:\n${meetingSummary}` : "No meetings are scheduled right now.",
          personalSummary ? `Personal events:\n${personalSummary}` : "No personal events are scheduled right now.",
        ].join("\n");
  }

  if (includesAny("integration", "onedrive", "whatsapp", "sync", "connector", "\u062a\u0643\u0627\u0645\u0644", "\u0648\u0627\u062a\u0633\u0627\u0628", "\u0648\u0646 \u062f\u0631\u0627\u064a\u0641", "\u0645\u0632\u0627\u0645\u0646\u0629")) {
    const integrationSummary = Object.values(settings.integrations)
      .map((integration) => `- ${integration.providerLabel}: ${integration.connected ? "Connected" : "Ready"} | mode: ${integration.syncMode}`)
      .join("\n");
    return arabic
      ? `حالة التكاملات:\n${integrationSummary}`
      : `Integration status:\n${integrationSummary}`;
  }

  if (includesAny("report", "dashboard", "template", "\u062a\u0642\u0631\u064a\u0631", "\u0644\u0648\u062d\u0629", "\u0642\u0627\u0644\u0628")) {
    return [
      `Dashboard templates: ${dashboards.map((dashboard) => dashboard.name).join(", ")}.`,
      `Report templates: ${reportTemplates.map((template) => template.name).join(", ")}.`,
      `Project templates: ${projectTemplates.map((template) => template.name).join(", ")}.`,
      `Default namespace: ${settings.namespace.organization} (${settings.namespace.slug}).`,
    ].join("\n");
  }

  if (includesAny("user", "users", "account", "access", "admin", "\u0645\u0633\u062a\u062e\u062f\u0645", "\u062d\u0633\u0627\u0628", "\u0635\u0644\u0627\u062d\u064a\u0627\u062a", "\u0645\u0633\u0624\u0648\u0644")) {
    return arabic
      ? [
          `\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0645\u0633\u062c\u0644\u0629: ${userAccounts.length}.`,
          `- \u0627\u0644\u0645\u0634\u0631\u0641\u0648\u0646: ${userAccounts.filter((account) => account.roleId === "admin").map((account) => account.fullName).join(", ") || "\u0644\u0627 \u064a\u0648\u062c\u062f"}.`,
          `- \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0648\u0642\u0648\u0641\u0629: ${userAccounts.filter((account) => account.status === "suspended").length}.`,
          `- \u0635\u0641\u062d\u0629 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0641\u064a Settings.`,
        ].join("\n")
      : [
          `Tracked user accounts: ${userAccounts.length}.`,
          `Admin users: ${userAccounts.filter((account) => account.roleId === "admin").map((account) => account.fullName).join(", ") || "none"}.`,
          `Suspended accounts: ${userAccounts.filter((account) => account.status === "suspended").length}.`,
          "You can manage user access, roles, and team links from Settings.",
        ].join("\n");
  }

  if (includesAny("sticky", "note", "todo", "to do", "\u0645\u0644\u0627\u062d\u0638\u0629", "\u0645\u0647\u0627\u0645 \u0634\u062e\u0635\u064a\u0629", "\u062a\u0648 \u062f\u0648")) {
    const noteSummary = stickyNotes
      .slice(0, 6)
      .map((note) => `- ${note.title} | ${note.ownerName} | ${note.done ? "done" : "open"}`)
      .join("\n");
    return arabic
      ? noteSummary || "لا توجد ملاحظات لاصقة مسجلة حاليًا."
      : noteSummary || "There are no sticky notes saved right now.";
  }

  if (
    includesAny(
      "status",
      "overview",
      "summary",
      "summarize",
      "portfolio",
      "active project",
      "active projects",
      "\u062d\u0627\u0644\u0629",
      "\u0645\u0644\u062e\u0635",
    )
  ) {
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length;
    const openTickets = tickets.filter((ticket) => ticket.status === "open").length;
    const upcomingMeetings = meetings.filter((meeting) => new Date(meeting.startsAt) >= new Date()).length;

    return arabic
      ? [
          `${text.overview}${activeProjects} \u0645\u0634\u0631\u0648\u0639 \u0646\u0634\u0637\u060c ${inProgressTasks} \u0645\u0647\u0645\u0629 \u0642\u064a\u062f \u0627\u0644\u062a\u0646\u0641\u064a\u0630\u060c \u0648${openTickets} \u062a\u0630\u0643\u0631\u0629 \u0645\u0641\u062a\u0648\u062d\u0629.`,
          `- الاجتماعات القادمة: ${upcomingMeetings}.`,
          `- \u0623\u0643\u062b\u0631 \u0645\u0634\u0631\u0648\u0639 \u0645\u0639\u0631\u0636 \u0644\u0644\u0645\u062e\u0627\u0637\u0631: ${projects.find((project) => project.status === "at-risk")?.name ?? "\u0644\u0627 \u064a\u0648\u062c\u062f"}.`,
          `- \u062d\u062c\u0645 \u0627\u0644\u0641\u0631\u064a\u0642: ${teamMembers.length} \u0639\u0636\u0648.`,
        ].join("\n")
      : [
          `Workspace overview: ${activeProjects} active projects, ${inProgressTasks} tasks in progress, ${openTickets} open tickets, and ${upcomingMeetings} upcoming meetings.`,
          `Most at-risk project: ${projects.find((project) => project.status === "at-risk")?.name ?? "none flagged right now"}.`,
          `Team capacity snapshot: ${teamMembers.length} team members tracked in the workspace.`,
        ].join("\n");
  }

  if (includesAny("risk", "\u0645\u062e\u0627\u0637\u0631")) {
    const riskyProjects = projects.filter((project) => project.status === "at-risk" || project.progress < 30);
    if (riskyProjects.length === 0) {
      return arabic ? text.risksNone : "No major risks are flagged in the current workspace. Focus on clearing open tickets and keeping schedule dependencies updated.";
    }

    return riskyProjects
      .map((project) =>
        arabic
          ? `- ${project.name} \u062d\u0627\u0644\u062a\u0647 ${project.status} \u0648\u0646\u0633\u0628\u0629 \u0627\u0644\u062a\u0642\u062f\u0645 ${project.progress}%\u060c \u0648\u064a\u0646\u0635\u062d \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0639\u0648\u0627\u0626\u0642 \u0648\u0627\u0644\u0645\u0639\u0627\u0644\u0645.`
          : `Risk: ${project.name} is ${project.status} at ${project.progress}% progress. Suggested action: review blockers, rebalance owners, and confirm milestone dates.`,
      )
      .join("\n");
  }

  if (includesAny("task", "plan", "\u0645\u0647\u0627\u0645", "\u062e\u0637\u0629")) {
    return arabic
      ? [
          text.planIntro,
          "1. \u0631\u0627\u062c\u0639 \u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0648\u0627\u0644\u0645\u0639\u0627\u0644\u0645.",
          "2. \u0642\u0633\u0645 \u0627\u0644\u0639\u0645\u0644 \u0625\u0644\u0649 \u0645\u0647\u0627\u0645 \u0645\u0631\u0628\u0648\u0637\u0629 \u0628\u0627\u0644\u0645\u0627\u0644\u0643\u064a\u0646.",
          "3. \u062d\u062f\u062b \u0627\u0644\u062a\u0628\u0639\u064a\u0627\u062a \u0641\u064a \u0627\u0644\u062c\u062f\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064a.",
          "4. \u0631\u0627\u062c\u0639 \u0627\u0644\u0623\u062d\u0645\u0627\u0644 \u0641\u064a \u0627\u0644\u0641\u0631\u064a\u0642.",
          "5. \u062a\u0627\u0628\u0639 \u0627\u0644\u0639\u0648\u0627\u0626\u0642 \u0641\u064a \u0627\u0644\u062a\u0630\u0627\u0643\u0631.",
        ].join("\n")
      : [
          "Suggested execution plan:",
          "1. Confirm project scope and milestone dates in Projects.",
          "2. Break work into tasks in the Tasks board and tag owners.",
          "3. Validate sequencing in Schedule and add predecessors for critical path items.",
          "4. Review team workload in Team before committing new deadlines.",
          "5. Track blockers in Tickets so reports stay accurate.",
        ].join("\n");
  }

  if (includesAny("team", "resource", "utilization", "capacity", "\u0641\u0631\u064a\u0642", "\u0645\u0648\u0627\u0631\u062f", "\u0627\u0633\u062a\u062e\u062f\u0627\u0645", "\u0637\u0627\u0642\u0629")) {
    return arabic
      ? [
          text.teamIntro,
          `- ${teamMembers.length} \u0639\u0636\u0648 \u0641\u064a \u0627\u0644\u0641\u0631\u064a\u0642.`,
          `- \u0642\u0646\u0648\u0627\u062a \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629: ${chatChannels.map((channel) => channel.name).join(", ")}.`,
          `- \u0633\u064a\u0631 \u0627\u0644\u0639\u0645\u0644: ${workflows.map((workflow) => workflow.name).join(", ")}.`,
        ].join("\n")
      : [
          `Team members tracked: ${teamMembers.length}.`,
          `Active chat channels: ${chatChannels.map((channel) => channel.name).join(", ")}.`,
          `Configured workflows: ${workflows.map((workflow) => workflow.name).join(", ")}.`,
          `Resource-heavy projects: ${projects
            .sort((left, right) => (right.resources?.length ?? 0) - (left.resources?.length ?? 0))
            .slice(0, 3)
            .map((project) => `${project.name} (${project.resources?.length ?? 0} resources)`)
            .join(", ")}.`,
        ].join("\n");
  }

  if (includesAny("audit", "history", "activity", "log", "\u062a\u062f\u0642\u064a\u0642", "\u0633\u062c\u0644", "\u0646\u0634\u0627\u0637")) {
    const auditSummary = auditLogs
      .slice(0, 6)
      .map((log) => `- ${log.action} | ${log.actorName} | ${new Date(log.createdAt).toLocaleString()}`)
      .join("\n");
    return arabic
      ? auditSummary || "لا توجد سجلات تدقيق حديثة."
      : auditSummary || "There are no recent audit log entries.";
  }

  return arabic
    ? text.help
    : "I can search the workspace and summarize project status, risks, documents, user access, dashboards, resources, and next steps. Ask me to find a project, search documents, review user accounts, show tagged tasks, review risks, or summarize the portfolio.";
};

export async function streamAgentChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  if (
    !REMOTE_AI_ENABLED ||
    !import.meta.env.VITE_SUPABASE_URL ||
    !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ) {
    onDelta(localResponse(messages));
    onDone();
    return;
  }

  try {
    let emittedContent = false;

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok || !resp.body) {
      onDelta(localResponse(messages));
      onDone();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            emittedContent = true;
            onDelta(content);
          }
        } catch {
          textBuffer = `${line}\n${textBuffer}`;
          break;
        }
      }
    }

    if (!emittedContent) {
      onDelta(localResponse(messages));
    }

    onDone();
  } catch (error) {
    onError?.(error instanceof Error ? error.message : "AI request failed");
    onDelta(localResponse(messages));
    onDone();
  }
}
