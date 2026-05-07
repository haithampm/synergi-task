import type { WorkspaceProjectDocument } from "@/lib/workspace-store";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const englishOnly = (value: string) =>
  value
    .replace(/\s*\/\s*[\u0600-\u06FF\s]+/g, "")
    .replace(/[\u0600-\u06FF]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const normalizeLine = (line: string) => englishOnly(line.trim());
const slug = (value: string) => englishOnly(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const WORD_TABLE_STYLE = "width:100%;border-collapse:collapse;border-spacing:0;border:1.25pt solid #7f9db9;mso-border-alt:solid #7f9db9 .75pt;mso-table-lspace:0pt;mso-table-rspace:0pt;";
const WORD_TH_STYLE = "background:#17365d;color:#ffffff;border:1pt solid #17365d;mso-border-alt:solid #17365d .75pt;padding:6pt 7pt;font-weight:bold;text-align:left;vertical-align:middle;";
const WORD_TD_STYLE = "border:1pt solid #9eb6ce;mso-border-alt:solid #9eb6ce .75pt;padding:5pt 7pt;vertical-align:top;min-height:18pt;height:18pt;";
const META_TH_STYLE = "background:#17365d;color:#ffffff;border:1pt solid #17365d;mso-border-alt:solid #17365d .75pt;padding:6pt 7pt;font-weight:bold;text-align:left;width:18%;";
const META_TD_STYLE = "border:1pt solid #a9c4dc;mso-border-alt:solid #a9c4dc .75pt;padding:6pt 7pt;background:#ffffff;width:32%;";
const APPROVAL_TH_STYLE = "background:#70ad47;color:#ffffff;border:1pt solid #548235;mso-border-alt:solid #548235 .75pt;padding:7pt;font-weight:bold;text-align:left;";
const APPROVAL_TD_STYLE = "border:1pt solid #9eb6ce;mso-border-alt:solid #9eb6ce .75pt;padding:11pt 8pt;height:26pt;";

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
    const headers = tableRows[0].split(/\s*\|\s*/).map(englishOnly).filter((part) => part.length > 0);
    const bodyRows = tableRows.slice(1).map((row) => row.split(/\s*\|\s*/).map(englishOnly));
    const columnCount = Math.max(headers.length, ...bodyRows.map((row) => row.length), 1);
    html.push(`<table class='data-table cols-${columnCount}' border='1' cellspacing='0' cellpadding='0' style='${WORD_TABLE_STYLE}'>`);
    html.push("<thead><tr>" + Array.from({ length: columnCount }, (_, index) => `<th style='${WORD_TH_STYLE}'>${escapeHtml(headers[index] ?? "")}</th>`).join("") + "</tr></thead>");
    html.push("<tbody>");
    bodyRows.forEach((row, rowIndex) => {
      const shade = rowIndex % 2 === 1 ? "background:#f3f6fa;" : "background:#ffffff;";
      html.push("<tr>" + Array.from({ length: columnCount }, (_, index) => `<td style='${WORD_TD_STYLE}${shade}'>${escapeHtml(row[index] ?? "")}</td>`).join("") + "</tr>");
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
      html.push(`<h2 id='${slug(line)}'><span>${escapeHtml(line)}</span></h2>`);
      return;
    }
    html.push(`<p>${escapeHtml(line)}</p>`);
  });

  flushTable();
  return html.join("\n");
};

