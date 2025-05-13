import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Fetch current theme from server
  const { data: themeData } = useQuery({
    queryKey: ['/api/theme'],
    queryFn: () => apiRequest<{ variant: string; primary: string; appearance: string; radius: number }>('/api/theme')
  });

  // Theme mutation to update the theme file
  const updateThemeMutation = useMutation({
    mutationFn: (newTheme: { variant: string; primary: string; appearance: string; radius: number }) => {
      return apiRequest('/api/theme', {
        method: 'POST',
        body: JSON.stringify(newTheme)
      });
    }
  });

  // Initialize theme from server data or localStorage
  useEffect(() => {
    // If theme data is loaded from server, use it
    if (themeData?.appearance) {
      setTheme(themeData.appearance as Theme);
      
      // Apply theme class to document
      if (themeData.appearance === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      // Store in localStorage as fallback
      localStorage.setItem("theme", themeData.appearance);
      return;
    }
    
    // Otherwise use localStorage or system preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme as Theme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Use system preference if no saved theme
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setTheme(systemPreference);
      if (systemPreference === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", systemPreference);
    }
  }, [themeData]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    updateTheme(newTheme);
  };

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    
    // Apply theme class to document
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Store in localStorage
    localStorage.setItem("theme", newTheme);
    
    // Update theme on server
    if (themeData) {
      updateThemeMutation.mutate({
        ...themeData,
        appearance: newTheme
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
