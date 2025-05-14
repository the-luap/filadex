import { useTranslation } from "@/i18n";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="theme-primary-bg text-white py-4 mt-auto shadow-md">
      <div className="container mx-auto px-4 text-center text-sm">
        <p className="font-medium">{t('common.footer.appDescription')}</p>
        <p className="text-white/70 text-xs mt-1">
          {t('common.footer.copyright', { year })}
        </p>
      </div>
    </footer>
  );
}
