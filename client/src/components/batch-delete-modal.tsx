import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
}

export function BatchDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount
}: BatchDeleteModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="batch-delete-description">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {t('batch.deleteTitle')}
          </DialogTitle>
          <DialogDescription id="batch-delete-description">
            {t('batch.deleteDescription', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {t('batch.deleteWarning')}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button 
            type="button" 
            variant="destructive"
            onClick={onConfirm}
          >
            {t('batch.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
