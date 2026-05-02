import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MessageWithSender } from "./useMessages";

export interface PinnedMessage {
  id: string;
  message_id: string;
  pinned_at: string;
  pinned_by: string;
  pinned_by_profile?: { username: string; avatar_url: string | null };
  message?: MessageWithSender;
}

export interface PinAuditEntry {
  id: string;
  message_id: string;
  actor_id: string;
  action: "pin" | "unpin";
  created_at: string;
  actor_profile?: { username: string; avatar_url: string | null };
  message_preview?: string;
}

export function usePinnedMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  const [audit, setAudit] = useState<PinAuditEntry[]>([]);
  const [myRole, setMyRole] = useState<string>("member");
  const [convType, setConvType] = useState<string>("direct");

  const fetchPinned = useCallback(async () => {
    if (!conversationId) { setPinned([]); return; }
    const { data: pins } = await supabase
      .from("pinned_messages")
      .select("id, message_id, pinned_at, pinned_by")
      .eq("conversation_id", conversationId)
      .order("pinned_at", { ascending: false });

    if (!pins || pins.length === 0) { setPinned([]); return; }

    const enriched: PinnedMessage[] = await Promise.all(
      pins.map(async (p) => {
        const { data: msg } = await supabase
          .from("messages")
          .select("*")
          .eq("id", p.message_id)
          .maybeSingle();
        let sender;
        if (msg) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("user_id", msg.sender_id)
            .single();
          sender = profile ? { username: profile.username, avatar_url: profile.avatar_url } : undefined;
        }
        const { data: pinnerProfile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", p.pinned_by)
          .maybeSingle();
        return {
          ...p,
          pinned_by_profile: pinnerProfile ? { username: pinnerProfile.username, avatar_url: pinnerProfile.avatar_url } : undefined,
          message: msg ? ({ ...msg, sender } as MessageWithSender) : undefined,
        };
      })
    );
    setPinned(enriched);
  }, [conversationId]);

  const fetchAudit = useCallback(async () => {
    if (!conversationId) { setAudit([]); return; }
    const { data: entries } = await supabase
      .from("pin_audit_log")
      .select("id, message_id, actor_id, action, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!entries || entries.length === 0) { setAudit([]); return; }
    const actorIds = [...new Set(entries.map((e) => e.actor_id))];
    const msgIds = [...new Set(entries.map((e) => e.message_id))];
    const [{ data: profiles }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", actorIds),
      supabase.from("messages").select("id, content, type").in("id", msgIds),
    ]);
    const pmap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const mmap = new Map((msgs || []).map((m) => [m.id, m]));
    setAudit(
      entries.map((e) => {
        const prof = pmap.get(e.actor_id);
        const msg = mmap.get(e.message_id);
        const preview = msg
          ? msg.content || (msg.type === "image" ? "📷 Фото" : msg.type === "voice" ? "🎙 Голосовое" : "📎 Файл")
          : "(сообщение удалено)";
        return {
          ...e,
          action: e.action as "pin" | "unpin",
          actor_profile: prof ? { username: prof.username, avatar_url: prof.avatar_url } : undefined,
          message_preview: preview,
        };
      })
    );
  }, [conversationId]);

  // Fetch role + conv type
  useEffect(() => {
    if (!conversationId || !user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("type")
        .eq("id", conversationId)
        .single();
      if (conv) setConvType(conv.type);
      const { data: mem } = await supabase
        .from("conversation_members")
        .select("role")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mem) setMyRole(mem.role || "member");
    })();
  }, [conversationId, user]);

  useEffect(() => {
    fetchPinned();
    fetchAudit();
    if (!conversationId) return;
    const ch = supabase
      .channel(`pins-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_messages", filter: `conversation_id=eq.${conversationId}` },
        () => { fetchPinned(); fetchAudit(); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pin_audit_log", filter: `conversation_id=eq.${conversationId}` },
        () => fetchAudit()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, fetchPinned, fetchAudit]);

  const canPin = convType === "direct" || myRole === "admin";

  const pinMessage = async (messageId: string) => {
    if (!user || !conversationId) return;
    const { error } = await supabase
      .from("pinned_messages")
      .insert({ conversation_id: conversationId, message_id: messageId, pinned_by: user.id });
    if (error) {
      if (error.code === "23505") toast.error("Сообщение уже закреплено");
      else toast.error("Не удалось закрепить");
    } else {
      toast.success("Сообщение закреплено");
    }
  };

  const unpinMessage = async (messageId: string) => {
    if (!user || !conversationId) return;
    const { error } = await supabase
      .from("pinned_messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("message_id", messageId);
    if (error) toast.error("Не удалось открепить");
    else toast.success("Откреплено");
  };

  const isPinned = (messageId: string) => pinned.some((p) => p.message_id === messageId);

  return { pinned, audit, canPin, pinMessage, unpinMessage, isPinned, myRole, convType };
}
