import { useState, useRef } from "react";
import { ChannelWithDetails, useChannelPosts } from "@/hooks/useChannels";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Megaphone, Send, Loader2, UserPlus, Trash2, Pencil, Check, X, AlertTriangle, Paperclip, FileText, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import InviteToChannelDialog from "./InviteToChannelDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCreator = user?.id === channel.created_by;

  const handleDeleteChannel = async () => {
    setDeleting(true);
    // Delete posts, members, then channel
    await supabase.from("channel_posts").delete().eq("channel_id", channel.id);
    await supabase.from("channel_members").delete().eq("channel_id", channel.id);
    const { error } = await supabase.from("channels").delete().eq("id", channel.id);
    if (error) {
      toast.error("Не удалось удалить канал: " + error.message);
      setDeleting(false);
    } else {
      toast.success("Канал удалён");
      onRefresh?.();
    }
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setSending(true);
    await createPost(newPost.trim());
    setNewPost("");
    setSending(false);
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("channel_posts").delete().eq("id", postId);
    if (error) toast.error("Не удалось удалить пост");
  };

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from("channel_posts")
      .update({ content: editContent.trim() })
      .eq("id", postId)
      .eq("author_id", user?.id || "");
    if (error) {
      toast.error("Не удалось обновить пост");
    } else {
      toast.success("Пост обновлён");
      setEditingPostId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={channel.avatar_url || ""} />
            <AvatarFallback className="bg-secondary text-secondary-foreground"><Megaphone className="w-4 h-4" /></AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{channel.name}</h3>
            <p className="text-xs text-muted-foreground">{channel.member_count} участников</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4" />
          </Button>
          {isCreator && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить канал «{channel.name}»?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие нельзя отменить. Все посты и участники будут удалены.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteChannel} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Удалить"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Пока нет публикаций</p>
          </div>
        ) : (
          posts.map((post) => {
            const isEditing = editingPostId === post.id;
            const isAuthor = post.author_id === user?.id;
            const isEdited = post.updated_at !== post.created_at;

            return (
              <div key={post.id} className="bg-card rounded-xl p-4 border border-border group relative">
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.author?.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{post.author?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{post.author?.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(post.created_at), "d MMM, HH:mm", { locale: ru })}
                      {isEdited && " (ред.)"}
                    </p>
                  </div>
                  {isAuthor && !isEditing && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditingPostId(post.id); setEditContent(post.content); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePost(post.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="bg-muted border-0 resize-none text-sm min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="duke-gradient h-7 text-xs" onClick={() => handleEditPost(post.id)}>
                        <Check className="w-3 h-3 mr-1" /> Сохранить
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingPostId(null)}>
                        <X className="w-3 h-3 mr-1" /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
                )}

                {post.image_url && <img src={post.image_url} alt="" className="mt-3 rounded-lg max-w-md" />}
              </div>
            );
          })
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
          />
          <Button size="icon" className="h-10 w-10 duke-gradient flex-shrink-0" onClick={handlePost} disabled={!newPost.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <InviteToChannelDialog open={showInvite} onOpenChange={setShowInvite} channelId={channel.id} onInvited={onRefresh} />
    </div>
  );
}
