import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, PinOff, Download, FileJson, FileText, MessageSquare, ClipboardList } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";
import type { PinnedMessage, PinAuditEntry } from "@/hooks/usePinnedMessages";
import { useConversations } from "@/hooks/useConversations";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pinned: PinnedMessage[];
  audit: PinAuditEntry[];
  canPin: boolean;
  convType: string;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onSelectConversation?: (conversationId: string) => void;
}

function previewOf(msg: PinnedMessage["message"]): string {
  if (!msg) return "(удалено)";
  return msg.content || (msg.type === "image" ? "📷 Фото" : msg.type === "voice" ? "🎙 Голосовое" : "📎 Файл");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PinnedListDialog({
  open,
  onOpenChange,
  pinned,
  audit,
  canPin,
  convType,
  onJump,
  onUnpin,
  onSelectConversation,
}: Props) {
  const { lang } = useLanguage();
  const { createDirectConversation } = useConversations();
  const locale = lang === "ru" ? ru : enUS;

  const exportCsv = () => {
    const header = ["pinned_at", "pinned_by", "message_id", "sender", "message_created_at", "type", "content", "file_url"];
    const rows = pinned.map((p) => [
      p.pinned_at,
      p.pinned_by_profile?.username || p.pinned_by,
      p.message_id,
      p.message?.sender?.username || "",
      p.message?.created_at || "",
      p.message?.type || "",
      (p.message?.content || "").replace(/"/g, '""'),
      p.message?.file_url || "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    download(`pinned-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("Экспорт CSV готов");
  };

  const exportJson = () => {
    download(`pinned-${Date.now()}.json`, JSON.stringify(pinned, null, 2), "application/json");
    toast.success("Экспорт JSON готов");
  };

  const handleAuthorClick = async (userId: string) => {
    const id = await createDirectConversation(userId);
    if (id && onSelectConversation) {
      onOpenChange(false);
      onSelectConversation(id);
    }
  };

  const canExport = canPin; // admin in group, or member in direct

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Pin className="w-5 h-5 text-primary" />
            Закреплённые сообщения
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pinned" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pinned"><MessageSquare className="w-4 h-4 mr-1.5" />Закреплённые ({pinned.length})</TabsTrigger>
            <TabsTrigger value="audit"><ClipboardList className="w-4 h-4 mr-1.5" />Аудит ({audit.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pinned" className="space-y-2">
            {canExport && pinned.length > 0 && (
              <div className="flex gap-2 pb-2 border-b border-border">
                <Button size="sm" variant="outline" onClick={exportCsv}><FileText className="w-4 h-4 mr-1" />CSV</Button>
                <Button size="sm" variant="outline" onClick={exportJson}><FileJson className="w-4 h-4 mr-1" />JSON</Button>
                <span className="text-xs text-muted-foreground self-center ml-auto">Экспорт: {convType === "group" ? "только админы" : "доступно"}</span>
              </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin space-y-2">
              {pinned.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Нет закреплённых сообщений</p>
              )}
              {pinned.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                  <button onClick={() => p.message?.sender_id && handleAuthorClick(p.message.sender_id)} title="Открыть чат с автором">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.message?.sender?.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {p.message?.sender?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <button className="flex-1 min-w-0 text-left" onClick={() => { onJump(p.message_id); onOpenChange(false); }}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">{p.message?.sender?.username || "?"}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.message?.created_at && format(new Date(p.message.created_at), "dd.MM.yyyy HH:mm", { locale })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 truncate">{previewOf(p.message)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      📌 {p.pinned_by_profile?.username || "?"} · {formatDistanceToNow(new Date(p.pinned_at), { addSuffix: true, locale })}
                    </p>
                  </button>
                  {canPin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onUnpin(p.message_id)} title="Открепить">
                      <PinOff className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin space-y-1">
              {audit.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Нет записей</p>
              )}
              {audit.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40">
                  <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${e.action === "pin" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                    {e.action === "pin" ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                  </div>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={e.actor_profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px]">
                      {e.actor_profile?.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{e.actor_profile?.username || "?"}</span>
                      {" "}
                      <span className="text-muted-foreground">{e.action === "pin" ? "закрепил(а)" : "открепил(а)"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">«{e.message_preview}»</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(e.created_at), "dd.MM.yyyy HH:mm:ss", { locale })}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
