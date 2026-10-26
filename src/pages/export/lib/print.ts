const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Opens a print-ready page (the browser's print dialog can save it as PDF). */
export function printTable(title: string, headers: string[], rows: string[][], footer: string) {
  const win = window.open('', '_blank');
  if (!win) return false;

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
  body { font: 12px/1.4 system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  p { color: #555; margin-top: 12px; }
  @media print { body { margin: 0; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
</style></head><body>
<h1>${escape(title)}</h1>
<table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<p>${escape(footer)}</p>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
