export function isSqlite(url?: string): boolean {
  if (process.env.TEST_DIALECT === "sqlite") {
    return true;
  }
  const targetUrl = url ?? process.env.TEST_DATABASE_URL;
  return targetUrl ? targetUrl.startsWith("file:") || targetUrl.startsWith("sqlite:") : false;
}

