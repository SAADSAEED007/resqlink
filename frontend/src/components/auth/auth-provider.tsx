"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth } from "@/lib/api/auth";
import {
  ApiError,
  errorMessage,
  SESSION_EXPIRED_EVENT,
} from "@/lib/api/client";
import type { SessionUser } from "@/types/api";
type State = {
  status: "loading" | "authenticated" | "anonymous" | "error";
  user: SessionUser | null;
  error: string;
  expired: boolean;
};
interface AuthContext extends State {
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
}
const Context = createContext<AuthContext | null>(null);
const anonymous: State = {
  status: "anonymous",
  user: null,
  error: "",
  expired: false,
};
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    ...anonymous,
    status: "loading",
  });
  const generation = useRef(0);
  const mutating = useRef(false);
  const readSession = useCallback(async (): Promise<State> => {
    try {
      return {
        ...anonymous,
        user: await auth.session(),
        status: "authenticated",
      };
    } catch (error) {
      return error instanceof ApiError && error.status === 401
        ? anonymous
        : { ...anonymous, status: "error", error: errorMessage(error) };
    }
  }, []);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    const next = await readSession();
    if (version === generation.current) setState(next);
  }, [readSession]);
  useEffect(() => {
    const requests = generation;
    const version = ++requests.current;
    void readSession().then((next) => {
      if (version === requests.current) setState(next);
    });
    const expire = () => {
      ++generation.current;
      setState({ ...anonymous, expired: true });
    };
    const revalidate = () => {
      if (document.visibilityState === "visible" && !mutating.current)
        void refresh();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      ++requests.current;
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [refresh, readSession]);
  const login = async (email: string, password: string) => {
    mutating.current = true;
    ++generation.current;
    try {
      const user = await auth.login(email, password);
      ++generation.current;
      setState({ ...anonymous, user, status: "authenticated" });
      return user;
    } finally {
      mutating.current = false;
    }
  };
  const logout = async () => {
    mutating.current = true;
    ++generation.current;
    try {
      try {
        await auth.logout();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
      ++generation.current;
      setState(anonymous);
    } finally {
      mutating.current = false;
    }
  };
  return (
    <Context.Provider
      value={{
        ...state,
        refresh: async () => {
          setState((old) => ({ ...old, status: "loading" }));
          await refresh();
        },
        login,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
