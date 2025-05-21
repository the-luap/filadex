import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Filament, Material, Manufacturer, StorageLocation } from "@shared/schema";
import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

interface BatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Filament>) => void;
  selectedCount: number;
}

export function BatchUpdateModal({
  isOpen,
  onClose,
  onUpdate,
  selectedCount
}: BatchUpdateModalProps) {
  const { t } = useTranslation();
  const [updates, setUpdates] = useState<Partial<Filament>>({});
  const NO_CHANGE_VALUE = "__no_change__";

  // Load data from the database
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['/api/manufacturers'],
    queryFn: () => apiRequest<Manufacturer[]>('/api/manufacturers'),
    enabled: isOpen
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['/api/materials'],
    queryFn: () => apiRequest<Material[]>('/api/materials'),
    enabled: isOpen
  });

  const { data: storageLocations = [] } = useQuery({
    queryKey: ['/api/storage-locations'],
    queryFn: () => apiRequest<StorageLocation[]>('/api/storage-locations'),
    enabled: isOpen
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create a copy of updates with remainingPercentage converted to string if present
    const processedUpdates = { ...updates };
    if (processedUpdates.remainingPercentage !== undefined) {
      processedUpdates.remainingPercentage = String(processedUpdates.remainingPercentage);
    }

    console.log("Submitting batch update with:", processedUpdates);
    onUpdate(processedUpdates);
  };

  const handleChange = (field: keyof Filament, value: any) => {
    if (value === NO_CHANGE_VALUE) {
      // Remove the field from updates if "no change" is selected
      const newUpdates = { ...updates };
      delete newUpdates[field];
      setUpdates(newUpdates);
    } else {
      // Add or update the field
      setUpdates(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('batch.updateTitle')}</DialogTitle>
          <DialogDescription id="batch-update-description">
            {t('batch.updateDescription', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-md flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {t('batch.updateWarning')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">{t('filaments.material')}</Label>
                <Select
                  onValueChange={(value) => handleChange('material', value)}
                  value={updates.material || NO_CHANGE_VALUE}
                >
                  <SelectTrigger id="material">
                    <SelectValue placeholder={t('batch.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE_VALUE}>{t('batch.noChange')}</SelectItem>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.name}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">{t('filaments.manufacturer')}</Label>
                <Select
                  onValueChange={(value) => handleChange('manufacturer', value)}
                  value={updates.manufacturer || NO_CHANGE_VALUE}
                >
                  <SelectTrigger id="manufacturer">
                    <SelectValue placeholder={t('batch.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE_VALUE}>{t('batch.noChange')}</SelectItem>
                    {manufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer.id} value={manufacturer.name}>
                        {manufacturer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t('filaments.status')}</Label>
                <Select
                  onValueChange={(value) => handleChange('status', value)}
                  value={updates.status || NO_CHANGE_VALUE}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder={t('batch.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE_VALUE}>{t('batch.noChange')}</SelectItem>
                    <SelectItem value="sealed">{t('filters.sealed')}</SelectItem>
                    <SelectItem value="opened">{t('filters.opened')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spoolType">{t('filaments.spoolType')}</Label>
                <Select
                  onValueChange={(value) => handleChange('spoolType', value)}
                  value={updates.spoolType || NO_CHANGE_VALUE}
                >
                  <SelectTrigger id="spoolType">
                    <SelectValue placeholder={t('batch.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE_VALUE}>{t('batch.noChange')}</SelectItem>
                    <SelectItem value="spooled">{t('filters.spooled')}</SelectItem>
                    <SelectItem value="spoolless">{t('filters.spoolless')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storageLocation">{t('filaments.storageLocation')}</Label>
              <Select
                onValueChange={(value) => handleChange('storageLocation', value)}
                value={updates.storageLocation || NO_CHANGE_VALUE}
              >
                <SelectTrigger id="storageLocation">
                  <SelectValue placeholder={t('batch.selectField')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CHANGE_VALUE}>{t('batch.noChange')}</SelectItem>
                  {storageLocations.map((location) => (
                    <SelectItem key={location.id} value={location.name}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="remainingPercentage">{t('filaments.remainingPercentage')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (updates.hasOwnProperty('remainingPercentage')) {
                      // Remove the field from updates if it's already set
                      const newUpdates = { ...updates };
                      delete newUpdates.remainingPercentage;
                      setUpdates(newUpdates);
                    } else {
                      // Set a default value when enabling the field
                      handleChange('remainingPercentage', 100);
                    }
                  }}
                >
                  {updates.hasOwnProperty('remainingPercentage')
                    ? t('batch.noChange')
                    : t('batch.setPercentage')}
                </Button>
              </div>

              <div className="flex items-center mt-2">
                <input
                  id="remainingPercentage"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="w-full mr-2"
                  value={updates.remainingPercentage || 0}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      handleChange('remainingPercentage', value);
                    }
                  }}
                  disabled={!updates.hasOwnProperty('remainingPercentage')}
                />
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-16 h-8 text-center border rounded-md"
                    value={updates.remainingPercentage || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= 100) {
                        handleChange('remainingPercentage', value);
                      }
                    }}
                    disabled={!updates.hasOwnProperty('remainingPercentage')}
                  />
                  <span className="ml-1">%</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={Object.keys(updates).length === 0}
            >
              {t('batch.updateButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
