import {
  makeId,
  type WorkspaceProject,
  type WorkspaceProjectDocument,
  type WorkspaceProjectRisk,
  type WorkspaceProjectStakeholder,
  type WorkspaceProjectTask,
  type WorkspaceTask,
  type WorkspaceTicket,
} from "@/lib/workspace-store";

export type DocumentTemplateStandard = "PMI" | "SAP" | "NAZAHA_980";

type DocumentGenerationContext = {
  tasks?: WorkspaceTask[];
  tickets?: WorkspaceTicket[];
  currentUserName?: string;
  organizationName?: string;
  portfolioOffice?: string;
};

type DeliverableDefinition = {
  type: string;
  name: string;
  phase: NonNullable<WorkspaceProjectDocument["phase"]>;
  deliverableType: string;
  documentNature: NonNullable<WorkspaceProjectDocument["documentNature"]>;
  outputFormat: NonNullable<WorkspaceProjectDocument["outputFormat"]>;
  standardTemplate: NonNullable<WorkspaceProjectDocument["standardTemplate"]>;
  folder: string;
  reviewStatus?: NonNullable<WorkspaceProjectDocument["reviewStatus"]>;
  content: string;
};

const value = (input?: string | number | boolean | null) => (input === undefined || input === null ? "" : String(input));
const projectName = (project: Partial<WorkspaceProject>) => value(project.name) || "Project";
const projectStart = (project: Partial<WorkspaceProject>) => value(project.start_date || project.startDate);
const projectEnd = (project: Partial<WorkspaceProject>) => value(project.end_date || project.endDate);
const projectNature = (project: Partial<WorkspaceProject>) => value(project.projectNature || project.description || project.department);
const tags = (project: Partial<WorkspaceProject>) => (project.tags ?? []).join(", ");

const table = (headers: string[], rows: Array<Array<string | number | undefined | null>>) => [
  headers.join(" | "),
  ...rows.map((row) => row.map((cell) => value(cell)).join(" | ")),
].join("\n");

const blankRows = (count: number, columns: number) =>
  Array.from({ length: count }, () => Array.from({ length: columns }, () => ""));

const taskRows = (tasks: WorkspaceTask[] = []) =>
  tasks.length
    ? tasks.map((task, index) => [
        index + 1,
        task.title,
        task.phase || "",
        task.status || "",
        task.priority || "",
        task.assignee || "",
        task.start_date || "",
        task.end_date || task.due_date || task.dueDate || "",
        task.progress ?? "",
        task.duration || "",
      ])
    : blankRows(8, 10);

const ticketRows = (tickets: WorkspaceTicket[] = []) =>
  tickets.length
    ? tickets.map((ticket, index) => [
        index + 1,
        ticket.title,
        ticket.status,
        ticket.priority,
        ticket.assignee,
        ticket.sla,
        ticket.description,
      ])
    : blankRows(6, 7);

const riskRows = (risks: WorkspaceProjectRisk[] = []) =>
  risks.length
    ? risks.map((risk, index) => [
        index + 1,
        risk.title,
        risk.category,
        risk.probability,
        risk.impact,
        risk.owner,
        risk.status,
        risk.mitigation,
      ])
    : blankRows(8, 8);

const stakeholderRows = (stakeholders: WorkspaceProjectStakeholder[] = []) =>
  stakeholders.length
    ? stakeholders.map((stakeholder, index) => [
        index + 1,
        stakeholder.name,
        stakeholder.role,
        stakeholder.influence,
        stakeholder.interest,
        stakeholder.engagement,
        stakeholder.notes || "",
      ])
    : blankRows(8, 7);

const milestoneRows = (milestones: Array<{ title: string; date?: string }> = []) =>
  milestones.length
    ? milestones.map((milestone, index) => [index + 1, milestone.title, milestone.date || "", "", ""])
    : blankRows(8, 5);

const resourceRows = (resources: NonNullable<WorkspaceProject["resources"]> = []) =>
  resources.length
    ? resources.map((resource, index) => [
        index + 1,
        resource.name,
        resource.role,
        resource.allocation,
        resource.plannedHours,
        "",
      ])
    : blankRows(8, 6);

