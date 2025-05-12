import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { FilamentCard } from "@/components/filament-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Search, SlidersHorizontal, X } from "lucide-react";
import { Logo } from "@/components/logo";

type Filament = {
  id: number;
  name: string;
  manufacturer: string;
  material: string;
  colorName: string;
  colorCode: string;
  diameter: string;
  totalWeight: string;
  remainingPercentage: string;
  status: string;
};

export default function PublicFilamentsPage() {
  const { userId } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [remainingRange, setRemainingRange] = useState<[number, number]>([0, 100]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: filaments = [], isLoading, error } = useQuery({
    queryKey: ["public-filaments", userId],
    queryFn: () => apiRequest(`/api/public/filaments/${userId}`),
  });

  const materials = [...new Set(filaments.map((f: Filament) => f.material))].filter(Boolean).sort();
  const manufacturers = [...new Set(filaments.map((f: Filament) => f.manufacturer))].filter(Boolean).sort();

  const filteredFilaments = filaments.filter((filament: Filament) => {
    // Search term filter
    const matchesSearch = searchTerm === "" || 
      filament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (filament.manufacturer && filament.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (filament.material && filament.material.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (filament.colorName && filament.colorName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Material filter
    const matchesMaterial = selectedMaterial === "" || filament.material === selectedMaterial;
    
    // Manufacturer filter
    const matchesManufacturer = selectedManufacturer === "" || filament.manufacturer === selectedManufacturer;
    
    // Remaining percentage filter
    const remaining = parseFloat(filament.remainingPercentage);
    const matchesRemaining = remaining >= remainingRange[0] && remaining <= remainingRange[1];
    
    return matchesSearch && matchesMaterial && matchesManufacturer && matchesRemaining;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedMaterial("");
    setSelectedManufacturer("");
    setRemainingRange([0, 100]);
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="theme-primary-bg text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Button 
              onClick={goBack} 
              variant="outline" 
              size="icon" 
              className="mr-4 bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Logo />
          </div>
          <div>
            <h1 className="text-xl font-bold">Shared Filament Collection</h1>
          </div>
          <div></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">Loading filaments...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-lg text-red-500">Error loading filaments. This collection may not be shared.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search filaments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="md:ml-2"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
              </Button>
              
              {(selectedMaterial || selectedManufacturer || remainingRange[0] > 0 || remainingRange[1] < 100) && (
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="md:ml-2"
                >
                  Reset Filters
                </Button>
              )}
              
              <div className="ml-auto text-sm text-muted-foreground">
                {filteredFilaments.length} filament{filteredFilaments.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {showFilters && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md bg-card">
                <div>
                  <label className="text-sm font-medium mb-1 block">Material</label>
                  <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                    <SelectTrigger>
                      <SelectValue placeholder="All materials" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All materials</SelectItem>
                      {materials.map((material) => (
                        <SelectItem key={material} value={material}>
                          {material}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Manufacturer</label>
                  <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                    <SelectTrigger>
                      <SelectValue placeholder="All manufacturers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All manufacturers</SelectItem>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer} value={manufacturer}>
                          {manufacturer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Remaining: {remainingRange[0]}% - {remainingRange[1]}%
                  </label>
                  <Slider
                    value={remainingRange}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(value) => setRemainingRange(value as [number, number])}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
            
            {filteredFilaments.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-lg text-muted-foreground">No filaments found matching your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFilaments.map((filament: Filament) => (
                  <FilamentCard
                    key={filament.id}
                    filament={filament}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    readOnly={true}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
