import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ViewerRow {
  user_id: string;
  last_seen_at: string;
  username?: string;
  avatar_url?: string | null;
}

export function useStreamViewers(streamId: string | null, isLive: boolean) {
  const { user } = useAuth();
  const [viewers, setViewers] = useState<ViewerRow[]>([]);

  // Heartbeat: insert/update presence every 20s while live
  useEffect(() => {
    if (!user || !streamId || !isLive) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      const nowIso = new Date().toISOString();
      // Try update first
      const { data: existing } = await supabase
        .from("stream_viewers")
        .select("id")
        .eq("stream_id", streamId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from("stream_viewers").update({ last_seen_at: nowIso }).eq("id", existing.id);
      } else {
        await supabase.from("stream_viewers").insert({ stream_id: streamId, user_id: user.id, last_seen_at: nowIso });
      }
    };

    beat();
    const t = setInterval(beat, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, streamId, isLive]);

  // Load + refresh viewers list
  useEffect(() => {
    if (!streamId) { setViewers([]); return; }

    const load = async () => {
      const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
      const { data } = await supabase
        .from("stream_viewers")
        .select("user_id, last_seen_at")
        .eq("stream_id", streamId)
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false });

      const ids = Array.from(new Set((data || []).map((r) => r.user_id)));
      let profiles: any[] = [];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
        profiles = profs || [];
      }
      const map = new Map(profiles.map((p) => [p.user_id, p]));
      setViewers((data || []).map((r) => ({ ...r, username: map.get(r.user_id)?.username, avatar_url: map.get(r.user_id)?.avatar_url ?? null })));
    };

    load();
    const t = setInterval(load, 15000);
    const ch = supabase
      .channel(`stream-viewers-${streamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_viewers", filter: `stream_id=eq.${streamId}` }, load)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [streamId]);

  return { viewers };
}
