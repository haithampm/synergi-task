import {
  makeId,
  type WorkspaceProject,
  type WorkspaceProjectDocument,
  type WorkspaceProjectRisk,
  type WorkspaceProjectStakeholder,
  type WorkspaceProjectTeamNode,
  type WorkspaceTask,
  type WorkspaceTicket,
} from "@/lib/workspace-store";

type DeliverableDefinition = {
  type: string;
  name: string;
  phase: NonNullable<WorkspaceProjectDocument["phase"]>;
  deliverableType: string;
  documentNature: NonNullable<WorkspaceProjectDocument["documentNature"]>;
  outputFormat: NonNullable<WorkspaceProjectDocument["outputFormat"]>;
  standardTemplate: NonNullable<WorkspaceProjectDocument["standardTemplate"]>;
  folder: string;
  linkedChannelName: string;
  reviewStatus?: NonNullable<WorkspaceProjectDocument["reviewStatus"]>;
  content: string;
};

export type DocumentTemplateStandard = "PMI" | "SAP";

type DocumentGenerationContext = {
  tasks?: WorkspaceTask[];
  tickets?: WorkspaceTicket[];
  currentUserName?: string;
  organizationName?: string;
  portfolioOffice?: string;
};

const registerLines = <T>(items: T[], mapper: (item: T, index: number) => string, empty: string) =>
  items.length ? items.map(mapper).join("\n") : empty;

const inferProjectNature = (project: Partial<WorkspaceProject>) =>
  project.projectNature?.trim() ||
  [project.department, ...(project.tags ?? []), project.description]
    .filter(Boolean)
    .join(" | ") ||
  "General project delivery initiative";

const buildSummary = (project: Partial<WorkspaceProject>) => {
  const name = project.name || "Project";
  const nature = inferProjectNature(project);
  return [
    `Project: ${name}`,
    `Nature: ${nature}`,
    `Department: ${project.department || "Not assigned"}`,
    `Namespace: ${project.namespace || "default"}`,
    `Status: ${project.status || "active"}`,
    `Priority: ${project.priority || "medium"}`,
    `Schedule: ${project.start_date || project.startDate || "TBD"} to ${project.end_date || project.endDate || "TBD"}`,
    `Budget: ${project.budget || "Not provided"}`,
    `Tags: ${(project.tags ?? []).join(", ") || "None"}`,
  ].join("\n");
};

const templatePaletteLead = (standard: DocumentTemplateStandard) =>
  standard === "SAP"
    ? "Theme: SAP delivery template | Accent colors: cobalt, slate, amber | Layout: steering-ready executive pack"
    : "Theme: PMI PMO template | Accent colors: navy, teal, amber | Layout: formal governance-ready document pack";

const buildTemplateFrame = (
  project: Partial<WorkspaceProject>,
  definition: Pick<DeliverableDefinition, "phase" | "deliverableType" | "linkedChannelName">,
  standard: DocumentTemplateStandard,
  context?: DocumentGenerationContext,
) => [
  "============================================================",
  `${project.name || "Project"} | ${definition.deliverableType}`,
  "============================================================",
  `Template Standard: ${standard}`,
  templatePaletteLead(standard),
  `Phase: ${definition.phase}`,
  `Governance Channel: ${definition.linkedChannelName}`,
  `Prepared For: ${context?.organizationName || project.namespace || "Project Workspace"}`,
  `PMO Office: ${context?.portfolioOffice || project.department || "Enterprise PMO"}`,
  `Prepared By: ${context?.currentUserName || "AI Project Office"}`,
  `Generated On: ${new Date().toISOString()}`,
  "============================================================",
].join("\n");

const buildTaskLifecycleSummary = (tasks: WorkspaceTask[]) => {
  const counts = {
    backlog: tasks.filter((task) => task.status === "backlog").length,
    todo: tasks.filter((task) => task.status === "todo").length,
    "in-progress": tasks.filter((task) => task.status === "in-progress").length,
    review: tasks.filter((task) => task.status === "review").length,
    done: tasks.filter((task) => task.status === "done").length,
  };

  return [
    "Lifecycle Delivery Summary",
    `- Total tasks: ${tasks.length}`,
    `- Backlog: ${counts.backlog}`,
    `- To Do: ${counts.todo}`,
    `- In Progress: ${counts["in-progress"]}`,
    `- Review: ${counts.review}`,
    `- Done: ${counts.done}`,
  ].join("\n");
};

