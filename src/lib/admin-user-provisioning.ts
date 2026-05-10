import { supabase } from "@/integrations/supabase/client";

export type AdminProvisionUserInput = {
  fullName: string;
  email: string;
  roleId: string;
  status: "active" | "invited" | "suspended";
  title?: string;
  department?: string;
  notes?: string;
  workspaceId?: string;
};

export type AdminProvisionUserResult = {
  ok: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  status?: "active" | "invited" | "suspended";
  workspaceId?: string;
  profileId?: string | null;
  inviteSent?: boolean;
  message?: string;
  error?: string;
};

export const provisionWorkspaceUser = async (
  input: AdminProvisionUserInput,
): Promise<AdminProvisionUserResult> => {
  const { data, error } = await supabase.functions.invoke<AdminProvisionUserResult>("admin-create-user", {
    body: input,
  });

  if (error) {
    throw new Error(error.message || "Failed to provision user through the admin invite function.");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Failed to provision user through the admin invite function.");
  }

  return data;
};
