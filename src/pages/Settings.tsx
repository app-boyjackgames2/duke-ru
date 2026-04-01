import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, Sun, Moon, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const [username, setUsername] = useState("");
  const [statusText, setStatusText] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile && !initialized) {
    setUsername(profile.username || "");
    setStatusText(profile.status_text || "");
    setInitialized(true);
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({ username, status_text: statusText }) || {};
    if (error) toast.error("Ошибка сохранения");
    else toast.success("Профиль обновлён");
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Ошибка загрузки"); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ avatar_url: data.publicUrl });
    toast.success("Аватар обновлён");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Настройки профиля</h1>

        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                {profile?.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full duke-gradient flex items-center justify-center shadow-lg"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Имя пользователя</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-card border-border" />
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Input value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="Чем занимаетесь?" className="bg-card border-border" />
          </div>
          <Button onClick={handleSave} className="w-full duke-gradient" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
