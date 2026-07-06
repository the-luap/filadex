import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import type { CatalogRequest, CatalogRequestEntityType } from "./settings/settings-types";

interface MyRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPayload(entityType: CatalogRequestEntityType, payload: Record<string, any>): string {
  if (entityType === "color") return `${payload.name} (${payload.code})`;
  if (entityType === "diameter") return `${payload.value}mm`;
  return payload.name;
}

export function MyRequestsModal({ open, onOpenChange }: MyRequestsModalProps) {
  const { t } = useTranslation();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/catalog-requests/mine"],
    queryFn: () => apiRequest<CatalogRequest[]>("/api/catalog-requests/mine"),
    enabled: open,
  });

  const statusVariant = (status: CatalogRequest["status"]) => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby="my-requests-description">
        <DialogHeader>
          <DialogTitle>{t("settings.catalogRequests.myRequests")}</DialogTitle>
          <DialogDescription id="my-requests-description">{t("settings.catalogRequestNotice")}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-center py-4">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-4 text-neutral-400">{t("settings.catalogRequests.myRequestsEmpty")}</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.catalogRequests.type")}</TableHead>
                  <TableHead>{t("settings.catalogRequests.value")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{t(`settings.${request.entityType}s.title`) || request.entityType}</TableCell>
                    <TableCell>{formatPayload(request.entityType, request.payload)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(request.status)}>
                        {t(`settings.catalogRequests.status${request.status.charAt(0).toUpperCase()}${request.status.slice(1)}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
