import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scan, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useTranslation } from "@/i18n";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

// Typen für Bambulab Filament Eigenschaften
export interface BambuFilamentData {
  name?: string;
  material?: string;
  colorName?: string;
  colorCode?: string;
  manufacturer?: string;
  diameter?: number;
  totalWeight?: number;
  printTemp?: string;
  barcode?: string;
}

// Processes the scanned code and tries to recognize Bambulab filament data
export const processScanResult = (code: string): BambuFilamentData | null => {
  // Try to parse as JSON (if it's already a structured QR code)
  try {
    const jsonData = JSON.parse(code);
    if (jsonData.name || jsonData.material) {
      return jsonData;
    }
  } catch (e) {
    // Not valid JSON, let's try to recognize other formats
  }

  // Bambulab 1D Barcode Format
  // Format: BBL-XYZ-123456
  // where XYZ is the material code and the digits can contain color codes etc.
  if (code.startsWith('BBL-')) {
    return processBambuLabBarcode(code);
  }

  // Bambulab QR Code Format for filaments
  // Example: [BBL]PLA Matte Black 1KG
  if (code.startsWith('[BBL]')) {
    return processBambuLabQRCode(code);
  }

  return null; // No known format recognized
};

// Processes a Bambulab barcode
export const processBambuLabBarcode = (barcode: string): BambuFilamentData => {
  // Format: BBL-XYZ-123456
  const parts = barcode.split('-');

  if (parts.length < 2) {
    return {
      manufacturer: "Bambu Lab",
      name: barcode
    };
  }

  const materialCode = parts[1];
  let material = '';
  let colorName = '';

  // Material-Codes erkennen
  if (materialCode.startsWith('PLA')) {
    material = 'pla';
  } else if (materialCode.startsWith('ABS')) {
    material = 'abs';
  } else if (materialCode.startsWith('PET')) {
    material = 'petg';
  } else if (materialCode.startsWith('TPU')) {
    material = 'tpu';
  } else if (materialCode.startsWith('PA')) {
    material = 'pa';
  } else if (materialCode.startsWith('ASA')) {
    material = 'asa';
  } else if (materialCode.startsWith('PCTG')) {
    material = 'pctg';
  } else if (materialCode.startsWith('PVA')) {
    material = 'pva';
  } else if (materialCode.startsWith('PC')) {
    material = 'pc';
  } else if (materialCode.startsWith('HIPS')) {
    material = 'hips';
  }

  // Farb-Codes erkennen
  let colorCode = '#FFFFFF'; // Standard-Farbe Weiß

  if (barcode.includes('BLK') || barcode.includes('01')) {
    colorName = 'Black';
    colorCode = '#000000';
  } else if (barcode.includes('WHT') || barcode.includes('02')) {
    colorName = 'White';
    colorCode = '#FFFFFF';
  } else if (barcode.includes('RED') || barcode.includes('03')) {
    colorName = 'Red';
    colorCode = '#C12E1F';
  } else if (barcode.includes('BLU') || barcode.includes('04')) {
    colorName = 'Blue';
    colorCode = '#0A2989';
  } else if (barcode.includes('GRN') || barcode.includes('05')) {
    colorName = 'Green';
    colorCode = '#00AE42';
  } else if (barcode.includes('YEL') || barcode.includes('06')) {
    colorName = 'Yellow';
    colorCode = '#FCE300';
  } else if (barcode.includes('GRY') || barcode.includes('07')) {
    colorName = 'Gray';
    colorCode = '#545454';
  } else if (barcode.includes('ORG') || barcode.includes('08')) {
    colorName = 'Orange';
    colorCode = '#FA6607';
  }

  // Standard-Drucktemperaturen für Bambu Lab Materialien
  let printTemp = '';
  switch (material) {
    case 'pla':
      printTemp = '210-230';
      break;
    case 'abs':
      printTemp = '240-270';
      break;
    case 'petg':
      printTemp = '230-260';
      break;
    case 'tpu':
      printTemp = '220-240';
      break;
    case 'pa':
      printTemp = '260-290';
      break;
    case 'asa':
      printTemp = '240-270';
      break;
    case 'pc':
      printTemp = '260-290';
      break;
    case 'pctg':
      printTemp = '250-270';
      break;
    case 'pva':
      printTemp = '210-230';
      break;
    default:
      printTemp = '200-230';
  }

  const materialMap: Record<string, string> = {
    'pla': 'PLA',
    'pla-cf': 'PLA-CF',
    'abs': 'ABS',
    'abs-cf': 'ABS-CF',
    'petg': 'PETG',
    'petg-cf': 'PETG-CF',
    'tpu': 'TPU',
    'pa': 'PA',
    'pa-cf': 'PA-CF',
    'asa': 'ASA',
    'pc': 'PC',
    'pc-cf': 'PC-CF',
    'pctg': 'PCTG',
    'pva': 'PVA'
  };

  const materialLabel = materialMap[material] || material.toUpperCase();
  const nameWithColor = colorName ? `${materialLabel} ${colorName}` : materialLabel;

  return {
    name: nameWithColor,
    material: material,
    colorName: colorName || undefined,
    colorCode: colorCode,
    manufacturer: "Bambu Lab",
    diameter: 1.75, // Standard für Bambu Lab
    totalWeight: 1, // Standard-Gewicht (1kg) für Bambu Lab Spulen
    printTemp: printTemp,
    barcode: barcode,
  };
};

