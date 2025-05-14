import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paintbrush } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

// Preset color options
const getPresetColors = (t: (key: string) => string) => [
  { name: t('settings.colors.red') || "Red", value: "#E11D48" },  // Default
  { name: t('settings.colors.blue') || "Blue", value: "#0369A1" },
  { name: t('settings.colors.green') || "Green", value: "#16A34A" },
  { name: t('settings.colors.purple') || "Purple", value: "#9333EA" },
  { name: t('settings.colors.orange') || "Orange", value: "#EA580C" },
  { name: t('settings.colors.yellow') || "Yellow", value: "#CA8A04" },
  { name: t('settings.colors.pink') || "Pink", value: "#DB2777" },
  { name: t('settings.colors.teal') || "Teal", value: "#0D9488" },
];

interface ThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeSelector({ open, onOpenChange }: ThemeSelectorProps) {
  const { t } = useTranslation();
  const presetColors = getPresetColors(t);
  const [selectedColor, setSelectedColor] = useState(presetColors[0].value);
  const [customColor, setCustomColor] = useState("");

  // Load current theme from server
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
    },
    onSuccess: () => {
      toast({
        title: t('settings.themeUpdated'),
        description: t('settings.themeUpdatedDescription') || "Settings saved successfully."
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating theme:", error);
      toast({
        title: t('common.error'),
        description: t('settings.themeUpdateError') || "The theme could not be updated.",
        variant: "destructive"
      });
    }
  });

  // Load current color from theme or localStorage on first load
  useEffect(() => {
    // If theme data is loaded from server, use it
    if (themeData?.primary) {
      setSelectedColor(themeData.primary);
      setCustomColor(themeData.primary);
      // Set the color as CSS variable
      document.documentElement.style.setProperty("--theme-primary", themeData.primary);
      document.documentElement.style.setProperty("--theme-loaded-primary", themeData.primary);
      return;
    }

    // Otherwise use from localStorage (fallback)
    const savedColor = localStorage.getItem("themeColor");
    if (savedColor) {
      setSelectedColor(savedColor);
      setCustomColor(savedColor);
      // Set the saved color as CSS variable
      document.documentElement.style.setProperty("--theme-primary", savedColor);
      document.documentElement.style.setProperty("--theme-loaded-primary", savedColor);
    }
  }, [themeData]);

  // Function to apply the color scheme
  const applyTheme = (color: string) => {
    // Save color in localStorage (as fallback)
    localStorage.setItem("themeColor", color);

    // Update CSS variable
    document.documentElement.style.setProperty("--theme-primary", color);
    document.documentElement.style.setProperty("--theme-loaded-primary", color);

    // Get current theme mode from localStorage or use dark as default
    const currentTheme = localStorage.getItem("theme") || "dark";

    // Create new theme object and send to server
    const updatedTheme = {
      variant: themeData?.variant || "professional",
      primary: color,
      appearance: currentTheme as "light" | "dark",
      radius: themeData?.radius || 0.8
    };

    // API call to update the theme
    updateThemeMutation.mutate(updatedTheme);
  };

  // Select color
  const handleSelectPreset = (color: string) => {
    setSelectedColor(color);
  };

  // Apply custom color
  const handleApplyCustom = () => {
    if (customColor) {
      setSelectedColor(customColor);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Paintbrush className="mr-2 h-5 w-5" />
            {t('settings.customizeAccentColor')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="presets" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">{t('settings.presets')}</TabsTrigger>
            <TabsTrigger value="custom">{t('settings.custom')}</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  className={`w-full h-12 rounded-md transition-all ${
                    selectedColor === color.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : ""
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleSelectPreset(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-color">{t('settings.customColor')}</Label>
              <div className="flex space-x-2">
                <input
                  id="custom-color"
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  placeholder="#HEX"
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Button variant="outline" onClick={handleApplyCustom}>
                  {t('settings.apply')}
                </Button>
              </div>
            </div>

            <div className="h-12 rounded-md transition-all" style={{ backgroundColor: selectedColor }}>
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-shadow-sm shadow-black">{t('settings.preview')}</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:mt-0 w-full sm:w-auto"
          >
            {t('settings.cancel')}
          </Button>
          <Button
            onClick={() => applyTheme(selectedColor)}
            className="mt-2 sm:mt-0 w-full sm:w-auto"
            disabled={updateThemeMutation.isPending}
          >
            {updateThemeMutation.isPending ? (
              <>{t('settings.savingSettings')}</>
            ) : (
              <>{t('settings.applyColor')}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}