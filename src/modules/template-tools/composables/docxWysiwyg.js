// Pure WYSIWYG DOCX->HTML assembly helpers.
// No Vue, no DOM, no docx-preview dependency — fully unit-testable in Node.

/**
 * Renders docx-preview output as a full-auto continuous flow: drops the grey
 * wrapper background, page shadows, forced page heights, inter-page gaps AND the
 * fixed page width/margins so content fills the container width and the iframe
 * auto-height reports one block. inter-word justify keeps word spacing even
 * without hyphenation (browser hyphenation splits words at non-Word points).
 * NOTE: at a non-doc width, justified line breaks differ from Word — accepted
 * trade-off for full-auto layout.
 */
export const FLOW_OVERRIDE_CSS = `body { margin: 0; }
.docx-wrapper { background: #fff; padding: 0; display: block; }
.docx-wrapper > section.docx,
.docx-wrapper > .docx {
  width: auto !important;
  max-width: none !important;
  min-height: 0 !important;
  padding: 16px !important;
  margin: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  page-break-after: auto !important;
  box-sizing: border-box !important;
}
.docx-wrapper p {
  text-justify: inter-word;
}
.docx-wrapper * {
  hyphens: none !important;
  overflow-wrap: break-word !important;
  box-sizing: border-box !important;
}
.docx-wrapper img {
  max-width: 100% !important;
  height: auto !important;
}
.docx-wrapper table {
  max-width: 100% !important;
  width: 100% !important;
  table-layout: auto !important;
  word-break: break-word !important;
}
.docx-wrapper table td,
.docx-wrapper table th {
  min-width: 0 !important;
  word-break: break-word !important;
}
.docx-wrapper p[class^="docx-num-"] {
  display: list-item !important;
  list-style: none !important;
}
.docx-wrapper p[class^="docx-num-"][style*="margin-inline-start"] {
  text-indent: -22pt !important;
}
.docx-wrapper p[class^="docx-num-"][style*="margin-inline-start"]::before {
  min-width: 20pt !important;
  padding-right: 2pt !important;
}
.docx-wrapper p[class^="docx-num-"]::before {
  display: inline-block !important;
  min-width: 18pt !important;
  text-indent: 0 !important;
  padding-right: 4pt !important;
}
@media (max-width: 640px) {
  .docx-wrapper > section.docx,
  .docx-wrapper > .docx {
    padding: 8px !important;
  }
  .docx-wrapper span,
  .docx-wrapper p {
    font-size: inherit !important;
  }
}`

/**
 * Iframe embed script. The converted HTML lives inside an <iframe> on the parent
 * platform. On load it reports its content height so the parent can auto-size the
 * iframe; on any link click it asks the parent to start loading and resize.
 *
 * NOTE: postMessage target '*' accepts any origin. Replace with the specific
 * parent origin in production.
 */
export const NUMBERING_FIX_SCRIPT = `<script>
  (function() {
    var SHIFT = 11;
    document.querySelectorAll('p[style*="margin-inline-start"]').forEach(function(p) {
      var cur = parseFloat(p.style.marginInlineStart);
      if (cur > 0) {
        p.style.marginInlineStart = Math.max(0, cur - SHIFT) + 'pt';
      }
    });
  })();
<\/script>`

export const PARENT_COMM_SCRIPT = `<script>
  window.onload = function () {
    // Measure the rendered height of the page inside the iframe
    var height = document.body.scrollHeight;
    // Send the height to the parent window
    window.parent.postMessage({ height: height + 1 }, '*');
    // NOTE: '*' accepts any origin — replace with the specific parent origin in production
  };

  document.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var linkHeight = 800;
      // Notify the parent that a link was clicked (start loading, resize)
      window.parent.postMessage({ height: linkHeight + 1, loading: 'startLoading' }, '*');
    });
  });
<\/script>`

/**
 * Assemble the final WYSIWYG HTML document from its parts.
 *
 * @param {object} args
 * @param {string} args.bodyContent  - rendered docx-preview body markup (pages)
 * @param {string} [args.styleContent] - docx-preview generated <style> blocks
 * @returns {string} complete HTML document
 */
export function buildDocumentHtml({ bodyContent, styleContent = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${styleContent}
  <style>
${FLOW_OVERRIDE_CSS}
  </style>
</head>
<body>
${bodyContent}
${NUMBERING_FIX_SCRIPT}
${PARENT_COMM_SCRIPT}
</body>
</html>`
}
