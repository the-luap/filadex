import { cn } from "@/lib/utils";

interface FilamentSpoolProps {
  color: string;
  percentage: number;
  className?: string;
  size?: number;
  showFillLevel?: boolean;
}

export function FilamentSpool({ 
  color, 
  percentage, 
  className,
  size = 80,
  showFillLevel = false
}: FilamentSpoolProps) {
  // Ensure percentage is a valid number between 0 and 100
  const validPercentage = Math.max(0, Math.min(100, percentage));
  
  // Calculate the clip path based on remaining percentage (from bottom)
  // 100% means full spool, 0% means empty spool
  // Nur anwenden, wenn showFillLevel=true ist
  const clipPath = showFillLevel 
    ? `inset(0 0 ${100 - validPercentage}% 0)` 
    : undefined;
  
  return (
    <div 
      className={cn(
        "relative rounded-full bg-neutral-200 flex items-center justify-center mx-auto", 
        className
      )}
      style={{ 
        width: `${size}px`, 
        height: `${size}px` 
      }}
    >
      <div
        className="absolute rounded-full z-0"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color || "#000000",
          clipPath: clipPath,
          border: color === "#FFFFFF" || color === "#ffffff" ? "1px solid #E0E0E0" : "none"
        }}
      />
      <div 
        className="absolute bg-neutral-100 rounded-full z-10"
        style={{ 
          width: `${size * 0.375}px`, 
          height: `${size * 0.375}px` 
        }}
      />
    </div>
  );
}
