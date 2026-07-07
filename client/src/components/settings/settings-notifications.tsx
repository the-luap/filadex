import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface NotificationPreferences {
  lowStockThresholdPercent: number;
  notifyLowStock: boolean;
  notifyDryingReminder: boolean;
  dryingReminderDays: number;
}

export function NotificationsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<NotificationPreferences>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("/api/auth/me"),
  });

  const [lowStockThresholdPercent, setLowStockThresholdPercent] = useState(15);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyDryingReminder, setNotifyDryingReminder] = useState(true);
  const [dryingReminderDays, setDryingReminderDays] = useState(30);

  useEffect(() => {
    if (user) {
      setLowStockThresholdPercent(user.lowStockThresholdPercent ?? 15);
      setNotifyLowStock(user.notifyLowStock ?? true);
      setNotifyDryingReminder(user.notifyDryingReminder ?? true);
      setDryingReminderDays(user.dryingReminderDays ?? 30);
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/users/notification-preferences", {
        method: "POST",
        body: JSON.stringify({
          lowStockThresholdPercent,
          notifyLowStock,
          notifyDryingReminder,
          dryingReminderDays,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: t("settings.notifications.updated"),
        description: t("settings.notifications.updatedDescription"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("settings.notifications.updateError"),
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.notifications.title")}</CardTitle>
        <CardDescription>{t("settings.notifications.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.notifications.lowStockLabel")}</Label>
            <p className="text-sm text-muted-foreground">{t("settings.notifications.lowStockDescription")}</p>
          </div>
          <Switch checked={notifyLowStock} onCheckedChange={setNotifyLowStock} />
        </div>

        {notifyLowStock && (
          <div className="space-y-2">
            <Label htmlFor="low-stock-threshold">{t("settings.notifications.thresholdLabel")}</Label>
            <Input
              id="low-stock-threshold"
              type="number"
              min={0}
              max={100}
              value={lowStockThresholdPercent}
              onChange={(e) => setLowStockThresholdPercent(Number(e.target.value))}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.notifications.dryingLabel")}</Label>
            <p className="text-sm text-muted-foreground">{t("settings.notifications.dryingDescription")}</p>
          </div>
          <Switch checked={notifyDryingReminder} onCheckedChange={setNotifyDryingReminder} />
        </div>

        {notifyDryingReminder && (
          <div className="space-y-2">
            <Label htmlFor="drying-reminder-days">{t("settings.notifications.dryingDaysLabel")}</Label>
            <Input
              id="drying-reminder-days"
              type="number"
              min={1}
              value={dryingReminderDays}
              onChange={(e) => setDryingReminderDays(Number(e.target.value))}
            />
          </div>
        )}

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
