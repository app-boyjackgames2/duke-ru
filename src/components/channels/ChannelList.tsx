import { useState } from "react";
import { ChannelWithDetails } from "@/hooks/useChannels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus } from "lucide-react";
import CreateChannelDialog from "./CreateChannelDialog";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/i18n/translations";

interface Props {
  channels: ChannelWithDetails[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  searchQuery?: string;
}

export default function ChannelList({ channels, activeId, onSelect, onRefresh, searchQuery = "" }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const { lang } = useLanguage();

  const filtered = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Megaphone className="w-3.5 h-3.5" />
          {t("channels", lang)}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="max-h-48">
        <div className="px-2 pb-1">
          {filtered.map((ch) => {
            const isActive = ch.id === activeId;
            return (
              <button
                key={ch.id}
                onClick={() => onSelect(ch.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 transition-colors text-left ${
                  isActive ? "bg-primary/10 border border-primary/20 duke-glow-sm" : "hover:bg-muted"
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={ch.avatar_url || ""} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    <Megaphone className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate block ${isActive ? "text-primary" : "text-foreground"}`}>
                    {ch.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{ch.member_count} {t("members_short", lang)}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">{t("no_channels", lang)}</p>
          )}
        </div>
      </ScrollArea>

      <CreateChannelDialog open={showCreate} onOpenChange={setShowCreate} onCreated={onRefresh} />
    </>
  );
}
