/**
 * Signed TUS upload to Supabase Storage quarantine paths.
 * Uses mint token in x-signature — no service-role in the browser.
 */
import * as tus from 'tus-js-client';

const CHUNK_SIZE = 6 * 1024 * 1024;
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 20000];

export function getResumableSignEndpoint() {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('VITE_SUPABASE_URL is not configured');
  return `${base}/storage/v1/upload/resumable/sign`;
}

/**
 * @param {object} opts
 * @param {Blob|File} opts.file
 * @param {string} opts.bucket
 * @param {string} opts.objectPath
 * @param {string} opts.contentType
 * @param {string} opts.signatureToken mint signed-upload token
 * @param {string} [opts.fingerprint] stable id for tus URL cache
 * @param {(bytes:number, total:number) => void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]
 */
export function uploadViaSignedTus(opts) {
  const {
    file,
    bucket,
    objectPath,
    contentType,
    signatureToken,
    fingerprint,
    onProgress,
    signal,
  } = opts;

  if (!signatureToken) {
    return Promise.reject(new Error('Missing signed upload token for resumable transfer'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value);
    };

    const upload = new tus.Upload(file, {
      endpoint: getResumableSignEndpoint(),
      retryDelays: RETRY_DELAYS,
      chunkSize: CHUNK_SIZE,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType: contentType || 'application/octet-stream',
        cacheControl: '3600',
      },
      headers: {
        'x-signature': signatureToken,
        'x-upsert': 'true',
      },
      // tus-js-client requires a function; never pass a raw string here.
      fingerprint: () =>
        Promise.resolve(
          fingerprint || `mil:${bucket}:${objectPath}:${file.size}:${file.name || 'blob'}`,
        ),
      onError(error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.(bytesUploaded, bytesTotal);
      },
      onSuccess() {
        finish(null, {
          url: upload.url || null,
          bytesUploaded: file.size,
        });
      },
    });

    if (signal) {
      if (signal.aborted) {
        upload.abort(true).catch(() => {});
        finish(new DOMException('Upload aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          upload.abort(true).catch(() => {});
          finish(new DOMException('Upload aborted', 'AbortError'));
        },
        { once: true },
      );
    }

    upload.findPreviousUploads().then((previous) => {
      if (previous?.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(() => {
      upload.start();
    });
  });
}

/** Fallback one-shot PUT when TUS endpoint is unavailable. */
export async function uploadViaSignedPut({ signedUrl, file, contentType, onProgress, signal }) {
  if (!signedUrl) throw new Error('Missing signed upload URL');

  // Prefer XHR for upload progress events.
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress?.(evt.loaded, evt.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve({ status: xhr.status });
        else reject(new Error(`Storage rejected the upload (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Upload aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }
      xhr.send(file);
    });
  }

  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
    body: file,
    signal,
  });
  if (!res.ok) throw new Error(`Storage rejected the upload (${res.status})`);
  onProgress?.(file.size, file.size);
  return { status: res.status };
}

export function isAbortError(err) {
  return err?.name === 'AbortError' || /aborted/i.test(String(err?.message || ''));
}

export function isTransientUploadError(err) {
  if (isAbortError(err)) return false;
  const msg = String(err?.message || err || '').toLowerCase();
  if (/forbidden|not allowed|unauthorized|unsupported|invalid signature|revoked|expired/.test(msg)) {
    return false;
  }
  return true;
}

export { CHUNK_SIZE, RETRY_DELAYS };
