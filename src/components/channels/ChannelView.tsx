import { useState } from "react";
import { ChannelWithDetails, useChannelPosts } from "@/hooks/useChannels";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, Loader2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import InviteToChannelDialog from "./InviteToChannelDialog";

interface Props {
  channel: ChannelWithDetails;
  onRefresh?: () => void;
}

export default function ChannelView({ channel, onRefresh }: Props) {
  const { user } = useAuth();
  const { posts, loading, createPost } = useChannelPosts(channel.id);
  const [newPost, setNewPost] = useState("");
  const [sending, setSending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setSending(true);
    await createPost(newPost.trim());
    setNewPost("");
    setSending(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={channel.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Megaphone className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{channel.name}</h3>
            <p className="text-xs text-muted-foreground">{channel.member_count} участников</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setShowInvite(true)}
        >
          <UserPlus className="w-4 h-4" />
        </Button>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Пока нет публикаций</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.author?.avatar_url || ""} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    {post.author?.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{post.author?.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(post.created_at), "d MMM, HH:mm", { locale: ru })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
              {post.image_url && (
                <img src={post.image_url} alt="" className="mt-3 rounded-lg max-w-md" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Post input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3">
        <div className="flex gap-2">
          <Textarea
            placeholder="Написать публикацию..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="bg-muted border-0 resize-none h-10 min-h-[40px] text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <Button
            size="icon"
            className="h-10 w-10 duke-gradient flex-shrink-0"
            onClick={handlePost}
            disabled={!newPost.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <InviteToChannelDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        channelId={channel.id}
        onInvited={onRefresh}
      />
    </div>
  );
}
