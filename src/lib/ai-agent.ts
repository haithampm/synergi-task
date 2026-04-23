import { hasArabicText } from "@/lib/i18n";
import {
  fetchMergedChatChannels,
  fetchMergedDashboards,
  fetchMergedMeetings,
  fetchMergedPersonalEvents,
  fetchMergedProjects,
  fetchMergedStickyNotes,
  fetchMergedTasks,
  fetchMergedTeamMembers,
  fetchMergedTickets,
  fetchMergedUserAccounts,
  mergeSettingsWithRemoteContext,
} from "@/integrations/supabase/workspace-data";
import { readWorkspaceData } from "@/lib/workspace-store";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;
const REMOTE_AI_ENABLED = import.meta.env.VITE_ENABLE_REMOTE_AI === "true";

const includesAny = (prompt: string, ...keywords: string[]) =>
  keywords.some((keyword) => prompt.includes(keyword));

const extractWorkspaceSearchQuery = (value: string) =>
  value
    .trim()
    .replace(
      /^(search|find|show|lookup|locate|search for|find me|show me|ابحث|اعثر|أظهر|اظهر)\s+/i,
      "",
    )
    .trim();

const buildSearchResults = (query: string, workspace: Awaited<ReturnType<typeof loadAssistantWorkspaceData>>) => {
  const normalized = extractWorkspaceSearchQuery(query).toLowerCase();
  if (!normalized) return [];

  const matches = [
    ...workspace.projects
      .filter((project) =>
        [project.name, project.description, project.department, ...(project.tags ?? [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .map((project) => `${project.name} | Project · ${project.department || "No department"}`),
    ...workspace.tasks
      .filter((task) =>
        [task.title, task.description, task.projectName, task.assignee, ...(task.tags ?? [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .map((task) => `${task.title} | Task · ${task.projectName}`),
    ...workspace.tickets
      .filter((ticket) =>
        [ticket.title, ticket.description, ticket.assignee]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .map((ticket) => `${ticket.title} | Ticket · ${ticket.status}`),
    ...workspace.userAccounts
      .filter((account) =>
        [account.fullName, account.email, account.department, account.title]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .map((account) => `${account.fullName} | User · ${account.email}`),
    ...workspace.projects.flatMap((project) =>
      (project.documents ?? [])
        .filter((document) =>
          [document.name, document.type, document.category, document.phase]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized)),
        )
        .map((document) => `${document.name} | Document · ${project.name}`),
    ),
    ...workspace.teamMembers
      .filter((member) =>
        [member.name, member.role, member.department, member.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .map((member) => `${member.name} | Team · ${member.role}`),
  ];

  return matches.slice(0, 12);
};

const loadAssistantWorkspaceData = async () => {
  const local = readWorkspaceData();
  const [projects, tasks, tickets, teamMembers, userAccounts, stickyNotes, chatChannels, dashboards, meetings, personalEvents, settings] =
    await Promise.all([
      fetchMergedProjects(),
      fetchMergedTasks(),
      fetchMergedTickets(),
      fetchMergedTeamMembers(),
      fetchMergedUserAccounts(),
      fetchMergedStickyNotes(),
      fetchMergedChatChannels(),
      fetchMergedDashboards(),
      fetchMergedMeetings(),
      fetchMergedPersonalEvents(),
      mergeSettingsWithRemoteContext(local.settings),
    ]);

  return {
    ...local,
    projects,
    tasks,
    tickets,
    teamMembers,
    userAccounts,
    stickyNotes,
    chatChannels,
    dashboards,
    meetings,
    personalEvents,
    settings,
  };
};

const groundedLocalResponse = async (messages: Msg[]) => {
  const latest = messages[messages.length - 1]?.content ?? "";
  const prompt = latest.toLowerCase();
  const workspace = await loadAssistantWorkspaceData();
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
  } = workspace;
  const projectDocs = projects.flatMap((project) =>
    (project.documents ?? []).map((document) => ({ project, document })),
  );
  const arabic = settings.appearance.language === "ar" || hasArabicText(latest);

  const text = {
    noSearch:
      "لا توجد نتائج مطابقة في المشاريع أو المهام أو التذاكر أو المستندات أو بيانات الفريق.",
    noDocs:
      "لا توجد مستندات مشاريع محفوظة بعد. أنشئ مشروعًا أو حدّثه ثم استخدم توليد حزمة PMI.",
    searchIntro: "نتائج البحث في النظام:",
    docsIntro: "مستندات المشاريع في النظام:",
    overview: "ملخص مساحة العمل: ",
    risksNone: "لا توجد مخاطر كبيرة مسجلة حاليًا.",
    planIntro: "خطة تنفيذ مقترحة:",
    teamIntro: "بيانات الفريق والموارد:",
    help:
      "يمكنني البحث في بيانات النظام الملحقة بقاعدة البيانات وتلخيص حالة المشاريع والمخاطر والمستندات والموارد وسجلات الوصول.",
  };

  if (includesAny(prompt, "search", "find", "show", "lookup", "locate", "ابحث", "اعثر", "أظهر", "اظهر")) {
    const results = buildSearchResults(latest, workspace);
    if (!results.length) {
      return arabic
        ? text.noSearch
        : "No matching records were found in persisted projects, tasks, tickets, user accounts, documents, or team data.";
    }

    return [arabic ? text.searchIntro : "Workspace search results:", ...results.map((result) => `- ${result}`)].join("\n");
  }

  if (includesAny(prompt, "document", "charter", "brd", "scope", "schedule plan", "template", "مستند", "ميثاق", "نطاق", "قالب")) {
    if (!projectDocs.length) {
      return arabic ? text.noDocs : "No project documents are stored yet. Create or update a project and generate the PMI package first.";
    }

    return [
      arabic ? text.docsIntro : "Project documents in the workspace:",
      ...projectDocs.slice(0, 8).map(({ project, document }) => `- ${document.name} | ${project.name} | ${document.generated ? "generated" : "uploaded"}`),
    ].join("\n");
  }

  if (includesAny(prompt, "calendar", "meeting", "agenda", "event", "outlook", "teams", "تقويم", "اجتماع", "حدث")) {
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
          `There are ${meetings.length} persisted meetings and ${personalEvents.length} personal events in the workspace calendar.`,
          settings.integrations.outlook.connected ? "- Outlook Calendar is connected." : "- Outlook Calendar is ready to connect.",
          settings.integrations.teams.connected ? "- Microsoft Teams is connected." : "- Microsoft Teams is ready to connect.",
          meetingSummary ? `Upcoming meetings:\n${meetingSummary}` : "No meetings are scheduled right now.",
          personalSummary ? `Personal events:\n${personalSummary}` : "No personal events are scheduled right now.",
        ].join("\n");
  }

  if (includesAny(prompt, "integration", "onedrive", "whatsapp", "sync", "connector", "تكامل", "واتساب", "مزامنة")) {
    const integrationSummary = Object.values(settings.integrations)
      .map((integration) => `- ${integration.providerLabel}: ${integration.connected ? "Connected" : "Ready"} | mode: ${integration.syncMode}`)
      .join("\n");
    return arabic ? `حالة التكاملات:\n${integrationSummary}` : `Integration status:\n${integrationSummary}`;
  }

  if (includesAny(prompt, "report", "dashboard", "template", "تقرير", "لوحة", "قالب")) {
    return [
      `Dashboard templates: ${dashboards.map((dashboard) => dashboard.name).join(", ")}.`,
      `Report templates: ${reportTemplates.map((template) => template.name).join(", ")}.`,
      `Project templates: ${projectTemplates.map((template) => template.name).join(", ")}.`,
      `Default namespace: ${settings.namespace.organization} (${settings.namespace.slug}).`,
    ].join("\n");
  }

  if (includesAny(prompt, "user", "users", "account", "access", "admin", "مستخدم", "حساب", "صلاحيات", "مسؤول")) {
    return arabic
      ? [
          `حسابات المستخدمين المسجلة: ${userAccounts.length}.`,
          `- المشرفون: ${userAccounts.filter((account) => account.roleId === "admin").map((account) => account.fullName).join(", ") || "لا يوجد"}.`,
          `- الحسابات الموقوفة: ${userAccounts.filter((account) => account.status === "suspended").length}.`,
          "- صفحة إدارة الصلاحيات متاحة في User Accounts وSettings.",
        ].join("\n")
      : [
          `Tracked user accounts: ${userAccounts.length}.`,
          `Admin users: ${userAccounts.filter((account) => account.roleId === "admin").map((account) => account.fullName).join(", ") || "none"}.`,
          `Suspended accounts: ${userAccounts.filter((account) => account.status === "suspended").length}.`,
          "You can manage user access, roles, and team links from the User Accounts and Settings screens.",
        ].join("\n");
  }

  if (includesAny(prompt, "sticky", "note", "todo", "to do", "ملاحظة")) {
    const noteSummary = stickyNotes
      .slice(0, 6)
      .map((note) => `- ${note.title} | ${note.ownerName} | ${note.done ? "done" : "open"}`)
      .join("\n");
    return arabic ? noteSummary || "لا توجد ملاحظات لاصقة مسجلة حاليًا." : noteSummary || "There are no sticky notes saved right now.";
  }

  if (includesAny(prompt, "status", "overview", "summary", "summarize", "portfolio", "active project", "active projects", "حالة", "ملخص")) {
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length;
    const openTickets = tickets.filter((ticket) => ticket.status === "open").length;
    const upcomingMeetings = meetings.filter((meeting) => new Date(meeting.startsAt) >= new Date()).length;

    return arabic
      ? [
          `${text.overview}${activeProjects} مشروع نشط، ${inProgressTasks} مهمة قيد التنفيذ، و${openTickets} تذكرة مفتوحة.`,
          `- الاجتماعات القادمة: ${upcomingMeetings}.`,
          `- أكثر مشروع معرّض للمخاطر: ${projects.find((project) => project.status === "at-risk")?.name ?? "لا يوجد"}.`,
          `- حجم الفريق: ${teamMembers.length} عضو.`,
        ].join("\n")
      : [
          `Workspace overview: ${activeProjects} active projects, ${inProgressTasks} tasks in progress, ${openTickets} open tickets, and ${upcomingMeetings} upcoming meetings.`,
          `Most at-risk project: ${projects.find((project) => project.status === "at-risk")?.name ?? "none flagged right now"}.`,
          `Team capacity snapshot: ${teamMembers.length} team members tracked in the workspace.`,
        ].join("\n");
  }

  if (includesAny(prompt, "risk", "مخاطر")) {
    const riskyProjects = projects.filter((project) => project.status === "at-risk" || project.progress < 30);
    if (!riskyProjects.length) {
      return arabic
        ? text.risksNone
        : "No major risks are flagged in the current persisted workspace data. Focus on clearing open tickets and keeping schedule dependencies updated.";
    }

    return riskyProjects
      .map((project) =>
        arabic
          ? `- ${project.name} حالته ${project.status} ونسبة التقدم ${project.progress}%، وينصح بمراجعة العوائق والمعالم.`
          : `Risk: ${project.name} is ${project.status} at ${project.progress}% progress. Suggested action: review blockers, rebalance owners, and confirm milestone dates.`,
      )
      .join("\n");
  }

  if (includesAny(prompt, "task", "plan", "مهام", "خطة")) {
    return arabic
      ? [
          text.planIntro,
          "1. راجع نطاق المشروع والمعالم.",
          "2. قسم العمل إلى مهام مرتبطة بالمالكين.",
          "3. حدّث التبعيات في الجدول الزمني.",
          "4. راجع الأحمال في الفريق.",
          "5. تابع العوائق في التذاكر.",
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

  if (includesAny(prompt, "team", "resource", "utilization", "capacity", "فريق", "موارد", "طاقة")) {
    return arabic
      ? [
          text.teamIntro,
          `- ${teamMembers.length} عضو في الفريق.`,
          `- قنوات المحادثة: ${chatChannels.map((channel) => channel.name).join(", ")}.`,
          `- سير العمل: ${workflows.map((workflow) => workflow.name).join(", ")}.`,
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

  if (includesAny(prompt, "audit", "history", "activity", "log", "تدقيق", "سجل", "نشاط")) {
    const auditSummary = auditLogs
      .slice(0, 6)
      .map((log) => `- ${log.action} | ${log.actorName} | ${new Date(log.createdAt).toLocaleString()}`)
      .join("\n");
    return arabic ? auditSummary || "لا توجد سجلات تدقيق حديثة." : auditSummary || "There are no recent audit log entries.";
  }

  return arabic
    ? text.help
    : "I can search the live workspace data and summarize project status, risks, documents, user access, dashboards, resources, and next steps. Ask me to find a project, review user accounts, summarize the portfolio, or show stored documents.";
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
    onDelta(await groundedLocalResponse(messages));
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
      onDelta(await groundedLocalResponse(messages));
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
      onDelta(await groundedLocalResponse(messages));
    }

    onDone();
  } catch (error) {
    onError?.(error instanceof Error ? error.message : "AI request failed");
    onDelta(await groundedLocalResponse(messages));
    onDone();
  }
}
