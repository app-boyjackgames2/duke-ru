import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StreamNotification {
  id: string;
  user_id: string;
  stream_id: string;
  type: "started" | "ended" | "upcoming" | "next" | string;
  payload: any;
  read_at: string | null;
  created_at: string;
}

export function useStreamNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<StreamNotification[]>([]);
  const [prefStreamAlerts, setPrefStreamAlerts] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("stream_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as StreamNotification[]) || []);
  }, [user]);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_notification_prefs")
      .select("stream_alerts")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setPrefStreamAlerts(!!data.stream_alerts);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    loadPrefs();
    const ch = supabase
      .channel(`stream-notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load, loadPrefs]);

  const markRead = async (id: string) => {
    await supabase.from("stream_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("stream_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  };
  const setStreamAlerts = async (v: boolean) => {
    if (!user) return;
    setPrefStreamAlerts(v);
    const { data: existing } = await supabase.from("user_notification_prefs").select("user_id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("user_notification_prefs").update({ stream_alerts: v }).eq("user_id", user.id);
    } else {
      await supabase.from("user_notification_prefs").insert({ user_id: user.id, stream_alerts: v });
    }
  };

  const unread = items.filter((i) => !i.read_at).length;
  return { items, unread, markRead, markAllRead, prefStreamAlerts, setStreamAlerts };
}
