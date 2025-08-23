import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-simple";
import { seedDatabase } from "./seed-data";
import { setupVite, serveStatic, log } from "./vite";
import { notificationService } from "./notification-service";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // NOTE: Ensure 'routes' is imported or defined before this point if 'registerRoutes' uses it directly.
  // If 'routes' is not implicitly available, it needs to be imported.
  // For this example, assuming 'routes' is handled within 'registerRoutes' or imported elsewhere.
  const server = await registerRoutes(app);

  // Start birthday notification processing - runs daily at 9 AM
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      try {
        await notificationService.processBirthdayNotifications();
        console.log('Daily birthday notifications processed');
      } catch (error) {
        console.error('Error processing birthday notifications:', error);
      }
    }
  }, 60000); // Check every minute

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = process.env.NODE_ENV === "production" || app.get("env") === "production";
  console.log(`Environment check: NODE_ENV=${process.env.NODE_ENV}, app.env=${app.get("env")}, isProduction=${isProduction}`);
  
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    // Serve static files from client/dist directory with absolute path resolution
    const workspaceRoot = process.cwd();
    const clientDistPath = path.join(workspaceRoot, 'client/dist');
    
    console.log('Production mode - serving static files from:', clientDistPath);
    app.use(express.static(clientDistPath));

    // Catch all handler for client-side routing
    app.get('*', (req, res) => {
      const indexPath = path.join(clientDistPath, 'index.html');
      console.log('Serving index.html from:', indexPath);
      
      // Check if file exists before trying to serve
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath, (err) => {
          if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Error loading application');
          }
        });
      } else {
        console.error('index.html not found at:', indexPath);
        try {
          const files = fs.readdirSync(clientDistPath, { withFileTypes: true }).map(d => d.name);
          console.log('Available files in client/dist:', files);
        } catch (dirErr) {
          console.error('Cannot read client/dist directory:', dirErr);
        }
        res.status(404).send('Application files not found');
      }
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();