import { useEffect, useRef, useState } from "react";
import { useStreamChat } from "@/hooks/useStreamChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Props {
  streamId: string;
  canModerate: boolean;
}

export default function StreamChat({ streamId, canModerate }: Props) {
  const { user } = useAuth();
  const { messages, loading, send, softDelete } = useStreamChat(streamId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await send(text);
    setSending(false);
    if (r.error === "rate") toast.error("Слишком быстро");
    else if (r.error) toast.error(String(r.error));
    else setText("");
  };

  return (
    <div className="flex flex-col h-full bg-card/30 border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Чат зрителей</h3>
        <span className="text-xs text-muted-foreground ml-auto">{messages.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Загрузка…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Пока нет сообщений</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="group flex items-start gap-2 hover:bg-muted/30 rounded p-1">
              <Avatar className="w-6 h-6 mt-0.5 shrink-0">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{(m.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium truncate">{m.username || "Пользователь"}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "HH:mm")}</span>
                </div>
                <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
              </div>
              {(canModerate || m.user_id === user?.id) && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive"
                  onClick={() => softDelete(m.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-border flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Сообщение..."
          className="flex-1"
          disabled={sending}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()} className="duke-gradient">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
