import { useState } from "react";
import { Filament } from "@shared/schema";
import { FilamentCard } from "./filament-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/i18n";

interface FilamentGridProps {
  filaments: Filament[];
  onEditFilament: (filament: Filament) => void;
  onDeleteFilament: (filament: Filament) => void;
  onCopyFilament?: (filament: Filament) => void;
}

type SortOption = "nameAsc" | "nameDesc" | "remainingAsc" | "remainingDesc";

export function FilamentGrid({
  filaments,
  onEditFilament,
  onDeleteFilament,
  onCopyFilament
}: FilamentGridProps) {
  const { t } = useTranslation();
  const [sortOrder, setSortOrder] = useState<SortOption>("nameAsc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

          <div className="flex items-center space-x-1">
            <button
              className={`p-1.5 rounded-md hover:bg-neutral-200 ${viewMode === "grid" ? "bg-neutral-200" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
            <button
              className={`p-1.5 rounded-md hover:bg-neutral-200 ${viewMode === "list" ? "bg-neutral-200" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400"
              >
                <line x1="8" x2="21" y1="6" y2="6" />
                <line x1="8" x2="21" y1="12" y2="12" />
                <line x1="8" x2="21" y1="18" y2="18" />
                <line x1="3" x2="3.01" y1="6" y2="6" />
                <line x1="3" x2="3.01" y1="12" y2="12" />
                <line x1="3" x2="3.01" y1="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4"
            : "grid grid-cols-1 gap-4"
        }
      >
        {sortedFilaments.map((filament) => (
          <FilamentCard
            key={filament.id}
            filament={filament}
            onEdit={onEditFilament}
            onDelete={onDeleteFilament}
            onCopy={onCopyFilament}
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
    </section>
  );
}
