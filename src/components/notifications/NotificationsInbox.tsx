import { useStreamNotifications } from "@/hooks/useStreamNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TYPE_LABEL: Record<string, string> = {
  started: "🔴 Стрим начался",
  ended: "🏁 Стрим завершён",
  upcoming: "🕒 Скоро трансляция",
  next: "▶ Смотрите далее",
};

export default function NotificationsInbox() {
  const { items, unread, markRead, markAllRead, prefStreamAlerts, setStreamAlerts } = useStreamNotifications();
  const navigate = useNavigate();

  const open = async (streamId: string, id: string) => {
    if (!streamId) return;
    const { data: s } = await supabase.from("streams").select("channel_id").eq("id", streamId).maybeSingle();
    if (!s?.channel_id) return;
    const { data: ch } = await supabase.from("channels").select("name").eq("id", s.channel_id).maybeSingle();
    if (ch?.name) {
      markRead(id);
      navigate(`/channel/${ch.name}/stream/${streamId}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-semibold">Уведомления</h4>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Прочитать все
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Уведомлений нет</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n.stream_id, n.id)}
                className={`w-full text-left px-3 py-2 border-b border-border hover:bg-muted/50 flex items-start gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{TYPE_LABEL[n.type] || n.type}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.payload?.title || ""}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "d MMM HH:mm", { locale: ru })}</p>
                </div>
                {!n.read_at && (
                  <span
                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-3 border-t border-border flex items-center justify-between">
          <Label htmlFor="stream-alerts" className="text-xs">Уведомления о трансляциях</Label>
          <Switch id="stream-alerts" checked={prefStreamAlerts} onCheckedChange={setStreamAlerts} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
