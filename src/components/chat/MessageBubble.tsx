import { MessageWithSender } from "@/hooks/useMessages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reply, SmilePlus, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface Props {
  message: MessageWithSender;
  isMine: boolean;
  showAvatar: boolean;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  currentUserId: string;
}

export default function MessageBubble({ message, isMine, showAvatar, onReply, onReaction, currentUserId }: Props) {
  const [showEmojis, setShowEmojis] = useState(false);

  const groupedReactions = message.reactions?.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.user_id === currentUserId) acc[r.emoji].hasOwn = true;
    return acc;
  }, {} as Record<string, { count: number; hasOwn: boolean }>);

  const renderContent = () => {
    if (message.type === "image" && message.file_url) {
      return (
        <div>
          <img src={message.file_url} alt={message.file_name || "Image"} className="max-w-xs rounded-lg" />
          {message.content && <p className="mt-1 text-sm">{message.content}</p>}
        </div>
      );
    }
    if (message.type === "voice" && message.file_url) {
      return (
        <div className="flex items-center gap-2">
          <audio controls src={message.file_url} className="h-8 max-w-[220px]" />
        </div>
      );
    }
    if (message.type === "file" && message.file_url) {
      return (
        <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
          <FileText className="w-4 h-4" />
          <span className="truncate max-w-[200px]">{message.file_name || "File"}</span>
          <Download className="w-3 h-3 flex-shrink-0" />
        </a>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  };

  return (
    <div className={`flex gap-2 group ${isMine ? "flex-row-reverse" : ""} ${showAvatar ? "mt-3" : "mt-0.5"}`}>
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isMine && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.sender?.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
              {message.sender?.username?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Sender name */}
        {showAvatar && !isMine && (
          <p className="text-xs text-primary font-medium mb-1 px-1">{message.sender?.username}</p>
        )}

        {/* Reply preview */}
        {message.replied_message && (
          <div className={`text-xs px-3 py-1.5 mb-1 rounded-lg border-l-2 border-primary/50 ${isMine ? "bg-primary/5" : "bg-muted/50"}`}>
            <span className="text-primary font-medium">{message.replied_message.sender_username}</span>
            <p className="text-muted-foreground truncate">{message.replied_message.content}</p>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            className={`px-3 py-2 rounded-2xl ${
              isMine
                ? "bg-duke-sent text-primary-foreground rounded-tr-md"
                : "bg-duke-received text-foreground rounded-tl-md"
            }`}
          >
            {renderContent()}
            <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {format(new Date(message.created_at), "HH:mm")}
            </p>
          </div>

          {/* Actions (hover) */}
          <div className={`absolute top-0 ${isMine ? "-left-16" : "-right-16"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onReply}>
              <Reply className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowEmojis(!showEmojis)}>
              <SmilePlus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Emoji picker */}
          {showEmojis && (
            <div className={`absolute ${isMine ? "right-0" : "left-0"} -bottom-8 flex gap-0.5 bg-card border border-border rounded-full px-2 py-1 shadow-lg z-10`}>
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReaction(emoji); setShowEmojis(false); }}
                  className="hover:scale-125 transition-transform text-sm px-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions */}
        {groupedReactions && Object.keys(groupedReactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, { count, hasOwn }]) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                  hasOwn ? "border-primary/50 bg-primary/10" : "border-border bg-card"
                }`}
              >
                {emoji} {count > 1 && count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
