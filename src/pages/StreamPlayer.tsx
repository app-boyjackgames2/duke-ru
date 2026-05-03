import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStream } from "@/hooks/useStreams";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mic, MicOff, MonitorUp, MonitorOff, Volume2, VolumeX, Square, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stream, videos, loading } = useStream(streamId || null);
  const [now, setNow] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const notifiedStartRef = useRef(false);
  const notifiedEndRef = useRef(false);

  // Bar mode media
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const localStreamsRef = useRef<MediaStream[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
          new Notification(`${stream.title} уже начался стрим`);
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
          new Notification(`${stream.title} уже закончился стрим. Результат длительность ${formatFinalDuration(dur)}`);
        }
      } catch {}
      // stop bar streams
      stopAllLocal();
    }
  }, [stream?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Video sync for video mode
  const currentVideo = useMemo(() => {
    if (!stream || stream.mode !== "video" || videos.length === 0) return null;
    const idx = Math.min(stream.current_index ?? 0, videos.length - 1);
    return videos[idx] || null;
  }, [stream, videos]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || stream.mode !== "video" || !currentVideo) return;
    if (stream.status !== "live") return;
    const startedAt = stream.current_started_at ? new Date(stream.current_started_at).getTime() : Date.now();
    const offset = Math.max(0, (Date.now() - startedAt) / 1000);
    try {
      if (Math.abs((v.currentTime || 0) - offset) > 1.5) v.currentTime = Math.min(offset, currentVideo.duration_seconds || offset);
      v.play().catch(() => {});
    } catch {}
  }, [currentVideo?.id, stream?.status, stream?.current_started_at]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (e: any) { toast.error("Микрофон недоступен"); }
  };

  const toggleScreen = async () => {
    if (screenOn) {
      localStreamsRef.current = localStreamsRef.current.filter((s) => {
        const isScreen = s.getVideoTracks().some((t) => t.label.toLowerCase().includes("screen") || t.kind === "video");
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

  useEffect(() => () => stopAllLocal(), []);

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

  const isLive = stream.status === "live";
  const isOwner = user?.id === stream.created_by;
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
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <div className="w-full max-w-4xl">
          <h1 className="text-xl font-semibold mb-1">{stream.title}</h1>
          {stream.description && <p className="text-sm text-muted-foreground mb-4">{stream.description}</p>}

          {stream.mode === "video" ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {currentVideo && isLive ? (
                <video
                  ref={videoRef}
                  src={currentVideo.file_url}
                  className="w-full h-full"
                  autoPlay
                  playsInline
                  onPause={(e) => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="text-muted-foreground text-sm">{stream.status === "scheduled" ? "Стрим скоро начнётся" : "Стрим завершён"}</div>
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

          {/* End button only in bar mode and only owner/mod */}
          {stream.mode === "bar" && isLive && isOwner && (
            <div className="flex justify-end mt-3">
              <Button variant="destructive" onClick={handleEndStream}>
                <Square className="w-4 h-4 mr-2" /> Завершить
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
