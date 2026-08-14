import { supabase } from "@/integrations/supabase/client";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/chat-attachments";
import { backoffDelay, isTemporaryNetworkError } from "@/lib/network";

export type UploadProgress = { percent: number; etaSeconds: number | null };

export type UploadOptions = {
  path: string;
  file: Blob;
  contentType?: string;
  timeoutMs?: number;
  bucket?: string;
  /** Bounded auto-retries for transient network drops. The path stays stable so retries never duplicate objects. */
  attempts?: number;
  onProgress?: (progress: UploadProgress) => void;
  onXhr?: (xhr: XMLHttpRequest | null) => void;
  onRetry?: (attempt: number) => void;
};

/** High-latency links need a timeout proportional to the payload, not a flat one. */
export function timeoutForSize(bytes: number) {
  const minutes = Math.ceil(bytes / (256 * 1024)) / 60; // assume >=256 KB/s floor
  return Math.min(Math.max(60000, minutes * 60000), 45 * 60000);
}

/** Stable, collision-free object path. Reusing it on retry avoids duplicate files. */
export function buildUploadPath(prefix: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
}

function putOnce(options: UploadOptions, timeoutMs: number, bucket: string) {
  const { path, file, contentType, onProgress, onXhr } = options;
  return new Promise<string>((resolve, reject) => {
    supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true })
      .then(({ data, error }) => {
        if (error || !data) {
          reject(error || new Error("Не удалось подготовить загрузку"));
          return;
        }

        const startedAt = Date.now();
        const xhr = new XMLHttpRequest();
        onXhr?.(xhr);
        xhr.open("PUT", data.signedUrl, true);
        xhr.timeout = timeoutMs;
        xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const elapsed = Math.max((Date.now() - startedAt) / 1000, 0.1);
          const speed = event.loaded / elapsed;
          onProgress?.({
            percent: Math.round((event.loaded / event.total) * 100),
            etaSeconds: speed > 0 ? Math.ceil((event.total - event.loaded) / speed) : null,
          });
        };
        xhr.onload = () => {
          onXhr?.(null);
          if (xhr.status >= 200 && xhr.status < 300) resolve(path);
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => { onXhr?.(null); reject(new Error("Failed to fetch")); };
        xhr.ontimeout = () => { onXhr?.(null); reject(new Error("Upload timeout")); };
        xhr.onabort = () => { onXhr?.(null); reject(new DOMException("Загрузка отменена", "AbortError")); };
        xhr.send(file);
      }, reject);
  });
}

export async function uploadAttachment(options: UploadOptions) {
  const bucket = options.bucket ?? CHAT_ATTACHMENTS_BUCKET;
  const timeoutMs = options.timeoutMs ?? timeoutForSize(options.file.size);
  const attempts = options.attempts ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await putOnce(options, timeoutMs, bucket);
    } catch (error) {
      lastError = error;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (aborted || !isTemporaryNetworkError(error) || attempt === attempts - 1) throw error;
      options.onProgress?.({ percent: 0, etaSeconds: null });
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
    }
  }

  throw lastError;
}
