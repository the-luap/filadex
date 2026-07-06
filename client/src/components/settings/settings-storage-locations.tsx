import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { StorageLocation, createStorageLocationSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const STORAGE_LOCATIONS_CSV_FORMAT = `Name
Keller
Schrank
Regal A
Regal B
...`;

export function StorageLocationsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<StorageLocation, { name: string }>
      entityKey="storageLocations"
      endpoint="/api/storage-locations"
      entityType="storageLocation"
      schema={createStorageLocationSchema}
      defaultValues={{ name: "" }}
      reorderable
      layout="table"
      columnHeaders={[t("common.name")]}
      emptyLabelSuffix="noStorageLocations"
      getSearchText={(item) => item.name}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.storageLocations.namePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      renderItemCells={(item) => (
        <TableCell className="py-1 truncate">
          <div className="max-w-full truncate" title={item.name}>
            {item.name}
          </div>
        </TableCell>
      )}
      csvFormat={STORAGE_LOCATIONS_CSV_FORMAT}
      csvFields={["name"]}
    />
  );
}