const documentFrame = (
  project: Partial<WorkspaceProject>,
  context: DocumentGenerationContext,
  deliverable: string,
  standard: DocumentTemplateStandard,
  sections: string[],
) => [
  "Document Control",
  table(["Field", "Value", "Field", "Value"], [
    ["Project Name", projectName(project), "Deliverable", deliverable],
    ["Client / Organization", context.organizationName || project.namespace || "", "PMO / Department", context.portfolioOffice || project.department || ""],
    ["Prepared By", context.currentUserName || "", "Template Standard", standard === "NAZAHA_980" ? "Client Branded PMI" : standard],
    ["Version", "0.1 Draft", "Status", "Draft"],
  ]),
  "",
  "Project Profile",
  table(["Attribute", "Information", "Notes"], [
    ["Project Name", projectName(project), ""],
    ["Project Nature", projectNature(project), ""],
    ["Department", project.department || "", ""],
    ["Status", project.status || "", ""],
    ["Priority", project.priority || "", ""],
    ["Start Date", projectStart(project), ""],
    ["End Date", projectEnd(project), ""],
    ["Budget", project.budget || "", ""],
    ["Tags", tags(project), ""],
  ]),
  "",
  ...sections,
].join("\n");

const makeDefinition = (
  project: Partial<WorkspaceProject>,
  context: DocumentGenerationContext,
  standard: DocumentTemplateStandard,
  definition: Omit<DeliverableDefinition, "content"> & { sections: string[] },
): DeliverableDefinition => ({
  ...definition,
  content: documentFrame(project, context, definition.deliverableType, standard, definition.sections),
});

const templateTheme = (standard: DocumentTemplateStandard) => standard === "NAZAHA_980" ? "CLIENT_BRANDED" : standard;
const standardTemplate = (standard: DocumentTemplateStandard): NonNullable<WorkspaceProjectDocument["standardTemplate"]> =>
  standard === "NAZAHA_980" ? "Custom" : standard;

