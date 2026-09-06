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
        <DropdownMenuItem 
          onClick={() => setLanguage('en')}
          className={cn(
            "min-h-[44px] sm:min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer",
            language === 'en' && 'bg-accent font-medium'
          )}
        >
          <span>English</span>
          {language === 'en' && <Check className="h-4 w-4 ml-2 shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('de')}
          className={cn(
            "min-h-[44px] sm:min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer",
            language === 'de' && 'bg-accent font-medium'
          )}
        >
          <span>Deutsch</span>
          {language === 'de' && <Check className="h-4 w-4 ml-2 shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('pl')}
          className={cn(
            "min-h-[44px] sm:min-h-0 py-2.5 px-3 flex items-center justify-between cursor-pointer",
            language === 'pl' && 'bg-accent font-medium'
          )}
        >
          <span>Polski</span>
          {language === 'pl' && <Check className="h-4 w-4 ml-2 shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
