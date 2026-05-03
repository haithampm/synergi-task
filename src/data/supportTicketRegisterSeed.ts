export type SupportTicketRegisterSeedRow = {
  id: string;
  project: string;
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

export const supportTicketRegisterSeedVersion = "support-ticket-register-2026-05-03-v1";

export const supportTicketRegisterSeed: SupportTicketRegisterSeedRow[] = [];
