import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Save, Send } from "lucide-react";

interface EmailSettingsResponse {
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean | null;
  fromEmail: string | null;
  fromName: string | null;
  hasPassword: boolean;
}

const EMPTY_FORM = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpSecure: true,
  fromEmail: "",
  fromName: "",
};

export function EmailSettingsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [testRecipient, setTestRecipient] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/settings/email"],
    queryFn: () => apiRequest<EmailSettingsResponse>("/api/settings/email"),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.enabled,
      smtpHost: data.smtpHost || "",
      smtpPort: data.smtpPort || 587,
      smtpUser: data.smtpUser || "",
      smtpPassword: "",
      smtpSecure: data.smtpSecure ?? true,
      fromEmail: data.fromEmail || "",
      fromName: data.fromName || "",
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      // Omit smtpPassword entirely if left blank, so the existing stored password is kept
      const { smtpPassword, ...rest } = form;
      const body = smtpPassword ? { ...rest, smtpPassword } : rest;
      return apiRequest("/api/settings/email", { method: "PUT", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({ title: t("settings.email.saved"), description: t("settings.email.savedDescription") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.email.saveError"), variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiRequest("/api/settings/email/test", { method: "POST", body: JSON.stringify({ to: testRecipient }) }),
    onSuccess: () => {
      toast({ title: t("settings.email.testSent"), description: t("settings.email.testSentDescription") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message || t("settings.email.testError"), variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.email.title")}</CardTitle>
        <CardDescription>{t("settings.email.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="email-enabled">{t("settings.email.enable")}</Label>
          <Switch
            id="email-enabled"
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">{t("settings.email.smtpHost")}</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.example.com"
              value={form.smtpHost}
              onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-port">{t("settings.email.smtpPort")}</Label>
            <Input
              id="smtp-port"
              type="number"
              value={form.smtpPort}
              onChange={(e) => setForm((f) => ({ ...f, smtpPort: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">{t("settings.email.smtpUser")}</Label>
            <Input
              id="smtp-user"
              value={form.smtpUser}
              onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-password">{t("settings.email.smtpPassword")}</Label>
            <Input
              id="smtp-password"
              type="password"
              placeholder={data?.hasPassword ? t("settings.email.passwordUnchanged") : ""}
              value={form.smtpPassword}
              onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-email">{t("settings.email.fromEmail")}</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="filadex@example.com"
              value={form.fromEmail}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-name">{t("settings.email.fromName")}</Label>
            <Input
              id="from-name"
              placeholder="Filadex"
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="smtp-secure">{t("settings.email.smtpSecure")}</Label>
          <Switch
            id="smtp-secure"
            checked={form.smtpSecure}
            onCheckedChange={(smtpSecure) => setForm((f) => ({ ...f, smtpSecure }))}
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {t("common.save")}
        </Button>

        <div className="border-t pt-4 space-y-2">
          <Label htmlFor="test-recipient">{t("settings.email.testRecipient")}</Label>
          <div className="flex gap-2">
            <Input
              id="test-recipient"
              type="email"
              placeholder="you@example.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testRecipient}
            >
              <Send className="mr-2 h-4 w-4" />
              {t("settings.email.sendTest")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
