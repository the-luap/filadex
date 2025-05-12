import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scan, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

// Typen für Bambulab Filament Eigenschaften
interface BambuFilamentData {
  name?: string;
  material?: string;
  colorName?: string;
  colorCode?: string;
  manufacturer?: string;
  diameter?: number;
  totalWeight?: number;
  printTemp?: string;
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrScannerElementId = "qr-scanner";

  useEffect(() => {
    // Setup QR scanner
    const setupScanner = async () => {
      try {
        if (!document.getElementById(qrScannerElementId)) {
          console.error(`Element mit ID '${qrScannerElementId}' wurde nicht gefunden`);
          return;
        }

        // Erstellen der HTML5 QR-Code Instanz
        scannerRef.current = new Html5Qrcode(qrScannerElementId);
        
        setIsScanning(true);
        
        // Kamerazugriff anfordern und den QR-Scanner starten
        await scannerRef.current.start(
          { facingMode: "environment" }, // für Rückkamera
          {
            fps: 10, // Bilder pro Sekunde
            qrbox: { width: 250, height: 250 }, // Größe des Scan-Bereichs
            aspectRatio: 1, // Seitenverhältnis
            // Aktiviere Barcode-Formate zusätzlich zu QR-Codes
            formatsToSupport: [
              Html5Qrcode.FORMATS.QR_CODE,
              Html5Qrcode.FORMATS.CODE_128,
              Html5Qrcode.FORMATS.CODE_39,
              Html5Qrcode.FORMATS.EAN_13,
              Html5Qrcode.FORMATS.EAN_8,
              Html5Qrcode.FORMATS.UPC_A,
              Html5Qrcode.FORMATS.UPC_E
            ]
          },
          (decodedText) => {
            // Erfolgreich gescannt
            handleScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Fehler treten bei jedem Frame auf, bei dem kein Code erkannt wird
            // Daher sollten wir hier kein Logging machen, es sei denn, für Debugging-Zwecke
          }
        );
      } catch (err) {
        console.error("Fehler beim Initialisieren des QR-Scanners:", err);
        setIsScanning(false);
      }
    };
    
    // Verzögerung, damit das DOM-Element Zeit hat, gerendert zu werden
    const timer = setTimeout(() => {
      setupScanner();
    }, 500);
    
    // Aufräumen beim Unmount
    return () => {
      clearTimeout(timer);
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("Fehler beim Stoppen des QR-Scanners:", err);
        });
      }
    };
  }, []);
  
  // Handler für erfolgreichen Scan
  const handleScanSuccess = (decodedText: string) => {
    // Scanner stoppen nach erfolgreichem Scan
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
        console.error("Fehler beim Stoppen des QR-Scanners:", err);
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
  
  // Verarbeitet den gescannten Code und versucht, Bambulab Filamentdaten zu erkennen
  const processScanResult = (code: string): BambuFilamentData | null => {
    // Versuchen, als JSON zu parsen (falls es bereits ein strukturierter QR-Code ist)
    try {
      const jsonData = JSON.parse(code);
      if (jsonData.name || jsonData.material) {
        return jsonData;
      }
    } catch (e) {
      // Kein gültiges JSON, versuchen wir, andere Formate zu erkennen
    }
    
    // Bambulab 1D Barcode Format
    // Format: BBL-XYZ-123456
    // wo XYZ der Materialcode ist und die Ziffern Farbcodes etc. enthalten können
    if (code.startsWith('BBL-')) {
      return processBambuLabBarcode(code);
    }
    
    // Bambulab QR-Code Format für Filamente
    // Beispiel: [BBL]PLA Matte Black 1KG
    if (code.startsWith('[BBL]')) {
      return processBambuLabQRCode(code);
    }
    
    return null; // Kein bekanntes Format erkannt
  };
  
  // Verarbeitet einen Bambulab Barcode
  const processBambuLabBarcode = (barcode: string): BambuFilamentData => {
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
    }
    
    // CF oder HF Varianten
    if (materialCode.includes('CF')) {
      material += '-cf';
    } else if (materialCode.includes('HF')) {
      material += '-hf';
    }
    
    // Versuchen, Farbe zu erkennen (falls vorhanden)
    if (parts.length > 2) {
      const colorCode = parts[2];
      // Häufige Farben
      if (colorCode.includes('BK')) {
        colorName = 'Schwarz';
      } else if (colorCode.includes('WH')) {
        colorName = 'Weiß';
      } else if (colorCode.includes('GY')) {
        colorName = 'Grau';
      } else if (colorCode.includes('RD')) {
        colorName = 'Rot';
      } else if (colorCode.includes('BL')) {
        colorName = 'Blau';
      } else if (colorCode.includes('GN')) {
        colorName = 'Grün';
      } else if (colorCode.includes('YL')) {
        colorName = 'Gelb';
      } else if (colorCode.includes('NT')) {
        colorName = 'Natur';
      } else {
        colorName = colorCode; // Falls nicht erkannt, den Code als Farbnamen verwenden
      }
    }
    
    // Standard-Drucktemperaturen für Bambu Lab Materialien
    let printTemp = '';
    if (material.startsWith('pla')) {
      printTemp = '200-220';
    } else if (material.startsWith('abs')) {
      printTemp = '240-260';
    } else if (material.startsWith('petg')) {
      printTemp = '230-250';
    } else if (material.startsWith('tpu')) {
      printTemp = '220-230';
    } else if (material.startsWith('pa')) {
      printTemp = '260-280';
    } else if (material.startsWith('asa')) {
      printTemp = '240-260';
    } else if (material.startsWith('pctg')) {
      printTemp = '240-260';
    }
    
    // Generiere einen materialbezogenen HEX-Farbcode basierend auf typischen Materialfarben
    let colorCode = '#000000'; // Standard ist Schwarz
    if (colorName === 'Weiß') colorCode = '#FFFFFF';
    if (colorName === 'Rot') colorCode = '#FF0000';
    if (colorName === 'Blau') colorCode = '#0000FF';
    if (colorName === 'Grün') colorCode = '#00FF00';
    if (colorName === 'Gelb') colorCode = '#FFFF00';
    if (colorName === 'Grau') colorCode = '#808080';
    if (colorName === 'Natur') colorCode = '#F5F5DC';
    
    // Bestimme Materialname auf Deutsch für die Anzeige
    const materialMap: Record<string, string> = {
      'pla': 'PLA',
      'pla-cf': 'PLA-CF',
      'pla-hf': 'PLA-HF',
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
      name: `${nameWithColor} Bambu Lab`,
      material: material,
      colorName: colorName || undefined,
      colorCode: colorCode,
      manufacturer: "Bambu Lab",
      diameter: 1.75, // Standard für Bambu Lab
      totalWeight: 1, // Standard-Gewicht (1kg) für Bambu Lab Spulen
      printTemp: printTemp
    };
  };
  
  // Verarbeitet einen Bambulab QR-Code
  const processBambuLabQRCode = (qrCode: string): BambuFilamentData => {
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
    }
    
    // CF oder HF Varianten erkennen
    if (text.includes('CF')) {
      material += '-cf';
    } else if (text.includes('HF')) {
      material += '-hf';
    }
    
    // Gewicht extrahieren
    if (text.includes('1KG')) {
      weight = 1;
    } else if (text.includes('500G')) {
      weight = 0.5;
    } else if (text.includes('250G')) {
      weight = 0.25;
    }
    
    // Versuche, die Farbe zu extrahieren - extrahiere alles zwischen Material und Gewicht
    const materialRegex = /^(PLA|ABS|PETG|TPU|PA|ASA)(-CF|-HF)?\s+/;
    const weightRegex = /\s+(1KG|500G|250G)$/;
    
    const materialMatch = text.match(materialRegex);
    const weightMatch = text.match(weightRegex);
    
    if (materialMatch && weightMatch) {
      colorName = text.substring(
        materialMatch[0].length, 
        text.length - weightMatch[0].length
      ).trim();
    } else if (materialMatch) {
      colorName = text.substring(materialMatch[0].length).trim();
    }
    
    // Standard-Drucktemperaturen für Bambu Lab Materialien
    let printTemp = '';
    if (material.startsWith('pla')) {
      printTemp = '200-220';
    } else if (material.startsWith('abs')) {
      printTemp = '240-260';
    } else if (material.startsWith('petg')) {
      printTemp = '230-250';
    } else if (material.startsWith('tpu')) {
      printTemp = '220-230';
    } else if (material.startsWith('pa')) {
      printTemp = '260-280';
    } else if (material.startsWith('asa')) {
      printTemp = '240-260';
    }
    
    // Bestimme einen passenden HEX-Farbcode basierend auf der Farbbeschreibung
    let colorCode = '#000000'; // Standard ist Schwarz
    
    if (colorName) {
      const lowerColorName = colorName.toLowerCase();
      if (lowerColorName.includes('black') || lowerColorName.includes('schwarz')) 
        colorCode = '#000000';
      else if (lowerColorName.includes('white') || lowerColorName.includes('weiß')) 
        colorCode = '#FFFFFF';
      else if (lowerColorName.includes('red') || lowerColorName.includes('rot')) 
        colorCode = '#FF0000';
      else if (lowerColorName.includes('blue') || lowerColorName.includes('blau')) 
        colorCode = '#0000FF';
      else if (lowerColorName.includes('green') || lowerColorName.includes('grün')) 
        colorCode = '#00FF00';
      else if (lowerColorName.includes('yellow') || lowerColorName.includes('gelb')) 
        colorCode = '#FFFF00';
      else if (lowerColorName.includes('gray') || lowerColorName.includes('grey') || lowerColorName.includes('grau')) 
        colorCode = '#808080';
      else if (lowerColorName.includes('natur') || lowerColorName.includes('natural')) 
        colorCode = '#F5F5DC';
      else if (lowerColorName.includes('orange'))
        colorCode = '#FFA500';
      else if (lowerColorName.includes('purple') || lowerColorName.includes('violet') || lowerColorName.includes('lila'))
        colorCode = '#800080';
      else if (lowerColorName.includes('pink'))
        colorCode = '#FFC0CB';
      else if (lowerColorName.includes('brown') || lowerColorName.includes('braun'))
        colorCode = '#A52A2A';
    }
    
    // Falls keine Farbe extrahiert werden konnte, setze einen generischen Namen
    if (!colorName) {
      colorName = 'Standard';
    }
    
    // Übersetze Farbnamen ins Deutsche, wenn sie auf Englisch sind
    const colorTranslations: Record<string, string> = {
      'Black': 'Schwarz',
      'White': 'Weiß',
      'Red': 'Rot',
      'Blue': 'Blau',
      'Green': 'Grün',
      'Yellow': 'Gelb',
      'Gray': 'Grau',
      'Grey': 'Grau',
      'Orange': 'Orange',
      'Purple': 'Lila',
      'Pink': 'Rosa',
      'Brown': 'Braun',
      'Matte Black': 'Matt Schwarz',
      'Matte White': 'Matt Weiß',
      'Transparent': 'Transparent'
    };
    
    // Prüfe, ob der Farbname übersetzt werden muss
    for (const [eng, de] of Object.entries(colorTranslations)) {
      if (colorName.includes(eng)) {
        colorName = colorName.replace(eng, de);
        break;
      }
    }
    
    // Bestimme Materialname auf Deutsch für die Anzeige
    const materialMap: Record<string, string> = {
      'pla': 'PLA',
      'pla-cf': 'PLA-CF',
      'pla-hf': 'PLA-HF',
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
    
    return {
      name: `${materialLabel} ${colorName} Bambu Lab`,
      material: material,
      colorName: colorName,
      colorCode: colorCode,
      manufacturer: "Bambu Lab",
      diameter: 1.75, // Standard für Bambu Lab
      totalWeight: weight || 1, // Standardgewicht oder extrahiertes Gewicht
      printTemp: printTemp
    };
  };
  
  // Scanner beim Schließen des Dialogs stoppen
  const handleClose = () => {
    if (scannerRef.current && isScanning) {
      scannerRef.current.stop().then(() => {
        onClose();
      }).catch(err => {
        console.error("Fehler beim Stoppen des QR-Scanners:", err);
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
            Barcode/QR-Code scannen
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          <div id={qrScannerElementId} className="w-full h-64 overflow-hidden rounded-lg border border-neutral-700"></div>
          
          <p className="text-sm text-neutral-400 text-center">
            Positionieren Sie den Barcode oder QR-Code in der Mitte des Scanfensters.
            <br />
            Der Scan erfolgt automatisch.
          </p>
          
          {scanResult && (
            <div className="w-full p-3 bg-neutral-800 rounded-md text-sm">
              <p className="text-neutral-300 font-semibold mb-1">Gescannter Code:</p>
              <p className="text-neutral-400 break-all">{scanResult}</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={handleClose} variant="outline" className="w-full">
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}