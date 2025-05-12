import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, ChevronsUpDown, X, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialDistribution {
  name: string;
  percentage: number;
}

interface Statistics {
  totalSpools: number;
  totalWeight: string;
  remainingWeight: string;
  averageRemaining: number;
  lowStockCount: number;
  materialDistribution: MaterialDistribution[];
  topMaterials: string[];
  topColors: string[];
  estimatedValue: number;
  totalPurchaseValue: number;
  averageAge: number;
  oldestFilament?: {name: string, days: number} | null;
  newestFilament?: {name: string, days: number} | null;
}

interface Manufacturer {
  id: number;
  name: string;
  createdAt: string;
}

interface Color {
  id: number;
  name: string;
  code: string;
  createdAt: string;
}

interface FilterSidebarProps {
  onSearchChange: (search: string) => void;
  onMaterialChange: (materials: string[]) => void;
  onMinRemaining: (value: number) => void;
  onManufacturerChange: (manufacturers: string[]) => void;
  onColorChange: (colors: string[]) => void;
}

export function FilterSidebar({ 
  onSearchChange, 
  onMaterialChange,
  onMinRemaining,
  onManufacturerChange,
  onColorChange
}: FilterSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [minRemaining, setMinRemaining] = useState(0);

  // Laden der Hersteller, Materialien und Farben aus der Datenbank
  const { data: manufacturers = [], isLoading: isLoadingManufacturers } = useQuery({
    queryKey: ['/api/manufacturers'],
    queryFn: () => apiRequest<Manufacturer[]>('/api/manufacturers')
  });

  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['/api/materials'],
    queryFn: () => apiRequest<{id: number, name: string, createdAt: string}[]>('/api/materials')
  });

  const { data: colors = [], isLoading: isLoadingColors } = useQuery({
    queryKey: ['/api/colors'],
    queryFn: () => apiRequest<Color[]>('/api/colors')
  });

  // Update parent component when filters change
  useEffect(() => {
    onSearchChange(searchTerm);
  }, [searchTerm, onSearchChange]);

  useEffect(() => {
    onMaterialChange(selectedMaterials);
  }, [selectedMaterials, onMaterialChange]);

  useEffect(() => {
    onManufacturerChange(selectedManufacturers);
  }, [selectedManufacturers, onManufacturerChange]);

  useEffect(() => {
    onColorChange(selectedColors);
  }, [selectedColors, onColorChange]);

  useEffect(() => {
    onMinRemaining(minRemaining);
  }, [minRemaining, onMinRemaining]);

  // Handle material selection/deselection
  const handleMaterialSelect = (material: string) => {
    setSelectedMaterials(prev => {
      // If already selected, remove it
      if (prev.includes(material)) {
        return prev.filter(m => m !== material);
      }
      // Otherwise add it
      return [...prev, material];
    });
  };

  // Remove a single material from selection
  const removeMaterial = (material: string) => {
    setSelectedMaterials(prev => prev.filter(m => m !== material));
  };

  // Clear all selected materials
  const clearMaterials = () => {
    setSelectedMaterials([]);
  };
  
  // Handle manufacturer selection/deselection
  const handleManufacturerSelect = (manufacturer: string) => {
    setSelectedManufacturers(prev => {
      if (prev.includes(manufacturer)) {
        return prev.filter(m => m !== manufacturer);
      }
      return [...prev, manufacturer];
    });
  };

  // Remove a single manufacturer from selection
  const removeManufacturer = (manufacturer: string) => {
    setSelectedManufacturers(prev => prev.filter(m => m !== manufacturer));
  };

  // Clear all selected manufacturers
  const clearManufacturers = () => {
    setSelectedManufacturers([]);
  };
  
  // Handle color selection/deselection
  const handleColorSelect = (color: string) => {
    setSelectedColors(prev => {
      if (prev.includes(color)) {
        return prev.filter(c => c !== color);
      }
      return [...prev, color];
    });
  };

  // Remove a single color from selection
  const removeColor = (color: string) => {
    setSelectedColors(prev => prev.filter(c => c !== color));
  };

  // Clear all selected colors
  const clearColors = () => {
    setSelectedColors([]);
  };

  return (
    <aside className="lg:w-[28rem] bg-neutral-900 p-4 rounded-lg shadow-sm h-fit lg:sticky lg:top-4 max-h-screen lg:overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-400 mb-3">Filamente suchen</h2>
        <div className="relative">
          <Input
            type="text"
            placeholder="Suche nach Name, Hersteller..."
            className="w-full pl-3 pr-9 py-2 bg-neutral-800 border-neutral-700 text-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute right-3 top-3 text-neutral-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-400 mb-3">Material Filter</h2>
        <div className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
              >
                {selectedMaterials.length === 0 
                  ? "Material hinzufügen"
                  : `${selectedMaterials.length} ausgewählt`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Material suchen..." />
                <CommandEmpty>Kein Material gefunden.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {materials.map((material) => (
                    <CommandItem
                      key={material.id}
                      value={material.name}
                      onSelect={() => handleMaterialSelect(material.name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedMaterials.includes(material.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {material.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {selectedMaterials.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-neutral-400">Ausgewählte Materialien</span>
                <button 
                  className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors" 
                  onClick={clearMaterials}
                >
                  Alle löschen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMaterials.map(material => (
                  <Badge 
                    key={material} 
                    variant="outline" 
                    className="theme-badge flex items-center gap-1 bg-primary/10 text-neutral-200"
                  >
                    {material}
                    <button 
                      onClick={() => removeMaterial(material)}
                      className="hover:text-white ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-400 mb-3">Hersteller Filter</h2>
        <div className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
              >
                {selectedManufacturers.length === 0 
                  ? "Hersteller hinzufügen"
                  : `${selectedManufacturers.length} ausgewählt`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Hersteller suchen..." />
                <CommandEmpty>Kein Hersteller gefunden.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {manufacturers.map((manufacturer) => (
                    <CommandItem
                      key={manufacturer.id}
                      value={manufacturer.name}
                      onSelect={() => handleManufacturerSelect(manufacturer.name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedManufacturers.includes(manufacturer.name) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {manufacturer.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {selectedManufacturers.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-neutral-400">Ausgewählte Hersteller</span>
                <button 
                  className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors" 
                  onClick={clearManufacturers}
                >
                  Alle löschen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedManufacturers.map(manufacturer => (
                  <Badge 
                    key={manufacturer} 
                    variant="outline" 
                    className="theme-badge flex items-center gap-1 bg-primary/10 text-neutral-200"
                  >
                    {manufacturer}
                    <button 
                      onClick={() => removeManufacturer(manufacturer)}
                      className="hover:text-white ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-400 mb-3">Farb Filter</h2>
        <div className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
              >
                {selectedColors.length === 0 
                  ? "Farbe hinzufügen"
                  : `${selectedColors.length} ausgewählt`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Farbe suchen..." />
                <CommandEmpty>Keine Farbe gefunden.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {colors.map((color) => (
                    <CommandItem
                      key={color.id}
                      value={color.name}
                      onSelect={() => handleColorSelect(color.name)}
                    >
                      <div className="flex items-center w-full">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedColors.includes(color.name) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div 
                          className="w-4 h-4 rounded-full mr-2" 
                          style={{ backgroundColor: color.code }}
                        />
                        {color.name}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {selectedColors.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-neutral-400">Ausgewählte Farben</span>
                <button 
                  className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors" 
                  onClick={clearColors}
                >
                  Alle löschen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedColors.map(colorName => {
                  const colorItem = colors.find(c => c.name === colorName);
                  return (
                    <Badge 
                      key={colorName} 
                      variant="outline" 
                      className="theme-badge flex items-center gap-1 bg-primary/10 text-neutral-200"
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-1" 
                        style={{ backgroundColor: colorItem?.code || '#ccc' }}
                      />
                      {colorName}
                      <button 
                        onClick={() => removeColor(colorName)}
                        className="hover:text-white ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium text-neutral-400 mb-3">Bestand</h2>
        <div className="space-y-3">
          <div>
            <span className="text-neutral-400 block mb-1">Max. Restmenge (%)</span>
            <Slider
              value={[minRemaining]}
              min={0}
              max={100}
              step={5}
              onValueChange={(values) => setMinRemaining(values[0])}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-neutral-300 px-1 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <div className="text-xs text-neutral-400 mt-2">
              Nur Filamente mit max. {minRemaining}% Füllstand anzeigen
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
