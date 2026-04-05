import { useState } from "react";
import { Search, Plus, LogOut, Settings, Users, Phone, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { ConversationWithDetails, useConversations } from "@/hooks/useConversations";
import { toast } from "sonner";
import { ChannelWithDetails } from "@/hooks/useChannels";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import NewChatDialog from "./NewChatDialog";
import CreateGroupDialog from "./CreateGroupDialog";
import ChannelList from "../channels/ChannelList";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/i18n/translations";
import dukeIcon from "@/assets/duke-icon.jpeg";

interface Props {
  conversations: ConversationWithDetails[];
  channels: ChannelWithDetails[];
  activeId: string | null;
  activeType: "chat" | "channel";
  onSelectChat: (id: string) => void;
  onSelectChannel: (id: string) => void;
  onRefreshChannels?: () => void;
  onRefreshConversations?: () => void;
  activeCallConversationId?: string | null;
}

export default function ChatSidebar({ conversations, channels, activeId, activeType, onSelectChat, onSelectChannel, onRefreshChannels, onRefreshConversations, activeCallConversationId }: Props) {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { leaveConversation } = useConversations();
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const handleDeleteChat = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    await leaveConversation(convId);
    toast.success(t("chat_deleted", lang));
    onRefreshConversations?.();
  };

  const filtered = conversations.filter((c) => {
    const name = c.type === "direct" ? c.other_user?.username : c.name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-80 h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={dukeIcon} alt="DUKE" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-foreground tracking-tight">DUKE</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowNewChat(true)}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowNewGroup(true)}>
            <Users className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/settings")}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("search", lang)} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-0 h-9 text-sm" />
        </div>
      </div>

      {/* Channels */}
      <ChannelList channels={channels} activeId={activeType === "channel" ? activeId : null} onSelect={onSelectChannel} onRefresh={onRefreshChannels} searchQuery={search} />

      <Separator className="mx-3" />

      {/* Conversations */}
      <div className="flex items-center px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💬 {t("chats", lang)}</span>
      </div>
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="px-2 pb-2">
          {filtered.map((conv) => {
            const name = conv.type === "direct" ? conv.other_user?.username || t("user", lang) : conv.name || t("group", lang);
            const isActive = activeType === "chat" && conv.id === activeId;
            const isOnline = conv.type === "direct" && conv.other_user?.is_online;
            const unread = conv.unread_count || 0;
            const isInCall = activeCallConversationId === conv.id;

            return (
              <div key={conv.id} className="relative group">
                <button
                  onClick={() => onSelectChat(conv.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg mb-0.5 transition-colors text-left ${isActive ? "bg-primary/10 border border-primary/20 duke-glow-sm" : "hover:bg-muted"}`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conv.type === "direct" ? conv.other_user?.avatar_url || "" : conv.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">{name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-duke-online rounded-full border-2 border-card" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>{name}</span>
                      {isInCall && (
                        <span className="flex items-center gap-1 ml-1 flex-shrink-0">
                          <Phone className="w-3 h-3 text-duke-online animate-pulse" />
                          <span className="text-[10px] text-duke-online font-medium">{t("in_call", lang)}</span>
                        </span>
                      )}
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false, locale: ru })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {conv.last_message.type === "image" ? `📷 ${t("photo", lang)}` : conv.last_message.type === "file" ? `📎 ${t("file", lang)}` : conv.last_message.type === "voice" ? `🎤 ${t("voice", lang)}` : conv.last_message.content}
                        </p>
                      )}
                      {unread > 0 && !isActive && (
                        <Badge className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px] font-bold duke-gradient border-0 text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteChat(e, conv.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title={t("delete_chat", lang)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              {search ? t("nothing_found", lang) : t("no_chats", lang)}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Current user */}
      <div className="p-3 border-t border-border flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">{profile?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{profile?.username || t("loading", lang)}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.status_text || t("online", lang)}</p>
        </div>
      </div>

      <NewChatDialog open={showNewChat} onOpenChange={setShowNewChat} />
      <CreateGroupDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        onCreated={(id) => { onRefreshConversations?.(); onSelectChat(id); }}
      />
    </div>
  );
}
