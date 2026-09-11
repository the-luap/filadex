import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { Manufacturer, createManufacturerSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const MANUFACTURERS_CSV_FORMAT = `Name
Bambu Lab
Prusament
Polymaker
...`;

export function ManufacturersList() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();

  const ownsOrIsAdmin = (item: Manufacturer) =>
    isAdmin || (item.userId !== null && item.userId !== undefined && item.userId === user?.id);

  return (
    <SettingsCrudList<Manufacturer, { name: string }>
      entityKey="manufacturers"
      endpoint="/api/manufacturers"
      entityType="manufacturer"
      schema={createManufacturerSchema}
      defaultValues={{ name: "" }}
      reorderable
      layout="table"
      columnHeaders={[t("common.name")]}
      emptyLabelSuffix="noManufacturers"
      getSearchText={(item) => item.name}
      canDelete={ownsOrIsAdmin}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.manufacturers.namePlaceholder")} {...field} />
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
      csvFormat={MANUFACTURERS_CSV_FORMAT}
      csvFields={["name"]}
    />
  );
}