const buildSolutionDeliveryDefinitions = (
  project: Partial<WorkspaceProject>,
  standard: DocumentTemplateStandard,
  context: DocumentGenerationContext,
): DeliverableDefinition[] => {
  const name = projectName(project);
  const tasks = context.tasks ?? [];
  const tickets = context.tickets ?? [];
  const risks = project.risks ?? [];
  const stakeholders = project.stakeholders ?? [];
  const milestones = project.milestones ?? [];
  const resources = project.resources ?? [];
  const st = standardTemplate(standard);

  return [
    makeDefinition(project, context, standard, {
      type: "project-charter",
      name: `${name} - Project Charter`,
      phase: "Initiation",
      deliverableType: "Project Charter",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "01 Initiation",
      reviewStatus: "draft",
      sections: [
        "Executive Summary",
        table(["Item", "Description"], [["Business Need", project.description || ""], ["Expected Outcome", ""], ["Success Criteria", ""]]),
        "Project Objectives",
        table(["No.", "Objective", "Measurement", "Owner"], blankRows(6, 4)),
        "Scope Overview",
        table(["In Scope", "Out of Scope", "Assumptions"], blankRows(7, 3)),
        "Key Milestones",
        table(["No.", "Milestone", "Target Date", "Owner", "Status"], milestoneRows(milestones)),
        "Stakeholders",
        table(["No.", "Name", "Role", "Influence", "Interest", "Engagement", "Notes"], stakeholderRows(stakeholders)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "project-management-plan",
      name: `${name} - Project Management Plan`,
      phase: "Planning",
      deliverableType: "Project Management Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "02 Planning",
      sections: [
        "Governance Model",
        table(["Governance Area", "Approach", "Frequency", "Owner"], [["Status Reporting", "", "", ""], ["Steering Committee", "", "", ""], ["Change Control", "", "", ""], ["Risk Review", "", "", ""], ["Deliverable Acceptance", "", "", ""]]),
        "PMI Management Plans",
        table(["Knowledge Area", "Management Approach", "Key Outputs"], [["Scope", "", ""], ["Schedule", "", ""], ["Cost", "", ""], ["Quality", "", ""], ["Resources", "", ""], ["Communications", "", ""], ["Risk", "", ""], ["Procurement", "", ""], ["Stakeholders", "", ""]]),
        "Resource Plan",
        table(["No.", "Name", "Role", "Allocation %", "Planned Hours", "Notes"], resourceRows(resources)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "kickoff-minutes",
      name: `${name} - Kick-off Minutes of Meeting`,
      phase: "Initiation",
      deliverableType: "Kick-off Minutes of Meeting",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "01 Initiation",
      sections: [
        "Meeting Details",
        table(["Date", "Time", "Location", "Facilitator"], [["", "", "", ""]]),
        "Attendees",
        table(["No.", "Name", "Role", "Organization", "Attendance"], blankRows(10, 5)),
        "Agenda and Discussion",
        table(["No.", "Agenda Item", "Discussion Summary", "Decision"], blankRows(8, 4)),
        "Action Items",
        table(["No.", "Action", "Owner", "Due Date", "Status"], blankRows(10, 5)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "business-requirements-document",
      name: `${name} - Business Requirements Document`,
      phase: "Planning",
      deliverableType: "Business Requirements Document",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "02 Planning",
      sections: [
        "Business Process Scope",
        table(["Process Area", "Current State", "Target State", "Gap / Decision"], blankRows(10, 4)),
        "Functional Requirements",
        table(["Req ID", "Requirement", "Priority", "Source", "Acceptance Criteria", "Status"], blankRows(14, 6)),
        "Non-Functional Requirements",
        table(["Category", "Requirement", "Target", "Verification Method"], [["Availability", "", "", ""], ["Performance", "", "", ""], ["Security", "", "", ""], ["Audit", "", "", ""], ["Usability", "", "", ""], ["Reporting", "", "", ""]]),
        "Open Questions",
        table(["No.", "Question", "Owner", "Target Date", "Resolution"], blankRows(8, 5)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "functional-design-document",
      name: `${name} - Functional Design Document`,
      phase: "Planning",
      deliverableType: "Functional Design Document",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "02 Planning",
      sections: [
        "Solution Modules",
        table(["Module", "Purpose", "Key Functions", "Configuration Notes"], [["Incident / Case Management", "", "", ""], ["Communication / Contact Center", "", "", ""], ["Call Recording", "", "", ""], ["Service Desk", "", "", ""], ["Secure Communication", "", "", ""], ["Dashboards and Analytics", "", "", ""]]),
        "Workflow Design",
        table(["Workflow", "Trigger", "Steps", "Roles", "SLA / Escalation"], blankRows(10, 5)),
        "Roles and Permissions",
        table(["Role", "Access Level", "Functions", "Approval Required"], blankRows(8, 4)),
        "Reports and Dashboards",
        table(["Report / Dashboard", "Audience", "Data Source", "Frequency", "Filters"], blankRows(8, 5)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "technical-design-document",
      name: `${name} - Technical Design Document`,
      phase: "Planning",
      deliverableType: "Technical Design Document",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "02 Planning",
      sections: [
        "Architecture Overview",
        table(["Layer", "Component", "Description", "Owner"], [["Presentation", "", "", ""], ["Application", "", "", ""], ["Integration", "", "", ""], ["Data", "", "", ""], ["Security", "", "", ""], ["Monitoring", "", "", ""]]),
        "Environment Design",
        table(["Environment", "Purpose", "Servers / Services", "Network Zone", "Notes"], [["Development", "", "", "", ""], ["Test / UAT", "", "", "", ""], ["Production", "", "", "", ""], ["DR", "", "", "", ""]]),
        "Security Design",
        table(["Control", "Design", "Owner", "Evidence"], [["Authentication", "", "", ""], ["Authorization", "", "", ""], ["Encryption", "", "", ""], ["Audit Logging", "", "", ""], ["Backup", "", "", ""], ["Monitoring", "", "", ""]]),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "integration-design-document",
      name: `${name} - Integration Design Document`,
      phase: "Planning",
      deliverableType: "Integration Design Document",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "02 Planning",
      sections: [
        "Integration Catalogue",
        table(["Interface ID", "Source", "Target", "Pattern", "Frequency", "Owner", "Status"], blankRows(12, 7)),
        "API / Data Mapping",
        table(["Entity", "Source Field", "Target Field", "Transformation Rule", "Validation"], blankRows(12, 5)),
        "Error Handling and Monitoring",
        table(["Scenario", "Expected Handling", "Alert / Log", "Owner"], blankRows(8, 4)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "data-migration-plan",
      name: `${name} - Data Migration Plan`,
      phase: "Execution",
      deliverableType: "Data Migration Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "03 Execution",
      sections: [
        "Migration Scope",
        table(["Data Object", "Source System", "Target System", "Volume", "Owner", "Status"], blankRows(10, 6)),
        "Migration Waves",
        table(["Wave", "Scope", "Planned Date", "Validation Owner", "Decision"], blankRows(6, 5)),
        "Reconciliation Controls",
        table(["Control", "Expected Result", "Evidence", "Sign-off"], blankRows(8, 4)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "test-plan-uat-pack",
      name: `${name} - Test Plan and UAT Pack`,
      phase: "Monitoring & Controlling",
      deliverableType: "Test Plan and UAT Pack",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: st,
      folder: "04 Monitoring",
      sections: [
        "Test Strategy",
        table(["Test Type", "Scope", "Owner", "Entry Criteria", "Exit Criteria"], [["System Testing", "", "", "", ""], ["Integration Testing", "", "", "", ""], ["Performance Testing", "", "", "", ""], ["Security Testing", "", "", "", ""], ["User Acceptance Testing", "", "", "", ""]]),
        "UAT Scenarios",
        table(["Scenario ID", "Business Process", "Steps", "Expected Result", "Actual Result", "Status", "Tester"], blankRows(16, 7)),
        "Defects and Issues",
        table(["No.", "Defect", "Severity", "Owner", "Target Fix Date", "Status", "Resolution"], ticketRows(tickets)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "training-plan",
      name: `${name} - Training Plan`,
      phase: "Execution",
      deliverableType: "Training Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "03 Execution",
      sections: [
        "Training Audience",
        table(["Audience", "Training Need", "Delivery Method", "Duration", "Owner"], blankRows(8, 5)),
        "Training Schedule",
        table(["Session", "Topic", "Date", "Trainer", "Participants", "Status"], blankRows(10, 6)),
        "Knowledge Transfer Checklist",
        table(["Item", "Evidence", "Owner", "Status"], blankRows(10, 4)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "go-live-readiness-cutover-plan",
      name: `${name} - Go-Live Readiness and Cutover Plan`,
      phase: "Closing",
      deliverableType: "Go-Live Readiness and Cutover Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "05 Closing",
      sections: [
        "Readiness Checklist",
        table(["Readiness Area", "Criteria", "Owner", "Evidence", "Status"], [["UAT Sign-off", "", "", "", ""], ["Migration Reconciliation", "", "", "", ""], ["Production Access", "", "", "", ""], ["Support Model", "", "", ""], ["Rollback Plan", "", "", "", ""], ["Go / No-Go Approval", "", "", "", ""]]),
        "Cutover Plan",
        table(["Step", "Activity", "Start", "Finish", "Owner", "Dependency", "Status"], blankRows(14, 7)),
        "Rollback Plan",
        table(["Trigger", "Rollback Action", "Owner", "Decision Authority"], blankRows(6, 4)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "operations-sla-report",
      name: `${name} - Monthly Operations SLA Report`,
      phase: "Monitoring & Controlling",
      deliverableType: "Monthly Operations SLA Report",
      documentNature: "report",
      outputFormat: "pdf",
      standardTemplate: st,
      folder: "06 Operations",
      sections: [
        "Service Performance Summary",
        table(["Metric", "Target", "Actual", "Status", "Comment"], blankRows(10, 5)),
        "Incidents and Requests",
        table(["No.", "Ticket", "Status", "Priority", "Assignee", "SLA", "Description"], ticketRows(tickets)),
        "Preventive Maintenance",
        table(["Activity", "Planned Date", "Completed Date", "Owner", "Evidence"], blankRows(8, 5)),
        "Improvement Actions",
        table(["No.", "Action", "Owner", "Due Date", "Status"], blankRows(8, 5)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "deliverable-acceptance-form",
      name: `${name} - Deliverable Acceptance Form`,
      phase: "Closing",
      deliverableType: "Deliverable Acceptance Form",
      documentNature: "signoff",
      outputFormat: "pdf",
      standardTemplate: st,
      folder: "05 Closing",
      reviewStatus: "draft",
      sections: [
        "Deliverable Review",
        table(["Deliverable", "Version", "Submission Date", "Review Date", "Decision"], [["", "", "", "", ""]]),
        "Acceptance Criteria",
        table(["No.", "Criteria", "Evidence", "Result", "Comment"], blankRows(8, 5)),
        "Approval",
        table(["Name", "Role", "Decision", "Signature", "Date"], blankRows(5, 5)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "change-request-form",
      name: `${name} - Change Request Form`,
      phase: "Monitoring & Controlling",
      deliverableType: "Change Request Form",
      documentNature: "signoff",
      outputFormat: "doc",
      standardTemplate: st,
      folder: "04 Monitoring",
      sections: [
        "Change Details",
        table(["Field", "Information"], [["Change Title", ""], ["Requested By", ""], ["Request Date", ""], ["Business Reason", ""], ["Description", ""]]),
        "Impact Assessment",
        table(["Impact Area", "Assessment", "Owner", "Decision"], [["Scope", "", "", ""], ["Schedule", "", "", ""], ["Cost", "", "", ""], ["Quality", "", "", ""], ["Risk", "", "", ""], ["Operations", "", "", ""]]),
        "Approval Decision",
        table(["Approver", "Decision", "Comment", "Date"], blankRows(4, 4)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "risk-and-issue-register",
      name: `${name} - Risk and Issue Register`,
      phase: "Monitoring & Controlling",
      deliverableType: "Risk and Issue Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: st,
      folder: "04 Monitoring",
      sections: [
        "Risk Register",
        table(["No.", "Risk", "Category", "Probability", "Impact", "Owner", "Status", "Mitigation"], riskRows(risks)),
        "Issue Register",
        table(["No.", "Issue", "Priority", "Owner", "Due Date", "Status", "Resolution"], blankRows(10, 7)),
      ],
    }),
    makeDefinition(project, context, standard, {
      type: "master-deliverables-register",
      name: `${name} - Master Deliverables Register`,
      phase: "Execution",
      deliverableType: "Master Deliverables Register",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: st,
      folder: "03 Execution",
      sections: [
        "Deliverables Register",
        table(["No.", "Deliverable", "Phase", "Owner", "Planned Date", "Submitted Date", "Review Status", "Acceptance Status"], [[1, "Project Charter", "Initiation", "", "", "", "", ""], [2, "Project Management Plan", "Planning", "", "", "", "", ""], [3, "Business Requirements Document", "Planning", "", "", "", "", ""], [4, "Functional Design Document", "Planning", "", "", "", "", ""], [5, "Technical Design Document", "Planning", "", "", "", "", ""], [6, "Integration Design Document", "Planning", "", "", "", "", ""], [7, "Data Migration Plan", "Execution", "", "", "", "", ""], [8, "Test Plan and UAT Pack", "Monitoring & Controlling", "", "", "", "", ""], [9, "Training Plan", "Execution", "", "", "", "", ""], [10, "Go-Live Readiness and Cutover Plan", "Closing", "", "", "", "", ""], [11, "Operations SLA Report", "Monitoring & Controlling", "", "", "", "", ""]]),
        "Linked Work Plan",
        table(["No.", "Task", "Phase", "Status", "Priority", "Assignee", "Start", "Finish", "Progress", "Duration"], taskRows(tasks)),
      ],
    }),
  ];
};

export const generateProjectTemplateDocuments = (
  project: Partial<WorkspaceProject>,
  standard: DocumentTemplateStandard = "PMI",
  context: DocumentGenerationContext = {},
) => {
  const definitions = buildSolutionDeliveryDefinitions(project, standard, context);

  return definitions.map<WorkspaceProjectDocument>((definition) => ({
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
    linkedChannelName: `${projectName(project)} Deliverables Review`,
    metadata: {
      extension: definition.outputFormat,
      templateTheme: templateTheme(standard),
      templatePalette: standard === "SAP" ? "cobalt-slate-amber" : standard === "NAZAHA_980" ? "client-green-leader-blue" : "navy-green-slate",
      templateLayout: "professional-pmi-solution-delivery-pack",
    },
  }));
};
