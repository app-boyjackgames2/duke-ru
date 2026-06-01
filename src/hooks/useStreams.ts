import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StreamRow {
  id: string;
  channel_id: string;
  created_by: string;
  title: string;
  description: string | null;
  mode: "video" | "bar";
  access_type: string;
  starts_at: string;
  ends_at: string | null;
  actual_started_at: string | null;
  actual_ended_at: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  loop_video: boolean;
  auto_start: boolean;
  auto_end: boolean;
  current_index: number;
  current_started_at: string | null;
  is_broadcast?: boolean;
  disable_ads?: boolean;
  age_rating?: string | null;
  logo_url?: string | null;
  // access_token intentionally omitted from client type — validated server-side via checkStreamLinkAccess.
}

export interface StreamVideoRow {
  id: string;
  stream_id: string;
  position: number;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  duration_seconds: number;
}

export function useChannelStreams(channelId: string | null) {
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!channelId) { setStreams([]); setLoading(false); return; }
    const { data } = await supabase
      .from("streams")
      .select("*")
      .eq("channel_id", channelId)
      .order("starts_at", { ascending: false });
    setStreams((data as StreamRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    if (!channelId) return;
    const ch = supabase
      .channel(`streams-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "streams", filter: `channel_id=eq.${channelId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return { streams, loading, reload: load };
}

// Explicit column list — never select `access_token` to keep it server-side only.
const STREAM_COLUMNS =
  "id, channel_id, created_by, title, description, mode, access_type, starts_at, ends_at, actual_started_at, actual_ended_at, status, loop_video, auto_start, auto_end, current_index, current_started_at, is_broadcast, disable_ads, age_rating, logo_url";

export function useStream(streamId: string | null) {
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [videos, setVideos] = useState<StreamVideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamId) { setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      const { data: s } = await supabase.from("streams").select(STREAM_COLUMNS).eq("id", streamId).maybeSingle();
      const { data: v } = await supabase.from("stream_videos").select("*").eq("stream_id", streamId).order("position");
      if (!mounted) return;
      setStream((s as StreamRow) || null);
      setVideos((v as StreamVideoRow[]) || []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`stream-${streamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "streams", filter: `id=eq.${streamId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_videos", filter: `stream_id=eq.${streamId}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [streamId]);

  return { stream, videos, loading };
}

/** Server-side validation of link-protected stream access. Returns true if the token matches in the DB. */
export async function checkStreamLinkAccess(streamId: string, token: string): Promise<boolean> {
  if (!token) return false;
  const { data } = await supabase
    .from("streams")
    .select("id")
    .eq("id", streamId)
    .eq("access_token", token)
    .maybeSingle();
  return !!data;
}

