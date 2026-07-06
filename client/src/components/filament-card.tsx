import { Filament } from "@shared/schema";
import { FilamentSpool } from "@/components/ui/filament-spool";
import { Card } from "@/components/ui/card";
import { Copy, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FilamentCardProps {
  filament: Filament;
  onEdit: (filament: Filament) => void;
  onDelete: (filament: Filament) => void;
  onCopy?: (filament: Filament) => void;
  readOnly?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (filament: Filament) => void;
}

export function FilamentCard({
  filament,
  onEdit,
  onDelete,
  onCopy,
  readOnly = false,
  selectable = false,
  selected = false,
  onSelect
}: FilamentCardProps) {
  const { t } = useTranslation();
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

  // Format temperatures if needed in the future

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect(filament);
    }
  };

  const displayName = filament.name.replace(/\s*\([^)]*\)/g, '');
  const fullName = filament.name;

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        className={`filament-card card-hover dark:bg-neutral-800 bg-white ${selectable ? 'cursor-pointer' : ''} ${selected ? 'ring-2 ring-primary' : ''}`}
        onClick={selectable ? handleCardClick : undefined}
      >
        <div className="p-4 border-b dark:border-neutral-700 border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div className="flex items-center min-w-0 flex-1">
              {selectable && (
                <div className={`mr-2 flex-shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                  <CheckCircle2 size={18} className={selected ? 'opacity-100' : 'opacity-30'} />
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3
                    className="font-medium text-lg dark:text-white text-gray-800 truncate min-w-0 cursor-help"
                  >
                    {displayName}
                  </h3>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                  sideOffset={5}
                  avoidCollisions={true}
                >
                  <p className="whitespace-normal">{fullName}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          {!readOnly && (
            <div className="flex space-x-2 flex-shrink-0 sm:self-start">
              {onCopy && (
                <button
                  className="dark:text-neutral-400 text-gray-500 hover:text-secondary p-1 rounded-full hover:bg-secondary/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(filament);
                  }}
                  title={t('common.copy')}
                  aria-label={t('common.copy')}
                >
                  <Copy size={16} />
                </button>
              )}
              <button
                className="dark:text-neutral-400 text-gray-500 hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(filament);
                }}
                title={t('common.edit')}
                aria-label={t('common.edit')}
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
                className="dark:text-neutral-400 text-gray-500 hover:text-destructive p-1 rounded-full hover:bg-destructive/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(filament);
                }}
                title={t('common.delete')}
                aria-label={t('common.delete')}
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
          )}
        </div>
        <div className="text-sm dark:text-neutral-400 text-gray-500 mt-1 truncate" title={filament.manufacturer || "-"}>{filament.manufacturer || "-"}</div>
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
              <span className="dark:text-neutral-400 text-gray-500 font-medium">{t('filters.remaining')}:</span>
              <span className="font-bold theme-primary">{remainingPercentage}%</span>
            </div>
            <div className="w-full dark:bg-neutral-700 bg-gray-200 rounded-full h-3">
              <div
                className={`${getProgressColor(remainingPercentage)} h-3 rounded-full transition-all duration-300`}
                style={{ width: `${remainingPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-2 dark:text-neutral-300 text-gray-600 font-medium">
              <span>{remainingWeight.toFixed(2)}kg {t('filters.available')}</span>
              <span>{t('filters.of')} {totalWeight}kg {t('filters.total')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 text-sm dark:bg-neutral-900 bg-gray-100 p-3 rounded-lg overflow-hidden">
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.material')}</span>
            {filament.material ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium dark:text-neutral-300 text-gray-700 truncate block cursor-help">
                    {filament.material.replace(/\s*\([^)]*\)/g, '')}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                  sideOffset={5}
                  avoidCollisions={true}
                >
                  <p className="whitespace-normal">{filament.material}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-medium dark:text-neutral-300 text-gray-700">-</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.color')}</span>
            <span className="flex items-center min-w-0">
              <span
                className="inline-block w-4 h-4 rounded-full mr-2 shadow-sm flex-shrink-0"
                style={{
                  backgroundColor: filament.colorCode || "transparent",
                  border: !filament.colorCode || filament.colorCode === "#FFFFFF" || filament.colorCode === "#ffffff"
                    ? "1px solid #E0E0E0"
                    : "none"
                }}
              ></span>
              {filament.colorName ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium dark:text-neutral-300 text-gray-700 truncate min-w-0 cursor-help">
                      {filament.colorName.replace(/\s*\([^)]*\)/g, '')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                    sideOffset={5}
                    avoidCollisions={true}
                  >
                    <p className="whitespace-normal">{filament.colorName}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="font-medium dark:text-neutral-300 text-gray-700">-</span>
              )}
            </span>
          </div>
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.status')}</span>
            {filament.status ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium dark:text-neutral-300 text-gray-700 truncate block cursor-help">
                    {filament.status === 'sealed' ? t('filters.sealed') :
                     filament.status === 'opened' ? t('filters.opened') : '-'}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                  sideOffset={5}
                  avoidCollisions={true}
                >
                  <p className="whitespace-normal">
                    {filament.status === 'sealed' ? t('filters.sealed') :
                     filament.status === 'opened' ? t('filters.opened') : '-'}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-medium dark:text-neutral-300 text-gray-700">-</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.spoolType')}</span>
            {filament.spoolType ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium dark:text-neutral-300 text-gray-700 truncate block cursor-help">
                    {filament.spoolType === 'spooled' ? t('filters.spooled') :
                     filament.spoolType === 'spoolless' ? t('filters.spoolless') : '-'}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                  sideOffset={5}
                  avoidCollisions={true}
                >
                  <p className="whitespace-normal">
                    {filament.spoolType === 'spooled' ? t('filters.spooled') :
                     filament.spoolType === 'spoolless' ? t('filters.spoolless') : '-'}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-medium dark:text-neutral-300 text-gray-700">-</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.dryCount')}</span>
            <span className="font-medium dark:text-neutral-300 text-gray-700 truncate block">{filament.dryerCount || 0}</span>
          </div>
          <div className="min-w-0">
            <span className="dark:text-neutral-400 text-gray-500 block text-xs mb-1">{t('filters.purchaseDate')}</span>
            {filament.purchaseDate ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium dark:text-neutral-300 text-gray-700 truncate block cursor-help">
                    {new Date(filament.purchaseDate).toLocaleDateString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[90vw] sm:max-w-xs break-words dark:bg-neutral-700 dark:text-neutral-200 bg-gray-800 text-white border-gray-600 text-sm p-2 z-[9999]"
                  sideOffset={5}
                  avoidCollisions={true}
                >
                  <p className="whitespace-normal">
                    {new Date(filament.purchaseDate).toLocaleDateString()}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-medium dark:text-neutral-300 text-gray-700">-</span>
            )}
          </div>
        </div>
      </div>
    </Card>
    </TooltipProvider>
  );
}
