import { useState, useEffect, useMemo } from "react";
import { Filament, type CommunityCatalogItem } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, type Locale } from "date-fns";
import { de, enUS, pl } from "date-fns/locale";
import { CalendarIcon, Scan, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Language } from "@shared/languages";

const DATE_LOCALES: Record<Language, Locale> = {
  en: enUS,
  de,
  pl,
};

// Material types will be created with translations in the component
const createMaterialTypes = (t: (key: string) => string) => [
  { value: "PLA", label: "PLA" },
  { value: "PETG", label: "PETG" },
  { value: "ABS", label: "ABS" },
  { value: "TPU", label: "TPU" },
  { value: "ASA", label: "ASA" },
  { value: "PA", label: `PA (${t('settings.materials.nylon') || 'Nylon'})` },
  { value: "PC", label: `PC (${t('settings.materials.polycarbonate') || 'Polycarbonate'})` },
  { value: "PVA", label: "PVA" },
  { value: "HIPS", label: "HIPS" },
  { value: "PLA-CF", label: `PLA-CF (${t('settings.materials.carbon') || 'Carbon'})` },
  { value: "PA-CF", label: `PA-CF (${t('settings.materials.nylonCarbon') || 'Nylon Carbon'})` },
  { value: "PETG-CF", label: `PETG-CF (${t('settings.materials.carbon') || 'Carbon'})` },
  { value: "PET-CF", label: `PET-CF (${t('settings.materials.carbon') || 'Carbon'})` },
  { value: "PLA-HF", label: `PLA-HF (${t('settings.materials.highFlow') || 'High Flow'})` },
  { value: "PP", label: `PP (${t('settings.materials.polypropylene') || 'Polypropylene'})` },
  { value: "PETG-HF", label: `PETG-HF (${t('settings.materials.highFlow') || 'High Flow'})` },
  { value: "PPS", label: "PPS" },
  { value: "PEEK", label: "PEEK" },
  { value: "PEI", label: "PEI/ULTEM" }
];

// Colors will be created with translations in the component
const createColorsList = (t: (key: string) => string) => [
  // Standard colors
  { name: t('settings.colors.black') || 'Black', code: "#000000" },
  { name: t('settings.colors.white') || 'White', code: "#FFFFFF" },
  { name: t('settings.colors.gray') || 'Gray', code: "#808080" },
  { name: t('settings.colors.darkGray') || 'Dark Gray', code: "#444444" },
  { name: t('settings.colors.lightGray') || 'Light Gray', code: "#D3D3D3" },
  { name: t('settings.colors.silver') || 'Silver', code: "#C0C0C0" },
  { name: t('settings.colors.red') || 'Red', code: "#FF0000" },
  { name: t('settings.colors.lightRed') || 'Light Red', code: "#FF5252" },
  { name: t('settings.colors.darkRed') || 'Dark Red', code: "#8B0000" },
  { name: t('settings.colors.blue') || 'Blue', code: "#0000FF" },
  { name: t('settings.colors.lightBlue') || 'Light Blue', code: "#ADD8E6" },
  { name: t('settings.colors.darkBlue') || 'Dark Blue', code: "#00008B" },
  { name: t('settings.colors.green') || 'Green', code: "#00FF00" },
  { name: t('settings.colors.lightGreen') || 'Light Green', code: "#90EE90" },
  { name: t('settings.colors.darkGreen') || 'Dark Green', code: "#006400" },
  { name: t('settings.colors.yellow') || 'Yellow', code: "#FFFF00" },
  { name: t('settings.colors.orange') || 'Orange', code: "#FFA500" },
  { name: t('settings.colors.purple') || 'Purple', code: "#800080" },
  { name: t('settings.colors.pink') || 'Pink', code: "#FFC0CB" },
  { name: t('settings.colors.brown') || 'Brown', code: "#A52A2A" },

  // Special finishes
  { name: t('settings.colors.gold') || 'Gold', code: "#FFD700" },
  { name: t('settings.colors.copper') || 'Copper', code: "#B87333" },
  { name: t('settings.colors.transparent') || 'Transparent', code: "#FFFFFF", opacity: 0.3 },
  { name: t('settings.colors.glitterSilver') || 'Glitter Silver', code: "#E0E0E0" },
  { name: t('settings.colors.glitterGold') || 'Glitter Gold', code: "#FFD700" },
  { name: t('settings.colors.glitterBlue') || 'Glitter Blue', code: "#4169E1" },
  { name: t('settings.colors.pearlescent') || 'Pearlescent', code: "#EAEAEA" },
  { name: t('settings.colors.neonYellow') || 'Neon Yellow', code: "#FFFF00" },
  { name: t('settings.colors.neonGreen') || 'Neon Green', code: "#39FF14" },
  { name: t('settings.colors.neonPink') || 'Neon Pink', code: "#FF69B4" },
  { name: t('settings.colors.glow') || 'Glow in the Dark', code: "#CCFFCC" },

  // Wood series
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.birch') || 'Birch'}`, code: "#F5DEB3" },
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.oak') || 'Oak'}`, code: "#DEB887" },
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.maple') || 'Maple'}`, code: "#EADDCA" },
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.cherry') || 'Cherry'}`, code: "#954535" },
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.walnut') || 'Walnut'}`, code: "#614126" },
  { name: `${t('settings.colors.wood') || 'Wood'} - ${t('settings.colors.ebony') || 'Ebony'}`, code: "#3D2B1F" },

  // Cool/Marble series
  { name: t('settings.colors.marble') || 'Marble', code: "#F5F5F5" },
  { name: t('settings.colors.galaxy') || 'Galaxy', code: "#191970" },
  { name: t('settings.colors.colorChangingBlueGreen') || 'Color Changing Blue-Green', code: "#1E90FF" },
  { name: t('settings.colors.colorChangingRedYellow') || 'Color Changing Red-Yellow', code: "#FF4500" }
];

// Print temperatures by material type
const PRINT_TEMPERATURES: Record<string, string> = {
  "PLA": "190-220°C",
  "PLA-CF": "200-230°C",
  "PLA-HF": "200-230°C",
  "PETG": "230-250°C",
  "PETG-CF": "240-260°C",
  "PETG-HF": "240-260°C",
  "ABS": "230-250°C",
  "TPU": "220-240°C",
  "ASA": "240-260°C",
  "PA": "250-270°C",
  "PA-CF": "260-280°C",
  "PC": "250-280°C",
  "PVA": "190-210°C",
  "HIPS": "230-250°C",
  "PP": "220-240°C",
  "PPS": "260-290°C",
  "PEEK": "360-400°C",
  "PET-CF": "240-260°C",
  "PEI": "350-380°C",
  "OTHER": ""
};

// Preset weight options shown in the "total weight" dropdown; any other value counts as custom
const STANDARD_WEIGHTS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 5];

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRScanner } from "./qr-scanner";
import { NFCScanner } from "./nfc-scanner";
import { useUnits } from "@/lib/use-units";
import { formatCurrency, getTemperatureUnitSymbol } from "@/lib/units";
import { findSimilarManufacturers, findSimilarMaterials } from "@shared/similarity";

// Create a custom schema for the form with translations
const createFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('filaments.nameRequired')),
  manufacturer: z.string().optional(),
  material: z.string().min(1, t('filaments.materialRequired')),
  colorName: z.string().min(1, t('filaments.colorRequired')),
  colorCode: z.string().max(20).optional().nullable(),
  diameter: z.number().optional(),
  printTemp: z.string().optional(),
  totalWeight: z.number().min(0.1, t('filaments.weightRequired')),
  remainingPercentage: z.number().min(0).max(100),
  purchaseDate: z.date().optional(),
  purchasePrice: z.number().min(0).optional(),
  status: z.enum(["sealed", "opened"]),
  spoolType: z.enum(["spooled", "spoolless"]),
  dryerCount: z.number().min(0).default(0),
  lastDryingDate: z.date().optional(),
  storageLocation: z.string().optional(),
  barcode: z.string().optional(),
  density: z.union([
    z.number().positive(),
    z.string()
      .regex(/^\d+(\.\d+)?$/, t('settings.materials.invalidDensity') || 'Density must be a positive number')
      .refine((v) => Number(v) > 0, t('settings.materials.invalidDensity') || 'Density must be a positive number'),
  ]).optional().nullable(),
});

