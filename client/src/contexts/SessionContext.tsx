import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SessionContextType {
  firstRunComplete: boolean;
  markFirstRunComplete: () => void;
  sessionRole: string | null;
  setSessionRole: (role: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [firstRunComplete, setFirstRunComplete] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem("scout:firstRunComplete") === "1";
    } catch {
      return false;
    }
  });

  const [sessionRole, setSessionRoleState] = useState<string | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      return window.sessionStorage.getItem("scout:sessionRole") || null;
    } catch {
      return null;
    }
  });

  const markFirstRunComplete = useCallback(() => {
    setFirstRunComplete(true);
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("scout:firstRunComplete", "1");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setSessionRole = useCallback((role: string | null) => {
    setSessionRoleState(role);
    try {
      if (typeof window !== "undefined") {
        if (role) {
          window.sessionStorage.setItem("scout:sessionRole", role);
        } else {
          window.sessionStorage.removeItem("scout:sessionRole");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Keep in sync if sessionStorage was modified elsewhere in this tab
    try {
      if (typeof window === "undefined") return;
      const storedFirstRun = window.sessionStorage.getItem("scout:firstRunComplete") === "1";
      const storedRole = window.sessionStorage.getItem("scout:sessionRole");
      if (storedFirstRun !== firstRunComplete) {
        setFirstRunComplete(storedFirstRun);
      }
      if (storedRole !== sessionRole) {
        setSessionRoleState(storedRole || null);
      }
    } catch {
      // ignore
    }
  }, [firstRunComplete, sessionRole]);

  return (
    <SessionContext.Provider
      value={{
        firstRunComplete,
        markFirstRunComplete,
        sessionRole,
        setSessionRole,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
