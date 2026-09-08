import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

interface CatalogStatus {
  count: number;
  lastUpdated: string | null;
}

interface CommunityFilamentStatus {
  ofd: CatalogStatus;
  spoolmandb: CatalogStatus;
  count: number;
  lastUpdated: string | null;
}

export function CommunityFilamentsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshingSource, setRefreshingSource] = useState<"ofd" | "spoolmandb" | "all" | null>(null);

  const { data: status } = useQuery<CommunityFilamentStatus>({
    queryKey: ["/api/community-filaments/status"],
    queryFn: () => apiRequest("/api/community-filaments/status"),
  });

  const refreshMutation = useMutation({
    mutationFn: (source?: "ofd" | "spoolmandb" | "all") =>
      apiRequest<{ count: number }>("/api/community-filaments/refresh", {
        method: "POST",
        body: JSON.stringify({ source }),
      }),
    onMutate: (source) => {
      setRefreshingSource(source || "all");
    },
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
    onSettled: () => {
      setRefreshingSource(null);
    },
  });

  const isPending = refreshMutation.isPending;

  return (
    <div className="space-y-6">
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
          <Button
            onClick={() => refreshMutation.mutate("all")}
            disabled={isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isPending && refreshingSource === "all" ? "animate-spin" : ""}`} />
            {t("settings.communityFilaments.refreshButton")}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Open Filament Database */}
        <Card>
          <CardHeader>
            <h4 className="text-md font-medium">{t("settings.communityFilaments.ofdTitle")}</h4>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {t("settings.communityFilaments.cachedCount", { count: status?.ofd?.count ?? 0 })}
              {status?.ofd?.lastUpdated && (
                <> · {t("settings.communityFilaments.lastUpdated")}: {new Date(status.ofd.lastUpdated).toLocaleString()}</>
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => refreshMutation.mutate("ofd")}
              disabled={isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isPending && refreshingSource === "ofd" ? "animate-spin" : ""}`} />
              {t("settings.communityFilaments.refreshOfd")}
            </Button>
          </CardContent>
        </Card>

        {/* SpoolmanDB */}
        <Card>
          <CardHeader>
            <h4 className="text-md font-medium">{t("settings.communityFilaments.spoolmanTitle")}</h4>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {t("settings.communityFilaments.cachedCount", { count: status?.spoolmandb?.count ?? 0 })}
              {status?.spoolmandb?.lastUpdated && (
                <> · {t("settings.communityFilaments.lastUpdated")}: {new Date(status.spoolmandb.lastUpdated).toLocaleString()}</>
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => refreshMutation.mutate("spoolmandb")}
              disabled={isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isPending && refreshingSource === "spoolmandb" ? "animate-spin" : ""}`} />
              {t("settings.communityFilaments.refreshSpoolman")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
