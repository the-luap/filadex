import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const { toast } = useToast();

  // Fetch current theme from server
  const { data: themeData, refetch } = useQuery({
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
    },
    onSuccess: () => {
      refetch(); // Refetch theme data after successful update
      toast({
        title: "Theme updated",
        description: `Switched to ${theme === "dark" ? "light" : "dark"} mode`
      });
    },
    onError: (error) => {
      console.error("Error updating theme:", error);
      toast({
        title: "Error",
        description: "Failed to update theme.",
        variant: "destructive"
      });
    }
  });

  // Initialize theme from server data or localStorage
  useEffect(() => {
    // Check localStorage first for initial load
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme as "light" | "dark");
      applyTheme(savedTheme as "light" | "dark");
    }

    // If theme data is loaded from server, use it
    if (themeData?.appearance) {
      setTheme(themeData.appearance as "light" | "dark");
      applyTheme(themeData.appearance as "light" | "dark");

      // Store in localStorage as fallback
      localStorage.setItem("theme", themeData.appearance);
    }
  }, [themeData]);

  // Apply theme to document and body
  const applyTheme = (newTheme: "light" | "dark") => {
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  };

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    // Apply theme
    applyTheme(newTheme);

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
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={`${theme === 'dark' ? 'bg-primary/20 hover:bg-primary/30 text-white border-white/20' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-200'}`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
