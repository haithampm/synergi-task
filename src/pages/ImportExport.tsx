import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, FileText, Filter, Upload, Users } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCsvTasks, parseMsProjectXml, exportToCsv, exportToMsProjectXml, type MppProject, type MppTask } from '@/lib/ms-project';
import type { WorkspaceData, WorkspaceProject, WorkspaceTeamMember, WorkspaceTicket } from '@/lib/workspace-store';
import { useAuditLogs, useChatChannels, useCreateProject, useCreateTask, useCreateTeamMember, useDashboards, useImportRadarMatrix, useImportWorkspaceData, useMeetings, usePersonalEvents, useProjectTemplates, useProjects, useReportTemplates, useStickyNotes, useTasks, useTeamMembers, useTickets, useUserAccounts, useWorkflows, useWorkspaceSettings } from '@/hooks/useProjects';
import { buildRadarTemplateCsv, parseRadarCsv, radarRowsToCleanRecords, radarRowsToCsv, type RadarImportRow } from '@/lib/radar-import';
import { toast } from 'sonner';

type ProjectBundle = {
  project: WorkspaceProject;
  tasks: any[];
  tickets?: WorkspaceTicket[];
  teamMembers?: WorkspaceTeamMember[];
};

type WorkspaceDatasetKey =
  | 'workspace'
  | 'projects'
  | 'tasks'
  | 'tickets'
  | 'teamMembers'
  | 'userAccounts'
  | 'meetings'
  | 'personalEvents'
  | 'chatChannels'
  | 'stickyNotes';

const datasetLabels: Record<WorkspaceDatasetKey, string> = {
  workspace: 'Full Workspace Package',
  projects: 'Projects List',
  tasks: 'Tasks List',
  tickets: 'Tickets List',
  teamMembers: 'Team List',
  userAccounts: 'User Accounts',
  meetings: 'Meetings',
  personalEvents: 'Personal Events',
  chatChannels: 'Chat Channels',
  stickyNotes: 'Sticky Notes',
};

type DatasetFieldOption = {
  key: string;
  label: string;
  importRequired?: boolean;
};

const datasetFieldCatalog: Record<Exclude<WorkspaceDatasetKey, 'workspace'>, DatasetFieldOption[]> = {
  projects: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'name', label: 'Project Name', importRequired: true },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'progress', label: 'Progress' },
    { key: 'department', label: 'Department' },
    { key: 'projectNature', label: 'Project Nature' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'budget', label: 'Budget' },
    { key: 'tags', label: 'Tags' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'resources', label: 'Resources' },
    { key: 'teamStructure', label: 'Team Structure' },
    { key: 'stakeholders', label: 'Stakeholders' },
    { key: 'risks', label: 'Risks' },
    { key: 'documents', label: 'Documents' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'workflowId', label: 'Workflow' },
    { key: 'radarLifecycle', label: 'Radar Lifecycle Metrics' },
    { key: 'customFieldValues', label: 'Custom Fields' },
  ],
  tasks: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'title', label: 'Task Name', importRequired: true },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'project_id', label: 'Project ID', importRequired: true },
    { key: 'projectName', label: 'Project Name' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'assignees', label: 'Assignees' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'phase', label: 'Phase' },
    { key: 'progress', label: 'Progress' },
    { key: 'workloadHours', label: 'Workload Hours' },
    { key: 'duration', label: 'Duration' },
    { key: 'predecessors', label: 'Predecessors' },
    { key: 'timesheetEntries', label: 'Timesheets' },
    { key: 'tags', label: 'Tags' },
    { key: 'customFieldValues', label: 'Custom Fields' },
  ],
  tickets: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'title', label: 'Ticket Title', importRequired: true },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'projectId', label: 'Project ID' },
    { key: 'taskId', label: 'Task ID' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'sla', label: 'SLA' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'comments', label: 'Comments' },
    { key: 'customFieldValues', label: 'Custom Fields' },
  ],
  teamMembers: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'name', label: 'Name', importRequired: true },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email', importRequired: true },
    { key: 'phone', label: 'Phone' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'avatar', label: 'Avatar' },
    { key: 'avatarColor', label: 'Avatar Color' },
    { key: 'assignedProjectIds', label: 'Assigned Projects' },
    { key: 'capacityHours', label: 'Capacity Hours' },
    { key: 'utilizationTarget', label: 'Utilization Target' },
    { key: 'privilegeRole', label: 'Privilege Role' },
    { key: 'customFieldValues', label: 'Custom Fields' },
  ],
  userAccounts: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'fullName', label: 'Full Name', importRequired: true },
    { key: 'email', label: 'Email', importRequired: true },
    { key: 'roleId', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'authProvider', label: 'Auth Provider' },
    { key: 'teamMemberId', label: 'Linked Team Member' },
    { key: 'title', label: 'Title' },
    { key: 'department', label: 'Department' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'lastAccessAt', label: 'Last Access' },
    { key: 'notes', label: 'Notes' },
  ],
  meetings: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'title', label: 'Meeting Title', importRequired: true },
    { key: 'projectId', label: 'Project ID' },
    { key: 'type', label: 'Meeting Type' },
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
    { key: 'location', label: 'Location' },
    { key: 'provider', label: 'Provider' },
    { key: 'meetingUrl', label: 'Meeting URL' },
    { key: 'attendeeIds', label: 'Attendees' },
    { key: 'notes', label: 'Notes' },
  ],
  personalEvents: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'title', label: 'Event Title', importRequired: true },
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Event Type' },
    { key: 'status', label: 'Status' },
    { key: 'ownerId', label: 'Owner ID' },
    { key: 'projectId', label: 'Project ID' },
    { key: 'notes', label: 'Notes' },
  ],
  chatChannels: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'name', label: 'Channel Name', importRequired: true },
    { key: 'topic', label: 'Topic' },
    { key: 'kind', label: 'Channel Type' },
    { key: 'projectId', label: 'Project ID' },
    { key: 'memberIds', label: 'Members' },
    { key: 'messages', label: 'Messages' },
    { key: 'quickLinks', label: 'Quick Links' },
    { key: 'whatsappGroupUrl', label: 'WhatsApp Link' },
    { key: 'readOnly', label: 'Read Only' },
  ],
  stickyNotes: [
    { key: 'id', label: 'ID', importRequired: true },
    { key: 'content', label: 'Note Content', importRequired: true },
    { key: 'done', label: 'Done' },
    { key: 'color', label: 'Color' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'updatedAt', label: 'Updated At' },
    { key: 'userAccountId', label: 'User Account ID' },
    { key: 'teamMemberId', label: 'Team Member ID' },
  ],
};

