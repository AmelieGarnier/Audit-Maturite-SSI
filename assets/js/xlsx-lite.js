/* SSI Audit — Générateur .xlsx autonome (ZIP sans compression + OOXML), sans dépendance.
 * Gère : styles (police, couleur, remplissage, bordure, alignement, retour à la ligne), cellules fusionnées,
 * largeurs de colonnes, hauteurs de lignes, volets figés, filtres et listes déroulantes.
 *
 * XLSXLite.build([{
 *   name: 'Feuille', cols: [12, 40], freeze: 'B5', merges: ['A1:M1'], autoFilter: 'A4:M46',
 *   validations: [{ ref: 'C5:C40', list: ['Oui', 'Non'] }],
 *   rows: [ [valeur, { v: valeur, s: { b: true, color: 'FFFFFF', fill: '1E5631', h: 'center', wrap: true, border: true } }],
 *           { h: 30, cells: [...] } ]
 * }]) → Blob */
(function (root) {
  'use strict';
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (s, x) { return s + x.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function xml(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Neutralise l'injection de formules (=, +, -, @, tabulation, retour chariot en tête de cellule).
  function safeText(s) { s = String(s); return /^[=+\-@\t\r]/.test(s) ? '\'' + s : s; }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function argb(c) { c = String(c || '').replace('#', '').toUpperCase(); return c.length === 6 ? 'FF' + c : c; }

  // ---------- Registre des styles ----------
  function Styles() {
    this.fonts = ['<font><sz val="10"/><name val="Calibri"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.index = {};
    this.dxfs = [];
  }
  Styles.prototype.dxf = function (r) {
    var x = '<dxf><font>' + (r.b ? '<b/>' : '') + (r.color ? '<color rgb="' + argb(r.color) + '"/>' : '') + '</font><fill><patternFill patternType="solid"><fgColor rgb="' + argb(r.fill) + '"/><bgColor rgb="' + argb(r.fill) + '"/></patternFill></fill></dxf>';
    return this.add(this.dxfs, x);
  };
  Styles.prototype.add = function (list, x) { var i = list.indexOf(x); if (i >= 0) return i; list.push(x); return list.length - 1; };
  Styles.prototype.id = function (s) {
    if (!s) return 0;
    var key = JSON.stringify(s);
    if (this.index[key] !== undefined) return this.index[key];
    var font = '<font>' + (s.b ? '<b/>' : '') + (s.i ? '<i/>' : '') + '<sz val="' + (s.sz || 10) + '"/>' + (s.color ? '<color rgb="' + argb(s.color) + '"/>' : '') + '<name val="Calibri"/></font>';
    var fontId = this.add(this.fonts, font);
    var fillId = s.fill ? this.add(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="' + argb(s.fill) + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    var borderId = s.border ? 1 : 0;
    var align = '<alignment vertical="' + (s.v || 'top') + '"' + (s.h ? ' horizontal="' + s.h + '"' : '') + (s.wrap ? ' wrapText="1"' : '') + '/>';
    var numFmt = s.pct ? 10 : s.dec ? 2 : 0;
    var xf = '<xf numFmtId="' + numFmt + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0" applyFont="1"' + (fillId ? ' applyFill="1"' : '') + (borderId ? ' applyBorder="1"' : '') + (numFmt ? ' applyNumberFormat="1"' : '') + ' applyAlignment="1">' + align + '</xf>';
    var id = this.add(this.xfs, xf);
    this.index[key] = id;
    return id;
  };
  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      (this.dxfs.length ? '<dxfs count="' + this.dxfs.length + '">' + this.dxfs.join('') + '</dxfs>' : '') + '</styleSheet>';
  };

  function sheetXml(sh, styles) {
    var out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
    out.push('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    out.push('<sheetViews><sheetView workbookViewId="0"' + (sh.zoom ? ' zoomScale="' + sh.zoom + '"' : '') + '>');
    if (sh.freeze) {
      var m = /^([A-Z]+)(\d+)$/.exec(sh.freeze), cIdx = 0;
      for (var i = 0; i < m[1].length; i++) cIdx = cIdx * 26 + m[1].charCodeAt(i) - 64;
      var xs = cIdx - 1, ys = +m[2] - 1;
      out.push('<pane' + (xs ? ' xSplit="' + xs + '"' : '') + (ys ? ' ySplit="' + ys + '"' : '') + ' topLeftCell="' + sh.freeze + '" activePane="' + (xs && ys ? 'bottomRight' : ys ? 'bottomLeft' : 'topRight') + '" state="frozen"/>');
    }
    out.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="13.5"/>');
    if (sh.cols && sh.cols.length) out.push('<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>');
    out.push('<sheetData>');
    sh.rows.forEach(function (row, r) {
      if (!row) return;
      var cells = Array.isArray(row) ? row : row.cells || [];
      var h = Array.isArray(row) ? null : row.h;
      out.push('<row r="' + (r + 1) + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>');
      cells.forEach(function (cell, c) {
        var v = cell, s = null, f = null;
        if (cell && typeof cell === 'object' && !Array.isArray(cell)) { v = cell.v; s = cell.s; f = cell.f; }
        var st = styles.id(s), ref = col(c) + (r + 1), sa = st ? ' s="' + st + '"' : '';
        if (f) {
          var fx = '<f>' + xml(f) + '</f>';
          if (typeof v === 'number' && isFinite(v)) out.push('<c r="' + ref + '"' + sa + '>' + fx + '<v>' + v + '</v></c>');
          else out.push('<c r="' + ref + '"' + sa + ' t="str">' + fx + '<v>' + xml(v === null || v === undefined ? '' : v) + '</v></c>');
          return;
        }
        if (v === null || v === undefined || v === '') { if (st) out.push('<c r="' + ref + '"' + sa + '/>'); return; }
        if (typeof v === 'number' && isFinite(v)) out.push('<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>');
        else out.push('<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xml(safeText(v)) + '</t></is></c>');
      });
      out.push('</row>');
    });
    out.push('</sheetData>');
    if (sh.autoFilter) out.push('<autoFilter ref="' + sh.autoFilter + '"/>');
    if (sh.merges && sh.merges.length) out.push('<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>');
    var prio = 1;
    (sh.conditional || []).forEach(function (cf) {
      out.push('<conditionalFormatting sqref="' + cf.ref + '">' + cf.rules.map(function (r) {
        return '<cfRule type="cellIs" dxfId="' + styles.dxf(r) + '" priority="' + (prio++) + '" operator="equal"><formula>"' + xml(r.eq) + '"</formula></cfRule>';
      }).join('') + '</conditionalFormatting>');
    });
    if (sh.validations && sh.validations.length) {
      out.push('<dataValidations count="' + sh.validations.length + '">' + sh.validations.map(function (v) {
        return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + v.ref + '"><formula1>"' + xml(v.list.join(',')) + '"</formula1></dataValidation>';
      }).join('') + '</dataValidations>');
    }
    out.push('<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>');
    out.push('<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>');
    out.push('</worksheet>');
    return out.join('');
  }

  function build(sheets) {
    var used = {}, styles = new Styles();
    sheets.forEach(function (s, i) {
      var n = String(s.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Feuille' + (i + 1);
      while (used[n]) n = n.slice(0, 28) + ' ' + i;
      used[n] = 1; s.safeName = n;
    });
    var sheetFiles = sheets.map(function (s, i) { return { name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s, styles) }; });
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + xml(s.safeName) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        (sheets.some(function (s) { return s.autoFilter; }) ? '<definedNames>' + sheets.map(function (s, i) {
          if (!s.autoFilter) return '';
          var p = s.autoFilter.split(':'), a = /([A-Z]+)(\d+)/.exec(p[0]), b = /([A-Z]+)(\d+)/.exec(p[1]);
          return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xml(s.safeName.replace(/'/g, '\'\'')) + '\'!$' + a[1] + '$' + a[2] + ':$' + b[1] + '$' + b[2] + '</definedName>';
        }).join('') + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: styles.xml() }
    ];
    return zip(files.concat(sheetFiles));
  }

  root.XLSXLite = { build: build, crc32: crc32, col: col };
})(typeof window !== 'undefined' ? window : globalThis);