// This will be defined in the component
type FormSchema = ReturnType<typeof createFormSchema>;
type FormValues = z.infer<FormSchema>;

interface FilamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filament: any) => void;
  filament?: Filament;
}

// Interfaces für Daten aus der Datenbank
interface Manufacturer {
  id: number;
  name: string;
  createdAt: string;
}

interface Color {
  id: number;
  name: string;
  code: string;
  createdAt: string;
}

interface Material {
  id: number;
  name: string;
  density?: string | null;
  createdAt: string;
}

export type CommunityFilamentResult = CommunityCatalogItem;

export function normalizeHexColor(raw: string | null | undefined): string {
  if (!raw) return "";
  let hex = raw.trim();
  if (!hex) return "";
  if (!hex.startsWith("#")) hex = "#" + hex;
  // 3-digit hex: #RGB -> #RRGGBB
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
  }
  // 4-digit hex: #RGBA -> #RRGGBB
  if (/^#[0-9A-Fa-f]{4}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
  }
  // 8-digit hex: #RRGGBBAA -> #RRGGBB
  if (/^#[0-9A-Fa-f]{8}$/.test(hex)) {
    return hex.slice(0, 7).toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex.toUpperCase();
  }
  return hex;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripParentheticalAnnotations(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").trim();
}

export function findMatchingColor(
  scannedColorName: string | null | undefined,
  dbColors: { id?: number; name: string; code?: string }[],
  predefinedColors: { name: string; code?: string }[]
): { name: string; code: string } | undefined {
  if (!scannedColorName) return undefined;
  const lower = scannedColorName.trim().toLowerCase();
  if (!lower) return undefined;

  // 1. Exact case-insensitive match on DB colors
  const dbMatch = dbColors.find(c => c.name.trim().toLowerCase() === lower);
  if (dbMatch) return { name: dbMatch.name, code: dbMatch.code || "#000000" };

  // 2. Exact case-insensitive match on predefined colors
  const preMatch = predefinedColors.find(c => c.name.trim().toLowerCase() === lower);
  if (preMatch) return { name: preMatch.name, code: preMatch.code || "#000000" };

  // 3. Match stripping parenthetical comments, e.g. "Black" vs "Black (Bambu Lab)"
  const strippedLower = stripParentheticalAnnotations(lower).toLowerCase();
  if (strippedLower) {
    const dbParenMatch = dbColors.find(c => stripParentheticalAnnotations(c.name).toLowerCase() === strippedLower);
    if (dbParenMatch) return { name: dbParenMatch.name, code: dbParenMatch.code || "#000000" };

    const preParenMatch = predefinedColors.find(c => stripParentheticalAnnotations(c.name).toLowerCase() === strippedLower);
    if (preParenMatch) return { name: preParenMatch.name, code: preParenMatch.code || "#000000" };
  }

  return undefined;
}

export function findMatchingManufacturer(
  scannedManufacturer: string | null | undefined,
  dbManufacturers: { id?: number; name: string }[]
): { id?: number; name: string } | undefined {
  if (!scannedManufacturer) return undefined;
  const lower = scannedManufacturer.trim().toLowerCase();
  if (!lower || lower === "other") return undefined;

  // 1. Exact case-insensitive match on DB manufacturers
  const exact = dbManufacturers.find(m => m.name.trim().toLowerCase() === lower);
  if (exact) return exact;

  // 2. Match stripping parenthetical annotations, e.g. "Prusa" vs "Prusa (Research)"
  const strippedLower = stripParentheticalAnnotations(lower).toLowerCase();
  if (strippedLower) {
    const parenMatch = dbManufacturers.find(m => stripParentheticalAnnotations(m.name).toLowerCase() === strippedLower);
    if (parenMatch) return parenMatch;
  }

  return undefined;
}

export function findMatchingMaterial(
  scannedMaterial: string | null | undefined,
  availableMaterials: { id?: number; value?: string; name?: string; label?: string }[]
): { value: string; label?: string } | undefined {
  if (!scannedMaterial) return undefined;
  const lower = scannedMaterial.trim().toLowerCase();
  if (!lower || lower === "custom") return undefined;

  // 1. Exact case-insensitive match on value or name or label
  const exact = availableMaterials.find(m => {
    const v = (m.value ?? m.name ?? "").trim().toLowerCase();
    const l = (m.label ?? "").trim().toLowerCase();
    return v === lower || l === lower;
  });
  if (exact) {
    const val = exact.value ?? exact.name!;
    return { value: val, label: exact.label ?? val };
  }

  // 2. Match stripping parenthetical annotations, e.g. "PA" vs "PA (Nylon)"
  const strippedLower = stripParentheticalAnnotations(lower).toLowerCase();
  if (strippedLower) {
    const parenMatch = availableMaterials.find(m => {
      const v = stripParentheticalAnnotations(m.value ?? m.name ?? "").toLowerCase();
      const l = stripParentheticalAnnotations(m.label ?? "").toLowerCase();
      return (Boolean(v) && v === strippedLower) || (Boolean(l) && l === strippedLower);
    });
    if (parenMatch) {
      const val = parenMatch.value ?? parenMatch.name!;
      return { value: val, label: parenMatch.label ?? val };
    }
  }

  return undefined;
}

interface CustomFieldDefinition {
  id: number;
  name: string;
  fieldType: "text" | "number" | "boolean" | "date";
}

interface FilamentUsageLogEntry {
  id: number;
  deltaWeight: string;
  remainingPercentageAfter: string;
  note: string | null;
  source: string;
  createdAt: string;
}

