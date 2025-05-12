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
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Filament löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie das Filament <span className="font-medium">{filament?.name}</span> wirklich löschen?
            <p className="text-sm text-neutral-300 mt-2">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-error hover:bg-red-700 text-white"
          >
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
