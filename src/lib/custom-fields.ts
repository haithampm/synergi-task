import type { WorkspaceConfigOption, WorkspaceCustomFieldConfig, WorkspaceSettings } from "@/lib/workspace-store";

export type WorkspaceCustomFieldEntity = WorkspaceCustomFieldConfig["entity"];
export type WorkspaceCustomFieldValue = string | number | boolean;

export const normalizeCustomFieldKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getActiveCustomFields = (
  settings: WorkspaceSettings | undefined,
  entity: WorkspaceCustomFieldEntity,
) =>
  (settings?.customFields ?? [])
    .filter((field) => field.entity === entity && field.active)
    .map((field) => ({
      ...field,
      options: (field.options ?? []).filter((option) => option.active).sort((a, b) => a.order - b.order),
    }));

export const getCustomFieldDefaultValue = (field: WorkspaceCustomFieldConfig): WorkspaceCustomFieldValue =>
  field.type === "checkbox" ? false : "";

export const normalizeCustomFieldValues = (
  fields: WorkspaceCustomFieldConfig[],
  values?: Record<string, WorkspaceCustomFieldValue>,
) =>
  fields.reduce<Record<string, WorkspaceCustomFieldValue>>((acc, field) => {
    if (values && field.key in values) {
      acc[field.key] = values[field.key];
      return acc;
    }

    acc[field.key] = getCustomFieldDefaultValue(field);
    return acc;
  }, {});

export const customFieldOptionsToStrings = (options?: WorkspaceConfigOption[]) =>
  (options ?? []).filter((option) => option.active).sort((a, b) => a.order - b.order).map((option) => option.label);
