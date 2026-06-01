import { supabase } from "@/integrations/supabase/client";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";

export function getChatAttachmentPath(value: string | null | undefined) {
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }

  try {
    const url = new URL(value);
    const marker = `/${CHAT_ATTACHMENTS_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export async function getSignedChatAttachmentUrl(value: string | null | undefined, expiresIn = 3600) {
  const path = getChatAttachmentPath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) return null;
  return data.signedUrl;
}
