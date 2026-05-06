import type { WorkspaceProjectDocument } from "@/lib/workspace-store";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const englishOnly = (value: string) =>
  value
    .replace(/\s*\/\s*[\u0600-\u06FF\s]+/g, "")
    .replace(/[\u0600-\u06FF]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const normalizeLine = (line: string) => englishOnly(line.trim());

const standardLabel = (document: WorkspaceProjectDocument) => {
  const raw = `${document.metadata?.templateTheme ?? document.standardTemplate ?? ""}`.toUpperCase();
  if (raw.includes("CLIENT") || raw.includes("NAZAHA") || raw.includes("980")) return "Client Branded Project Template";
  if (raw.includes("SAP")) return "SAP Branded Template";
  if (raw.includes("PMI")) return "PMI Branded Template";
  return "Professional Project Template";
};

const isSectionHeading = (line: string) => {
  if (!line) return false;
  if (/^[-•\d]+[.)]/.test(line)) return false;
  if (line.length > 110) return false;
  return /^[A-Z][A-Za-z0-9 /&()\-]+$/.test(line);
};

const renderContentLines = (content: string) => {
  const lines = content.split(/\r?\n/).filter((line) => !line.includes("===="));
  const html: string[] = [];
  let tableRows: string[] = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    html.push("<table class='data-table'><tbody>");
    tableRows.forEach((row) => {
      const parts = row.split(/\s*\|\s*/).map(englishOnly).filter((part) => part.length > 0);
      html.push("<tr>" + parts.map((part) => `<td>${escapeHtml(part)}</td>`).join("") + "</tr>");
    });
    html.push("</tbody></table>");
    tableRows = [];
  };

  lines.forEach((rawLine) => {
    const line = normalizeLine(rawLine);
    if (!line) {
      flushTable();
      html.push("<div class='spacer'></div>");
      return;
    }
    if (line.includes("|")) {
      tableRows.push(line);
      return;
    }
    flushTable();
    if (/^[-•]/.test(line)) {
      html.push(`<p class='bullet'>${escapeHtml(line.replace(/^[-•]\s*/, ""))}</p>`);
      return;
    }
    if (/^\d+[.)]/.test(line)) {
      html.push(`<p class='numbered'>${escapeHtml(line)}</p>`);
      return;
    }
    if (/^[A-Za-z ]+:/.test(line)) {
      const [label, ...rest] = line.split(":");
      html.push(`<p class='field'><span>${escapeHtml(label)}:</span> ${escapeHtml(rest.join(":"))}</p>`);
      return;
    }
    if (isSectionHeading(line)) {
      html.push(`<h2>${escapeHtml(line)}</h2>`);
      return;
    }
    html.push(`<p>${escapeHtml(line)}</p>`);
  });

  flushTable();
  return html.join("\n");
};

