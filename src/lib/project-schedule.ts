import { addDays, format, parseISO } from "date-fns";

type ScheduleTemplateTask = {
  title: string;
  description: string;
  phase: string;
  durationDays: number;
  workloadHours: number;
  priority: "low" | "medium" | "high" | "urgent";
  isMilestone?: boolean;
};

export type GeneratedScheduleTask = {
  title: string;
  description: string;
  phase: string;
  start_date: string;
  end_date: string;
  due_date: string;
  duration: string;
  predecessors: string[];
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo";
  progress: number;
  workloadHours: number;
  isMilestone: boolean;
};

const phaseOrder = ["Discovery", "Planning", "Execution", "Testing", "Deployment"];

const templateCatalog: Array<{ keywords: string[]; tasks: ScheduleTemplateTask[] }> = [
  {
    keywords: ["erp", "system", "software", "application", "platform", "digital", "integration", "ai"],
    tasks: [
      { title: "Kickoff and stakeholder alignment", description: "Confirm governance, objectives, and delivery success criteria.", phase: "Discovery", durationDays: 2, workloadHours: 12, priority: "high", isMilestone: true },
      { title: "Requirements and process mapping", description: "Capture business processes, key requirements, and cross-functional dependencies.", phase: "Discovery", durationDays: 5, workloadHours: 40, priority: "high" },
      { title: "Solution design and schedule baseline", description: "Prepare architecture decisions, work breakdown structure, and baseline schedule plan.", phase: "Planning", durationDays: 4, workloadHours: 32, priority: "high" },
      { title: "Configuration and build", description: "Configure the platform, build needed extensions, and prepare core workflows.", phase: "Execution", durationDays: 10, workloadHours: 80, priority: "high" },
      { title: "Data migration and integration validation", description: "Validate migrated records, external connectors, and dependency readiness.", phase: "Execution", durationDays: 6, workloadHours: 48, priority: "high" },
      { title: "UAT and quality review", description: "Run business validation, close defects, and confirm release readiness.", phase: "Testing", durationDays: 5, workloadHours: 36, priority: "medium" },
      { title: "Go-live and hypercare", description: "Deploy to production, monitor stabilization, and transition to support.", phase: "Deployment", durationDays: 4, workloadHours: 28, priority: "urgent", isMilestone: true },
    ],
  },
  {
    keywords: ["construction", "facility", "site", "civil", "infrastructure", "building"],
    tasks: [
      { title: "Mobilization and site readiness", description: "Confirm permits, safety controls, access, and project mobilization.", phase: "Discovery", durationDays: 3, workloadHours: 20, priority: "high", isMilestone: true },
      { title: "Design review and approvals", description: "Review drawings, approve scope packages, and confirm procurement list.", phase: "Planning", durationDays: 6, workloadHours: 36, priority: "high" },
      { title: "Procurement and contractor coordination", description: "Secure materials, vendors, and execution sequence commitments.", phase: "Planning", durationDays: 5, workloadHours: 30, priority: "high" },
      { title: "Execution and site supervision", description: "Complete field work, monitor quality, and manage daily progress.", phase: "Execution", durationDays: 12, workloadHours: 88, priority: "high" },
      { title: "Inspection and punch closure", description: "Run inspections, close punch items, and verify contractual scope delivery.", phase: "Testing", durationDays: 4, workloadHours: 24, priority: "medium" },
      { title: "Handover and closeout", description: "Complete acceptance, handover documentation, and final stakeholder sign-off.", phase: "Deployment", durationDays: 3, workloadHours: 18, priority: "urgent", isMilestone: true },
    ],
  },
  {
    keywords: ["marketing", "campaign", "launch", "event", "awareness", "brand"],
    tasks: [
      { title: "Campaign brief and audience alignment", description: "Confirm objectives, audience segments, and target outcome metrics.", phase: "Discovery", durationDays: 2, workloadHours: 10, priority: "high", isMilestone: true },
      { title: "Content and media planning", description: "Prepare the content calendar, channel mix, and creative dependencies.", phase: "Planning", durationDays: 4, workloadHours: 24, priority: "high" },
      { title: "Asset production", description: "Produce approved campaign assets and landing-page collateral.", phase: "Execution", durationDays: 6, workloadHours: 40, priority: "high" },
      { title: "Launch readiness and QA", description: "Validate content, audiences, tracking, and pre-launch approvals.", phase: "Testing", durationDays: 3, workloadHours: 18, priority: "medium" },
      { title: "Launch and performance monitoring", description: "Launch the campaign and monitor engagement, spend, and response.", phase: "Deployment", durationDays: 5, workloadHours: 25, priority: "urgent", isMilestone: true },
    ],
  },
];

