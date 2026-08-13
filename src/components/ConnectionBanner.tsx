import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/contexts/ConnectionContext";

export default function ConnectionBanner() {
  const { online, realtimeHealthy } = useConnection();
  if (online && realtimeHealthy) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex min-h-10 items-center justify-center gap-3 border-b border-destructive/40 bg-destructive px-3 py-2 text-sm text-destructive-foreground">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{online ? "Соединение с сообщениями прервано" : "Нет подключения к интернету"}</span>
      <Button variant="secondary" size="sm" className="h-7" onClick={() => window.location.reload()}>
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Повторить
      </Button>
    </div>
  );
}