// Verarbeitet einen Bambulab QR-Code
export const processBambuLabQRCode = (qrCode: string): BambuFilamentData => {
  // Format: [BBL]PLA Matte Black 1KG
  const text = qrCode.replace('[BBL]', '').trim();

  // Materialtyp extrahieren (z.B. PLA, PETG, etc.)
  let material = '';
  let colorName = '';
  let weight: number | undefined;

  // Versuche, das Material zu erkennen
  if (text.startsWith('PLA')) {
    material = 'pla';
  } else if (text.startsWith('ABS')) {
    material = 'abs';
  } else if (text.startsWith('PETG')) {
    material = 'petg';
  } else if (text.startsWith('TPU')) {
    material = 'tpu';
  } else if (text.startsWith('ASA')) {
    material = 'asa';
  } else if (text.startsWith('PA')) {
    material = 'pa';
  } else if (text.startsWith('PC')) {
    material = 'pc';
  } else if (text.startsWith('PCTG')) {
    material = 'pctg';
  } else if (text.startsWith('PVA')) {
    material = 'pva';
  } else if (text.startsWith('HIPS')) {
    material = 'hips';
  }

  // Versuche, die Farbe zu erkennen
  if (text.includes('Black') || text.includes('Schwarz')) {
    colorName = 'Black';
  } else if (text.includes('White') || text.includes('Weiß')) {
    colorName = 'White';
  } else if (text.includes('Red') || text.includes('Rot')) {
    colorName = 'Red';
  } else if (text.includes('Blue') || text.includes('Blau')) {
    colorName = 'Blue';
  } else if (text.includes('Green') || text.includes('Grün')) {
    colorName = 'Green';
  } else if (text.includes('Yellow') || text.includes('Gelb')) {
    colorName = 'Yellow';
  } else if (text.includes('Orange')) {
    colorName = 'Orange';
  } else if (text.includes('Gray') || text.includes('Grau') || text.includes('Grey')) {
    colorName = 'Gray';
  }

  // Versuche, das Gewicht zu extrahieren
  const weightMatch = text.match(/(\d+)\s*(kg|g)/i);
  if (weightMatch) {
    const value = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();

    if (unit === 'kg') {
      weight = value;
    } else if (unit === 'g') {
      weight = value / 1000;
    }
  }

  // Standard-Drucktemperaturen für Bambu Lab Materialien
  let printTemp = '';
  switch (material) {
    case 'pla':
      printTemp = '210-230';
      break;
    case 'abs':
      printTemp = '240-270';
      break;
    case 'petg':
      printTemp = '230-260';
      break;
    case 'tpu':
      printTemp = '220-240';
      break;
    case 'pa':
      printTemp = '260-290';
      break;
    case 'asa':
      printTemp = '240-270';
      break;
    case 'pc':
      printTemp = '260-290';
      break;
    case 'pctg':
      printTemp = '250-270';
      break;
    case 'pva':
      printTemp = '210-230';
      break;
    default:
      printTemp = '200-230';
  }

  // Farbcode anhand des Farbnamens bestimmen
  let colorCode = '#FFFFFF';
  switch (colorName.toLowerCase()) {
    case 'black':
      colorCode = '#000000';
      break;
    case 'white':
      colorCode = '#FFFFFF';
      break;
    case 'red':
      colorCode = '#C12E1F';
      break;
    case 'blue':
      colorCode = '#0A2989';
      break;
    case 'green':
      colorCode = '#00AE42';
      break;
    case 'yellow':
      colorCode = '#FCE300';
      break;
    case 'orange':
      colorCode = '#FA6607';
      break;
    case 'gray':
      colorCode = '#545454';
      break;
  }

  const materialMap: Record<string, string> = {
    'pla': 'PLA',
    'pla-cf': 'PLA-CF',
    'abs': 'ABS',
    'abs-cf': 'ABS-CF',
    'petg': 'PETG',
    'petg-cf': 'PETG-CF',
    'tpu': 'TPU',
    'pa': 'PA',
    'pa-cf': 'PA-CF',
    'asa': 'ASA',
    'pc': 'PC',
    'pc-cf': 'PC-CF'
  };

  const materialLabel = materialMap[material] || material.toUpperCase();
  const cleanName = colorName ? `${materialLabel} ${colorName}`.trim() : materialLabel;

  return {
    name: cleanName,
    material: material,
    colorName: colorName,
    colorCode: colorCode,
    manufacturer: "Bambu Lab",
    diameter: 1.75, // Standard für Bambu Lab
    totalWeight: weight || 1, // Standardgewicht oder extrahiertes Gewicht
    printTemp: printTemp,
    barcode: qrCode,
  };
};

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // The scanner is started once, in an effect that runs only on mount, so the
  // success callback it registers would otherwise keep calling the first
  // render's handler with the first render's onScanSuccess. The ref always
  // points at the latest one.
  const handleScanSuccessRef = useRef<(decodedText: string) => void>(() => {});
  const qrScannerElementId = "qr-scanner";

  useEffect(() => {
    // Setup QR scanner
    const setupScanner = async () => {
      try {
        if (!document.getElementById(qrScannerElementId)) {
          console.error(`Element with ID '${qrScannerElementId}' not found`);
          return;
        }

        // Create HTML5 QR-Code instance. formatsToSupport (enabling barcode
        // formats in addition to QR codes) is a constructor option, not a
        // `.start()` option.
        scannerRef.current = new Html5Qrcode(qrScannerElementId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ]
        });

        setIsScanning(true);

        // Request camera access and start the QR scanner
        await scannerRef.current.start(
          { facingMode: "environment" }, // for back camera
          {
            fps: 10, // frames per second
            qrbox: { width: 250, height: 250 }, // size of scan area
            aspectRatio: 1, // aspect ratio
          },
          (decodedText) => {
            // Successfully scanned
            handleScanSuccessRef.current(decodedText);
          },
          (errorMessage) => {
            // Errors occur on every frame where no code is detected
            // So we should not log here unless for debugging purposes
          }
        );
      } catch (err) {
        console.error("Error initializing QR scanner:", err);
        setIsScanning(false);
      }
    };

    // Delay to give the DOM element time to be rendered
    const timer = setTimeout(() => {
      setupScanner();
    }, 500);

    // Cleanup on unmount. The isScanning state would be the mount-time value
    // here (always false), so ask the scanner itself.
    return () => {
      clearTimeout(timer);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("Error stopping QR scanner:", err);
        });
      }
    };
  }, []);

  // Handler for successful scan
  const handleScanSuccess = (decodedText: string) => {
    // Stop scanner after successful scan
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setScanResult(decodedText);
        const processedData = processScanResult(decodedText);
        if (processedData) {
          onScanSuccess(JSON.stringify(processedData));
        } else {
          onScanSuccess(decodedText);
        }
      }).catch(err => {
        console.error("Error stopping QR scanner:", err);
        setScanResult(decodedText);
        const processedData = processScanResult(decodedText);
        if (processedData) {
          onScanSuccess(JSON.stringify(processedData));
        } else {
          onScanSuccess(decodedText);
        }
      });
    } else {
      setScanResult(decodedText);
      const processedData = processScanResult(decodedText);
      if (processedData) {
        onScanSuccess(JSON.stringify(processedData));
      } else {
        onScanSuccess(decodedText);
      }
    }
  };
  handleScanSuccessRef.current = handleScanSuccess;
  // Stop scanner when closing the dialog
  const handleClose = () => {
    if (scannerRef.current && isScanning) {
      scannerRef.current.stop().then(() => {
        onClose();
      }).catch(err => {
        console.error("Error stopping QR scanner:", err);
        onClose();
      });
    } else {
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="justify-between flex-row items-center">
          <DialogTitle className="flex items-center">
            <Scan className="mr-2 h-5 w-5" />
            {t('common.scanQRCode')}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <DialogDescription>{t('common.scanner.positionCode')}</DialogDescription>

        <div className="flex flex-col items-center space-y-4">
          <div id={qrScannerElementId} className="w-full h-64 overflow-hidden rounded-lg border border-neutral-700"></div>

          <p className="text-sm text-neutral-400 text-center">
            {t('common.scanner.positionCode')}
            <br />
            {t('common.scanner.scanHappensAuto')}
          </p>

          {scanResult && (
            <div className="w-full p-3 bg-neutral-800 rounded-md text-sm">
              <p className="text-neutral-300 font-semibold mb-1">{t('common.scanner.scannedCode')}</p>
              <p className="text-neutral-400 break-all">{scanResult}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline" className="w-full">
            {t('common.scanner.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}