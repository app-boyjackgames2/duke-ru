import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/i18n/translations";
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
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLanguage();

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
    if (error) toast.error(t("save_error", lang));
    else toast.success(t("profile_saved", lang));
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(t("upload_error", lang)); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ avatar_url: data.publicUrl });
    toast.success(t("avatar_updated", lang));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("back", lang)}
        </Button>

        <h1 className="text-2xl font-bold text-foreground mb-6">{t("profile_settings", lang)}</h1>

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
            <Label>{t("username", lang)}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-card border-border" />
          </div>
          <div className="space-y-2">
            <Label>{t("status", lang)}</Label>
            <Input value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder={t("status_placeholder", lang)} className="bg-card border-border" />
          </div>
          <Button onClick={handleSave} className="w-full duke-gradient" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("save", lang)}
          </Button>

          <div className="space-y-2 pt-4 border-t border-border">
            <Label>{t("theme", lang)}</Label>
            <div className="flex gap-2">
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")} className="flex-1">
                <Moon className="w-4 h-4 mr-1" /> {t("dark", lang)}
              </Button>
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")} className="flex-1">
                <Sun className="w-4 h-4 mr-1" /> {t("light", lang)}
              </Button>
              <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")} className="flex-1">
                <Monitor className="w-4 h-4 mr-1" /> {t("auto", lang)}
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <Label>{t("language", lang)}</Label>
            <div className="flex gap-2">
              <Button variant={lang === "ru" ? "default" : "outline"} size="sm" onClick={() => setLang("ru")} className="flex-1">
                🇷🇺 Русский
              </Button>
              <Button variant={lang === "en" ? "default" : "outline"} size="sm" onClick={() => setLang("en")} className="flex-1">
                🇬🇧 English
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
