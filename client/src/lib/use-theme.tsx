import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { hexToHslString } from "@/lib/utils";

export interface ThemeData {
  variant: string;
  primary: string;
  appearance: "light" | "dark";
  radius: number;
}

const DEFAULT_THEME: ThemeData = {
  variant: "professional",
  primary: "#EA580C",
  appearance: "dark",
  radius: 0.8,
};

function applyAppearance(appearance: "light" | "dark") {
  document.documentElement.classList.toggle("dark", appearance === "dark");
  document.body.classList.toggle("dark", appearance === "dark");
}

function applyPrimaryColor(color: string) {
  document.documentElement.style.setProperty("--theme-primary", color);
  document.documentElement.style.setProperty("--theme-loaded-primary", color);
  const hsl = hexToHslString(color);
  if (hsl) {
    document.documentElement.style.setProperty("--primary", hsl);
  }
}

/**
 * Single source of truth for the authenticated user's theme (accent color +
 * light/dark appearance). Previously ThemeToggle and ThemeSelector each ran
 * their own independent query and effect against the same DOM state
 * (documentElement's "dark" class and the --primary CSS variable), which
 * could race - e.g. the accent color reverting to its hardcoded default
 * after a dark/light toggle. Call this once per mount (every consumer
 * shares the same react-query cache entry, so there's no duplicate
 * network traffic) and always apply both the class and the color together.
 */
export function useTheme() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: theme } = useQuery({
    queryKey: ["/api/theme"],
    queryFn: () => apiRequest<ThemeData>("/api/theme"),
    enabled: isAuthenticated,
  });

  const resolvedTheme = theme ?? DEFAULT_THEME;

  useEffect(() => {
    applyAppearance(resolvedTheme.appearance);
    applyPrimaryColor(resolvedTheme.primary);
    localStorage.setItem("theme", resolvedTheme.appearance);
  }, [resolvedTheme.appearance, resolvedTheme.primary]);

  const updateMutation = useMutation({
    mutationFn: (update: Partial<ThemeData>) =>
      apiRequest("/api/theme", { method: "POST", body: JSON.stringify(update) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/theme"] });
    },
  });

  const setAppearance = useCallback((appearance: "light" | "dark") => {
    // Apply immediately for a snappy toggle; the mutation + invalidate above
    // reconciles with the server (and is what other tabs pick up on refetch).
    applyAppearance(appearance);
    localStorage.setItem("theme", appearance);
    updateMutation.mutate({ appearance });
  }, [updateMutation]);

  const setPrimaryColor = useCallback((color: string) => {
    applyPrimaryColor(color);
    updateMutation.mutate({ primary: color });
  }, [updateMutation]);

  return {
    theme: resolvedTheme,
    setAppearance,
    setPrimaryColor,
    isSaving: updateMutation.isPending,
  };
}

/** Mount once near the app root so theme sync runs on every authenticated
 * page load, not only while a theme-related dropdown/dialog happens to be open. */
export function ThemeSync() {
  useTheme();
  return null;
}
