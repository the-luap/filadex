import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Copy } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

interface ApiTokenSummary {
  id: number;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ApiTokensSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const { data: tokens = [], isLoading } = useQuery<ApiTokenSummary[]>({
    queryKey: ["/api/api-tokens"],
    queryFn: () => apiRequest("/api/api-tokens"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest<{ token: string }>("/api/api-tokens", {
      method: "POST",
      body: JSON.stringify({ label: label.trim() || undefined }),
    }),
    onSuccess: (result) => {
      setLabel("");
      setNewToken(result.token);
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.apiTokens.createError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/api-tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens"] });
      toast({ title: t("settings.apiTokens.revokeSuccess") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.apiTokens.revokeError"), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">{t("settings.apiTokens.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.apiTokens.description")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-neutral-400">{t("settings.apiTokens.empty")}</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((tok) => (
                <div key={tok.id} className="flex items-center justify-between border rounded-md px-3 py-2 dark:border-neutral-700">
                  <div>
                    <p className="font-medium">{tok.label || t("settings.apiTokens.unlabeled")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.apiTokens.createdAt")}: {new Date(tok.createdAt).toLocaleDateString()}
                      {tok.lastUsedAt && ` · ${t("settings.apiTokens.lastUsed")}: ${new Date(tok.lastUsedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(tok.id)}
                    aria-label={t("settings.apiTokens.revoke")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder={t("settings.apiTokens.labelPlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {t("settings.apiTokens.createButton")}
            </Button>
          </div>

          {newToken && (
            <div className="border rounded-md p-3 dark:border-neutral-700 bg-primary/5">
              <p className="text-sm font-medium mb-1">{t("settings.apiTokens.newTokenTitle")}</p>
              <p className="text-xs text-muted-foreground mb-2">{t("settings.apiTokens.newTokenWarning")}</p>
              <div className="flex gap-2">
                <Input readOnly value={newToken} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(newToken)}
                  aria-label={t("common.copy")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewToken(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
