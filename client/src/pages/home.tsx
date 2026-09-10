import { useState, useCallback, useMemo, useEffect } from "react";
import Fuse from "fuse.js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Filament, InsertFilament, CommunityCatalogItem } from "@shared/schema";
import { getFilamentSearchMatchIds } from "@/lib/filament-search";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { FilterSidebar } from "@/components/filter-sidebar";
import { FilamentGrid } from "@/components/filament-grid";
import { FilamentModal } from "@/components/filament-modal";
import { DeleteModal } from "@/components/delete-modal";
import { LabelPrintModal } from "@/components/label-print-modal";
import { MaterialColorChart } from "@/components/material-color-chart";
import { StatisticsAccordion } from "@/components/statistics";
import { BatchActionsPanel } from "@/components/batch-actions-panel";
import { QRScanner } from "@/components/qr-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | undefined>(undefined);
  const [copyFromFilament, setCopyFromFilament] = useState<Filament | undefined>(undefined);
  const [labelFilament, setLabelFilament] = useState<Filament | undefined>(undefined);
  const [showScanner, setShowScanner] = useState(false);
  const [variantCandidates, setVariantCandidates] = useState<CommunityCatalogItem[] | null>(null);
  const [variantCandidateBarcode, setVariantCandidateBarcode] = useState<string>("");

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
  const { data: filaments = [], isLoading } = useQuery<Filament[]>({
    queryKey: ['/api/filaments'],
    staleTime: 0, // Daten immer als veraltet betrachten, um Auto-Refresh zu unterstützen
    refetchOnMount: true, // Bei Mounten immer neu laden
  });

  // Fuzzy search across name/manufacturer/material/color/barcode, rebuilt only when the list changes
  const fuse = useMemo(() => new Fuse(filaments, {
    keys: ['name', 'manufacturer', 'material', 'colorName', 'barcode'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [filaments]);

  const searchMatchIds = useMemo(() => {
    return getFilamentSearchMatchIds(filaments, searchTerm, fuse);
  }, [fuse, filaments, searchTerm]);

  // Filter filaments based on all filters
  const filteredFilaments = filaments.filter(filament => {
    // Filter by search term (fuzzy match across name/manufacturer/material/color)
    const matchesSearch = searchMatchIds === null || searchMatchIds.has(filament.id);

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
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });

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
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });

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
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

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
    if (selectedFilament) {
      updateFilamentMutation.mutate({
        id: selectedFilament.id,
        filament: formData
      });
    } else {
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

  // Batch update filaments
  const batchUpdateFilamentsMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: number[], updates: Partial<InsertFilament> }) => {
      return apiRequest(`/api/filaments/batch`, {
        method: 'PATCH',
        body: JSON.stringify({ ids, updates })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/filaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });

      toast({
        title: t('common.success'),
        description: t('batch.updateSuccess'),
      });
    },
    onError: (error: any) => {
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

  // Open the printable label modal for the selected filament
  const handlePrintLabel = (filament: Filament) => {
    setLabelFilament(filament);
  };

  // Deep link from a scanned label QR code (see label-print-modal.tsx):
  // ?openFilament=<id> opens that spool's edit modal directly.
  useEffect(() => {
    if (filaments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const openFilamentId = params.get('openFilament');
    if (!openFilamentId) return;

    const filament = filaments.find(f => f.id === Number(openFilamentId));
    if (filament) {
      handleEditFilament(filament);
    }
    params.delete('openFilament');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }, [filaments]);

  const applyCommunityItem = (result: CommunityCatalogItem, code: string) => {
    const mfgText = result.manufacturer ? ` (${result.manufacturer})` : '';
    const cleanName = result.colorName && result.name.toLowerCase().includes(result.colorName.toLowerCase())
      ? result.name
      : `${result.name} ${result.colorName || ''}`.trim();
    const kg = result.weightGrams ? Number((result.weightGrams / 1000).toFixed(2)) : 1;
    setSelectedFilament(undefined);
    setCopyFromFilament({
      id: 0,
      name: `${cleanName}${mfgText}`.trim(),
      manufacturer: result.manufacturer || "",
      material: result.material || "",
      colorName: result.colorName || "",
      colorCode: result.colorCode || "#000000",
      diameter: result.diameter ? String(result.diameter) : "1.75",
      printTemp: result.extruderTemp ? (result.bedTemp ? `${result.extruderTemp}°C / Bed ${result.bedTemp}°C` : `${result.extruderTemp}°C`) : "",
      barcode: result.gtin || code,
      spoolType: result.spoolRefill ? "spoolless" : "spooled",
      totalWeight: String(kg),
      remainingPercentage: "100",
      status: "sealed",
      dryerCount: 0,
      userId: 0,
      purchaseDate: null,
      purchasePrice: null,
      storageLocation: null,
      lastDryingDate: null,
      customFieldValues: null,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as unknown as Filament);
    setShowAddModal(true);
    toast({
      title: t('scanner.foundInOfd', { name: `${result.manufacturer} - ${result.name}` }),
    });
  };

  const handleBarcodeScanned = async (decodedText: string) => {
    setShowScanner(false);

    // Case 0: Filadex URL (e.g. printed label with ?openFilament=123)
    const openFilamentMatch = decodedText.match(/[?&]openFilament=(\d+)/);
    if (openFilamentMatch) {
      const filamentId = Number(openFilamentMatch[1]);
      const match = filaments.find(f => f.id === filamentId);
      if (match) {
        handleEditFilament(match);
        return;
      }
      try {
        const fetched = await apiRequest<Filament>(`/api/filaments/${filamentId}`);
        if (fetched) {
          handleEditFilament(fetched);
          return;
        }
      } catch (err: any) {
        if (err?.status !== 404) {
          toast({
            variant: "destructive",
            title: t('common.error') || 'Error',
            description: err?.message || 'Failed to open filament',
          });
          return;
        }
      }
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(decodedText);
    } catch {
      // raw barcode string
    }

    // Case 1: Structured QR code (Bambu Lab barcode/QR, Filadex QR)
    if (parsed && typeof parsed === "object" && (parsed.name || parsed.material)) {
      const matchName = parsed.name?.toLowerCase();
      const matchBarcode = parsed.barcode?.toLowerCase();
      const matchingSpool = filaments.find(
        (f) => (matchBarcode && f.barcode && f.barcode.toLowerCase() === matchBarcode) ||
               (matchName && f.name && f.name.toLowerCase() === matchName)
      );

      if (matchingSpool) {
        setSearchTerm(matchingSpool.name);
        toast({
          title: matchingSpool.name,
          description: matchingSpool.manufacturer ? `${matchingSpool.manufacturer} • ${matchingSpool.material}` : matchingSpool.material,
        });
        return;
      }

      // Pre-fill Add modal with decoded structured filament data
      setSelectedFilament(undefined);
      setCopyFromFilament({
        id: 0,
        name: parsed.name || "",
        manufacturer: parsed.manufacturer || "",
        material: parsed.material || "",
        colorName: parsed.colorName || "",
        colorCode: parsed.colorCode || "#000000",
        diameter: parsed.diameter ? String(parsed.diameter) : "1.75",
        printTemp: parsed.printTemp || "",
        barcode: parsed.barcode || "",
        spoolType: parsed.spoolType || "spooled",
        totalWeight: parsed.totalWeight ? String(parsed.totalWeight) : "1",
        remainingPercentage: "100",
        status: "sealed",
        dryerCount: 0,
        userId: 0,
        purchaseDate: null,
        purchasePrice: null,
        storageLocation: null,
        lastDryingDate: null,
        customFieldValues: null,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      } as unknown as Filament);
      setShowAddModal(true);
      toast({
        title: parsed.name,
        description: parsed.manufacturer ? `${parsed.manufacturer} • ${parsed.material}` : parsed.material,
      });
      return;
    }

    // Case 2: Raw 1D/2D barcode
    const code = (parsed && typeof parsed === "object" && parsed.barcode ? parsed.barcode : decodedText).trim();

    // Check if matching spool exists in current collection (supporting zero-padded GTINs)
    const normCode = code.replace(/^0+/, "");
    const matchingSpool = filaments.find((f) => {
      if (!f.barcode) return false;
      const normBarcode = f.barcode.trim().replace(/^0+/, "");
      return (normCode && normBarcode === normCode) || f.barcode.toLowerCase() === code.toLowerCase();
    });

    if (matchingSpool) {
      setSearchTerm(matchingSpool.barcode || matchingSpool.name);
      toast({
        title: matchingSpool.name,
        description: matchingSpool.manufacturer ? `${matchingSpool.manufacturer} • ${matchingSpool.material}` : matchingSpool.material,
      });
      return;
    }

    // Query OFD GTIN lookup
    try {
      const result = await apiRequest<CommunityCatalogItem | null>(
        `/api/community-filaments/gtin/${encodeURIComponent(code)}`
      );
      if (result) {
        if (result.candidates && result.candidates.length > 1) {
          setVariantCandidateBarcode(code);
          setVariantCandidates(result.candidates);
          return;
        }
        applyCommunityItem(result, code);
        return;
      }
    } catch (err: any) {
      if (err?.status !== 404) {
        toast({
          variant: "destructive",
          title: t('common.error') || 'Error',
          description: t('scanner.lookupError', { code }) || err?.message || 'Failed to search community catalog',
        });
        return;
      }
      // Not found in OFD
    }

    // Not found anywhere -> open add modal prefilled with barcode
    setSelectedFilament(undefined);
    setCopyFromFilament({
      id: 0,
      name: "",
      manufacturer: "",
      material: "",
      colorName: "",
      colorCode: "#000000",
      diameter: "1.75",
      printTemp: "",
      barcode: code,
      totalWeight: "1",
      remainingPercentage: "100",
      status: "sealed",
      dryerCount: 0,
      userId: 0,
      purchaseDate: null,
      purchasePrice: null,
      storageLocation: null,
      lastDryingDate: null,
      customFieldValues: null,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as unknown as Filament);
    setShowAddModal(true);
    toast({
      variant: "destructive",
      title: t('scanner.notFoundAllSources', { code }),
    });
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
    const validIds = ids.map(id => Number(id));
    batchDeleteFilamentsMutation.mutate(validIds);
  };

  const handleBatchUpdate = (ids: number[], updates: Partial<Filament>) => {
    const validIds = ids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      toast({
        title: t('common.error'),
        description: t('batch.noValidFilamentsSelected'),
        variant: "destructive",
      });
      return;
    }

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
      }
    }
    // Include other fields that might be in the updates object
    if (updates.manufacturer !== undefined) apiUpdates.manufacturer = updates.manufacturer;
    if (updates.material !== undefined) apiUpdates.material = updates.material;
    if (updates.spoolType !== undefined) apiUpdates.spoolType = updates.spoolType;

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
              filaments={filaments}
              searchTerm={searchTerm}
              onScanClick={() => setShowScanner(true)}
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
                  onPrintLabel={handlePrintLabel}
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

      {/* Label Print Modal */}
      <LabelPrintModal
        isOpen={!!labelFilament}
        onClose={() => setLabelFilament(undefined)}
        filament={labelFilament}
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

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScanSuccess={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Multi-variant Candidate Selection Dialog */}
      {variantCandidates && (
        <Dialog open={true} onOpenChange={() => setVariantCandidates(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('scanner.multipleMatchesTitle')}</DialogTitle>
              <DialogDescription>
                {t('scanner.multipleMatchesDescription', { code: variantCandidateBarcode })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {variantCandidates.map((candidate) => {
                const colorCode = candidate.colorCode || "#888888";
                const spoolTypeText = candidate.spoolRefill ? (t('filaments.spoolless') || 'Refill') : (t('filaments.spooled') || 'Spooled');
                const weightText = candidate.weightGrams ? `${(candidate.weightGrams / 1000).toFixed(1)}kg` : '';
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      applyCommunityItem(candidate, variantCandidateBarcode);
                      setVariantCandidates(null);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-primary hover:bg-neutral-50 dark:hover:bg-neutral-800 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-600 flex-shrink-0"
                        style={{ backgroundColor: colorCode }}
                      />
                      <div>
                        <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                          {candidate.name} {candidate.colorName ? `(${candidate.colorName})` : ''}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {candidate.manufacturer} • {candidate.material}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-neutral-500 dark:text-neutral-400 flex flex-col items-end">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">{spoolTypeText}</span>
                      {weightText && <span>{weightText}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVariantCandidates(null)}>
                {t('common.close') || 'Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>

  );
}
