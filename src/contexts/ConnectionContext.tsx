import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type ConnectionContextValue = {
  online: boolean;
  realtimeHealthy: boolean;
  reportRealtimeState: (healthy: boolean) => void;
};

const ConnectionContext = createContext<ConnectionContextValue>({
  online: true,
  realtimeHealthy: true,
  reportRealtimeState: () => undefined,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value = useMemo(() => ({ online, realtimeHealthy, reportRealtimeState: setRealtimeHealthy }), [online, realtimeHealthy]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export const useConnection = () => useContext(ConnectionContext);