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

const phaseOrder = ["Discovery", "Planning", "Infrastructure", "Design", "Execution", "Integration", "Migration", "Testing", "Training", "Deployment", "Operations"];

const nazaha980Tasks: ScheduleTemplateTask[] = [
  { title: "Kick-off and site handover", description: "Start the Nazaha 980 project, confirm governance, communication channels, project team, and site handover.", phase: "Discovery", durationDays: 14, workloadHours: 80, priority: "urgent", isMilestone: true },
  { title: "Business workshops and current-state assessment", description: "Run workshops for incident management, call center operations, call recording, Helpion service desk, secure communications, analytics, integrations, security, and operations.", phase: "Discovery", durationDays: 30, workloadHours: 320, priority: "high" },
  { title: "BRD, gap analysis, and target operating model", description: "Prepare business requirements, gap analysis, to-be processes, SLA, escalation, reporting, and acceptance criteria for the 980 center.", phase: "Planning", durationDays: 21, workloadHours: 240, priority: "high" },
  { title: "Solution architecture and HLD/LLD", description: "Design Automax, VoIP/SIP, call recording, Helpion, secure communications, Infora dashboards, integration layer, HA/DR, security, and environments.", phase: "Design", durationDays: 21, workloadHours: 280, priority: "high" },
  { title: "Procurement, licenses, and infrastructure readiness", description: "Prepare licenses, environments, smart cabinets, UPS, workstations, VMware/VxRail readiness, networking, application VLAN, database VLAN, and DR connectivity.", phase: "Infrastructure", durationDays: 42, workloadHours: 360, priority: "high" },
  { title: "Automax incident management configuration", description: "Configure incident intake, classification, workflows, escalation rules, SLA, GIS fields, audit trails, roles, reports, and dashboards.", phase: "Execution", durationDays: 35, workloadHours: 420, priority: "high" },
  { title: "VoIP/SIP and call recording configuration", description: "Configure SIP, PBX integration, call routing, IVR, call recording, recording permissions, call search, CDR, quality monitoring, and call reports.", phase: "Execution", durationDays: 28, workloadHours: 320, priority: "high" },
  { title: "Helpion service desk configuration", description: "Configure ticketing, service requests, assets, CMDB, change management, SLA, knowledge base, dashboards, and role-based access.", phase: "Execution", durationDays: 28, workloadHours: 300, priority: "high" },
  { title: "Secure communication platform setup", description: "Install server license, mobile and desktop application configuration, users, groups, encryption controls, certificates, audit logs, and platform policies.", phase: "Execution", durationDays: 21, workloadHours: 220, priority: "high" },
  { title: "Infora KPI dashboards and analytics", description: "Build executive KPI dashboards for call KPIs, incident KPIs, agent performance, SLA compliance, service performance, trends, and drill-down reports.", phase: "Execution", durationDays: 28, workloadHours: 300, priority: "high" },
  { title: "Integration implementation", description: "Implement integrations between Automax, VoIP/SIP, call recording, Helpion, Infora, Active Directory, GIS, caller location, internal systems, and data warehouse as required.", phase: "Integration", durationDays: 35, workloadHours: 420, priority: "high" },
  { title: "Data migration trial", description: "Extract, cleanse, map, load, and reconcile legacy Automax and operational data, including incidents, tasks, escalations, call records, and reporting data.", phase: "Migration", durationDays: 21, workloadHours: 260, priority: "high" },
  { title: "System integration testing", description: "Run end-to-end SIT for incident lifecycle, calls, recording, service desk, secure communication, dashboards, integrations, security controls, and HA/DR scenarios.", phase: "Testing", durationDays: 21, workloadHours: 300, priority: "high" },
  { title: "UAT and defect closure", description: "Conduct user acceptance testing with agents, supervisors, managers, IT, and business users, then close defects and obtain UAT sign-off.", phase: "Testing", durationDays: 21, workloadHours: 280, priority: "urgent", isMilestone: true },
  { title: "Training and knowledge transfer", description: "Deliver training for agents, supervisors, managers, IT administrators, support team, and business users with manuals and operational guides.", phase: "Training", durationDays: 14, workloadHours: 180, priority: "high" },
  { title: "Go-live readiness and cutover", description: "Confirm readiness gates, production deployment, rollback plan, final migration, smoke test, go/no-go approval, and production activation.", phase: "Deployment", durationDays: 7, workloadHours: 120, priority: "urgent", isMilestone: true },
  { title: "Hypercare and stabilization", description: "Provide intensive post go-live support, monitor performance, resolve urgent issues, and transition to steady-state operations.", phase: "Deployment", durationDays: 30, workloadHours: 320, priority: "urgent" },
  { title: "Operations, maintenance, and SLA reporting", description: "Operate and maintain the Nazaha 980 systems for 36 months with monthly SLA reports, preventive maintenance, backups, security checks, improvements, and service reviews.", phase: "Operations", durationDays: 1095, workloadHours: 4320, priority: "high" },
];

const templateCatalog: Array<{ keywords: string[]; tasks: ScheduleTemplateTask[] }> = [
  {
    keywords: ["nazaha", "nzaha", "نزاه", "980"],
    tasks: nazaha980Tasks,
  },
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
  const template = getTemplateTasks(`${projectName} ${projectNature ?? ""}`);
  const baseDate = parseISO(startDate);
  const phaseCounter = new Map<string, number>();
  let cursor = baseDate;

  return template.map((task, index) => {
    const phasePosition = (phaseCounter.get(task.phase) ?? 0) + 1;
    phaseCounter.set(task.phase, phasePosition);
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
      predecessors: index > 0 ? [(() => {
        const previousTemplate = template[index - 1];
        const previousPosition = template.slice(0, index).filter((item) => item.phase === previousTemplate.phase).length;
        return getScheduleWbs(previousTemplate.phase, previousPosition);
      })()] : [],
      priority: task.priority,
      status: "todo",
      progress: task.isMilestone ? 0 : 5,
      workloadHours: task.workloadHours,
      isMilestone: Boolean(task.isMilestone),
    };
  });
}
