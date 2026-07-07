import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import { Droplet } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Material, createMaterialSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const MATERIALS_CSV_FORMAT = `Name,Density,IsHygroscopic
PLA,1.24,false
PETG,1.27,true
ABS,1.04,false
TPU,1.21,false
...`;

export function MaterialsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<Material, { name: string; density?: string; isHygroscopic?: boolean }>
      entityKey="materials"
      endpoint="/api/materials"
      entityType="material"
      schema={createMaterialSchema}
      defaultValues={{ name: "", density: "", isHygroscopic: false }}
      reorderable
      layout="table"
      columnHeaders={[t("common.name"), t("settings.materials.density"), t("settings.materials.hygroscopic")]}
      emptyLabelSuffix="noMaterials"
      getSearchText={(item) => item.name}
      renderAddFields={(form) => (
        <>
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
          <FormField
            control={form.control}
            name="density"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.materials.density")} (g/cm³)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="1.24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isHygroscopic"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">{t("settings.materials.hygroscopic")}</FormLabel>
              </FormItem>
            )}
          />
        </>
      )}
      renderItemCells={(item) => (
        <>
          <TableCell className="py-1 truncate">
            <Badge className="px-2 py-1 theme-primary-bg-20 text-white border-white/20 truncate max-w-full">
              <span className="truncate" title={item.name}>
                {item.name}
              </span>
            </Badge>
          </TableCell>
          <TableCell className="py-1 truncate">
            {item.density ?? "-"}
          </TableCell>
          <TableCell className="py-1 truncate">
            {item.isHygroscopic && <Droplet className="h-4 w-4 text-blue-400" />}
          </TableCell>
        </>
      )}
      csvFormat={MATERIALS_CSV_FORMAT}
      csvFields={["name", "density", "isHygroscopic"]}
    />
  );
}