const buildTaskRegister = (tasks: WorkspaceTask[]) =>
  registerLines<WorkspaceTask>(
    tasks,
    (task, index) =>
      `${index + 1}. ${task.title}\n   Status: ${task.status}\n   Priority: ${task.priority}\n   Phase: ${task.phase || "Execution"}\n   Assignee: ${task.assignee || "Unassigned"}\n   Start: ${task.start_date || "TBD"}\n   Finish: ${task.end_date || task.due_date || task.dueDate || "TBD"}\n   Progress: ${task.progress ?? 0}%\n   Duration: ${task.duration || "TBD"}\n   Dependencies: ${(task.predecessors ?? []).join(", ") || "None"}\n   Notes: ${task.description || "No notes"}`,
    "1. No tasks are linked yet. Add the work breakdown structure, dependencies, and owners.",
  );

const buildTicketRegister = (tickets: WorkspaceTicket[]) =>
  registerLines<WorkspaceTicket>(
    tickets,
    (ticket, index) =>
      `${index + 1}. ${ticket.title}\n   Status: ${ticket.status}\n   Priority: ${ticket.priority}\n   Assignee: ${ticket.assignee}\n   SLA: ${ticket.sla}\n   Task Link: ${ticket.taskId || "Not linked"}\n   Notes: ${ticket.description || "No notes"}`,
    "1. No tickets are linked yet. Capture delivery issues, support items, defects, or change requests here.",
  );

const buildFullCycleDeliverySection = (
  tasks: WorkspaceTask[],
  tickets: WorkspaceTicket[],
) => [
  buildTaskLifecycleSummary(tasks),
  "",
  "Task Register",
  buildTaskRegister(tasks),
  "",
  "Ticket and Issue Register",
  buildTicketRegister(tickets),
].join("\n");

const phaseChannelName = (projectName: string, phase: DeliverableDefinition["phase"]) => {
  if (phase === "Execution" || phase === "Monitoring & Controlling") {
    return `${projectName} Deliverables Review`;
  }
  if (phase === "Closing") {
    return `${projectName} Approvals`;
  }
  return `${projectName} Community`;
};

