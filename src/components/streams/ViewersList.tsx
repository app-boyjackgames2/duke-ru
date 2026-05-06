import { ViewerRow } from "@/hooks/useStreamViewers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";

export default function ViewersList({ viewers }: { viewers: ViewerRow[] }) {
  return (
    <div className="bg-card/30 border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Онлайн</h3>
        <span className="text-xs text-muted-foreground ml-auto">{viewers.length}</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {viewers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Никого нет</p>
        ) : (
          viewers.map((v) => (
            <div key={v.user_id} className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={v.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{(v.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-xs truncate">{v.username || "Пользователь"}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
