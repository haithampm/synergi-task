import { makeId, type WorkspaceProject, type WorkspaceTicket } from "@/lib/workspace-store";
import type { SupportTicketRegisterSeedRow } from "@/data/supportTicketRegisterSeed";

export const approvedProjectNamesForTicketLinking = [
  "EPM-940 Phase 5",
  "EPM-Cleaning P4",
  "EPM-IDT Phase 3",
  "EPM-Smart City",
  "EPM-Smart Lighting",
  "EPM-Visual Distortion Services",
  "EPM-Webportal 2022-2025",
  "EPM-Zain Phase 3",
  "HBM-Cleaning",
  "HBM-SMO",
  "Hail-940",
  "Hail-Archiving P2",
  "Hail-Cleaning",
  "Hail-Cyber Security",
  "Hail-Etmam",
  "Hail-Gardening Old",
  "Hail-Infra 80%",
  "Hail-Investment-ICOG",
  "Hail-Revenue Collection",
  "Hail-Zain (Axionic - ERP)",
  "JRM development & Operation",
  "MRM-Operate & Maintenance 940",
  "EPM-940 Phase 4",
  "EPM-Digital Transformation",
] as const;

const normalize = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (value?: string | null) => normalize(value).replace(/\s+/g, "");

export const mapSupportTicketProjectName = (rawProjectName?: string | null) => {
  const raw = String(rawProjectName ?? "").trim();
  const key = normalize(raw);
  const compactKey = compact(raw);

  if (!key || key.startsWith("sd ")) return "";

  const exact = approvedProjectNamesForTicketLinking.find((projectName) => normalize(projectName) === key);
  if (exact) return exact;

  if (compactKey.includes("smartlighting") || compactKey.includes("smartlightning")) {
    // Do not auto-link mixed rows such as Smart Lighting / Smart City. They need manual PMO review.
    if (compactKey.includes("smartcity") || raw.includes("/")) return "";
    return "EPM-Smart Lighting";
  }

  if (compactKey.includes("smartcity")) return "EPM-Smart City";
  if (key.includes("940") && (key.includes("epm") || compactKey === "epm940")) return "EPM-940 Phase 5";
  if (key.includes("idt")) return "EPM-IDT Phase 3";
  if (key.includes("zain") || key.includes("zein") || key.includes("aamaley")) return "EPM-Zain Phase 3";
  if (key.includes("vd") || key.includes("visual") || key.includes("opward")) return "EPM-Visual Distortion Services";
  if (key.includes("dcp") || key.includes("cleaning")) return "EPM-Cleaning P4";
  if (key.includes("webportal") || key.includes("web portal")) return "EPM-Webportal 2022-2025";
  if (key.includes("jrm")) return "JRM development & Operation";
  if (key.includes("hbm") && key.includes("clean")) return "HBM-Cleaning";
  if (key.includes("hbm") || key.includes("smo")) return "HBM-SMO";
  if (key.includes("hail") && key.includes("940")) return "Hail-940";
  if (key.includes("hail") && key.includes("archiv")) return "Hail-Archiving P2";
  if (key.includes("hail") && key.includes("clean")) return "Hail-Cleaning";
  if (key.includes("hail") && key.includes("cyber")) return "Hail-Cyber Security";
  if (key.includes("hail") && key.includes("etmam")) return "Hail-Etmam";
  if (key.includes("hail") && key.includes("garden")) return "Hail-Gardening Old";
  if (key.includes("hail") && key.includes("revenue")) return "Hail-Revenue Collection";
  if (key.includes("hail") && (key.includes("zain") || key.includes("axionic"))) return "Hail-Zain (Axionic - ERP)";

  return "";
};

const normalizeStatus = (value?: string | null): WorkspaceTicket["status"] => {
  const key = normalize(value);
  if (key === "done" || key === "closed" || key === "cancelled" || key === "canceled") return "closed";
  if (key === "resolved") return "resolved";
  if (key === "in progress" || key === "inprogress") return "in-progress";
  return "open";
};

const normalizePriority = (value?: string | null): WorkspaceTicket["priority"] => {
  const key = normalize(value);
  if (key.includes("high") || key.includes("very high")) return "high";
  if (key.includes("low")) return "low";
  return "medium";
};

const splitTsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "\t" && !inQuote) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseSupportTicketRegisterTsv = (tsvText: string): SupportTicketRegisterSeedRow[] => {
  const normalized = tsvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const logicalRows: string[] = [];
  let current = "";
  let quoteCount = 0;

  normalized.split("\n").forEach((line) => {
    current = current ? `${current}\n${line}` : line;
    quoteCount += (line.match(/"/g) ?? []).length;
    if (quoteCount % 2 === 0) {
      logicalRows.push(current);
      current = "";
      quoteCount = 0;
    }
  });
  if (current.trim()) logicalRows.push(current);

  return logicalRows
    .map(splitTsvLine)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const padded = [...cells, ...Array(Math.max(0, 13 - cells.length)).fill("")];
      const row: SupportTicketRegisterSeedRow = {
        id: padded[0] ?? "",
        project: padded[1] ?? "",
        mappedProjectName: mapSupportTicketProjectName(padded[1]),
        application: padded[2] ?? "",
        requestedBy: padded[3] ?? "",
        requestDate: padded[4] ?? "",
        descriptionCase: padded[5] ?? "",
        priority: padded[6] ?? "",
        ticketNumber: padded[7] ?? "",
        status: padded[8] ?? "",
        closureDate: padded[9] ?? "",
        reply: padded[10] ?? "",
        note1: padded[11] ?? "",
        note2: padded.slice(12).join(" ").trim(),
      };
      return row;
    });
};

export const findProjectIdForSupportTicket = (
  row: Pick<SupportTicketRegisterSeedRow, "mappedProjectName" | "project">,
  projects: WorkspaceProject[],
) => {
  const mappedName = row.mappedProjectName || mapSupportTicketProjectName(row.project);
  if (!mappedName) return undefined;
  return projects.find((project) => normalize(project.name) === normalize(mappedName))?.id;
};

export const buildSupportTicketRecord = (
  row: SupportTicketRegisterSeedRow,
  projects: WorkspaceProject[],
  existingTicket?: WorkspaceTicket,
): WorkspaceTicket => {
  const projectId = findProjectIdForSupportTicket(row, projects);
  const ticketNumber = row.ticketNumber.trim();
  const ticketId = existingTicket?.id ?? ticketNumber || row.id || makeId("ticket");
  const title = ticketNumber ? `${row.id} · ${ticketNumber}` : row.id || row.descriptionCase.slice(0, 80) || "Support ticket";
  const status = normalizeStatus(row.status);

  return {
    ...(existingTicket ?? {}),
    id: ticketId,
    title,
    description: row.descriptionCase,
    status,
    priority: normalizePriority(row.priority),
    assignee: row.requestedBy || existingTicket?.assignee || "Unassigned",
    projectId,
    createdAt: row.requestDate || existingTicket?.createdAt || new Date().toISOString().slice(0, 10),
    sla: status === "closed" ? "Closed" : "Active open point",
    comments: existingTicket?.comments ?? [],
    customFieldValues: {
      ...(existingTicket?.customFieldValues ?? {}),
      source: "uploaded-support-register",
      registerId: row.id,
      idText: row.id,
      rawProjectName: row.project,
      mappedProjectName: row.mappedProjectName || mapSupportTicketProjectName(row.project),
      projectId: projectId ?? "",
      application: row.application,
      requestedBy: row.requestedBy,
      requestDate: row.requestDate,
      descriptionCase: row.descriptionCase,
      ticketNumber,
      rawStatus: row.status,
      closureDate: row.closureDate,
      reply: row.reply,
      note1: row.note1,
      note2: row.note2,
      isOpenPoint: status !== "closed" && status !== "resolved",
    },
  };
};

export const findExistingSupportTicket = (row: SupportTicketRegisterSeedRow, tickets: WorkspaceTicket[]) => {
  const registerId = normalize(row.id);
  const ticketNumber = normalize(row.ticketNumber);

  return tickets.find((ticket) => {
    const custom = ticket.customFieldValues ?? {};
    return (
      (registerId && normalize(custom.registerId as string) === registerId) ||
      (registerId && normalize(custom.idText as string) === registerId) ||
      (ticketNumber && normalize(custom.ticketNumber as string) === ticketNumber) ||
      (ticketNumber && normalize(ticket.id) === ticketNumber) ||
      (ticketNumber && normalize(ticket.title).includes(ticketNumber))
    );
  });
};

export const buildSupportTicketImportPreview = (
  rows: SupportTicketRegisterSeedRow[],
  projects: WorkspaceProject[],
  existingTickets: WorkspaceTicket[],
) => {
  const mapped = rows.map((row) => {
    const existing = findExistingSupportTicket(row, existingTickets);
    const projectId = findProjectIdForSupportTicket(row, projects);
    return {
      row,
      projectId,
      existingTicketId: existing?.id,
      action: existing ? "update" : "create",
      ticket: buildSupportTicketRecord(row, projects, existing),
    };
  });

  return {
    rows: mapped,
    total: mapped.length,
    createCount: mapped.filter((item) => item.action === "create").length,
    updateCount: mapped.filter((item) => item.action === "update").length,
    linkedProjectCount: mapped.filter((item) => item.projectId).length,
    unlinkedProjectCount: mapped.filter((item) => !item.projectId).length,
    openPointCount: mapped.filter((item) => item.ticket.customFieldValues?.isOpenPoint).length,
  };
};
