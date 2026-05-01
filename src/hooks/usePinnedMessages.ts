import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MessageWithSender } from "./useMessages";

export interface PinnedMessage {
  id: string;
  message_id: string;
  pinned_at: string;
  message?: MessageWithSender;
}

export function usePinnedMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  const [myRole, setMyRole] = useState<string>("member");
  const [convType, setConvType] = useState<string>("direct");

  const fetchPinned = useCallback(async () => {
    if (!conversationId) { setPinned([]); return; }
    const { data: pins } = await supabase
      .from("pinned_messages")
      .select("id, message_id, pinned_at")
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
        return { ...p, message: msg ? ({ ...msg, sender } as MessageWithSender) : undefined };
      })
    );
    setPinned(enriched);
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
    if (!conversationId) return;
    const ch = supabase
      .channel(`pins-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_messages", filter: `conversation_id=eq.${conversationId}` },
        () => fetchPinned()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, fetchPinned]);

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

  return { pinned, canPin, pinMessage, unpinMessage, isPinned, myRole, convType };
}
