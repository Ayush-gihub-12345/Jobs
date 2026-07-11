import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { watchAuth, signOut as fbSignOut, firebaseConfigured, type User } from "../lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchAuth((u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    configured: firebaseConfigured,
    getIdToken: async () => (user ? user.getIdToken() : null),
    signOut: fbSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
