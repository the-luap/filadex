import React, { useMemo } from "react";
import type { CommunityCatalogItem } from "@shared/schema";
import { badgeVariants } from "@/components/ui/badge";
import { Barcode } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  formatWeightGrams,
  formatDiameter,
  formatPrintTemps,
  mergeCatalogItems,
} from "@/lib/community-catalog";

export interface CommunityCatalogSearchResultsProps {
  results: CommunityCatalogItem[];
  onSelectResult: (result: CommunityCatalogItem, specificGtin?: string) => void;
  isLoading?: boolean;
}

export function CommunityCatalogSearchResults({
  results,
  onSelectResult,
  isLoading,
}: CommunityCatalogSearchResultsProps) {
  const { t } = useTranslation();

  const deduplicated = useMemo(() => {
    return mergeCatalogItems(results);
  }, [results]);

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm dark:text-neutral-400 text-gray-500">
        {t("common.loading")}
      </div>
    );
  }

  if (deduplicated.length === 0) {
    return (
      <p className="text-sm dark:text-neutral-400 text-gray-500 py-2">
        {t("settings.communityFilaments.noResults")}
      </p>
    );
  }

  return (
    <div className="mt-2 max-h-72 overflow-y-auto space-y-2 pr-1 pt-1 pb-1 -mr-1">
      {deduplicated.map((item, index) => {
        const weightText = formatWeightGrams(item.weightGrams);
        const diameterText = formatDiameter(item.diameter);
        const tempText = formatPrintTemps(item.extruderTemp, item.bedTemp, t("filaments.bed"));
        const allGtins = item.gtins && item.gtins.length > 0
          ? item.gtins
          : (item.gtin ? [item.gtin] : []);

        const spoolTypeText = item.spoolRefill != null
          ? (item.spoolRefill ? t("filaments.spoolless") : t("filaments.spooled"))
          : null;

        const hasMultipleGtins = allGtins.length > 1;

        return (
          <div
            key={`${item.source}-${item.id || index}`}
            className="w-full rounded-lg border dark:border-neutral-700/80 border-gray-200 bg-white dark:bg-neutral-800/80 shadow-sm flex flex-col overflow-hidden transition-colors hover:border-primary/60"
          >
            {/* Main clickable card area */}
            <button
              type="button"
              onClick={() => onSelectResult(item)}
              className={cn(
                "w-full text-left p-3 flex flex-col gap-2 hover:bg-primary/5 active:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                !hasMultipleGtins && "rounded-lg",
                hasMultipleGtins && "rounded-t-lg"
              )}
            >
              {/* Top Line: Color swatch, Title, Material */}
              <span className="flex items-start justify-between gap-2 w-full">
                <span className="flex items-start gap-2.5 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20 shrink-0 shadow-sm mt-0.5"
                    style={{ backgroundColor: item.colorCode || "#888888" }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 block">
                    <span className="font-semibold text-sm dark:text-neutral-100 text-gray-900 leading-tight break-words block">
                      {`${item.manufacturer} — ${item.name}`}
                    </span>
                    {item.colorName && (
                      <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                        {item.colorName}
                      </span>
                    )}
                  </span>
                </span>

                {item.material && (
                  <span
                    className={cn(
                      badgeVariants({ variant: "secondary" }),
                      "text-xs font-semibold uppercase px-2 py-0.5 shrink-0 ml-1 bg-neutral-100 dark:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200"
                    )}
                  >
                    {item.material}
                  </span>
                )}
              </span>

              {/* Badges row: Weight, Diameter, Spool type, Temperatures */}
              <span className="flex flex-wrap items-center gap-1.5 pl-[26px] text-xs">
                {weightText && (
                  <span
                    className={cn(
                      badgeVariants({ variant: "outline" }),
                      "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300"
                    )}
                  >
                    {weightText}
                  </span>
                )}
                {diameterText && (
                  <span
                    className={cn(
                      badgeVariants({ variant: "outline" }),
                      "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300"
                    )}
                  >
                    {diameterText}
                  </span>
                )}
                {spoolTypeText && (
                  <span
                    className={cn(
                      badgeVariants({ variant: "outline" }),
                      "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300",
                      item.spoolRefill && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                    )}
                  >
                    {spoolTypeText}
                  </span>
                )}
                {tempText && (
                  <span
                    className={cn(
                      badgeVariants({ variant: "outline" }),
                      "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300"
                    )}
                  >
                    {tempText}
                  </span>
                )}
              </span>

              {/* Single GTIN display */}
              {allGtins.length === 1 && (
                <span className="pl-[26px] flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <Barcode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="font-medium">GTIN:</span>
                  <span className="font-mono text-xs">{allGtins[0]}</span>
                </span>
              )}
            </button>

            {/* Multiple GTINs Selection: rendered as sibling controls outside the main button */}
            {hasMultipleGtins && (
              <div className="px-3 pb-3 pt-2 border-t border-border/40 flex flex-col gap-1.5 bg-neutral-50/50 dark:bg-neutral-900/20">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Barcode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span>GTIN:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allGtins.map((gtin) => (
                    <button
                      key={gtin}
                      type="button"
                      aria-label={t("scanner.selectGtin", { gtin })}
                      onClick={() => onSelectResult(item, gtin)}
                      className="min-h-[36px] min-w-[44px] px-3 py-1.5 rounded-md bg-muted/80 hover:bg-primary/20 active:bg-primary/30 text-xs font-mono font-medium transition-colors border border-border/60 text-foreground flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {gtin}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
