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

export type DocumentTemplateStandard = "PMI" | "SAP" | "NAZAHA_980";

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

const isNazaha980Project = (project: Partial<WorkspaceProject>) => {
  const signature = [project.name, project.projectNature, project.description, project.department, ...(project.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return signature.includes("nazaha") || signature.includes("nzaha") || signature.includes("نزاه") || signature.includes("980");
};

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

const templatePaletteLead = (standard: DocumentTemplateStandard) => {
  if (standard === "NAZAHA_980") {
    return "Theme: Nazaha 980 delivery template | Branding: Leader Group + Nazaha | Layout: bilingual governance-ready project pack";
  }
  return standard === "SAP"
    ? "Theme: SAP delivery template | Accent colors: cobalt, slate, amber | Layout: steering-ready executive pack"
    : "Theme: PMI PMO template | Accent colors: navy, teal, amber | Layout: formal governance-ready document pack";
};

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

const buildFullCycleDeliverySection = (tasks: WorkspaceTask[], tickets: WorkspaceTicket[]) => [
  buildTaskLifecycleSummary(tasks),
  "",
  "Task Register",
  buildTaskRegister(tasks),
  "",
  "Ticket and Issue Register",
  buildTicketRegister(tickets),
].join("\n");

const phaseChannelName = (projectName: string, phase: DeliverableDefinition["phase"]) => {
  if (phase === "Execution" || phase === "Monitoring & Controlling") return `${projectName} Deliverables Review`;
  if (phase === "Closing") return `${projectName} Approvals`;
  return `${projectName} Community`;
};

const buildDefinition = (
  project: Partial<WorkspaceProject>,
  context: DocumentGenerationContext,
  standard: DocumentTemplateStandard,
  definition: Omit<DeliverableDefinition, "content" | "linkedChannelName"> & { sections: string[] },
): DeliverableDefinition => ({
  ...definition,
  linkedChannelName: phaseChannelName(project.name || "Project", definition.phase),
  content: [
    buildTemplateFrame(
      project,
      { phase: definition.phase, deliverableType: definition.deliverableType, linkedChannelName: phaseChannelName(project.name || "Project", definition.phase) },
      standard,
      context,
    ),
    "",
    buildSummary(project),
    "",
    ...definition.sections,
  ].join("\n"),
});

const buildGenericDefinitions = (
  project: Partial<WorkspaceProject>,
  standard: DocumentTemplateStandard,
  context: DocumentGenerationContext,
): DeliverableDefinition[] => {
  const name = project.name || "Project";
  const resources = project.resources ?? [];
  const teamStructure = project.teamStructure ?? [];
  const stakeholders = project.stakeholders ?? [];
  const risks = project.risks ?? [];
  const milestones = project.milestones ?? [];
  const tasks = context.tasks ?? [];
  const tickets = context.tickets ?? [];
  const nature = inferProjectNature(project);

  const definitions = [
    buildDefinition(project, context, standard, {
      type: "project-charter",
      name: `${name} Project Charter`,
      phase: "Initiation",
      deliverableType: "Charter",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "01 Initiation",
      reviewStatus: "draft",
      sections: [
        "Executive Direction",
        `Portfolio Office Direction: ${context.portfolioOffice || "Enterprise PMO"}`,
        "Leadership Roles",
        registerLines<WorkspaceProjectTeamNode>(teamStructure, (node) => `- ${node.title}: ${node.name || "TBD"} | ${node.responsibilities || "Responsibilities to be confirmed"}`, "- PMO Director: TBD\n- Project Manager: TBD"),
        "",
        "Purpose",
        project.description || "Define the strategic purpose, business outcome, and expected benefits for this project.",
        "",
        "Delivery Milestones",
        registerLines(milestones, (milestone) => `- ${milestone.title}: ${milestone.date || "TBD"}`, "- No milestones recorded."),
        "",
        buildFullCycleDeliverySection(tasks, tickets),
      ],
    }),
    buildDefinition(project, context, standard, {
      type: "stakeholder-register",
      name: `${name} Stakeholder Register`,
      phase: "Initiation",
      deliverableType: "Stakeholder Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "01 Initiation",
      reviewStatus: "in-review",
      sections: [
        "Stakeholder Register",
        registerLines<WorkspaceProjectStakeholder>(stakeholders, (stakeholder, index) => `${index + 1}. ${stakeholder.name}\n   Role: ${stakeholder.role}\n   Influence: ${stakeholder.influence}\n   Interest: ${stakeholder.interest}\n   Engagement: ${stakeholder.engagement}\n   Notes: ${stakeholder.notes || "No notes"}`, "1. No stakeholders recorded yet. Add sponsor, PMO, business owners, delivery leads, vendors, and end-user groups."),
      ],
    }),
    buildDefinition(project, context, standard, {
      type: "business-requirements-document",
      name: standard === "SAP" ? `${name} SAP Business Blueprint` : `${name} Business Requirements Document`,
      phase: "Planning",
      deliverableType: standard === "SAP" ? "SAP Business Blueprint" : "BRD",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "02 Planning",
      sections: ["Business Need", `This project supports: ${nature}.`, "", "Key Requirements", "- Capture functional requirements.\n- Capture non-functional requirements.\n- Capture reporting and approval requirements.", "", buildTaskRegister(tasks)],
    }),
    buildDefinition(project, context, standard, {
      type: "scope-statement",
      name: standard === "SAP" ? `${name} SAP Scope and Fit-to-Standard Matrix` : `${name} Project Scope Statement`,
      phase: "Planning",
      deliverableType: standard === "SAP" ? "SAP Fit-to-Standard Matrix" : "Scope Statement",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "02 Planning",
      sections: ["In Scope", project.description || "Document the in-scope product, service, and process changes here.", "", "Out of Scope", "List exclusions, boundary conditions, and deferred enhancements."],
    }),
    buildDefinition(project, context, standard, {
      type: "schedule-plan",
      name: standard === "SAP" ? `${name} SAP Deployment and Cutover Plan` : `${name} Project Schedule Plan`,
      phase: "Planning",
      deliverableType: standard === "SAP" ? "SAP Cutover Plan" : "Schedule Management Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "02 Planning",
      sections: ["Schedule Strategy", "The schedule baseline should align milestones, resource capacity, dependencies, and risk mitigations.", "", "Resource Loading", registerLines(resources, (resource) => `- ${resource.name} | ${resource.role} | ${resource.plannedHours}h planned | ${resource.allocation}% allocation`, "- No planned resources entered yet."), "", "Detailed Work Plan", buildTaskRegister(tasks)],
    }),
    buildDefinition(project, context, standard, {
      type: "risk-register",
      name: standard === "SAP" ? `${name} SAP Risk and Issue Register` : `${name} Risk Register`,
      phase: "Planning",
      deliverableType: standard === "SAP" ? "SAP Risk and Issue Register" : "Risk Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "02 Planning",
      reviewStatus: "in-review",
      sections: ["Risk Register", registerLines<WorkspaceProjectRisk>(risks, (risk, index) => `${index + 1}. ${risk.title}\n   Category: ${risk.category}\n   Probability: ${risk.probability}\n   Impact: ${risk.impact}\n   Owner: ${risk.owner}\n   Status: ${risk.status}\n   Mitigation: ${risk.mitigation}\n   Description: ${risk.description}`, "1. No risks recorded yet. Add schedule, resource, delivery, vendor, security, and business adoption risks."), "", buildTicketRegister(tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "resource-plan",
      name: standard === "SAP" ? `${name} SAP Role Mapping and Resource Plan` : `${name} Resource Allocation Plan`,
      phase: "Planning",
      deliverableType: standard === "SAP" ? "SAP Role Mapping" : "Resource Plan",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "02 Planning",
      sections: ["Resource Plan", registerLines(resources, (resource, index) => `${index + 1}. ${resource.name}\n   Role: ${resource.role}\n   Allocation: ${resource.allocation}%\n   Planned Hours: ${resource.plannedHours}\n   Member Link: ${resource.memberId || "Not linked"}`, "1. No resources entered yet. Add project manager, contributors, reviewers, and external collaborators.")],
    }),
    buildDefinition(project, context, standard, {
      type: "phase-deliverables-log",
      name: standard === "SAP" ? `${name} SAP Deliverables and WRICEF Tracker` : `${name} Execution Deliverables Log`,
      phase: "Execution",
      deliverableType: standard === "SAP" ? "SAP WRICEF Tracker" : "Deliverables Log",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMO",
      folder: "03 Execution",
      sections: ["Execution Deliverables", registerLines(milestones, (milestone, index) => `${index + 1}. Deliverable: ${milestone.title}\n   Target Date: ${milestone.date || "TBD"}\n   Owner: Project team`, "1. Add work package outputs, acceptance criteria, owners, and target dates."), "", buildTaskRegister(tasks)],
    }),
    buildDefinition(project, context, standard, {
      type: "quality-review-checklist",
      name: standard === "SAP" ? `${name} SAP Quality Gate Checklist` : `${name} Quality Review Checklist`,
      phase: "Monitoring & Controlling",
      deliverableType: standard === "SAP" ? "SAP Quality Gate Checklist" : "Quality Checklist",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMO",
      folder: "04 Monitoring",
      sections: ["Review Focus", "- Scope alignment\n- Schedule performance\n- Risk response effectiveness\n- Stakeholder communication\n- Document approval readiness", "", buildTicketRegister(tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "project-status-report",
      name: standard === "SAP" ? `${name} SAP Steering Status Report` : `${name} Phase Status Report`,
      phase: "Monitoring & Controlling",
      deliverableType: standard === "SAP" ? "SAP Steering Report" : "Status Report",
      documentNature: "report",
      outputFormat: "pdf",
      standardTemplate: "PMO",
      folder: "04 Monitoring",
      sections: ["Status Summary", `Current project status is ${project.status || "active"} with priority ${project.priority || "medium"}.`, "", "Top Risks", registerLines<WorkspaceProjectRisk>(risks.slice(0, 5), (risk) => `- ${risk.title} | ${risk.status} | ${risk.owner}`, "- No active risks listed."), "", buildFullCycleDeliverySection(tasks, tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "project-signoff",
      name: standard === "SAP" ? `${name} SAP UAT and Go-Live Sign-off` : `${name} Phase Sign-off Sheet`,
      phase: "Closing",
      deliverableType: standard === "SAP" ? "SAP Sign-off" : "Approval Sign-off",
      documentNature: "signoff",
      outputFormat: "pdf",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "05 Closing",
      reviewStatus: "approved",
      sections: ["Sign-off Requirements", "- Sponsor approval\n- PMO Director endorsement\n- Project manager confirmation\n- Business owner acceptance\n- PMO archive confirmation", "", buildFullCycleDeliverySection(tasks, tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "lessons-learned",
      name: standard === "SAP" ? `${name} SAP Hypercare and Lessons Learned Log` : `${name} Lessons Learned Register`,
      phase: "Closing",
      deliverableType: standard === "SAP" ? "SAP Hypercare Log" : "Lessons Learned",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: standard === "SAP" ? "SAP" : "PMI",
      folder: "05 Closing",
      sections: ["Lessons Learned", "1. What worked well\n2. What should improve\n3. Recommended actions for future projects", "", buildTaskLifecycleSummary(tasks)],
    }),
  ];

  return definitions;
};

const buildNazahaDefinitions = (
  project: Partial<WorkspaceProject>,
  context: DocumentGenerationContext,
): DeliverableDefinition[] => {
  const name = project.name || "Nzaha 980";
  const tasks = context.tasks ?? [];
  const tickets = context.tickets ?? [];
  const risks = project.risks ?? [];
  const stakeholders = project.stakeholders ?? [];
  const milestones = project.milestones ?? [];
  const standard = "NAZAHA_980" as const;
  const commonScope = [
    "Scope Baseline / خط الأساس للنطاق",
    "- Automax incident and task management.",
    "- VoIP/SIP communication management and call recording.",
    "- Helpion service and helpdesk solution.",
    "- Secure encrypted communication platform.",
    "- Infora KPI dashboards and operational analytics.",
    "- Data and integration layer, Active Directory, GIS, caller location, internal systems, and data warehouse integrations.",
    "- Data migration, testing, training, Go-Live, hypercare, operations, maintenance, and SLA reporting.",
  ].join("\n");

  return [
    buildDefinition(project, context, standard, {
      type: "nazaha-980-project-charter",
      name: `${name} - Project Charter / ميثاق المشروع`,
      phase: "Initiation",
      deliverableType: "Project Charter",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "01 Initiation",
      sections: [commonScope, "", "Key Dates", "- Kick-off: 15/04/2026", "- Planned Go-Live: 15/10/2026", "- Operations and maintenance: 36 months", "- Planned completion: 15/10/2029"],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-project-management-plan",
      name: `${name} - Project Management Plan / خطة إدارة المشروع`,
      phase: "Planning",
      deliverableType: "Project Management Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "02 Planning",
      sections: ["Governance", "- Weekly project status meeting.\n- Steering committee checkpoints.\n- Change request control.\n- Deliverable review and acceptance gates.", "", buildFullCycleDeliverySection(tasks, tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-kickoff-mom",
      name: `${name} - Kick-off Minutes of Meeting / محضر اجتماع الانطلاق`,
      phase: "Initiation",
      deliverableType: "Kick-off MOM",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "01 Initiation",
      sections: ["Agenda", "- Introductions and governance.\n- Scope confirmation.\n- Site handover and access.\n- Initial schedule and immediate actions.", "", "Action Log", "1. Confirm project team and communication matrix.\n2. Confirm workshop calendar.\n3. Confirm site readiness and environments."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-brd",
      name: `${name} - Business Requirements Document / وثيقة متطلبات الأعمال`,
      phase: "Planning",
      deliverableType: "BRD",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "02 Planning",
      sections: ["Business Workshops", "- Incident intake and classification.\n- Call center operations and recording.\n- Escalation workflows and SLA.\n- Secure communication users and policies.\n- KPI dashboards and reporting.\n- Integration and migration requirements.", "", buildTaskRegister(tasks)],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-fsd",
      name: `${name} - Functional Design Document / التصميم الوظيفي`,
      phase: "Planning",
      deliverableType: "Functional Design",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "02 Planning",
      sections: ["Functional Design Scope", "- Automax workflows, incident states, escalation rules, SLA, GIS location data, and role permissions.\n- Helpion ticketing, assets, change, support desk, and reports.\n- VoIP/SIP call flows, IVR, call routing, call recording, and call analytics.\n- Secure communication users, groups, channels, and policies.\n- Infora KPI dashboard views and filters."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-technical-design",
      name: `${name} - Technical Design HLD LLD / التصميم الفني`,
      phase: "Planning",
      deliverableType: "Technical Design",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "02 Planning",
      sections: ["Technical Architecture", "- Main Data Center and DR site.\n- Application VLAN and Database VLAN segmentation.\n- VMware/VxRail high availability.\n- Database replication and site-to-site replication.\n- Security controls, MFA/SSO, RBAC, encryption, audit logs, and Zero Trust principles."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-integration-design",
      name: `${name} - Integration Design / تصميم التكامل`,
      phase: "Planning",
      deliverableType: "Integration Design",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "02 Planning",
      sections: ["Integration Scope", "- Active Directory.\n- Internal Nazaha systems.\n- GIS and caller location services.\n- SIP, PBX, call recording, and IVR.\n- Data warehouse and KPI dashboards.\n- REST APIs, database connectors, message queues, SFTP, and webhooks."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-data-migration-plan",
      name: `${name} - Data Migration Plan / خطة ترحيل البيانات`,
      phase: "Execution",
      deliverableType: "Data Migration Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "03 Execution",
      sections: ["Migration Approach", "- Assess, cleanse, and prepare Automax legacy data.\n- ETL extraction, transformation, and loading.\n- Trial migration and reconciliation.\n- Final migration and cutover.\n- Historical incidents, tasks, escalations, call records, and operational data.", "", "Controls", "- AES/TLS encryption.\n- Audit logs.\n- Reconciliation report.\n- Migration sign-off."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-test-uat-pack",
      name: `${name} - Test Plan and UAT Pack / خطة الاختبارات وقبول المستخدم`,
      phase: "Monitoring & Controlling",
      deliverableType: "Test and UAT Pack",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: "Custom",
      folder: "04 Monitoring",
      sections: ["Test Scope", "- System testing.\n- Integration testing.\n- Performance testing.\n- Security testing.\n- High availability and DR testing.\n- UAT scenarios for incidents, calls, recording, service desk, secure messaging, dashboards, migration, and reports.", "", buildTicketRegister(tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-training-plan",
      name: `${name} - Training Plan / خطة التدريب`,
      phase: "Execution",
      deliverableType: "Training Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "03 Execution",
      sections: ["Training Groups", "- Agents.\n- Supervisors.\n- Managers.\n- IT administrators.\n- Business users.\n- Support team.", "", "Training Materials", "- User manuals.\n- Admin manuals.\n- Operation manuals.\n- Quick reference guides."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-go-live-cutover",
      name: `${name} - Go-Live Readiness and Cutover Plan / خطة الجاهزية والإطلاق`,
      phase: "Closing",
      deliverableType: "Go-Live and Cutover Plan",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "05 Closing",
      sections: ["Go-Live Readiness Gates", "- UAT signed.\n- Migration reconciled.\n- Integrations tested.\n- Training completed.\n- Production access confirmed.\n- Support model activated.\n- Rollback plan approved.", "", "Cutover Steps", "1. Freeze changes.\n2. Final backup.\n3. Final migration.\n4. Production smoke test.\n5. Business validation.\n6. Go-Live approval."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-operations-sla-report",
      name: `${name} - Monthly Operations SLA Report / تقرير التشغيل الشهري`,
      phase: "Monitoring & Controlling",
      deliverableType: "Operations SLA Report",
      documentNature: "report",
      outputFormat: "pdf",
      standardTemplate: "Custom",
      folder: "06 Operations",
      sections: ["SLA Reporting", "- Incident response and resolution.\n- Call system availability.\n- Recording system status.\n- Helpion service desk performance.\n- Secure communication platform health.\n- Dashboard availability.\n- Backup and DR status.\n- Preventive maintenance.\n- Open risks and improvement actions."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-deliverable-acceptance-form",
      name: `${name} - Deliverable Acceptance Form / نموذج قبول المخرج`,
      phase: "Closing",
      deliverableType: "Deliverable Acceptance Form",
      documentNature: "signoff",
      outputFormat: "pdf",
      standardTemplate: "Custom",
      folder: "05 Closing",
      reviewStatus: "approved",
      sections: ["Acceptance Criteria", "- Deliverable submitted in approved format.\n- Scope coverage confirmed.\n- Review comments addressed.\n- Acceptance evidence attached.\n- Authorized sign-off recorded.", "", "Approvals", registerLines<WorkspaceProjectStakeholder>(stakeholders, (stakeholder) => `- ${stakeholder.name} | ${stakeholder.role} | Signature/Date: __________`, "- Sponsor: __________\n- Project Manager: __________\n- Business Owner: __________")],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-change-request-form",
      name: `${name} - Change Request Form / نموذج طلب تغيير`,
      phase: "Monitoring & Controlling",
      deliverableType: "Change Request Form",
      documentNature: "signoff",
      outputFormat: "doc",
      standardTemplate: "Custom",
      folder: "04 Monitoring",
      sections: ["Change Request Fields", "- Change title.\n- Business reason.\n- Scope impact.\n- Schedule impact.\n- Cost impact.\n- Risk impact.\n- Approval decision.\n- Implementation owner."],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-risk-issue-register",
      name: `${name} - Risk and Issue Register / سجل المخاطر والملاحظات`,
      phase: "Monitoring & Controlling",
      deliverableType: "Risk and Issue Register",
      documentNature: "register",
      outputFormat: "xlsx",
      standardTemplate: "Custom",
      folder: "04 Monitoring",
      sections: ["Risk Register", registerLines<WorkspaceProjectRisk>(risks, (risk, index) => `${index + 1}. ${risk.title}\n   Category: ${risk.category}\n   Probability: ${risk.probability}\n   Impact: ${risk.impact}\n   Owner: ${risk.owner}\n   Status: ${risk.status}\n   Mitigation: ${risk.mitigation}\n   Description: ${risk.description}`, "1. Add risks for site readiness, integrations, data quality, UAT availability, security approvals, and cutover."), "", buildTicketRegister(tickets)],
    }),
    buildDefinition(project, context, standard, {
      type: "nazaha-980-master-deliverables-register",
      name: `${name} - Master Deliverables Register / سجل المخرجات الرئيسي`,
      phase: "Execution",
      deliverableType: "Master Deliverables Register",
      documentNature: "worksheet",
      outputFormat: "xlsx",
      standardTemplate: "Custom",
      folder: "03 Execution",
      sections: ["Deliverables", "- Project Charter.\n- Project Management Plan.\n- Kick-off MOM.\n- BRD.\n- FSD.\n- Technical Design HLD/LLD.\n- Integration Design.\n- Data Migration Plan.\n- Test Plan and UAT Pack.\n- Training Plan.\n- Go-Live Readiness and Cutover Plan.\n- Operations Monthly SLA Report.\n- Deliverable Acceptance Form.\n- Change Request Form.", "", "Milestones", registerLines(milestones, (milestone) => `- ${milestone.title}: ${milestone.date || "TBD"}`, "- No milestones recorded.")],
    }),
  ];
};

export const generateProjectTemplateDocuments = (
  project: Partial<WorkspaceProject>,
  standard: DocumentTemplateStandard = "PMI",
  context: DocumentGenerationContext = {},
) => {
  const effectiveStandard: DocumentTemplateStandard = standard === "NAZAHA_980" || isNazaha980Project(project) ? "NAZAHA_980" : standard;
  const definitions = effectiveStandard === "NAZAHA_980"
    ? buildNazahaDefinitions(project, context)
    : buildGenericDefinitions(project, effectiveStandard, context);

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
    linkedChannelName: definition.linkedChannelName,
    metadata: {
      extension: definition.outputFormat,
      templateTheme: effectiveStandard,
      templatePalette: effectiveStandard === "NAZAHA_980" ? "nazaha-green-leader-blue-red" : effectiveStandard === "SAP" ? "cobalt-slate-amber" : "navy-teal-amber",
      templateLayout: effectiveStandard === "NAZAHA_980" ? "bilingual-nazaha-980-delivery-pack" : "formal-enterprise-pmo-pack",
    },
  }));
};
