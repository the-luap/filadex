import { useState } from "react";
import { Filament } from "@shared/schema";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FilamentSpool } from "@/components/ui/filament-spool";
import { Copy, ArrowUp, ArrowDown, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";

interface FilamentTableProps {
  filaments: Filament[];
  onEditFilament: (filament: Filament) => void;
  onDeleteFilament: (filament: Filament) => void;
  onCopyFilament?: (filament: Filament) => void;
  selectable?: boolean;
  selectedFilaments?: Filament[];
  onSelectFilament?: (filament: Filament) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
}

type SortColumn = "name" | "manufacturer" | "material" | "colorName" | "remainingPercentage" | "purchaseDate";
type SortDirection = "asc" | "desc";

export function FilamentTable({
  filaments,
  onEditFilament,
  onDeleteFilament,
  onCopyFilament,
  selectable = false,
  selectedFilaments = [],
  onSelectFilament,
  onSelectAll,
  allSelected = false
}: FilamentTableProps) {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Function to handle column sorting
  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      // Toggle direction if same column is clicked
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Sort filaments based on selected column and direction
  const sortedFilaments = [...filaments].sort((a, b) => {
    let valueA: any;
    let valueB: any;

    // Extract values based on sort column
    switch (sortColumn) {
      case "name":
        valueA = a.name;
        valueB = b.name;
        break;
      case "manufacturer":
        valueA = a.manufacturer || "";
        valueB = b.manufacturer || "";
        break;
      case "material":
        valueA = a.material || "";
        valueB = b.material || "";
        break;
      case "colorName":
        valueA = a.colorName || "";
        valueB = b.colorName || "";
        break;
      case "remainingPercentage":
        valueA = Number(a.remainingPercentage);
        valueB = Number(b.remainingPercentage);
        break;
      case "purchaseDate":
        valueA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        valueB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        break;
      default:
        valueA = a.name;
        valueB = b.name;
    }

    // Compare values based on direction
    if (valueA < valueB) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Determine color for the progress bar
  const getProgressColor = (percentage: number) => {
    if (percentage <= 15) return "bg-red-500";
    if (percentage <= 30) return "bg-amber-500";
    return "bg-green-500";
  };

  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (column !== sortColumn) return null;

    return sortDirection === "asc" ?
      <ArrowUp className="inline ml-1 h-4 w-4" /> :
      <ArrowDown className="inline ml-1 h-4 w-4" />;
  };

  return (
    <div className="w-full overflow-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {selectable && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label={t('batch.selectAll')}
                />
              </TableHead>
            )}
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("name")}
            >
              {t('filaments.name')} {renderSortIndicator("name")}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("manufacturer")}
            >
              {t('filters.manufacturerFilter')} {renderSortIndicator("manufacturer")}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("material")}
            >
              {t('filters.material')} {renderSortIndicator("material")}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("colorName")}
            >
              {t('filters.color')} {renderSortIndicator("colorName")}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("remainingPercentage")}
            >
              {t('filters.remaining')} {renderSortIndicator("remainingPercentage")}
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("purchaseDate")}
            >
              {t('filters.purchaseDate')} {renderSortIndicator("purchaseDate")}
            </TableHead>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFilaments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectable ? 8 : 7} className="text-center py-8 text-neutral-400">
                <div className="flex flex-col items-center">
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
              </TableCell>
            </TableRow>
          ) : (
            sortedFilaments.map((filament) => {
              const isSelected = selectedFilaments.some(f => f.id === filament.id);
              return (
                <TableRow
                  key={filament.id}
                  className={`hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  {selectable && (
                    <TableCell className="w-[40px]">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onSelectFilament && onSelectFilament(filament)}
                        aria-label={t('batch.selectItem')}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{filament.name}</TableCell>
                <TableCell>{filament.manufacturer || "-"}</TableCell>
                <TableCell>{filament.material || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: filament.colorCode || "#ccc" }}
                    />
                    {filament.colorName || "-"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div className="w-full max-w-[100px] mr-2">
                      <div className="w-full dark:bg-neutral-700 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${getProgressColor(Number(filament.remainingPercentage))} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${filament.remainingPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span>{filament.remainingPercentage}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {filament.purchaseDate
                    ? new Date(filament.purchaseDate).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    {onCopyFilament && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCopyFilament(filament)}
                        title={t('common.copy')}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditFilament(filament)}
                      title={t('common.edit')}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteFilament(filament)}
                      title={t('common.delete')}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
