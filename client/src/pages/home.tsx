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
import { BatchActionsPanel } from "@/components/batch-actions-panel";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | undefined>(undefined);
  const [copyFromFilament, setCopyFromFilament] = useState<Filament | undefined>(undefined);

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFilaments, setSelectedFilaments] = useState<Filament[]>([]);

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

  // Batch delete filaments
  const batchDeleteFilamentsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest(`/api/filaments/batch`, {
        method: 'DELETE',
        body: JSON.stringify({ ids })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Immediate update with direct browser refresh
      setTimeout(() => {
        refetchFilaments();
      }, 300);

      setSelectedFilaments([]);
      setSelectionMode(false);
      toast({
        title: t('common.success'),
        description: t('batch.deleteSuccess'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: `${t('batch.deleteError')} ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Utility function to update a single filament
  const updateSingleFilament = async (id: number, updates: Record<string, string>): Promise<boolean> => {
    try {
      console.log(`Updating filament ${id} with:`, updates);

      // Create a direct fetch request instead of using apiRequest
      const response = await fetch(`/api/filaments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error updating filament ${id}:`, errorText);
        return false;
      }

      console.log(`Successfully updated filament ${id}`);
      return true;
    } catch (error) {
      console.error(`Error updating filament ${id}:`, error);
      return false;
    }
  };

  // Batch update filaments
  const batchUpdateFilamentsMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: number[], updates: Partial<InsertFilament> }) => {
      console.log("Batch update with IDs:", ids, "and updates:", updates);

      try {
        // Ensure ids is properly formatted as an array of numbers
        const formattedIds = ids.map(id => parseInt(String(id), 10));

        // Clean up updates for API
        const cleanedUpdates: Record<string, string> = {};
        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanedUpdates[key] = String(value);
          }
        });

        console.log("Cleaned updates for API:", cleanedUpdates);

        // Use individual updates for each filament
        let successCount = 0;
        let errorCount = 0;

        // Process each filament update one at a time to avoid race conditions
        for (const id of formattedIds) {
          const success = await updateSingleFilament(id, cleanedUpdates);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        }

        console.log(`Batch update completed: ${successCount} successful, ${errorCount} failed`);

        const response = {
          message: `Successfully updated ${successCount} filaments`,
          updatedCount: successCount,
          errorCount
        };

        return response;
      } catch (error) {
        console.error("Batch update error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Immediate update with direct browser refresh
      setTimeout(() => {
        refetchFilaments();
      }, 300);

      toast({
        title: t('common.success'),
        description: t('batch.updateSuccess'),
      });
    },
    onError: (error: any) => {
      console.error("Batch update mutation error:", error);
      toast({
        title: t('common.error'),
        description: `${t('batch.updateError')} ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

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

  // Batch operation handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedFilaments([]);
  };

  const handleSelectFilament = (filament: Filament) => {
    setSelectedFilaments(prev => {
      const isSelected = prev.some(f => f.id === filament.id);
      if (isSelected) {
        return prev.filter(f => f.id !== filament.id);
      } else {
        return [...prev, filament];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedFilaments.length === filteredFilaments.length) {
      setSelectedFilaments([]);
    } else {
      setSelectedFilaments([...filteredFilaments]);
    }
  };

  const handleBatchDelete = (ids: number[]) => {
    // Ensure all IDs are valid numbers
    const validIds = ids.map(id => Number(id));
    console.log("Batch delete with IDs:", validIds);
    batchDeleteFilamentsMutation.mutate(validIds);
  };

  const handleBatchUpdate = (ids: number[], updates: Partial<Filament> & { _refresh?: boolean, _showToast?: boolean }) => {
    // Check if this is a refresh-only call
    if (updates._refresh) {
      console.log("Refreshing data after batch update");
      // Force refetch of data
      refetchFilaments();
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      // Show success toast notification
      if (updates._showToast) {
        toast({
          title: t('common.success'),
          description: t('batch.updateSuccess'),
        });
      }

      return;
    }

    // Ensure all IDs are valid numbers and not NaN
    const validIds = ids.map(id => {
      const numId = Number(id);
      if (isNaN(numId)) {
        console.error(`Invalid ID detected: ${id} converts to NaN`);
        return 0; // Use a default value that will be filtered out
      }
      return numId;
    }).filter(id => id > 0); // Filter out any invalid IDs

    if (validIds.length === 0) {
      console.error("No valid IDs to update");
      toast({
        title: t('common.error'),
        description: "No valid filaments selected for update",
        variant: "destructive",
      });
      return;
    }

    console.log("Batch update with IDs:", validIds, "and updates:", updates);

    // Create a clean updates object with only the fields we need
    const apiUpdates: Partial<Filament> = {};

    // Only include the fields that are present in the updates object
    if (updates.status !== undefined) apiUpdates.status = updates.status;
    if (updates.storageLocation !== undefined) apiUpdates.storageLocation = updates.storageLocation;
    if (updates.remainingPercentage !== undefined) {
      // Ensure remainingPercentage is a number between 0 and 100
      const percentage = Number(updates.remainingPercentage);
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        // Convert back to string for the API
        apiUpdates.remainingPercentage = String(percentage);
      } else {
        console.error(`Invalid remainingPercentage: ${updates.remainingPercentage}`);
      }
    }
    // Include other fields that might be in the updates object
    if (updates.manufacturer !== undefined) apiUpdates.manufacturer = updates.manufacturer;
    if (updates.material !== undefined) apiUpdates.material = updates.material;
    if (updates.spoolType !== undefined) apiUpdates.spoolType = updates.spoolType;

    console.log("Cleaned updates for API:", apiUpdates);

    batchUpdateFilamentsMutation.mutate({ ids: validIds, updates: apiUpdates });
  };

  const handleBatchExport = (format: 'csv' | 'json') => {
    const ids = selectedFilaments.map(f => f.id).join(',');
    const url = `/api/filaments?export=${format}&ids=${ids}`;
    window.open(url, '_blank');
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
      <Header
        onAddFilament={() => {
          setSelectedFilament(undefined);
          setShowAddModal(true);
        }}
        onToggleSelectionMode={handleToggleSelectionMode}
        selectionMode={selectionMode}
      />

      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar with filters and statistics */}
          <aside className="lg:w-1/4 flex-shrink-0 relative z-0">
            <FilterSidebar
              onSearchChange={handleSearchChange}
              onMaterialChange={handleMaterialChange}
              onMinRemaining={handleMinRemainingChange}
              onManufacturerChange={handleManufacturerChange}
              onColorChange={handleColorChange}
            />
          </aside>

          {/* Main content with chart and filament cards */}
          <div className="lg:w-3/4 flex-grow space-y-6 relative z-10">
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
                  selectable={selectionMode}
                  selectedFilaments={selectedFilaments}
                  onSelectFilament={handleSelectFilament}
                  onSelectAll={handleSelectAll}
                  allSelected={selectedFilaments.length === filteredFilaments.length && filteredFilaments.length > 0}
                  onToggleSelectionMode={handleToggleSelectionMode}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Batch Actions Panel */}
      {selectionMode && selectedFilaments.length > 0 && (
        <BatchActionsPanel
          selectedFilaments={selectedFilaments}
          onClearSelection={() => setSelectedFilaments([])}
          onSelectAll={handleSelectAll}
          allSelected={selectedFilaments.length === filteredFilaments.length && filteredFilaments.length > 0}
          onBatchDelete={handleBatchDelete}
          onBatchUpdate={handleBatchUpdate}
          onBatchExport={handleBatchExport}
          totalFilaments={filteredFilaments.length}
        />
      )}

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
