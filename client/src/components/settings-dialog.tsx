import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { FilamentImportExport } from "./filament-import-export";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Plus, Trash2, Search, X, Upload, AlertTriangle, Info, FileText, Download, GripVertical } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Filament } from "@shared/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/i18n";

// Liste der Bambulab Materialtypen
const MATERIAL_TYPES = [
  { value: "PLA", label: "PLA" },
  { value: "PETG", label: "PETG" },
  { value: "ABS", label: "ABS" },
  { value: "TPU", label: "TPU" },
  { value: "ASA", label: "ASA" },
  { value: "PA", label: "PA (Nylon)" },
  { value: "PC", label: "PC (Polycarbonat)" },
  { value: "PVA", label: "PVA" },
  { value: "HIPS", label: "HIPS" },
  { value: "PLA-CF", label: "PLA-CF (Karbon)" },
  { value: "PA-CF", label: "PA-CF (Nylon Karbon)" },
  { value: "PETG-CF", label: "PETG-CF (Karbon)" },
  { value: "PET-CF", label: "PET-CF (Karbon)" },
  { value: "PLA-HF", label: "PLA-HF (HighFlow)" },
  { value: "PP", label: "PP (Polypropylen)" },
  { value: "PETG-HF", label: "PETG-HF (HighFlow)" },
  { value: "PPS", label: "PPS" },
  { value: "PEEK", label: "PEEK" },
  { value: "PEI", label: "PEI/ULTEM" },
  { value: "OTHER", label: "Anderes" }
];

// Import/Export Komponente
interface ImportExportProps {
  endpoint: string;
  csvFormat: string;
  hasHeaders?: boolean;
  fields: string[];
  title?: string;
}

function ImportExportCard({ endpoint, csvFormat, hasHeaders = true, fields, title = "Import/Export" }: ImportExportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const { t } = useTranslation();
  const [csvUploadStatus, setCsvUploadStatus] = useState<{
    status: "idle" | "processing" | "success" | "error";
    message: string;
    added: number;
    skipped: number;
    errored: number;
  }>({
    status: "idle",
    message: "",
    added: 0,
    skipped: 0,
    errored: 0
  });

  // CSV Import Handler
  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Set status to 'processing'
    setCsvUploadStatus({
      status: "processing",
      message: t('common.importExport.processing'),
      added: 0,
      skipped: 0,
      errored: 0
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvData = e.target?.result as string;

        // Sende Daten an den Server
        const result = await apiRequest(`${endpoint}?import=csv`, {
          method: "POST",
          body: JSON.stringify({ csvData })
        });

        // Update status
        setCsvUploadStatus({
          status: "success",
          message: t('common.importExport.successMessage', {
            created: result.created,
            duplicates: result.duplicates,
            errors: result.errors
          }),
          added: result.created,
          skipped: result.duplicates,
          errored: result.errors
        });

        // Invalidiere Queries, um Daten neu zu laden
        queryClient.invalidateQueries({ queryKey: [endpoint] });
        queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      } catch (error) {
        console.error("Error processing CSV file:", error);
        setCsvUploadStatus({
          status: "error",
          message: t('common.importExport.errorMessage'),
          added: 0,
          skipped: 0,
          errored: 0
        });
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (event.target) {
      event.target.value = "";
    }
  };

  // CSV Export Handler
  const handleExport = async () => {
    try {
      // CSV über API abholen
      window.location.href = `${endpoint}?export=csv`;
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: t('common.importExport.exportErrorTitle'),
        description: t('common.importExport.exportErrorDescription'),
        variant: "destructive"
      });
    }
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      value={importExportOpen}
      onValueChange={setImportExportOpen}
    >
      <AccordionItem value="import-export" className="border-b-0">
        <AccordionTrigger className="py-2 hover:no-underline">
          <div className="flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            <span>{title}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('common.importExport.csvFormatTitle')}</AlertTitle>
              <AlertDescription className="text-xs">
                {t('common.importExport.csvFormatDescription')}
                <pre className="mt-2 p-2 dark:bg-neutral-900 bg-gray-100 rounded text-xs overflow-x-auto dark:text-white text-gray-800">
                  {csvFormat}
                </pre>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                disabled={csvUploadStatus.status === "processing"}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('common.importExport.importButton')}
              </Button>

              <Button
                onClick={handleExport}
                className="w-full bg-emerald-900/20 hover:bg-emerald-900/30 text-white border-white/20"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('common.importExport.exportButton')}
              </Button>
            </div>

            {csvUploadStatus.status !== "idle" && (
              <Alert className={csvUploadStatus.status === "error" ? "bg-red-900/20" :
                            csvUploadStatus.status === "success" ? "bg-green-900/20" :
                            "bg-yellow-900/20"}>
                {csvUploadStatus.status === "error" && <AlertTriangle className="h-4 w-4" />}
                {csvUploadStatus.status === "success" && <FileText className="h-4 w-4" />}
                {csvUploadStatus.status === "processing" && <span className="animate-pulse">⏳</span>}
                <AlertTitle>
                  {csvUploadStatus.status === "error" ? t('common.importExport.errorTitle') :
                  csvUploadStatus.status === "success" ? t('common.importExport.successTitle') :
                  t('common.importExport.processingTitle')}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {csvUploadStatus.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// Liste bekannter Filament-Hersteller
const MANUFACTURERS = [
  "Bambu Lab",
  "Prusament",
  "Polymaker",
  "Overture",
  "Sunlu",
  "eSun",
  "Eryone",
  "3DJake",
  "3DJAKE",
  "Filamentum",
  "Filament PM",
  "Fiberlogy",
  "FormFutura",
  "Verbatim",
  "ColorFabb",
  "BASF",
  "Fillamentum",
  "Das Filament",
  "Extrudr",
  "3D Warhorse",
  "3D-Fuel",
  "3DXTECH",
  "AddNorth",
  "Spectrum",
  "Ultimaker",
  "Creality",
  "Inland",
  "Hatchbox",
  "MatterHackers",
  "GEEETECH",
  "Amolen",
  "Raise3D",
  "Sovol",
  "Dremel",
  "Elegoo",
  "TECHNOLOGYOUTLET",
  "FlashForge",
  "1.75mm Shop",
  "3DPrima",
  "3DLAC",
  "ZYYX"
];

// Vorlage für CSV-Format
const CSV_FORMAT_EXAMPLE = `Brand,Filament Name/Type,Color Name,Hex Code
Bambu Lab,PLA Basic,Jade White,#FFFFFF
Bambu Lab,PLA Basic,Beige,#F7E6DE
Prusa,PETG,Galaxy Black,#000000
...
`;

// Typdefinitionen für die Listen
interface Manufacturer {
  id: number;
  name: string;
  createdAt: string;
}

interface Material {
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

interface Diameter {
  id: number;
  value: string;
  createdAt: string;
}

interface StorageLocation {
  id: number;
  name: string;
  createdAt: string;
}

// Validation schemas with translations
const createManufacturerSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.manufacturers.nameRequired'))
});

const createMaterialSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.materials.nameRequired'))
});

const createColorSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.colors.nameRequired')),
  code: z.string().min(1, t('settings.colors.codeRequired'))
});

const createDiameterSchema = (t: (key: string) => string) => z.object({
  value: z.string().min(1, t('settings.diameters.valueRequired'))
});

const createStorageLocationSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.storageLocations.nameRequired'))
});

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("manufacturers");
  const { t } = useTranslation();
  const { data: filaments = [] } = useQuery({
    queryKey: ["/api/filaments"],
    queryFn: () => apiRequest<Filament[]>("/api/filaments")
  });

  // Synchronisiere die Listen mit den vorhandenen Filament-Daten und den vordefinierten Listen, aber nur auf Anfrage
  // Automatische Initialisierung wurde deaktiviert, um unerwünschtes Daten-Recycling zu verhindern
  useEffect(() => {
    // Funktion zum Hinzufügen von Standard-Herstellern, wird aber nicht mehr automatisch ausgeführt
    const fetchExistingManufacturers = async () => {
      try {
        const existingManufacturers = await apiRequest<Manufacturer[]>("/api/manufacturers");
        const existingNames = new Set(existingManufacturers.map(m => m.name));

        // Filtere Hersteller, die bereits existieren
        const newManufacturers = MANUFACTURERS.filter(name => !existingNames.has(name));

        // Loggen, aber nichts automatisch hinzufügen
        console.log(`${newManufacturers.length} neue Hersteller verfügbar (werden nicht automatisch hinzugefügt)`);
      } catch (error) {
        console.error("Fehler beim Prüfen der Hersteller:", error);
      }
    };

    // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
    // fetchExistingManufacturers();

    // Funktion zum Hinzufügen von Standard-Materialien, wird aber nicht mehr automatisch ausgeführt
    const fetchExistingMaterialTypes = async () => {
      try {
        const existingMaterials = await apiRequest<Material[]>("/api/materials");
        const existingNames = new Set(existingMaterials.map(m => m.name));

        // Filtere Materialien, die bereits existieren
        const newMaterials = MATERIAL_TYPES.filter(item => !existingNames.has(item.value));

        // Loggen, aber nichts automatisch hinzufügen
        console.log(`${newMaterials.length} neue Materialtypen verfügbar (werden nicht automatisch hinzugefügt)`);
      } catch (error) {
        console.error("Fehler beim Prüfen der Materialtypen:", error);
      }
    };

    // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
    // fetchExistingMaterialTypes();

    // Keine Standardfarben mehr automatisch hinzufügen

    // Funktion zum Hinzufügen von Standard-Durchmessern, wird aber nicht mehr automatisch ausgeführt
    const fetchExistingDiameters = async () => {
      try {
        const existingDiameters = await apiRequest<Diameter[]>("/api/diameters");
        const existingValues = new Set(existingDiameters.map(d => d.value));

        // Filtere Durchmesser, die bereits existieren
        const standardDiameters = ["1.75", "2.85"];
        const newDiameters = standardDiameters.filter(value => !existingValues.has(value));

        // Loggen, aber nichts automatisch hinzufügen
        console.log(`${newDiameters.length} neue Durchmesser verfügbar (werden nicht automatisch hinzugefügt)`);
      } catch (error) {
        console.error("Fehler beim Prüfen der Durchmesser:", error);
      }
    };

    // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
    // fetchExistingDiameters();

    // Extrahiere zusätzliche Daten aus existierenden Filamenten
    if (filaments.length > 0) {
      // Extrahiere Hersteller aus Filamenten
      const uniqueManufacturers = new Set<string>();
      const uniqueMaterials = new Set<string>();
      const uniqueColors = new Map<string, string>();
      const uniqueDiameters = new Set<string>();
      const uniqueLocations = new Set<string>();

      filaments.forEach(filament => {
        if (filament.manufacturer) uniqueManufacturers.add(filament.manufacturer);
        if (filament.material) uniqueMaterials.add(filament.material);
        if (filament.colorName && filament.colorCode) uniqueColors.set(filament.colorName, filament.colorCode);
        if (filament.diameter) uniqueDiameters.add(filament.diameter);
        if (filament.storageLocation) uniqueLocations.add(filament.storageLocation);
      });

      // Diese Funktionen wurden auskommentiert, um zu verhindern, dass Daten automatisch wieder angelegt werden

      // Entdecke neue Hersteller aus Filamenten, aber füge sie nicht automatisch hinzu
      const syncExistingManufacturers = async () => {
        try {
          const existingManufacturers = await apiRequest<Manufacturer[]>("/api/manufacturers");
          const existingNames = new Set(existingManufacturers.map(m => m.name));

          // Identifiziere fehlende Hersteller, aber füge sie nicht hinzu
          const newManufacturers = Array.from(uniqueManufacturers)
            .filter(name => !existingNames.has(name));

          // Nur protokollieren, aber nicht automatisch hinzufügen
          if (newManufacturers.length > 0) {
            console.log(`${newManufacturers.length} neue Hersteller aus Filamenten entdeckt (werden nicht automatisch hinzugefügt)`);
          }
        } catch (error) {
          console.error("Fehler beim Prüfen der Hersteller aus Filamenten:", error);
        }
      };

      // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
      // syncExistingManufacturers();

      // Entdecke neue Materialien aus Filamenten, aber füge sie nicht automatisch hinzu
      const syncExistingMaterials = async () => {
        try {
          const existingMaterials = await apiRequest<Material[]>("/api/materials");
          const existingNames = new Set(existingMaterials.map(m => m.name));

          // Identifiziere fehlende Materialien, aber füge sie nicht hinzu
          const newMaterials = Array.from(uniqueMaterials)
            .filter(name => !existingNames.has(name));

          // Nur protokollieren, aber nicht automatisch hinzufügen
          if (newMaterials.length > 0) {
            console.log(`${newMaterials.length} neue Materialien aus Filamenten entdeckt (werden nicht automatisch hinzugefügt)`);
          }
        } catch (error) {
          console.error("Fehler beim Prüfen der Materialien aus Filamenten:", error);
        }
      };

      // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
      // syncExistingMaterials();

      // Entdecke neue Farben aus Filamenten, aber füge sie nicht automatisch hinzu
      const syncExistingColors = async () => {
        try {
          const existingColors = await apiRequest<Color[]>("/api/colors");
          const existingColorNames = new Set(existingColors.map(c => c.name));

          // Identifiziere fehlende Farben, aber füge sie nicht hinzu
          const newColors = Array.from(uniqueColors.entries())
            .filter(([name, _]) => !existingColorNames.has(name));

          // Nur protokollieren, aber nicht automatisch hinzufügen
          if (newColors.length > 0) {
            console.log(`${newColors.length} neue Farben aus Filamenten entdeckt (werden nicht automatisch hinzugefügt)`);
          }
        } catch (error) {
          console.error("Fehler beim Prüfen der Farben aus Filamenten:", error);
        }
      };

      // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
      // syncExistingColors();

      // Entdecke neue Durchmesser aus Filamenten, aber füge sie nicht automatisch hinzu
      const syncExistingDiameters = async () => {
        try {
          const existingDiameters = await apiRequest<Diameter[]>("/api/diameters");
          const existingValues = new Set(existingDiameters.map(d => d.value));

          // Identifiziere fehlende Durchmesser, aber füge sie nicht hinzu
          const newDiameters = Array.from(uniqueDiameters)
            .filter(value => !existingValues.has(value));

          // Nur protokollieren, aber nicht automatisch hinzufügen
          if (newDiameters.length > 0) {
            console.log(`${newDiameters.length} neue Durchmesser aus Filamenten entdeckt (werden nicht automatisch hinzugefügt)`);
          }
        } catch (error) {
          console.error("Fehler beim Prüfen der Durchmesser aus Filamenten:", error);
        }
      };

      // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
      // syncExistingDiameters();

      // Entdecke neue Lagerorte aus Filamenten, aber füge sie nicht automatisch hinzu
      const syncExistingLocations = async () => {
        try {
          const existingLocations = await apiRequest<StorageLocation[]>("/api/storage-locations");
          const existingNames = new Set(existingLocations.map(l => l.name));

          // Identifiziere fehlende Lagerorte, aber füge sie nicht hinzu
          const newLocations = Array.from(uniqueLocations)
            .filter(name => !existingNames.has(name));

          // Nur protokollieren, aber nicht automatisch hinzufügen
          if (newLocations.length > 0) {
            console.log(`${newLocations.length} neue Lagerorte aus Filamenten entdeckt (werden nicht automatisch hinzugefügt)`);
          }
        } catch (error) {
          console.error("Fehler beim Prüfen der Lagerorte aus Filamenten:", error);
        }
      };

      // Kommentiert, um ungewollte Auto-Generierung von Daten zu verhindern
      // syncExistingLocations();
    }

    // Aktualisiere die Daten
    queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
    queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
  }, [filaments, queryClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        aria-describedby="settings-description"
      >
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription id="settings-description">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manufacturers" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="manufacturers">{t('settings.manufacturers.title')}</TabsTrigger>
            <TabsTrigger value="materials">{t('settings.materials.title')}</TabsTrigger>
            <TabsTrigger value="colors">{t('settings.colors.title')}</TabsTrigger>
            <TabsTrigger value="diameters">{t('settings.diameters.title')}</TabsTrigger>
            <TabsTrigger value="storage-locations">{t('settings.storageLocations.title')}</TabsTrigger>
            <TabsTrigger value="filament-import-export">{t('settings.filamentImportExport.title')}</TabsTrigger>
          </TabsList>

          <TabsContent value="manufacturers">
            <ManufacturersList />
          </TabsContent>

          <TabsContent value="materials">
            <MaterialsList />
          </TabsContent>

          <TabsContent value="colors">
            <ColorsList />
          </TabsContent>

          <TabsContent value="diameters">
            <DiametersList />
          </TabsContent>

          <TabsContent value="storage-locations">
            <StorageLocationsList />
          </TabsContent>

          <TabsContent value="filament-import-export">
            <FilamentImportExport title={t('settings.filamentImportExport.title')} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Component for manufacturers list
function ManufacturersList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { t } = useTranslation();
  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ["/api/manufacturers"],
    queryFn: () => apiRequest<Manufacturer[]>("/api/manufacturers")
  });

  // Funktion zum Aktualisieren der Reihenfolge
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: number, newOrder: number }) => {
      return apiRequest(`/api/manufacturers/${id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ newOrder })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren der Reihenfolge:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  });

  // DnD-Handler für Reihenfolge-Änderung
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const item = manufacturers[sourceIndex];
    updateOrderMutation.mutate({ id: item.id, newOrder: destinationIndex });
  };

  // CSV Format für Hersteller
  const manufacturersCsvFormat = `Name
Bambu Lab
Prusament
Polymaker
...`;

  // Gefilterte Hersteller basierend auf der Suche
  const filteredManufacturers = useMemo(() => {
    return manufacturers.filter(manufacturer =>
      manufacturer.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [manufacturers, searchTerm]);

  // Create schema with translations
  const manufacturerSchema = createManufacturerSchema(t);
  type FormValues = z.infer<typeof manufacturerSchema>;

  // Form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(manufacturerSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation to add a manufacturer
  const addManufacturerMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Manufacturer>("/api/manufacturers", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      form.reset();
      toast({
        title: t('settings.manufacturers.addSuccess'),
        description: t('settings.manufacturers.addSuccessDescription')
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.manufacturers.addError'),
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a manufacturer
  const deleteManufacturerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/manufacturers/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.manufacturers.deleteSuccess'),
        description: t('settings.manufacturers.deleteSuccessDescription')
      });
    },
    onError: (error: any) => {
      let errorMessage = t('settings.manufacturers.deleteError');

      // Try to extract the exact error message from the API response
      if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message?.includes("in use by filaments")) {
        errorMessage = t('settings.manufacturers.deleteErrorInUse');
      }

      toast({
        title: t('settings.manufacturers.deleteErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Mutation to delete all manufacturers
  const deleteAllManufacturersMutation = useMutation({
    mutationFn: async () => {
      // Delete all manufacturers in parallel and ignore errors for individual ones
      const deletePromises = manufacturers.map(manufacturer =>
        apiRequest(`/api/manufacturers/${manufacturer.id}`, {
          method: "DELETE"
        }).catch(err => {
          console.warn(`Error deleting manufacturer ${manufacturer.id}:`, err);
          return null; // Ignore errors for individual manufacturers
        })
      );

      await Promise.all(deletePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.manufacturers.deleteAllSuccess'),
        description: t('settings.manufacturers.deleteAllSuccessDescription')
      });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting all manufacturers:", error);
      toast({
        title: t('common.error'),
        description: t('settings.manufacturers.deleteAllError'),
        variant: "destructive"
      });
      // Still update the manufacturers list so deleted manufacturers are no longer shown
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      setIsDeleteConfirmOpen(false);
    }
  });

  const onSubmit = (data: FormValues) => {
    addManufacturerMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col space-y-2">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('settings.manufacturers.searchPlaceholder')}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex justify-end">
                <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={manufacturers.length === 0}
                      className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    >
                      {t('settings.manufacturers.deleteAll')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.manufacturers.deleteAllConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.manufacturers.deleteAllConfirmDescription', { count: manufacturers.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllManufacturersMutation.mutate()}
                        className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                      >
                        {t('settings.manufacturers.deleteAllConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{t('settings.manufacturers.loading')}</div>
            ) : filteredManufacturers.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {manufacturers.length === 0 ? t('settings.manufacturers.noManufacturers') : t('common.noResults')}
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-[65%]">Name</TableHead>
                      <TableHead className="text-right w-16">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="manufacturers">
                      {(provided) => (
                        <TableBody
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {filteredManufacturers.map((manufacturer, index) => (
                            <Draggable
                              key={manufacturer.id.toString()}
                              draggableId={manufacturer.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <TableRow
                                  key={manufacturer.id}
                                  className={`h-10 ${snapshot.isDragging ? "opacity-50" : ""}`}
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                >
                                  <TableCell className="py-1 w-10">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 truncate">
                                    <div className="max-w-full truncate" title={manufacturer.name}>
                                      {manufacturer.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right py-1 whitespace-nowrap w-16">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                                      onClick={() => deleteManufacturerMutation.mutate(manufacturer.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </TableBody>
                      )}
                    </Droppable>
                  </DragDropContext>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('settings.manufacturers.addTitle')}</h3>
              <p className="text-sm text-neutral-400 mb-4">
                {t('settings.manufacturers.addDescription')}
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('settings.manufacturers.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    disabled={addManufacturerMutation.isPending}
                  >
                    {t('settings.manufacturers.addButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportExportCard
        endpoint="/api/manufacturers"
        csvFormat={manufacturersCsvFormat}
        fields={["name"]}
        title={t('settings.manufacturers.importExport')}
      />
    </div>
  );
}

// Component for materials list
function MaterialsList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { t } = useTranslation();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["/api/materials"],
    queryFn: () => apiRequest<Material[]>("/api/materials")
  });

  // Gefilterte Materialien basierend auf der Suche
  const filteredMaterials = useMemo(() => {
    return materials.filter(material =>
      material.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [materials, searchTerm]);

  // Funktion zum Aktualisieren der Reihenfolge
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: number, newOrder: number }) => {
      return apiRequest(`/api/materials/${id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ newOrder })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren der Reihenfolge:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  });

  // DnD-Handler für Reihenfolge-Änderung
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const item = materials[sourceIndex];
    updateOrderMutation.mutate({ id: item.id, newOrder: destinationIndex });
  };

  // CSV Format für Materialien
  const materialsCsvFormat = `Name
PLA
PETG
ABS
TPU
...`;

  // Create schema with translations
  const materialSchema = createMaterialSchema(t);
  type FormValues = z.infer<typeof materialSchema>;

  // Form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation to add a material
  const addMaterialMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Material>("/api/materials", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      form.reset();
      toast({
        title: t('settings.materials.addSuccess'),
        description: t('settings.materials.addSuccessDescription')
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.materials.addError'),
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a material
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/materials/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.materials.deleteSuccess'),
        description: t('settings.materials.deleteSuccessDescription')
      });
    },
    onError: (error: any) => {
      let errorMessage = t('settings.materials.deleteError');

      // Try to extract the exact error message from the API response
      if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message?.includes("in use by filaments")) {
        errorMessage = t('settings.materials.deleteErrorInUse');
      }

      toast({
        title: t('settings.materials.deleteErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Mutation to delete all materials
  const deleteAllMaterialsMutation = useMutation({
    mutationFn: async () => {
      // Delete all materials in parallel and ignore errors for individual ones
      const deletePromises = materials.map(material =>
        apiRequest(`/api/materials/${material.id}`, {
          method: "DELETE"
        }).catch(err => {
          console.warn(`Error deleting material ${material.id}:`, err);
          return null; // Ignore errors for individual materials
        })
      );

      await Promise.all(deletePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.materials.deleteAllSuccess'),
        description: t('settings.materials.deleteAllSuccessDescription')
      });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting all materials:", error);
      toast({
        title: t('common.error'),
        description: t('settings.materials.deleteAllError'),
        variant: "destructive"
      });
      // Still update the materials list so deleted materials are no longer shown
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setIsDeleteConfirmOpen(false);
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addMaterialMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col space-y-2">
              <div className="w-full">
                <Input
                  type="text"
                  placeholder={t('settings.materials.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end">
                <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={materials.length === 0}
                      className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    >
                      {t('settings.materials.deleteAll')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.materials.deleteAllConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.materials.deleteAllConfirmDescription', { count: materials.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllMaterialsMutation.mutate()}
                        className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                      >
                        {t('settings.materials.deleteAllConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{t('settings.materials.loading')}</div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {materials.length === 0 ? t('settings.materials.noMaterials') : t('common.noResults')}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-[65%]">{t('common.name')}</TableHead>
                      <TableHead className="text-right w-16">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="materials">
                      {(provided) => (
                        <TableBody
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {filteredMaterials.map((material, index) => (
                            <Draggable
                              key={material.id.toString()}
                              draggableId={material.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <TableRow
                                  key={material.id}
                                  className={`h-10 ${snapshot.isDragging ? "opacity-50" : ""}`}
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                >
                                  <TableCell className="py-1 w-10">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 truncate">
                                    <Badge className="px-2 py-1 theme-primary-bg-20 text-white border-white/20 truncate max-w-full">
                                      <span className="truncate" title={material.name}>
                                        {material.name}
                                      </span>
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right py-1 whitespace-nowrap w-16">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                                      onClick={() => deleteMaterialMutation.mutate(material.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </TableBody>
                      )}
                    </Droppable>
                  </DragDropContext>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('settings.materials.addTitle')}</h3>
              <p className="text-sm text-neutral-400 mb-4">
                {t('settings.materials.addDescription')}
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('settings.materials.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    disabled={addMaterialMutation.isPending}
                  >
                    {t('settings.materials.addButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportExportCard
        endpoint="/api/materials"
        csvFormat={materialsCsvFormat}
        fields={["name"]}
        title={t('settings.materials.importExport')}
      />
    </div>
  );
}

// Component for colors list
function ColorsList() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const { t } = useTranslation();
  const [csvUploadStatus, setCsvUploadStatus] = useState<{
    status: "idle" | "processing" | "success" | "error";
    message: string;
    added: number;
    skipped: number;
    errored: number;
  }>({
    status: "idle",
    message: "",
    added: 0,
    skipped: 0,
    errored: 0
  });

  // CSV Format für Farben
  const colorsCsvFormat = `Brand,Color Name,Hex Code
Bambu Lab,Dark Gray,#545454
Bambu Lab,Black,#000000
Prusament,Galaxy Black,#111111
...`;
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ["/api/colors"],
    queryFn: () => apiRequest<Color[]>("/api/colors")
  });

  // Gefilterte Farben basierend auf der Suche
  const filteredColors = useMemo(() => {
    return colors.filter(color =>
      color.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [colors, searchTerm]);

  // Create schema with translations
  const colorSchema = createColorSchema(t);
  type FormValues = z.infer<typeof colorSchema>;

  // Form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name: "",
      code: "#000000"
    }
  });

  // Mutation to add a color
  const addColorMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Color>("/api/colors", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      form.reset({ name: "", code: "#000000" });
      toast({
        title: t('settings.colors.addSuccess'),
        description: t('settings.colors.addSuccessDescription')
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.colors.addError'),
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a color
  const deleteColorMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/colors/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.colors.deleteSuccess'),
        description: t('settings.colors.deleteSuccessDescription')
      });
    },
    onError: (error: any) => {
      let errorMessage = t('settings.colors.deleteError');

      // Try to extract the exact error message from the API response
      if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message?.includes("in use by filaments")) {
        errorMessage = t('settings.colors.deleteErrorInUse');
      }

      toast({
        title: t('settings.colors.deleteErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addColorMutation.mutate(data);
  };

  // CSV Import Funktion
  const handleCsvUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvUploadStatus({
      status: "processing",
      message: "CSV-Datei wird verarbeitet...",
      added: 0,
      skipped: 0,
      errored: 0
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        setCsvUploadStatus({
          status: "error",
          message: "Die Datei konnte nicht gelesen werden.",
          added: 0,
          skipped: 0,
          errored: 0
        });
        return;
      }

      const lines = result.split('\n');
      let added = 0;
      let skipped = 0;
      let errored = 0;

      // Hole aktuelle Farben, um Duplikate zu vermeiden
      const existingColors = await apiRequest<Color[]>("/api/colors");
      const existingColorNames = new Set(existingColors.map(c => c.name));

      // Funktion zum Parsen einer CSV-Zeile unter Berücksichtigung von Kommas in Werten
      // Diese vereinfachte Version geht davon aus, dass die Daten keine Anführungszeichen enthalten
      const parseCSVLine = (line: string): string[] => {
        // Spalten in der CSV: Brand,Color Name,Hex Code
        // Wir brauchen eine robustere Methode, um die Felder zu trennen

        // Finde die Positionen der ersten beiden Kommas
        let firstCommaIndex = line.indexOf(',');
        if (firstCommaIndex === -1) return []; // Ungültiges Format

        let secondCommaIndex = line.indexOf(',', firstCommaIndex + 1);
        if (secondCommaIndex === -1) return []; // Ungültiges Format

        // Teile die Zeile in drei Teile auf
        const brand = line.substring(0, firstCommaIndex).trim();
        const colorName = line.substring(firstCommaIndex + 1, secondCommaIndex).trim();
        const hexCode = line.substring(secondCommaIndex + 1).trim();

        return [brand, colorName, hexCode];
      };

      // Überspringe die Kopfzeile
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const values = parseCSVLine(line);
          if (values.length < 3) {
            console.warn(`Zeile ${i+1} hat nicht genug Werte: ${line}`);
            errored++;
            continue;
          }

          const [brand, colorName, hexCode] = values;

          // Erstelle einen Namen mit Hersteller in Klammern
          const fullColorName = `${colorName} (${brand})`;

          // Prüfe, ob die Farbe bereits existiert
          if (existingColorNames.has(fullColorName)) {
            skipped++;
            continue;
          }

          // Validiere Hex-Code
          if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexCode)) {
            console.warn(`Ungültiger Hex-Code in Zeile ${i+1}: ${hexCode}`);
            errored++;
            continue;
          }

          // Füge Farbe hinzu
          await apiRequest<Color>("/api/colors", {
            method: "POST",
            body: JSON.stringify({ name: fullColorName, code: hexCode })
          });

          added++;
        } catch (error) {
          errored++;
          console.error(`Fehler beim Verarbeiten der CSV-Zeile ${i+1}: ${line}`, error);
        }
      }

      // Aktualisiere Status und UI
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });

      setCsvUploadStatus({
        status: "success",
        message: `CSV-Import abgeschlossen. ${added} Farben hinzugefügt, ${skipped} übersprungen, ${errored} Fehler.`,
        added,
        skipped,
        errored
      });

      toast({
        title: "CSV-Import abgeschlossen",
        description: `${added} Farben hinzugefügt, ${skipped} übersprungen, ${errored} Fehler.`
      });

      // Reset Dateiauswahl
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setCsvUploadStatus({
        status: "error",
        message: "Die Datei konnte nicht gelesen werden.",
        added: 0,
        skipped: 0,
        errored: 0
      });
    };

    reader.readAsText(file);
  };

  // Delete all colors
  const deleteAllColorsMutation = useMutation({
    mutationFn: async () => {
      // Delete all colors in parallel and ignore errors for individual ones
      const deletePromises = colors.map(color =>
        apiRequest(`/api/colors/${color.id}`, {
          method: "DELETE"
        }).catch(err => {
          console.warn(`Error deleting color ${color.id}:`, err);
          return null; // Ignore errors for individual colors
        })
      );

      await Promise.all(deletePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.colors.deleteAllSuccess'),
        description: t('settings.colors.deleteAllSuccessDescription')
      });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting all colors:", error);
      toast({
        title: t('common.error'),
        description: t('settings.colors.deleteAllError'),
        variant: "destructive"
      });
      // Still update the colors list so deleted colors are no longer shown
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      setIsDeleteConfirmOpen(false);
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col space-y-2">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('settings.colors.searchPlaceholder')}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex justify-end">
                <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={colors.length === 0}
                      className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    >
                      {t('settings.colors.deleteAll')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.colors.deleteAllConfirmTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.colors.deleteAllConfirmDescription', { count: colors.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllColorsMutation.mutate()}
                        className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                      >
                        {t('settings.colors.deleteAllConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{t('settings.colors.loading')}</div>
            ) : filteredColors.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {colors.length === 0 ? t('settings.colors.noColors') : t('common.noResults')}
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-[45%]">{t('common.name')}</TableHead>
                      <TableHead className="w-24">{t('filaments.colorCode')}</TableHead>
                      <TableHead className="text-right w-16">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredColors.map((color) => (
                      <TableRow key={color.id} className="h-10">
                        <TableCell className="py-1 w-10">
                          <div
                            className="w-6 h-6 rounded-full border border-neutral-700"
                            style={{ backgroundColor: color.code }}
                          />
                        </TableCell>
                        <TableCell className="py-1 truncate">
                          <div className="max-w-full truncate" title={color.name}>
                            {color.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono py-1 whitespace-nowrap">{color.code}</TableCell>
                        <TableCell className="text-right py-1 whitespace-nowrap w-16">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                            onClick={() => deleteColorMutation.mutate(color.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('settings.colors.addTitle')}</h3>
              <p className="text-sm text-neutral-400 mb-4">
                {t('settings.colors.addDescription')}
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('settings.colors.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('filaments.colorCode')}</FormLabel>
                        <FormControl>
                          <div className="flex gap-3">
                            <div
                              className="w-10 h-10 rounded border border-neutral-700 flex-shrink-0"
                              style={{ backgroundColor: field.value }}
                            />
                            <Input type="color" {...field} className="flex-grow" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    disabled={addColorMutation.isPending}
                  >
                    {t('settings.colors.addButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportExportCard
        endpoint="/api/colors"
        csvFormat={colorsCsvFormat}
        fields={["name", "code"]}
        title={t('settings.colors.importExport')}
        hasHeaders={true}
      />
    </div>
  );
}

// Component for diameters list
function DiametersList() {
  const queryClient = useQueryClient();
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { t } = useTranslation();
  const { data: diameters = [], isLoading } = useQuery({
    queryKey: ["/api/diameters"],
    queryFn: () => apiRequest<Diameter[]>("/api/diameters")
  });

  // CSV Format für Durchmesser
  const diametersCsvFormat = `Wert
1.75
2.85
3.00
...`;

  // Create schema with translations
  const diameterSchema = createDiameterSchema(t);
  type FormValues = z.infer<typeof diameterSchema>;

  // Form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(diameterSchema),
    defaultValues: {
      value: ""
    }
  });

  // Mutation to add a diameter
  const addDiameterMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Diameter>("/api/diameters", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      form.reset();
      toast({
        title: t('settings.diameters.addSuccess'),
        description: t('settings.diameters.addSuccessDescription')
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.diameters.addError'),
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a diameter
  const deleteDiameterMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/diameters/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.diameters.deleteSuccess'),
        description: t('settings.diameters.deleteSuccessDescription')
      });
    },
    onError: (error: any) => {
      let errorMessage = t('settings.diameters.deleteError');

      // Try to extract the exact error message from the API response
      if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message?.includes("in use by filaments")) {
        errorMessage = t('settings.diameters.deleteErrorInUse');
      }

      toast({
        title: t('settings.diameters.deleteErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Mutation to delete all diameters
  const deleteAllDiametersMutation = useMutation({
    mutationFn: async () => {
      // Delete all diameters in parallel and ignore errors for individual ones
      const deletePromises = diameters.map(diameter =>
        apiRequest(`/api/diameters/${diameter.id}`, {
          method: "DELETE"
        }).catch(err => {
          console.warn(`Error deleting diameter ${diameter.id}:`, err);
          return null; // Ignore errors for individual diameters
        })
      );

      await Promise.all(deletePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.diameters.deleteAllSuccess'),
        description: t('settings.diameters.deleteAllSuccessDescription')
      });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting all diameters:", error);
      toast({
        title: t('common.error'),
        description: t('settings.diameters.deleteAllError'),
        variant: "destructive"
      });
      // Still update the diameters list so deleted diameters are no longer shown
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      setIsDeleteConfirmOpen(false);
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addDiameterMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-end">
              <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={diameters.length === 0}
                    className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                  >
                    {t('settings.diameters.deleteAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.diameters.deleteAllConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.diameters.deleteAllConfirmDescription', { count: diameters.length })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAllDiametersMutation.mutate()}
                      className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    >
                      {t('settings.diameters.deleteAllConfirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{t('settings.diameters.loading')}</div>
            ) : diameters.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {t('settings.diameters.noDiameters')}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto">
                {diameters.map((diameter) => (
                  <Badge
                    key={diameter.id}
                    className="flex items-center gap-2 px-3 py-1.5 theme-primary-bg-20 text-white hover:theme-primary-bg-30 border-white/20"
                  >
                    {diameter.value} mm
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 -mr-1 text-white hover:theme-primary-bg-30"
                      onClick={() => deleteDiameterMutation.mutate(diameter.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('settings.diameters.addTitle')}</h3>
              <p className="text-sm text-neutral-400 mb-4">
                {t('settings.diameters.addDescription')}
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.diameters.value')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('settings.diameters.valuePlaceholder')} {...field} type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    disabled={addDiameterMutation.isPending}
                  >
                    {t('settings.diameters.addButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportExportCard
        endpoint="/api/diameters"
        csvFormat={diametersCsvFormat}
        fields={["value"]}
        title={t('settings.diameters.importExport')}
      />
    </div>
  );
}

// Component for storage locations list
function StorageLocationsList() {
  const queryClient = useQueryClient();
  const [importExportOpen, setImportExportOpen] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { t } = useTranslation();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["/api/storage-locations"],
    queryFn: () => apiRequest<StorageLocation[]>("/api/storage-locations")
  });

  // Funktion zum Aktualisieren der Reihenfolge
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: number, newOrder: number }) => {
      return apiRequest(`/api/storage-locations/${id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ newOrder })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren der Reihenfolge:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  });

  // DnD-Handler für Reihenfolge-Änderung
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const item = locations[sourceIndex];
    updateOrderMutation.mutate({ id: item.id, newOrder: destinationIndex });
  };

  // CSV Format für Lagerorte
  const locationsCsvFormat = `Name
Keller
Schrank
Regal A
Regal B
...`;

  // Create schema with translations
  const storageLocationSchema = createStorageLocationSchema(t);
  type FormValues = z.infer<typeof storageLocationSchema>;

  // Form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(storageLocationSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation to add a storage location
  const addLocationMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<StorageLocation>("/api/storage-locations", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      form.reset();
      toast({
        title: t('settings.storageLocations.addSuccess'),
        description: t('settings.storageLocations.addSuccessDescription')
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('settings.storageLocations.addError'),
        variant: "destructive"
      });
    }
  });

  // Mutation to delete a storage location
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/storage-locations/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.storageLocations.deleteSuccess'),
        description: t('settings.storageLocations.deleteSuccessDescription')
      });
    },
    onError: (error: any) => {
      let errorMessage = t('settings.storageLocations.deleteError');

      // Try to extract the exact error message from the API response
      if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message?.includes("in use by filaments")) {
        errorMessage = t('settings.storageLocations.deleteErrorInUse');
      }

      toast({
        title: t('settings.storageLocations.deleteErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Mutation to delete all storage locations
  const deleteAllLocationsMutation = useMutation({
    mutationFn: async () => {
      // Delete all storage locations in parallel and ignore errors for individual ones
      const deletePromises = locations.map(location =>
        apiRequest(`/api/storage-locations/${location.id}`, {
          method: "DELETE"
        }).catch(err => {
          console.warn(`Error deleting storage location ${location.id}:`, err);
          return null; // Ignore errors for individual storage locations
        })
      );

      await Promise.all(deletePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
      toast({
        title: t('settings.storageLocations.deleteAllSuccess'),
        description: t('settings.storageLocations.deleteAllSuccessDescription')
      });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting all storage locations:", error);
      toast({
        title: t('common.error'),
        description: t('settings.storageLocations.deleteAllError'),
        variant: "destructive"
      });
      // Still update the storage locations list so deleted locations are no longer shown
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      setIsDeleteConfirmOpen(false);
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addLocationMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-end">
              <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={locations.length === 0}
                    className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                  >
                    {t('settings.storageLocations.deleteAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.storageLocations.deleteAllConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.storageLocations.deleteAllConfirmDescription', { count: locations.length })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAllLocationsMutation.mutate()}
                      className="theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    >
                      {t('settings.storageLocations.deleteAllConfirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{t('settings.storageLocations.loading')}</div>
            ) : locations.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {t('settings.storageLocations.noStorageLocations')}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-[65%]">Name</TableHead>
                      <TableHead className="text-right w-16">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="locations">
                      {(provided) => (
                        <TableBody
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {locations.map((location, index) => (
                            <Draggable
                              key={location.id.toString()}
                              draggableId={location.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <TableRow
                                  key={location.id}
                                  className={`h-10 ${snapshot.isDragging ? "opacity-50" : ""}`}
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                >
                                  <TableCell className="py-1 w-10">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 truncate">
                                    <div className="max-w-full truncate" title={location.name}>
                                      {location.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right py-1 whitespace-nowrap w-16">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                                      onClick={() => deleteLocationMutation.mutate(location.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </TableBody>
                      )}
                    </Droppable>
                  </DragDropContext>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('settings.storageLocations.addTitle')}</h3>
              <p className="text-sm text-neutral-400 mb-4">
                {t('settings.storageLocations.addDescription')}
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('settings.storageLocations.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                    disabled={addLocationMutation.isPending}
                  >
                    {t('settings.storageLocations.addButton')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportExportCard
        endpoint="/api/storage-locations"
        csvFormat={locationsCsvFormat}
        fields={["name"]}
        title={t('settings.storageLocations.importExport')}
      />
    </div>
  );
}