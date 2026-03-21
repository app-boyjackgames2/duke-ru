import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useNotifications() {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else if ("Notification" in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for new messages
    const msgChannel = supabase
      .channel("notif-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          // Check if user is a member of this conversation
          const { data: membership } = await supabase
            .from("conversation_members")
            .select("id")
            .eq("conversation_id", msg.conversation_id)
            .eq("user_id", user.id)
            .single();

          if (!membership) return;

          const { data: sender } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", msg.sender_id)
            .single();

          const senderName = sender?.username || "Новое сообщение";
          const body = msg.type === "voice" ? "🎤 Голосовое сообщение" :
                       msg.type === "image" ? "📷 Фото" :
                       msg.type === "file" ? "📎 Файл" :
                       msg.content || "";

          // Toast notification (always)
          toast(senderName, { description: body });

          // Browser notification (if tab not focused)
          if (document.hidden && permissionRef.current === "granted") {
            new Notification(`DUKE — ${senderName}`, { body, icon: "/favicon.ico" });
          }
        }
      )
      .subscribe();

    // Listen for new channel posts
    const postChannel = supabase
      .channel("notif-channel-posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "channel_posts" },
        async (payload) => {
          const post = payload.new as any;
          if (post.author_id === user.id) return;

          const { data: membership } = await supabase
            .from("channel_members")
            .select("id")
            .eq("channel_id", post.channel_id)
            .eq("user_id", user.id)
            .single();

          if (!membership) return;

          const { data: ch } = await supabase
            .from("channels")
            .select("name")
            .eq("id", post.channel_id)
            .single();

          const channelName = ch?.name || "Канал";

          toast(`📢 ${channelName}`, { description: post.content?.slice(0, 100) });

          if (document.hidden && permissionRef.current === "granted") {
            new Notification(`DUKE — ${channelName}`, {
              body: post.content?.slice(0, 100),
              icon: "/favicon.ico",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(postChannel);
    };
  }, [user]);
}
