import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setAppearance } = useTheme();
  const isDark = theme.appearance === "dark";

  const toggleTheme = () => {
    setAppearance(isDark ? "light" : "dark");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={isDark ? 'bg-primary/20 hover:bg-primary/30 text-white border-white/20' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-200'}
      title={isDark ? t('settings.switchToLightModeTitle') : t('settings.switchToDarkModeTitle')}
      aria-label={isDark ? t('settings.switchToLightModeTitle') : t('settings.switchToDarkModeTitle')}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
