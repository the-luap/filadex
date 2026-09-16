import React from "react";
import type { Filament } from "@shared/schema";
import { badgeVariants } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface CollectionSpoolCardProps {
  spool: Pick<Filament, "name" | "manufacturer" | "material"> &
    Partial<Pick<Filament, "id" | "colorName" | "colorCode" | "spoolType" | "totalWeight" | "diameter" | "printTemp">>;
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
}

export function CollectionSpoolCard({
  spool,
  onClick,
  interactive = true,
  className,
}: CollectionSpoolCardProps) {
  const { t } = useTranslation();

  const colorCode = spool.colorCode || "#888888";
  const spoolTypeText = spool.spoolType === "spoolless"
    ? t("filaments.spoolless")
    : t("filaments.spooled");

  const weightText = spool.totalWeight ? `${spool.totalWeight}kg` : null;
  const diameterText = spool.diameter ? `${spool.diameter}mm` : null;
  const printTempText = spool.printTemp ? (spool.printTemp.includes("°") ? spool.printTemp : `${spool.printTemp}°C`) : null;

  const content = (
    <>
      {/* Top Line: Color swatch, Title, Material */}
      <span className="flex items-start justify-between gap-2 w-full">
        <span className="flex items-start gap-2.5 min-w-0">
          <span
            className="w-4 h-4 rounded-full border border-black/15 dark:border-white/20 shrink-0 shadow-sm mt-0.5"
            style={{ backgroundColor: colorCode }}
            aria-hidden="true"
          />
          <span className="min-w-0 block">
            <span className="font-semibold text-sm dark:text-neutral-100 text-gray-900 leading-tight break-words block">
              {spool.name}
            </span>
            {(spool.manufacturer || spool.colorName) && (
              <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                {spool.manufacturer}
                {spool.manufacturer && spool.colorName && " • "}
                {spool.colorName}
              </span>
            )}
          </span>
        </span>

        {spool.material && (
          <span
            className={cn(
              badgeVariants({ variant: "secondary" }),
              "text-xs font-semibold uppercase px-2 py-0.5 shrink-0 ml-1 bg-neutral-100 dark:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200"
            )}
          >
            {spool.material}
          </span>
        )}
      </span>

      {/* Badges row: Spool type, Weight, Diameter, Temperature */}
      <span className="flex flex-wrap items-center gap-1.5 pl-[26px] text-xs">
        {spoolTypeText && (
          <span
            className={cn(
              badgeVariants({ variant: "outline" }),
              "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300",
              spool.spoolType === "spoolless" && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            )}
          >
            {spoolTypeText}
          </span>
        )}
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
        {printTempText && (
          <span
            className={cn(
              badgeVariants({ variant: "outline" }),
              "text-xs font-normal px-2 py-0.5 dark:border-neutral-600 dark:text-neutral-300"
            )}
          >
            {printTempText}
          </span>
        )}
      </span>
    </>
  );

  const containerClasses = cn(
    "w-full rounded-lg border dark:border-neutral-700/80 border-gray-200 bg-white dark:bg-neutral-800/80 shadow-sm flex flex-col overflow-hidden transition-colors",
    interactive && "hover:border-primary/60",
    className
  );

  if (!interactive) {
    return (
      <div className={containerClasses}>
        <div className="w-full text-left p-3 flex flex-col gap-2">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-3 flex flex-col gap-2 min-h-[44px] hover:bg-primary/5 active:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        {content}
      </button>
    </div>
  );
}
