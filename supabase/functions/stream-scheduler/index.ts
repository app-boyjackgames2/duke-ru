import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Stream {
  id: string;
  channel_id: string;
  mode: "video" | "bar";
  starts_at: string;
  ends_at: string | null;
  actual_started_at: string | null;
  status: string;
  loop_video: boolean;
  auto_start: boolean;
  auto_end: boolean;
  current_index: number;
  current_started_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const nowIso = now.toISOString();
  let started = 0, ended = 0, advanced = 0;

  // 1. Auto-start scheduled streams
  const { data: toStart } = await supabase
    .from("streams")
    .select("*")
    .eq("status", "scheduled")
    .eq("auto_start", true)
    .lte("starts_at", nowIso);

  for (const s of (toStart || []) as Stream[]) {
    await supabase.from("streams").update({
      status: "live",
      actual_started_at: nowIso,
      current_index: 0,
      current_started_at: nowIso,
    }).eq("id", s.id);
    started++;
  }

  // 2. Process live streams (advance video, end if needed)
  const { data: live } = await supabase
    .from("streams")
    .select("*")
    .eq("status", "live");

  for (const s of (live || []) as Stream[]) {
    // Custom end time
    if (s.auto_end && s.ends_at && new Date(s.ends_at) <= now) {
      await supabase.from("streams").update({
        status: "ended",
        actual_ended_at: nowIso,
      }).eq("id", s.id);
      ended++;
      continue;
    }

    if (s.mode !== "video") continue;

    // Advance video index based on cumulative duration
    const { data: vids } = await supabase
      .from("stream_videos")
      .select("id, position, duration_seconds")
      .eq("stream_id", s.id)
      .order("position");

    if (!vids || vids.length === 0) continue;

    const startedAt = s.current_started_at ? new Date(s.current_started_at).getTime() : now.getTime();
    const elapsed = (now.getTime() - startedAt) / 1000;
    const cur = vids[Math.min(s.current_index ?? 0, vids.length - 1)];
    const curDur = Number(cur?.duration_seconds || 0);

    if (curDur > 0 && elapsed >= curDur) {
      const nextIdx = (s.current_index ?? 0) + 1;
      if (nextIdx >= vids.length) {
        if (s.loop_video) {
          await supabase.from("streams").update({
            current_index: 0,
            current_started_at: nowIso,
          }).eq("id", s.id);
          advanced++;
        } else if (s.auto_end) {
          await supabase.from("streams").update({
            status: "ended",
            actual_ended_at: nowIso,
          }).eq("id", s.id);
          ended++;
        }
      } else {
        await supabase.from("streams").update({
          current_index: nextIdx,
          current_started_at: nowIso,
        }).eq("id", s.id);
        advanced++;
      }
    }
  }

  return new Response(JSON.stringify({ started, ended, advanced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
