import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Languages, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Language } from "@shared/languages";

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pl', label: 'Polski' },
];

export interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageSelector({ className, showLabel = false }: LanguageSelectorProps = {}) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "default" : "icon"}
          className={cn(
            "rounded-full transition-colors",
            showLabel
              ? "h-10 min-h-[44px] min-w-[44px] px-3 gap-1.5 flex items-center justify-center font-medium"
              : "h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0",
            className
          )}
        >
          <Languages className="h-4 w-4 shrink-0" />
          {showLabel && (
            <span className="text-xs font-bold uppercase tracking-wider">
              {language.toUpperCase()}
            </span>
          )}
          <span className="sr-only">{t('settings.language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGUAGE_OPTIONS.map(({ code, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLanguage(code)}
            className={cn(
              "min-h-[44px] sm:min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer",
              language === code && 'bg-accent font-medium'
            )}
          >
            <span>{label}</span>
            {language === code && <Check className="h-4 w-4 ml-2 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuthLanguageSelector() {
  return (
    <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
      <LanguageSelector
        showLabel
        className="text-white hover:bg-white/20 hover:text-white active:bg-white/30 focus-visible:ring-2 focus-visible:ring-white/50"
      />
    </div>
  );
}
