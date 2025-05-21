import { useState, useEffect } from "react";
import { Filament } from "@shared/schema";
import { FilamentCard } from "./filament-card";
import { FilamentTable } from "./filament-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "@/i18n";

interface FilamentGridProps {
  filaments: Filament[];
  onEditFilament: (filament: Filament) => void;
  onDeleteFilament: (filament: Filament) => void;
  onCopyFilament?: (filament: Filament) => void;
  selectable?: boolean;
  selectedFilaments?: Filament[];
  onSelectFilament?: (filament: Filament) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  onToggleSelectionMode?: () => void;
}

type SortOption = "nameAsc" | "nameDesc" | "remainingAsc" | "remainingDesc";

export function FilamentGrid({
  filaments,
  onEditFilament,
  onDeleteFilament,
  onCopyFilament,
  selectable = false,
  selectedFilaments = [],
  onSelectFilament,
  onSelectAll,
  allSelected = false,
  onToggleSelectionMode
}: FilamentGridProps) {
  const { t } = useTranslation();
  const [sortOrder, setSortOrder] = useState<SortOption>("nameAsc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Load view preference from localStorage on component mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem("filadex-view-mode");
    if (savedViewMode === "grid" || savedViewMode === "table") {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("filadex-view-mode", viewMode);
  }, [viewMode]);

  // Sort filaments based on selected order
  const sortedFilaments = [...filaments].sort((a, b) => {
    switch (sortOrder) {
      case "nameAsc":
        return a.name.localeCompare(b.name);
      case "nameDesc":
        return b.name.localeCompare(a.name);
      case "remainingAsc":
        return Number(a.remainingPercentage) - Number(b.remainingPercentage);
      case "remainingDesc":
        return Number(b.remainingPercentage) - Number(a.remainingPercentage);
      default:
        return 0;
    }
  });

  return (
    <section className="lg:w-4/4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-neutral-400">{t('filaments.inventory')}</h2>
        <div className="flex items-center space-x-3">
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOption)}
          >
            <SelectTrigger className="border border-neutral-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary text-neutral-400 w-[200px]">
              <SelectValue placeholder={t('filters.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nameAsc">{t('filters.nameAZ')}</SelectItem>
              <SelectItem value="nameDesc">{t('filters.nameZA')}</SelectItem>
              <SelectItem value="remainingAsc">{t('filters.fillLevelLowHigh')}</SelectItem>
              <SelectItem value="remainingDesc">{t('filters.fillLevelHighLow')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            {/* Selection Mode Toggle */}
            {onSelectFilament && onSelectAll && (
              <Button
                onClick={onToggleSelectionMode}
                variant="outline"
                size="sm"
                className={`${selectable
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                } flex items-center gap-1 mr-1`}
              >
                {selectable ? (
                  <CheckSquare className="h-4 w-4 mr-1" />
                ) : (
                  <Square className="h-4 w-4 mr-1" />
                )}
                {t('batch.selectionMode')}
              </Button>
            )}

            <div className="flex items-center space-x-1">
              <button
                className={`p-1.5 rounded-md hover:bg-neutral-200 ${viewMode === "grid" ? "bg-neutral-200" : ""}`}
                onClick={() => setViewMode("grid")}
                title={t('filaments.gridView')}
              >
                <LayoutGrid className="text-neutral-400 h-5 w-5" />
              </button>
              <button
                className={`p-1.5 rounded-md hover:bg-neutral-200 ${viewMode === "table" ? "bg-neutral-200" : ""}`}
                onClick={() => setViewMode("table")}
                title={t('filaments.tableView')}
              >
                <List className="text-neutral-400 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
          {sortedFilaments.map((filament) => (
            <FilamentCard
              key={filament.id}
              filament={filament}
              onEdit={onEditFilament}
              onDelete={onDeleteFilament}
              onCopy={onCopyFilament}
              selectable={selectable}
              selected={selectedFilaments.some(f => f.id === filament.id)}
              onSelect={onSelectFilament}
            />
          ))}

          {sortedFilaments.length === 0 && (
            <div className="col-span-full p-8 text-center text-neutral-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <p className="text-lg font-medium">{t('filaments.noFilaments')}</p>
              <p className="mt-1">{t('filaments.addFirstFilament')}</p>
            </div>
          )}
        </div>
      ) : (
        <FilamentTable
          filaments={sortedFilaments}
          onEditFilament={onEditFilament}
          onDeleteFilament={onDeleteFilament}
          onCopyFilament={onCopyFilament}
          selectable={selectable}
          selectedFilaments={selectedFilaments}
          onSelectFilament={onSelectFilament}
          onSelectAll={onSelectAll}
          allSelected={allSelected}
        />
      )}
    </section>
  );
}
