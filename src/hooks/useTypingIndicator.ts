import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: string[] = [];
        for (const [key, presences] of Object.entries(state)) {
          if (key !== user.id) {
            const p = presences[0] as any;
            if (p?.typing) users.push(p.username || "...");
          }
        }
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false, username: profile?.username || "" });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, user, profile?.username]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !profile) return;
      channelRef.current.track({ typing: isTyping, username: profile.username });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isTyping) {
        timeoutRef.current = setTimeout(() => {
          channelRef.current?.track({ typing: false, username: profile.username });
        }, 2000);
      }
    },
    [profile]
  );

  return { typingUsers, setTyping };
}
