import { useState } from "react";
import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageOpen, PackageCheck } from "lucide-react";

interface BatchStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (status: string) => void;
  selectedCount: number;
}

export function BatchStatusModal({
  isOpen,
  onClose,
  onUpdate,
  selectedCount
}: BatchStatusModalProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status) {
      onUpdate(status);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="batch-status-description">
        <DialogHeader>
          <DialogTitle>{t('batch.updateStatusTitle')}</DialogTitle>
          <DialogDescription id="batch-status-description">
            {t('batch.updateStatusDescription', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">{t('filaments.status')}</Label>
            <Select
              onValueChange={setStatus}
              value={status}
              required
            >
              <SelectTrigger id="status">
                <SelectValue placeholder={t('batch.selectStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sealed" className="flex items-center">
                  <div className="flex items-center">
                    <PackageCheck className="h-4 w-4 mr-2" />
                    {t('filters.sealed')}
                  </div>
                </SelectItem>
                <SelectItem value="opened" className="flex items-center">
                  <div className="flex items-center">
                    <PackageOpen className="h-4 w-4 mr-2" />
                    {t('filters.opened')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={!status}
            >
              {t('batch.updateButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