const applyTemplateStandard = (
  definitions: DeliverableDefinition[],
  projectName: string,
  standard: DocumentTemplateStandard,
) => {
  if (standard === "PMI") return definitions;

  const nameOverrides: Record<string, { name: string; deliverableType: string; contentLead: string }> = {
    "project-charter": {
      name: `${projectName} SAP Project Charter`,
      deliverableType: "SAP Project Charter",
      contentLead: "SAP Delivery Context\nThis document follows an SAP-style project charter and governance structure.",
    },
    "stakeholder-register": {
      name: `${projectName} SAP Stakeholder and RACI Register`,
      deliverableType: "SAP Stakeholder Register",
      contentLead: "SAP Delivery Context\nTrack business owners, process leads, integration owners, and approval roles.",
    },
    "business-requirements-document": {
      name: `${projectName} SAP Business Blueprint`,
      deliverableType: "SAP Business Blueprint",
      contentLead: "SAP Delivery Context\nUse this blueprint to capture process scope, fit-gap decisions, and solution assumptions.",
    },
    "scope-statement": {
      name: `${projectName} SAP Scope and Fit-to-Standard Matrix`,
      deliverableType: "SAP Fit-to-Standard Matrix",
      contentLead: "SAP Delivery Context\nCapture in-scope processes, localization needs, extensions, and deferred gaps.",
    },
    "schedule-plan": {
      name: `${projectName} SAP Deployment and Cutover Plan`,
      deliverableType: "SAP Cutover Plan",
      contentLead: "SAP Delivery Context\nAlign configuration, testing, migration, training, and cutover sequencing.",
    },
    "risk-register": {
      name: `${projectName} SAP Risk and Issue Register`,
      deliverableType: "SAP Risk and Issue Register",
      contentLead: "SAP Delivery Context\nTrack data, integration, authorization, testing, and go-live readiness risks.",
    },
    "resource-plan": {
      name: `${projectName} SAP Role Mapping and Resource Plan`,
      deliverableType: "SAP Role Mapping",
      contentLead: "SAP Delivery Context\nDocument stream leads, functional consultants, technical consultants, and key users.",
    },
    "phase-deliverables-log": {
      name: `${projectName} SAP Deliverables and WRICEF Tracker`,
      deliverableType: "SAP WRICEF Tracker",
      contentLead: "SAP Delivery Context\nTrack reports, interfaces, conversions, enhancements, forms, workflows, and approvals.",
    },
    "quality-review-checklist": {
      name: `${projectName} SAP Quality Gate Checklist`,
      deliverableType: "SAP Quality Gate Checklist",
      contentLead: "SAP Delivery Context\nReview transport readiness, test evidence, defects, cutover status, and business approval.",
    },
    "project-status-report": {
      name: `${projectName} SAP Steering Status Report`,
      deliverableType: "SAP Steering Report",
      contentLead: "SAP Delivery Context\nSummarize scope, defects, integrations, data migration, and steering decisions.",
    },
    "project-signoff": {
      name: `${projectName} SAP UAT and Go-Live Sign-off`,
      deliverableType: "SAP Sign-off",
      contentLead: "SAP Delivery Context\nUse for UAT completion, cutover approval, and go-live authorization.",
    },
    "lessons-learned": {
      name: `${projectName} SAP Hypercare and Lessons Learned Log`,
      deliverableType: "SAP Hypercare Log",
      contentLead: "SAP Delivery Context\nRecord hypercare actions, transition issues, and post-go-live improvements.",
    },
  };

  return definitions.map((definition) => {
    const override = nameOverrides[definition.type];
    if (!override) return definition;
    return {
      ...definition,
      name: override.name,
      deliverableType: override.deliverableType,
      standardTemplate: "SAP",
      content: [override.contentLead, "", definition.content].join("\n"),
    };
  });
};

