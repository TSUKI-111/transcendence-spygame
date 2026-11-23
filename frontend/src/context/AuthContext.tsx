import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type AuthValue = {
  user: PublicUser | null;
  loading: boolean;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.ok) setUser(await res.json());
  }

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, []);

  async function logout() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  if (res.ok) setUser(null);   // only clear when the server confirms
}

  return (
    <AuthContext.Provider value={{ user, loadUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("wrap the app in <AuthProvider>");
  return ctx;
}