import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function CreateChannelDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<"open" | "link" | "restricted">("open");
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setAccessType("open");
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setCreating(true);

    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `channels/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (!error) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { data: ch, error: chErr } = await supabase
        .from("channels")
        .insert({ name: name.trim(), description: description.trim(), avatar_url: avatarUrl, created_by: user.id })
        .select()
        .single();

      if (chErr || !ch) {
        console.error("Channel creation error:", chErr);
        toast.error(`Ошибка создания канала: ${chErr?.message || "неизвестная ошибка"}`);
        setCreating(false);
        return;
      }

      const { error: memErr } = await supabase.from("channel_members").insert({
        channel_id: ch.id,
        user_id: user.id,
        role: "admin",
      });

      if (memErr) {
        console.error("Channel member insert error:", memErr);
        toast.error(`Канал создан, но не удалось добавить вас: ${memErr.message}`);
      } else {
        toast.success("Канал создан!");
      }

      reset();
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error("Ошибка создания канала");
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Новый канал
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0 overflow-hidden"
            >
              {avatarPreview ? (
                <img src={avatarPreview} className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-muted-foreground" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Название канала"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Описание (необязательно)</Label>
            <Textarea
              placeholder="О чём этот канал..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted border-0 resize-none h-20 text-sm"
            />
          </div>
          <Button
            className="w-full duke-gradient"
            disabled={!name.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать канал"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
