import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanFace, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface NFCScannerProps {
  onScanSuccess: (data: any) => void;
  onClose: () => void;
}

export function NFCScanner({ onScanSuccess, onClose }: NFCScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(true);

  useEffect(() => {
    // Check if NFC API is available in the browser
    if (!('NDEFReader' in window)) {
      setNfcSupported(false);
      setError("Ihr Browser unterstützt kein NFC. Verwenden Sie Chrome auf Android oder Safari auf neueren iOS-Geräten.");
      return;
    }

    // Start NFC scanning with a small delay to ensure component is fully mounted
    const startNfcScan = async () => {
      setIsScanning(true);
      setError(null);
      
      try {
        // @ts-ignore - TypeScript kennt den NDEFReader nicht
        const ndef = new window.NDEFReader();
        
        await ndef.scan();
        console.log("NFC-Scanner gestartet, warte auf Tags...");
        
        ndef.addEventListener("reading", (event: any) => {
          console.log("NFC-Tag erkannt:", event);
          
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
          console.error("NFC-Fehler:", error);
          setError(`NFC-Fehler: ${error.message}`);
          setIsScanning(false);
        });
        
      } catch (error: any) {
        console.error("NFC-Scan Fehler:", error);
        
        if (error.name === 'NotAllowedError') {
          setError("NFC-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff auf NFC in Ihren Browsereinstellungen.");
        } else if (error.name === 'NotSupportedError') {
          setError("NFC wird auf diesem Gerät nicht unterstützt oder ist deaktiviert.");
          setNfcSupported(false);
        } else if (error.name === 'SecurityError') {
          setError("NFC benötigt einen sicheren Kontext (HTTPS). Bitte verwenden Sie eine sichere Verbindung.");
        } else {
          setError(`Fehler beim Scannen nach NFC-Tags: ${error.message}`);
        }
        setIsScanning(false);
      }
    };
    
    // Kleine Verzögerung, um sicherzustellen, dass die Komponente vollständig gemountet ist
    const timer = setTimeout(() => {
      startNfcScan();
    }, 300);
    
    // Aufräumen beim Unmount
    return () => {
      clearTimeout(timer);
    };
  }, [onScanSuccess]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="justify-between flex-row items-center">
          <DialogTitle className="flex items-center">
            <ScanFace className="mr-2 h-5 w-5" />
            NFC-Tag scannen
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
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
                <h3 className="text-lg font-medium">Bereit zum Scannen</h3>
                <p className="text-sm text-neutral-400">
                  Halten Sie Ihr Gerät an den NFC-Tag, um ihn zu scannen.
                  <br />
                  Der Scan erfolgt automatisch.
                </p>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} variant={!nfcSupported ? "default" : "outline"} className="w-full">
            {!nfcSupported ? "Schließen" : "Abbrechen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}