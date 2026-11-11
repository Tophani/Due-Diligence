// Excel export in the browser (SheetJS). The community build writes number formats and column
// widths but not fonts or frozen panes, so the workbook XML is patched afterwards: the header
// row of every report sheet is bold and frozen.
//
// sheet: { name, columns: [{ header, width, format?: 'pct' | 'int' }], rows: [[...]],
//          totalRow?: true (last row bold), plain?: true (no header styling) }

const enc = new TextEncoder();
const dec = new TextDecoder();

function buildSheet(XLSX, sheet) {
  const aoa = sheet.plain ? sheet.rows : [sheet.columns.map((c) => c.header), ...sheet.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map((v) => (v === null || v === undefined ? '' : v))));
  const first = sheet.plain ? 0 : 1;
  sheet.columns.forEach((c, ci) => {
    if (!c.format) return;
    for (let ri = first; ri < aoa.length; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
      if (cell && cell.t === 'n') cell.z = c.format === 'pct' ? '0%' : '0';
    }
  });
  ws['!cols'] = sheet.columns.map((c) => ({ wch: c.width || 14 }));
  return ws;
}

/** Add a bold font and a bold cell format (plus a bold percentage format) to styles.xml. */
function patchStyles(xml) {
  const fonts = xml.match(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/);
  const boldFontId = Number(fonts[1]);
  const firstFont = fonts[2].match(/<font>([\s\S]*?)<\/font>/)[1];
  const boldFont = `<font><b/>${firstFont}</font>`;
  xml = xml.replace(fonts[0], `<fonts count="${boldFontId + 1}">${fonts[2]}${boldFont}</fonts>`);
  const xfs = xml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  const boldXf = Number(xfs[1]);
  const added =
    `<xf numFmtId="0" fontId="${boldFontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="9" fontId="${boldFontId}" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>` +
    `<xf numFmtId="1" fontId="${boldFontId}" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>`;
  xml = xml.replace(xfs[0], `<cellXfs count="${boldXf + 3}">${xfs[2]}${added}</cellXfs>`);
  return { xml, bold: boldXf, boldPct: boldXf + 1, boldInt: boldXf + 2 };
}

/** Bold row r (all its cells); keep percentage / integer formats on bold cells. */
function boldRow(xml, r, ids, pctXf) {
  return xml.replace(new RegExp(`<row r="${r}"([^>]*)>([\\s\\S]*?)</row>`), (_, attrs, cells) => {
    const styled = cells.replace(/<c r="([A-Z]+\d+)"( s="(\d+)")?/g, (m, ref, __, s) => {
      const xf = s === undefined ? ids.bold : pctXf.has(Number(s)) ? ids.boldPct : ids.boldInt;
      return `<c r="${ref}" s="${xf}"`;
    });
    return `<row r="${r}"${attrs}>${styled}</row>`;
  });
}

const FROZEN = '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>';

/** Build the .xlsx bytes for some sheets. */
export async function buildWorkbook(sheets) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, s), s.name.slice(0, 31)));
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const zip = XLSX.CFB.read(new Uint8Array(raw), { type: 'array' });
  const file = (path) => XLSX.CFB.find(zip, path);
  const stylesEntry = file('/xl/styles.xml');
  const styles = patchStyles(dec.decode(new Uint8Array(stylesEntry.content)));
  stylesEntry.content = enc.encode(styles.xml);
  // Existing cellXfs that are percentage formats (numFmtId 9).
  const pctXf = new Set([...styles.xml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].matchAll(/<xf [^>]*?\/>/g)].map((m, i) => (/numFmtId="9"/.test(m[0]) ? i : -1)).filter((i) => i >= 0));

  sheets.forEach((s, i) => {
    if (s.plain) return;
    const entry = file(`/xl/worksheets/sheet${i + 1}.xml`);
    let xml = dec.decode(new Uint8Array(entry.content));
    xml = boldRow(xml, 1, styles, pctXf);
    if (s.totalRow) xml = boldRow(xml, s.rows.length + 1, styles, pctXf);
    xml = xml.replace(/<sheetView workbookViewId="0"\s*\/>/, FROZEN);
    entry.content = enc.encode(xml);
  });
  return XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' });
}

/** Save bytes as a file. */
export function download(bytes, fileName, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
