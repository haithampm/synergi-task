// MS Project XML Import/Export utilities
// Supports Microsoft Project XML format (.xml) which MS Project can natively open/save

export interface MppTask {
  id: number;
  uid: number;
  name: string;
  outlineLevel: number;
  start: string;
  finish: string;
  duration: string;
  percentComplete: number;
  summary: boolean;
  milestone: boolean;
  predecessors: string;
  priority: string;
}

export interface MppProject {
  name: string;
  author: string;
  startDate: string;
  finishDate: string;
  tasks: MppTask[];
}

/**
 * Parse MS Project XML file content into structured project data.
 * MS Project XML is the standard interchange format for project plans.
 */
export function parseMsProjectXml(xmlString: string): MppProject {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const ns = doc.documentElement.namespaceURI || '';

  const getText = (parent: Element, tag: string): string => {
    const el = ns
      ? parent.getElementsByTagNameNS(ns, tag)[0]
      : parent.getElementsByTagName(tag)[0];
    return el?.textContent?.trim() || '';
  };

  const projectName = getText(doc.documentElement, 'Name') || getText(doc.documentElement, 'Title') || 'Untitled Project';
  const author = getText(doc.documentElement, 'Author');
  const startDate = getText(doc.documentElement, 'StartDate');
  const finishDate = getText(doc.documentElement, 'FinishDate');

  const taskElements = ns
    ? doc.getElementsByTagNameNS(ns, 'Task')
    : doc.getElementsByTagName('Task');

  const tasks: MppTask[] = [];
  for (let i = 0; i < taskElements.length; i++) {
    const t = taskElements[i];
    const name = getText(t, 'Name');
    if (!name) continue;

    tasks.push({
      id: parseInt(getText(t, 'ID')) || i,
      uid: parseInt(getText(t, 'UID')) || i,
      name,
      outlineLevel: parseInt(getText(t, 'OutlineLevel')) || 0,
      start: getText(t, 'Start'),
      finish: getText(t, 'Finish'),
      duration: getText(t, 'Duration'),
      percentComplete: parseInt(getText(t, 'PercentComplete')) || 0,
      summary: getText(t, 'Summary') === '1',
      milestone: getText(t, 'Milestone') === '1',
      predecessors: '',
      priority: mapPriority(parseInt(getText(t, 'Priority')) || 500),
    });
  }

  return { name: projectName, author, startDate, finishDate, tasks };
}

function mapPriority(msValue: number): string {
  if (msValue >= 800) return 'urgent';
  if (msValue >= 600) return 'high';
  if (msValue >= 400) return 'medium';
  return 'low';
}

/**
 * Export project data as MS Project XML format.
 * The exported file can be opened directly in Microsoft Project.
 */
export function exportToMsProjectXml(project: {
  name: string;
  tasks: Array<{
    id?: string;
    title: string;
    status?: string;
    priority?: string;
    due_date?: string;
    description?: string;
    progress?: number;
  }>;
}): string {
  const now = new Date().toISOString();
  const priorityMap: Record<string, number> = {
    urgent: 900, high: 700, medium: 500, low: 300,
  };

  const taskXml = project.tasks.map((t, i) => {
    const uid = i + 1;
    const pct = t.status === 'done' ? 100 : (t.progress || 0);
    const start = t.due_date ? new Date(t.due_date).toISOString() : now;
    const priority = priorityMap[t.priority || 'medium'] || 500;

    return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${escapeXml(t.title)}</Name>
      <Start>${start}</Start>
      <Finish>${start}</Finish>
      <Duration>PT8H0M0S</Duration>
      <PercentComplete>${pct}</PercentComplete>
      <Priority>${priority}</Priority>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <OutlineLevel>1</OutlineLevel>
      <Notes>${escapeXml(t.description || '')}</Notes>
    </Task>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escapeXml(project.name)}</Name>
  <Title>${escapeXml(project.name)}</Title>
  <CreationDate>${now}</CreationDate>
  <StartDate>${now}</StartDate>
  <Tasks>
${taskXml}
  </Tasks>
</Project>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse a CSV file into project tasks (simple fallback format).
 */
export function parseCsvTasks(csv: string): MppTask[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title') || h.includes('task'));
  const startIdx = headers.findIndex(h => h.includes('start'));
  const finishIdx = headers.findIndex(h => h.includes('finish') || h.includes('end'));
  const pctIdx = headers.findIndex(h => h.includes('percent') || h.includes('complete') || h.includes('%'));
  const priorityIdx = headers.findIndex(h => h.includes('priority'));

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return {
      id: i + 1,
      uid: i + 1,
      name: nameIdx >= 0 ? cols[nameIdx] : cols[0] || `Task ${i + 1}`,
      outlineLevel: 1,
      start: startIdx >= 0 ? cols[startIdx] : '',
      finish: finishIdx >= 0 ? cols[finishIdx] : '',
      duration: '',
      percentComplete: pctIdx >= 0 ? parseInt(cols[pctIdx]) || 0 : 0,
      summary: false,
      milestone: false,
      predecessors: '',
      priority: priorityIdx >= 0 ? cols[priorityIdx]?.toLowerCase() || 'medium' : 'medium',
    };
  }).filter(t => t.name);
}

/**
 * Export tasks as CSV.
 */
export function exportToCsv(tasks: Array<{ title: string; status?: string; priority?: string; due_date?: string }>): string {
  const header = 'ID,Name,Status,Priority,Due Date';
  const rows = tasks.map((t, i) => `${i + 1},"${t.title}",${t.status || 'todo'},${t.priority || 'medium'},${t.due_date || ''}`);
  return [header, ...rows].join('\n');
}
