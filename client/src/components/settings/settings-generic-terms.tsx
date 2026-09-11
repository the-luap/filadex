import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { useTranslation } from "@/i18n";
import { GenericTerm, createGenericTermSchema } from "./settings-types";
import { SettingsCrudList } from "./settings-crud-list";

const GENERIC_TERMS_CSV_FORMAT = `word
lab
filament
3d
...`;

export function GenericTermsList() {
  const { t } = useTranslation();

  return (
    <SettingsCrudList<GenericTerm, { word: string }>
      entityKey="generic-terms"
      endpoint="/api/generic-terms"
      entityType="generic term"
      schema={createGenericTermSchema}
      defaultValues={{ word: "" }}
      layout="table"
      columnHeaders={[t("settings.genericTerms.word")]}
      emptyLabelSuffix="noGenericTerms"
      getSearchText={(item) => item.word}
      renderAddFields={(form) => (
        <FormField
          control={form.control}
          name="word"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.genericTerms.word")}</FormLabel>
              <FormControl>
                <Input placeholder={t("settings.genericTerms.wordPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      renderItemCells={(item) => (
        <TableCell className="py-1 truncate">
          <div className="max-w-full truncate" title={item.word}>
            {item.word}
          </div>
        </TableCell>
      )}
      csvFormat={GENERIC_TERMS_CSV_FORMAT}
      csvFields={["word"]}
    />
  );
}
