import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanFace, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "@/i18n";

interface NFCScannerProps {
  onScanSuccess: (data: any) => void;
  onClose: () => void;
}

export function NFCScanner({ onScanSuccess, onClose }: NFCScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(true);

  useEffect(() => {
    // Check if NFC API is available in the browser
    if (!('NDEFReader' in window)) {
      setNfcSupported(false);
      setError(t('common.scanner.nfcNotSupported'));
      return;
    }

    // Start NFC scanning with a small delay to ensure component is fully mounted
    const startNfcScan = async () => {
      setIsScanning(true);
      setError(null);

      try {
        // @ts-ignore - TypeScript doesn't know NDEFReader
        const ndef = new window.NDEFReader();

        await ndef.scan();
        console.log("NFC scanner started, waiting for tags...");

        ndef.addEventListener("reading", (event: any) => {
          console.log("NFC tag detected:", event);

          // Extract NFC data
          const records = event.message.records;
          const nfcData = {
            serialNumber: event.serialNumber,
            records: records.map((record: any) => {
              // Convert record data based on recordType
              if (record.recordType === 'text') {
                const textDecoder = new TextDecoder();
                return {
                  type: 'text',
                  text: textDecoder.decode(record.data)
                };
              } else if (record.recordType === 'url') {
                const textDecoder = new TextDecoder();
                return {
                  type: 'url',
                  url: textDecoder.decode(record.data)
                };
              } else {
                return {
                  type: record.recordType,
                  data: record.data
                };
              }
            })
          };

          // Pass the NFC data to the parent component
          onScanSuccess(nfcData);
        });

        ndef.addEventListener("error", (error: any) => {
          console.error("NFC error:", error);
          setError(`NFC error: ${error.message}`);
          setIsScanning(false);
        });

      } catch (error: any) {
        console.error("NFC scan error:", error);

        if (error.name === 'NotAllowedError') {
          setError(t('common.scanner.nfcAccessDenied'));
        } else if (error.name === 'NotSupportedError') {
          setError(t('common.scanner.nfcNotAvailable'));
          setNfcSupported(false);
        } else if (error.name === 'SecurityError') {
          setError(t('common.scanner.nfcSecurityError'));
        } else {
          setError(t('common.scanner.nfcScanError', { message: error.message }));
        }
        setIsScanning(false);
      }
    };

    // Small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      startNfcScan();
    }, 300);

    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
    };
  }, [onScanSuccess, t]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="justify-between flex-row items-center">
          <DialogTitle className="flex items-center">
            <ScanFace className="mr-2 h-5 w-5" />
            {t('common.scanner.nfcTagTitle')}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.scanner.error')}</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute w-40 h-40 border-4 border-primary rounded-full opacity-20"></div>
                <div className="animate-ping absolute w-32 h-32 border-4 border-primary rounded-full opacity-40"></div>
                <div className="relative w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                  <ScanFace className="h-10 w-10 text-primary animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">{t('common.scanner.ready')}</h3>
                <p className="text-sm text-neutral-400">
                  {t('common.scanner.holdDevice')}
                  <br />
                  {t('common.scanner.scanHappensAuto')}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant={!nfcSupported ? "default" : "outline"} className="w-full">
            {!nfcSupported ? t('common.scanner.close') : t('common.scanner.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}