const baseStyles = (isExcel: boolean) => `
  @page { margin: ${isExcel ? "10mm 8mm" : "16mm 13mm 15mm 13mm"}; }
  * { box-sizing: border-box; }
  body {
    font-family: "Aptos", "Segoe UI", "Arial", sans-serif;
    color: #1f2937;
    margin: 0;
    background: #ffffff;
    font-size: ${isExcel ? "8.6pt" : "9.2pt"};
    line-height: ${isExcel ? "1.28" : "1.42"};
  }
  .page { max-width: ${isExcel ? "1240px" : "980px"}; margin: 0 auto; padding: ${isExcel ? "8px 10px" : "12px 18px"}; }
  .header { display: table; width: 100%; border-bottom: 4px solid #17365d; padding-bottom: 9px; margin-bottom: 12px; }
  .brand-left, .brand-right { display: table-cell; vertical-align: middle; width: 31%; }
  .brand-center { display: table-cell; text-align: center; vertical-align: middle; width: 38%; }
  .leader-logo { font-size: 25px; letter-spacing: 4px; color: #315f7a; font-weight: 800; line-height: 1; }
  .leader-sub { font-size: 8px; letter-spacing: 5px; color: #c00000; font-weight: 800; margin-top: 5px; }
  .client-logo { display: inline-block; border: 2px solid #70ad47; color: #1f2937; border-radius: 36px; padding: 5px 15px; font-size: 12px; font-weight: 800; }
  .client-sub { font-size: 8px; color: #475569; margin-top: 5px; }
  .doc-class { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.14em; }
  .title-block { background: #f3f6fa; border: 1px solid #a9c4dc; border-left: 6px solid #17365d; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  h1 { margin: 0 0 4px 0; color: #17365d; font-size: ${isExcel ? "16px" : "18px"}; line-height: 1.2; font-weight: 800; }
  h2 { color: #17365d; font-size: ${isExcel ? "11px" : "12px"}; margin: 14px 0 6px; padding: 7px 9px; border-left: 5px solid #17365d; border-top: 1px solid #a9c4dc; border-right: 1px solid #a9c4dc; border-bottom: 1px solid #a9c4dc; background: #d9eaf7; font-weight: 800; page-break-after: avoid; text-transform: uppercase; letter-spacing: 0.02em; }
  h2 span { display: inline-block; }
  p { margin: 3px 0; }
  .meta-grid { width: 100%; border-collapse: collapse; border-spacing:0; margin-top: 10px; font-size: ${isExcel ? "8.4pt" : "8.7pt"}; table-layout: fixed; border: 1.25pt solid #7f9db9; mso-border-alt: solid #7f9db9 .75pt; }
  .meta-grid th { background: #17365d; color: #ffffff; text-align: left; padding: 6px 7px; border: 1pt solid #17365d; mso-border-alt: solid #17365d .75pt; width: 18%; font-weight: 800; }
  .meta-grid td { padding: 6px 7px; border: 1pt solid #a9c4dc; mso-border-alt: solid #a9c4dc .75pt; background: #ffffff; min-height: 18px; width: 32%; }
  .data-table { width: 100%; border-collapse: collapse; border-spacing:0; margin: 6px 0 11px; font-size: ${isExcel ? "8.2pt" : "8.5pt"}; page-break-inside: auto; table-layout: ${isExcel ? "auto" : "fixed"}; border: 1.25pt solid #7f9db9; mso-border-alt: solid #7f9db9 .75pt; }
  .data-table thead { display: table-header-group; }
  .data-table th { background: #17365d; color: #ffffff; border: 1pt solid #17365d; mso-border-alt: solid #17365d .75pt; padding: 6px 7px; text-align: left; font-weight: 800; vertical-align: middle; }
  .data-table td { border: 1pt solid #9eb6ce; mso-border-alt: solid #9eb6ce .75pt; padding: 5px 7px; vertical-align: top; min-height: 20px; height: ${isExcel ? "22px" : "auto"}; }
  .data-table tbody tr:nth-child(even) td { background: #f3f6fa; }
  .data-table tbody tr:nth-child(odd) td { background: #ffffff; }
  .data-table tbody tr:hover td { background: #eaf2f8; }
  .data-table.cols-2 td:first-child, .data-table.cols-3 td:first-child { font-weight: 700; color: #17365d; background: #eef4fb; }
  .field span { color: #17365d; font-weight: 800; }
  .bullet { margin-left: 14px; }
  .bullet:before { content: "• "; color: #70ad47; font-weight: 900; margin-left: -11px; }
  .numbered { margin-left: 14px; }
  .spacer { height: 2px; }
  .approval { margin-top: 18px; page-break-inside: avoid; }
  .approval table { width: 100%; border-collapse: collapse; border-spacing:0; table-layout: fixed; border: 1.25pt solid #7f9db9; mso-border-alt: solid #7f9db9 .75pt; }
  .approval th { background: #70ad47; color: white; padding: 7px; border: 1pt solid #548235; mso-border-alt: solid #548235 .75pt; font-size: 8.6pt; text-align: left; }
  .approval td { border: 1pt solid #9eb6ce; mso-border-alt: solid #9eb6ce .75pt; padding: 11px 8px; height: 26px; }
  .footer { margin-top: 18px; padding-top: 8px; border-top: 2px solid #d9e2f3; color: #64748b; font-size: 7.8pt; text-align: center; }
`;

export const buildBrandedDocumentHtml = (document: WorkspaceProjectDocument, projectName?: string) => {
  const outputFormat = document.outputFormat ?? document.metadata?.extension ?? "doc";
  const isExcel = outputFormat === "xlsx";
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
  <style>${baseStyles(isExcel)}</style>
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
      <table class="meta-grid" border="1" cellspacing="0" cellpadding="0" style="${WORD_TABLE_STYLE}">
        <tr><th style="${META_TH_STYLE}">Project</th><td style="${META_TD_STYLE}">${escapeHtml(project)}</td><th style="${META_TH_STYLE}">Phase</th><td style="${META_TD_STYLE}">${escapeHtml(phase)}</td></tr>
        <tr><th style="${META_TH_STYLE}">Deliverable</th><td style="${META_TD_STYLE}">${escapeHtml(deliverable)}</td><th style="${META_TH_STYLE}">Status</th><td style="${META_TD_STYLE}">${escapeHtml(englishOnly(document.reviewStatus || ""))}</td></tr>
        <tr><th style="${META_TH_STYLE}">Output Type</th><td style="${META_TD_STYLE}">${escapeHtml(englishOnly((document.outputFormat || "").toUpperCase()))}</td><th style="${META_TH_STYLE}">Generated</th><td style="${META_TD_STYLE}">${escapeHtml(generatedAt)}</td></tr>
        <tr><th style="${META_TH_STYLE}">Template</th><td style="${META_TD_STYLE}">${escapeHtml(templateName)}</td><th style="${META_TH_STYLE}">Folder</th><td style="${META_TD_STYLE}">${escapeHtml(englishOnly(document.folder || ""))}</td></tr>
      </table>
    </div>

    ${renderContentLines(document.content)}

    ${isExcel ? "" : `<div class="approval">
      <h2>Approval</h2>
      <table border="1" cellspacing="0" cellpadding="0" style="${WORD_TABLE_STYLE}">
        <tr><th style="${APPROVAL_TH_STYLE}">Name</th><th style="${APPROVAL_TH_STYLE}">Role</th><th style="${APPROVAL_TH_STYLE}">Signature</th><th style="${APPROVAL_TH_STYLE}">Date</th></tr>
        <tr><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}">Project Manager</td><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}"></td></tr>
        <tr><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}">Client Representative</td><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}"></td></tr>
        <tr><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}">Authorized Approver</td><td style="${APPROVAL_TD_STYLE}"></td><td style="${APPROVAL_TD_STYLE}"></td></tr>
      </table>
    </div>`}

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
