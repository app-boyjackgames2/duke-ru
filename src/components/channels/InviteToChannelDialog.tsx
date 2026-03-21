import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  onInvited?: () => void;
}

interface UserResult {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export default function InviteToChannelDialog({ open, onOpenChange, channelId, onInvited }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  const reset = () => {
    setSearch("");
    setResults([]);
    setSelected([]);
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);

    // Get existing members
    const { data: members } = await supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", channelId);

    const memberIds = members?.map((m) => m.user_id) || [];

    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .ilike("username", `%${query}%`)
      .limit(15);

    // Filter out existing members
    const filtered = (data || []).filter((u) => !memberIds.includes(u.user_id));
    setResults(filtered as UserResult[]);
    setSearching(false);
  };

  const toggleUser = (u: UserResult) => {
    setSelected((prev) =>
      prev.find((s) => s.user_id === u.user_id)
        ? prev.filter((s) => s.user_id !== u.user_id)
        : [...prev, u]
    );
  };

  const handleInvite = async () => {
    if (selected.length === 0) return;
    setInviting(true);

    const inserts = selected.map((u) => ({
      channel_id: channelId,
      user_id: u.user_id,
      role: "member" as const,
    }));

    const { error } = await supabase.from("channel_members").insert(inserts);

    if (error) {
      toast.error("Ошибка приглашения");
    } else {
      toast.success(`Приглашено ${selected.length} пользователей`);
      reset();
      onOpenChange(false);
      onInvited?.();
    }
    setInviting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Пригласить в канал
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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
            disabled={selected.length === 0 || inviting}
            onClick={handleInvite}
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Пригласить (${selected.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
