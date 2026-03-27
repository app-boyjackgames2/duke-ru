import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Video, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface CallRecord {
  id: string;
  call_type: string;
  caller_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  caller_name?: string;
}

interface Props {
  conversationId: string;
  currentUserId: string;
}

export default function CallHistoryPanel({ conversationId, currentUserId }: Props) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("call_history")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("started_at", { ascending: false })
        .limit(20);

      if (!data) { setCalls([]); setLoading(false); return; }

      const enriched = await Promise.all(
        data.map(async (c) => {
          const { data: p } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", c.caller_id)
            .single();
          return { ...c, caller_name: p?.username || "Пользователь" } as CallRecord;
        })
      );
      setCalls(enriched);
      setLoading(false);
    };
    fetch();
  }, [conversationId]);

  const formatDuration = (s: number | null) => {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const getStatusInfo = (call: CallRecord) => {
    const isMine = call.caller_id === currentUserId;
    if (call.status === "completed" || call.status === "connected") {
      return { icon: isMine ? Phone : PhoneIncoming, label: "Принят", color: "text-duke-online" };
    }
    if (call.status === "missed") {
      return { icon: PhoneMissed, label: isMine ? "Нет ответа" : "Пропущен", color: "text-destructive" };
    }
    return { icon: PhoneOff, label: "Отклонён", color: "text-muted-foreground" };
  };

  if (loading) return null;
  if (calls.length === 0) return null;

  return (
    <div className="px-4 py-2 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">История звонков</p>
      {calls.map((call) => {
        const { icon: Icon, label, color } = getStatusInfo(call);
        const isVideo = call.call_type === "video";
        return (
          <div key={call.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0`}>
              {isVideo ? <Video className={`w-3.5 h-3.5 ${color}`} /> : <Icon className={`w-3.5 h-3.5 ${color}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${color}`}>{label}</span>
                <span className="text-xs text-muted-foreground">• {isVideo ? "Видео" : "Аудио"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(call.started_at), "d MMM, HH:mm", { locale: ru })}
              </p>
            </div>
            {(call.status === "completed" || call.status === "connected") && call.duration_seconds != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDuration(call.duration_seconds)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
