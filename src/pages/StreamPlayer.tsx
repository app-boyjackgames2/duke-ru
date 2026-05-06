import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useStream } from "@/hooks/useStreams";
import { useStreamViewers } from "@/hooks/useStreamViewers";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mic, MicOff, MonitorUp, MonitorOff, Volume2, VolumeX, Square, Radio, Lock, Share2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import StreamChat from "@/components/streams/StreamChat";
import ViewersList from "@/components/streams/ViewersList";
import StreamControlPanel from "@/components/streams/StreamControlPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatLiveDuration(start: Date, now: Date) {
  const diff = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const days = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days >= 1) return `${days} DAY: ${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatFinalDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export default function StreamPlayerPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("t") || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stream, videos, loading } = useStream(streamId || null);
  const [now, setNow] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const notifiedStartRef = useRef(false);
  const notifiedEndRef = useRef(false);
  const [canModerate, setCanModerate] = useState(false);

  // Bar mode media
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const localStreamsRef = useRef<MediaStream[]>([]);

  const isLive = stream?.status === "live";
  const { viewers } = useStreamViewers(streamId || null, !!isLive);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check moderator status
  useEffect(() => {
    (async () => {
      if (!stream || !user) { setCanModerate(false); return; }
      if (stream.created_by === user.id) { setCanModerate(true); return; }
      const { data } = await supabase.from("channel_members")
        .select("role")
        .eq("channel_id", stream.channel_id)
        .eq("user_id", user.id)
        .maybeSingle();
      setCanModerate(data?.role === "admin" || data?.role === "moderator");
    })();
  }, [stream, user]);

  // Browser notifications on transitions
  useEffect(() => {
    if (!stream) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (stream.status === "live" && !notifiedStartRef.current) {
      notifiedStartRef.current = true;
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`${stream.title} уже началась трансляция`);
        }
      } catch {}
    }
    if (stream.status === "ended" && !notifiedEndRef.current) {
      notifiedEndRef.current = true;
      const startedAt = stream.actual_started_at ? new Date(stream.actual_started_at).getTime() : new Date(stream.starts_at).getTime();
      const endedAt = stream.actual_ended_at ? new Date(stream.actual_ended_at).getTime() : Date.now();
      const dur = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`${stream.title} закончился. Длительность ${formatFinalDuration(dur)}`);
        }
      } catch {}
      stopAllLocal();
    }
  }, [stream?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentVideo = useMemo(() => {
    if (!stream || stream.mode !== "video" || videos.length === 0) return null;
    const idx = Math.min(stream.current_index ?? 0, videos.length - 1);
    return videos[idx] || null;
  }, [stream, videos]);

  // Hard sync on transitions (video / index / status)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || stream.mode !== "video" || !currentVideo) return;
    if (stream.status !== "live") return;
    const startedAt = stream.current_started_at ? new Date(stream.current_started_at).getTime() : Date.now();
    const offset = stream.is_broadcast ? 0 : Math.max(0, (Date.now() - startedAt) / 1000);
    try {
      v.currentTime = Math.min(offset, currentVideo.duration_seconds || offset);
      v.play().catch(() => {});
    } catch {}
  }, [currentVideo?.id, stream?.status, stream?.current_started_at, stream?.is_broadcast]);

  // Smooth correction loop (rate / seek)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || stream.mode !== "video" || !currentVideo || stream.status !== "live") return;
    if (stream.is_broadcast) { v.playbackRate = 1; return; }
    const id = setInterval(() => {
      const startedAt = stream.current_started_at ? new Date(stream.current_started_at).getTime() : Date.now();
      const target = Math.max(0, (Date.now() - startedAt) / 1000);
      const diff = (v.currentTime || 0) - target;
      if (Math.abs(diff) > 1.5) {
        v.currentTime = Math.min(target, currentVideo.duration_seconds || target);
        v.playbackRate = 1;
      } else if (Math.abs(diff) > 0.25) {
        v.playbackRate = diff > 0 ? 0.95 : 1.05;
      } else {
        v.playbackRate = 1;
      }
    }, 5000);
    return () => { clearInterval(id); v.playbackRate = 1; };
  }, [currentVideo?.id, stream?.status, stream?.current_started_at, stream?.is_broadcast]);

  const stopAllLocal = () => {
    localStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    localStreamsRef.current = [];
    setMicOn(false);
    setScreenOn(false);
  };

  const toggleMic = async () => {
    if (micOn) { stopAllLocal(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamsRef.current.push(s);
      setMicOn(true);
    } catch { toast.error("Микрофон недоступен"); }
  };

  const toggleScreen = async () => {
    if (screenOn) {
      localStreamsRef.current = localStreamsRef.current.filter((s) => {
        const isScreen = s.getVideoTracks().length > 0;
        if (isScreen) { s.getTracks().forEach((t) => t.stop()); return false; }
        return true;
      });
      setScreenOn(false);
      return;
    }
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      localStreamsRef.current.push(s);
      setScreenOn(true);
    } catch { toast.error("Не удалось начать показ экрана"); }
  };

  const handleEndStream = async () => {
    if (!stream) return;
    const startedAt = stream.actual_started_at ? new Date(stream.actual_started_at).getTime() : Date.now();
    const dur = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const { error } = await supabase.from("streams")
      .update({ status: "ended", actual_ended_at: new Date().toISOString() })
      .eq("id", stream.id);
    if (error) toast.error(error.message);
    else toast.success(`Стрим завершён · ${formatFinalDuration(dur)}`);
    stopAllLocal();
  };

  const copyShareLink = () => {
    if (!stream) return;
    const base = `${window.location.origin}/channel/${stream.channel_id}/stream/${stream.id}`;
    const url = stream.access_type === "link" && stream.access_token ? `${base}?t=${stream.access_token}` : base;
    navigator.clipboard.writeText(url).then(() => toast.success("Ссылка скопирована"));
  };

  useEffect(() => () => stopAllLocal(), []);

  // Age rating overlay for broadcast / on transitions
  const [ratingVisible, setRatingVisible] = useState(false);
  useEffect(() => {
    if (!stream?.age_rating) return;
    if (stream.status !== "live") return;
    setRatingVisible(true);
    const t = setTimeout(() => setRatingVisible(false), 11000);
    return () => clearTimeout(t);
  }, [currentVideo?.id, stream?.status, stream?.age_rating]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!stream) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Трансляция не найдена</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  // Access check: link requires token match
  if (stream.access_type === "link" && stream.access_token && accessToken !== stream.access_token && !canModerate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-4 text-center">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Эта трансляция доступна только по ссылке</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  const liveSince = stream.actual_started_at ? new Date(stream.actual_started_at) : new Date(stream.starts_at);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 border-b border-border flex items-center justify-between px-3 bg-card/50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-2 text-xs font-mono text-red-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              | ПРЯМОЙ ЭФИР | {formatLiveDuration(liveSince, now)}
            </span>
          )}
          {stream.status === "scheduled" && <span className="text-xs text-muted-foreground">Запланировано: {liveSince.toLocaleString()}</span>}
          {stream.status === "ended" && <span className="text-xs text-muted-foreground">Завершён</span>}
        </div>
        <Button variant="ghost" size="icon" onClick={copyShareLink} title="Поделиться">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4 max-w-[1600px] w-full mx-auto">
        <div className="space-y-3 min-w-0">
          <div>
            <h1 className="text-xl font-semibold mb-1">{stream.title}</h1>
            {stream.description && <p className="text-sm text-muted-foreground">{stream.description}</p>}
          </div>

          {stream.mode === "video" ? (
            <div className="aspect-video relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {currentVideo && isLive ? (
                <video
                  ref={videoRef}
                  src={currentVideo.file_url}
                  className="w-full h-full"
                  autoPlay
                  playsInline
                  muted={muted}
                  onPause={(e) => { if (stream.is_broadcast) (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="text-muted-foreground text-sm">{stream.status === "scheduled" ? "Стрим скоро начнётся" : "Стрим завершён"}</div>
              )}
              {stream.logo_url && isLive && (
                <img src={stream.logo_url} alt="logo" className="absolute top-3 right-3 w-12 h-12 object-contain opacity-90 pointer-events-none" />
              )}
              {ratingVisible && stream.age_rating && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/70 text-white text-7xl font-bold px-8 py-4 rounded-2xl animate-fade-in">
                    {stream.age_rating}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex flex-col items-center justify-center gap-3">
              <Mic className="w-16 h-16 text-primary" />
              <p className="text-sm text-muted-foreground">Live режим «Бар»</p>
              {isLive && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Button variant={micOn ? "default" : "outline"} size="sm" onClick={toggleMic}>
                    {micOn ? <Mic className="w-4 h-4 mr-1" /> : <MicOff className="w-4 h-4 mr-1" />}
                    Микрофон
                  </Button>
                  <Button variant={screenOn ? "default" : "outline"} size="sm" onClick={toggleScreen}>
                    {screenOn ? <MonitorUp className="w-4 h-4 mr-1" /> : <MonitorOff className="w-4 h-4 mr-1" />}
                    Экран
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMuted((m) => !m)}>
                    {muted ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
                    Звук
                  </Button>
                </div>
              )}
            </div>
          )}

          {canModerate && <StreamControlPanel stream={stream} videos={videos} />}

          {stream.mode === "video" && videos.length > 0 && (
            <div className="bg-card/30 border border-border rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2">Плейлист ({videos.length})</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {videos.map((v, i) => (
                  <div key={v.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${i === (stream.current_index ?? 0) && isLive ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                    <span className="w-5 text-center">{i + 1}</span>
                    <span className="flex-1 truncate">{v.file_name || "Видео"}</span>
                    <span>{Math.floor((v.duration_seconds || 0) / 60)}:{String(Math.floor((v.duration_seconds || 0) % 60)).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:h-[calc(100vh-7rem)] min-h-[500px]">
          <Tabs defaultValue="chat" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="chat">Чат</TabsTrigger>
              <TabsTrigger value="viewers">Зрители ({viewers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 mt-2 min-h-0">
              <StreamChat streamId={stream.id} canModerate={canModerate} />
            </TabsContent>
            <TabsContent value="viewers" className="flex-1 mt-2 min-h-0">
              <ViewersList viewers={viewers} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
