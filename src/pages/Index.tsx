import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useChannels } from "@/hooks/useChannels";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import ChannelView from "@/components/channels/ChannelView";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { conversations, loading: convsLoading } = useConversations();
  const { channels, loading: channelsLoading } = useChannels();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"chat" | "channel">("chat");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const activeConversation = activeType === "chat" ? conversations.find((c) => c.id === activeId) || null : null;
  const activeChannel = activeType === "channel" ? channels.find((c) => c.id === activeId) || null : null;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        channels={channels}
        activeId={activeId}
        activeType={activeType}
        onSelectChat={(id) => { setActiveId(id); setActiveType("chat"); }}
        onSelectChannel={(id) => { setActiveId(id); setActiveType("channel"); }}
      />
      {activeType === "channel" && activeChannel ? (
        <ChannelView channel={activeChannel} />
      ) : (
        <ChatArea conversation={activeConversation} />
      )}
    </div>
  );
}
