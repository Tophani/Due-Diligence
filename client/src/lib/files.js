// Evidence upload rules shown in the design: PDF, DOCX, XLSX, JPG or PNG · max 20 MB each.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => '.' + e).join(',');

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Returns an error message, or '' if the file can be uploaded. */
export function validateFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return "This file type isn't accepted. Upload a PDF, DOCX, XLSX, JPG or PNG.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File is ${formatSize(file.size)}. The limit is 20 MB — split it by year or compress it.`;
  }
  return '';
}
