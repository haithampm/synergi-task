import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceCustomFieldConfig } from "@/lib/workspace-store";

type DynamicCustomFieldsProps = {
  fields: WorkspaceCustomFieldConfig[];
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
  columnsClassName?: string;
};

const DynamicCustomFields = ({
  fields,
  values,
  onChange,
  disabled = false,
  columnsClassName = "grid gap-4 md:grid-cols-2",
}: DynamicCustomFieldsProps) => {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
      <div>
        <p className="text-sm font-semibold">Custom Fields</p>
        <p className="text-xs text-muted-foreground">Configured by administrators and available across the workspace forms.</p>
      </div>
      <div className={columnsClassName}>
        {fields.map((field) => {
          const value = values[field.key];
          const wrapperClassName = field.type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2";

          return (
            <div key={field.id} className={wrapperClassName}>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  rows={3}
                  value={String(value ?? "")}
                  disabled={disabled}
                  placeholder={field.placeholder}
                  onChange={(event) => onChange(field.key, event.target.value)}
                />
              ) : field.type === "select" ? (
                <Select
                  value={String(value ?? "") || "__empty__"}
                  disabled={disabled}
                  onValueChange={(nextValue) => onChange(field.key, nextValue === "__empty__" ? "" : nextValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Not set</SelectItem>
                    {(field.options ?? []).map((option) => (
                      <SelectItem key={option.id} value={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "checkbox" ? (
                <label className="flex min-h-10 items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2">
                  <Checkbox
                    checked={Boolean(value)}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange(field.key, checked === true)}
                  />
                  <span className="text-sm">{field.placeholder || "Enabled"}</span>
                </label>
              ) : (
                <Input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={field.type === "number" ? String(value ?? "") : String(value ?? "")}
                  disabled={disabled}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    onChange(
                      field.key,
                      field.type === "number"
                        ? event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
              {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DynamicCustomFields;
