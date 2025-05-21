import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./api";
import { useLocation } from "wouter";

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/public/filaments"
];

type User = {
  id: number;
  username: string;
  isAdmin: boolean;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  isPublicRoute: (path: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [location] = useLocation();

  // Function to check if a path is a public route
  const isPublicRoute = (path: string): boolean => {
    return PUBLIC_ROUTES.some(route => path === route || path.startsWith(route + "/"));
  };

  const login = (userData: User) => {
    console.log("Setting user in auth context:", userData);
    setUser(userData);
    localStorage.setItem("isAuthenticated", "true");
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("isAuthenticated");
    }
  };

  const checkAuth = async () => {
    try {
      setLoading(true);

      const isAuth = localStorage.getItem("isAuthenticated");
      if (isAuth) {
        const userData = await apiRequest<User>("/api/auth/me");
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      localStorage.removeItem("isAuthenticated");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Skip authentication check for public routes
    if (isPublicRoute(location)) {
      console.log("Skipping auth check for public route:", location);
      setLoading(false);
      return;
    }

    checkAuth();
  }, [location]);

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
    login,
    logout,
    checkAuth,
    isPublicRoute,
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}