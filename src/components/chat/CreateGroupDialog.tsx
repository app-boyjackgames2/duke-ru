import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, Camera, Users, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversationId: string) => void;
}

interface UserResult {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean | null;
}

export default function CreateGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setGroupName("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setSearch("");
    setResults([]);
    setSelected([]);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, is_online")
      .ilike("username", `%${query}%`)
      .neq("user_id", user?.id || "")
      .limit(10);
    setResults((data as UserResult[]) || []);
    setSearching(false);
  };

  const toggleUser = (u: UserResult) => {
    setSelected((prev) =>
      prev.find((s) => s.user_id === u.user_id)
        ? prev.filter((s) => s.user_id !== u.user_id)
        : [...prev, u]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length === 0 || !user) return;
    setCreating(true);

    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `groups/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (!error) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({ type: "group", name: groupName.trim(), avatar_url: avatarUrl, created_by: user.id })
        .select()
        .single();

      if (convErr || !newConv) {
        toast.error("Ошибка создания группы");
        setCreating(false);
        return;
      }

      const members = [
        { conversation_id: newConv.id, user_id: user.id, role: "admin" },
        ...selected.map((s) => ({ conversation_id: newConv.id, user_id: s.user_id, role: "member" })),
      ];

      const { error: memErr } = await supabase.from("conversation_members").insert(members);

      if (memErr) {
        toast.error("Группа создана, но ошибка добавления участников");
      } else {
        toast.success("Группа создана!");
      }

      reset();
      onOpenChange(false);
      onCreated?.(newConv.id);
    } catch {
      toast.error("Ошибка создания группы");
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {step === 1 ? "Новая группа" : "Добавить участников"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
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
              <Input
                placeholder="Название группы"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-muted border-0"
              />
            </div>
            <Button
              className="w-full duke-gradient"
              disabled={!groupName.trim()}
              onClick={() => setStep(2)}
            >
              Далее <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Назад
            </Button>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <span
                    key={u.user_id}
                    className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-primary/30"
                    onClick={() => toggleUser(u)}
                  >
                    {u.username} ×
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск пользователей..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-muted border-0"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {results.map((r) => {
                const isSelected = selected.some((s) => s.user_id === r.user_id);
                return (
                  <button
                    key={r.user_id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => toggleUser(r)}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={r.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {r.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{r.username}</span>
                  </button>
                );
              })}
            </div>

            <Button
              className="w-full duke-gradient"
              disabled={selected.length === 0 || creating}
              onClick={handleCreate}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : `Создать группу (${selected.length})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
