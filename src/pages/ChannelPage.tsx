import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Megaphone, Users, Loader2, Share2, LogIn, Check } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface ChannelData {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  access_type: string;
}

interface PostData {
  id: string;
  content: string;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  author_id: string;
}

export default function ChannelPage() {
  const { channelName } = useParams<{ channelName: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!channelName) return;
    (async () => {
      const { data: ch } = await supabase
        .from("channels")
        .select("*")
        .eq("name", channelName)
        .single();

      if (!ch) { setLoading(false); return; }
      setChannel(ch as ChannelData);

      const { count } = await supabase
        .from("channel_members")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", ch.id);
      setMemberCount(count || 0);

      if (user) {
        const { data: mem } = await supabase
          .from("channel_members")
          .select("id")
          .eq("channel_id", ch.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsMember(!!mem);
      }

      const { data: p } = await supabase
        .from("channel_posts")
        .select("id, content, image_url, file_url, file_name, created_at, author_id")
        .eq("channel_id", ch.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setPosts((p as PostData[]) || []);
      setLoading(false);
    })();
  }, [channelName, user]);

  const handleSubscribe = async () => {
    if (!user) { navigate("/login"); return; }
    if (!channel) return;
    setJoining(true);
    const { error } = await supabase.from("channel_members").insert({
      channel_id: channel.id,
      user_id: user.id,
      role: "member",
    });
    if (error) {
      toast.error("Не удалось подписаться");
    } else {
      setIsMember(true);
      setMemberCount((c) => c + 1);
      toast.success("Вы подписались на канал!");
    }
    setJoining(false);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/channel/${channelName}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Megaphone className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground text-lg">Канал не найден</p>
        <Button variant="outline" onClick={() => navigate("/")}>На главную</Button>
      </div>
    );
  }

  const canSubscribe = channel.access_type === "open" || channel.access_type === "link";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={channel.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                <Megaphone className="w-7 h-7" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">@{channel.name}</h1>
              {channel.description && (
                <p className="text-muted-foreground text-sm mt-1">{channel.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{memberCount} подписчиков</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isMember ? (
              <Button disabled className="duke-gradient">
                <Check className="w-4 h-4 mr-2" /> Вы подписаны
              </Button>
            ) : canSubscribe ? (
              <Button className="duke-gradient" onClick={handleSubscribe} disabled={joining}>
                {joining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                Подписаться
              </Button>
            ) : (
              <Button disabled variant="outline">Доступ ограничен</Button>
            )}
            <Button variant="outline" size="icon" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Пока нет публикаций</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-2">
                {format(new Date(post.created_at), "d MMM yyyy, HH:mm", { locale: ru })}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt="" className="mt-3 rounded-lg max-w-full" />}
              {post.file_url && !post.image_url && (
                <a href={post.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  📎 {post.file_name || "Файл"}
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
