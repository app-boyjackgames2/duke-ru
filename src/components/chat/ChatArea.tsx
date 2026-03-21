import { useEffect, useRef, useState } from "react";
import { MessageWithSender, useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Phone, Video, MoreVertical, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

interface Props {
  conversation: ConversationWithDetails | null;
}

export default function ChatArea({ conversation }: Props) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, deleteMessage, toggleReaction, markAsRead } = useMessages(conversation?.id || null);
  const { typingUsers, setTyping } = useTypingIndicator(conversation?.id || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark as read when viewing conversation
  useEffect(() => {
    if (conversation?.id && messages.length > 0) {
      markAsRead();
    }
  }, [conversation?.id, messages.length, markAsRead]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl duke-gradient duke-glow mx-auto mb-4 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">DUKE Messenger</h2>
          <p className="text-muted-foreground text-sm">Выберите чат или начните новый</p>
        </div>
      </div>
    );
  }

  const chatName = conversation.type === "direct"
    ? conversation.other_user?.username || "Пользователь"
    : conversation.name || "Группа";

  const isOnline = conversation.type === "direct" && conversation.other_user?.is_online;

  const handleSend = async (content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number) => {
    await sendMessage(content, type, replyTo?.id, fileUrl, fileName, fileSize);
    setReplyTo(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.type === "direct" ? conversation.other_user?.avatar_url || "" : conversation.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
              {chatName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{chatName}</h3>
            <p className="text-xs text-muted-foreground">
              {conversation.type === "group" ? (
                "Группа"
              ) : isOnline ? (
                <span className="text-duke-online">В сети</span>
              ) : (
                "Не в сети"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const showAvatar = !isMine && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={isMine}
              showAvatar={showAvatar}
              onReply={() => setReplyTo(msg)}
              onReaction={(emoji) => toggleReaction(msg.id, emoji)}
              onDelete={deleteMessage}
              currentUserId={user?.id || ""}
            />
          );
        })}
        {typingUsers.length > 0 && (
          <div className="text-xs text-muted-foreground italic px-2 py-1">
            {typingUsers.join(", ")} печатает...
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        conversationId={conversation.id}
        onTyping={() => setTyping(true)}
      />
    </div>
  );
}
