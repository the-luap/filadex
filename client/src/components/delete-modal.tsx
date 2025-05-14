import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Filament } from "@shared/schema";
import { useTranslation } from "@/i18n";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filament?: Filament;
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  filament
}: DeleteModalProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('filaments.deleteFilament')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('filaments.deleteConfirmation')} <span className="font-medium">{filament?.name}</span>?
            <p className="text-sm text-neutral-300 mt-2">
              {t('filaments.deleteWarning')}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-error hover:bg-red-700 text-white"
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
