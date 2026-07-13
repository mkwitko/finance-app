import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { getSessionUser, type SessionUser, subscribeAuth } from "@/lib/auth";

type AuthState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const user = await getSessionUser();
      if (active) setState({ user, isAuthenticated: user !== null, isLoading: false });
    };
    void load();
    const unsubscribe = subscribeAuth(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
