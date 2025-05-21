import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { apiRequest } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface FilamentImportExportProps {
  title?: string;
}

export function FilamentImportExport({ title = "Import/Export Filaments" }: FilamentImportExportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const [importStatus, setImportStatus] = useState<{
    status: "idle" | "processing" | "success" | "error";
    message: string;
    added: number;
    skipped: number;
    errored: number;
  }>({
    status: "idle",
    message: "",
    added: 0,
    skipped: 0,
    errored: 0
  });

  // Handle CSV file upload
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({
      status: "processing",
      message: t('filaments.importExport.processing'),
      added: 0,
      skipped: 0,
      errored: 0
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvData = e.target?.result as string;

          // Send data to the server
          const result = await apiRequest(`/api/filaments?import=csv`, {
            method: "POST",
            body: JSON.stringify({ csvData })
          });

          // Update status
          setImportStatus({
            status: "success",
            message: t('filaments.importExport.successMessage', {
              created: result.created,
              duplicates: result.duplicates,
              errors: result.errors
            }),
            added: result.created,
            skipped: result.duplicates,
            errored: result.errors
          });

          // Refresh filaments data
          queryClient.invalidateQueries({ queryKey: ["filaments"] });
        } catch (error) {
          console.error("Error importing CSV:", error);
          setImportStatus({
            status: "error",
            message: t('filaments.importExport.errorMessage'),
            added: 0,
            skipped: 0,
            errored: 0
          });
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error("Error reading file:", error);
      setImportStatus({
        status: "error",
        message: t('filaments.importExport.errorMessage'),
        added: 0,
        skipped: 0,
        errored: 0
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle JSON file upload
  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({
      status: "processing",
      message: t('filaments.importExport.processing'),
      added: 0,
      skipped: 0,
      errored: 0
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonData = e.target?.result as string;

          // Send data to the server
          const result = await apiRequest(`/api/filaments?import=json`, {
            method: "POST",
            body: JSON.stringify({ jsonData })
          });

          // Update status
          setImportStatus({
            status: "success",
            message: t('filaments.importExport.successMessage', {
              created: result.created,
              duplicates: result.duplicates,
              errors: result.errors
            }),
            added: result.created,
            skipped: result.duplicates,
            errored: result.errors
          });

          // Refresh filaments data
          queryClient.invalidateQueries({ queryKey: ["filaments"] });
        } catch (error) {
          console.error("Error importing JSON:", error);
          setImportStatus({
            status: "error",
            message: t('filaments.importExport.errorMessage'),
            added: 0,
            skipped: 0,
            errored: 0
          });
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error("Error reading file:", error);
      setImportStatus({
        status: "error",
        message: t('filaments.importExport.errorMessage'),
        added: 0,
        skipped: 0,
        errored: 0
      });
    }

    // Reset file input
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.value = "";
    }
  };

  // Handle export
  const handleExportCsv = () => {
    window.location.href = "/api/filaments?export=csv";
  };

  const handleExportJson = () => {
    window.location.href = "/api/filaments?export=json";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {t('filaments.importExport.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {importStatus.status !== "idle" && (
          <Alert
            className={`mb-4 ${
              importStatus.status === "success"
                ? "bg-green-900/20 text-green-300"
                : importStatus.status === "error"
                ? "bg-red-900/20 text-red-300"
                : "bg-blue-900/20 text-blue-300"
            }`}
          >
            {importStatus.status === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : importStatus.status === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : null}
            <AlertTitle>
              {importStatus.status === "success"
                ? t('filaments.importExport.successTitle')
                : importStatus.status === "error"
                ? t('filaments.importExport.errorTitle')
                : t('filaments.importExport.processingTitle')}
            </AlertTitle>
            <AlertDescription>{importStatus.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">{t('filaments.importExport.importTitle')}</h3>
            <div className="flex flex-col space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                disabled={importStatus.status === "processing"}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('filaments.importExport.importCsvButton')}
              </Button>

              <input
                type="file"
                ref={jsonFileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleJsonUpload}
              />
              <Button
                onClick={() => jsonFileInputRef.current?.click()}
                className="w-full theme-primary-bg-20 hover:theme-primary-bg-30 text-white border-white/20"
                disabled={importStatus.status === "processing"}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('filaments.importExport.importJsonButton')}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">{t('filaments.importExport.exportTitle')}</h3>
            <div className="flex flex-col space-y-2">
              <Button
                onClick={handleExportCsv}
                className="w-full bg-emerald-900/20 hover:bg-emerald-900/30 text-white border-white/20"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('filaments.importExport.exportCsvButton')}
              </Button>

              <Button
                onClick={handleExportJson}
                className="w-full bg-emerald-900/20 hover:bg-emerald-900/30 text-white border-white/20"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('filaments.importExport.exportJsonButton')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
