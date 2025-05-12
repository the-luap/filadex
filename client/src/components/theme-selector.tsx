import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paintbrush } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Voreingestellte Farboptionen
const PRESET_COLORS = [
  { name: "Rot", value: "#E11D48" },  // Standard
  { name: "Blau", value: "#0369A1" },
  { name: "Grün", value: "#16A34A" },
  { name: "Lila", value: "#9333EA" },
  { name: "Orange", value: "#EA580C" },
  { name: "Gelb", value: "#CA8A04" },
  { name: "Pink", value: "#DB2777" },
  { name: "Türkis", value: "#0D9488" },
];

interface ThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeSelector({ open, onOpenChange }: ThemeSelectorProps) {
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [customColor, setCustomColor] = useState("");

  // Lade das aktuelle Theme vom Server
  const { data: themeData } = useQuery({
    queryKey: ['/api/theme'],
    queryFn: () => apiRequest<{ variant: string; primary: string; appearance: string; radius: number }>('/api/theme')
  });

  // Theme-Mutation zum Update der Theme-Datei
  const updateThemeMutation = useMutation({
    mutationFn: (newTheme: { variant: string; primary: string; appearance: string; radius: number }) => {
      return apiRequest('/api/theme', {
        method: 'POST',
        body: JSON.stringify(newTheme)
      });
    },
    onSuccess: () => {
      toast({
        title: "Thema aktualisiert",
        description: "Die Einstellungen wurden erfolgreich gespeichert."
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren des Themes:", error);
      toast({
        title: "Fehler",
        description: "Das Thema konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  });

  // Beim ersten Laden die aktuelle Farbe aus dem Theme oder localStorage holen
  useEffect(() => {
    // Wenn Theme-Daten vom Server geladen wurden, diese verwenden
    if (themeData?.primary) {
      setSelectedColor(themeData.primary);
      setCustomColor(themeData.primary);
      // Setze die Farbe als CSS-Variable
      document.documentElement.style.setProperty("--theme-primary", themeData.primary);
      document.documentElement.style.setProperty("--theme-loaded-primary", themeData.primary);
      return;
    }
    
    // Ansonsten aus localStorage verwenden (Fallback)
    const savedColor = localStorage.getItem("themeColor");
    if (savedColor) {
      setSelectedColor(savedColor);
      setCustomColor(savedColor);
      // Setze die gespeicherte Farbe als CSS-Variable
      document.documentElement.style.setProperty("--theme-primary", savedColor);
      document.documentElement.style.setProperty("--theme-loaded-primary", savedColor);
    }
  }, [themeData]);

  // Funktion zum Anwenden des Farbschemas
  const applyTheme = (color: string) => {
    // Farbe im localStorage speichern (als Fallback)
    localStorage.setItem("themeColor", color);
    
    // CSS-Variable aktualisieren
    document.documentElement.style.setProperty("--theme-primary", color);
    document.documentElement.style.setProperty("--theme-loaded-primary", color);
    
    // Neues Theme-Objekt erstellen und an den Server senden
    const updatedTheme = {
      variant: themeData?.variant || "professional",
      primary: color,
      appearance: themeData?.appearance || "dark",
      radius: themeData?.radius || 0.8
    };
    
    // API-Call zum Update des Themes
    updateThemeMutation.mutate(updatedTheme);
  };

  // Farbe auswählen
  const handleSelectPreset = (color: string) => {
    setSelectedColor(color);
  };

  // Eigene Farbe anwenden
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
            Akzentfarbe anpassen
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="presets" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Voreinstellungen</TabsTrigger>
            <TabsTrigger value="custom">Benutzerdefiniert</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((color) => (
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
              <Label htmlFor="custom-color">Eigene Farbe (HEX-Code)</Label>
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
                  placeholder="#HEX-Code"
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Button variant="outline" onClick={handleApplyCustom}>
                  Anwenden
                </Button>
              </div>
            </div>
            
            <div className="h-12 rounded-md transition-all" style={{ backgroundColor: selectedColor }}>
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-shadow-sm shadow-black">Vorschau</span>
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
            Abbrechen
          </Button>
          <Button 
            onClick={() => applyTheme(selectedColor)}
            className="mt-2 sm:mt-0 w-full sm:w-auto"
            disabled={updateThemeMutation.isPending}
          >
            {updateThemeMutation.isPending ? (
              <>Speichere Einstellungen...</>
            ) : (
              <>Farbe anwenden</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}