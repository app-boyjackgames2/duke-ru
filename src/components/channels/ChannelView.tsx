import { useState, useRef, useEffect } from "react";
import { ChannelWithDetails, useChannelPosts } from "@/hooks/useChannels";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StreamsList from "./streams/StreamsList";
import { Megaphone, Send, Loader2, UserPlus, Trash2, Pencil, Check, X, Paperclip, FileText, Download, Users, Shield, ShieldAlert, Ban, UserMinus, Share2, Video as VideoIcon, Radio } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import InviteToChannelDialog from "./InviteToChannelDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/i18n/translations";

interface Props {
  channel: ChannelWithDetails;
  onRefresh?: () => void;
}

interface MemberInfo {
  id: string;
  user_id: string;
  role: string;
  username: string;
  avatar_url: string | null;
}

export default function ChannelView({ channel, onRefresh }: Props) {
  const { user } = useAuth();
  const { posts, loading, createPost } = useChannelPosts(channel.id);
  const [newPost, setNewPost] = useState("");
  const [sending, setSending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadEta, setUploadEta] = useState<string>("");
  const [uploadFailed, setUploadFailed] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLanguage();

  // Edit channel state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(channel.name);
  const [editDesc, setEditDesc] = useState(channel.description || "");
  const [editAccess, setEditAccess] = useState(channel.access_type || "open");
  const [saving, setSaving] = useState(false);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isCreator = user?.id === channel.created_by;
  const [isMod, setIsMod] = useState(false);
  const [myRole, setMyRole] = useState<string>("member");

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_channel_mod", { _user_id: user.id, _channel_id: channel.id })
      .then(({ data }) => setIsMod(!!data));
    supabase
      .from("channel_members")
      .select("role")
      .eq("channel_id", channel.id)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setMyRole(data.role); });
  }, [user, channel.id]);

  const canPost = isCreator || isMod || myRole === "moderator" || myRole === "admin";

  const loadMembers = async () => {
    setMembersLoading(true);
    const { data } = await supabase
      .from("channel_members")
      .select("id, user_id, role")
      .eq("channel_id", channel.id);
    if (data && data.length > 0) {
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      setMembers(
        data.map((m) => ({
          ...m,
          username: profileMap.get(m.user_id)?.username || "?",
          avatar_url: profileMap.get(m.user_id)?.avatar_url || null,
        }))
      );
    }
    setMembersLoading(false);
  };

  const handleToggleMod = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === "moderator" ? "member" : "moderator";
    const { error } = await supabase
      .from("channel_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else loadMembers();
  };

  const handleKick = async (memberId: string, username: string) => {
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success(`${username} ${t("user_kicked", lang)}`); loadMembers(); onRefresh?.(); }
  };

  const handleBan = async (memberUserId: string, username: string) => {
    const { error } = await supabase
      .from("channel_bans")
      .insert({ channel_id: channel.id, user_id: memberUserId, banned_by: user!.id });
    if (error) toast.error(error.message);
    else {
      await supabase.from("channel_members").delete().eq("channel_id", channel.id).eq("user_id", memberUserId);
      toast.success(`${username} ${t("user_banned", lang)}`);
      loadMembers();
      onRefresh?.();
    }
  };

  const handleDeleteChannel = async () => {
    setDeleting(true);
    await supabase.from("channel_posts").delete().eq("channel_id", channel.id);
    await supabase.from("channel_members").delete().eq("channel_id", channel.id);
    const { error } = await supabase.from("channels").delete().eq("id", channel.id);
    if (error) {
      toast.error(t("delete_channel_error", lang) + ": " + error.message);
      setDeleting(false);
    } else {
      toast.success(t("channel_deleted", lang));
      onRefresh?.();
    }
  };

  const handleEditChannel = async () => {
    if (!editName.trim()) return;
    setSaving(true);

    let avatarUrl = channel.avatar_url;
    if (editAvatarFile) {
      const ext = editAvatarFile.name.split(".").pop();
      const path = `channels/${channel.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, editAvatarFile, { upsert: true });
      if (uploadErr) { toast.error(t("upload_error", lang)); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    }

    const { error } = await supabase
      .from("channels")
      .update({ name: editName.trim(), description: editDesc.trim(), access_type: editAccess, avatar_url: avatarUrl })
      .eq("id", channel.id);
    if (error) toast.error(error.message);
    else { toast.success(t("channel_edited", lang)); setShowEdit(false); setEditAvatarFile(null); setEditAvatarPreview(null); onRefresh?.(); }
    setSaving(false);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/channel/${channel.name}`;
    navigator.clipboard.writeText(url);
    toast.success(t("link_copied", lang));
  };

  const resetUpload = () => {
    setUploading(false);
    setUploadProgress(0);
    setUploadEta("");
    xhrRef.current = null;
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      try { xhrRef.current.abort(); } catch {}
    }
    resetUpload();
    setUploadFailed(false);
    toast.info("Загрузка отменена");
  };

  const handlePost = async () => {
    if (!newPost.trim() && !attachedFile) return;
    setSending(true);
    setUploadFailed(false);

    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let imageUrl: string | undefined;

    if (attachedFile) {
      setUploading(true);
      setUploadProgress(0);
      setUploadEta("");
      const ext = attachedFile.name.split(".").pop();
      const path = `channels/${channel.id}/${Date.now()}.${ext}`;

      // Get a signed upload URL for progress tracking via XHR
      const { data: signed, error: signErr } = await supabase.storage
        .from("chat-attachments")
        .createSignedUploadUrl(path);

      if (signErr || !signed) {
        toast.error(t("file_upload_error", lang));
        setSending(false);
        setUploadFailed(true);
        resetUpload();
        return;
      }

      const startTime = Date.now();
      const result = await new Promise<"ok" | "error" | "abort">((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", signed.signedUrl, true);
        xhr.setRequestHeader("Content-Type", attachedFile.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
          const elapsed = (Date.now() - startTime) / 1000;
          if (e.loaded > 0 && elapsed > 0.5) {
            const speed = e.loaded / elapsed; // bytes/sec
            const remaining = (e.total - e.loaded) / speed;
            const mm = Math.floor(remaining / 60);
            const ss = Math.max(0, Math.round(remaining % 60));
            setUploadEta(mm > 0 ? `${mm}м ${ss}с` : `${ss}с`);
          }
        };
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? "ok" : "error");
        xhr.onerror = () => resolve("error");
        xhr.onabort = () => resolve("abort");
        xhr.send(attachedFile);
      });

      if (result !== "ok") {
        if (result === "error") {
          toast.error(t("file_upload_error", lang));
          setUploadFailed(true);
        }
        setSending(false);
        resetUpload();
        return;
      }

      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      if (attachedFile.type.startsWith("image/")) {
        imageUrl = urlData.publicUrl;
      } else {
        fileUrl = urlData.publicUrl;
        fileName = attachedFile.name;
      }
      resetUpload();
    }

    await createPost(newPost.trim() || (fileName || t("file", lang)), imageUrl, fileUrl, fileName);
    setNewPost("");
    setAttachedFile(null);
    setUploadFailed(false);
    setSending(false);
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("channel_posts").delete().eq("id", postId);
    if (error) toast.error(t("post_delete_error", lang));
  };

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from("channel_posts")
      .update({ content: editContent.trim() })
      .eq("id", postId)
      .eq("author_id", user?.id || "");
    if (error) {
      toast.error(t("post_update_error", lang));
    } else {
      toast.success(t("post_updated", lang));
      setEditingPostId(null);
    }
  };

  const canModerate = isCreator || isMod;

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
            <p className="text-xs text-muted-foreground">{channel.member_count} {t("members_count", lang)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setShowMembers(true); loadMembers(); }}>
            <Users className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
          </Button>
          {isCreator && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditName(channel.name); setEditDesc(channel.description || ""); setEditAccess(channel.access_type || "open"); setShowEdit(true); }}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {isCreator && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("delete_channel", lang)} «{channel.name}»?</AlertDialogTitle>
                  <AlertDialogDescription>{t("delete_channel_confirm", lang)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel", lang)}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteChannel} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete", lang)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="posts" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 self-start">
          <TabsTrigger value="posts"><Megaphone className="w-3.5 h-3.5 mr-1" />Посты</TabsTrigger>
          <TabsTrigger value="streams"><Radio className="w-3.5 h-3.5 mr-1" />Трансляции</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
      {/* Posts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t("no_posts", lang)}</p>
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
                      {isEdited && ` (${t("edited", lang)})`}
                    </p>
                  </div>
                  {(isAuthor || canModerate) && !isEditing && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAuthor && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditingPostId(post.id); setEditContent(post.content); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
                        <Check className="w-3 h-3 mr-1" /> {t("save", lang)}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingPostId(null)}>
                        <X className="w-3 h-3 mr-1" /> {t("cancel", lang)}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
                )}

                {post.image_url && <img src={post.image_url} alt="" className="mt-3 rounded-lg max-w-md" />}
                {(post as any).file_url && !(post as any).image_url && (
                  (() => {
                    const url = (post as any).file_url as string;
                    const name = ((post as any).file_name || "") as string;
                    const isVideo = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url) || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name);
                    if (isVideo) {
                      return <video src={url} controls className="mt-3 rounded-lg max-w-md w-full" preload="metadata" />;
                    }
                    return (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                        <FileText className="w-4 h-4" />
                        {name || t("file", lang)}
                        <Download className="w-3 h-3" />
                      </a>
                    );
                  })()
                )}
              </div>
            );
          })
        )}
      </div>

      {canPost ? (
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3">
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-muted rounded-lg text-xs text-muted-foreground">
              {attachedFile.type.startsWith("video/") ? <VideoIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
              <span className="truncate flex-1">{attachedFile.name} · {(attachedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              {uploadFailed && !uploading && (
                <button onClick={handlePost} className="text-primary hover:underline font-medium">Повторить</button>
              )}
              {!uploading && (
                <button onClick={() => { setAttachedFile(null); setUploadFailed(false); }} className="text-destructive hover:text-destructive/80" title="Убрать">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {uploading && (
            <div className="mb-2 space-y-1">
              <Progress value={uploadProgress} className="h-1.5" />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span>Загрузка… {uploadProgress}%</span>
                <div className="flex items-center gap-2">
                  {uploadEta && <span>осталось ~{uploadEta}</span>}
                  <button onClick={cancelUpload} className="text-destructive hover:underline">Отмена</button>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const isVideo = f.type.startsWith("video/");
                  const limit = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
                  if (f.size > limit) {
                    toast.error(isVideo ? "Видео слишком большое (макс. 500 MB)" : t("file_too_large", lang));
                    return;
                  }
                  setAttachedFile(f);
                }
                e.target.value = "";
              }}
            />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              placeholder={t("write_post", lang)}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="bg-muted border-0 resize-none h-10 min-h-[40px] text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
            />
            <Button size="icon" className="h-10 w-10 duke-gradient flex-shrink-0" onClick={handlePost} disabled={(!newPost.trim() && !attachedFile) || sending || uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3 text-center">
          <p className="text-sm text-muted-foreground">{t("no_post_permission", lang)}</p>
        </div>
      )}
        </TabsContent>
        <TabsContent value="streams" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <StreamsList channelId={channel.id} channelName={channel.name} canModerate={canModerate} />
        </TabsContent>
      </Tabs>

      <InviteToChannelDialog open={showInvite} onOpenChange={setShowInvite} channelId={channel.id} onInvited={onRefresh} />

      {/* Members Dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("members_list", lang)}</DialogTitle>
          </DialogHeader>
          {membersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {members.map((m) => {
                  const isChannelCreator = m.user_id === channel.created_by;
                  const isSelf = m.user_id === user?.id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url || ""} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{m.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.username}</p>
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {isChannelCreator ? t("creator", lang) : m.role === "moderator" ? t("moderator", lang) : m.role === "admin" ? t("admin", lang) : t("member", lang)}
                        </Badge>
                      </div>
                      {canModerate && !isSelf && !isChannelCreator && (
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title={m.role === "moderator" ? t("remove_moderator", lang) : t("make_moderator", lang)} onClick={() => handleToggleMod(m.id, m.role)}>
                            {m.role === "moderator" ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title={t("kick", lang)} onClick={() => handleKick(m.id, m.username)}>
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                          {isCreator && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title={t("ban", lang)} onClick={() => handleBan(m.user_id, m.username)}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("edit_channel", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-16 w-16 cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <AvatarImage src={editAvatarPreview || channel.avatar_url || ""} />
                <AvatarFallback className="bg-secondary text-secondary-foreground"><Megaphone className="w-6 h-6" /></AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setEditAvatarFile(f);
                    setEditAvatarPreview(URL.createObjectURL(f));
                  }
                  e.target.value = "";
                }}
              />
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => avatarInputRef.current?.click()}>
                {t("photo", lang)}
              </button>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t("channel_name", lang)}</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t("channel_description", lang)}</label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="resize-none min-h-[60px]" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t("access_type_label", lang)}</label>
              <Select value={editAccess} onValueChange={setEditAccess}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("access_open", lang)}</SelectItem>
                  <SelectItem value="link">{t("access_link", lang)}</SelectItem>
                  <SelectItem value="restricted">{t("access_restricted", lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full duke-gradient" onClick={handleEditChannel} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("save", lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
