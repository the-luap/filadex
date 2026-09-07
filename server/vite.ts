import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { resolveLanguage, setHtmlLang } from "./utils/resolve-language";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Indirect specifiers prevent esbuild from bundling Vite and its config into production builds.
  const vitePkg = "vite";
  const { createServer: createViteServer, createLogger } = await import(vitePkg);
  const configPath = "../vite.config";
  const { default: viteConfig } = await import(configPath);
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      let page = await vite.transformIndexHtml(url, template);
      page = setHtmlLang(page, await resolveLanguage(req));
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // index: false so the SPA entry always goes through the catch-all below,
  // which stamps the correct <html lang> before sending it.
  app.use(express.static(distPath, { index: false }));

  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res, next) => {
    try {
      res.status(200).set({ "Content-Type": "text/html" }).end(
        setHtmlLang(indexHtml, await resolveLanguage(req)),
      );
    } catch (e) {
      next(e);
    }
  });
}
