import { Filament } from "@shared/schema";
import { FilamentSpool } from "@/components/ui/filament-spool";
import { Card } from "@/components/ui/card";
import { Copy } from "lucide-react";

interface FilamentCardProps {
  filament: Filament;
  onEdit: (filament: Filament) => void;
  onDelete: (filament: Filament) => void;
  onCopy?: (filament: Filament) => void;
}

export function FilamentCard({ filament, onEdit, onDelete, onCopy }: FilamentCardProps) {
  // Calculate the remaining weight
  const totalWeight = Number(filament.totalWeight);
  const remainingPercentage = Number(filament.remainingPercentage);
  const remainingWeight = (totalWeight * remainingPercentage) / 100;
  
  // Determine color for the progress bar
  const getProgressColor = (percentage: number) => {
    if (percentage <= 15) return "bg-red-500";
    if (percentage <= 30) return "bg-amber-500";
    return "bg-green-500";
  };
  
  // Format temperatures
  const printTemp = filament.printTemp || "N/A";
  
  return (
    <Card className="filament-card card-hover bg-neutral-800">
      <div className="p-4 border-b border-neutral-700">
        <div className="flex justify-between items-start">
          <h3 
            className="font-medium text-lg text-white truncate" 
            title={filament.name}
          >
            {filament.name.replace(/\s*\([^)]*\)/g, '')}
          </h3>
          <div className="flex space-x-2">
            {onCopy && (
              <button 
                className="text-neutral-400 hover:text-secondary p-1 rounded-full hover:bg-secondary/10 transition-colors"
                onClick={() => onCopy(filament)}
                title="Kopieren"
              >
                <Copy size={16} />
              </button>
            )}
            <button 
              className="text-neutral-400 hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors"
              onClick={() => onEdit(filament)}
              title="Bearbeiten"
            >
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
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button 
              className="text-neutral-400 hover:text-error p-1 rounded-full hover:bg-error/10 transition-colors"
              onClick={() => onDelete(filament)}
              title="Löschen"
            >
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
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-sm text-neutral-400 mt-1">{filament.manufacturer || "-"}</div>
      </div>
      
      <div className="p-4">
        <div className="flex mb-4 items-center">
          <FilamentSpool 
            color={filament.colorCode || "#000000"} 
            percentage={100} // Immer volle Spule anzeigen (100%)
            className="mr-4"
            size={60}
            showFillLevel={false}
          />
          <div className="flex-grow">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-400 font-medium">Restmenge:</span>
              <span className="font-bold theme-primary">{remainingPercentage}%</span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-3">
              <div 
                className={`${getProgressColor(remainingPercentage)} h-3 rounded-full transition-all duration-300`} 
                style={{ width: `${remainingPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-2 text-neutral-300 font-medium">
              <span>{remainingWeight.toFixed(2)}kg verfügbar</span>
              <span>von {totalWeight}kg gesamt</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-sm bg-neutral-900 p-3 rounded-lg">
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Material</span>
            <span className="font-medium text-neutral-300" title={filament.material}>
              {filament.material ? filament.material.replace(/\s*\([^)]*\)/g, '') : '-'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Farbe</span>
            <span className="flex items-center">
              <span 
                className="inline-block w-4 h-4 rounded-full mr-2 shadow-sm" 
                style={{ 
                  backgroundColor: filament.colorCode || "transparent",
                  border: !filament.colorCode || filament.colorCode === "#FFFFFF" || filament.colorCode === "#ffffff" 
                    ? "1px solid #E0E0E0" 
                    : "none"
                }}
              ></span>
              <span className="font-medium text-neutral-300" title={filament.colorName}>
                {filament.colorName ? filament.colorName.replace(/\s*\([^)]*\)/g, '') : '-'}
              </span>
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Verpackung</span>
            <span className="font-medium text-neutral-300">
              {filament.status === 'sealed' ? 'Versiegelt' : 
               filament.status === 'opened' ? 'Geöffnet' : '-'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Rollentyp</span>
            <span className="font-medium text-neutral-300">
              {filament.spoolType === 'spooled' ? 'Spule' : 
               filament.spoolType === 'spoolless' ? 'Spulenlos' : '-'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Trockn.</span>
            <span className="font-medium text-neutral-300">{filament.dryerCount || 0}</span>
          </div>
          <div>
            <span className="text-neutral-400 block text-xs mb-1">Kaufdatum</span>
            <span className="font-medium text-neutral-300">
              {filament.purchaseDate 
                ? new Date(filament.purchaseDate).toLocaleDateString('de-DE') 
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
