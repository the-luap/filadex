import { ReactNode, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm, UseFormReturn, DefaultValues } from "react-hook-form";
import { Form } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, X, Trash2, GripVertical } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ZodType } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { ImportExportCard } from "./settings-import-export-card";
import type { CatalogRequestEntityType } from "./settings-types";

export interface SettingsCrudListConfig<T extends { id: number }, FormValues extends Record<string, any>> {
  /** Translation namespace under `settings.*` and part of the query key, e.g. "manufacturers" */
  entityKey: string;
  /** API path, e.g. "/api/manufacturers" */
  endpoint: string;
  /** Entity type sent to /api/catalog-requests when a non-admin submits a request instead of adding directly */
  entityType: CatalogRequestEntityType;
  schema: (t: (key: string) => string) => ZodType<FormValues>;
  defaultValues: FormValues;
  /** Whether items can be drag-reordered via a `${endpoint}/:id/order` PATCH endpoint (table layout only) */
  reorderable?: boolean;
  layout: "table" | "chips";
  /** Table layout only: header labels for the content column(s), already translated */
  columnHeaders?: string[];
  /** Translation key suffix (under `settings.<entityKey>.*`) for the "list is empty" message, e.g. "noManufacturers" */
  emptyLabelSuffix: string;
  getSearchText: (item: T) => string;
  renderAddFields: (form: UseFormReturn<FormValues>) => ReactNode;
  /** Table layout: cell(s) rendered between the drag handle and the delete action */
  renderItemCells?: (item: T) => ReactNode;
  /** Chips layout: label content of each chip */
  renderChipLabel?: (item: T) => ReactNode;
  csvFormat: string;
  csvFields: string[];
}

