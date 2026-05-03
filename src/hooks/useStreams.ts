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

export function useStream(streamId: string | null) {
  const [stream, setStream] = useState<StreamRow | null>(null);
  const [videos, setVideos] = useState<StreamVideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamId) { setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      const { data: s } = await supabase.from("streams").select("*").eq("id", streamId).maybeSingle();
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
