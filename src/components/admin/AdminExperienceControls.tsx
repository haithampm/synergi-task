import { useMemo, useState } from "react";
import { Brush, FileText, ListPlus, Plus, Settings2, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateWorkspaceSettings, useWorkspaceSettings } from "@/hooks/useProjects";
import { normalizeCustomFieldKey } from "@/lib/custom-fields";
import type { WorkspaceConfigOption, WorkspaceCustomFieldConfig } from "@/lib/workspace-store";
import { toast } from "sonner";

const formEntities: Array<{ value: WorkspaceCustomFieldConfig["entity"]; label: string }> = [
  { value: "project", label: "Project Form" },
  { value: "task", label: "Task / Activity Form" },
  { value: "ticket", label: "Ticket / Open Point Form" },
  { value: "teamMember", label: "Team Member / Resource Form" },
];

const fieldTypes: Array<WorkspaceCustomFieldConfig["type"]> = ["text", "number", "date", "select", "checkbox"];

const fontOptions = [
  { value: "inter", label: "Professional Sans", css: "Inter, system-ui, -apple-system, sans-serif" },
  { value: "serif", label: "Formal Report Serif", css: "Georgia, Times New Roman, serif" },
  { value: "mono", label: "Technical Mono", css: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { value: "handwritten", label: "Handwritten Style", css: "Comic Sans MS, Bradley Hand, Segoe Print, cursive" },
];

const themePresets = [
  { value: "pmo-blue", label: "PMO Blue", primary: "221 83% 53%", accent: "173 58% 39%" },
  { value: "executive-navy", label: "Executive Navy", primary: "222 47% 20%", accent: "38 92% 50%" },
  { value: "delivery-green", label: "Delivery Green", primary: "160 84% 30%", accent: "199 89% 48%" },
  { value: "risk-red", label: "Risk Red", primary: "0 72% 50%", accent: "38 92% 50%" },
];

const emptyField = {
  entity: "project" as WorkspaceCustomFieldConfig["entity"],
  type: "text" as WorkspaceCustomFieldConfig["type"],
  label: "",
  key: "",
  required: false,
  placeholder: "",
  helpText: "",
  optionsText: "",
};

const emptyListOption = { metadataKey: "projectStatus", label: "" };

const nextOption = (label: string, index: number): WorkspaceConfigOption => ({
  id: `${normalizeCustomFieldKey(label)}-${Date.now()}`,
  label,
  value: normalizeCustomFieldKey(label),
  active: true,
  order: index + 1,
});

export default function AdminExperienceControls() {
  const { data: settings } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const [fieldDraft, setFieldDraft] = useState(emptyField);
  const [listDraft, setListDraft] = useState(emptyListOption);
  const [saving, setSaving] = useState(false);

  const visible = typeof window !== "undefined" && window.location.pathname === "/settings";
  const currentFont = String((settings?.appearance as any)?.fontFamily ?? "inter");
  const currentPreset = String((settings?.appearance as any)?.themePreset ?? "pmo-blue");
  const selectedPreset = themePresets.find((preset) => preset.value === currentPreset) ?? themePresets[0];
  const selectedFont = fontOptions.find((font) => font.value === currentFont) ?? fontOptions[0];
  const metadataFields = useMemo(() => settings?.metadata ?? [], [settings]);

  if (!visible || !settings) return null;

  const saveSettings = async (nextSettings: typeof settings, message: string) => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync(nextSettings);
      window.dispatchEvent(new CustomEvent("workspace-theme-changed", { detail: nextSettings.appearance }));
      toast.success(message);
    } finally {
      setSaving(false);
    }
  };

  const addField = async () => {
    if (!fieldDraft.label.trim()) return toast.error("Field label is required");
    const key = normalizeCustomFieldKey(fieldDraft.key || fieldDraft.label);
    if (!key) return toast.error("Field key is required");
    const duplicate = settings.customFields.some((field) => field.entity === fieldDraft.entity && field.key === key);
    if (duplicate) return toast.error("This field already exists on the selected form");

    const options = fieldDraft.type === "select"
      ? fieldDraft.optionsText.split(/[,
]/).map((item) => item.trim()).filter(Boolean).map((label, index) => nextOption(label, index))
      : undefined;

    const nextField: WorkspaceCustomFieldConfig = {
      id: `custom-${fieldDraft.entity}-${Date.now()}`,
      entity: fieldDraft.entity,
      key,
      label: fieldDraft.label.trim(),
      type: fieldDraft.type,
      placeholder: fieldDraft.placeholder.trim(),
      helpText: fieldDraft.helpText.trim(),
      required: fieldDraft.required,
      active: true,
      options,
    };

    await saveSettings({ ...settings, customFields: [...settings.customFields, nextField] }, "Custom field added. It will appear on the selected form.");
    setFieldDraft(emptyField);
  };

  const toggleField = async (id: string) => {
    await saveSettings({
      ...settings,
      customFields: settings.customFields.map((field) => field.id === id ? { ...field, active: !field.active } : field),
    }, "Field visibility updated");
  };

  const addListOption = async () => {
    if (!listDraft.label.trim()) return toast.error("List option label is required");
    await saveSettings({
      ...settings,
      metadata: settings.metadata.map((field) => field.key === listDraft.metadataKey ? {
        ...field,
        options: [...field.options, nextOption(listDraft.label.trim(), field.options.length)],
      } : field),
    }, "Dropdown/list option added");
    setListDraft(emptyListOption);
  };

  const toggleListOption = async (fieldKey: string, optionId: string) => {
    await saveSettings({
      ...settings,
      metadata: settings.metadata.map((field) => field.key === fieldKey ? {
        ...field,
        options: field.options.map((option) => option.id === optionId ? { ...option, active: !option.active } : option),
      } : field),
    }, "Dropdown/list option updated");
  };

  const updateAppearance = async (patch: Record<string, unknown>) => {
    await saveSettings({
      ...settings,
      appearance: { ...(settings.appearance as any), ...patch } as any,
    }, "Appearance and document branding updated");
  };

  return (
    <div className="mx-auto max-w-5xl px-6 pb-6 print:hidden">
      <Card className="glass border-primary/30 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-primary" /> Admin Experience & Form Builder</CardTitle>
          <p className="text-sm text-muted-foreground">Central admin controls for future fields, dropdown lists, report branding, document colors, and font style.</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="forms" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="forms" className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="space-y-2"><Label>Target form</Label><Select value={fieldDraft.entity} onValueChange={(value) => setFieldDraft((prev) => ({ ...prev, entity: value as WorkspaceCustomFieldConfig["entity"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{formEntities.map((entity) => <SelectItem key={entity.value} value={entity.value}>{entity.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Field type</Label><Select value={fieldDraft.type} onValueChange={(value) => setFieldDraft((prev) => ({ ...prev, type: value as WorkspaceCustomFieldConfig["type"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Field label</Label><Input value={fieldDraft.label} onChange={(event) => setFieldDraft((prev) => ({ ...prev, label: event.target.value }))} placeholder="Example: Contract Type" /></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="space-y-2"><Label>Field key</Label><Input value={fieldDraft.key} onChange={(event) => setFieldDraft((prev) => ({ ...prev, key: event.target.value }))} placeholder="auto-generated if blank" /></div>
                <div className="space-y-2"><Label>Placeholder</Label><Input value={fieldDraft.placeholder} onChange={(event) => setFieldDraft((prev) => ({ ...prev, placeholder: event.target.value }))} /></div>
                <div className="flex items-center justify-between rounded-xl border p-3"><div><Label>Required</Label><p className="text-xs text-muted-foreground">Force entry before save</p></div><Switch checked={fieldDraft.required} onCheckedChange={(checked) => setFieldDraft((prev) => ({ ...prev, required: checked }))} /></div>
              </div>
              <div className="space-y-2"><Label>Help text</Label><Input value={fieldDraft.helpText} onChange={(event) => setFieldDraft((prev) => ({ ...prev, helpText: event.target.value }))} placeholder="Short instruction shown under the field" /></div>
              {fieldDraft.type === "select" ? <div className="space-y-2"><Label>Dropdown values</Label><Textarea value={fieldDraft.optionsText} onChange={(event) => setFieldDraft((prev) => ({ ...prev, optionsText: event.target.value }))} placeholder="One value per line or comma separated" /></div> : null}
              <Button className="gap-2" onClick={addField} disabled={saving}><Plus className="h-4 w-4" /> Add Field to Form</Button>
              <div className="grid gap-2 md:grid-cols-2">
                {settings.customFields.map((field) => <div key={field.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-semibold">{field.label}</p><p className="text-xs text-muted-foreground">{field.entity} · {field.type} · {field.key}</p></div><div className="flex items-center gap-2"><Badge variant={field.active ? "default" : "secondary"}>{field.active ? "Active" : "Hidden"}</Badge><Button size="sm" variant="outline" onClick={() => toggleField(field.id)}>{field.active ? "Hide" : "Show"}</Button></div></div>)}
              </div>
            </TabsContent>

            <TabsContent value="lists" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2"><Label>List / dropdown</Label><Select value={listDraft.metadataKey} onValueChange={(value) => setListDraft((prev) => ({ ...prev, metadataKey: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{metadataFields.map((field) => <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>New option</Label><Input value={listDraft.label} onChange={(event) => setListDraft((prev) => ({ ...prev, label: event.target.value }))} placeholder="Example: On Hold" /></div>
                <div className="flex items-end"><Button className="gap-2" onClick={addListOption} disabled={saving}><ListPlus className="h-4 w-4" /> Add Option</Button></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {metadataFields.map((field) => <Card key={field.key} className="border"><CardHeader className="pb-2"><CardTitle className="text-sm">{field.label}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{field.options.map((option) => <Button key={option.id} variant={option.active ? "secondary" : "outline"} size="sm" onClick={() => toggleListOption(field.key, option.id)}>{option.label}</Button>)}</CardContent></Card>)}
              </div>
            </TabsContent>

            <TabsContent value="theme" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><Brush className="h-4 w-4 text-primary" /><p className="font-semibold">Color preset</p></div><Select value={currentPreset} onValueChange={(value) => { const preset = themePresets.find((item) => item.value === value) ?? themePresets[0]; void updateAppearance({ themePreset: preset.value, primaryColor: preset.primary, accentColor: preset.accent }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{themePresets.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Current: {selectedPreset.label}</p></CardContent></Card>
                <Card><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><Type className="h-4 w-4 text-primary" /><p className="font-semibold">Application font</p></div><Select value={currentFont} onValueChange={(value) => { const font = fontOptions.find((item) => item.value === value) ?? fontOptions[0]; void updateAppearance({ fontFamily: font.value, fontCss: font.css }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fontOptions.map((font) => <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground" style={{ fontFamily: selectedFont.css }}>Preview: Project reports and forms use this style.</p></CardContent></Card>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">Handwritten style is available as an optional visual mode. It is best for informal notes only; formal PMO reports should use Professional Sans or Formal Report Serif.</div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Report cover title</Label><Input value={String((settings.appearance as any).documentTitle ?? "PMO Delivery Report")} onChange={(event) => void updateAppearance({ documentTitle: event.target.value })} /></div>
                <div className="space-y-2"><Label>Document footer</Label><Input value={String((settings.appearance as any).documentFooter ?? "Generated by PMO Workspace")} onChange={(event) => void updateAppearance({ documentFooter: event.target.value })} /></div>
                <div className="space-y-2"><Label>Primary report color</Label><Input value={String((settings.appearance as any).primaryColor ?? selectedPreset.primary)} onChange={(event) => void updateAppearance({ primaryColor: event.target.value })} /></div>
                <div className="space-y-2"><Label>Accent report color</Label><Input value={String((settings.appearance as any).accentColor ?? selectedPreset.accent)} onChange={(event) => void updateAppearance({ accentColor: event.target.value })} /></div>
              </div>
              <Card className="overflow-hidden border-primary/30"><div className="h-3" style={{ background: `linear-gradient(90deg, hsl(${String((settings.appearance as any).primaryColor ?? selectedPreset.primary)}), hsl(${String((settings.appearance as any).accentColor ?? selectedPreset.accent)}))` }} /><CardContent className="space-y-3 p-5" style={{ fontFamily: selectedFont.css }}><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><p className="text-lg font-black">{String((settings.appearance as any).documentTitle ?? "PMO Delivery Report")}</p></div><p className="text-sm text-muted-foreground">This branding profile will be used by generated project reports, exports, and future Word/PDF templates.</p><Badge>{String((settings.appearance as any).documentFooter ?? "Generated by PMO Workspace")}</Badge></CardContent></Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