export const buildBrandedDocumentHtml = (document: WorkspaceProjectDocument, projectName?: string) => {
  const generatedAt = new Date().toLocaleString();
  const project = englishOnly(projectName || "Project");
  const title = englishOnly(document.name || `${project} Deliverable`);
  const phase = englishOnly(document.phase || "Project");
  const deliverable = englishOnly(document.deliverableType || document.type);
  const templateName = standardLabel(document);

  return `<!doctype html>
<html dir="ltr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm 14mm 16mm 14mm; }
    body {
      font-family: "Aptos", "Segoe UI", "Arial", sans-serif;
      color: #172033;
      margin: 0;
      background: #ffffff;
      font-size: 9.7pt;
      line-height: 1.48;
    }
    .page { max-width: 980px; margin: 0 auto; padding: 14px 20px; }
    .header {
      display: table;
      width: 100%;
      border-bottom: 5px solid #1f4e79;
      padding-bottom: 11px;
      margin-bottom: 16px;
    }
    .brand-left, .brand-right { display: table-cell; vertical-align: middle; width: 32%; }
    .brand-center { display: table-cell; text-align: center; vertical-align: middle; width: 36%; }
    .leader-logo { font-size: 28px; letter-spacing: 4px; color: #315f7a; font-weight: 800; line-height: 1; }
    .leader-sub { font-size: 9px; letter-spacing: 6px; color: #d92727; font-weight: 800; margin-top: 6px; }
    .client-logo { display: inline-block; border: 3px solid #6aa84f; color: #1f2937; border-radius: 50px; padding: 6px 18px; font-size: 14px; font-weight: 800; }
    .client-sub { font-size: 9px; color: #475569; margin-top: 6px; }
    .doc-class { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.16em; }
    .title-block {
      background: linear-gradient(135deg, #f8fafc 0%, #eef4f8 55%, #f3f8f2 100%);
      border: 1px solid #cbd5e1;
      border-left: 7px solid #1f4e79;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    h1 { margin: 0; color: #1f4e79; font-size: 20px; line-height: 1.25; font-weight: 800; }
    h2 {
      color: #1f4e79;
      font-size: 12.2px;
      margin: 15px 0 7px;
      padding: 6px 9px;
      border-left: 4px solid #1f4e79;
      background: #eef4f8;
      border-radius: 6px;
      font-weight: 800;
      page-break-after: avoid;
    }
    p { margin: 4px 0; }
    .meta-grid { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9pt; }
    .meta-grid th { background: #1f4e79; color: #ffffff; text-align: left; padding: 6px 8px; border: 1px solid #1f4e79; width: 20%; font-weight: 800; }
    .meta-grid td { padding: 6px 8px; border: 1px solid #b7c9d8; background: #ffffff; min-height: 18px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 8.9pt; page-break-inside: avoid; }
    .data-table td, .data-table th { border: 1px solid #b7c9d8; padding: 6px 7px; vertical-align: top; min-height: 18px; }
    .data-table tr:first-child td { background: #1f4e79; color: #ffffff; font-weight: 800; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .field span { color: #1f4e79; font-weight: 800; }
    .bullet { margin-left: 16px; }
    .bullet:before { content: "• "; color: #6aa84f; font-weight: 900; margin-left: -12px; }
    .numbered { margin-left: 16px; }
    .spacer { height: 3px; }
    .approval { margin-top: 22px; page-break-inside: avoid; }
    .approval table { width: 100%; border-collapse: collapse; }
    .approval th { background: #6aa84f; color: white; padding: 7px; border: 1px solid #6aa84f; font-size: 8.9pt; }
    .approval td { border: 1px solid #b7c9d8; padding: 13px 8px; height: 28px; }
    .footer { margin-top: 22px; padding-top: 9px; border-top: 2px solid #e5e7eb; color: #64748b; font-size: 8pt; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand-left">
        <div class="leader-logo">LEADER</div>
        <div class="leader-sub">LEADER GROUP</div>
      </div>
      <div class="brand-center">
        <div class="doc-class">${escapeHtml(templateName)}</div>
      </div>
      <div class="brand-right" style="text-align:right">
        <div class="client-logo">CLIENT</div>
        <div class="client-sub">Project Owner</div>
      </div>
    </div>

    <div class="title-block">
      <h1>${escapeHtml(title)}</h1>
      <table class="meta-grid">
        <tr><th>Project</th><td>${escapeHtml(project)}</td><th>Phase</th><td>${escapeHtml(phase)}</td></tr>
        <tr><th>Deliverable</th><td>${escapeHtml(deliverable)}</td><th>Status</th><td>${escapeHtml(englishOnly(document.reviewStatus || ""))}</td></tr>
        <tr><th>Output Type</th><td>${escapeHtml(englishOnly((document.outputFormat || "").toUpperCase()))}</td><th>Generated</th><td>${escapeHtml(generatedAt)}</td></tr>
        <tr><th>Template</th><td>${escapeHtml(templateName)}</td><th>Folder</th><td>${escapeHtml(englishOnly(document.folder || ""))}</td></tr>
      </table>
    </div>

    ${renderContentLines(document.content)}

    <div class="approval">
      <h2>Approval</h2>
      <table>
        <tr><th>Name</th><th>Role</th><th>Signature</th><th>Date</th></tr>
        <tr><td></td><td>Project Manager</td><td></td><td></td></tr>
        <tr><td></td><td>Client Representative</td><td></td><td></td></tr>
        <tr><td></td><td>Authorized Approver</td><td></td><td></td></tr>
      </table>
    </div>

    <div class="footer">
      Leader Group | ${escapeHtml(project)} | Generated from Synergi Task | Professional PMI-aligned project deliverable template.
    </div>
  </div>
</body>
</html>`;
};

export const getBrandedDownloadPayload = (document: WorkspaceProjectDocument, projectName?: string) => {
  const outputFormat = document.outputFormat ?? document.metadata?.extension ?? "doc";
  const html = buildBrandedDocumentHtml(document, projectName);
  const extension = outputFormat === "xlsx" ? "xls" : outputFormat === "pdf" ? "doc" : outputFormat;
  const mime = outputFormat === "xlsx"
    ? "application/vnd.ms-excel;charset=utf-8"
    : "application/msword;charset=utf-8";
  return { blob: new Blob([html], { type: mime }), extension };
};
