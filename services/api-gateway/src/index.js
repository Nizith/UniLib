const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { createProxyMiddleware } = require("http-proxy-middleware");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const isWildcardCors = corsOrigin === "*";

const services = {
  user: process.env.USER_SERVICE_URL || "http://localhost:3001",
  book: process.env.BOOK_SERVICE_URL || "http://localhost:3002",
  loan: process.env.LOAN_SERVICE_URL || "http://localhost:3003",
  notification: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004",
};

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: isWildcardCors ? true : corsOrigin,
    credentials: !isWildcardCors,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(morgan("combined"));
// Do not use express.json() on proxied routes — it consumes the request body stream
// so the upstream never receives the JSON body (causes hangs/aborts and 504 via nginx).

const proxyError = (serviceName) => (err, req, res) => {
  const status = err.code === "ECONNREFUSED" ? 503 : 502;

  // WebSocket upgrades do not provide an Express response object.
  if (!res || typeof res.status !== "function") {
    console.error(`Proxy error for ${serviceName}:`, err.message);
    return;
  }

  if (res.headersSent) return;
  res.status(status).json({
    error: status === 503 ? "Service unavailable" : "Bad gateway",
    service: serviceName,
    message: err.message,
  });
};

const makeProxy = (target, serviceName, options = {}) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    ...options,
    onError: proxyError(serviceName),
  });

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway" });
});

app.get("/health/services", async (req, res) => {
  const entries = Object.entries({
    "user-service": services.user,
    "book-catalog-service": services.book,
    "loan-service": services.loan,
    "notification-service": services.notification,
  });

  const results = await Promise.all(
    entries.map(async ([name, base]) => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        const r = await fetch(`${base}/health`, { signal: controller.signal });
        clearTimeout(t);
        const body = await r.json().catch(() => ({}));
        return { name, ok: r.ok, status: r.status, body };
      } catch (e) {
        return { name, ok: false, error: e.message };
      }
    })
  );

  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    services: results,
  });
});

app.use("/api/users", makeProxy(services.user, "user-service"));
app.use("/api/books", makeProxy(services.book, "book-catalog-service"));
app.use("/api/loans", makeProxy(services.loan, "loan-service"));
app.use("/api/notifications", makeProxy(services.notification, "notification-service"));

const socketIoProxy = createProxyMiddleware({
  target: services.notification,
  changeOrigin: true,
  ws: true,
  onError: proxyError("notification-service"),
});

app.use("/socket.io", socketIoProxy);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log("Routes: /api/users, /api/books, /api/loans, /api/notifications, /socket.io");
});
