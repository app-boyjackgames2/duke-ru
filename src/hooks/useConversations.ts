import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ConversationWithDetails {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_message?: {
    content: string | null;
    created_at: string;
    sender_username: string;
    type: string;
  };
  other_user?: {
    username: string;
    avatar_url: string | null;
    is_online: boolean | null;
    user_id: string;
  };
  unread_count?: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberData?.length) { setConversations([]); setLoading(false); return; }

    const conversationIds = memberData.map((m) => m.conversation_id);

    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (!convos) { setConversations([]); setLoading(false); return; }

    const enriched: ConversationWithDetails[] = await Promise.all(
      convos.map(async (conv) => {
        // Get last message
        const { data: msgs } = await supabase
          .from("messages")
          .select("content, created_at, sender_id, type")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let last_message: ConversationWithDetails["last_message"];
        if (msgs?.[0]) {
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", msgs[0].sender_id)
            .single();
          last_message = {
            content: msgs[0].content,
            created_at: msgs[0].created_at,
            sender_username: senderProfile?.username || "Unknown",
            type: msgs[0].type,
          };
        }

        // For direct convos, get the other user
        let other_user: ConversationWithDetails["other_user"];
        if (conv.type === "direct") {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id)
            .limit(1);
          if (members?.[0]) {
            const { data: otherProfile } = await supabase
              .from("profiles")
              .select("username, avatar_url, is_online, user_id")
              .eq("user_id", members[0].user_id)
              .single();
            if (otherProfile) other_user = otherProfile;
          }
        }

        return { ...conv, last_message, other_user };
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages to refresh list
    const channel = supabase
      .channel("conversations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  const createDirectConversation = async (otherUserId: string) => {
    if (!user) return null;

    // Check if direct conversation already exists
    const { data: myMemberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myMemberships) {
      for (const m of myMemberships) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", m.conversation_id)
          .eq("type", "direct")
          .single();
        if (conv) {
          const { data: otherMember } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .eq("user_id", otherUserId)
            .single();
          if (otherMember) return conv.id;
        }
      }
    }

    // Create new
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ type: "direct", created_by: user.id })
      .select()
      .single();

    if (!newConv) return null;

    await supabase.from("conversation_members").insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: otherUserId },
    ]);

    fetchConversations();
    return newConv.id;
  };

  const createGroupConversation = async (name: string, avatarUrl: string | null, memberIds: string[]) => {
    if (!user) return null;

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ type: "group", name, avatar_url: avatarUrl, created_by: user.id })
      .select()
      .single();

    if (!newConv) return null;

    const members = [user.id, ...memberIds].map((uid) => ({
      conversation_id: newConv.id,
      user_id: uid,
    }));

    await supabase.from("conversation_members").insert(members);
    fetchConversations();
    return newConv.id;
  };

  return { conversations, loading, fetchConversations, createDirectConversation, createGroupConversation };
}
