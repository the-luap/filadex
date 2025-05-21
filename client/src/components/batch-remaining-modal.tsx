import { useState } from "react";
import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Percent } from "lucide-react";

interface BatchRemainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (remainingPercentage: number) => void;
  selectedCount: number;
}

export function BatchRemainingModal({
  isOpen,
  onClose,
  onUpdate,
  selectedCount
}: BatchRemainingModalProps) {
  const { t } = useTranslation();
  const [remainingPercentage, setRemainingPercentage] = useState<number>(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting batch remaining update with:", remainingPercentage);
    // Convert to number to ensure it's a valid number
    const numValue = Number(remainingPercentage);
    onUpdate(numValue);
  };

  const handleSliderChange = (value: number[]) => {
    setRemainingPercentage(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setRemainingPercentage(value);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="batch-remaining-description">
        <DialogHeader>
          <DialogTitle>{t('batch.updateRemainingTitle')}</DialogTitle>
          <DialogDescription id="batch-remaining-description">
            {t('batch.updateRemainingDescription', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="remainingPercentage">{t('filaments.remainingPercentage')}</Label>
              <div className="flex items-center border rounded-md w-20 overflow-hidden">
                <Input
                  id="remainingPercentage"
                  type="number"
                  min={0}
                  max={100}
                  value={remainingPercentage}
                  onChange={handleInputChange}
                  className="border-0 text-right pr-1"
                />
                <span className="pr-2">%</span>
              </div>
            </div>
            <Slider
              value={[remainingPercentage]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleSliderChange}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('batch.updateButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
