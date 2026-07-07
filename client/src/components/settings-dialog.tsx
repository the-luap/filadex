import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FilamentImportExport } from "./filament-import-export";
import {
  ManufacturersList,
  MaterialsList,
  ColorsList,
  DiametersList,
  StorageLocationsList,
  UnitsSettings,
  NotificationsSettings,
  CustomFieldsSettings,
  CommunityFilamentsSettings,
  ApiTokensSettings,
  EmailSettingsCard,
  CatalogRequestsReview
} from "./settings";
import { useAuth } from "@/lib/auth";
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
  DialogTitle
} from "@/components/ui/dialog";
import { Filament } from "@shared/schema";
import { useTranslation } from "@/i18n";
import type { Manufacturer, Material, Color, Diameter, StorageLocation } from "./settings/settings-types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function SettingsDialog({ open, onOpenChange, initialTab }: SettingsDialogProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab || "manufacturers");
  
  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);
  const { t } = useTranslation();
  const { data: filaments = [] } = useQuery({
    queryKey: ["/api/filaments"],
    queryFn: () => apiRequest<Filament[]>("/api/filaments")
  });

  // Synchronisiere die Listen mit den vorhandenen Filament-Daten
  // Automatische Initialisierung wurde deaktiviert, um unerwünschtes Daten-Recycling zu verhindern
  useEffect(() => {
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
        className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-5xl xl:max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 m-2 sm:m-4"
        aria-describedby="settings-description"
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription id="settings-description">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manufacturers" value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Wraps to multiple rows instead of horizontal-scrolling: with up to
              13 tabs, a single scrolling row hid most of them with no visual
              hint more existed. Wrapping costs some vertical space but keeps
              every tab discoverable. */}
          <div className="px-4 sm:px-6 pb-3 flex-shrink-0">
            <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1">
              <TabsTrigger value="manufacturers" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.manufacturers.title')}</TabsTrigger>
              <TabsTrigger value="materials" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.materials.title')}</TabsTrigger>
              <TabsTrigger value="colors" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.colors.title')}</TabsTrigger>
              <TabsTrigger value="diameters" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.diameters.title')}</TabsTrigger>
              <TabsTrigger value="storage-locations" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.storageLocations.title')}</TabsTrigger>
              <TabsTrigger value="units" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.units.title')}</TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.notifications.title')}</TabsTrigger>
              <TabsTrigger value="custom-fields" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.customFields.title')}</TabsTrigger>
              <TabsTrigger value="api-tokens" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.apiTokens.title')}</TabsTrigger>
              <TabsTrigger value="filament-import-export" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.filamentImportExport.title')}</TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="catalog-requests" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.catalogRequests.title')}</TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="email" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.email.title')}</TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="community-filaments" className="text-xs sm:text-sm whitespace-nowrap">{t('settings.communityFilaments.title')}</TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">

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

          <TabsContent value="units">
            <UnitsSettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsSettings />
          </TabsContent>

          <TabsContent value="custom-fields">
            <CustomFieldsSettings />
          </TabsContent>

          <TabsContent value="api-tokens">
            <ApiTokensSettings />
          </TabsContent>

          <TabsContent value="filament-import-export">
            <FilamentImportExport title={t('settings.filamentImportExport.title')} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="catalog-requests">
              <CatalogRequestsReview />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="email">
              <EmailSettingsCard />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="community-filaments">
              <CommunityFilamentsSettings />
            </TabsContent>
          )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
