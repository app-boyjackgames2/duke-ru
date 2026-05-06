import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StreamChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  attachment_url: string | null;
  created_at: string;
  deleted_at: string | null;
  username?: string;
  avatar_url?: string | null;
}

const RATE_MS = 1000;

export function useStreamChat(streamId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSentAt, setLastSentAt] = useState(0);

  const enrich = async (rows: any[]): Promise<StreamChatMessage[]> => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length === 0) return rows;
    const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
    const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
    return rows.map((r) => ({ ...r, username: map.get(r.user_id)?.username, avatar_url: map.get(r.user_id)?.avatar_url ?? null }));
  };

  const load = useCallback(async () => {
    if (!streamId) { setMessages([]); setLoading(false); return; }
    const { data } = await supabase
      .from("stream_chat_messages")
      .select("*")
      .eq("stream_id", streamId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    const enriched = await enrich(data || []);
    setMessages(enriched);
    setLoading(false);
  }, [streamId]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!streamId) return;
    const ch = supabase
      .channel(`stream-chat-${streamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_chat_messages", filter: `stream_id=eq.${streamId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [streamId, load]);

  const send = useCallback(async (content: string, attachment_url?: string | null) => {
    if (!user || !streamId) return { error: "no-user" as const };
    const trimmed = content.trim();
    if (!trimmed && !attachment_url) return { error: "empty" as const };
    const now = Date.now();
    if (now - lastSentAt < RATE_MS) return { error: "rate" as const };
    setLastSentAt(now);
    const { error } = await supabase.from("stream_chat_messages").insert({
      stream_id: streamId,
      user_id: user.id,
      content: trimmed,
      attachment_url: attachment_url || null,
    });
    return { error: error?.message };
  }, [user, streamId, lastSentAt]);

  const softDelete = useCallback(async (id: string) => {
    await supabase.from("stream_chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  }, []);

  return { messages, loading, send, softDelete };
}
