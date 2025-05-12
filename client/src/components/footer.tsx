export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="theme-primary-bg text-white py-4 mt-auto shadow-md">
      <div className="container mx-auto px-4 text-center text-sm">
        <p className="font-medium">Filadex - 3D Druck Filament Verwaltung</p>
        <p className="text-white/70 text-xs mt-1">
          © {year} Copyright by Paul Nothaft
        </p>
      </div>
    </footer>
  );
}
