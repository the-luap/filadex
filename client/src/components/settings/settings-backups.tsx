import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Download, Database, Save, HardDrive, RotateCw, Loader2 } from "lucide-react";
import type { BackupSettings } from "@shared/schema";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isStreaming, setIsStreaming] = useState(false);

  // Load backups list
  const { data: backups = [], isLoading: isLoadingBackups } = useQuery<BackupFile[]>({
    queryKey: ["/api/admin/backups"],
    queryFn: () => apiRequest<BackupFile[]>("/api/admin/backups"),
  });

  // Load schedule settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery<BackupSettings>({
    queryKey: ["/api/admin/backups/settings"],
    queryFn: () => apiRequest<BackupSettings>("/api/admin/backups/settings"),
  });

  const [form, setForm] = useState({
    enabled: false,
    schedule: "off",
    time: "02:00",
    dayOfWeek: 1,
    retentionCount: 7,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled ?? false,
        schedule: settings.schedule || "off",
        time: settings.time || "02:00",
        dayOfWeek: settings.dayOfWeek ?? 1,
        retentionCount: settings.retentionCount ?? 7,
      });
    }
  }, [settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/admin/backups/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups/settings"] });
      toast({
        title: t("settings.backups.scheduleCard.saved"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("settings.backups.scheduleCard.saveError"),
        variant: "destructive",
      });
    },
  });

  // Create immediate backup mutation
  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/backups", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups/settings"] });
      toast({
        title: t("settings.backups.createdSuccess"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("settings.backups.createdError"),
        variant: "destructive",
      });
    },
  });

  // Stream live snapshot
  const handleStreamSnapshot = async () => {
    setIsStreaming(true);
    try {
      const res = await fetch("/api/admin/backups/stream", { method: "POST" });
      if (!res.ok) throw new Error("Streaming failed");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = "filadex-backup.db";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: t("common.error"),
        description: t("settings.backups.streamError"),
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // Download stored backup file
  const handleDownloadBackup = async (filename: string) => {
    try {
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: t("common.error"),
        description: t("settings.backups.downloadError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Schedule Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCw className="h-5 w-5 text-primary" />
            {t("settings.backups.scheduleCard.title")}
          </CardTitle>
          <CardDescription>{t("settings.backups.scheduleCard.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="backups-enabled" className="cursor-pointer">
              {t("settings.backups.scheduleCard.enable")}
            </Label>
            <Switch
              id="backups-enabled"
              checked={form.enabled}
              onCheckedChange={(enabled) =>
                setForm((f) => ({
                  ...f,
                  enabled,
                  schedule: enabled && f.schedule === "off" ? "daily" : f.schedule,
                }))
              }
            />
          </div>

          {form.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="space-y-2">
                <Label>{t("settings.backups.scheduleCard.frequency")}</Label>
                <Select
                  value={form.schedule}
                  onValueChange={(schedule) => setForm((f) => ({ ...f, schedule }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("settings.backups.scheduleCard.daily")}</SelectItem>
                    <SelectItem value="weekly">{t("settings.backups.scheduleCard.weekly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.schedule === "weekly" && (
                <div className="space-y-2">
                  <Label>{t("settings.backups.scheduleCard.dayOfWeek")}</Label>
                  <Select
                    value={String(form.dayOfWeek)}
                    onValueChange={(val) => setForm((f) => ({ ...f, dayOfWeek: parseInt(val, 10) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t("settings.backups.scheduleCard.days.1")}</SelectItem>
                      <SelectItem value="2">{t("settings.backups.scheduleCard.days.2")}</SelectItem>
                      <SelectItem value="3">{t("settings.backups.scheduleCard.days.3")}</SelectItem>
                      <SelectItem value="4">{t("settings.backups.scheduleCard.days.4")}</SelectItem>
                      <SelectItem value="5">{t("settings.backups.scheduleCard.days.5")}</SelectItem>
                      <SelectItem value="6">{t("settings.backups.scheduleCard.days.6")}</SelectItem>
                      <SelectItem value="7">{t("settings.backups.scheduleCard.days.7")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("settings.backups.scheduleCard.time")}</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("settings.backups.scheduleCard.retention")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.retentionCount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      retentionCount: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.backups.scheduleCard.retentionHelp")}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending || isLoadingSettings}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Files List Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {t("settings.backups.title")}
            </CardTitle>
            <CardDescription>{t("settings.backups.description")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleStreamSnapshot}
              disabled={isStreaming}
              className="flex items-center gap-2"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              {isStreaming ? t("settings.backups.streamingSnapshot") : t("settings.backups.streamSnapshot")}
            </Button>
            <Button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              className="flex items-center gap-2"
            >
              {createBackupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {createBackupMutation.isPending ? t("settings.backups.creatingBackup") : t("settings.backups.createBackup")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBackups ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              {t("common.loading")}
            </div>
          ) : backups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {t("settings.backups.table.empty")}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.backups.table.filename")}</TableHead>
                    <TableHead>{t("settings.backups.table.size")}</TableHead>
                    <TableHead>{t("settings.backups.table.createdAt")}</TableHead>
                    <TableHead className="text-right">{t("settings.backups.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-xs sm:text-sm font-medium">
                        {b.filename}
                      </TableCell>
                      <TableCell>{formatBytes(b.size)}</TableCell>
                      <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadBackup(b.filename)}
                          title={t("settings.backups.table.download")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
