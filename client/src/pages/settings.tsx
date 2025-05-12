import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

// Validierungsschemas für die Formulare
const manufacturerSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich")
});

const materialSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich")
});

const colorSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  code: z.string().min(1, "Farbcode ist erforderlich")
});

const diameterSchema = z.object({
  value: z.string().min(1, "Wert ist erforderlich")
});

const storageLocationSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich")
});

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("manufacturers");

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-4">Einstellungen</h1>
      <p className="text-neutral-400 mb-6">
        Hier können Sie die Listen für Hersteller, Materialien, Farben, Durchmesser und Lagerorte verwalten.
      </p>

      <Tabs defaultValue="manufacturers" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="manufacturers">Hersteller</TabsTrigger>
          <TabsTrigger value="materials">Materialien</TabsTrigger>
          <TabsTrigger value="colors">Farben</TabsTrigger>
          <TabsTrigger value="diameters">Durchmesser</TabsTrigger>
          <TabsTrigger value="storage-locations">Lagerorte</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

// Komponente für die Herstellerliste
function ManufacturersList() {
  const queryClient = useQueryClient();
  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ["/api/manufacturers"],
    queryFn: () => apiRequest<Manufacturer[]>("/api/manufacturers")
  });

  // Schema für das Formular
  type FormValues = z.infer<typeof manufacturerSchema>;

  // Form-Hook
  const form = useForm<FormValues>({
    resolver: zodResolver(manufacturerSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation zum Hinzufügen eines Herstellers
  const addManufacturerMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Manufacturer>("/api/manufacturers", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      form.reset();
      toast({
        title: "Hersteller hinzugefügt",
        description: "Der Hersteller wurde erfolgreich hinzugefügt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Hersteller konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  });

  // Mutation zum Löschen eines Herstellers
  const deleteManufacturerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/manufacturers/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      toast({
        title: "Hersteller gelöscht",
        description: "Der Hersteller wurde erfolgreich gelöscht."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Hersteller konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addManufacturerMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Herstellerliste</CardTitle>
          <CardDescription>
            Alle verfügbaren Hersteller ansehen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Lade Daten...</div>
          ) : manufacturers.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">
              Keine Hersteller vorhanden
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturers.map((manufacturer) => (
                  <TableRow key={manufacturer.id}>
                    <TableCell>{manufacturer.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteManufacturerMutation.mutate(manufacturer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hersteller hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie einen neuen Hersteller zur Liste hinzu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Herstellername" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addManufacturerMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Hersteller hinzufügen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Komponente für die Materialliste
function MaterialsList() {
  const queryClient = useQueryClient();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["/api/materials"],
    queryFn: () => apiRequest<Material[]>("/api/materials")
  });

  // Schema für das Formular
  type FormValues = z.infer<typeof materialSchema>;

  // Form-Hook
  const form = useForm<FormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation zum Hinzufügen eines Materials
  const addMaterialMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Material>("/api/materials", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      form.reset();
      toast({
        title: "Material hinzugefügt",
        description: "Das Material wurde erfolgreich hinzugefügt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Das Material konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  });

  // Mutation zum Löschen eines Materials
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/materials/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({
        title: "Material gelöscht",
        description: "Das Material wurde erfolgreich gelöscht."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Das Material konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addMaterialMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Materialliste</CardTitle>
          <CardDescription>
            Alle verfügbaren Materialien ansehen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Lade Daten...</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">
              Keine Materialien vorhanden
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {materials.map((material) => (
                <Badge key={material.id} className="flex items-center gap-2 px-3 py-1.5">
                  {material.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 -mr-1"
                    onClick={() => deleteMaterialMutation.mutate(material.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Material hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie ein neues Material zur Liste hinzu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Materialname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addMaterialMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Material hinzufügen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Komponente für die Farbenliste
function ColorsList() {
  const queryClient = useQueryClient();
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ["/api/colors"],
    queryFn: () => apiRequest<Color[]>("/api/colors")
  });

  // Schema für das Formular
  type FormValues = z.infer<typeof colorSchema>;

  // Form-Hook
  const form = useForm<FormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name: "",
      code: "#000000"
    }
  });

  // Mutation zum Hinzufügen einer Farbe
  const addColorMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Color>("/api/colors", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      form.reset({ name: "", code: "#000000" });
      toast({
        title: "Farbe hinzugefügt",
        description: "Die Farbe wurde erfolgreich hinzugefügt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Farbe konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  });

  // Mutation zum Löschen einer Farbe
  const deleteColorMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/colors/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({
        title: "Farbe gelöscht",
        description: "Die Farbe wurde erfolgreich gelöscht."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Farbe konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addColorMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Farbenliste</CardTitle>
          <CardDescription>
            Alle verfügbaren Farben ansehen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Lade Daten...</div>
          ) : colors.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">
              Keine Farben vorhanden
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vorschau</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Farbcode</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colors.map((color) => (
                  <TableRow key={color.id}>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-full border border-neutral-700"
                        style={{ backgroundColor: color.code }}
                      />
                    </TableCell>
                    <TableCell>{color.name}</TableCell>
                    <TableCell className="font-mono">{color.code}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteColorMutation.mutate(color.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Farbe hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie eine neue Farbe zur Liste hinzu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Farbname" {...field} />
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
                    <FormLabel>Farbcode</FormLabel>
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
              <Button type="submit" className="w-full" disabled={addColorMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Farbe hinzufügen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Komponente für die Durchmesserliste
function DiametersList() {
  const queryClient = useQueryClient();
  const { data: diameters = [], isLoading } = useQuery({
    queryKey: ["/api/diameters"],
    queryFn: () => apiRequest<Diameter[]>("/api/diameters")
  });

  // Schema für das Formular
  type FormValues = z.infer<typeof diameterSchema>;

  // Form-Hook
  const form = useForm<FormValues>({
    resolver: zodResolver(diameterSchema),
    defaultValues: {
      value: ""
    }
  });

  // Mutation zum Hinzufügen eines Durchmessers
  const addDiameterMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<Diameter>("/api/diameters", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      form.reset();
      toast({
        title: "Durchmesser hinzugefügt",
        description: "Der Durchmesser wurde erfolgreich hinzugefügt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Durchmesser konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  });

  // Mutation zum Löschen eines Durchmessers
  const deleteDiameterMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/diameters/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
      toast({
        title: "Durchmesser gelöscht",
        description: "Der Durchmesser wurde erfolgreich gelöscht."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Durchmesser konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addDiameterMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Durchmesserliste</CardTitle>
          <CardDescription>
            Alle verfügbaren Durchmesser ansehen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Lade Daten...</div>
          ) : diameters.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">
              Keine Durchmesser vorhanden
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {diameters.map((diameter) => (
                <Badge key={diameter.id} className="flex items-center gap-2 px-3 py-1.5">
                  {diameter.value} mm
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 -mr-1"
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

      <Card>
        <CardHeader>
          <CardTitle>Durchmesser hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie einen neuen Durchmesser zur Liste hinzu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wert (mm)</FormLabel>
                    <FormControl>
                      <Input placeholder="1.75" {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addDiameterMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Durchmesser hinzufügen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Komponente für die Lagerorteliste
function StorageLocationsList() {
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["/api/storage-locations"],
    queryFn: () => apiRequest<StorageLocation[]>("/api/storage-locations")
  });

  // Schema für das Formular
  type FormValues = z.infer<typeof storageLocationSchema>;

  // Form-Hook
  const form = useForm<FormValues>({
    resolver: zodResolver(storageLocationSchema),
    defaultValues: {
      name: ""
    }
  });

  // Mutation zum Hinzufügen eines Lagerorts
  const addLocationMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest<StorageLocation>("/api/storage-locations", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      form.reset();
      toast({
        title: "Lagerort hinzugefügt",
        description: "Der Lagerort wurde erfolgreich hinzugefügt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Lagerort konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
    }
  });

  // Mutation zum Löschen eines Lagerorts
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/storage-locations/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
      toast({
        title: "Lagerort gelöscht",
        description: "Der Lagerort wurde erfolgreich gelöscht."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Der Lagerort konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  });

  // Handler für das Absenden des Formulars
  const onSubmit = (data: FormValues) => {
    addLocationMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Lagerorteliste</CardTitle>
          <CardDescription>
            Alle verfügbaren Lagerorte ansehen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Lade Daten...</div>
          ) : locations.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">
              Keine Lagerorte vorhanden
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>{location.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteLocationMutation.mutate(location.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lagerort hinzufügen</CardTitle>
          <CardDescription>
            Fügen Sie einen neuen Lagerort zur Liste hinzu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Lagerortname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addLocationMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Lagerort hinzufügen
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}