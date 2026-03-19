import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!data) { setMessages([]); setLoading(false); return; }

    const enriched = await Promise.all(
      data.map(async (msg) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", msg.sender_id)
          .single();

        let replied_message: MessageWithSender["replied_message"];
        if (msg.reply_to) {
          const { data: replyMsg } = await supabase
            .from("messages")
            .select("content, sender_id")
            .eq("id", msg.reply_to)
            .single();
          if (replyMsg) {
            const { data: replySender } = await supabase
              .from("profiles")
              .select("username")
              .eq("user_id", replyMsg.sender_id)
              .single();
            replied_message = {
              content: replyMsg.content,
              sender_username: replySender?.username || "Unknown",
            };
          }
        }

        const { data: reactions } = await supabase
          .from("message_reactions")
          .select("emoji, user_id, id")
          .eq("message_id", msg.id);

        return {
          ...msg,
          sender: profile ? { username: profile.username, avatar_url: profile.avatar_url } : undefined,
          replied_message,
          reactions: reactions || [],
        } as MessageWithSender;
      })
    );

    setMessages(enriched);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => fetchMessages()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  return { messages, loading, sendMessage, toggleReaction, fetchMessages };
}