export function SettingsCrudList<T extends { id: number }, FormValues extends Record<string, any>>(
  config: SettingsCrudListConfig<T, FormValues>
) {
  const {
    entityKey,
    endpoint,
    entityType,
    schema,
    defaultValues,
    reorderable = false,
    layout,
    columnHeaders = [],
    emptyLabelSuffix,
    getSearchText,
    renderAddFields,
    renderItemCells,
    renderChipLabel,
    csvFormat,
    csvFields,
  } = config;

  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const label = (suffix: string) => t(`settings.${entityKey}.${suffix}`);
  const canReorder = reorderable && isAdmin;

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () => apiRequest<T[]>(endpoint),
  });

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => getSearchText(item).toLowerCase().includes(term));
  }, [items, searchTerm, getSearchText]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [endpoint] });
    queryClient.invalidateQueries({ queryKey: ["/api/filaments"] });
  };

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, newOrder }: { id: number; newOrder: number }) =>
      apiRequest(`${endpoint}/${id}/order`, {
        method: "PATCH",
        body: JSON.stringify({ newOrder }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [endpoint] }),
    onError: (error) => {
      console.error(`Error updating ${entityKey} order:`, error);
      toast({
        title: t("common.error"),
        description: t("settings.reorderError"),
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;

    const item = filteredItems[sourceIndex];
    updateOrderMutation.mutate({ id: item.id, newOrder: destinationIndex });
  };

  const formSchema = schema(t);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues as DefaultValues<FormValues>,
  });

  const addMutation = useMutation({
    mutationFn: (data: FormValues) =>
      isAdmin
        ? apiRequest<T>(endpoint, { method: "POST", body: JSON.stringify(data) })
        : apiRequest(`/api/catalog-requests`, { method: "POST", body: JSON.stringify({ entityType, payload: data }) }),
    onSuccess: () => {
      form.reset(defaultValues as DefaultValues<FormValues>);
      if (isAdmin) {
        invalidate();
        toast({ title: label("addSuccess"), description: label("addSuccessDescription") });
      } else {
        toast({ title: t("settings.catalogRequestSubmitted"), description: t("settings.catalogRequestSubmittedDescription") });
      }
    },
    onError: () => {
      toast({ title: t("common.error"), description: label("addError"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: label("deleteSuccess"), description: label("deleteSuccessDescription") });
    },
    onError: (error: any) => {
      const errorMessage = error?.message?.includes("in use by filaments")
        ? label("deleteErrorInUse")
        : label("deleteError");
      toast({ title: label("deleteErrorTitle"), description: errorMessage, variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      // Delete all items in parallel and ignore errors for individual ones
      await Promise.all(
        items.map((item) =>
          apiRequest(`${endpoint}/${item.id}`, { method: "DELETE" }).catch((err) => {
            console.warn(`Error deleting ${entityKey} ${item.id}:`, err);
            return null;
          })
        )
      );
      return true;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: label("deleteAllSuccess"), description: label("deleteAllSuccessDescription") });
      setIsDeleteConfirmOpen(false);
    },
    onError: (error) => {
      console.error(`Error deleting all ${entityKey}:`, error);
      toast({ title: t("common.error"), description: label("deleteAllError"), variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setIsDeleteConfirmOpen(false);
    },
  });

  const actionButtonClass = "theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col space-y-2">
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={label("searchPlaceholder")}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9"
                    onClick={() => setSearchTerm("")}
                    aria-label={t("filters.clearSearch")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {isAdmin && (
              <div className="flex justify-end">
                <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm" disabled={items.length === 0} className={actionButtonClass}>
                      {label("deleteAll")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{label("deleteAllConfirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t(`settings.${entityKey}.deleteAllConfirmDescription`, { count: items.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteAllMutation.mutate()} className={actionButtonClass}>
                        {label("deleteAllConfirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">{label("loading")}</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-4 text-neutral-400">
                {items.length === 0 ? label(emptyLabelSuffix) : t("common.noResults")}
              </div>
            ) : layout === "chips" ? (
              <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto">
                {filteredItems.map((item) => (
                  <Badge
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5 theme-primary-bg-20 text-white hover:theme-primary-bg-30 border-white/20"
                  >
                    {renderChipLabel?.(item)}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-1 -mr-1 text-white hover:theme-primary-bg-30"
                        onClick={() => deleteMutation.mutate(item.id)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      {canReorder && <TableHead className="w-10"></TableHead>}
                      {columnHeaders.map((header, i) => (
                        <TableHead key={i} className={i === 0 ? "w-[65%]" : undefined}>
                          {header}
                        </TableHead>
                      ))}
                      <TableHead className="text-right w-16">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  {canReorder ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId={entityKey}>
                        {(provided) => (
                          <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                            {filteredItems.map((item, index) => (
                              <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                                {(provided, snapshot) => (
                                  <TableRow
                                    className={`h-10 ${snapshot.isDragging ? "opacity-50" : ""}`}
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                  >
                                    <TableCell className="py-1 w-10">
                                      <div {...provided.dragHandleProps} className="cursor-grab">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    </TableCell>
                                    {renderItemCells?.(item)}
                                    <TableCell className="text-right py-1 whitespace-nowrap w-16">
                                      {isAdmin && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-6 w-6 ${actionButtonClass}`}
                                          onClick={() => deleteMutation.mutate(item.id)}
                                          aria-label={t("common.delete")}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </TableBody>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          {renderItemCells?.(item)}
                          <TableCell className="text-right">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 ${actionButtonClass}`}
                                onClick={() => deleteMutation.mutate(item.id)}
                                aria-label={t("common.delete")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-2">{label("addTitle")}</h3>
              <p className="text-sm text-neutral-400 mb-4">{label("addDescription")}</p>
              {!isAdmin && (
                <p className="text-sm text-neutral-400 mb-4">{t("settings.catalogRequestNotice")}</p>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                  {renderAddFields(form)}
                  <Button type="submit" className={`w-full ${actionButtonClass}`} disabled={addMutation.isPending}>
                    {isAdmin ? label("addButton") : t("settings.requestButton")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <ImportExportCard endpoint={endpoint} csvFormat={csvFormat} fields={csvFields} title={label("importExport")} />
      )}
    </div>
  );
}
