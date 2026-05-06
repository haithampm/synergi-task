import type { WorkspaceProjectDocument } from "@/lib/workspace-store";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeLine = (line: string) => line.trim();
const hasArabic = (value: string) => /[\u0600-\u06FF]/.test(value);

const standardLabel = (document: WorkspaceProjectDocument) => {
  const raw = `${document.metadata?.templateTheme ?? document.standardTemplate ?? ""}`.toUpperCase();
  if (raw.includes("NAZAHA") || raw.includes("980")) return "Client Branded Project Template";
  if (raw.includes("SAP")) return "SAP Branded Template";
  if (raw.includes("PMI")) return "PMI Branded Template";
  return "Professional Branded Template";
};

const isSectionHeading = (line: string) => {
  if (!line) return false;
  if (/^[-•\d]+[.)]/.test(line)) return false;
  if (line.length > 110) return false;
  return /^[A-Z][A-Za-z0-9 /&()\-]+$/.test(line) || hasArabic(line);
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
      html.push("<tr>" + parts.map((part) => `<td class='${hasArabic(part) ? "rtl" : ""}'>${escapeHtml(part)}</td>`).join("") + "</tr>");
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
    const directionClass = hasArabic(line) ? "rtl" : "";
    if (/^[-•]/.test(line)) {
      html.push(`<p class='bullet ${directionClass}'>${escapeHtml(line.replace(/^[-•]\s*/, ""))}</p>`);
      return;
    }
    if (/^\d+[.)]/.test(line)) {
      html.push(`<p class='numbered ${directionClass}'>${escapeHtml(line)}</p>`);
      return;
    }
    if (/^[A-Za-z ]+:/.test(line) || /^[\u0600-\u06FF ]+:/.test(line)) {
      const [label, ...rest] = line.split(":");
      html.push(`<p class='field ${directionClass}'><span>${escapeHtml(label)}:</span> ${escapeHtml(rest.join(":"))}</p>`);
      return;
    }
    if (isSectionHeading(line)) {
      html.push(`<h2 class='${directionClass}'>${escapeHtml(line)}</h2>`);
      return;
    }
    html.push(`<p class='${directionClass}'>${escapeHtml(line)}</p>`);
  });

  flushTable();
  return html.join("\n");
};

export const buildBrandedDocumentHtml = (document: WorkspaceProjectDocument, projectName?: string) => {
  const generatedAt = new Date().toLocaleString();
  const project = projectName || "Project";
  const title = document.name || `${project} Deliverable`;
  const phase = document.phase || "Project";
  const deliverable = document.deliverableType || document.type;
  const templateName = standardLabel(document);

  return `<!doctype html>
<html dir="ltr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 22mm 16mm 18mm 16mm; }
    body {
      font-family: "Aptos", "Segoe UI", "Tahoma", "Arial", sans-serif;
      color: #1e293b;
      margin: 0;
      background: #ffffff;
      font-size: 10.8pt;
      line-height: 1.7;
    }
    .page { max-width: 940px; margin: 0 auto; padding: 16px 24px; }
    .header {
      display: table;
      width: 100%;
      border-bottom: 5px solid #2f6f3e;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand-left, .brand-right { display: table-cell; vertical-align: middle; width: 32%; }
    .brand-center { display: table-cell; text-align: center; vertical-align: middle; width: 36%; }
    .leader-logo { font-size: 31px; letter-spacing: 5px; color: #315f7a; font-weight: 800; line-height: 1; }
    .leader-sub { font-size: 10px; letter-spacing: 7px; color: #ef3333; font-weight: 800; margin-top: 7px; }
    .client-logo { display: inline-block; border: 4px solid #78a943; color: #1f2937; border-radius: 48% 18% 48% 18%; padding: 7px 20px; font-size: 18px; font-weight: 800; }
    .client-sub { font-size: 10px; color: #475569; margin-top: 7px; }
    .doc-class { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.18em; }
    .title-block {
      background: linear-gradient(135deg, #f8fafc 0%, #f0f7f2 58%, #eef4f8 100%);
      border: 1px solid #d7e5dc;
      border-left: 7px solid #315f7a;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    h1 { margin: 0; color: #24485e; font-size: 23px; line-height: 1.3; font-weight: 800; }
    h2 {
      color: #2f6f3e;
      font-size: 14px;
      margin: 18px 0 8px;
      padding: 8px 10px;
      border-right: 4px solid #2f6f3e;
      border-left: 4px solid #315f7a;
      background: #f5faf6;
      border-radius: 8px;
      font-weight: 800;
      page-break-after: avoid;
    }
    h3 { color: #315f7a; font-size: 12.5px; margin: 14px 0 6px; font-weight: 800; }
    p { margin: 5px 0; }
    .meta-grid { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9.8pt; }
    .meta-grid th { background: #315f7a; color: #ffffff; text-align: left; padding: 7px 9px; border: 1px solid #315f7a; width: 22%; font-weight: 800; }
    .meta-grid td { padding: 7px 9px; border: 1px solid #cbd5e1; background: #ffffff; }
    .data-table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 9.7pt; page-break-inside: avoid; }
    .data-table td, .data-table th { border: 1px solid #cbd5e1; padding: 8px 9px; vertical-align: top; }
    .data-table tr:first-child td { background: #315f7a; color: #ffffff; font-weight: 800; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .field span { color: #315f7a; font-weight: 800; }
    .bullet { margin-left: 18px; }
    .bullet:before { content: "• "; color: #2f6f3e; font-weight: 900; margin-left: -14px; }
    .numbered { margin-left: 18px; }
    .spacer { height: 4px; }
    .approval { margin-top: 26px; page-break-inside: avoid; }
    .approval table { width: 100%; border-collapse: collapse; }
    .approval th { background: #2f6f3e; color: white; padding: 9px; border: 1px solid #2f6f3e; font-size: 9.7pt; }
    .approval td { border: 1px solid #cbd5e1; padding: 16px 9px; height: 34px; }
    .footer { margin-top: 26px; padding-top: 10px; border-top: 2px solid #e5e7eb; color: #64748b; font-size: 8.8pt; text-align: center; }
    .rtl { direction: rtl; text-align: right; font-family: "Tahoma", "Arial", "Segoe UI", sans-serif; line-height: 1.85; }
    .rtl.bullet { margin-left: 0; margin-right: 18px; }
    .rtl.bullet:before { margin-left: 0; margin-right: -14px; }
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
        <div class="client-logo">نزاهة</div>
        <div class="client-sub">Oversight and Anti-Corruption Authority</div>
      </div>
    </div>

    <div class="title-block">
      <h1>${escapeHtml(title)}</h1>
      <table class="meta-grid">
        <tr><th>Project</th><td>${escapeHtml(project)}</td><th>Phase</th><td>${escapeHtml(phase)}</td></tr>
        <tr><th>Deliverable Type</th><td>${escapeHtml(deliverable)}</td><th>Status</th><td>${escapeHtml(document.reviewStatus || "draft")}</td></tr>
        <tr><th>Output Type</th><td>${escapeHtml((document.outputFormat || "doc").toUpperCase())}</td><th>Generated</th><td>${escapeHtml(generatedAt)}</td></tr>
        <tr><th>Template</th><td>${escapeHtml(templateName)}</td><th>Folder</th><td>${escapeHtml(document.folder || "Project")}</td></tr>
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
      Leader Group | ${escapeHtml(project)} | Generated from Synergi Task | Approved branded style, fonts, tables, Arabic layout, and document control.
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
