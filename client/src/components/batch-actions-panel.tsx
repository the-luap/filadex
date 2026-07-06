import { useState } from "react";
import { Filament } from "@shared/schema";
import { Button } from "@/components/ui/button";
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

interface BatchActionsPanelProps {
  selectedFilaments: Filament[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  onBatchDelete: (ids: number[]) => void;
  onBatchUpdate: (ids: number[], updates: Partial<Filament>) => void;
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

  // Handle batch update
  const handleBatchUpdate = (updates: Partial<Filament>) => {
    if (selectedIds.length > 0) {
      onBatchUpdate(selectedIds, updates);
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
