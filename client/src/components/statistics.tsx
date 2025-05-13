import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

interface MaterialDistribution {
  name: string;
  percentage: number;
}

interface Statistics {
  totalSpools: number;
  totalWeight: string;
  remainingWeight: string;
  averageRemaining: number;
  lowStockCount: number;
  materialDistribution: MaterialDistribution[];
  topMaterials: string[];
  topColors: string[];
  estimatedValue: number;
  totalPurchaseValue: number;
  averageAge: number;
  oldestFilament?: {name: string, days: number} | null;
  newestFilament?: {name: string, days: number} | null;
}

export function StatisticsAccordion() {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch statistics from the server
  const { data: statistics, isLoading } = useQuery<Statistics>({
    queryKey: ['/api/statistics'],
  });

  return (
    <div className="dark:bg-neutral-800 light:bg-white rounded-lg shadow-md mb-6">
      <button
        className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-semibold dark:text-neutral-200 light:text-gray-800 flex items-center">
          {isOpen ? <ChevronDown className="mr-2 h-5 w-5" /> : <ChevronRight className="mr-2 h-5 w-5" />}
          Filament-Statistiken
        </h2>
        <span className="text-sm dark:text-neutral-400 light:text-gray-600">
          {isLoading ? "Wird geladen..." : `${statistics?.totalSpools || 0} Filamente, ${statistics?.remainingWeight || 0} kg verfügbar`}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bestand */}
            <div className="space-y-2 dark:bg-neutral-900 light:bg-gray-50 p-3 rounded-lg">
              <h3 className="dark:text-neutral-400 light:text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1">Bestand</h3>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 light:text-gray-700">Gesamtanzahl:</span>
                <span className="font-medium dark:text-neutral-400 light:text-gray-800">
                  {isLoading ? "..." : statistics?.totalSpools || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Gesamtgewicht:</span>
                <span className="font-medium dark:text-neutral-400 text-gray-800">
                  {isLoading ? "..." : `${statistics?.totalWeight || 0} kg`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Verbleibendes Gewicht:</span>
                <span className="font-medium dark:text-neutral-400 text-gray-800">
                  {isLoading ? "..." : `${statistics?.remainingWeight || 0} kg`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Durchschn. Füllstand:</span>
                <span className="font-medium dark:text-neutral-400 text-gray-800">
                  {isLoading ? "..." : `${statistics?.averageRemaining || 0}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Wenig Bestand (unter 25%):</span>
                <span className="font-medium dark:text-neutral-400 text-gray-800">
                  {isLoading ? "..." : statistics?.lowStockCount || 0} Rollen
                </span>
              </div>
            </div>

            {/* Materialverteilung und Top Materialien */}
            <div className="space-y-2 dark:bg-neutral-900 light:bg-gray-50 p-3 rounded-lg">
              <h3 className="dark:text-neutral-400 light:text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1">Materialverteilung</h3>
              {!isLoading && statistics?.materialDistribution && statistics.materialDistribution.map((item) => (
                <div key={item.name} className="grid grid-cols-8 items-center gap-2">
                  <span className="dark:text-neutral-300 light:text-gray-700 col-span-2">{item.name}:</span>
                  <div className="flex items-center col-span-5">
                    <div className="w-full h-2 dark:bg-neutral-800 light:bg-gray-200 rounded-full mr-2 overflow-hidden">
                      <div
                        className="h-full theme-primary-bg"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-medium dark:text-neutral-400 light:text-gray-800 col-span-1 text-right">{item.percentage}%</span>
                </div>
              ))}

              <h3 className="dark:text-neutral-400 light:text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1 mt-3">Top Materialien</h3>
              <div className="flex flex-wrap gap-2">
                {!isLoading && statistics?.topMaterials?.map((material) => (
                  <Badge
                    key={material}
                    variant="outline"
                    className="theme-badge dark:bg-neutral-800 dark:text-neutral-200 light:bg-gray-100 light:text-gray-800"
                  >
                    {material}
                  </Badge>
                ))}
                {isLoading && <span className="dark:text-neutral-400 light:text-gray-500">...</span>}
              </div>

              <h3 className="dark:text-neutral-400 text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1 mt-3">Top Farben</h3>
              <div className="flex flex-wrap gap-2">
                {!isLoading && statistics?.topColors?.map((color) => (
                  <Badge
                    key={color}
                    variant="outline"
                    className="theme-badge dark:bg-neutral-800 dark:text-neutral-200 light:bg-gray-100 light:text-gray-800"
                  >
                    {color}
                  </Badge>
                ))}
                {isLoading && <span className="dark:text-neutral-400 text-gray-500">...</span>}
              </div>
            </div>

            {/* Werte und Alter */}
            <div className="space-y-2 dark:bg-neutral-900 light:bg-gray-50 p-3 rounded-lg">
              <h3 className="dark:text-neutral-400 text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1">Materialeinsatzwert</h3>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Geschätzter Restwert:</span>
                <span className="font-medium text-green-500 dark:text-green-400">
                  {isLoading ? "..." : `${statistics?.estimatedValue || 0} €`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Gesamter Kaufwert:</span>
                <span className="font-medium text-amber-500 dark:text-amber-400">
                  {isLoading ? "..." : `${statistics?.totalPurchaseValue || 0} €`}
                </span>
              </div>

              <h3 className="dark:text-neutral-400 text-gray-700 font-medium border-b dark:border-neutral-800 light:border-gray-200 pb-1 mt-3">Filamentalter</h3>
              <div className="flex justify-between">
                <span className="dark:text-neutral-300 text-gray-700">Durchschnitt:</span>
                <span className="font-medium dark:text-neutral-400 text-gray-800">
                  {isLoading ? "..." : `${statistics?.averageAge || 0} Tage`}
                </span>
              </div>
              {statistics?.oldestFilament && (
                <div className="flex justify-between">
                  <span className="dark:text-neutral-300 text-gray-700">Ältestes:</span>
                  <span className="font-medium dark:text-neutral-400 text-gray-800" title={statistics.oldestFilament.name}>
                    {isLoading ? "..." : `${statistics.oldestFilament.days} Tage`}
                  </span>
                </div>
              )}
              {statistics?.newestFilament && (
                <div className="flex justify-between">
                  <span className="dark:text-neutral-300 text-gray-700">Neuestes:</span>
                  <span className="font-medium dark:text-neutral-400 text-gray-800" title={statistics.newestFilament.name}>
                    {isLoading ? "..." : `${statistics.newestFilament.days} Tage`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}