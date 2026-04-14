import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, FileText, ArrowRight, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { parseMsProjectXml, parseCsvTasks, exportToMsProjectXml, exportToCsv, type MppProject, type MppTask } from '@/lib/ms-project';
import { useProjects, useTasks, useCreateProject, useCreateTask } from '@/hooks/useProjects';
import { toast } from 'sonner';

const ImportExport = () => {
  const [importedProject, setImportedProject] = useState<MppProject | null>(null);
  const [importedTasks, setImportedTasks] = useState<MppTask[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [exportProject, setExportProject] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const createProject = useCreateProject();
  const createTask = useCreateTask();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'mpp') {
      toast.error('Binary .mpp files require server-side processing. Please save your project as XML from MS Project (File → Save As → XML Format) and upload the .xml file instead.');
      return;
    }

    const text = await file.text();

    try {
      if (ext === 'xml') {
        const project = parseMsProjectXml(text);
        setImportedProject(project);
        setImportedTasks(project.tasks);
        setShowPreview(true);
        toast.success(`Parsed ${project.tasks.length} tasks from "${project.name}"`);
      } else if (ext === 'csv') {
        const csvTasks = parseCsvTasks(text);
        setImportedProject({ name: file.name.replace(/\.csv$/, ''), author: '', startDate: '', finishDate: '', tasks: csvTasks });
        setImportedTasks(csvTasks);
        setShowPreview(true);
        toast.success(`Parsed ${csvTasks.length} tasks from CSV`);
      } else {
        toast.error('Unsupported format. Use .xml (MS Project XML) or .csv files.');
      }
    } catch (err) {
      toast.error('Failed to parse file. Please check the format.');
      console.error(err);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importedProject || importedTasks.length === 0) return;
    setImporting(true);
    setImportProgress(0);

    try {
      // Create the project
      const project = await createProject.mutateAsync({
        name: importedProject.name,
        description: `Imported from MS Project. ${importedTasks.length} tasks.`,
        priority: 'medium',
        start_date: importedProject.startDate?.slice(0, 10),
        end_date: importedProject.finishDate?.slice(0, 10),
      });

      // Create tasks in batches
      const total = importedTasks.length;
      for (let i = 0; i < total; i++) {
        const t = importedTasks[i];
        await createTask.mutateAsync({
          title: t.name,
          description: t.milestone ? '🏁 Milestone' : '',
          priority: t.priority || 'medium',
          project_id: project.id,
          due_date: t.finish?.slice(0, 10) || undefined,
          status: t.percentComplete >= 100 ? 'done' : t.percentComplete > 0 ? 'in-progress' : 'todo',
        });
        setImportProgress(Math.round(((i + 1) / total) * 100));
      }

      toast.success(`Imported "${importedProject.name}" with ${total} tasks!`);
      setShowPreview(false);
      setImportedProject(null);
      setImportedTasks([]);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = (format: 'xml' | 'csv') => {
    const selectedProject = projects?.find((p: any) => p.id === exportProject);
    const projectTasks = tasks?.filter((t: any) => t.project_id === exportProject) || [];

    if (!selectedProject) {
      toast.error('Select a project to export');
      return;
    }

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'xml') {
      content = exportToMsProjectXml({
        name: selectedProject.name,
        tasks: projectTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          description: t.description,
        })),
      });
      filename = `${selectedProject.name.replace(/\s+/g, '_')}.xml`;
      mimeType = 'application/xml';
    } else {
      content = exportToCsv(projectTasks.map((t: any) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
      })));
      filename = `${selectedProject.name.replace(/\s+/g, '_')}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported "${selectedProject.name}" as ${format.toUpperCase()}`);
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Import MS Project files or export your projects" />
      <div className="p-6 space-y-6 animate-fade-in max-w-4xl">
        {/* Import Section */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-primary" />
              Import Project Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import project plans from MS Project XML format or CSV files. 
              To convert .mpp files, open them in MS Project and save as XML (File → Save As → XML).
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.csv,.mpp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} className="gradient-primary text-primary-foreground shadow-glow">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Select File (.xml, .csv)
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { format: 'MS Project XML', ext: '.xml', supported: true },
                { format: 'CSV', ext: '.csv', supported: true },
                { format: 'MS Project Binary', ext: '.mpp', supported: false },
              ].map(f => (
                <div key={f.ext} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{f.format}</p>
                    <p className="text-[10px] text-muted-foreground">{f.ext}</p>
                  </div>
                  {f.supported ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-accent" />
              Export Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export your project as MS Project XML — opens directly in Microsoft Project (File → Open). Also available as CSV.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={exportProject} onValueChange={setExportProject}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleExport('xml')} disabled={!exportProject} className="gradient-primary text-primary-foreground shadow-glow">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Export for MS Project (.xml)
              </Button>
              <Button onClick={() => handleExport('csv')} variant="outline" disabled={!exportProject}>
                <FileText className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Preview: {importedProject?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div><span className="text-muted-foreground">Tasks:</span> <strong>{importedTasks.length}</strong></div>
                <div><span className="text-muted-foreground">Milestones:</span> <strong>{importedTasks.filter(t => t.milestone).length}</strong></div>
                <div><span className="text-muted-foreground">Summary tasks:</span> <strong>{importedTasks.filter(t => t.summary).length}</strong></div>
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">Importing... {importProgress}%</p>
                </div>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium text-xs">ID</th>
                      <th className="text-left p-2 font-medium text-xs">Task Name</th>
                      <th className="text-left p-2 font-medium text-xs">Start</th>
                      <th className="text-left p-2 font-medium text-xs">Finish</th>
                      <th className="text-left p-2 font-medium text-xs">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedTasks.slice(0, 50).map((t) => (
                      <tr key={t.uid} className="border-t border-border hover:bg-muted/30">
                        <td className="p-2 text-xs text-muted-foreground">{t.id}</td>
                        <td className="p-2">
                          <span style={{ paddingLeft: `${(t.outlineLevel - 1) * 16}px` }} className="flex items-center gap-1">
                            {t.milestone && <span>🏁</span>}
                            {t.summary && <strong>{t.name}</strong>}
                            {!t.summary && t.name}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{t.start?.slice(0, 10)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{t.finish?.slice(0, 10)}</td>
                        <td className="p-2">
                          <Badge variant={t.percentComplete >= 100 ? 'default' : 'secondary'} className="text-[10px]">
                            {t.percentComplete}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importedTasks.length > 50 && (
                  <p className="p-2 text-xs text-muted-foreground text-center border-t border-border">
                    Showing 50 of {importedTasks.length} tasks
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowPreview(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing} className="gradient-primary text-primary-foreground">
                  {importing ? 'Importing...' : `Import ${importedTasks.length} Tasks`}
                  {!importing && <ArrowRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ImportExport;
