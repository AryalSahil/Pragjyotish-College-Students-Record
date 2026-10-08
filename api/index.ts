import app from "../server.ts";

// Export the Express application directly as the default export.
// Vercel serverless runtime automatically recognizes Express apps via app.handle
// and properly manages the async request/response lifecycle.
export default app;
