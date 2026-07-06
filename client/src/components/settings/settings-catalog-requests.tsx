import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import type { CatalogRequest, CatalogRequestEntityType } from "./settings-types";

function formatPayload(entityType: CatalogRequestEntityType, payload: Record<string, any>): string {
  if (entityType === "color") return `${payload.name} (${payload.code})`;
  if (entityType === "diameter") return `${payload.value}mm`;
  return payload.name;
}

export function CatalogRequestsReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/catalog-requests", "pending"],
    queryFn: () => apiRequest<CatalogRequest[]>("/api/catalog-requests?status=pending"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/catalog-requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/diameters"] });
    queryClient.invalidateQueries({ queryKey: ["/api/storage-locations"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/catalog-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast({ title: t("settings.catalogRequests.approved") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiRequest(`/api/catalog-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => {
      invalidate();
      toast({ title: t("settings.catalogRequests.rejected") });
      setRejectingId(null);
      setRejectNote("");
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="text-center py-4">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-4 text-neutral-400">{t("settings.catalogRequests.empty")}</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.catalogRequests.type")}</TableHead>
                  <TableHead>{t("settings.catalogRequests.value")}</TableHead>
                  <TableHead>{t("settings.catalogRequests.requestedBy")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Badge variant="outline">{t(`settings.${request.entityType}s.title`) || request.entityType}</Badge>
                    </TableCell>
                    <TableCell>{formatPayload(request.entityType, request.payload)}</TableCell>
                    <TableCell>{request.requestedBy}</TableCell>
                    <TableCell className="text-right">
                      {rejectingId === request.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            placeholder={t("settings.catalogRequests.rejectNotePlaceholder")}
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="w-40 h-8"
                          />
                          <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate({ id: request.id, note: rejectNote })}>
                            {t("settings.catalogRequests.confirmReject")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate(request.id)} aria-label={t("settings.catalogRequests.approve")}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setRejectingId(request.id)} aria-label={t("settings.catalogRequests.reject")}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
