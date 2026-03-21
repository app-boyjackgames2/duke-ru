import { useState } from "react";
import { Search, Plus, LogOut, Settings, MessageSquare, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { ChannelWithDetails } from "@/hooks/useChannels";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import NewChatDialog from "./NewChatDialog";
import CreateGroupDialog from "./CreateGroupDialog";
import ChannelList from "../channels/ChannelList";
import { useNavigate } from "react-router-dom";

interface Props {
  conversations: ConversationWithDetails[];
  channels: ChannelWithDetails[];
  activeId: string | null;
  activeType: "chat" | "channel";
  onSelectChat: (id: string) => void;
  onSelectChannel: (id: string) => void;
  onRefreshChannels?: () => void;
  onRefreshConversations?: () => void;
}

export default function ChatSidebar({ conversations, channels, activeId, activeType, onSelectChat, onSelectChannel, onRefreshChannels, onRefreshConversations }: Props) {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const navigate = useNavigate();

  const filtered = conversations.filter((c) => {
    const name = c.type === "direct" ? c.other_user?.username : c.name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-80 h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg duke-gradient flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
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
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-0 h-9 text-sm"
          />
        </div>
      </div>

      {/* Channels */}
      <ChannelList
        channels={channels}
        activeId={activeType === "channel" ? activeId : null}
        onSelect={onSelectChannel}
        onRefresh={onRefreshChannels}
      />

      <Separator className="mx-3" />

      {/* Conversations list */}
      <div className="flex items-center px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Чаты
        </span>
      </div>
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="px-2 pb-2">
          {filtered.map((conv) => {
            const name = conv.type === "direct" ? conv.other_user?.username || "Пользователь" : conv.name || "Группа";
            const isActive = activeType === "chat" && conv.id === activeId;
            const isOnline = conv.type === "direct" && conv.other_user?.is_online;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg mb-0.5 transition-colors text-left ${
                  isActive
                    ? "bg-primary/10 border border-primary/20 duke-glow-sm"
                    : "hover:bg-muted"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conv.type === "direct" ? conv.other_user?.avatar_url || "" : conv.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                      {name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-duke-online rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                      {name}
                    </span>
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false, locale: ru })}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message.type === "image" ? "📷 Фото" : conv.last_message.type === "file" ? "📎 Файл" : conv.last_message.type === "voice" ? "🎤 Голосовое" : conv.last_message.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              {search ? "Ничего не найдено" : "Нет чатов. Начните новый!"}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Current user */}
      <div className="p-3 border-t border-border flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {profile?.username?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{profile?.username || "Загрузка..."}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.status_text || "В сети"}</p>
        </div>
      </div>

      <NewChatDialog open={showNewChat} onOpenChange={setShowNewChat} />
      <CreateGroupDialog
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
        onCreated={(id) => {
          onRefreshConversations?.();
          onSelectChat(id);
        }}
      />
    </div>
  );
}
