import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Filament } from "@shared/schema";
import { useTranslation } from "@/i18n";
import { Printer } from "lucide-react";

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  filament?: Filament;
}

export function LabelPrintModal({ isOpen, onClose, filament }: LabelPrintModalProps) {
  const { t } = useTranslation();

  if (!filament) return null;

  const labelUrl = `${window.location.origin}/?openFilament=${filament.id}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md print:hidden">
        <DialogHeader>
          <DialogTitle>{t('filaments.printLabel')}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <div className="print-label border rounded-md p-4 flex items-center gap-4 dark:border-neutral-700">
            <QRCodeSVG value={labelUrl} size={100} />
            <div className="min-w-0">
              <p className="font-medium truncate max-w-[180px]" title={filament.name}>{filament.name}</p>
              {filament.manufacturer && (
                <p className="text-sm text-muted-foreground truncate max-w-[180px]">{filament.manufacturer}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {filament.colorCode && (
                  <span
                    className="inline-block h-4 w-4 rounded-full border"
                    style={{ backgroundColor: filament.colorCode }}
                  />
                )}
                <span className="text-sm">{filament.colorName}</span>
              </div>
              <p className="text-sm text-muted-foreground">{filament.material}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t('common.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
