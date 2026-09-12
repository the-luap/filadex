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
  // Format: BBL-XYZ-123456 or BBL-PLA-BK-123456
  const parts = barcode.split('-');

  if (parts.length < 2) {
    return {
      manufacturer: "Bambu Lab",
      name: barcode
    };
  }

  const materialCode = parts[1].toUpperCase();
  let material: string;

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
  } else {
    material = materialCode.toLowerCase();
  }

  // CF oder HF Varianten erkennen
  if (materialCode.includes('CF')) {
    material += '-cf';
  } else if (materialCode.includes('HF')) {
    material += '-hf';
  }

  // Farb-Codes erkennen
  let colorName = '';
  let colorCode = '#000000'; // Standard Schwarz

  const colorToken = parts.length > 2 ? parts.slice(2).join('-').toUpperCase() : '';
  const matSuffix = materialCode.replace(/^(PLA|ABS|PETG?|TPU|PA|ASA|PCTG|PVA|PC|HIPS)(-CF|-HF)?/i, '');

  const matchColorCode = (token: string) => {
    if (token.includes('BK') || token.startsWith('01')) return { name: 'Black', code: '#000000' };
    if (token.includes('WH') || token.startsWith('02')) return { name: 'White', code: '#FFFFFF' };
    if (token.includes('RD') || token.startsWith('03')) return { name: 'Red', code: '#C12E1F' };
    if (token.includes('BL') || token.startsWith('04')) return { name: 'Blue', code: '#0A2989' };
    if (token.includes('GN') || token.startsWith('05')) return { name: 'Green', code: '#00AE42' };
    if (token.includes('YL') || token.startsWith('06')) return { name: 'Yellow', code: '#FCE300' };
    if (token.includes('GY') || token.startsWith('07')) return { name: 'Gray', code: '#545454' };
    if (token.includes('OR') || token.startsWith('08')) return { name: 'Orange', code: '#FA6607' };
    return null;
  };

  const match = (colorToken && matchColorCode(colorToken)) || (matSuffix && matchColorCode(matSuffix));
  if (match) {
    colorName = match.name;
    colorCode = match.code;
  } else if (colorToken && !/^\d{5,}$/.test(colorToken)) {
    colorName = parts[2];
  }

  // Standard-Drucktemperaturen für Bambu Lab Materialien
  let printTemp: string;
  switch (material) {
    case 'pla':
    case 'pla-cf':
    case 'pla-hf':
      printTemp = '210-230';
      break;
    case 'abs':
    case 'abs-cf':
      printTemp = '240-270';
      break;
    case 'petg':
    case 'petg-cf':
    case 'petg-hf':
      printTemp = '230-260';
      break;
    case 'tpu':
      printTemp = '220-240';
      break;
    case 'pa':
    case 'pa-cf':
      printTemp = '260-290';
      break;
    case 'asa':
      printTemp = '240-270';
      break;
    case 'pc':
    case 'pc-cf':
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
    'pla-hf': 'PLA-HF',
    'abs': 'ABS',
    'abs-cf': 'ABS-CF',
    'petg': 'PETG',
    'petg-cf': 'PETG-CF',
    'petg-hf': 'PETG-HF',
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
  const nameWithColor = colorName ? `${materialLabel} ${colorName}`.trim() : materialLabel;

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
  // Format: [BBL]PLA Matte Black 1KG or [BBL]PLA-CF Lava Orange 1KG
  const text = qrCode.replace('[BBL]', '').trim();

  let material = '';
  let colorName = '';
  let weight: number | undefined;

  // Versuche, das Material zu erkennen
  const upper = text.toUpperCase();
  if (upper.startsWith('PLA')) {
    material = 'pla';
  } else if (upper.startsWith('ABS')) {
    material = 'abs';
  } else if (upper.startsWith('PETG')) {
    material = 'petg';
  } else if (upper.startsWith('TPU')) {
    material = 'tpu';
  } else if (upper.startsWith('ASA')) {
    material = 'asa';
  } else if (upper.startsWith('PA')) {
    material = 'pa';
  } else if (upper.startsWith('PC')) {
    material = 'pc';
  } else if (upper.startsWith('PCTG')) {
    material = 'pctg';
  } else if (upper.startsWith('PVA')) {
    material = 'pva';
  } else if (upper.startsWith('HIPS')) {
    material = 'hips';
  }

  // CF oder HF Varianten erkennen
  const firstWord = text.split(/\s+/)[0] || '';
  if (firstWord.toUpperCase().includes('CF')) {
    material += '-cf';
  } else if (firstWord.toUpperCase().includes('HF')) {
    material += '-hf';
  }

  // Gewicht extrahieren
  const weightRegex = /\s+(\d+(?:\.\d+)?)\s*(kg|g)$/i;
  const weightMatch = text.match(weightRegex);
  if (weightMatch) {
    const value = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    weight = unit === 'g' ? value / 1000 : value;
  } else if (text.includes('1KG')) {
    weight = 1;
  } else if (text.includes('500G')) {
    weight = 0.5;
  } else if (text.includes('250G')) {
    weight = 0.25;
  }

  // Versuche, die Farbe zu extrahieren - extrahiere alles zwischen Material und Gewicht
  const materialRegex = /^(PLA|ABS|PETG|TPU|PA|ASA|PC|PCTG|PVA|HIPS)(-CF|-HF)?\s+/i;
  const materialMatch = text.match(materialRegex);

  if (materialMatch && weightMatch) {
    colorName = text.substring(
      materialMatch[0].length,
      text.length - weightMatch[0].length
    ).trim();
  } else if (materialMatch) {
    colorName = text.substring(materialMatch[0].length).trim();
  }

  // Bestimme einen passenden HEX-Farbcode basierend auf der Farbbeschreibung
  let colorCode = '#FFFFFF';

  if (colorName) {
    const lowerColorName = colorName.toLowerCase();
    if (lowerColorName.includes('black') || lowerColorName.includes('schwarz') || lowerColorName.includes('charcoal'))
      colorCode = '#000000';
    else if (lowerColorName.includes('white') || lowerColorName.includes('weiß'))
      colorCode = '#FFFFFF';
    else if (lowerColorName.includes('red') || lowerColorName.includes('rot'))
      colorCode = '#C12E1F';
    else if (lowerColorName.includes('blue') || lowerColorName.includes('blau') || lowerColorName.includes('cyan') || lowerColorName.includes('teal'))
      colorCode = '#0A2989';
    else if (lowerColorName.includes('green') || lowerColorName.includes('grün'))
      colorCode = '#00AE42';
    else if (lowerColorName.includes('yellow') || lowerColorName.includes('gelb'))
      colorCode = '#FCE300';
    else if (lowerColorName.includes('gray') || lowerColorName.includes('grey') || lowerColorName.includes('grau'))
      colorCode = '#545454';
    else if (lowerColorName.includes('orange'))
      colorCode = '#FA6607';
    else if (lowerColorName.includes('purple') || lowerColorName.includes('violet') || lowerColorName.includes('lila'))
      colorCode = '#800080';
    else if (lowerColorName.includes('pink'))
      colorCode = '#FFC0CB';
    else if (lowerColorName.includes('brown') || lowerColorName.includes('braun'))
      colorCode = '#A52A2A';
  }

  // Standard-Drucktemperaturen für Bambu Lab Materialien
  let printTemp: string;
  switch (material) {
    case 'pla':
    case 'pla-cf':
    case 'pla-hf':
      printTemp = '210-230';
      break;
    case 'abs':
    case 'abs-cf':
      printTemp = '240-270';
      break;
    case 'petg':
    case 'petg-cf':
    case 'petg-hf':
      printTemp = '230-260';
      break;
    case 'tpu':
      printTemp = '220-240';
      break;
    case 'pa':
    case 'pa-cf':
      printTemp = '260-290';
      break;
    case 'asa':
      printTemp = '240-270';
      break;
    case 'pc':
    case 'pc-cf':
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
    'pla-hf': 'PLA-HF',
    'abs': 'ABS',
    'abs-cf': 'ABS-CF',
    'petg': 'PETG',
    'petg-cf': 'PETG-CF',
    'petg-hf': 'PETG-HF',
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
    colorName: colorName || undefined,
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