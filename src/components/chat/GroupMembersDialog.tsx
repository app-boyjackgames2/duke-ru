import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  username: string;
  avatar_url: string | null;
}

export default function GroupMembersDialog({ open, onOpenChange, conversationId }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<string>("member");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("conversation_members")
      .select("id, user_id, role")
      .eq("conversation_id", conversationId);
    if (data) {
      const ids = data.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p) => [p.user_id, p]));
      setMembers(
        data.map((m) => ({
          ...m,
          username: map.get(m.user_id)?.username || "?",
          avatar_url: map.get(m.user_id)?.avatar_url || null,
        }))
      );
      const me = data.find((m) => m.user_id === user?.id);
      setMyRole(me?.role || "member");
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, conversationId]);

  const isAdmin = myRole === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;

  const changeRole = async (m: Member, newRole: string) => {
    if (m.role === newRole) return;
    if (m.role === "admin" && newRole !== "admin" && adminCount <= 1) {
      toast.error("Нельзя оставить группу без админа");
      return;
    }
    const { error } = await supabase
      .from("conversation_members")
      .update({ role: newRole })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Роль обновлена"); load(); }
  };

  const removeMember = async (m: Member) => {
    if (m.role === "admin" && adminCount <= 1) {
      toast.error("Нельзя удалить последнего админа");
      return;
    }
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Участник удалён"); load(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-primary" /> Участники группы
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {members.map((m) => {
              const isMe = m.user_id === user?.id;
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.avatar_url || ""} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{m.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {m.username}{isMe && <span className="text-muted-foreground"> (вы)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {m.role === "admin" && <Shield className="w-3 h-3 text-primary" />}
                      {m.role}
                    </p>
                  </div>
                  {isAdmin && !isMe && (
                    <Select value={m.role} onValueChange={(v) => changeRole(m, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="member">member</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {isAdmin && !isMe && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMember(m)} title="Удалить">
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
