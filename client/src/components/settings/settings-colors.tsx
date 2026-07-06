import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { Color, createColorSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const COLORS_CSV_FORMAT = `Brand,Color Name,Hex Code
Bambu Lab,Dark Gray,#545454
Bambu Lab,Black,#000000
Prusament,Galaxy Black,#111111
...`;

export function ColorsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<Color, { name: string; code: string }>
      entityKey="colors"
      endpoint="/api/colors"
      entityType="color"
      schema={createColorSchema}
      defaultValues={{ name: "", code: "#000000" }}
      layout="table"
      columnHeaders={[t("common.name"), t("settings.colors.code")]}
      emptyLabelSuffix="noColors"
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
                  <Input placeholder={t("settings.colors.namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.colors.code")}</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Input type="color" className="w-16 h-10" value={field.value} onChange={(e) => field.onChange(e.target.value)} />
                    <Input placeholder="#000000" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
      renderItemCells={(item) => (
        <>
          <TableCell>{item.name}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: item.code }} />
              <span>{item.code}</span>
            </div>
          </TableCell>
        </>
      )}
      csvFormat={COLORS_CSV_FORMAT}
      csvFields={["name", "code"]}
    />
  );
}
