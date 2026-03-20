import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChannelWithDetails {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface ChannelPost {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author?: {
    username: string;
    avatar_url: string | null;
  };
}

export function useChannels() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChannelWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("channel_members")
      .select("channel_id")
      .eq("user_id", user.id);

    if (!memberships?.length) { setChannels([]); setLoading(false); return; }

    const ids = memberships.map((m) => m.channel_id);
    const { data } = await supabase
      .from("channels")
      .select("*")
      .in("id", ids)
      .order("updated_at", { ascending: false });

    if (!data) { setChannels([]); setLoading(false); return; }

    const enriched = await Promise.all(
      data.map(async (ch) => {
        const { count } = await supabase
          .from("channel_members")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", ch.id);
        return { ...ch, member_count: count || 0 } as ChannelWithDetails;
      })
    );

    setChannels(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const createChannel = async (name: string, description: string, avatarUrl: string | null) => {
    if (!user) return null;

    const { data: ch } = await supabase
      .from("channels")
      .insert({ name, description, avatar_url: avatarUrl, created_by: user.id })
      .select()
      .single();

    if (!ch) return null;

    await supabase.from("channel_members").insert({
      channel_id: ch.id,
      user_id: user.id,
      role: "admin",
    });

    fetchChannels();
    return ch.id;
  };

  return { channels, loading, fetchChannels, createChannel };
}

export function useChannelPosts(channelId: string | null) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!channelId) { setPosts([]); setLoading(false); return; }

    const { data } = await supabase
      .from("channel_posts")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false });

    if (!data) { setPosts([]); setLoading(false); return; }

    const enriched = await Promise.all(
      data.map(async (post) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", post.author_id)
          .single();
        return { ...post, author: profile || undefined } as ChannelPost;
      })
    );

    setPosts(enriched);
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchPosts();

    if (!channelId) return;

    const channel = supabase
      .channel(`channel-posts-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_posts", filter: `channel_id=eq.${channelId}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId, fetchPosts]);

  const createPost = async (content: string, imageUrl?: string) => {
    if (!user || !channelId) return;
    await supabase.from("channel_posts").insert({
      channel_id: channelId,
      author_id: user.id,
      content,
      image_url: imageUrl || null,
    });
  };

  return { posts, loading, createPost };
}
