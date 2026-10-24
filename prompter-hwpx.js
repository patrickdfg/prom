/* PROM: editable Hangul HWPX export (page boundaries and line colors preserved). */
(function (root) {
  'use strict';
  const MIME = 'application/hwp+zip';
  const H = 'http://www.hancom.co.kr/hwpml/2011/head';
  const P = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
  const S = 'http://www.hancom.co.kr/hwpml/2011/section';
  const C = 'http://www.hancom.co.kr/hwpml/2011/core';
  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function charStyle(id, color, bold) {
    const langs = ['hangul','latin','hanja','japanese','other','symbol','user'];
    const attrs = (n) => langs.map(k => k + '="' + n + '"').join(' ');
    return '<hh:charPr id="' + id + '" height="1600" textColor="' + color + '" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">'
      + '<hh:fontRef ' + attrs(0) + '/><hh:ratio ' + attrs(100) + '/>'
      + '<hh:spacing ' + attrs(0) + '/><hh:relSz ' + attrs(100) + '/><hh:offset ' + attrs(0) + '/>'
      + (bold ? '<hh:bold/>' : '')
      + '<hh:underline type="NONE" shape="SOLID" color="#000000"/>'
      + '<hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/>'
      + '<hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>'
      + '</hh:charPr>';
  }
  function header() {
    const langs = ['HANGUL','LATIN','HANJA','JAPANESE','OTHER','SYMBOL','USER'];
    const fonts = langs.map(lang => '<hh:fontface lang="' + lang + '" fontCnt="1">'
      + '<hh:font id="0" face="맑은 고딕" type="TTF" isEmbedded="0">'
      + '<hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>'
      + '</hh:font></hh:fontface>').join('');
    const border = id => '<hh:borderFill id="' + id + '" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
      + '<hh:slash type="NONE" Crooked="0" isCounter="0"/>'
      + '<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
      + ['left','right','top','bottom'].map(side => '<hh:' + side + 'Border type="NONE" width="0.1 mm" color="#000000"/>').join('')
      + '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>'
      + (id === 2 ? '<hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#999999" alpha="0"/></hc:fillBrush>' : '')
      + '</hh:borderFill>';
    const margins = '<hh:margin>' + ['intent','left','right','prev','next'].map(x => '<hc:' + x + ' value="0" unit="HWPUNIT"/>').join('') + '</hh:margin>';
    const spacing = '<hh:lineSpacing type="PERCENT" value="150" unit="HWPUNIT"/>';
    const para = '<hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="LTR">'
      + '<hh:align horizontal="CENTER" vertical="BASELINE"/>'
      + '<hh:heading type="NONE" idRef="0" level="0"/>'
      + '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
      + '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
      + '<hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">' + margins + spacing
      + '</hp:case><hp:default>' + margins + spacing + '</hp:default></hp:switch>'
      + '<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>'
      + '</hh:paraPr>';
    return '<?xml version="1.0" encoding="UTF-8"?>'
      + '<hh:head xmlns:hh="' + H + '" xmlns:hp="' + P + '" xmlns:hc="' + C + '" version="1.5" secCnt="1">'
      + '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>'
      + '<hh:refList><hh:fontfaces itemCnt="7">' + fonts + '</hh:fontfaces>'
      + '<hh:borderFills itemCnt="2">' + border(1) + border(2) + '</hh:borderFills>'
      + '<hh:charProperties itemCnt="4">' + charStyle(0, '#000000', false)
      + charStyle(1, '#0000FF', true) + charStyle(2, '#FF0000', false) + charStyle(3, '#777777', false)
      + '</hh:charProperties><hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'
      + '<hh:numberings itemCnt="0"/><hh:paraProperties itemCnt="1">' + para + '</hh:paraProperties>'
      + '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'
      + '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>'
      + '<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>'
      + '</hh:head>';
  }
  function sectionProperties() {
    return '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">'
      + '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>'
      + '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
      + '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
      + '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
      + '<hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY">'
      + '<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr>'
      + '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>'
      + '<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>'
      + '<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>'
      + '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>'
      + '<hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>'
      + '<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>'
      + ['BOTH','EVEN','ODD'].map(t => '<hp:pageBorderFill type="' + t + '" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">'
        + '<hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>').join('')
      + '</hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';
  }
  function textNode(s) {
    return '<hp:t>' + String(s).split(/\r\n|\r|\n/g).map(escapeXml).join('<hp:lineBreak/>') + '</hp:t>';
  }
  function section(pages) {
    let id = 1000000000, first = true;
    const paras = [];
    pages.forEach((page, pageIndex) => {
      const lines = Array.isArray(page) && page.length ? page : [[]];
      lines.forEach((line, lineIndex) => {
        const pageBreak = pageIndex > 0 && lineIndex === 0 ? '1' : '0';
        const runs = [];
        if (first) { runs.push('<hp:run charPrIDRef="0">' + sectionProperties() + '</hp:run>'); first = false; }
        for (const part of Array.isArray(line) ? line : []) {
          if (!part || !part.t) continue;
          const style = part.c === 'b' ? 1 : part.c === 'r' ? 2 : part.c === 'n' ? 3 : 0;
          runs.push('<hp:run charPrIDRef="' + style + '">' + textNode(part.t) + '</hp:run>');
        }
        if (!runs.length || !runs.some(r => r.includes('<hp:t>'))) runs.push('<hp:run charPrIDRef="0"><hp:t/></hp:run>');
        paras.push('<hp:p id="' + (id++) + '" paraPrIDRef="0" styleIDRef="0" pageBreak="' + pageBreak + '" columnBreak="0" merged="0">'
          + runs.join('') + '</hp:p>');
      });
    });
    return '<?xml version="1.0" encoding="UTF-8"?>'
      + '<hs:sec xmlns:hs="' + S + '" xmlns:hp="' + P + '">' + paras.join('') + '</hs:sec>';
  }
  function content(title) {
    return '<?xml version="1.0" encoding="UTF-8"?>'
      + '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">'
      + '<opf:metadata><opf:title>' + escapeXml(title) + '</opf:title><opf:language>ko</opf:language>'
      + '<opf:meta name="creator" content="PROM"/><opf:meta name="subject" content="설교 프롬프터"/></opf:metadata>'
      + '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>'
      + '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>'
      + '<opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>'
      + '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>'
      + '</opf:package>';
  }
  const VERSION = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="10" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="12.0.0.0"/>';
  const CONTAINER = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"><ocf:rootfiles>'
    + '<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>'
    + '</ocf:rootfiles></ocf:container>';
  const SETTINGS = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app">'
    + '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>';
  async function create(pages, options) {
    if (!Array.isArray(pages) || !pages.length) throw new Error('저장할 원고가 없습니다.');
    if (typeof JSZip === 'undefined') throw new Error('문서 저장 도구를 사용할 수 없습니다.');
    const title = options && options.title || '설교 원고', zip = new JSZip();
    zip.file('mimetype', MIME, { compression: 'STORE' });
    zip.file('version.xml', VERSION);
    zip.file('META-INF/container.xml', CONTAINER);
    zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>');
    zip.file('settings.xml', SETTINGS);
    zip.file('Contents/content.hpf', content(title));
    zip.file('Contents/header.xml', header());
    zip.file('Contents/section0.xml', section(pages));
    zip.file('Preview/PrvText.txt', pages.map(page => page.map(line => line.map(run => run.t || '').join('')).join('\n')).join('\n\n'));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: MIME });
  }
  root.PromHwpx = { create, escapeXml };
})(typeof window === 'undefined' ? globalThis : window);
