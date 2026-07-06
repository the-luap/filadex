import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { Material, createMaterialSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const MATERIALS_CSV_FORMAT = `Name
PLA
PETG
ABS
TPU
...`;

export function MaterialsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<Material, { name: string }>
      entityKey="materials"
      endpoint="/api/materials"
      entityType="material"
      schema={createMaterialSchema}
      defaultValues={{ name: "" }}
      reorderable
      layout="table"
      columnHeaders={[t("common.name")]}
      emptyLabelSuffix="noMaterials"
      getSearchText={(item) => item.name}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.materials.namePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      renderItemCells={(item) => (
        <TableCell className="py-1 truncate">
          <Badge className="px-2 py-1 theme-primary-bg-20 text-white border-white/20 truncate max-w-full">
            <span className="truncate" title={item.name}>
              {item.name}
            </span>
          </Badge>
        </TableCell>
      )}
      csvFormat={MATERIALS_CSV_FORMAT}
      csvFields={["name"]}
    />
  );
}
