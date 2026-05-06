import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileText, FolderTree, History, Link2, Plus, Save, Share2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useProjects, useTasks, useTickets, useUpdateProject, useWorkspaceSettings } from "@/hooks/useProjects";
import { getBrandedDownloadPayload } from "@/lib/document-export";
import { generateProjectTemplateDocuments, type DocumentTemplateStandard } from "@/lib/project-documents";
import { makeId, type WorkspaceProjectDocument } from "@/lib/workspace-store";
import { toast } from "sonner";

const defaultFolders = [
  "PMI Templates",
  "Working Docs",
  "Meeting Notes",
  "Shared Files",
  "01 Initiation",
  "02 Planning",
  "03 Execution",
  "04 Monitoring",
  "05 Closing",
  "06 Operations",
];

type DriveDocument = WorkspaceProjectDocument & { projectId: string; projectName: string };

const detectDocumentStandard = (documents?: WorkspaceProjectDocument[]): DocumentTemplateStandard => {
  const signature = (documents ?? [])
    .map((document) => `${document.standardTemplate ?? ""} ${document.metadata?.templateTheme ?? ""} ${document.name}`)
    .join(" ")
    .toLowerCase();
  if (signature.includes("nazaha") || signature.includes("nzaha") || signature.includes("980") || signature.includes("nazaha_980")) return "NAZAHA_980";
  if (signature.includes("sap")) return "SAP";
  return "PMI";
};

const DocumentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useWorkspaceSettings();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const updateProject = useUpdateProject();
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [templateStandard, setTemplateStandard] = useState<DocumentTemplateStandard>("PMI");
  const [selectedDocument, setSelectedDocument] = useState<DriveDocument | null>(null);
  const [editorContent, setEditorContent] = useState("");

  useEffect(() => {
    if (!projectId && projects[0]) {
      setProjectId(projects[0].id);
      setSearchParams({ projectId: projects[0].id }, { replace: true });
    }
  }, [projectId, projects, setSearchParams]);

  const currentProject = useMemo(() => projects.find((project) => project.id === projectId) ?? projects[0], [projectId, projects]);

  useEffect(() => {
    setTemplateStandard(detectDocumentStandard(currentProject?.documents));
  }, [currentProject]);

  const documents = useMemo<DriveDocument[]>(
    () =>
      projects.flatMap((project) =>
        (project.documents ?? []).map((document) => ({
          ...document,
          projectId: project.id,
          projectName: project.name,
        })),
      ),
    [projects],
  );

  const filteredDocuments = useMemo(() => {
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    return documents.filter((document) => {
      if (projectId && document.projectId !== projectId) return false;
      if (phaseFilter !== "all" && document.phase !== phaseFilter) return false;
      if (formatFilter !== "all" && document.outputFormat !== formatFilter) return false;
      if (reviewFilter !== "all" && document.reviewStatus !== reviewFilter) return false;
      if (!q) return true;
      return [document.name, document.type, document.folder, document.content, document.projectName, document.phase, document.deliverableType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [documents, formatFilter, phaseFilter, projectId, reviewFilter, searchParams]);

  const grouped = useMemo(
    () =>
      filteredDocuments.reduce<Record<string, DriveDocument[]>>((acc, document) => {
        const folder = document.folder || "Unfiled";
        acc[folder] = acc[folder] ?? [];
        acc[folder].push(document);
        return acc;
      }, {}),
    [filteredDocuments],
  );

  const openDocument = (document: DriveDocument) => {
    setSelectedDocument(document);
    setEditorContent(document.content);
  };

  const updateSelectedDocument = async (updates: Partial<WorkspaceProjectDocument>, summary: string) => {
    if (!selectedDocument) return;
    const project = projects.find((entry) => entry.id === selectedDocument.projectId);
    if (!project) return;
    const { projectId: _selectedProjectId, projectName: _selectedProjectName, ...documentRecord } = selectedDocument;

    const nextDocument: WorkspaceProjectDocument = {
      ...documentRecord,
      ...updates,
      content: updates.content ?? editorContent,
      lastModifiedAt: new Date().toISOString(),
      lastModifiedBy: settings?.currentUser.displayName ?? "Workspace User",
      versions: [
        ...(selectedDocument.versions ?? []),
        {
          id: makeId("version"),
          editedAt: new Date().toISOString(),
          editedBy: settings?.currentUser.displayName ?? "Workspace User",
          summary,
          content: updates.content ?? editorContent,
        },
      ],
    };

    await updateProject.mutateAsync({
      id: project.id,
      documents: (project.documents ?? []).map((document) => (document.id === nextDocument.id ? nextDocument : document)),
    });

    setSelectedDocument((current) => (current ? { ...current, ...nextDocument } : current));
  };

  const saveDocument = async () => {
    await updateSelectedDocument({}, "Updated from document drive editor");
    toast.success("Document saved with version history");
  };

  const downloadDocument = (document: DriveDocument | WorkspaceProjectDocument, projectName?: string) => {
    const { blob, extension } = getBrandedDownloadPayload(document, projectName ?? ("projectName" in document ? document.projectName : currentProject?.name));
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.name.replace(/[^\w\s\u0600-\u06FF-]/g, "").replace(/\s+/g, "_")}.${extension === "pdf" ? "doc" : extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${document.name} with approved branded format`);
  };

  const createDocument = async () => {
    if (!currentProject) return;
    const newDocument: WorkspaceProjectDocument = {
      id: makeId("doc"),
      name: `${currentProject.name} Working Note`,
      type: "working-note",
      category: "attachment",
      content: "Start documenting project updates, decisions, and actions here.",
      uploadedAt: new Date().toISOString(),
      generated: false,
      phase: "Execution",
      deliverableType: "Working Note",
      documentNature: "narrative",
      outputFormat: "doc",
      standardTemplate: templateStandard === "NAZAHA_980" ? "Custom" : templateStandard,
      reviewStatus: "draft",
      folder: "Working Docs",
      access: "project",
      createdBy: settings?.currentUser.displayName ?? "Workspace User",
      lastModifiedAt: new Date().toISOString(),
      lastModifiedBy: settings?.currentUser.displayName ?? "Workspace User",
      provider: "workspace",
      metadata: { extension: "doc", size: "Editable", templateTheme: templateStandard, templateLayout: "branded-project-document" },
      linkedChannelName: `${currentProject.name} Deliverables Review`,
      versions: [],
    };

    await updateProject.mutateAsync({
      id: currentProject.id,
      documents: [newDocument, ...(currentProject.documents ?? [])],
    });
    toast.success("Project document created with approved format metadata");
  };

  const generatePackage = async () => {
    if (!currentProject) return;
    const linkedTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === currentProject.id);
    const linkedTickets = tickets.filter((ticket) => ticket.projectId === currentProject.id);
    const generated = generateProjectTemplateDocuments(currentProject, templateStandard, {
      tasks: linkedTasks,
      tickets: linkedTickets,
      currentUserName: settings?.currentUser.displayName,
      organizationName: settings?.namespace.organization,
      portfolioOffice: settings?.namespace.portfolioOffice,
    }).map((document) => ({
      ...document,
      access: "project" as const,
      createdBy: settings?.currentUser.displayName ?? "AI Assistant",
      lastModifiedAt: new Date().toISOString(),
      lastModifiedBy: settings?.currentUser.displayName ?? "AI Assistant",
      provider: "workspace" as const,
      metadata: {
        ...(document.metadata ?? {}),
        extension: document.outputFormat ?? "doc",
        size: "Generated",
        templateLayout: document.metadata?.templateLayout ?? "branded-project-document",
      },
      versions: [
        {
          id: makeId("version"),
          editedAt: new Date().toISOString(),
          editedBy: settings?.currentUser.displayName ?? "AI Assistant",
          summary: "Initial generated version with approved branding, fonts, tables, and layout",
          content: document.content,
        },
      ],
    }));

    await updateProject.mutateAsync({
      id: currentProject.id,
      documents: [...generated, ...(currentProject.documents ?? [])],
    });
    toast.success(`${templateStandard} deliverables generated with approved branded format`);
  };

  return (
    <AppLayout>
      <AppHeader title="Document Drive" subtitle="Branded project deliverables, templates, review workflow, approval, and export-ready documents." />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card className="glass">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project Deliverables Drive</p>
                <h2 className="text-2xl font-semibold mt-1">{currentProject?.name ?? "Select project"}</h2>
                <p className="text-sm text-muted-foreground mt-1">Generated documents use the approved logos, fonts, tables, styling, and bilingual project format.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={templateStandard} onValueChange={(value) => setTemplateStandard(value as DocumentTemplateStandard)}>
                  <SelectTrigger className="w-[210px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PMI">PMI Branded Template</SelectItem>
                    <SelectItem value="SAP">SAP Branded Template</SelectItem>
                    <SelectItem value="NAZAHA_980">Nazaha 980 Template</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={createDocument}><Plus className="h-4 w-4 mr-2" />Create Document</Button>
                <Button className="gradient-primary text-primary-foreground" onClick={generatePackage}>Generate Phase Deliverables</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <p className="font-medium">Unified Formatting Engine</p>
              </div>
              <Badge variant="default">Active</Badge>
              <p className="text-sm text-muted-foreground">All generated exports now use the same branded document shell, header, footer, table styling, and font stack.</p>
              <div className="rounded-xl border p-3 bg-card/40 text-xs text-muted-foreground">
                The renderer applies Leader Group + Nazaha branding and keeps generated document metadata ready for Word, Excel-compatible output, and approval workflow.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass">
          <CardContent className="p-5 grid gap-3 xl:grid-cols-6">
            <Select value={projectId} onValueChange={(value) => { setProjectId(value); setSearchParams({ projectId: value }, { replace: true }); }}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger><SelectValue placeholder="Phase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                {["Initiation", "Planning", "Execution", "Monitoring & Controlling", "Closing"].map((phase) => (
                  <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search documents"
              value={searchParams.get("q") ?? ""}
              onChange={(event) => setSearchParams({ projectId, q: event.target.value }, { replace: true })}
            />
            <Select value={formatFilter} onValueChange={setFormatFilter}>
              <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                {["doc", "xlsx", "pdf", "txt"].map((format) => <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["draft", "in-review", "approved", "signed"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 rounded-xl border px-3 text-sm text-muted-foreground">
              <FolderTree className="h-4 w-4" />
              {filteredDocuments.length} documents
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            {Object.entries(grouped).length === 0 ? (
              <Card className="glass border-dashed">
                <CardContent className="p-10 text-center text-sm text-muted-foreground">No documents found for the current filters.</CardContent>
              </Card>
            ) : (
              Object.entries(grouped).map(([folder, folderDocuments]) => (
                <Card key={folder} className="glass">
                  <CardHeader>
                    <CardTitle className="text-lg">{folder}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {folderDocuments.map((document) => (
                      <button key={document.id} type="button" className="w-full rounded-2xl border p-4 text-left hover:bg-muted/20 transition-colors" onClick={() => openDocument(document)}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              <p className="font-medium">{document.name}</p>
                              <Badge variant="outline">{document.type}</Badge>
                              {document.phase ? <Badge variant="secondary">{document.phase}</Badge> : null}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{document.projectName} | {document.lastModifiedBy || document.createdBy || "Workspace"} | {document.lastModifiedAt ? new Date(document.lastModifiedAt).toLocaleString() : new Date(document.uploadedAt).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{document.provider || "workspace"}</Badge>
                            <Badge variant="outline">{(document.outputFormat ?? "doc").toUpperCase()}</Badge>
                            <Badge variant="outline">{document.metadata?.templateTheme ?? document.standardTemplate ?? "PMI"}</Badge>
                            <Badge variant="outline">{document.reviewStatus ?? "draft"}</Badge>
                            <Badge variant="outline">{document.access || "project"}</Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Drive Structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {defaultFolders.map((folder) => (
                <div key={folder} className="rounded-xl border p-3 bg-card/40 flex items-center justify-between">
                  <span className="text-sm font-medium">{folder}</span>
                  <Badge variant="outline">{grouped[folder]?.length ?? 0}</Badge>
                </div>
              ))}
              <div className="rounded-xl border p-4 bg-muted/10 text-sm text-muted-foreground">
                Standard phase deliverables stay linked to the project and use the same branded output when downloaded or regenerated.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedDocument && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedDocument.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedDocument.projectName}</Badge>
                  <Badge variant="secondary">{selectedDocument.folder || "Unfiled"}</Badge>
                  <Badge variant="outline">{selectedDocument.provider || "workspace"}</Badge>
                  {selectedDocument.phase ? <Badge variant="outline">{selectedDocument.phase}</Badge> : null}
                  <Badge variant="outline">{(selectedDocument.outputFormat ?? "doc").toUpperCase()}</Badge>
                  <Badge variant="outline">{selectedDocument.metadata?.templateTheme ?? selectedDocument.standardTemplate ?? "PMI"}</Badge>
                  <Badge variant="secondary">{selectedDocument.reviewStatus ?? "draft"}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-3 bg-card/40">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Deliverable</p>
                    <p className="mt-1 text-sm font-medium">{selectedDocument.deliverableType || selectedDocument.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedDocument.documentNature || "narrative"} | {selectedDocument.metadata?.templateLayout || selectedDocument.standardTemplate || "PMI"}</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-card/40">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Communication</p>
                    <p className="mt-1 text-sm font-medium">{selectedDocument.linkedChannelName || "Project Community"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the related project channel to review, comment, and approve this deliverable.</p>
                  </div>
                </div>
                <Textarea value={editorContent} onChange={(event) => setEditorContent(event.target.value)} className="min-h-[260px]" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveDocument}><Save className="h-4 w-4 mr-2" />Save</Button>
                  <Button variant="outline" onClick={() => void updateSelectedDocument({ reviewStatus: "in-review" }, "Moved document to review")}>Send for Review</Button>
                  <Button variant="outline" onClick={() => void updateSelectedDocument({ reviewStatus: "approved" }, "Approved deliverable document")}>Approve</Button>
                  <Button variant="outline" onClick={() => void updateSelectedDocument({ reviewStatus: "signed" }, "Signed-off deliverable document")}>Sign Off</Button>
                  <Button variant="outline" onClick={() => downloadDocument(selectedDocument, selectedDocument.projectName)}><Download className="h-4 w-4 mr-2" />Download</Button>
                  <Button variant="outline"><Share2 className="h-4 w-4 mr-2" />Share</Button>
                  {selectedDocument.externalUrl ? <Button variant="outline" onClick={() => window.open(selectedDocument.externalUrl, "_blank", "noopener,noreferrer")}>Open Linked File</Button> : null}
                </div>
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Version History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(selectedDocument.versions ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No saved versions yet.</p>
                    ) : (
                      (selectedDocument.versions ?? []).slice().reverse().map((version) => (
                        <div key={version.id} className="rounded-xl border p-3 bg-card/40">
                          <p className="text-sm font-medium">{version.summary}</p>
                          <p className="text-xs text-muted-foreground mt-1">{version.editedBy} | {new Date(version.editedAt).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default DocumentsPage;
