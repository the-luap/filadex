import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Filament } from "@shared/schema";
import { useTranslation } from "@/i18n";

interface MaterialColorChartProps {
  filaments: Filament[];
}

interface ChartData {
  id: string;
  name: string;
  value: number;
  color: string;
  category: string;
}

export function MaterialColorChart({ filaments }: MaterialColorChartProps) {
  const { t } = useTranslation();
  // Prepare data for the chart
  const chartData = useMemo(() => {
    const materialColorMap = new Map<string, Map<string, number>>();
    const colorMap = new Map<string, string>();

    // Zähle Filamente nach Material und Farbe
    filaments.forEach((filament) => {
      // Material als Hauptkategorie
      const material = filament.material;
      if (!materialColorMap.has(material)) {
        materialColorMap.set(material, new Map<string, number>());
      }

      // Farbe innerhalb des Materials - mit ID um doppelte Farben zu unterscheiden
      const colorName = filament.colorName;
      const colorId = `${colorName}-${filament.id}`;  // ID hinzufügen um Farben eindeutig zu machen
      const colorKey = `${material}-${colorId}`;
      const colorCount = materialColorMap.get(material)?.get(colorId) || 0;
      materialColorMap.get(material)?.set(colorId, colorCount + 1);

      // Speichere die tatsächliche Farbe für die Darstellung
      colorMap.set(colorKey, filament.colorCode || "#888888");
    });

    // Konvertiere die Maps in ein Array für Recharts
    const data: ChartData[] = [];
    materialColorMap.forEach((colorCounts, material) => {
      colorCounts.forEach((count, colorId) => {
        const colorKey = `${material}-${colorId}`;
        // Extrahiere den tatsächlichen Farbnamen aus der ID (Format: "Farbname-ID")
        const colorName = colorId.split('-')[0];
        data.push({
          id: colorKey,
          name: colorName, // Zeige nur den Farbnamen an, nicht die ID
          value: count,
          color: colorMap.get(colorKey) || "#888888",
          category: material
        });
      });
    });

    return data;
  }, [filaments]);

  // Gruppiere nach Material (Kategorie) und sortiere nach Farbcodes
  const materialGroups = useMemo(() => {
    const groups = new Map<string, ChartData[]>();

    chartData.forEach(item => {
      if (!groups.has(item.category)) {
        groups.set(item.category, []);
      }
      groups.get(item.category)?.push(item);
    });

    // Sortiere die Gruppen nach Farbcodes (Hexwerte)
    groups.forEach((items, category) => {
      items.sort((a, b) => {
        // Sortiere nach Farbcode, wobei "#" entfernt wird, um reine Hexwerte zu vergleichen
        const colorA = (a.color || "").replace('#', '');
        const colorB = (b.color || "").replace('#', '');
        return colorA.localeCompare(colorB);
      });
    });

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items
    }));
  }, [chartData]);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalFilaments = useMemo(() => {
    return materialGroups.reduce((acc, g) => acc + g.items.reduce((sum, item) => sum + item.value, 0), 0);
  }, [materialGroups]);

  // Material-Farben für die äußeren Segmente
  const MATERIAL_COLORS = [
    "#4C78A8", // PLA
    "#72B7B2", // PETG
    "#54A24B", // ABS
    "#E45756", // TPU
    "#F58518", // Nylon
    "#BC8F02", // ASA
    "#9467BD", // PC
    "#D67195", // PP
    "#8C564B", // HIPS
    "#3A3A3A", // Andere
  ];

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-2">{t('charts.materialsAndColors')}</h3>

      <div className="w-full h-[220px] md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ backgroundColor: 'var(--chart-bg, #1c1c1c)', borderRadius: '0.5rem' }}>
            {/* Material ring (outer ring) */}
            <Pie
              data={materialGroups.map((group, i) => ({
                name: group.category,
                value: group.items.reduce((sum, item) => sum + item.value, 0),
                color: MATERIAL_COLORS[i % MATERIAL_COLORS.length]
              }))}
              cx="50%"
              cy="50%"
              outerRadius={isMobile ? 75 : 90}
              innerRadius={isMobile ? 55 : 70}
              dataKey="value"
              nameKey="name"
              label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              fill="#ffffff"
            >
              {materialGroups.map((group, index) => (
                <Cell
                  key={`cell-material-${index}`}
                  fill={MATERIAL_COLORS[index % MATERIAL_COLORS.length]}
                />
              ))}
            </Pie>

            {/* Color ring (inner ring) */}
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 35 : 45}
              outerRadius={isMobile ? 50 : 65}
              dataKey="value"
              nameKey="name"
              paddingAngle={1}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-color-${index}`} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  if (data.category) {
                    return (
                      <div className="dark:bg-neutral-800 light:bg-white border dark:border-neutral-700 light:border-gray-200 p-2 rounded-md shadow-md">
                        <p className="font-semibold">{data.name}</p>
                        <p>{t('charts.material')}: {data.category}</p>
                        <p>{t('charts.count')}: {data.value}</p>
                      </div>
                    );
                  } else {
                    return (
                      <div className="dark:bg-neutral-800 light:bg-white border dark:border-neutral-700 light:border-gray-200 p-2 rounded-md shadow-md">
                        <p className="font-semibold">{data.name}</p>
                        <p>{t('charts.count')}: {data.value}</p>
                      </div>
                    );
                  }
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Mobile labels placed below the circle graph */}
      <div
        className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3 px-2 text-xs md:hidden"
        data-testid="mobile-chart-labels"
      >
        {materialGroups.map((group, index) => {
          const groupVal = group.items.reduce((sum, item) => sum + item.value, 0);
          const percent = totalFilaments > 0 ? ((groupVal / totalFilaments) * 100).toFixed(0) : "0";
          return (
            <div key={group.category} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: MATERIAL_COLORS[index % MATERIAL_COLORS.length] }}
              />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                <span>{group.category}</span> <span className="text-neutral-500 dark:text-neutral-400 font-normal">({percent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}