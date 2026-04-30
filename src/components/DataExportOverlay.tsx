import { useMemo, useState } from 'react';
import { Download, FileJson, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const workspaceStorageKey = 'synergi-workspace-data';

const datasetLabels: Record<string, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  tickets: 'Tickets',
  teamMembers: 'Team Members',
  userAccounts: 'User Accounts',
  meetings: 'Meetings',
  personalEvents: 'Personal Events',
  chatChannels: 'Chat Channels',
  stickyNotes: 'Sticky Notes',
  workflows: 'Workflows',
  dashboards: 'Dashboards',
  auditLogs: 'Audit Logs',
};

const preferredDatasetOrder = [
  'projects',
  'tasks',
  'tickets',
  'teamMembers',
  'userAccounts',
  'meetings',
  'personalEvents',
  'chatChannels',
  'stickyNotes',
  'workflows',
  'dashboards',
  'auditLogs',
];

type DataExportOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const readWorkspaceData = () => {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const stringifyCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const csvCell = (value: unknown) => `"${stringifyCell(value).replace(/"/g, '""')}"`;

const downloadText = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const normalizeRows = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item));
};

const getColumns = (rows: Array<Record<string, unknown>>) =>
  Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

const DataExportOverlay = ({ open, onClose }: DataExportOverlayProps) => {
  const workspaceData = useMemo(() => readWorkspaceData(), [open]);
  const availableDatasets = useMemo(
    () =>
      preferredDatasetOrder.filter((key) => normalizeRows((workspaceData as Record<string, unknown>)[key]).length > 0),
    [workspaceData],
  );
  const [dataset, setDataset] = useState('projects');

  const activeDataset = availableDatasets.includes(dataset) ? dataset : availableDatasets[0] ?? 'projects';
  const rows = useMemo(
    () => normalizeRows((workspaceData as Record<string, unknown>)[activeDataset]),
    [activeDataset, workspaceData],
  );
  const columns = useMemo(() => getColumns(rows), [rows]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const effectiveSelectedColumns = selectedColumns.length ? selectedColumns.filter((column) => columns.includes(column)) : columns;
  const previewRows = rows.slice(0, 10);

  const toggleColumn = (column: string, checked: boolean) => {
    const baseSelection = selectedColumns.length ? selectedColumns : columns;
    setSelectedColumns(
      checked
        ? Array.from(new Set([...baseSelection, column]))
        : baseSelection.filter((item) => item !== column),
    );
  };

  const handleDatasetChange = (value: string) => {
    setDataset(value);
    setSelectedColumns([]);
  };

  const exportCsv = () => {
    if (!rows.length || !effectiveSelectedColumns.length) return;
    const csv = [
      effectiveSelectedColumns.join(','),
      ...rows.map((row) => effectiveSelectedColumns.map((column) => csvCell(row[column])).join(',')),
    ].join('\n');
    downloadText(csv, `synergi-${activeDataset}-export.csv`, 'text/csv;charset=utf-8;');
  };

  const exportJson = () => {
    if (!rows.length || !effectiveSelectedColumns.length) return;
    const filteredRows = rows.map((row) =>
      Object.fromEntries(effectiveSelectedColumns.map((column) => [column, row[column]])),
    );
    downloadText(JSON.stringify(filteredRows, null, 2), `synergi-${activeDataset}-export.json`, 'application/json;charset=utf-8;');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 p-4">
          <div>
            <p className="text-lg font-black">Export workspace data</p>
            <p className="text-sm text-muted-foreground">
              Select a dataset, choose columns, preview the table, then export CSV or JSON.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeDataset}
              onChange={(event) => handleDatasetChange(event.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
            >
              {availableDatasets.map((key) => (
                <option key={key} value={key}>{datasetLabels[key] ?? key}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => setSelectedColumns(columns)}>Select All</Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedColumns(columns.slice(0, Math.min(4, columns.length)))}>Key Columns</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportJson} disabled={!rows.length || !effectiveSelectedColumns.length}>
              <FileJson className="h-4 w-4" /> JSON
            </Button>
            <Button size="sm" className="gap-2" onClick={exportCsv} disabled={!rows.length || !effectiveSelectedColumns.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {availableDatasets.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No local workspace data is available to export yet.</div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="max-h-[32vh] overflow-y-auto border-b p-4 lg:max-h-none lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Export columns</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                  {effectiveSelectedColumns.length}/{columns.length}
                </span>
              </div>
              <div className="space-y-2">
                {columns.map((column) => (
                  <label key={column} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-2 text-sm">
                    <Checkbox checked={effectiveSelectedColumns.includes(column)} onCheckedChange={(checked) => toggleColumn(column, checked === true)} />
                    <span className="truncate font-medium">{column}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="min-w-0 overflow-auto p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Table2 className="h-4 w-4 text-primary" />
                  {datasetLabels[activeDataset] ?? activeDataset}
                </div>
                <p className="text-xs text-muted-foreground">{rows.length} rows · preview shows first 10 rows</p>
              </div>
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    {effectiveSelectedColumns.map((column) => (
                      <th key={column} className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-muted/20">
                      {effectiveSelectedColumns.map((column) => (
                        <td key={`${rowIndex}-${column}`} className="max-w-[240px] truncate border-b px-3 py-2 text-muted-foreground" title={stringifyCell(row[column])}>
                          {stringifyCell(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataExportOverlay;
