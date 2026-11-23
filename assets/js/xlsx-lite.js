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

  // Retire les plages vides ou inversées (ex. « I5:I4 » quand un tableau n'a aucune ligne) : Excel les refuse.
  function cleanRef(ref) {
    return String(ref || '').split(/\s+/).filter(function (r) {
      var m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);
      return m && (!m[3] || +m[4] >= +m[2]);
    }).join(' ');
  }
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
    if (sh.autoFilter && cleanRef(sh.autoFilter)) out.push('<autoFilter ref="' + sh.autoFilter + '"/>');
    if (sh.merges && sh.merges.length) out.push('<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>');
    var prio = 1;
    (sh.conditional || []).forEach(function (cf) {
      if (!cleanRef(cf.ref)) return;
      out.push('<conditionalFormatting sqref="' + cleanRef(cf.ref) + '">' + cf.rules.map(function (r) {
        return '<cfRule type="cellIs" dxfId="' + styles.dxf(r) + '" priority="' + (prio++) + '" operator="equal"><formula>"' + xml(r.eq) + '"</formula></cfRule>';
      }).join('') + '</conditionalFormatting>');
    });
    var vals = (sh.validations || []).filter(function (v) { return cleanRef(v.ref); });
    if (vals.length) {
      out.push('<dataValidations count="' + vals.length + '">' + vals.map(function (v) {
        return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + cleanRef(v.ref) + '"><formula1>"' + xml(v.list.join(',')) + '"</formula1></dataValidation>';
      }).join('') + '</dataValidations>');
    }
    out.push('<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>');
    out.push('<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>');
    if (sh.charts && sh.charts.length) out.push('<drawing r:id="rIdDr1"/>');
    out.push('</worksheet>');
    return out.join('');
  }

  // ---------- Graphiques (DrawingML) ----------
  var EMU_PT = 12700;
  function absRef(sheetName, c1, r1, c2, r2) {
    return '\'' + String(sheetName).replace(/'/g, '\'\'') + '\'!$' + col(c1) + '$' + r1 + (c2 === undefined ? '' : ':$' + col(c2) + '$' + r2);
  }
  function txPr(sz, color, bold) {
    return '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + sz + '"' + (bold ? ' b="1"' : ' b="0"') + '><a:solidFill><a:srgbClr val="' + (color || '404040') + '"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="fr-FR"/></a:p></c:txPr>';
  }
  function strCache(vals) { return '<c:strCache><c:ptCount val="' + vals.length + '"/>' + vals.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + xml(v) + '</c:v></c:pt>'; }).join('') + '</c:strCache>'; }
  function numCache(vals) { return '<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + vals.length + '"/>' + vals.map(function (v, i) { return v === null || v === undefined || v === '' ? '' : '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>'; }).join('') + '</c:numCache>'; }
  function chartXml(ch, sheetName) {
    var cat = ch.categories;
    var catRef = absRef(sheetName, cat.col, cat.from, cat.col, cat.to);
    var radar = ch.type === 'radar';
    var series = ch.series.map(function (s, i) {
      var fill = '<a:solidFill><a:srgbClr val="' + s.color + '"/></a:solidFill>';
      var sp = radar ? '<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="' + s.color + '"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>' + fill + '<a:ln><a:solidFill><a:srgbClr val="' + s.color + '"/></a:solidFill></a:ln></c:spPr></c:marker>'
        : '<c:spPr>' + fill + '<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>';
      return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/><c:tx><c:strRef><c:f>' + xml(absRef(sheetName, s.nameCol, s.nameRow)) + '</c:f>' + strCache([s.name]) + '</c:strRef></c:tx>' + sp +
        '<c:cat><c:strRef><c:f>' + xml(catRef) + '</c:f>' + strCache(cat.values) + '</c:strRef></c:cat>' +
        '<c:val><c:numRef><c:f>' + xml(absRef(sheetName, s.col, cat.from, s.col, cat.to)) + '</c:f>' + numCache(s.values) + '</c:numRef></c:val></c:ser>';
    }).join('');
    var scaling = '<c:scaling><c:orientation val="minMax"/>' + (ch.max !== undefined ? '<c:max val="' + ch.max + '"/>' : '') + (ch.min !== undefined ? '<c:min val="' + ch.min + '"/>' : '') + '</c:scaling>';
    var grid = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
    var axLine = '<c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>';
    var plot;
    if (radar) {
      plot = '<c:radarChart><c:radarStyle val="marker"/><c:varyColors val="0"/>' + series + '<c:axId val="101"/><c:axId val="102"/></c:radarChart>' +
        '<c:catAx><c:axId val="101"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' + grid + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' + axLine + txPr(800) + '<c:crossAx val="102"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
        '<c:valAx><c:axId val="102"/>' + scaling + '<c:delete val="0"/><c:axPos val="l"/>' + grid + '<c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="cross"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' + axLine + txPr(800) + '<c:crossAx val="101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>' + (ch.majorUnit ? '<c:majorUnit val="' + ch.majorUnit + '"/>' : '') + '</c:valAx>';
    } else {
      var horiz = ch.type === 'bar';
      plot = '<c:barChart><c:barDir val="' + (horiz ? 'bar' : 'col') + '"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + series +
        '<c:gapWidth val="' + (ch.gapWidth || 80) + '"/><c:overlap val="' + (ch.overlap || 0) + '"/><c:axId val="201"/><c:axId val="202"/></c:barChart>' +
        '<c:catAx><c:axId val="201"/><c:scaling><c:orientation val="' + (horiz ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/><c:axPos val="' + (horiz ? 'l' : 'b') + '"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' + axLine + txPr(800) + '<c:crossAx val="202"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
        '<c:valAx><c:axId val="202"/>' + scaling + '<c:delete val="0"/><c:axPos val="' + (horiz ? 'b' : 'l') + '"/>' + grid +
        (ch.valTitle ? '<c:title><c:tx><c:rich><a:bodyPr rot="' + (horiz ? '0' : '-5400000') + '" vert="horz"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800" b="0"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="800" b="0"/><a:t>' + xml(ch.valTitle) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' : '') +
        '<c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' + axLine + txPr(800) + '<c:crossAx val="201"/><c:crosses val="' + (horiz ? 'max' : 'autoZero') + '"/><c:crossBetween val="between"/>' + (ch.majorUnit ? '<c:majorUnit val="' + ch.majorUnit + '"/>' : '') + '</c:valAx>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:date1904 val="0"/><c:lang val="fr-FR"/><c:roundedCorners val="0"/><c:chart>' +
      '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="' + (ch.titleColor || '1E5631') + '"/></a:solidFill></a:rPr><a:t>' + xml(ch.title) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>' + plot + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>' +
      '<c:legend><c:legendPos val="b"/><c:overlay val="0"/>' + txPr(900) + '</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr>' +
      '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="fr-FR"/></a:p></c:txPr></c:chartSpace>';
  }
  function drawingXml(charts, firstId) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
      charts.map(function (ch, i) {
        var a = ch.anchor;
        if (a.to) {
          return '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>' + a.col + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + a.row + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
            '<xdr:to><xdr:col>' + a.to.col + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + a.to.row + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
            '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (firstId + i + 1) + '" name="Graphique ' + (i + 1) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
            '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdC' + (i + 1) + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
        }
        return '<xdr:oneCellAnchor><xdr:from><xdr:col>' + a.col + '</xdr:col><xdr:colOff>' + (a.colOff || 0) + '</xdr:colOff><xdr:row>' + a.row + '</xdr:row><xdr:rowOff>' + (a.rowOff || 0) + '</xdr:rowOff></xdr:from>' +
          '<xdr:ext cx="' + Math.round(a.width * EMU_PT) + '" cy="' + Math.round(a.height * EMU_PT) + '"/>' +
          '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (firstId + i + 1) + '" name="Graphique ' + (i + 1) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
          '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rIdC' + (i + 1) + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>';
      }).join('') + '</xdr:wsDr>';
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
        (sheets.some(function (s) { return s.autoFilter && cleanRef(s.autoFilter); }) ? '<definedNames>' + sheets.map(function (s, i) {
          if (!s.autoFilter || !cleanRef(s.autoFilter)) return '';
          var p = s.autoFilter.split(':'), a = /([A-Z]+)(\d+)/.exec(p[0]), b = /([A-Z]+)(\d+)/.exec(p[1]);
          return '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xml(s.safeName.replace(/'/g, '\'\'')) + '\'!$' + a[1] + '$' + a[2] + ':$' + b[1] + '$' + b[2] + '</definedName>';
        }).join('') + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: styles.xml() }
    ];
    var extra = [], ct = [], chartN = 0, drawN = 0;
    sheets.forEach(function (s, i) {
      if (!s.charts || !s.charts.length) return;
      drawN++;
      extra.push({ name: 'xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + drawN + '.xml"/></Relationships>' });
      var rels = [];
      s.charts.forEach(function (ch, k) {
        chartN++;
        extra.push({ name: 'xl/charts/chart' + chartN + '.xml', data: chartXml(ch, s.safeName) });
        ct.push('<Override PartName="/xl/charts/chart' + chartN + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
        rels.push('<Relationship Id="rIdC' + (k + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + chartN + '.xml"/>');
      });
      extra.push({ name: 'xl/drawings/drawing' + drawN + '.xml', data: drawingXml(s.charts, 1) });
      extra.push({ name: 'xl/drawings/_rels/drawing' + drawN + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>' });
      ct.push('<Override PartName="/xl/drawings/drawing' + drawN + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
    });
    files[0].data = files[0].data.replace('</Types>', ct.join('') + '</Types>');
    return zip(files.concat(sheetFiles, extra));
  }

  root.XLSXLite = { build: build, crc32: crc32, col: col };
})(typeof window !== 'undefined' ? window : globalThis);
