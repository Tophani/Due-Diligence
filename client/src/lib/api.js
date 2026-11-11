// Talking to the server (server/). In development Vite forwards /api to it (vite.config.js).
// The session cookie is httpOnly, so the browser sends it; scripts here never see it.

/** Sent with every change, so the server knows the request came from our own pages. */
const CSRF_HEADER = { 'X-Requested-With': 'TracTrac' };
const OFFLINE = 'Couldn’t reach the server. Check your connection and try again.';

export class ApiError extends Error {
  constructor(status, message, body = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Tell the app the session has ended (AuthProvider listens and shows sign-in). */
const signedOut = () => window.dispatchEvent(new Event('tractrac:signed-out'));

/** JSON request. Throws ApiError with the server's message. */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { ...(method !== 'GET' ? CSRF_HEADER : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  // 502/504 come from the dev proxy (or a gateway) when the API server isn't running.
  if ((res.status === 502 || res.status === 504) && !data?.error) throw new ApiError(0, OFFLINE);
  if (res.status === 401 && path !== '/auth/me') signedOut();
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Something went wrong. Please try again.', data);
  return data;
}

/**
 * Upload one file as multipart form data ("files"), reporting progress 0–100.
 * Returns { promise, abort }. An aborted upload rejects with ApiError status -1.
 */
export function uploadFile(path, file, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', `/api${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', CSRF_HEADER['X-Requested-With']);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status === 401) signedOut();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data?.error || 'The upload didn’t work. Please try again.', data));
    };
    xhr.onerror = () => reject(new ApiError(0, OFFLINE));
    xhr.onabort = () => reject(new ApiError(-1, 'Upload cancelled'));
    const form = new FormData();
    form.append('files', file);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