export function FilamentModal({
  isOpen,
  onClose,
  onSave,
  filament,
}: FilamentModalProps) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { currency, temperatureUnit } = useUnits();
  const isEditing = Boolean(filament && filament.id && filament.id > 0);
  const [remainingPercentage, setRemainingPercentage] = useState(100);
  const [totalWeight, setTotalWeight] = useState<number | string>(1);
  const [customWeightVisible, setCustomWeightVisible] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNFCScanner, setShowNFCScanner] = useState(false);
  const [variantCandidates, setVariantCandidates] = useState<CommunityFilamentResult[] | null>(null);
  const [variantCandidateBarcode, setVariantCandidateBarcode] = useState<string>("");
  const [usageNote, setUsageNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [similarManufacturerPrompt, setSimilarManufacturerPrompt] = useState<{
    scannedManufacturer: string;
    similar: { id?: number; name: string }[];
  } | null>(null);
  const [similarMaterialPrompt, setSimilarMaterialPrompt] = useState<{
    scannedMaterial: string;
    similar: { id?: number; name: string }[];
  } | null>(null);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [catalogSource, setCatalogSource] = useState<"ofd" | "spoolmandb">(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("filament_catalog_source");
      return stored === "spoolmandb" ? "spoolmandb" : "ofd";
    }
    return "ofd";
  });

  const handleCatalogSourceChange = (source: "ofd" | "spoolmandb") => {
    setCatalogSource(source);
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem("filament_catalog_source", source);
    }
  };

  const { data: communityResults = [] } = useQuery<CommunityFilamentResult[]>({
    queryKey: [`/api/community-filaments/search?q=${encodeURIComponent(communitySearchQuery)}&source=${catalogSource}`],
    queryFn: () => apiRequest<CommunityFilamentResult[]>(`/api/community-filaments/search?q=${encodeURIComponent(communitySearchQuery)}&source=${catalogSource}`),
    enabled: isOpen && !isEditing && communitySearchQuery.trim().length >= 2,
  });

  const { data: usageLog = [] } = useQuery<FilamentUsageLogEntry[]>({
    queryKey: [`/api/filaments/${filament?.id}/usage-log`],
    queryFn: () => apiRequest<FilamentUsageLogEntry[]>(`/api/filaments/${filament?.id}/usage-log`),
    enabled: isOpen && isEditing && !!filament?.id && showHistory,
  });

  const { data: customFieldDefinitions = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ['/api/custom-fields'],
    queryFn: () => apiRequest<CustomFieldDefinition[]>('/api/custom-fields'),
    enabled: isOpen,
  });

  // Create form schema with translations
  const formSchema = createFormSchema(t);

  // Create material types with translations
  const materialTypes = createMaterialTypes(t);

  // Create colors list with translations
  const colorsList = createColorsList(t);

  // Load data from the database
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['/api/manufacturers'],
    queryFn: () => apiRequest<Manufacturer[]>('/api/manufacturers'),
    enabled: isOpen
  });

  const { data: colors = [] } = useQuery({
    queryKey: ['/api/colors'],
    queryFn: () => apiRequest<Color[]>('/api/colors'),
    enabled: isOpen
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['/api/materials'],
    queryFn: () => apiRequest<Material[]>('/api/materials'),
    enabled: isOpen
  });

  const allAvailableMaterials = useMemo(() => {
    const list: { id?: number; name: string }[] = materials.map((m) => ({ id: m.id, name: m.name }));
    for (const mt of materialTypes) {
      if (!list.some((existing) => existing.name.toLowerCase() === mt.value.toLowerCase())) {
        list.push({ name: mt.value });
      }
    }
    return list;
  }, [materials, materialTypes]);

  const uniqueMaterialOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string; id?: number }[] = [];

    const normalize = (s: string) => s.trim().toLowerCase();

    // Prioritize shorter/unannotated canonical names first (e.g. "PA" before "PA (Nylon)")
    const sortedMaterials = [...materials].sort((a, b) => a.name.length - b.name.length);

    // 1. Add database materials (deduplicated by normalized parenthetical-stripped form and full name)
    for (const mat of sortedMaterials) {
      const key = normalize(mat.name);
      const parenKey = normalize(stripParentheticalAnnotations(mat.name));
      if (key !== "custom" && !seen.has(parenKey) && !seen.has(key)) {
        seen.add(parenKey);
        seen.add(key);
        options.push({ value: mat.name, label: mat.name, id: mat.id });
      }
    }

    // 2. Add predefined material types not yet in database
    for (const predefined of materialTypes) {
      const valKey = normalize(predefined.value);
      const labelKey = normalize(predefined.label);
      const valParen = normalize(stripParentheticalAnnotations(predefined.value));
      const labelParen = normalize(stripParentheticalAnnotations(predefined.label));
      if (
        valKey !== "custom" &&
        !seen.has(valKey) &&
        !seen.has(labelKey) &&
        !seen.has(valParen) &&
        !seen.has(labelParen)
      ) {
        seen.add(valKey);
        seen.add(labelKey);
        if (valParen) seen.add(valParen);
        if (labelParen) seen.add(labelParen);
        options.push({ value: predefined.value, label: predefined.label });
      }
    }

    return options;
  }, [materials, materialTypes]);

  const [isCustomColor, setIsCustomColor] = useState(() => {
    if (!filament?.colorName) return false;
    return !findMatchingColor(filament.colorName, colors, colorsList);
  });
  const [customColorName, setCustomColorName] = useState(() => {
    if (!filament?.colorName) return "";
    const match = findMatchingColor(filament.colorName, colors, colorsList);
    return match ? "" : filament.colorName;
  });

  const [isCustomManufacturer, setIsCustomManufacturer] = useState(() => {
    if (!filament?.manufacturer) return false;
    return !findMatchingManufacturer(filament.manufacturer, manufacturers);
  });
  const [customManufacturerName, setCustomManufacturerName] = useState(() => {
    if (!filament?.manufacturer) return "";
    const match = findMatchingManufacturer(filament.manufacturer, manufacturers);
    return match ? "" : filament.manufacturer;
  });
  const [saveCustomManufacturer, setSaveCustomManufacturer] = useState(true);

  const [isCustomMaterial, setIsCustomMaterial] = useState(() => {
    if (!filament?.material) return false;
    return !findMatchingMaterial(filament.material, uniqueMaterialOptions);
  });
  const [customMaterialName, setCustomMaterialName] = useState(() => {
    if (!filament?.material) return "";
    const match = findMatchingMaterial(filament.material, uniqueMaterialOptions);
    return match ? "" : filament.material;
  });
  const [saveCustomMaterial, setSaveCustomMaterial] = useState(true);

  const { data: diameters = [] } = useQuery({
    queryKey: ['/api/diameters'],
    queryFn: () => apiRequest<{id: number, value: string}[]>('/api/diameters'),
    enabled: isOpen
  });

  // Lagerorte aus der Datenbank
  const { data: storageLocationData = [] } = useQuery({
    queryKey: ['/api/storage-locations'],
    queryFn: () => apiRequest<{id: number, name: string}[]>('/api/storage-locations'),
    enabled: isOpen
  });

  // Extract storage location names
  const storageLocations = storageLocationData.map(loc => loc.name);

  const { data: genericTermsData = [] } = useQuery({
    queryKey: ["/api/generic-terms"],
    queryFn: () => apiRequest<{ id: number; word: string }[]>("/api/generic-terms"),
    enabled: isOpen,
  });

  const genericStopWords = useMemo(
    () => new Set(genericTermsData.map((t) => t.word)),
    [genericTermsData]
  );

  const uniqueColors = useMemo(() => {
    const seen = new Set<string>();
    const result: Color[] = [];
    for (const c of colors) {
      const key = c.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }
    return result;
  }, [colors]);

  const uniqueManufacturers = useMemo(() => {
    const seen = new Set<string>();
    const result: Manufacturer[] = [];
    for (const m of manufacturers) {
      const key = m.name.trim().toLowerCase();
      if (key !== "other" && !seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }, [manufacturers]);

  const applyManufacturerData = (mfgName: string | null | undefined) => {
    if (!mfgName || !mfgName.trim()) {
      setIsCustomManufacturer(false);
      setCustomManufacturerName("");
      form.setValue('manufacturer', '');
      return;
    }
    const match = findMatchingManufacturer(mfgName, manufacturers);
    if (match) {
      setIsCustomManufacturer(false);
      setCustomManufacturerName("");
      form.setValue('manufacturer', match.name, { shouldValidate: true, shouldDirty: true });
    } else {
      setIsCustomManufacturer(true);
      const customName = mfgName.trim();
      setCustomManufacturerName(customName);
      form.setValue('manufacturer', customName, { shouldValidate: true, shouldDirty: true });
    }
  };

  const applyMaterialData = (matName: string | null | undefined) => {
    if (!matName || !matName.trim()) {
      setIsCustomMaterial(false);
      setCustomMaterialName("");
      form.setValue('material', '');
      return;
    }
    const match = findMatchingMaterial(matName, uniqueMaterialOptions);
    if (match) {
      setIsCustomMaterial(false);
      setCustomMaterialName("");
      form.setValue('material', match.value, { shouldValidate: true, shouldDirty: true });
    } else {
      setIsCustomMaterial(true);
      const customName = matName.trim();
      setCustomMaterialName(customName);
      form.setValue('material', customName, { shouldValidate: true, shouldDirty: true });
    }
  };

  const applyColorData = (name: string | null | undefined, hexCode?: string | null) => {
    const normalizedHex = hexCode ? normalizeHexColor(hexCode) : undefined;
    const match = findMatchingColor(name, colors, colorsList);
    if (match) {
      setIsCustomColor(false);
      setCustomColorName("");
      form.setValue('colorName', match.name, { shouldValidate: true, shouldDirty: true });
      form.setValue('colorCode', normalizedHex || match.code, { shouldValidate: true, shouldDirty: true });
    } else {
      // Unrecognized color -> select Custom, pre-fill custom color name with scanned name
      setIsCustomColor(true);
      const customName = name ? name.trim() : "";
      setCustomColorName(customName);
      form.setValue('colorName', customName, { shouldValidate: true, shouldDirty: true });
      if (normalizedHex) {
        form.setValue('colorCode', normalizedHex, { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  // Setup form with default values or editing values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: filament?.name || "",
      manufacturer: (filament?.manufacturer
        ? (findMatchingManufacturer(filament.manufacturer, manufacturers)?.name || filament.manufacturer)
        : ""),
      material: (filament?.material
        ? (findMatchingMaterial(filament.material, uniqueMaterialOptions)?.value || filament.material)
        : ""),
      colorName: (filament?.colorName
        ? (findMatchingColor(filament.colorName, colors, colorsList)?.name || filament.colorName)
        : ""),
      colorCode: normalizeHexColor(filament?.colorCode) || "#000000",
      diameter: filament?.diameter ? Number(filament.diameter) : 1.75,
      printTemp: filament?.printTemp || "",
      totalWeight: filament?.totalWeight ? Number(filament.totalWeight) : 1,
      remainingPercentage: filament?.remainingPercentage ? Number(filament.remainingPercentage) : 100,
      purchaseDate: filament?.purchaseDate ? new Date(filament.purchaseDate) : undefined,
      purchasePrice: filament?.purchasePrice ? Number(filament.purchasePrice) : undefined,
      status: (filament?.status as any) || undefined,
      spoolType: (filament?.spoolType as any) || undefined,
      dryerCount: filament?.dryerCount || 0,
      lastDryingDate: filament?.lastDryingDate ? new Date(filament.lastDryingDate) : undefined,
      storageLocation: filament?.storageLocation || "",
      barcode: filament?.barcode || "",
      density: undefined,
    },
  });

  // Update form when filament changes
  useEffect(() => {
    if (filament) {
      const matMatch = findMatchingMaterial(filament.material, uniqueMaterialOptions);
      const canonicalMaterial = matMatch ? matMatch.value : (filament.material || "");
      if (matMatch) {
        setIsCustomMaterial(false);
        setCustomMaterialName("");
      } else if (filament.material) {
        setIsCustomMaterial(true);
        setCustomMaterialName(filament.material);
      } else {
        setIsCustomMaterial(false);
        setCustomMaterialName("");
      }
      setSaveCustomMaterial(true);

      const mfgMatch = findMatchingManufacturer(filament.manufacturer, manufacturers);
      const canonicalMfg = mfgMatch ? mfgMatch.name : (filament.manufacturer || "");
      if (mfgMatch) {
        setIsCustomManufacturer(false);
        setCustomManufacturerName("");
      } else if (filament.manufacturer) {
        setIsCustomManufacturer(true);
        setCustomManufacturerName(filament.manufacturer);
      } else {
        setIsCustomManufacturer(false);
        setCustomManufacturerName("");
      }
      setSaveCustomManufacturer(true);

      const colorMatch = findMatchingColor(filament.colorName, colors, colorsList);
      const canonicalColor = colorMatch ? colorMatch.name : (filament.colorName || "");
      if (colorMatch) {
        setIsCustomColor(false);
        setCustomColorName("");
      } else if (filament.colorName) {
        setIsCustomColor(true);
        setCustomColorName(filament.colorName);
      } else {
        setIsCustomColor(false);
        setCustomColorName("");
      }

      form.reset({
        name: filament.name,
        manufacturer: canonicalMfg,
        material: canonicalMaterial,
        colorName: canonicalColor,
        colorCode: normalizeHexColor(filament.colorCode) || "#000000",
        diameter: Number(filament.diameter),
        printTemp: filament.printTemp || "",
        totalWeight: Number(filament.totalWeight),
        remainingPercentage: Number(filament.remainingPercentage),
        purchaseDate: filament.purchaseDate ? new Date(filament.purchaseDate) : undefined,
        purchasePrice: filament.purchasePrice ? Number(filament.purchasePrice) : undefined,
        status: (filament.status as any) || undefined,
        spoolType: (filament.spoolType as any) || undefined,
        dryerCount: filament.dryerCount || 0,
        lastDryingDate: filament.lastDryingDate ? new Date(filament.lastDryingDate) : undefined,
        storageLocation: filament.storageLocation || "",
        barcode: filament.barcode || "",
        density: undefined,
      });

      setRemainingPercentage(Number(filament.remainingPercentage));
      setTotalWeight(Number(filament.totalWeight));

      // Check if we need to show custom weight field
      if (!STANDARD_WEIGHTS.includes(Number(filament.totalWeight))) {
        setCustomWeightVisible(true);
      }
    } else {
      setIsCustomColor(false);
      setCustomColorName("");
      setIsCustomManufacturer(false);
      setCustomManufacturerName("");
      setSaveCustomManufacturer(true);
      setIsCustomMaterial(false);
      setCustomMaterialName("");
      setSaveCustomMaterial(true);
      form.reset({
        name: "",
        manufacturer: "",
        material: "",
        colorName: "",
        colorCode: "#000000",
        diameter: 1.75,
        printTemp: "",
        totalWeight: 1,
        remainingPercentage: 100,
        purchaseDate: undefined,
        purchasePrice: undefined,
        status: undefined,
        spoolType: undefined,
        dryerCount: 0,
        lastDryingDate: undefined,
        storageLocation: "",
        barcode: "",
        density: undefined,
      });
      setRemainingPercentage(100);
      setTotalWeight(1);
      setCustomWeightVisible(false);
    }
    setUsageNote("");
    setShowHistory(false);
    setCustomFieldValues((filament?.customFieldValues as Record<string, any>) || {});
    // Only synchronize form state when the active filament changes to avoid overwriting user edits on query refetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filament, form]);

  // If modal was opened with a filament whose color is in the database,
  // re-evaluate when colors query finishes loading so it doesn't stay stuck as "Custom"
  useEffect(() => {
    if (filament && filament.colorName && isCustomColor && !form.formState.dirtyFields.colorName) {
      const match = findMatchingColor(filament.colorName, colors, colorsList);
      if (match) {
        setIsCustomColor(false);
        setCustomColorName("");
        form.setValue('colorName', match.name, { shouldValidate: true });
      }
    }
  }, [colors, filament, isCustomColor, colorsList, form]);

  // If modal was opened with a filament whose manufacturer is in the database,
  // re-evaluate when manufacturers query finishes loading so it doesn't stay stuck as "Other"
  useEffect(() => {
    if (filament && filament.manufacturer && isCustomManufacturer && !form.formState.dirtyFields.manufacturer) {
      const match = findMatchingManufacturer(filament.manufacturer, manufacturers);
      if (match) {
        setIsCustomManufacturer(false);
        setCustomManufacturerName("");
        form.setValue('manufacturer', match.name, { shouldValidate: true });
      }
    }
  }, [manufacturers, filament, isCustomManufacturer, form]);

  // If modal was opened with a filament whose material is in the database or predefined list,
  // re-evaluate when materials query finishes loading so it doesn't stay stuck as "Custom"
  useEffect(() => {
    if (filament && filament.material && isCustomMaterial && !form.formState.dirtyFields.material) {
      const match = findMatchingMaterial(filament.material, uniqueMaterialOptions);
      if (match) {
        setIsCustomMaterial(false);
        setCustomMaterialName("");
        form.setValue('material', match.value, { shouldValidate: true });
      }
    }
  }, [uniqueMaterialOptions, filament, isCustomMaterial, form]);

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    // Handle custom weight
    if (customWeightVisible && typeof totalWeight === 'number') {
      data.totalWeight = totalWeight;
    }

    const payload: any = {
      ...data,
      customFieldValues,
      saveManufacturer: isCustomManufacturer ? saveCustomManufacturer : undefined,
      saveMaterial: isCustomMaterial ? saveCustomMaterial : undefined,
    };
    if (usageNote.trim()) {
      payload.note = usageNote.trim();
    }
    onSave(payload);
  };

  // Pre-fill the form from a picked community database entry
  const handleUseCommunityResult = (result: CommunityFilamentResult) => {
    if (result.manufacturer) {
      const match = findSimilarManufacturers(result.manufacturer, manufacturers, genericStopWords);
      if (match.exactMatch) {
        applyManufacturerData(match.exactMatch.name);
      } else if (match.similarMatches.length > 0) {
        applyManufacturerData(result.manufacturer);
        setSimilarManufacturerPrompt({
          scannedManufacturer: result.manufacturer,
          similar: match.similarMatches,
        });
      } else {
        applyManufacturerData(result.manufacturer);
      }
    } else {
      applyManufacturerData('');
    }

    if (result.material) {
      const matMatch = findSimilarMaterials(result.material, allAvailableMaterials, genericStopWords);
      if (matMatch.exactMatch) {
        applyMaterialData(matMatch.exactMatch.name);
      } else if (matMatch.similarMatches.length > 0) {
        applyMaterialData(result.material);
        setSimilarMaterialPrompt({
          scannedMaterial: result.material,
          similar: matMatch.similarMatches,
        });
      } else {
        applyMaterialData(result.material);
      }
    } else {
      applyMaterialData('');
    }
    applyColorData(result.colorName, result.colorCode);
    if (result.density) form.setValue('density', result.density);
    if (result.diameter) form.setValue('diameter', Number(result.diameter));
    if (result.extruderTemp) {
      form.setValue('printTemp', result.bedTemp
        ? `${result.extruderTemp}°C / Bed ${result.bedTemp}°C`
        : `${result.extruderTemp}°C`);
    }
    const cleanName = result.colorName && result.name.toLowerCase().includes(result.colorName.toLowerCase())
      ? result.name
      : `${result.name} ${result.colorName || ''}`.trim();
    form.setValue('name', cleanName);
    if (result.gtin) {
      form.setValue('barcode', result.gtin);
    }
    if (result.spoolRefill !== undefined && result.spoolRefill !== null) {
      form.setValue('spoolType', result.spoolRefill ? 'spoolless' : 'spooled');
    }
    if (result.weightGrams) {
      const kg = Number((result.weightGrams / 1000).toFixed(2));
      form.setValue('totalWeight', kg);
      setTotalWeight(kg);
      setCustomWeightVisible(!STANDARD_WEIGHTS.includes(kg));
    }
    setCommunitySearchQuery("");
  };

  // Helper to calculate remaining weight
  const calculateRemainingWeight = () => {
    const total = typeof totalWeight === 'number' ? totalWeight : parseFloat(String(totalWeight)) || 0;
    return ((total * remainingPercentage) / 100).toFixed(2);
  };

  // Length remaining, given the selected material's density and diameter —
  // only computable once density is known (materials.density is optional).
  const calculateRemainingLength = (): string | null => {
    const materialName = form.watch('material');
    const density = materials.find((m) => m.name === materialName)?.density;
    const diameterMm = form.watch('diameter');
    const densityGCm3 = Number(density);
    if (!density || isNaN(densityGCm3) || densityGCm3 <= 0 || !diameterMm) return null;

    const remainingWeightGrams = Number(calculateRemainingWeight()) * 1000;
    const radiusCm = (diameterMm / 10) / 2;
    const crossSectionAreaCm2 = Math.PI * radiusCm * radiusCm;
    const lengthCm = (remainingWeightGrams / densityGCm3) / crossSectionAreaCm2;
    return (lengthCm / 100).toFixed(1);
  };

  // Handle total weight selection
  const handleTotalWeightChange = (value: string) => {
    if (value === 'custom') {
      setCustomWeightVisible(true);
      // Keep existing value if already in custom mode
      return;
    }

    setCustomWeightVisible(false);
    const numericValue = parseFloat(value);
    setTotalWeight(numericValue);
    form.setValue('totalWeight', numericValue);
  };

  // Handle custom weight input
  const handleCustomWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTotalWeight(value === '' ? '' : parseFloat(value) || 0);
      form.setValue('totalWeight', value === '' ? 0 : parseFloat(value) || 0);
    }
  };

  // Applies scanned filament data (from QR code or NFC tag) to the form; shared by both scan sources
  const applyScannedFilamentData = (data: any) => {
    if (!data.name || !data.material) return;

    form.setValue('name', data.name);
    if (data.manufacturer) {
      const match = findSimilarManufacturers(data.manufacturer, manufacturers, genericStopWords);
      if (match.exactMatch) {
        applyManufacturerData(match.exactMatch.name);
      } else if (match.similarMatches.length > 0) {
        applyManufacturerData(data.manufacturer);
        setSimilarManufacturerPrompt({
          scannedManufacturer: data.manufacturer,
          similar: match.similarMatches,
        });
      } else {
        applyManufacturerData(data.manufacturer);
      }
    }
    if (data.material) {
      const matMatch = findSimilarMaterials(data.material, allAvailableMaterials, genericStopWords);
      if (matMatch.exactMatch) {
        applyMaterialData(matMatch.exactMatch.name);
      } else if (matMatch.similarMatches.length > 0) {
        applyMaterialData(data.material);
        setSimilarMaterialPrompt({
          scannedMaterial: data.material,
          similar: matMatch.similarMatches,
        });
      } else {
        applyMaterialData(data.material);
      }
    }
    if (data.colorName || data.colorCode) {
      applyColorData(data.colorName, data.colorCode);
    }
    if (data.density) form.setValue('density', data.density);
    if (data.diameter) form.setValue('diameter', Number(data.diameter));
    if (data.printTemp) form.setValue('printTemp', data.printTemp);
    if (data.barcode) form.setValue('barcode', data.barcode);
    if (data.totalWeight) {
      const weight = Number(data.totalWeight);
      setTotalWeight(weight);
      form.setValue('totalWeight', weight);
      setCustomWeightVisible(!STANDARD_WEIGHTS.includes(weight));
    }
  };

  // Handler for QR code scan
  const handleQRCodeScanned = async (decodedText: string) => {
    setShowQRScanner(false);

    // Case 0: Filadex URL (e.g. printed label with ?openFilament=123)
    const openFilamentMatch = decodedText.match(/[?&]openFilament=(\d+)/);
    if (openFilamentMatch) {
      const filamentId = Number(openFilamentMatch[1]);
      try {
        const existing = await apiRequest<Filament>(`/api/filaments/${filamentId}`);
        if (existing) {
          applyScannedFilamentData({
            name: existing.name,
            manufacturer: existing.manufacturer,
            material: existing.material,
            colorName: existing.colorName,
            colorCode: existing.colorCode,
            diameter: existing.diameter,
            printTemp: existing.printTemp,
            barcode: existing.barcode,
            totalWeight: existing.totalWeight,
          });
          toast({
            title: existing.name,
            description: existing.manufacturer ? `${existing.manufacturer} • ${existing.material}` : existing.material,
          });
          return;
        }
      } catch (err: any) {
        if (err?.status !== 404) {
          toast({
            variant: "destructive",
            title: t('common.error') || 'Error',
            description: err?.message || 'Failed to fetch filament from label',
          });
          return;
        }
      }
    }

    // Case 1: Structured JSON QR code
    let parsed: any = null;
    try {
      parsed = JSON.parse(decodedText);
    } catch {
      // Non-JSON string - query OFD GTIN lookup
    }

    if (parsed && typeof parsed === "object" && (parsed.name || parsed.material)) {
      applyScannedFilamentData(parsed);
      return;
    }

    // Case 2: 1D/2D Barcode GTIN lookup
    const code = (parsed && typeof parsed === "object" && parsed.barcode ? parsed.barcode : decodedText).trim();
    try {
      const currentDiameter = form.getValues('diameter');
      const currentWeight = form.getValues('totalWeight');
      const currentSpoolType = form.getValues('spoolType');
      const params = new URLSearchParams();
      if (currentDiameter) params.set('diameter', String(currentDiameter));
      if (currentWeight) params.set('weightGrams', String(Math.round(currentWeight * 1000)));
      if (currentSpoolType) params.set('spoolRefill', String(currentSpoolType === 'spoolless'));
      const query = params.toString() ? `?${params.toString()}` : '';

      const result = await apiRequest<CommunityFilamentResult>(
        `/api/community-filaments/gtin/${encodeURIComponent(code)}${query}`
      );
      if (result) {
        handleUseCommunityResult(result);
        if (result.candidates && result.candidates.length > 1) {
          setVariantCandidateBarcode(code);
          setVariantCandidates(result.candidates);
        } else {
          toast({
            title: t('scanner.foundInOfd', { name: `${result.manufacturer} - ${result.name}` }),
          });
        }
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
      // Only 404 status falls through to "not recognized" flow
    }

    form.setValue('barcode', code);
    toast({
      variant: "destructive",
      title: t('scanner.notFoundAllSources', { code }),
    });
  };


  // Handler für NFC Scan
  const handleNFCScanned = (data: any) => {
    setShowNFCScanner(false);
    try {
      const textRecords = data.records.filter((record: any) => record.type === 'text');
      if (textRecords.length > 0) {
        applyScannedFilamentData(JSON.parse(textRecords[0].text));
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten des NFC-Tags:', error);
    }
  };

  return (
    <>
      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRCodeScanned}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {showNFCScanner && (
        <NFCScanner
          onScanSuccess={handleNFCScanned}
          onClose={() => setShowNFCScanner(false)}
        />
      )}

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
                      handleUseCommunityResult(candidate);
                      setVariantCandidates(null);
                      toast({
                        title: t('scanner.foundInOfd', { name: `${candidate.manufacturer} - ${candidate.name}` }),
                      });
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

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl lg:max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 dark:bg-neutral-900 bg-white"
          aria-describedby="filament-form-description"
        >
          <div className="flex-shrink-0 p-6 pb-4 border-b dark:border-neutral-700 border-gray-200">
            <DialogHeader>
              <DialogTitle>{isEditing ? t('filaments.editFilament') : t('filaments.addFilament')}</DialogTitle>
              <DialogDescription id="filament-form-description">
                {isEditing ? t('filaments.editFilamentDescription') : t('filaments.addFilamentDescription')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Form {...form}>
              <form id="filament-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!isEditing && (
                <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-sm font-medium dark:text-neutral-300 text-gray-700 block">
                      {t('settings.communityFilaments.searchLabel')}
                    </label>
                    <Tabs
                      value={catalogSource}
                      onValueChange={(val) => handleCatalogSourceChange(val as "ofd" | "spoolmandb")}
                    >
                      <TabsList className="grid grid-cols-2 h-8">
                        <TabsTrigger value="ofd" className="text-xs px-2.5 py-1">
                          {t('settings.communityFilaments.sourceOfd')}
                        </TabsTrigger>
                        <TabsTrigger value="spoolmandb" className="text-xs px-2.5 py-1">
                          {t('settings.communityFilaments.sourceSpoolman')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <Input
                    placeholder={t('settings.communityFilaments.searchPlaceholder')}
                    value={communitySearchQuery}
                    onChange={(e) => setCommunitySearchQuery(e.target.value)}
                  />
                  {communitySearchQuery.trim().length >= 2 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {communityResults.length === 0 ? (
                        <p className="text-sm dark:text-neutral-400 text-gray-500">
                          {t('settings.communityFilaments.noResults')}
                        </p>
                      ) : (
                        communityResults.map((result, index) => (
                          <button
                            type="button"
                            key={`${result.id}-${index}`}
                            onClick={() => handleUseCommunityResult(result)}
                            className="w-full text-left text-sm flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-primary/10"
                          >
                            <span className="truncate">
                              {result.manufacturer} — {result.name} ({result.colorName})
                            </span>
                            {result.colorCode && (
                              <span
                                className="inline-block h-3 w-3 rounded-full border flex-shrink-0"
                                style={{ backgroundColor: result.colorCode }}
                              />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t('filaments.name')}*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('filaments.namePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => {
                    const matchingMfg = field.value
                      ? uniqueManufacturers.find(m => m.name.toLowerCase() === field.value!.toLowerCase())
                      : undefined;
                    const isOther = isCustomManufacturer || (Boolean(field.value) && !matchingMfg);
                    const selectValue = isOther ? "Other" : (matchingMfg ? matchingMfg.name : "");
                    return (
                    <FormItem>
                      <FormLabel>{t('filaments.manufacturer')}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "Other") {
                            setIsCustomManufacturer(true);
                            field.onChange(customManufacturerName);
                            form.setValue('manufacturer', customManufacturerName, { shouldValidate: true, shouldDirty: true });
                          } else {
                            setIsCustomManufacturer(false);
                            setCustomManufacturerName("");
                            field.onChange(value);
                            form.setValue('manufacturer', value, { shouldValidate: true, shouldDirty: true });
                          }
                        }}
                        value={isOther ? "Other" : selectValue}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('filaments.selectManufacturer')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="relative">
                            <Input
                              className="mb-2 sticky top-0 z-10"
                              placeholder={t('filaments.searchManufacturer')}
                              onChange={() => {
                                // Only used for search, not for changing value
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const value = (e.target as HTMLInputElement).value?.trim();
                                  if (value) {
                                    const match = findMatchingManufacturer(value, uniqueManufacturers);
                                    if (match) {
                                      setIsCustomManufacturer(false);
                                      setCustomManufacturerName("");
                                      field.onChange(match.name);
                                      form.setValue('manufacturer', match.name, { shouldValidate: true, shouldDirty: true });
                                    } else {
                                      setIsCustomManufacturer(true);
                                      setCustomManufacturerName(value);
                                      field.onChange(value);
                                      form.setValue('manufacturer', value, { shouldValidate: true, shouldDirty: true });
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                          {uniqueManufacturers.map((manufacturer) => (
                            <SelectItem
                              key={manufacturer.id}
                              value={manufacturer.name}
                            >
                              {manufacturer.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">
                            {t('filaments.otherManufacturer') || t('common.other') || 'Other'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isOther && (
                        <div className="mt-2 space-y-2">
                          <Input
                            placeholder={t('filaments.customManufacturerName')}
                            value={customManufacturerName}
                            onChange={(e) => {
                              setCustomManufacturerName(e.target.value);
                              field.onChange(e.target.value);
                              form.setValue('manufacturer', e.target.value, { shouldValidate: true, shouldDirty: true });
                            }}
                          />
                          {customManufacturerName.trim().length > 0 && (
                            <div className="flex items-center space-x-2 pt-1">
                              <Checkbox
                                id="save-custom-manufacturer"
                                checked={saveCustomManufacturer}
                                onCheckedChange={(checked) => setSaveCustomManufacturer(Boolean(checked))}
                              />
                              <label
                                htmlFor="save-custom-manufacturer"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {t('filaments.saveManufacturerToCollection')}
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
                />

                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => {
                    const matchingMat = field.value
                      ? uniqueMaterialOptions.find(m => m.value.toLowerCase() === field.value!.toLowerCase())
                      : undefined;
                    const isCustom = isCustomMaterial || (Boolean(field.value) && !matchingMat);
                    const selectValue = isCustom ? "Custom" : (matchingMat ? matchingMat.value : "");
                    return (
                    <FormItem>
                      <FormLabel>{t('filaments.material')}*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "Custom") {
                            setIsCustomMaterial(true);
                            field.onChange(customMaterialName);
                            form.setValue('material', customMaterialName, { shouldValidate: true, shouldDirty: true });
                          } else {
                            setIsCustomMaterial(false);
                            setCustomMaterialName("");
                            field.onChange(value);
                            form.setValue('material', value, { shouldValidate: true, shouldDirty: true });
                            // Automatically set print temperature
                            if (value in PRINT_TEMPERATURES) {
                              form.setValue('printTemp', PRINT_TEMPERATURES[value as keyof typeof PRINT_TEMPERATURES]);
                            }
                            // Automatically update name if material and color are present
                            const colorName = form.getValues('colorName');
                            if (colorName && value && colorName !== "Custom") {
                              form.setValue('name', `${value} ${colorName}`);
                            }
                          }
                        }}
                        value={isCustom ? "Custom" : selectValue}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('common.pleaseSelect')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="relative">
                            <Input
                              className="mb-2 sticky top-0 z-10"
                              placeholder={t('filaments.searchMaterial')}
                              onChange={() => {
                                // Only used for search, not for changing value
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const value = (e.target as HTMLInputElement).value?.trim();
                                  if (value) {
                                    const match = findMatchingMaterial(value, uniqueMaterialOptions);
                                    if (match) {
                                      setIsCustomMaterial(false);
                                      setCustomMaterialName("");
                                      field.onChange(match.value);
                                      form.setValue('material', match.value, { shouldValidate: true, shouldDirty: true });
                                      if (match.value in PRINT_TEMPERATURES) {
                                        form.setValue('printTemp', PRINT_TEMPERATURES[match.value as keyof typeof PRINT_TEMPERATURES]);
                                      }
                                    } else {
                                      setIsCustomMaterial(true);
                                      setCustomMaterialName(value);
                                      field.onChange(value);
                                      form.setValue('material', value, { shouldValidate: true, shouldDirty: true });
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                          {uniqueMaterialOptions.map((material) => (
                            <SelectItem key={material.id ?? material.value} value={material.value}>
                              {material.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="Custom">
                            {t('common.custom')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustom && (
                        <div className="mt-2 space-y-2">
                          <Input
                            placeholder={t('filaments.customMaterialName')}
                            value={customMaterialName}
                            onChange={(e) => {
                              setCustomMaterialName(e.target.value);
                              field.onChange(e.target.value);
                              form.setValue('material', e.target.value, { shouldValidate: true, shouldDirty: true });
                            }}
                          />
                          {customMaterialName.trim().length > 0 && (
                            <div className="flex items-center space-x-2 pt-1">
                              <Checkbox
                                id="save-custom-material"
                                checked={saveCustomMaterial}
                                onCheckedChange={(checked) => setSaveCustomMaterial(Boolean(checked))}
                              />
                              <label
                                htmlFor="save-custom-material"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {t('filaments.saveMaterialToCollection')}
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
                />

                <FormField
                  control={form.control}
                  name="colorName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t('filaments.color')}*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "Custom") {
                            setIsCustomColor(true);
                            field.onChange(customColorName);
                            form.setValue('colorName', customColorName, { shouldValidate: true, shouldDirty: true });
                          } else {
                            setIsCustomColor(false);
                            setCustomColorName("");
                            field.onChange(value);
                            // Automatically set color code from database or predefined colors
                            const colorObj = uniqueColors.find(c => c.name === value) || colorsList.find(c => c.name === value);
                            if (colorObj) {
                              form.setValue('colorCode', colorObj.code, { shouldValidate: true, shouldDirty: true });
                            }
                            // Automatically update name if material and color are present
                            const material = form.getValues('material');
                            if (material && value) {
                              form.setValue('name', `${material} ${value}`);
                            }
                          }
                        }}
                        defaultValue={isCustomColor ? "Custom" : field.value}
                        value={isCustomColor ? "Custom" : (field.value || "")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('filaments.selectColor')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <div className="relative">
                            <Input
                              className="mb-2 sticky top-0 z-10"
                              placeholder={t('filaments.searchColor')}
                              onChange={() => {
                                // Only used for search, not for changing value
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const value = (e.target as HTMLInputElement).value;
                                  if (value) {
                                    field.onChange(value);
                                  }
                                }
                              }}
                            />
                          </div>
                          {/* Database colors */}
                          {uniqueColors.map((color) => (
                            <SelectItem key={color.id} value={color.name}>
                              <div className="flex items-center">
                                <div
                                  className="h-4 w-4 rounded-full mr-2 border border-neutral-300"
                                  style={{ backgroundColor: color.code }}
                                />
                                {color.name}
                              </div>
                            </SelectItem>
                          ))}

                          {/* Add predefined colors that don't exist in the database */}
                          {colorsList
                            .filter(predefinedColor =>
                              !uniqueColors.some(dbColor =>
                                dbColor.name.toLowerCase() === predefinedColor.name.toLowerCase()
                              )
                            )
                            .map((color) => (
                              <SelectItem key={color.name} value={color.name}>
                                <div className="flex items-center">
                                  <div
                                    className="h-4 w-4 rounded-full mr-2 border border-neutral-300"
                                    style={{
                                      backgroundColor: color.code,
                                      opacity: color.opacity || 1
                                    }}
                                  />
                                  {color.name}
                                </div>
                              </SelectItem>
                            ))}
                          <SelectItem value="Custom">
                            <div className="flex items-center">
                              <div className="h-4 w-4 rounded-full mr-2 border border-neutral-300 bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />
                              {t('common.custom')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomColor && (
                        <div className="mt-2">
                          <Input
                            placeholder={t('filaments.customColorName')}
                            value={customColorName}
                            onChange={(e) => {
                              setCustomColorName(e.target.value);
                              field.onChange(e.target.value);
                            }}
                          />
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="colorCode"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t('filaments.colorCode')}</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <Input
                            type="color"
                            title={t('filaments.colorCode')}
                            className="h-10 w-10 p-0.5 border border-neutral-200 rounded-md cursor-pointer shrink-0"
                            value={field.value && /^#[0-9A-Fa-f]{6}$/.test(field.value) ? field.value : "#000000"}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                            }}
                          />
                          <Input
                            className="flex-grow ml-2"
                            placeholder="#000000"
                            aria-label={t('filaments.colorCode')}
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="diameter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('filaments.diameter')} (mm)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseFloat(value))}
                        defaultValue={field.value ? field.value.toString() : "1.75"}
                        value={field.value ? field.value.toString() : "1.75"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('filaments.selectDiameter')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {diameters.map((diameter) => (
                            <SelectItem
                              key={diameter.id}
                              value={diameter.value}
                            >
                              {diameter.value}mm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="printTemp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('filaments.printTemp')} ({getTemperatureUnitSymbol(temperatureUnit)})</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('filaments.printTempPlaceholder')}
                          {...field}
                          onChange={(e) => {
                            // Convert temperature if needed when user types
                            const value = e.target.value;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200">
                  <h4 className="font-medium dark:text-neutral-400 text-gray-700 mb-3">{t('filaments.quantity')}</h4>
                  <div className="space-y-4">
                    <div>
                      <FormLabel>{t('filaments.totalWeight')} (kg)*</FormLabel>
                      <Select
                        onValueChange={handleTotalWeightChange}
                        defaultValue={customWeightVisible ? "custom" : totalWeight.toString()}
                        value={customWeightVisible ? "custom" : totalWeight.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('filaments.selectTotalWeight')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0.25">0.25kg</SelectItem>
                          <SelectItem value="0.5">0.5kg</SelectItem>
                          <SelectItem value="0.75">0.75kg</SelectItem>
                          <SelectItem value="1">1kg</SelectItem>
                          <SelectItem value="1.5">1.5kg</SelectItem>
                          <SelectItem value="2">2kg</SelectItem>
                          <SelectItem value="2.5">2.5kg</SelectItem>
                          <SelectItem value="3">3kg</SelectItem>
                          <SelectItem value="5">5kg</SelectItem>
                          <SelectItem value="custom">{t('common.custom')}</SelectItem>
                        </SelectContent>
                      </Select>

                      {customWeightVisible && (
                        <div className="mt-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.1"
                            placeholder={t('filaments.enterWeightInKg')}
                            value={typeof totalWeight === 'number' ? totalWeight : ''}
                            onChange={handleCustomWeightChange}
                          />
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="remainingPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('filaments.remainingPercentage')} (%)*</FormLabel>
                          <div className="flex items-center">
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                min={0}
                                max={100}
                                step={5}
                                onValueChange={(values) => {
                                  const value = values[0];
                                  field.onChange(value);
                                  setRemainingPercentage(value);
                                }}
                                className="w-full mr-2"
                              />
                            </FormControl>
                            <span className="font-medium dark:text-neutral-400 text-gray-700 w-10 text-right">
                              {field.value}%
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="dark:text-neutral-300 text-gray-600">{t('filaments.equivalentTo')}:</span>
                        <span className="font-medium dark:text-neutral-400 text-gray-700">
                          {calculateRemainingWeight()}kg
                          {calculateRemainingLength() && ` (~${calculateRemainingLength()}m)`}
                        </span>
                      </div>
                    </div>

                    {isEditing && (
                      <div>
                        <label className="text-sm dark:text-neutral-300 text-gray-600 mb-1 block">
                          {t('filaments.usageNote') || 'Note (optional)'}
                        </label>
                        <Input
                          type="text"
                          placeholder={t('filaments.usageNotePlaceholder') || 'e.g. printing cover piece'}
                          value={usageNote}
                          onChange={(e) => setUsageNote(e.target.value)}
                        />
                      </div>
                    )}

                    {isEditing && (
                      <div className="border-t dark:border-neutral-700 border-gray-200 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowHistory((prev) => !prev)}
                          className="text-sm font-medium dark:text-neutral-300 text-gray-700 hover:underline"
                        >
                          {showHistory ? '▾' : '▸'} {t('filaments.usageHistory') || 'History'}
                        </button>
                        {showHistory && (
                          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                            {usageLog.length === 0 ? (
                              <p className="text-sm dark:text-neutral-400 text-gray-500">
                                {t('filaments.noUsageHistory') || 'No changes recorded yet.'}
                              </p>
                            ) : (
                              usageLog.map((entry) => (
                                <div key={entry.id} className="text-sm flex justify-between gap-2 dark:text-neutral-300 text-gray-700">
                                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                                  <span className="font-medium">
                                    {Number(entry.deltaWeight) > 0 ? '+' : ''}{Number(entry.deltaWeight).toFixed(1)}g → {entry.remainingPercentageAfter}%
                                  </span>
                                  {entry.note && <span className="italic dark:text-neutral-400 text-gray-500 truncate">{entry.note}</span>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200">
                  <h4 className="font-medium dark:text-neutral-400 text-gray-700 mb-3">{t('filaments.additionalInfo')}</h4>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('filaments.purchaseDate')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={
                                  "w-full pl-3 text-left font-normal flex justify-between"
                                }
                              >
                                {field.value ? (
                                  format(field.value, "dd.MM.yyyy", { locale: DATE_LOCALES[language] })
                                ) : (
                                  <span className="dark:text-neutral-400 text-gray-500">{t('common.selectDate')}</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center" side="bottom" sideOffset={5} avoidCollisions={false}>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              locale={DATE_LOCALES[language]}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <FormField
                      control={form.control}
                      name="purchasePrice"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('filaments.purchasePrice')} ({formatCurrency(0, currency).replace('0', '').trim()})</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={t('filaments.purchasePricePlaceholder')}
                            value={field.value !== undefined ? field.value : ''}
                            onChange={(e) => {
                              const value = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <FormField
                      control={form.control}
                      name="storageLocation"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('filaments.storageLocation')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('filaments.selectStorageLocation')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <div className="relative">
                              <Input
                                className="mb-2 sticky top-0 z-10"
                                placeholder={t('filaments.enterStorageLocation')}
                                onChange={() => {
                                  // Only used for search, not for changing value
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const value = (e.target as HTMLInputElement).value;
                                    if (value) {
                                      field.onChange(value);
                                    }
                                  }
                                }}
                              />
                            </div>
                            {storageLocations.map((location) => (
                              <SelectItem
                                key={location}
                                value={location}
                              >
                                {location}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem className="flex flex-col md:col-span-2">
                          <FormLabel>{t('filaments.barcode')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('filaments.barcodePlaceholder')}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {customFieldDefinitions.length > 0 && (
                <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200">
                  <h4 className="font-medium dark:text-neutral-400 text-gray-700 mb-3">{t('settings.customFields.title')}</h4>
                  <div className="space-y-4">
                    {customFieldDefinitions.map((def) => (
                      <div key={def.id}>
                        <label className="text-sm dark:text-neutral-300 text-gray-600 mb-1 block">{def.name}</label>
                        {def.fieldType === "boolean" ? (
                          <Checkbox
                            checked={!!customFieldValues[def.id]}
                            onCheckedChange={(checked) =>
                              setCustomFieldValues((prev) => ({ ...prev, [def.id]: !!checked }))
                            }
                          />
                        ) : (
                          <Input
                            type={def.fieldType === "number" ? "number" : def.fieldType === "date" ? "date" : "text"}
                            value={customFieldValues[def.id] ?? ""}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [def.id]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200">
                <h4 className="font-medium dark:text-neutral-400 text-gray-700 mb-3">{t('filaments.status')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('filaments.packaging')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('common.pleaseSelect')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sealed">{t('filaments.sealed')}</SelectItem>
                            <SelectItem value="opened">{t('filaments.opened')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="spoolType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('filaments.spoolType')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('common.pleaseSelect')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="spooled">{t('filaments.spooled')}</SelectItem>
                            <SelectItem value="spoolless">{t('filaments.spoolless')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h4 className="font-medium dark:text-neutral-400 text-gray-700 mb-3 mt-4">{t('filaments.drying')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dryerCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('filaments.dryerCount')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {t('filaments.dryerCountDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastDryingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('filaments.lastDryingDate')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd.MM.yyyy", { locale: DATE_LOCALES[language] })
                                ) : (
                                  <span>{t('common.noDate')}</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center" side="bottom" sideOffset={5} avoidCollisions={false}>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={DATE_LOCALES[language]}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription className="text-xs">
                          {t('filaments.lastDryingDateDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              </form>
            </Form>
          </div>

          <div className="flex-shrink-0 p-6 pt-4 border-t dark:border-neutral-700 border-gray-200">
            <DialogFooter className="pt-0">
              <div className="flex items-center mr-auto space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowQRScanner(true)}
                  title={t('common.scanQRCode')}
                  aria-label={t('common.scanQRCode')}
                >
                  <Scan className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNFCScanner(true)}
                  title={t('common.scanNFC')}
                  aria-label={t('common.scanNFC')}
                >
                  <ScanFace className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="filament-form">
                {t('common.save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {similarManufacturerPrompt && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setSimilarManufacturerPrompt(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('scanner.similarManufacturerTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('scanner.similarManufacturerDescription', {
                  scanned: similarManufacturerPrompt.scannedManufacturer,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 my-2 max-h-[50vh] overflow-y-auto pr-1">
              <Button
                variant="outline"
                className="justify-start text-left h-auto py-2 px-3 whitespace-normal"
                onClick={() => {
                  applyManufacturerData(similarManufacturerPrompt.scannedManufacturer);
                  setSimilarManufacturerPrompt(null);
                }}
              >
                {t('scanner.createNewManufacturer', { name: similarManufacturerPrompt.scannedManufacturer })}
              </Button>
              {similarManufacturerPrompt.similar.map((sim) => (
                <Button
                  key={sim.id ?? sim.name}
                  variant="secondary"
                  className="justify-start text-left h-auto py-2 px-3 whitespace-normal"
                  onClick={() => {
                    applyManufacturerData(sim.name);
                    const currentName = form.getValues('name');
                    const scanned = similarManufacturerPrompt.scannedManufacturer;
                    const bStart = /^\w/.test(scanned) ? '\\b' : '';
                    const bEnd = /\w$/.test(scanned) ? '\\b' : '';
                    const pattern = new RegExp(`${bStart}${escapeRegex(scanned)}${bEnd}`, 'gi');
                    if (pattern.test(currentName)) {
                      pattern.lastIndex = 0;
                      form.setValue('name', currentName.replace(pattern, () => sim.name));
                    }
                    setSimilarManufacturerPrompt(null);
                  }}
                >
                  {t('scanner.useExistingManufacturer', { name: sim.name })}
                </Button>
              ))}
            </div>
            <AlertDialogFooter>
              <Button
                variant="ghost"
                onClick={() => setSimilarManufacturerPrompt(null)}
              >
                {t('common.cancel')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {!similarManufacturerPrompt && similarMaterialPrompt && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setSimilarMaterialPrompt(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('scanner.similarMaterialTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('scanner.similarMaterialDescription', {
                  scanned: similarMaterialPrompt.scannedMaterial,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 my-2 max-h-[50vh] overflow-y-auto pr-1">
              <Button
                variant="outline"
                className="justify-start text-left h-auto py-2 px-3 whitespace-normal"
                onClick={() => {
                  applyMaterialData(similarMaterialPrompt.scannedMaterial);
                  setSimilarMaterialPrompt(null);
                }}
              >
                {t('scanner.createNewMaterial', { name: similarMaterialPrompt.scannedMaterial })}
              </Button>
              {similarMaterialPrompt.similar.map((sim) => (
                <Button
                  key={sim.id ?? sim.name}
                  variant="secondary"
                  className="justify-start text-left h-auto py-2 px-3 whitespace-normal"
                  onClick={() => {
                    applyMaterialData(sim.name);
                    if (!form.getValues('printTemp') && sim.name in PRINT_TEMPERATURES) {
                      form.setValue('printTemp', PRINT_TEMPERATURES[sim.name as keyof typeof PRINT_TEMPERATURES]);
                    }
                    const currentName = form.getValues('name');
                    const scanned = similarMaterialPrompt.scannedMaterial;
                    const bStart = /^\w/.test(scanned) ? '\\b' : '';
                    const bEnd = /\w$/.test(scanned) ? '\\b' : '';
                    const pattern = new RegExp(`${bStart}${escapeRegex(scanned)}${bEnd}`, 'gi');
                    if (pattern.test(currentName)) {
                      pattern.lastIndex = 0;
                      form.setValue('name', currentName.replace(pattern, () => sim.name));
                    }
                    setSimilarMaterialPrompt(null);
                  }}
                >
                  {t('scanner.useExistingMaterial', { name: sim.name })}
                </Button>
              ))}
            </div>
            <AlertDialogFooter>
              <Button
                variant="ghost"
                onClick={() => setSimilarMaterialPrompt(null)}
              >
                {t('common.cancel')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}