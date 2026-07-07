import { useState, useEffect } from "react";
import { Filament, InsertFilament, insertFilamentSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { CalendarIcon, Scan, ScanFace, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";

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
  { value: "PEI", label: "PEI/ULTEM" },
  { value: "OTHER", label: t('settings.materials.other') || 'Other' }
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRScanner } from "./qr-scanner";
import { NFCScanner } from "./nfc-scanner";
import { useUnits } from "@/lib/use-units";
import { formatCurrency, formatTemperature, getTemperatureUnitSymbol, convertTemperature } from "@/lib/units";

// Create a custom schema for the form with translations
const createFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('filaments.nameRequired')),
  manufacturer: z.string().optional(),
  material: z.string().min(1, t('filaments.materialRequired')),
  colorName: z.string().min(1, t('filaments.colorRequired')),
  colorCode: z.string().optional(),
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

interface CommunityFilamentResult {
  id: number;
  manufacturer: string;
  material: string;
  name: string;
  colorName: string;
  colorCode: string | null;
  diameter: string | null;
  extruderTemp: number | null;
  bedTemp: number | null;
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
  const { currency, temperatureUnit } = useUnits();
  const isEditing = !!filament;
  const [remainingPercentage, setRemainingPercentage] = useState(100);
  const [totalWeight, setTotalWeight] = useState<number | string>(1);
  const [customWeightVisible, setCustomWeightVisible] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNFCScanner, setShowNFCScanner] = useState(false);
  const [usageNote, setUsageNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");

  const { data: communityResults = [] } = useQuery<CommunityFilamentResult[]>({
    queryKey: [`/api/community-filaments/search?q=${encodeURIComponent(communitySearchQuery)}`],
    queryFn: () => apiRequest<CommunityFilamentResult[]>(`/api/community-filaments/search?q=${encodeURIComponent(communitySearchQuery)}`),
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

  // Setup form with default values or editing values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: filament?.name || "",
      manufacturer: filament?.manufacturer || "",
      material: filament?.material || "",
      colorName: filament?.colorName || "",
      colorCode: filament?.colorCode || "#000000",
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
      storageLocation: filament?.storageLocation || ""
    },
  });

  // Update form when filament changes
  useEffect(() => {
    if (filament) {
      form.reset({
        name: filament.name,
        manufacturer: filament.manufacturer || "",
        material: filament.material,
        colorName: filament.colorName,
        colorCode: filament.colorCode || "#000000",
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
        storageLocation: filament.storageLocation || ""
      });

      setRemainingPercentage(Number(filament.remainingPercentage));
      setTotalWeight(Number(filament.totalWeight));

      // Check if we need to show custom weight field
      if (!STANDARD_WEIGHTS.includes(Number(filament.totalWeight))) {
        setCustomWeightVisible(true);
      }
    } else {
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
        storageLocation: ""
      });
      setRemainingPercentage(100);
      setTotalWeight(1);
      setCustomWeightVisible(false);
    }
    setUsageNote("");
    setShowHistory(false);
    setCustomFieldValues((filament?.customFieldValues as Record<string, any>) || {});
  }, [filament, form]);

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    // Handle custom weight
    if (customWeightVisible && typeof totalWeight === 'number') {
      data.totalWeight = totalWeight;
    }

    const withCustomFields = { ...data, customFieldValues };
    onSave(usageNote.trim() ? { ...withCustomFields, note: usageNote.trim() } : withCustomFields);
  };

  // Pre-fill the form from a picked community database entry
  const handleUseCommunityResult = (result: CommunityFilamentResult) => {
    form.setValue('manufacturer', result.manufacturer);
    form.setValue('material', result.material);
    form.setValue('colorName', result.colorName);
    if (result.colorCode) form.setValue('colorCode', result.colorCode);
    if (result.diameter) form.setValue('diameter', Number(result.diameter));
    if (result.extruderTemp) {
      form.setValue('printTemp', result.bedTemp
        ? `${result.extruderTemp}°C / Bed ${result.bedTemp}°C`
        : `${result.extruderTemp}°C`);
    }
    const mfgText = result.manufacturer ? ` (${result.manufacturer})` : '';
    form.setValue('name', `${result.name} ${result.colorName}${mfgText}`);
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
    if (!density || !diameterMm) return null;

    const remainingWeightGrams = Number(calculateRemainingWeight()) * 1000;
    const densityGCm3 = Number(density);
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
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setTotalWeight(value);
      form.setValue('totalWeight', value);
    }
  };

  // Applies scanned filament data (from QR code or NFC tag) to the form; shared by both scan sources
  const applyScannedFilamentData = (data: any) => {
    if (!data.name || !data.material) return;

    form.setValue('name', data.name);
    if (data.manufacturer) form.setValue('manufacturer', data.manufacturer);
    if (data.material) form.setValue('material', data.material);
    if (data.colorName) form.setValue('colorName', data.colorName);
    if (data.colorCode) form.setValue('colorCode', data.colorCode);
    if (data.diameter) form.setValue('diameter', Number(data.diameter));
    if (data.printTemp) form.setValue('printTemp', data.printTemp);
    if (data.totalWeight) {
      const weight = Number(data.totalWeight);
      setTotalWeight(weight);
      form.setValue('totalWeight', weight);
      setCustomWeightVisible(!STANDARD_WEIGHTS.includes(weight));
    }
  };

  // Handler for QR code scan
  const handleQRCodeScanned = (decodedText: string) => {
    setShowQRScanner(false);
    try {
      applyScannedFilamentData(JSON.parse(decodedText));
    } catch (error) {
      console.error('Fehler beim Verarbeiten des QR-Codes:', error);
    }
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
                <div className="border rounded-md p-4 dark:bg-neutral-900 bg-gray-50 dark:border-neutral-700 border-gray-200">
                  <label className="text-sm font-medium dark:text-neutral-300 text-gray-700 mb-1 block">
                    {t('settings.communityFilaments.searchLabel')}
                  </label>
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
                        communityResults.map((result) => (
                          <button
                            type="button"
                            key={`${result.id}`}
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('filaments.manufacturer')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={typeof field.value === 'string' ? field.value : ''}
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
                                  const value = (e.target as HTMLInputElement).value;
                                  if (value) {
                                    field.onChange(value);
                                  }
                                }
                              }}
                            />
                          </div>
                          {manufacturers.map((manufacturer) => (
                            <SelectItem
                              key={manufacturer.id}
                              value={manufacturer.name}
                            >
                              {manufacturer.name}
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
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('filaments.material')}*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Automatically set print temperature
                          if (value in PRINT_TEMPERATURES) {
                            form.setValue('printTemp', PRINT_TEMPERATURES[value as keyof typeof PRINT_TEMPERATURES]);
                          }
                          // Automatically update name if material and color are present
                          const colorName = form.getValues('colorName');
                          const manufacturer = form.getValues('manufacturer');
                          if (colorName && value) {
                            const mfgText = manufacturer ? ` ${manufacturer}` : '';
                            form.setValue('name', `${value} ${colorName}${mfgText}`);
                          }
                        }}
                        defaultValue={field.value}
                        value={field.value}
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
                                  const value = (e.target as HTMLInputElement).value;
                                  if (value) {
                                    field.onChange(value);
                                  }
                                }
                              }}
                            />
                          </div>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.name}>
                              {material.name}
                            </SelectItem>
                          ))}
                          {/* Add predefined material types */}
                          {materialTypes.map((material) => (
                            <SelectItem key={material.value} value={material.value}>
                              {material.label}
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
                  name="colorName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t('filaments.color')}*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Automatically set color code
                          const colorObj = colors.find(c => c.name === value);
                          if (colorObj) {
                            form.setValue('colorCode', colorObj.code);
                          }
                          // Automatically update name if material and color are present
                          const material = form.getValues('material');
                          const manufacturer = form.getValues('manufacturer');
                          if (material && value) {
                            const mfgText = manufacturer ? ` ${manufacturer}` : '';
                            form.setValue('name', `${material} ${value}${mfgText}`);
                          }
                        }}
                        defaultValue={field.value}
                        value={field.value}
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
                          {colors.map((color) => (
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
                              !colors.some(dbColor =>
                                dbColor.name.toLowerCase() === predefinedColor.name.toLowerCase()
                              )
                            )
                            .map((color) => (
                              <SelectItem key={color.code} value={color.name}>
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
                      {field.value === "Custom" && (
                        <div className="mt-2">
                          <Input
                            placeholder={t('filaments.customColorName')}
                            onChange={(e) => field.onChange(e.target.value)}
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
                        <div className="flex">
                          <Input
                            type="color"
                            className="h-10 w-10 p-0.5 border border-neutral-200 rounded-md cursor-pointer"
                            {...field}
                          />
                          <Input
                            className="flex-grow ml-2"
                            placeholder="#000000"
                            value={field.value}
                            onChange={(e) => {
                              // Validate hex color code format
                              if (e.target.value.match(/^#[0-9A-F]{6}$/i) || e.target.value === "") {
                                field.onChange(e.target.value);
                              }
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
                                  format(field.value, "dd.MM.yyyy", { locale: language === 'de' ? de : enUS })
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
                              locale={language === 'de' ? de : enUS}
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
                                  format(field.value, "dd.MM.yyyy", { locale: language === 'de' ? de : enUS })
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
                              locale={language === 'de' ? de : enUS}
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
    </>
  );
}