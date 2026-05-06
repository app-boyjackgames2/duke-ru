import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Loader2, Video, Mic, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string;
  onCreated?: () => void;
}

const MAX_VIDEOS = 100;

async function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration || 0; URL.revokeObjectURL(v.src); resolve(d); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export default function CreateStreamDialog({ open, onOpenChange, channelId, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"video" | "bar">("video");
  const [accessType, setAccessType] = useState("open");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [endsAt, setEndsAt] = useState("");
  const [loopVideo, setLoopVideo] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [autoEnd, setAutoEnd] = useState(true);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [disableAds, setDisableAds] = useState(false);
  const [ageRating, setAgeRating] = useState<string>("none");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setDescription(""); setMode("video"); setAccessType("open");
    setEndsAt(""); setLoopVideo(false); setAutoStart(true); setAutoEnd(true);
    setIsBroadcast(false); setDisableAds(false); setAgeRating("none"); setLogoFile(null);
    setFiles([]); setProgress(0); setSubmitting(false);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("video/"));
    const merged = [...files, ...incoming].slice(0, MAX_VIDEOS);
    if (files.length + incoming.length > MAX_VIDEOS) {
      toast.error(`Максимум ${MAX_VIDEOS} файлов`);
    }
    setFiles(merged);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Укажите название"); return; }
    if (mode === "video" && files.length === 0) { toast.error("Добавьте хотя бы одно видео"); return; }
    if (!startsAt) { toast.error("Укажите время старта"); return; }

    setSubmitting(true);

    let logo_url: string | null = null;
    if (logoFile) {
      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const path = `streams/logos/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, logoFile, { contentType: logoFile.type, upsert: false });
      if (!upErr) logo_url = supabase.storage.from("chat-attachments").getPublicUrl(path).data.publicUrl;
    }

    const access_token = accessType === "link" ? Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14) : null;

    const { data: created, error } = await supabase.from("streams").insert({
      channel_id: channelId,
      created_by: user.id,
      title: title.trim(),
      description: description.trim(),
      mode,
      access_type: accessType,
      access_token,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      loop_video: loopVideo,
      auto_start: autoStart,
      auto_end: autoEnd,
      is_broadcast: isBroadcast,
      disable_ads: disableAds,
      age_rating: ageRating === "none" ? null : ageRating,
      logo_url,
    }).select().single();

    if (error || !created) {
      toast.error(error?.message || "Ошибка создания трансляции");
      setSubmitting(false);
      return;
    }

    if (mode === "video" && files.length > 0) {
      let i = 0;
      const total = files.length;
      const inserts: any[] = [];
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "mp4").toLowerCase();
        const path = `streams/${created.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) {
          toast.error(`Не удалось загрузить ${f.name}: ${upErr.message}`);
          await supabase.from("streams").delete().eq("id", created.id);
          setSubmitting(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        const duration = await probeDuration(f);
        inserts.push({
          stream_id: created.id,
          position: i,
          file_url: urlData.publicUrl,
          file_name: f.name,
          file_size: f.size,
          duration_seconds: duration,
        });
        i++;
        setProgress(Math.round((i / total) * 100));
      }
      const { error: vErr } = await supabase.from("stream_videos").insert(inserts);
      if (vErr) toast.error(vErr.message);
    }

    toast.success("Трансляция создана");
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Создать трансляцию</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Название</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Прямой эфир" />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none min-h-[60px]" />
          </div>

          <div>
            <Label>Режим</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-2 mt-2">
              <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer ${mode === "video" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="video" /> <Video className="w-4 h-4" /> <span className="text-sm">Видео-трансляция</span>
              </label>
              <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer ${mode === "bar" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="bar" /> <Mic className="w-4 h-4" /> <span className="text-sm">Бар (live)</span>
              </label>
            </RadioGroup>
          </div>

          {mode === "video" && (
            <div>
              <Label>Видео-файлы (до {MAX_VIDEOS})</Label>
              <input ref={fileInputRef} type="file" accept="video/*,.mp4,.avi,.mov,.mkv,.webm" multiple className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
              <Button type="button" variant="outline" className="w-full mt-1" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Добавить файлы ({files.length}/{MAX_VIDEOS})
              </Button>
              {files.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                      <Video className="w-3 h-3 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Тип доступа</Label>
            <Select value={accessType} onValueChange={setAccessType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Открытый</SelectItem>
                <SelectItem value="link">По ссылке</SelectItem>
                <SelectItem value="restricted">Ограниченный</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Начало</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Окончание (опц.)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            {mode === "video" && (
              <div className="flex items-center justify-between">
                <Label htmlFor="loop">Повтор видео</Label>
                <Switch id="loop" checked={loopVideo} onCheckedChange={setLoopVideo} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="autostart">Авто-старт</Label>
              <Switch id="autostart" checked={autoStart} onCheckedChange={setAutoStart} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="autoend">Авто-завершение</Label>
              <Switch id="autoend" checked={autoEnd} onCheckedChange={setAutoEnd} />
            </div>
          </div>

          {submitting && files.length > 0 && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Загрузка видео {progress}%</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} disabled={submitting}>Отмена</Button>
            <Button className="duke-gradient" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Создать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
