import app from "../server.ts";

export default function handler(req: any, res: any) {
  // Normalize req.url so Express routes match correctly regardless of Vercel rewrite structure
  if (req.url) {
    if (req.url.startsWith("/api/index")) {
      req.url = req.url.replace(/^\/api\/index/, "/api");
    } else if (req.originalUrl && req.originalUrl.startsWith("/api") && !req.url.startsWith("/api")) {
      req.url = req.originalUrl;
    } else if (!req.url.startsWith("/api")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
  }
  return app(req, res);
}