const defaultTasks: ScheduleTemplateTask[] = [
  { title: "Project kickoff", description: "Confirm scope, ownership, and success metrics with the delivery team.", phase: "Discovery", durationDays: 2, workloadHours: 12, priority: "high", isMilestone: true },
  { title: "Detailed planning", description: "Build the detailed scope, timeline, and resource alignment plan.", phase: "Planning", durationDays: 4, workloadHours: 28, priority: "high" },
  { title: "Execution workstream delivery", description: "Deliver the core work packages and manage open actions.", phase: "Execution", durationDays: 8, workloadHours: 56, priority: "high" },
  { title: "Validation and review", description: "Review outputs, confirm quality, and close priority gaps.", phase: "Testing", durationDays: 4, workloadHours: 24, priority: "medium" },
  { title: "Go-live and closeout", description: "Complete deployment, sign-off, and project closeout activities.", phase: "Deployment", durationDays: 3, workloadHours: 18, priority: "urgent", isMilestone: true },
];

const getTemplateTasks = (projectNature?: string) => {
  const nature = projectNature?.toLowerCase() ?? "";
  return templateCatalog.find((template) => template.keywords.some((keyword) => nature.includes(keyword)))?.tasks ?? defaultTasks;
};

export const getScheduleWbs = (phase: string, phasePosition: number) => {
  const phaseIndex = Math.max(1, phaseOrder.indexOf(phase) + 1);
  return `${phaseIndex}.${phasePosition}`;
};

export function generateScheduleFromProjectNature({
  startDate,
  projectName,
  projectNature,
}: {
  startDate: string;
  projectName: string;
  projectNature?: string;
}): GeneratedScheduleTask[] {
  const template = getTemplateTasks(projectNature);
  const baseDate = parseISO(startDate);
  const phaseCounter = new Map<string, number>();
  let cursor = baseDate;

  return template.map((task, index) => {
    const phasePosition = (phaseCounter.get(task.phase) ?? 0) + 1;
    phaseCounter.set(task.phase, phasePosition);
    const wbs = getScheduleWbs(task.phase, phasePosition);
    const start = cursor;
    const end = addDays(start, Math.max(1, task.durationDays) - 1);
    cursor = addDays(end, 1);

    return {
      title: task.title,
      description: `${task.description}\nProject: ${projectName}\nTemplate basis: ${projectNature?.trim() || "standard project delivery plan"}`,
      phase: task.phase,
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
      due_date: format(end, "yyyy-MM-dd"),
      duration: `${Math.max(1, task.durationDays)}d`,
      predecessors: index > 0 ? [getScheduleWbs(template[index - 1].phase, (phaseCounter.get(template[index - 1].phase) ?? 1))] : [],
      priority: task.priority,
      status: "todo",
      progress: task.isMilestone ? 0 : 5,
      workloadHours: task.workloadHours,
      isMilestone: Boolean(task.isMilestone),
    };
  }).map((task, index) => ({
    ...task,
    predecessors: index > 0 ? [(() => {
      const previousTemplate = template[index - 1];
      const previousPosition = template
        .slice(0, index)
        .filter((item) => item.phase === previousTemplate.phase)
        .length;
      return getScheduleWbs(previousTemplate.phase, previousPosition);
    })()] : [],
  }));
}
