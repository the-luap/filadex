import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

export interface CustomFieldDefinition {
  id: number;
  name: string;
  fieldType: "text" | "number" | "boolean" | "date";
  createdAt: string;
}

const FIELD_TYPES: CustomFieldDefinition["fieldType"][] = ["text", "number", "boolean", "date"];

export function CustomFieldsSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldDefinition["fieldType"]>("text");

  const { data: definitions = [], isLoading } = useQuery<CustomFieldDefinition[]>({
    queryKey: ["/api/custom-fields"],
    queryFn: () => apiRequest("/api/custom-fields"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
    queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/custom-fields", {
        method: "POST",
        body: JSON.stringify({ name, fieldType, entityType: "filament" }),
      }),
    onSuccess: () => {
      setName("");
      setFieldType("text");
      invalidate();
      toast({ title: t("settings.customFields.addSuccess") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.customFields.addError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/custom-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: t("settings.customFields.deleteSuccess") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("settings.customFields.deleteError"), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">{t("settings.customFields.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.customFields.description")}</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : definitions.length === 0 ? (
            <div className="text-center py-4 text-neutral-400">{t("settings.customFields.empty")}</div>
          ) : (
            <div className="space-y-2">
              {definitions.map((def) => (
                <div key={def.id} className="flex items-center justify-between border rounded-md px-3 py-2 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{def.name}</span>
                    <Badge variant="outline">{t(`settings.customFields.types.${def.fieldType}`)}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(def.id)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">{t("settings.customFields.addTitle")}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder={t("settings.customFields.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomFieldDefinition["fieldType"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`settings.customFields.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            disabled={!name.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {t("settings.customFields.addButton")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
