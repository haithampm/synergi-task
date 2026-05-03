export const ticketRegisterExportColumns = [
  "ID",
  "Project",
  "Application",
  "Requested By",
  "Request Date",
  "Description (Case)",
  "Priority",
  "Ticket Number",
  "Status",
  "Closure Date",
  "Replay",
  "Note1",
  "Note2",
] as const;

const custom = (ticket: any) =>
  ticket?.customFieldValues && typeof ticket.customFieldValues === "object" ? ticket.customFieldValues : {};

const field = (ticket: any, key: string, fallback = "") =>
  String(ticket?.[key] ?? custom(ticket)[key] ?? fallback ?? "");

const projectIdOf = (ticket: any) => ticket?.projectId ?? ticket?.project_id ?? custom(ticket).projectId ?? "";

export const mapTicketToRegisterExportRow = (ticket: any, projectNameById?: Map<string, string>) => {
  const projectId = String(projectIdOf(ticket));
  return {
    ID: field(ticket, "idText", String(ticket.id ?? "")),
    Project:
      projectNameById?.get(projectId) ||
      field(ticket, "projectName", field(ticket, "mappedProjectName", field(ticket, "rawProjectName", ""))),
    Application: field(ticket, "application"),
    "Requested By": field(ticket, "requestedBy", String(ticket.assignee ?? "")),
    "Request Date": field(ticket, "requestDate", String(ticket.createdAt ?? "").slice(0, 10)),
    "Description (Case)": field(ticket, "descriptionCase", String(ticket.description ?? "")),
    Priority: String(ticket.priority ?? field(ticket, "priority", "medium")),
    "Ticket Number": field(ticket, "ticketNumber", String(ticket.title ?? ticket.id ?? "")),
    Status: String(ticket.status ?? "open"),
    "Closure Date": field(ticket, "closureDate"),
    Replay: field(ticket, "replay", field(ticket, "reply")),
    Note1: field(ticket, "note1"),
    Note2: field(ticket, "note2"),
  };
};

export const ticketRowsToCsv = (rows: Record<string, unknown>[]) => {
  const escapeValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    ticketRegisterExportColumns.join(","),
    ...rows.map((row) => ticketRegisterExportColumns.map((column) => escapeValue(row[column])).join(",")),
  ].join("\n");
};
