import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Filament, InsertFilament } from "@shared/schema";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FilterSidebar } from "@/components/filter-sidebar";
import { FilamentGrid } from "@/components/filament-grid";
import { FilamentModal } from "@/components/filament-modal";
import { DeleteModal } from "@/components/delete-modal";
import { MaterialColorChart } from "@/components/material-color-chart";
import { StatisticsAccordion } from "@/components/statistics";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | undefined>(undefined);
  const [copyFromFilament, setCopyFromFilament] = useState<Filament | undefined>(undefined);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [minRemainingPercentage, setMinRemainingPercentage] = useState(0);

  // Fetch filaments with auto-refresh
  const { data: filaments = [], isLoading, refetch: refetchFilaments } = useQuery<Filament[]>({
    queryKey: ['/api/filaments'],
    staleTime: 0, // Daten immer als veraltet betrachten, um Auto-Refresh zu unterstützen
    refetchOnMount: true, // Bei Mounten immer neu laden
  });

  // Filter filaments based on all filters
  const filteredFilaments = filaments.filter(filament => {
    // Filter by search term
    const matchesSearch = searchTerm.trim() === '' ||
      filament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (filament.manufacturer && filament.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter by material
    const matchesMaterial = selectedMaterials.length === 0 ||
      selectedMaterials.includes(filament.material);

    // Filter by manufacturer
    const matchesManufacturer = selectedManufacturers.length === 0 ||
      (filament.manufacturer && selectedManufacturers.includes(filament.manufacturer));

    // Filter by color
    const matchesColor = selectedColors.length === 0 ||
      (filament.colorName && selectedColors.includes(filament.colorName));

    // Filter by remaining percentage (umgedreht: zeige nur Filamente mit höchstens diesem Prozentsatz)
    const matchesRemaining = minRemainingPercentage === 0 ||
      Number(filament.remainingPercentage) <= minRemainingPercentage;

    return matchesSearch && matchesMaterial && matchesManufacturer && matchesColor && matchesRemaining;
  });

  // Add a new filament
  const createFilamentMutation = useMutation({
    mutationFn: async (newFilament: InsertFilament) => {
      return apiRequest('/api/filaments', {
        method: 'POST',
        body: JSON.stringify(newFilament)
      });
    },
    onSuccess: () => {
      // Direkt aktualisieren, um die Verzögerung zu vermeiden
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Sofortiges Update mit direktem Browser-Refresh
      setTimeout(() => {
        refetchFilaments();
        window.location.reload(); // Füge einen vollen Seitenrefresh hinzu, falls der Refetch nicht ausreicht
      }, 300);

      setShowAddModal(false);
      toast({
        title: t('common.success'),
        description: t('filaments.addSuccess'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: `${t('filaments.addError')} ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update an existing filament
  const updateFilamentMutation = useMutation({
    mutationFn: async ({ id, filament }: { id: number; filament: Partial<InsertFilament> }) => {
      return apiRequest(`/api/filaments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(filament)
      });
    },
    onSuccess: () => {
      // Direkt aktualisieren, um die Verzögerung zu vermeiden
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Sofortiges Update mit direktem Browser-Refresh
      setTimeout(() => {
        refetchFilaments();
        window.location.reload(); // Füge einen vollen Seitenrefresh hinzu, falls der Refetch nicht ausreicht
      }, 300);

      setShowAddModal(false);
      setSelectedFilament(undefined);
      toast({
        title: t('common.success'),
        description: t('filaments.updateSuccess'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: `${t('filaments.updateError')} ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete a filament
  const deleteFilamentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/filaments/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Direkt aktualisieren, um die Verzögerung zu vermeiden
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Sofortiges Update mit direktem Browser-Refresh
      setTimeout(() => {
        refetchFilaments();
        window.location.reload(); // Füge einen vollen Seitenrefresh hinzu, falls der Refetch nicht ausreicht
      }, 300);

      setShowDeleteModal(false);
      setSelectedFilament(undefined);
      toast({
        title: t('common.success'),
        description: t('filaments.deleteSuccess'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: `${t('filaments.deleteError')} ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handler for adding/editing filament
  const handleSaveFilament = (formData: any) => {
    console.log("Saving filament:", formData);
    if (selectedFilament) {
      // Update existing filament
      console.log("Updating existing filament ID:", selectedFilament.id);
      updateFilamentMutation.mutate({
        id: selectedFilament.id,
        filament: formData
      });
    } else {
      // Create new filament
      console.log("Creating new filament with data:", formData);
      createFilamentMutation.mutate(formData);
    }
  };

  // Handler for confirming deletion
  const handleConfirmDelete = () => {
    if (selectedFilament) {
      deleteFilamentMutation.mutate(selectedFilament.id);
    }
  };

  // Open edit modal with selected filament
  const handleEditFilament = (filament: Filament) => {
    setSelectedFilament(filament);
    setCopyFromFilament(undefined);
    setShowAddModal(true);
  };

  // Open delete confirmation modal with selected filament
  const handleDeleteFilament = (filament: Filament) => {
    setSelectedFilament(filament);
    setShowDeleteModal(true);
  };

  // Open add modal with values copied from selected filament
  const handleCopyFilament = (filament: Filament) => {
    setSelectedFilament(undefined);
    setCopyFromFilament(filament);
    setShowAddModal(true);
  };

  // Filter handlers
  const handleSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
  }, []);

  const handleMaterialChange = useCallback((materials: string[]) => {
    setSelectedMaterials(materials);
  }, []);

  const handleMinRemainingChange = useCallback((value: number) => {
    setMinRemainingPercentage(value);
  }, []);

  const handleManufacturerChange = useCallback((manufacturers: string[]) => {
    setSelectedManufacturers(manufacturers);
  }, []);

  const handleColorChange = useCallback((colors: string[]) => {
    setSelectedColors(colors);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Add Filament button */}
      <Header onAddFilament={() => {
        setSelectedFilament(undefined);
        setShowAddModal(true);
      }} />

      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar with filters and statistics */}
          <FilterSidebar
            onSearchChange={handleSearchChange}
            onMaterialChange={handleMaterialChange}
            onMinRemaining={handleMinRemainingChange}
            onManufacturerChange={handleManufacturerChange}
            onColorChange={handleColorChange}
          />

          {/* Main content with chart and filament cards */}
          <div className="lg:w-4/4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-t-2 border-primary rounded-full mx-auto mb-4"></div>
                  <p className="text-neutral-400">{t('filaments.loadingFilaments')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Material and Color Chart */}
                <div className="dark:bg-neutral-800 light:bg-white p-4 rounded-lg shadow-md">
                  <MaterialColorChart filaments={filaments} />
                </div>

                {/* Statistics Accordion */}
                <StatisticsAccordion />

                {/* Filament Grid */}
                <FilamentGrid
                  filaments={filteredFilaments}
                  onEditFilament={handleEditFilament}
                  onDeleteFilament={handleDeleteFilament}
                  onCopyFilament={handleCopyFilament}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Add/Edit Filament Modal */}
      <FilamentModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedFilament(undefined);
          setCopyFromFilament(undefined);
        }}
        onSave={handleSaveFilament}
        filament={selectedFilament || copyFromFilament}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedFilament(undefined);
        }}
        onConfirm={handleConfirmDelete}
        filament={selectedFilament}
      />
    </div>
  );
}
