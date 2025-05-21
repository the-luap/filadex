import { useState } from "react";
import { Filament } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Trash2,
  Edit,
  Download,
  X,
  CheckSquare,
  Square,
  AlertTriangle
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { BatchUpdateModal } from "./batch-update-modal";
import { BatchDeleteModal } from "./batch-delete-modal";
import { apiRequest } from "@/lib/api";

interface BatchActionsPanelProps {
  selectedFilaments: Filament[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  onBatchDelete: (ids: number[]) => void;
  onBatchUpdate: (ids: number[], updates: Partial<Filament> & { _refresh?: boolean, _showToast?: boolean }) => void;
  onBatchExport: (format: 'csv' | 'json') => void;
  totalFilaments: number;
}

export function BatchActionsPanel({
  selectedFilaments,
  onClearSelection,
  onSelectAll,
  allSelected,
  onBatchDelete,
  onBatchUpdate,
  onBatchExport,
  totalFilaments
}: BatchActionsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const selectedCount = selectedFilaments.length;
  // Ensure all IDs are valid numbers and filter out any invalid ones
  const selectedIds = selectedFilaments
    .map(f => {
      const numId = Number(f.id);
      if (isNaN(numId)) {
        console.error(`Invalid ID detected in batch-actions-panel: ${f.id}`);
        return 0;
      }
      return numId;
    })
    .filter(id => id > 0);

  // Utility function to update a single filament
  const updateSingleFilament = async (id: number, updates: Record<string, string>): Promise<boolean> => {
    try {
      console.log(`Updating filament ${id} with:`, updates);

      // Create a direct fetch request
      const response = await fetch(`/api/filaments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error updating filament ${id}:`, errorText);
        return false;
      }

      console.log(`Successfully updated filament ${id}`);
      return true;
    } catch (error) {
      console.error(`Error updating filament ${id}:`, error);
      return false;
    }
  };

  // Handle batch update
  const handleBatchUpdate = async (updates: Partial<Filament>) => {
    console.log("Batch update with updates:", updates);

    // Check if we have any valid IDs
    if (selectedIds.length === 0) {
      console.error("No valid IDs to update");
      setShowUpdateModal(false);
      return;
    }

    // Clean up updates for API
    const cleanedUpdates: Record<string, string> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanedUpdates[key] = String(value);
      }
    });

    console.log("Cleaned updates for API:", cleanedUpdates);

    // Use individual updates for each filament
    let successCount = 0;
    let errorCount = 0;

    // Process each filament update one at a time to avoid race conditions
    for (const id of selectedIds) {
      const success = await updateSingleFilament(id, cleanedUpdates);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    console.log(`Batch update completed: ${successCount} successful, ${errorCount} failed`);

    // Show success or error toast notification
    if (successCount > 0) {
      // Don't show toast here, we'll show it after the refresh

      // Refresh the data by triggering a refetch
      // We don't need to pass the IDs and updates again since the updates have already been applied
      // Just call the parent's onBatchUpdate with a special flag to indicate a refresh
      // Use a timeout to ensure the UI updates properly
      setTimeout(() => {
        // Trigger a refetch by calling the parent's onBatchUpdate with special flags
        onBatchUpdate([], { _refresh: true, _showToast: true });
      }, 100);
    } else if (errorCount > 0) {
      toast({
        title: t('common.error'),
        description: t('batch.updateError', { count: errorCount }),
        variant: "destructive",
      });
    }

    setShowUpdateModal(false);
  };

  // Handle batch delete
  const handleBatchDelete = () => {
    onBatchDelete(selectedIds);
    setShowDeleteModal(false);
  };



  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-3 flex items-center space-x-2">
        <div className="flex items-center mr-2 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={allSelected ? onClearSelection : onSelectAll}
            title={allSelected ? t('batch.deselectAll') : t('batch.selectAll')}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 mr-1" />
            ) : (
              <Square className="h-4 w-4 mr-1" />
            )}
            <span className="text-xs">
              {allSelected ? t('batch.deselectAll') : t('batch.selectAll')}
            </span>
          </Button>
          <div className="text-sm font-medium ml-2">
            {t('batch.selected', { count: selectedCount, total: totalFilaments })}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setShowUpdateModal(true)}
          disabled={selectedCount === 0}
          title={t('batch.options')}
        >
          <Edit className="h-4 w-4 mr-1" />
          <span className="text-xs">{t('batch.options')}</span>
        </Button>

        <div className="border-l border-border pl-2 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onBatchExport('csv')}
            disabled={selectedCount === 0}
            title={t('batch.exportCSV')}
          >
            <Download className="h-4 w-4 mr-1" />
            <span className="text-xs">CSV</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onBatchExport('json')}
            disabled={selectedCount === 0}
            title={t('batch.exportJSON')}
          >
            <Download className="h-4 w-4 mr-1" />
            <span className="text-xs">JSON</span>
          </Button>
        </div>

        <div className="border-l border-border pl-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteModal(true)}
            disabled={selectedCount === 0}
            title={t('batch.delete')}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="text-xs">{t('batch.delete')}</span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 ml-2"
          onClick={onClearSelection}
          title={t('batch.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Batch Update Modal */}
      <BatchUpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onUpdate={handleBatchUpdate}
        selectedCount={selectedCount}
      />

      {/* Batch Delete Modal */}
      <BatchDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleBatchDelete}
        selectedCount={selectedCount}
      />


    </>
  );
}