export const generateProjectTemplateDocuments = (
  project: Partial<WorkspaceProject>,
  standard: DocumentTemplateStandard = "PMI",
  context: DocumentGenerationContext = {},
) => {
  const name = project.name || "Project";
  const resources = project.resources ?? [];
  const teamStructure = project.teamStructure ?? [];
  const stakeholders = project.stakeholders ?? [];
  const risks = project.risks ?? [];
  const milestones = project.milestones ?? [];
  const tasks = context.tasks ?? [];
  const tickets = context.tickets ?? [];
  const summary = buildSummary(project);
  const nature = inferProjectNature(project);

  const definitions: DeliverableDefinition[] = [
    {
      type: "project-charter",
      name: `${name} Project Charter`,
      phase: "Initiation",
      deliverableType: "Charter",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "PMI",
      folder: "01 Initiation",
      linkedChannelName: phaseChannelName(name, "Initiation"),
      reviewStatus: "draft",
      content: [
        buildTemplateFrame(project, { phase: "Initiation", deliverableType: "Charter", linkedChannelName: phaseChannelName(name, "Initiation") }, standard, context),
        "",
        summary,
        "",
        "Executive Direction",
        `Portfolio Office Direction: ${context.portfolioOffice || "Enterprise PMO"}`,
        "Leadership Roles",
        registerLines<WorkspaceProjectTeamNode>(
          teamStructure,
          (node) => `- ${node.title}: ${node.name || "TBD"} | ${node.responsibilities || "Responsibilities to be confirmed"}`,
          "- PMO Director: TBD\n- Project Manager: TBD",
        ),
        "",
        "Purpose",
        project.description || "Define the strategic purpose, business outcome, and expected benefits for this project.",
        "",
        "Project Organization",
        registerLines<WorkspaceProjectTeamNode>(
          teamStructure,
          (node) => `- ${node.name} | ${node.title} | Reports to: ${node.reportsTo || "Executive sponsor"} | ${node.responsibilities || "Responsibilities to be confirmed"}`,
          "- Team structure not defined yet.",
        ),
        "",
        "Delivery Milestones",
        registerLines(
          milestones,
          (milestone) => `- ${milestone.title}: ${milestone.date || "TBD"}`,
          "- No milestones recorded.",
        ),
        "",
        buildFullCycleDeliverySection(tasks, tickets),
      ].join("\n"),
    },
    {
      type: "stakeholder-register",
      name: `${name} Stakeholder Register`,
      phase: "Initiation",
      deliverableType: "Stakeholder Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: "PMI",
      folder: "01 Initiation",
      linkedChannelName: phaseChannelName(name, "Initiation"),
      reviewStatus: "in-review",
      content: [
        buildTemplateFrame(project, { phase: "Initiation", deliverableType: "Stakeholder Register", linkedChannelName: phaseChannelName(name, "Initiation") }, standard, context),
        "",
        summary,
        "",
        "Stakeholder Register",
        registerLines<WorkspaceProjectStakeholder>(
          stakeholders,
          (stakeholder, index) =>
            `${index + 1}. ${stakeholder.name}\n   Role: ${stakeholder.role}\n   Influence: ${stakeholder.influence}\n   Interest: ${stakeholder.interest}\n   Engagement: ${stakeholder.engagement}\n   Notes: ${stakeholder.notes || "No notes"}`,
          "1. No stakeholders recorded yet. Add sponsor, PMO, business owners, delivery leads, vendors, and end-user groups.",
        ),
        "",
        "Related Delivery Watchlist",
        buildTicketRegister(tickets),
      ].join("\n"),
    },
    {
      type: "business-requirements-document",
      name: `${name} Business Requirements Document`,
      phase: "Planning",
      deliverableType: "BRD",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "PMI",
      folder: "02 Planning",
      linkedChannelName: phaseChannelName(name, "Planning"),
      content: [
        buildTemplateFrame(project, { phase: "Planning", deliverableType: "BRD", linkedChannelName: phaseChannelName(name, "Planning") }, standard, context),
        "",
        summary,
        "",
        "Business Need",
        `This project supports: ${nature}.`,
        "",
        "Key Requirements",
        registerLines(
          resources,
          (resource) => `- ${resource.role || "Contributor"} capability required from ${resource.name} at ${resource.allocation}% allocation.`,
          "- Define functional and non-functional requirements with the business team.",
        ),
        "",
        "Stakeholder Expectations",
        registerLines<WorkspaceProjectStakeholder>(
          stakeholders,
          (stakeholder) => `- ${stakeholder.name} | ${stakeholder.role} | ${stakeholder.engagement} | ${stakeholder.notes || "No notes"}`,
          "- No stakeholder register available yet.",
        ),
        "",
        "Linked Delivery Scope",
        buildTaskRegister(tasks),
      ].join("\n"),
    },
    {
      type: "scope-statement",
      name: `${name} Project Scope Statement`,
      phase: "Planning",
      deliverableType: "Scope Statement",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "PMI",
      folder: "02 Planning",
      linkedChannelName: phaseChannelName(name, "Planning"),
      content: [
        buildTemplateFrame(project, { phase: "Planning", deliverableType: "Scope Statement", linkedChannelName: phaseChannelName(name, "Planning") }, standard, context),
        "",
        summary,
        "",
        "In Scope",
        project.description || "Document the in-scope product, service, and process changes here.",
        "",
        "Out of Scope",
        "List exclusions, boundary conditions, and deferred enhancements.",
        "",
        "Assumptions and Constraints",
        `Project nature: ${nature}.`,
        "",
        "Referenced Tasks and Tickets",
        buildFullCycleDeliverySection(tasks, tickets),
      ].join("\n"),
    },
    {
      type: "schedule-plan",
      name: `${name} Project Schedule Plan`,
      phase: "Planning",
      deliverableType: "Schedule Management Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "PMI",
      folder: "02 Planning",
      linkedChannelName: phaseChannelName(name, "Planning"),
      content: [
        buildTemplateFrame(project, { phase: "Planning", deliverableType: "Schedule Management Plan", linkedChannelName: phaseChannelName(name, "Planning") }, standard, context),
        "",
        summary,
        "",
        "Schedule Strategy",
        "The schedule baseline should align milestones, resource capacity, dependencies, and risk mitigations.",
        "",
        "Resource Loading",
        registerLines(
          resources,
          (resource) => `- ${resource.name} | ${resource.role} | ${resource.plannedHours}h planned | ${resource.allocation}% allocation`,
          "- No planned resources entered yet.",
        ),
        "",
        "Schedule Risks",
        registerLines<WorkspaceProjectRisk>(
          risks,
          (risk) => `- ${risk.title} | ${risk.probability}/${risk.impact} | Owner: ${risk.owner} | Mitigation: ${risk.mitigation}`,
          "- No schedule-related risks recorded yet.",
        ),
        "",
        "Detailed Work Plan",
        buildTaskRegister(tasks),
      ].join("\n"),
    },
    {
      type: "risk-register",
      name: `${name} Risk Register`,
      phase: "Planning",
      deliverableType: "Risk Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: "PMI",
      folder: "02 Planning",
      linkedChannelName: phaseChannelName(name, "Planning"),
      reviewStatus: "in-review",
      content: [
        buildTemplateFrame(project, { phase: "Planning", deliverableType: "Risk Register", linkedChannelName: phaseChannelName(name, "Planning") }, standard, context),
        "",
        summary,
        "",
        "Risk Register",
        registerLines<WorkspaceProjectRisk>(
          risks,
          (risk, index) =>
            `${index + 1}. ${risk.title}\n   Category: ${risk.category}\n   Probability: ${risk.probability}\n   Impact: ${risk.impact}\n   Owner: ${risk.owner}\n   Status: ${risk.status}\n   Mitigation: ${risk.mitigation}\n   Description: ${risk.description}`,
          "1. No risks recorded yet. Add schedule, resource, delivery, vendor, security, and business adoption risks.",
        ),
        "",
        "Related Escalations and Tickets",
        buildTicketRegister(tickets),
      ].join("\n"),
    },
    {
      type: "resource-plan",
      name: `${name} Resource Allocation Plan`,
      phase: "Planning",
      deliverableType: "Resource Plan",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: "PMI",
      folder: "02 Planning",
      linkedChannelName: phaseChannelName(name, "Planning"),
      content: [
        buildTemplateFrame(project, { phase: "Planning", deliverableType: "Resource Plan", linkedChannelName: phaseChannelName(name, "Planning") }, standard, context),
        "",
        summary,
        "",
        "Resource Plan",
        registerLines(
          resources,
          (resource, index) => `${index + 1}. ${resource.name}\n   Role: ${resource.role}\n   Allocation: ${resource.allocation}%\n   Planned Hours: ${resource.plannedHours}\n   Member Link: ${resource.memberId || "Not linked"}`,
          "1. No resources entered yet. Add project manager, contributors, reviewers, and external collaborators.",
        ),
        "",
        "Task Load Overview",
        buildTaskLifecycleSummary(tasks),
      ].join("\n"),
    },
    {
      type: "phase-deliverables-log",
      name: `${name} Execution Deliverables Log`,
      phase: "Execution",
      deliverableType: "Deliverables Log",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: "PMO",
      folder: "03 Execution",
      linkedChannelName: phaseChannelName(name, "Execution"),
      content: [
        buildTemplateFrame(project, { phase: "Execution", deliverableType: "Deliverables Log", linkedChannelName: phaseChannelName(name, "Execution") }, standard, context),
        "",
        summary,
        "",
        "Execution Deliverables",
        registerLines(
          milestones,
          (milestone, index) => `${index + 1}. Deliverable: ${milestone.title}\n   Target Date: ${milestone.date || "TBD"}\n   Owner: Project team\n   Review Channel: ${phaseChannelName(name, "Execution")}`,
          "1. Add work package outputs, acceptance criteria, owners, and target dates.",
        ),
        "",
        "Linked Work Breakdown",
        buildTaskRegister(tasks),
      ].join("\n"),
    },
    {
      type: "quality-review-checklist",
      name: `${name} Quality Review Checklist`,
      phase: "Monitoring & Controlling",
      deliverableType: "Quality Checklist",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: "PMO",
      folder: "04 Monitoring",
      linkedChannelName: phaseChannelName(name, "Monitoring & Controlling"),
      content: [
        buildTemplateFrame(project, { phase: "Monitoring & Controlling", deliverableType: "Quality Checklist", linkedChannelName: phaseChannelName(name, "Monitoring & Controlling") }, standard, context),
        "",
        summary,
        "",
        "Review Focus",
        "- Scope alignment",
        "- Schedule performance",
        "- Risk response effectiveness",
        "- Stakeholder communication",
        "- Document approval readiness",
        "",
        "Open Tickets and Controls",
        buildTicketRegister(tickets),
      ].join("\n"),
    },
    {
      type: "project-status-report",
      name: `${name} Phase Status Report`,
      phase: "Monitoring & Controlling",
      deliverableType: "Status Report",
      documentNature: "report",
      outputFormat: "pdf",
      standardTemplate: "PMO",
      folder: "04 Monitoring",
      linkedChannelName: phaseChannelName(name, "Monitoring & Controlling"),
      content: [
        buildTemplateFrame(project, { phase: "Monitoring & Controlling", deliverableType: "Status Report", linkedChannelName: phaseChannelName(name, "Monitoring & Controlling") }, standard, context),
        "",
        summary,
        "",
        "Status Summary",
        `Current project status is ${project.status || "active"} with priority ${project.priority || "medium"}.`,
        "",
        "Top Risks",
        registerLines<WorkspaceProjectRisk>(
          risks.slice(0, 5),
          (risk) => `- ${risk.title} | ${risk.status} | ${risk.owner}`,
          "- No active risks listed.",
        ),
        "",
        buildFullCycleDeliverySection(tasks, tickets),
      ].join("\n"),
    },
    {
      type: "project-signoff",
      name: `${name} Phase Sign-off Sheet`,
      phase: "Closing",
      deliverableType: "Approval Sign-off",
      documentNature: "signoff",
      outputFormat: "pdf",
      standardTemplate: "PMI",
      folder: "05 Closing",
      linkedChannelName: phaseChannelName(name, "Closing"),
      reviewStatus: "approved",
      content: [
        buildTemplateFrame(project, { phase: "Closing", deliverableType: "Approval Sign-off", linkedChannelName: phaseChannelName(name, "Closing") }, standard, context),
        "",
        summary,
        "",
        "Sign-off Requirements",
        "- Sponsor approval",
        "- PMO Director endorsement",
        "- Project manager confirmation",
        "- Business owner acceptance",
        "- PMO archive confirmation",
        "",
        "Approval Notes",
        "Record names, dates, and approval comments here.",
        "",
        "Final Delivery Register",
        buildFullCycleDeliverySection(tasks, tickets),
      ].join("\n"),
    },
    {
      type: "lessons-learned",
      name: `${name} Lessons Learned Register`,
      phase: "Closing",
      deliverableType: "Lessons Learned",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: "PMI",
      folder: "05 Closing",
      linkedChannelName: phaseChannelName(name, "Closing"),
      content: [
        buildTemplateFrame(project, { phase: "Closing", deliverableType: "Lessons Learned", linkedChannelName: phaseChannelName(name, "Closing") }, standard, context),
        "",
        summary,
        "",
        "Lessons Learned",
        "1. What worked well",
        "2. What should improve",
        "3. Recommended actions for future projects",
        "",
        "Closed Work Summary",
        buildTaskLifecycleSummary(tasks),
      ].join("\n"),
    },
  ];

  return applyTemplateStandard(definitions, name, standard).map<WorkspaceProjectDocument>((definition) => ({
    id: makeId("doc"),
    name: definition.name,
    type: definition.type,
    category: "template",
    content: definition.content,
    uploadedAt: new Date().toISOString(),
    generated: true,
    phase: definition.phase,
    deliverableType: definition.deliverableType,
    documentNature: definition.documentNature,
    outputFormat: definition.outputFormat,
    standardTemplate: definition.standardTemplate,
    reviewStatus: definition.reviewStatus ?? "draft",
    folder: definition.folder,
    linkedChannelName: definition.linkedChannelName,
    metadata: {
      extension: definition.outputFormat,
      templateTheme: standard,
      templatePalette: standard === "SAP" ? "cobalt-slate-amber" : "navy-teal-amber",
      templateLayout: "formal-enterprise-pmo-pack",
    },
  }));
};
