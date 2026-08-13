import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MessageWithSender {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  reply_to: string | null;
  created_at: string;
  updated_at: string;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
  replied_message?: {
    content: string | null;
    sender_username: string;
  };
  reactions?: { emoji: string; user_id: string; id: string }[];
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const queuedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }

    if (loadingRef.current) { queuedRef.current = true; return; }
    loadingRef.current = true;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!data) { setMessages([]); setLoading(false); loadingRef.current = false; return; }

    const senderIds = Array.from(new Set(data.map((msg) => msg.sender_id)));
    const replyIds = Array.from(new Set(data.map((msg) => msg.reply_to).filter((id): id is string => Boolean(id))));
    const messageIds = data.map((msg) => msg.id);
    const [{ data: profiles }, { data: replies }, { data: reactions }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", senderIds),
      replyIds.length ? supabase.from("messages").select("id, content, sender_id").in("id", replyIds) : Promise.resolve({ data: [] }),
      supabase.from("message_reactions").select("message_id, emoji, user_id, id").in("message_id", messageIds),
    ]);
    const replySenderIds = Array.from(new Set((replies || []).map((reply) => reply.sender_id)));
    const { data: replyProfiles } = replySenderIds.length
      ? await supabase.from("profiles").select("user_id, username").in("user_id", replySenderIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
    const replyMap = new Map((replies || []).map((reply) => [reply.id, reply]));
    const replyProfileMap = new Map((replyProfiles || []).map((profile) => [profile.user_id, profile.username]));

    const enriched = data.map((msg) => {
      const profile = profileMap.get(msg.sender_id);
      const reply = msg.reply_to ? replyMap.get(msg.reply_to) : undefined;
      return {
        ...msg,
        sender: profile ? { username: profile.username, avatar_url: profile.avatar_url } : undefined,
        replied_message: reply ? { content: reply.content, sender_username: replyProfileMap.get(reply.sender_id) || "Unknown" } : undefined,
        reactions: (reactions || []).filter((reaction) => reaction.message_id === msg.id),
      } as MessageWithSender;
    });

    setMessages(enriched);
    setLoading(false);
    loadingRef.current = false;
    if (queuedRef.current) { queuedRef.current = false; void fetchMessages(); }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(fetchMessages, 250);
    };
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        scheduleRefresh
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void fetchMessages();
    }, 45000);
    return () => { if (refreshTimer) clearTimeout(refreshTimer); clearInterval(fallback); supabase.removeChannel(channel); };
  }, [conversationId, fetchMessages]);

  const sendMessage = async (content: string, type = "text", replyTo?: string, fileUrl?: string, fileName?: string, fileSize?: number) => {
    if (!user || !conversationId) return;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type,
      reply_to: replyTo || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", user.id);
    if (error) {
      toast.error("Не удалось удалить сообщение");
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").update({ content: newContent }).eq("id", messageId).eq("sender_id", user.id);
    if (error) toast.error("Не удалось редактировать сообщение");
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = messages
      .find((m) => m.id === messageId)
      ?.reactions?.find((r) => r.emoji === emoji && r.user_id === user.id);

    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  };

  // Mark conversation as read
  const markAsRead = useCallback(async () => {
    if (!user || !conversationId) return;
    await supabase.from("conversation_last_read").upsert(
      { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" }
    );
  }, [user, conversationId]);

  return { messages, loading, sendMessage, deleteMessage, editMessage, toggleReaction, fetchMessages, markAsRead };
}
