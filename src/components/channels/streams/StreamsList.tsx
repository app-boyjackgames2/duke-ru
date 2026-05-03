import { useChannelStreams, StreamRow } from "@/hooks/useStreams";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Radio, Video, Mic, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import CreateStreamDialog from "./CreateStreamDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  channelId: string;
  channelName: string;
  canModerate: boolean;
}

function StatusBadge({ s }: { s: StreamRow }) {
  if (s.status === "live") return <Badge className="bg-red-500/90 hover:bg-red-500 text-white animate-pulse">● LIVE</Badge>;
  if (s.status === "scheduled") return <Badge variant="outline">Запланирован</Badge>;
  if (s.status === "ended") return <Badge variant="secondary">Завершён</Badge>;
  return <Badge variant="secondary">Отменён</Badge>;
}

export default function StreamsList({ channelId, channelName, canModerate }: Props) {
  const { streams, loading, reload } = useChannelStreams(channelId);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("streams").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Удалено"); reload(); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Трансляции</h3>
        </div>
        {canModerate && (
          <Button size="sm" className="duke-gradient" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Создать
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : streams.length === 0 ? (
          <div className="text-center py-12">
            <Radio className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Нет трансляций</p>
          </div>
        ) : (
          streams.map((s) => (
            <div
              key={s.id}
              className="bg-card rounded-lg border border-border p-3 hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/channel/${channelName}/stream/${s.id}`)}
            >
              <div className="flex items-center gap-2 mb-1">
                {s.mode === "video" ? <Video className="w-4 h-4 text-muted-foreground" /> : <Mic className="w-4 h-4 text-muted-foreground" />}
                <h4 className="text-sm font-medium flex-1 truncate">{s.title}</h4>
                <StatusBadge s={s} />
              </div>
              {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>Старт: {format(new Date(s.starts_at), "d MMM HH:mm", { locale: ru })}</span>
                {canModerate && s.status !== "live" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    className="text-destructive/70 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CreateStreamDialog open={showCreate} onOpenChange={setShowCreate} channelId={channelId} onCreated={reload} />
    </div>
  );
}
