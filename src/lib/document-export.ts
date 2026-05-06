import type { WorkspaceProjectDocument } from "@/lib/workspace-store";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeLine = (line: string) => line.trim();

const isSectionHeading = (line: string) => {
  if (!line) return false;
  if (/^[-•\d]+[.)]/.test(line)) return false;
  if (line.length > 90) return false;
  return /^[A-Z][A-Za-z0-9 /&()\-]+$/.test(line) || /[\u0600-\u06FF]/.test(line);
};

const renderContentLines = (content: string) => {
  const lines = content.split(/\r?\n/).filter((line) => !line.includes("===="));
  const html: string[] = [];
  let tableRows: string[] = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    html.push("<table class='data-table'><tbody>");
    tableRows.forEach((row) => {
      const parts = row.split(/\s*\|\s*/).filter(Boolean);
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
    if (line.includes("|") && !line.startsWith("Project:")) {
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
    if (/^[A-Za-z ]+:/.test(line) || /^[\u0600-\u06FF ]+:/.test(line)) {
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
  const title = document.name || "Project Deliverable";
  const phase = document.phase || "Project";
  const deliverable = document.deliverableType || document.type;

  return `<!doctype html>
<html dir="ltr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 26mm 18mm 20mm 18mm; }
    body { font-family: "Arial", "Tahoma", "Segoe UI", sans-serif; color: #1f2937; margin: 0; background: #ffffff; font-size: 11pt; line-height: 1.55; }
    .page { max-width: 900px; margin: 0 auto; padding: 18px 26px; }
    .header { display: table; width: 100%; border-bottom: 4px solid #2f6f3e; padding-bottom: 14px; margin-bottom: 20px; }
    .brand-left, .brand-right { display: table-cell; vertical-align: middle; width: 30%; }
    .brand-center { display: table-cell; text-align: center; vertical-align: middle; width: 40%; }
    .leader-logo { font-size: 32px; letter-spacing: 5px; color: #315f7a; font-weight: 700; line-height: 1; }
    .leader-sub { font-size: 11px; letter-spacing: 8px; color: #ef3333; font-weight: 700; margin-top: 7px; }
    .nazaha-logo { display: inline-block; border: 5px solid #78a943; color: #111827; border-radius: 55% 15% 55% 15%; padding: 8px 22px; font-size: 20px; font-weight: 700; }
    .nazaha-sub { font-size: 11px; color: #374151; margin-top: 7px; }
    .doc-class { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.18em; }
    .title-block { background: linear-gradient(135deg, #f8fafc, #eef7ef); border: 1px solid #d9e7dc; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; }
    h1 { margin: 0; color: #24485e; font-size: 24px; line-height: 1.25; }
    h2 { color: #2f6f3e; font-size: 15px; margin: 20px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #d7e5dc; }
    h3 { color: #315f7a; font-size: 13px; margin: 16px 0 6px; }
    p { margin: 6px 0; }
    .meta-grid { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10pt; }
    .meta-grid th { background: #315f7a; color: #ffffff; text-align: left; padding: 8px; border: 1px solid #315f7a; width: 24%; }
    .meta-grid td { padding: 8px; border: 1px solid #cbd5e1; background: #ffffff; }
    .data-table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 10pt; }
    .data-table td, .data-table th { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
    .data-table tr:first-child td { background: #315f7a; color: #ffffff; font-weight: 700; }
    .field span { color: #315f7a; font-weight: 700; }
    .bullet { margin-left: 18px; }
    .bullet:before { content: "• "; color: #2f6f3e; font-weight: 700; margin-left: -14px; }
    .numbered { margin-left: 18px; }
    .spacer { height: 5px; }
    .approval { margin-top: 28px; page-break-inside: avoid; }
    .approval table { width: 100%; border-collapse: collapse; }
    .approval th { background: #2f6f3e; color: white; padding: 9px; border: 1px solid #2f6f3e; }
    .approval td { border: 1px solid #cbd5e1; padding: 18px 9px; height: 36px; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 9pt; text-align: center; }
    .rtl { direction: rtl; text-align: right; font-family: "Tahoma", "Arial", sans-serif; }
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
        <div class="doc-class">Project Deliverable Template</div>
      </div>
      <div class="brand-right" style="text-align:right">
        <div class="nazaha-logo">نزاهة</div>
        <div class="nazaha-sub">Oversight and Anti-Corruption Authority</div>
      </div>
    </div>

    <div class="title-block">
      <h1>${escapeHtml(title)}</h1>
      <table class="meta-grid">
        <tr><th>Project</th><td>${escapeHtml(projectName || "Project")}</td><th>Phase</th><td>${escapeHtml(phase)}</td></tr>
        <tr><th>Deliverable Type</th><td>${escapeHtml(deliverable)}</td><th>Status</th><td>${escapeHtml(document.reviewStatus || "draft")}</td></tr>
        <tr><th>Format</th><td>${escapeHtml((document.outputFormat || "doc").toUpperCase())}</td><th>Generated</th><td>${escapeHtml(generatedAt)}</td></tr>
        <tr><th>Template</th><td>${escapeHtml(document.standardTemplate || "Custom")}</td><th>Folder</th><td>${escapeHtml(document.folder || "Project")}</td></tr>
      </table>
    </div>

    ${renderContentLines(document.content)}

    <div class="approval">
      <h2>Approval / الاعتماد</h2>
      <table>
        <tr><th>Name / الاسم</th><th>Role / الدور</th><th>Signature / التوقيع</th><th>Date / التاريخ</th></tr>
        <tr><td></td><td>Project Manager</td><td></td><td></td></tr>
        <tr><td></td><td>Client Representative</td><td></td><td></td></tr>
        <tr><td></td><td>Authorized Approver</td><td></td><td></td></tr>
      </table>
    </div>

    <div class="footer">
      Leader Group | Nazaha 980 | Generated from Synergi Task | This document follows the approved project style, fonts, tables, and branding.
    </div>
  </div>
</body>
</html>`;
};

export const getBrandedDownloadPayload = (document: WorkspaceProjectDocument, projectName?: string) => {
  const extension = document.outputFormat ?? document.metadata?.extension ?? "doc";
  const html = buildBrandedDocumentHtml(document, projectName);
  const mime = extension === "xlsx"
    ? "application/vnd.ms-excel;charset=utf-8"
    : "application/msword;charset=utf-8";
  return { blob: new Blob([html], { type: mime }), extension };
};
