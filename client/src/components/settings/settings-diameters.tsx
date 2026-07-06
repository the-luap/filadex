import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { Diameter, createDiameterSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const DIAMETERS_CSV_FORMAT = `Wert
1.75
2.85
3.00
...`;

export function DiametersList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<Diameter, { value: string }>
      entityKey="diameters"
      endpoint="/api/diameters"
      entityType="diameter"
      schema={createDiameterSchema}
      defaultValues={{ value: "" }}
      layout="chips"
      emptyLabelSuffix="noDiameters"
      getSearchText={(item) => item.value}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.diameters.value")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.diameters.valuePlaceholder")} {...field} type="number" step="0.01" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      renderChipLabel={(item) => `${item.value} mm`}
      csvFormat={DIAMETERS_CSV_FORMAT}
      csvFields={["value"]}
    />
  );
}
