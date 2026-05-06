import { Button } from "@/components/ui/button";
import { Play, Square, SkipForward, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StreamRow, StreamVideoRow } from "@/hooks/useStreams";

interface Props {
  stream: StreamRow;
  videos: StreamVideoRow[];
}

export default function StreamControlPanel({ stream, videos }: Props) {
  const isLive = stream.status === "live";
  const isScheduled = stream.status === "scheduled";

  const start = async () => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("streams").update({
      status: "live",
      actual_started_at: nowIso,
      current_index: 0,
      current_started_at: nowIso,
    }).eq("id", stream.id);
    if (error) toast.error(error.message); else toast.success("Стрим запущен");
  };

  const end = async () => {
    const { error } = await supabase.from("streams").update({
      status: "ended",
      actual_ended_at: new Date().toISOString(),
    }).eq("id", stream.id);
    if (error) toast.error(error.message); else toast.success("Стрим завершён");
  };

  const next = async () => {
    if (videos.length === 0) return;
    const idx = (stream.current_index ?? 0) + 1;
    if (idx >= videos.length) {
      if (stream.loop_video) {
        await supabase.from("streams").update({ current_index: 0, current_started_at: new Date().toISOString() }).eq("id", stream.id);
        toast.success("Цикл: с начала");
      } else {
        toast.message("Это последний ролик");
      }
      return;
    }
    const { error } = await supabase.from("streams").update({
      current_index: idx,
      current_started_at: new Date().toISOString(),
    }).eq("id", stream.id);
    if (error) toast.error(error.message); else toast.success("Следующий ролик");
  };

  return (
    <div className="bg-card/30 border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Управление</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {isScheduled && (
          <Button size="sm" onClick={start} className="duke-gradient">
            <Play className="w-3.5 h-3.5 mr-1" /> Старт
          </Button>
        )}
        {isLive && stream.mode === "video" && videos.length > 1 && (
          <Button size="sm" variant="outline" onClick={next}>
            <SkipForward className="w-3.5 h-3.5 mr-1" /> Следующий
          </Button>
        )}
        {isLive && (
          <Button size="sm" variant="destructive" onClick={end}>
            <Square className="w-3.5 h-3.5 mr-1" /> Завершить
          </Button>
        )}
      </div>
    </div>
  );
}
