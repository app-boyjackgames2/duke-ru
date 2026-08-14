import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isTemporaryNetworkError, withTimeout } from "@/lib/network";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshPaused = useRef(false);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    const pauseRefresh = () => {
      if (refreshPaused.current) return;
      refreshPaused.current = true;
      // Stops the 20s refresh storm while the backend/network is unreachable.
      supabase.auth.stopAutoRefresh();
    };

    const resumeRefresh = () => {
      if (!refreshPaused.current) return;
      refreshPaused.current = false;
      supabase.auth.startAutoRefresh();
    };

    const loadSession = async () => {
      if (!navigator.onLine) {
        pauseRefresh();
        if (mounted) setLoading(false);
        return;
      }
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 12000);
        if (!mounted) return;
        setSession(data.session);
        resumeRefresh();
      } catch (error) {
        if (isTemporaryNetworkError(error)) pauseRefresh();
        else if (mounted) setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSession();

    const handleOnline = () => {
      resumeRefresh();
      loadSession();
    };
    const handleOffline = () => pauseRefresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) handleOnline();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 8000);
    } catch {
      // Network down — drop the local session anyway.
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
