import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { MessageWithSender } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Forward, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageWithSender | null;
  conversations: ConversationWithDetails[];
}

export default function ForwardMessageDialog({ open, onOpenChange, message, conversations }: Props) {
  const { user } = useAuth();
  const [sending, setSending] = useState<string | null>(null);

  const handleForward = async (convId: string) => {
    if (!user || !message) return;
    setSending(convId);

    const forwardedContent = `↪️ Переслано от ${message.sender?.username || "Неизвестный"}:\n${message.content || ""}`;

    const { error } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      content: forwardedContent,
      type: message.type === "text" ? "text" : message.type,
      file_url: message.file_url,
      file_name: message.file_name,
      file_size: message.file_size,
    });

    if (error) {
      toast.error("Ошибка пересылки");
    } else {
      toast.success("Сообщение переслано");
      onOpenChange(false);
    }
    setSending(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Forward className="w-5 h-5 text-primary" />
            Переслать сообщение
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-64">
          <div className="space-y-1">
            {conversations.map((conv) => {
              const name = conv.type === "direct" ? conv.other_user?.username || "Пользователь" : conv.name || "Группа";
              return (
                <button
                  key={conv.id}
                  onClick={() => handleForward(conv.id)}
                  disabled={sending !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={conv.type === "direct" ? conv.other_user?.avatar_url || "" : conv.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                      {name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground flex-1">{name}</span>
                  {sending === conv.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
