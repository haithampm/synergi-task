export type SupportTicketRegisterSeedRow = {
  id: string;
  project: string;
  mappedProjectName: string;
  application: string;
  requestedBy: string;
  requestDate: string;
  descriptionCase: string;
  priority: string;
  ticketNumber: string;
  status: string;
  closureDate: string;
  reply: string;
  note1: string;
  note2: string;
};

export const supportTicketRegisterSeedVersion = "support-ticket-register-2026-05-03-v2";

// Full register rows are imported through src/lib/support-ticket-register-import.ts.
// This module remains available for future static seed rows if needed.
export const supportTicketRegisterSeed: SupportTicketRegisterSeedRow[] = [];
