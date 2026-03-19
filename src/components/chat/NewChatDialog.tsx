import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { Search, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserResult {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean | null;
}

export default function NewChatDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { createDirectConversation } = useConversations();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const startChat = async (otherUserId: string) => {
    setCreating(true);
    await createDirectConversation(otherUserId);
    setCreating(false);
    setSearch("");
    setResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Новый чат</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Введите имя пользователя..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-muted border-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {results.map((r) => (
            <Button
              key={r.user_id}
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => startChat(r.user_id)}
              disabled={creating}
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={r.avatar_url || ""} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    {r.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {r.is_online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-duke-online rounded-full border-2 border-card" />
                )}
              </div>
              <span className="text-sm text-foreground">{r.username}</span>
            </Button>
          ))}
          {search.length >= 2 && !searching && results.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">Пользователь не найден</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
