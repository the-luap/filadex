import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

interface CommunityFilamentStatus {
  count: number;
  lastUpdated: string | null;
}

export function CommunityFilamentsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status } = useQuery<CommunityFilamentStatus>({
    queryKey: ["/api/community-filaments/status"],
    queryFn: () => apiRequest("/api/community-filaments/status"),
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest<{ count: number }>("/api/community-filaments/refresh", { method: "POST" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-filaments/status"] });
      toast({
        title: t("settings.communityFilaments.refreshSuccess"),
        description: t("settings.communityFilaments.refreshSuccessDescription", { count: result.count }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("settings.communityFilaments.refreshError"),
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">{t("settings.communityFilaments.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.communityFilaments.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          {t("settings.communityFilaments.cachedCount", { count: status?.count ?? 0 })}
          {status?.lastUpdated && (
            <> · {t("settings.communityFilaments.lastUpdated")}: {new Date(status.lastUpdated).toLocaleString()}</>
          )}
        </p>
        <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          {t("settings.communityFilaments.refreshButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