const buildInitialFieldSelection = () =>
  Object.fromEntries(
    Object.entries(datasetFieldCatalog).map(([key, fields]) => [key, fields.map((field) => field.key)]),
  ) as Record<Exclude<WorkspaceDatasetKey, 'workspace'>, string[]>;

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const stringifyCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const recordsToCsv = (records: Array<Record<string, unknown>>) => {
  if (!records.length) return '';
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  return [
    headers.join(','),
    ...records.map((record) =>
      headers
        .map((header) => `"${stringifyCsvValue(record[header]).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ].join('\n');
};

const pickRecordFields = (
  records: Array<Record<string, unknown>>,
  fields: string[],
) =>
  records.map((record) =>
    Object.fromEntries(fields.filter((field) => field in record).map((field) => [field, record[field]])),
  );

const getRequiredImportFields = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>) =>
  datasetFieldCatalog[dataset].filter((field) => field.importRequired).map((field) => field.key);

const parseGenericCsv = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return [];

  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  };

  const headers = parseLine(rows[0]);
  return rows.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
};

const parseMaybeJson = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const normalizeImportedRecords = (entity: WorkspaceDatasetKey, records: Array<Record<string, unknown>>) =>
  records.map((record) => {
    const next = Object.fromEntries(
      Object.entries(record).map(([key, value]) => {
        if (typeof value !== 'string') return [key, value];
        const trimmed = value.trim();

        if (trimmed === 'true' || trimmed === 'false') return [key, trimmed === 'true'];
        if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && ['progress', 'tasksTotal', 'tasksCompleted', 'tasksAssigned', 'capacityHours', 'utilizationTarget', 'workloadHours', 'hours'].includes(key)) {
          return [key, Number(trimmed)];
        }
        if (['tags', 'files', 'resources', 'milestones', 'teamStructure', 'stakeholders', 'risks', 'documents', 'comments', 'assignees', 'predecessors', 'timesheetEntries', 'messages', 'memberIds', 'quickLinks', 'permissions'].includes(key)) {
          return [key, parseMaybeJson(trimmed)];
        }
        if (['assignedProjectIds'].includes(key)) {
          return [key, parseMaybeJson(trimmed)];
        }
        if (entity === 'stickyNotes' && key === 'done') return [key, trimmed === 'true'];
        if (entity === 'tasks' && key === 'isMilestone') return [key, trimmed === 'true'];
        return [key, parseMaybeJson(trimmed)];
      }),
    );

    if (entity === 'teamMembers') {
      const name = String(next.name ?? '').trim();
      return {
        tasksAssigned: 0,
        tasksCompleted: 0,
        status: 'online',
        avatar: name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        assignedProjectIds: [],
        capacityHours: 40,
        utilizationTarget: 85,
        ...next,
      };
    }

    return next;
  });

type DatasetFieldSelectorProps = {
  title: string;
  description: string;
  fields: DatasetFieldOption[];
  selected: string[];
  onToggle: (field: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  requiredFields?: string[];
};

const DatasetFieldSelector = ({
  title,
  description,
  fields,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  requiredFields = [],
}: DatasetFieldSelectorProps) => (
  <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{title}</p>
          <Badge variant="secondary">{selected.length} selected</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>Select All</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>Clear Optional</Button>
      </div>
    </div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => {
        const isRequired = requiredFields.includes(field.key);
        return (
          <label key={field.key} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3">
            <Checkbox
              checked={selected.includes(field.key)}
              disabled={isRequired}
              onCheckedChange={(checked) => onToggle(field.key, checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                {isRequired ? <Badge variant="outline">Required For Import</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{field.key}</p>
            </div>
          </label>
        );
      })}
    </div>
  </div>
);

const ImportExport = () => {
  const [importedProject, setImportedProject] = useState<MppProject | null>(null);
  const [importedTasks, setImportedTasks] = useState<MppTask[]>([]);
  const [importedBundle, setImportedBundle] = useState<ProjectBundle | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showRadarPreview, setShowRadarPreview] = useState(false);
  const [exportProject, setExportProject] = useState<string>('');
  const [datasetExportType, setDatasetExportType] = useState<WorkspaceDatasetKey>('projects');
  const [datasetImportType, setDatasetImportType] = useState<WorkspaceDatasetKey>('projects');
  const [datasetImportMode, setDatasetImportMode] = useState<'merge' | 'replace'>('merge');
  const [datasetExportFields, setDatasetExportFields] = useState<Record<Exclude<WorkspaceDatasetKey, 'workspace'>, string[]>>(buildInitialFieldSelection);
  const [datasetImportFields, setDatasetImportFields] = useState<Record<Exclude<WorkspaceDatasetKey, 'workspace'>, string[]>>(buildInitialFieldSelection);
  const [radarRows, setRadarRows] = useState<RadarImportRow[]>([]);
  const [radarFileName, setRadarFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataFileInputRef = useRef<HTMLInputElement>(null);
  const radarFileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: tickets = [] } = useTickets();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: userAccounts = [] } = useUserAccounts();
  const { data: meetings = [] } = useMeetings();
  const { data: personalEvents = [] } = usePersonalEvents();
  const { data: chatChannels = [] } = useChatChannels();
  const { data: stickyNotes = [] } = useStickyNotes();
  const { data: workflows = [] } = useWorkflows();
  const { data: dashboards = [] } = useDashboards();
  const { data: reportTemplates = [] } = useReportTemplates();
  const { data: projectTemplates = [] } = useProjectTemplates();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: settings } = useWorkspaceSettings();
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const createTeamMember = useCreateTeamMember();
  const importWorkspaceData = useImportWorkspaceData();
  const importRadarMatrix = useImportRadarMatrix();

  const workspaceSnapshot: WorkspaceData = {
    projects,
    tasks,
    teamMembers,
    userAccounts,
    stickyNotes,
    meetings,
    personalEvents,
    tickets,
    chatChannels,
    workflows,
    dashboards,
    reportTemplates,
    projectTemplates,
    auditLogs,
    settings: settings as WorkspaceData['settings'],
  };

  const exportFieldOptions = useMemo(
    () => (datasetExportType === 'workspace' ? [] : datasetFieldCatalog[datasetExportType]),
    [datasetExportType],
  );
  const importFieldOptions = useMemo(
    () => (datasetImportType === 'workspace' ? [] : datasetFieldCatalog[datasetImportType]),
    [datasetImportType],
  );
  const selectedExportFields = datasetExportType === 'workspace' ? [] : datasetExportFields[datasetExportType];
  const selectedImportFields = datasetImportType === 'workspace' ? [] : datasetImportFields[datasetImportType];
  const requiredImportFields = datasetImportType === 'workspace' ? [] : getRequiredImportFields(datasetImportType);

  useEffect(() => {
    if (datasetExportType === 'workspace') return;
    setDatasetExportFields((current) => ({
      ...current,
      [datasetExportType]: current[datasetExportType]?.length ? current[datasetExportType] : datasetFieldCatalog[datasetExportType].map((field) => field.key),
    }));
  }, [datasetExportType]);

  useEffect(() => {
    if (datasetImportType === 'workspace') return;
    setDatasetImportFields((current) => {
      const currentSelection = current[datasetImportType] ?? [];
      const required = getRequiredImportFields(datasetImportType);
      const nextSelection = Array.from(new Set([
        ...(currentSelection.length ? currentSelection : datasetFieldCatalog[datasetImportType].map((field) => field.key)),
        ...required,
      ]));

      return {
        ...current,
        [datasetImportType]: nextSelection,
      };
    });
  }, [datasetImportType]);

  const getDatasetRecords = (key: WorkspaceDatasetKey) => {
    switch (key) {
      case 'workspace':
        return workspaceSnapshot;
      case 'projects':
        return projects;
      case 'tasks':
        return tasks;
      case 'tickets':
        return tickets;
      case 'teamMembers':
        return teamMembers;
      case 'userAccounts':
        return userAccounts;
      case 'meetings':
        return meetings;
      case 'personalEvents':
        return personalEvents;
      case 'chatChannels':
        return chatChannels;
      case 'stickyNotes':
        return stickyNotes;
      default:
        return [];
    }
  };

  const toggleExportField = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>, field: string, checked: boolean) => {
    setDatasetExportFields((current) => ({
      ...current,
      [dataset]: checked
        ? Array.from(new Set([...(current[dataset] ?? []), field]))
        : (current[dataset] ?? []).filter((item) => item !== field),
    }));
  };

  const toggleImportField = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>, field: string, checked: boolean) => {
    const required = getRequiredImportFields(dataset);
    if (!checked && required.includes(field)) return;

    setDatasetImportFields((current) => ({
      ...current,
      [dataset]: checked
        ? Array.from(new Set([...(current[dataset] ?? []), field, ...required]))
        : (current[dataset] ?? []).filter((item) => item !== field),
    }));
  };

  const selectAllExportFields = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>) =>
    setDatasetExportFields((current) => ({
      ...current,
      [dataset]: datasetFieldCatalog[dataset].map((field) => field.key),
    }));

  const clearExportFields = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>) =>
    setDatasetExportFields((current) => ({
      ...current,
      [dataset]: [],
    }));

  const selectAllImportFields = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>) =>
    setDatasetImportFields((current) => ({
      ...current,
      [dataset]: datasetFieldCatalog[dataset].map((field) => field.key),
    }));

  const clearImportFields = (dataset: Exclude<WorkspaceDatasetKey, 'workspace'>) =>
    setDatasetImportFields((current) => ({
      ...current,
      [dataset]: getRequiredImportFields(dataset),
    }));

  const resetImportState = () => {
    setImportedProject(null);
    setImportedTasks([]);
    setImportedBundle(null);
    setShowPreview(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'mpp') {
      toast.error('Binary .mpp files require server-side processing. Save the project as XML and upload the .xml file instead.');
      return;
    }

    const text = await file.text();

    try {
      if (ext === 'json') {
        const parsed = JSON.parse(text) as ProjectBundle;
        if (!parsed.project) {
          toast.error('Unsupported JSON package. Expected a project bundle with project details.');
        } else {
          setImportedBundle(parsed);
          setImportedProject({
            name: parsed.project.name,
            author: '',
            startDate: parsed.project.start_date || parsed.project.startDate || '',
            finishDate: parsed.project.end_date || parsed.project.endDate || '',
            tasks: (parsed.tasks || []) as MppTask[],
          });
          setImportedTasks((parsed.tasks || []) as MppTask[]);
          setShowPreview(true);
          toast.success(`Loaded project package "${parsed.project.name}"`);
        }
      } else if (ext === 'xml') {
        const project = parseMsProjectXml(text);
        setImportedBundle(null);
        setImportedProject(project);
        setImportedTasks(project.tasks);
        setShowPreview(true);
        toast.success(`Parsed ${project.tasks.length} tasks from "${project.name}"`);
      } else if (ext === 'csv') {
        const csvTasks = parseCsvTasks(text);
        setImportedBundle(null);
        setImportedProject({ name: file.name.replace(/\.csv$/, ''), author: '', startDate: '', finishDate: '', tasks: csvTasks });
        setImportedTasks(csvTasks);
        setShowPreview(true);
        toast.success(`Parsed ${csvTasks.length} tasks from CSV`);
      } else {
        toast.error('Unsupported format. Use .xml, .csv, or .json project package files.');
      }
    } catch (error) {
      toast.error('Failed to parse file. Please check the format.');
      console.error(error);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importedProject) return;
    setImporting(true);
    setImportProgress(0);

    try {
      for (const member of importedBundle?.teamMembers || []) {
        const exists = teamMembers.some(
          (current) =>
            current.email.toLowerCase() === member.email.toLowerCase() ||
            current.name.toLowerCase() === member.name.toLowerCase(),
        );
        if (!exists) {
          await createTeamMember.mutateAsync(member);
        }
      }

      const project = await createProject.mutateAsync(
        importedBundle?.project
          ? { ...importedBundle.project, name: importedBundle.project.name }
          : {
              name: importedProject.name,
              description: `Imported from schedule file. ${importedTasks.length} tasks.`,
              priority: 'medium',
              start_date: importedProject.startDate?.slice(0, 10),
              end_date: importedProject.finishDate?.slice(0, 10),
            },
      );

      const total = importedTasks.length;
      for (let i = 0; i < total; i++) {
        const task = importedTasks[i] as any;
        await createTask.mutateAsync({
          title: task.title || task.name,
          description: task.description || '',
          priority: task.priority || 'medium',
          project_id: project.id,
          due_date: task.due_date || task.finish?.slice(0, 10) || undefined,
          status: task.status || (task.percentComplete >= 100 ? 'done' : task.percentComplete > 0 ? 'in-progress' : 'todo'),
        });
        setImportProgress(total ? Math.round(((i + 1) / total) * 100) : 100);
      }

      toast.success(`Imported "${importedProject.name}" with ${total} tasks${importedBundle?.teamMembers?.length ? ` and ${importedBundle.teamMembers.length} team members` : ''}.`);
      resetImportState();
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExportSchedule = (format: 'xml' | 'csv') => {
    const selectedProject = projects.find((project: any) => project.id === exportProject);
    const projectTasks = tasks.filter((task: any) => task.project_id === exportProject);
    if (!selectedProject) {
      toast.error('Select a project to export.');
      return;
    }

    if (format === 'xml') {
      const content = exportToMsProjectXml({
        name: selectedProject.name,
        tasks: projectTasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          description: task.description,
        })),
      });
      downloadBlob(content, `${selectedProject.name.replace(/\s+/g, '_')}.xml`, 'application/xml');
    } else {
      const content = exportToCsv(
        projectTasks.map((task: any) => ({
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
        })),
      );
      downloadBlob(content, `${selectedProject.name.replace(/\s+/g, '_')}.csv`, 'text/csv');
    }

    toast.success(`Exported schedule for "${selectedProject.name}".`);
  };

  const handleExportProjectBundle = () => {
    const selectedProject = projects.find((project: any) => project.id === exportProject) as WorkspaceProject | undefined;
    if (!selectedProject) {
      toast.error('Select a project to export.');
      return;
    }

    const projectTasks = tasks.filter((task: any) => task.project_id === exportProject);
    const projectTickets = tickets.filter((ticket) => ticket.projectId === exportProject);
    const linkedMemberIds = new Set([
      ...(selectedProject.resources ?? []).map((resource) => resource.memberId).filter(Boolean),
      ...(selectedProject.teamStructure ?? []).map((node) => node.memberId).filter(Boolean),
    ]);
    const projectTeam = teamMembers.filter(
      (member) =>
        linkedMemberIds.has(member.id) ||
        (selectedProject.resources ?? []).some((resource) => resource.name.toLowerCase() === member.name.toLowerCase()) ||
        (selectedProject.teamStructure ?? []).some((node) => node.name.toLowerCase() === member.name.toLowerCase()),
    );

    const bundle: ProjectBundle = {
      project: selectedProject,
      tasks: projectTasks,
      tickets: projectTickets,
      teamMembers: projectTeam,
    };

    downloadBlob(JSON.stringify(bundle, null, 2), `${selectedProject.name.replace(/\s+/g, '_')}_project-package.json`, 'application/json');
    toast.success(`Exported project package for "${selectedProject.name}".`);
  };

  const handleExportTeam = (format: 'csv' | 'json') => {
    const selectedTeamFields = datasetExportFields.teamMembers;
    if (selectedTeamFields.length === 0) {
      toast.error('Select at least one Team field to export.');
      return;
    }

    const teamPayload = pickRecordFields(teamMembers as Array<Record<string, unknown>>, selectedTeamFields);
    if (format === 'csv') {
      downloadBlob(recordsToCsv(teamPayload), 'workspace-team.csv', 'text/csv');
    } else {
      downloadBlob(JSON.stringify(teamPayload, null, 2), 'workspace-team.json', 'application/json');
    }
    toast.success(`Exported team details as ${format.toUpperCase()}.`);
  };

  const handleDatasetExport = (format: 'json' | 'csv') => {
    const payload = getDatasetRecords(datasetExportType);
    const filename = `${datasetExportType}-${new Date().toISOString().slice(0, 10)}`;

    if (datasetExportType !== 'workspace' && selectedExportFields.length === 0) {
      toast.error('Select at least one field to export.');
      return;
    }

    if (format === 'json') {
      const exportPayload =
        datasetExportType === 'workspace'
          ? payload
          : pickRecordFields((Array.isArray(payload) ? payload : []) as Array<Record<string, unknown>>, selectedExportFields);
      downloadBlob(JSON.stringify(exportPayload, null, 2), `${filename}.json`, 'application/json');
      toast.success(`Exported ${datasetLabels[datasetExportType]} as JSON.`);
      return;
    }

    if (datasetExportType === 'workspace') {
      toast.error('Workspace package export is available as JSON only.');
      return;
    }

    const records = Array.isArray(payload) ? payload : [];
    downloadBlob(recordsToCsv(pickRecordFields(records as Array<Record<string, unknown>>, selectedExportFields)), `${filename}.csv`, 'text/csv');
    toast.success(`Exported ${datasetLabels[datasetExportType]} as CSV.`);
  };

  const handleDatasetFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (datasetImportType === 'workspace') {
          await importWorkspaceData.mutateAsync({
            entity: 'workspace',
            mode: datasetImportMode,
            records: parsed,
          });
        } else {
          const records = Array.isArray(parsed) ? parsed : [parsed];
          const allowedFields = Array.from(new Set([...selectedImportFields, ...requiredImportFields]));
          const filteredRecords = pickRecordFields(records as Array<Record<string, unknown>>, allowedFields);
          await importWorkspaceData.mutateAsync({
            entity: datasetImportType,
            mode: datasetImportMode,
            records: filteredRecords as any,
          });
        }

        toast.success(`${datasetLabels[datasetImportType]} imported successfully.`);
      } else if (ext === 'csv') {
        if (datasetImportType === 'workspace') {
          toast.error('Workspace package import requires JSON.');
          return;
        }

        const text = await file.text();
        const allowedFields = Array.from(new Set([...selectedImportFields, ...requiredImportFields]));
        const filteredRows = pickRecordFields(parseGenericCsv(text), allowedFields);
        const records = normalizeImportedRecords(datasetImportType, filteredRows);
        await importWorkspaceData.mutateAsync({
          entity: datasetImportType,
          mode: datasetImportMode,
          records: records as any,
        });
        toast.success(`${records.length} ${datasetLabels[datasetImportType]} record(s) imported from CSV.`);
      } else {
        toast.error('Use JSON or CSV for dataset import.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Dataset import failed. Please check the file structure.');
    } finally {
      if (dataFileInputRef.current) dataFileInputRef.current.value = '';
    }
  };

  const handleRadarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedRows = parseRadarCsv(text);
      if (!parsedRows.length) {
        toast.error('The radar CSV did not contain a valid implementation matrix table.');
        return;
      }

      setRadarRows(parsedRows);
      setRadarFileName(file.name);
      setShowRadarPreview(true);
      toast.success(`Loaded ${parsedRows.length} project radar row(s).`);
    } catch (error) {
      console.error(error);
      toast.error('Radar CSV parsing failed. Please check the file format.');
    } finally {
      if (radarFileInputRef.current) radarFileInputRef.current.value = '';
    }
  };

  const handleImportRadar = async () => {
    if (!radarRows.length) {
      toast.error('Load a radar CSV first.');
      return;
    }

    await importRadarMatrix.mutateAsync({
      rows: radarRows,
      sourceFileName: radarFileName,
    });
    toast.success(`Imported radar metrics for ${radarRows.length} project(s).`);
    setShowRadarPreview(false);
    setRadarRows([]);
    setRadarFileName('');
  };

  const handleDownloadRadarCleanCsv = () => {
    if (!radarRows.length) {
      toast.error('Load a radar CSV first to export the cleaned version.');
      return;
    }

    downloadBlob(
      radarRowsToCsv(radarRows),
      `${(radarFileName || 'implementation-radar').replace(/\.csv$/i, '')}-clean.csv`,
      'text/csv',
    );
    toast.success('Downloaded normalized radar CSV.');
  };

  const handleDownloadRadarTemplate = () => {
    downloadBlob(buildRadarTemplateCsv(), 'implementation-radar-template.csv', 'text/csv');
    toast.success('Downloaded radar import template.');
  };

  return (
    <AppLayout>
      <AppHeader title="Import / Export" subtitle="Import schedules or project packages, and export project details, team data, and MS Project files." />
      <div className="max-w-5xl space-y-6 p-6 animate-fade-in">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-primary" />
              Import Or Update Workspace Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import project lists, team lists, tasks, tickets, meetings, chat, sticky notes, user accounts, or a full workspace package. Merge mode updates matching records, and replace mode overwrites the selected dataset.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={datasetImportType} onValueChange={(value) => setDatasetImportType(value as WorkspaceDatasetKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose dataset" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(datasetLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={datasetImportMode} onValueChange={(value) => setDatasetImportMode(value as 'merge' | 'replace')}>
                <SelectTrigger>
                  <SelectValue placeholder="Import mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge / Update</SelectItem>
                  <SelectItem value="replace">Replace Selected Dataset</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => dataFileInputRef.current?.click()} className="gradient-primary text-primary-foreground shadow-glow" disabled={importWorkspaceData.isPending}>
                <Upload className="mr-2 h-4 w-4" />
                {importWorkspaceData.isPending ? 'Importing...' : 'Select JSON / CSV'}
              </Button>
            </div>
            {datasetImportType !== 'workspace' ? (
              <DatasetFieldSelector
                title="Import Fields"
                description="Choose which fields from the uploaded file should update the selected dataset. Matching fields like ID, name, or email stay enabled automatically for safe updates."
                fields={importFieldOptions}
                selected={selectedImportFields}
                requiredFields={requiredImportFields}
                onToggle={(field, checked) => toggleImportField(datasetImportType, field, checked)}
                onSelectAll={() => selectAllImportFields(datasetImportType)}
                onClear={() => clearImportFields(datasetImportType)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                Full workspace import keeps every dataset and field together, so field-level filtering is not applied for workspace packages.
              </div>
            )}
            <input ref={dataFileInputRef} type="file" accept=".json,.csv" onChange={handleDatasetFileSelect} className="hidden" />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Implementation Radar Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Load the implementation radar CSV, convert it into a clean normalized structure, and map each row into project portfolio metrics, project ownership, and lifecycle activity counts.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => radarFileInputRef.current?.click()} className="gradient-primary text-primary-foreground shadow-glow">
                <Upload className="mr-2 h-4 w-4" />
                Select Radar CSV
              </Button>
              <Button variant="outline" onClick={handleDownloadRadarTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button variant="outline" onClick={handleDownloadRadarCleanCsv} disabled={!radarRows.length}>
                <FileText className="mr-2 h-4 w-4" />
                Download Clean CSV
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projects Parsed</p>
                <p className="mt-2 text-2xl font-semibold">{radarRows.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapped Owners</p>
                <p className="mt-2 text-2xl font-semibold">{new Set(radarRows.map((row) => row.ownerName).filter(Boolean)).size}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Activities</p>
                <p className="mt-2 text-2xl font-semibold">{radarRows.reduce((sum, row) => sum + row.totalActivities, 0)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
              The importer matches projects by name, creates missing projects if needed, links the SDM as a project resource/team owner, and stores the lifecycle matrix on the project for dashboard and portfolio reporting.
            </div>
            <input ref={radarFileInputRef} type="file" accept=".csv" onChange={handleRadarFileSelect} className="hidden" />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-primary" />
              Import Project Plan Or Project Package
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import MS Project XML, CSV task lists, or JSON project packages that include project details, team structure, risks, stakeholders, and documents.
            </p>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept=".xml,.csv,.json,.mpp" onChange={handleFileSelect} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} className="gradient-primary text-primary-foreground shadow-glow">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Select File
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { format: 'MS Project XML', ext: '.xml', supported: true },
                { format: 'CSV Tasks', ext: '.csv', supported: true },
                { format: 'Project Package', ext: '.json', supported: true },
                { format: 'MS Project Binary', ext: '.mpp', supported: false },
              ].map((item) => (
                <div key={item.ext} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.format}</p>
                    <p className="text-[10px] text-muted-foreground">{item.ext}</p>
                  </div>
                  {item.supported ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-accent" />
              Export Project Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export schedule files for MS Project, or export a full project package with team structure, risks, stakeholders, documents, tasks, and tickets.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={exportProject} onValueChange={setExportProject}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleExportSchedule('xml')} disabled={!exportProject} className="gradient-primary text-primary-foreground shadow-glow">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export MS Project XML
              </Button>
              <Button onClick={() => handleExportSchedule('csv')} variant="outline" disabled={!exportProject}>
                <FileText className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleExportProjectBundle} variant="outline" disabled={!exportProject}>
                <Download className="mr-2 h-4 w-4" />
                Export Project Package
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-primary" />
              Export Workspace Lists
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export projects, tasks, tickets, team lists, user accounts, meetings, chat channels, sticky notes, or a full workspace package.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={datasetExportType} onValueChange={(value) => setDatasetExportType(value as WorkspaceDatasetKey)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select dataset..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(datasetLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleDatasetExport('json')} className="gradient-primary text-primary-foreground shadow-glow">
                <FileText className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
              <Button onClick={() => handleDatasetExport('csv')} variant="outline" disabled={datasetExportType === 'workspace'}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
            {datasetExportType !== 'workspace' ? (
              <DatasetFieldSelector
                title="Export Fields"
                description="Choose the fields to include in the exported file for this dataset."
                fields={exportFieldOptions}
                selected={selectedExportFields}
                onToggle={(field, checked) => toggleExportField(datasetExportType, field, checked)}
                onSelectAll={() => selectAllExportFields(datasetExportType)}
                onClear={() => clearExportFields(datasetExportType)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                Full workspace export stays as a complete JSON package so all linked data remains consistent.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Export Team Details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => handleExportTeam('csv')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Team CSV
            </Button>
            <Button variant="outline" onClick={() => handleExportTeam('json')}>
              <FileText className="mr-2 h-4 w-4" />
              Export Team JSON
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showRadarPreview} onOpenChange={setShowRadarPreview}>
          <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Radar Import Preview{radarFileName ? `: ${radarFileName}` : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Projects</p>
                  <p className="mt-2 text-2xl font-semibold">{radarRows.length}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Owners</p>
                  <p className="mt-2 text-2xl font-semibold">{new Set(radarRows.map((row) => row.ownerName).filter(Boolean)).size}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Activities</p>
                  <p className="mt-2 text-2xl font-semibold">{radarRows.reduce((sum, row) => sum + row.totalActivities, 0)}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clean Rows</p>
                  <p className="mt-2 text-2xl font-semibold">{radarRowsToCleanRecords(radarRows).length}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Project</th>
                      <th className="px-3 py-2 text-left">Owner</th>
                      <th className="px-3 py-2 text-left">Total</th>
                      {['Planning', 'Analysis', 'Infra', 'Design', 'Development', 'UAT', 'Deployment', 'Training', 'Go-Live', 'Support'].map((label) => (
                        <th key={label} className="px-3 py-2 text-left">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {radarRows.slice(0, 20).map((row) => (
                      <tr key={`${row.rank}-${row.projectName}`} className="border-t">
                        <td className="px-3 py-2">{row.rank}</td>
                        <td className="px-3 py-2 font-medium">{row.projectName}</td>
                        <td className="px-3 py-2">{row.ownerName || 'Unassigned'}</td>
                        <td className="px-3 py-2 font-semibold">{row.totalActivities}</td>
                        <td className="px-3 py-2">{row.stageCounts.planning}</td>
                        <td className="px-3 py-2">{row.stageCounts.analysis}</td>
                        <td className="px-3 py-2">{row.stageCounts.infra}</td>
                        <td className="px-3 py-2">{row.stageCounts.design}</td>
                        <td className="px-3 py-2">{row.stageCounts.development}</td>
                        <td className="px-3 py-2">{row.stageCounts.uat}</td>
                        <td className="px-3 py-2">{row.stageCounts.deployment}</td>
                        <td className="px-3 py-2">{row.stageCounts.training}</td>
                        <td className="px-3 py-2">{row.stageCounts['go-live']}</td>
                        <td className="px-3 py-2">{row.stageCounts.support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleDownloadRadarCleanCsv}>Download Clean CSV</Button>
                <Button variant="outline" onClick={() => setShowRadarPreview(false)}>Close</Button>
                <Button onClick={handleImportRadar} disabled={importRadarMatrix.isPending} className="gradient-primary text-primary-foreground">
                  {importRadarMatrix.isPending ? 'Importing...' : 'Import Radar Into Workspace'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Preview: {importedProject?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-muted-foreground">Tasks:</span> <strong>{importedTasks.length}</strong></div>
                <div><span className="text-muted-foreground">Team Members:</span> <strong>{importedBundle?.teamMembers?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Documents:</span> <strong>{importedBundle?.project.documents?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Risks:</span> <strong>{importedBundle?.project.risks?.length || 0}</strong></div>
              </div>

              {importedBundle?.project && (
                <Card className="rounded-2xl">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <p><span className="font-medium">Nature:</span> {importedBundle.project.projectNature || 'Not provided'}</p>
                    <p><span className="font-medium">Department:</span> {importedBundle.project.department || 'Not assigned'}</p>
                    <p><span className="font-medium">Stakeholders:</span> {importedBundle.project.stakeholders?.length || 0}</p>
                    <p><span className="font-medium">Team Structure Roles:</span> {importedBundle.project.teamStructure?.length || 0}</p>
                  </CardContent>
                </Card>
              )}

              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-center text-xs text-muted-foreground">Importing... {importProgress}%</p>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left text-xs font-medium">Task Name</th>
                      <th className="p-2 text-left text-xs font-medium">Status</th>
                      <th className="p-2 text-left text-xs font-medium">Finish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedTasks.slice(0, 25).map((task: any, index) => (
                      <tr key={`${task.uid || task.id || task.title}-${index}`} className="border-t border-border hover:bg-muted/30">
                        <td className="p-2">{task.title || task.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{task.status || `${task.percentComplete || 0}%`}</td>
                        <td className="p-2 text-xs text-muted-foreground">{task.due_date || task.finish?.slice?.(0, 10) || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importedTasks.length > 25 && (
                  <p className="border-t border-border p-2 text-center text-xs text-muted-foreground">Showing 25 of {importedTasks.length} tasks</p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetImportState}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing} className="gradient-primary text-primary-foreground">
                  {importing ? 'Importing...' : 'Import Project'}
                  {!importing && <ArrowRight className="ml-2 h-4 w-4" />}
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
