import { supabase } from "@/integrations/supabase/client";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/chat-attachments";

export type UploadProgress = { percent: number; etaSeconds: number | null };

export type UploadOptions = {
  path: string;
  file: Blob;
  contentType?: string;
  timeoutMs?: number;
  onProgress?: (progress: UploadProgress) => void;
  onXhr?: (xhr: XMLHttpRequest | null) => void;
};

export async function uploadAttachment({ path, file, contentType, timeoutMs = 120000, onProgress, onXhr }: UploadOptions) {
  const { data, error } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error || new Error("Не удалось подготовить загрузку");

  const startedAt = Date.now();
  return new Promise<string>((resolve, reject) => {
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
  });
}