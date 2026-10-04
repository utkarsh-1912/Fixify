// Which received files may be previewed in the browser. Anything that can execute script when
// rendered from our origin (html, svg, xml with stylesheets, js...) must be downloaded, never opened.

const PREVIEW_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  // Text-like formats are always re-labelled text/plain so the browser shows them as inert text.
  txt: 'text/plain',
  log: 'text/plain',
  fix: 'text/plain',
  json: 'text/plain',
  csv: 'text/plain',
  xml: 'text/plain',
};

export function previewMimeFor(fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PREVIEW_TYPES, ext) ? PREVIEW_TYPES[ext] : null;
}
