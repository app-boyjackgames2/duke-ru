import { useEffect, useRef, useState, useCallback } from "react";
import { MessageWithSender, useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import ForwardMessageDialog from "./ForwardMessageDialog";
import CallOverlay from "./CallOverlay";
import CallHistoryPanel from "./CallHistoryPanel";
import { ConversationWithDetails, useConversations } from "@/hooks/useConversations";
import { Phone, Video, MoreVertical, Search, X, History, Pin, ChevronUp, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/i18n/translations";
import { formatDistanceToNow } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import PinnedListDialog from "./PinnedListDialog";
import GroupMembersDialog from "./GroupMembersDialog";
import dukeIcon from "@/assets/duke-icon.jpeg";

interface Props {
  conversation: ConversationWithDetails | null;
  onCallStateChange?: (conversationId: string | null) => void;
  onSelectConversation?: (conversationId: string) => void;
}

export default function ChatArea({ conversation, onCallStateChange, onSelectConversation }: Props) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, deleteMessage, toggleReaction, markAsRead, editMessage } = useMessages(conversation?.id || null);
  const { conversations } = useConversations();
  const { typingUsers, setTyping } = useTypingIndicator(conversation?.id || null);
  const { lang } = useLanguage();
  const webrtc = useWebRTC(conversation?.id || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageWithSender | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [othersLastRead, setOthersLastRead] = useState<string | null>(null);
  const { pinned, audit, canPin, pinMessage, unpinMessage, isPinned, convType } = usePinnedMessages(conversation?.id || null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [pinnedListOpen, setPinnedListOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // Fetch other members' last_read_at
  const fetchReadReceipts = useCallback(async () => {
    if (!conversation?.id || !user) return;
    const { data } = await supabase
      .from("conversation_last_read")
      .select("last_read_at")
      .eq("conversation_id", conversation.id)
      .neq("user_id", user.id);
    if (data && data.length > 0) {
      // Use the latest read timestamp among other members
      const latest = data.reduce((max, r) => r.last_read_at > max ? r.last_read_at : max, data[0].last_read_at);
      setOthersLastRead(latest);
    } else {
      setOthersLastRead(null);
    }
  }, [conversation?.id, user]);

  useEffect(() => {
    fetchReadReceipts();
  }, [fetchReadReceipts, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (conversation?.id && messages.length > 0) markAsRead();
  }, [conversation?.id, messages.length, markAsRead]);

  // Notify parent about call state changes
  useEffect(() => {
    if (webrtc.callState === "connected" || webrtc.callState === "calling") {
      onCallStateChange?.(conversation?.id || null);
    } else if (webrtc.callState === "idle" || webrtc.callState === "ended") {
      onCallStateChange?.(null);
    }
  }, [webrtc.callState, conversation?.id, onCallStateChange]);

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <img src={dukeIcon} alt="DUKE" className="w-20 h-20 rounded-2xl duke-glow mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">DUKE Messenger</h2>
          <p className="text-muted-foreground text-sm">Выберите чат или начните новый</p>
        </div>
      </div>
    );
  }

  const chatName = conversation.type === "direct" ? conversation.other_user?.username || "Пользователь" : conversation.name || "Группа";
  const isOnline = conversation.type === "direct" && conversation.other_user?.is_online;

  const handleSend = async (content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number) => {
    await sendMessage(content, type, replyTo?.id, fileUrl, fileName, fileSize);
    setReplyTo(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full relative">
      {/* Call Overlay */}
      <CallOverlay
        callState={webrtc.callState}
        callType={webrtc.callType}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        incomingCall={webrtc.incomingCall}
        onAccept={webrtc.acceptCall}
        onReject={webrtc.rejectCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
        chatName={chatName}
      />

      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.type === "direct" ? conversation.other_user?.avatar_url || "" : conversation.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">{chatName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{chatName}</h3>
            <p className="text-xs text-muted-foreground">
              {conversation.type === "group" 
                ? t("group", lang) 
                : isOnline 
                  ? <span className="text-duke-online">{t("online", lang)}</span> 
                  : conversation.other_user?.last_seen 
                    ? `${t("last_seen", lang)} ${formatDistanceToNow(new Date(conversation.other_user.last_seen), { addSuffix: true, locale: lang === "ru" ? ru : enUS })}`
                    : t("offline", lang)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground relative" onClick={() => setPinnedListOpen(true)} title="Закреплённые">
            <Pin className="w-4 h-4" />
            {pinned.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] rounded-full min-w-[14px] h-[14px] px-1 flex items-center justify-center">{pinned.length}</span>
            )}
          </Button>
          {conversation.type === "group" && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setMembersOpen(true)} title="Участники">
              <Users className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}>
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-duke-online"
            onClick={() => webrtc.startCall("audio", conversation.type === "direct" ? conversation.other_user?.user_id : undefined)}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={() => webrtc.startCall("video", conversation.type === "direct" ? conversation.other_user?.user_id : undefined)}
          >
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowCallHistory(!showCallHistory)} title="История звонков">
            <History className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Pinned banner */}
      {pinned.length > 0 && pinned[pinnedIndex]?.message && (
        <div className="px-3 py-2 border-b border-border bg-card/40 flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary flex-shrink-0" />
          <button
            onClick={() => {
              const el = document.getElementById(`msg-${pinned[pinnedIndex].message_id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="flex-1 text-left min-w-0"
          >
            <p className="text-[11px] text-primary font-medium leading-tight">
              Закреплённое {pinned.length > 1 ? `(${pinnedIndex + 1}/${pinned.length})` : ""}
            </p>
            <p className="text-xs text-foreground truncate">
              {pinned[pinnedIndex].message?.content || (pinned[pinnedIndex].message?.type === "image" ? "📷 Фото" : pinned[pinnedIndex].message?.type === "voice" ? "🎙 Голосовое" : "📎 Файл")}
            </p>
          </button>
          {pinned.length > 1 && (
            <div className="flex flex-col">
              <Button variant="ghost" size="icon" className="h-4 w-6" onClick={() => setPinnedIndex((i) => (i - 1 + pinned.length) % pinned.length)}>
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-4 w-6" onClick={() => setPinnedIndex((i) => (i + 1) % pinned.length)}>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          )}
          {canPin && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => unpinMessage(pinned[pinnedIndex].message_id)} title="Открепить">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-card/30 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input placeholder="Поиск сообщений..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-muted border-0 h-8 text-sm" autoFocus />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{filteredMessages.length} найдено</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground flex-shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Call History */}
      {showCallHistory && conversation && (
        <div className="border-b border-border bg-card/30 max-h-52 overflow-y-auto scrollbar-thin">
          <CallHistoryPanel conversationId={conversation.id} currentUserId={user?.id || ""} />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
        {filteredMessages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const showAvatar = !isMine && (i === 0 || filteredMessages[i - 1]?.sender_id !== msg.sender_id);
          const isRead = isMine && !!othersLastRead && msg.created_at <= othersLastRead;
          const pinnedFlag = isPinned(msg.id);
          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
              <MessageBubble
                message={msg}
                isMine={isMine}
                showAvatar={showAvatar}
                onReply={() => setReplyTo(msg)}
                onReaction={(emoji) => toggleReaction(msg.id, emoji)}
                onDelete={deleteMessage}
                onForward={(m) => setForwardMsg(m)}
                onEdit={editMessage}
                currentUserId={user?.id || ""}
                isRead={isRead}
                isPinned={pinnedFlag}
                canPin={canPin}
                onTogglePin={(id) => (pinnedFlag ? unpinMessage(id) : pinMessage(id))}
              />
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="text-xs text-muted-foreground italic px-2 py-1">{typingUsers.join(", ")} печатает...</div>
        )}
      </div>

      <MessageInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} conversationId={conversation.id} onTyping={() => setTyping(true)} />

      <ForwardMessageDialog
        open={!!forwardMsg}
        onOpenChange={(v) => { if (!v) setForwardMsg(null); }}
        message={forwardMsg}
        conversations={conversations}
      />
    </div>
  );
}
