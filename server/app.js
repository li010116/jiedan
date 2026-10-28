import express from "express";
import { attachBusinessRoutes } from "./business.js";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, projectFromRow, inquiryFromRow } from "./db.js";
import {
  getSessionUser,
  verifyPassword,
  startSession,
  readSessionToken,
  tokenHash,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "./auth.js";
import {
  inquirySchema,
  loginSchema,
  inquiryUpdateSchema,
  projectSchema,
  settingsSchema,
  STATUSES,
  parseBody,
} from "./validation.js";

const dummyPasswordHash = `scrypt:00000000000000000000000000000000:${"0".repeat(128)}`;

export function createApp(options = {}) {
  const app = express();
  const db = openDatabase(options.databasePath);
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const publicOrigins =
    options.publicOrigins ??
    (process.env.PUBLIC_ORIGIN
      ? process.env.PUBLIC_ORIGIN.split(",").map((v) => v.trim())
      : production
        ? ["http://localhost:3001"]
        : [
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
          ]);
  const allowedOrigins = new Set(
    publicOrigins.map((value) => {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("PUBLIC_ORIGIN 须使用 HTTP 或 HTTPS。");
      return url.origin;
    }),
  );
  const cookieSecure =
    options.cookieSecure ??
    [...allowedOrigins].some((origin) => origin.startsWith("https:"));
  app.locals.db = db;
  app.locals.closeDatabase = () => db.close();
  app.disable("x-powered-by");
  if (options.trustProxy !== undefined)
    app.set("trust proxy", options.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
              ],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "https:", "data:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: cookieSecure ? [] : null,
            },
          }
        : false,
      strictTransportSecurity: cookieSecure ? undefined : false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (origin) {
      if (!allowedOrigins.has(origin))
        return res.status(403).json({ error: "请求来源不被允许。" });
    } else if (req.get("sec-fetch-site") || req.headers.cookie) {
      // Non-browser clients without cookies may submit public forms or log in.
      // All cookie-authenticated mutations and all browser mutations require Origin.
      return res
        .status(403)
        .json({ error: "缺少有效的请求来源，请刷新页面后重试。" });
    }
    if (req.get("sec-fetch-site") === "cross-site")
      return res.status(403).json({ error: "不允许跨站提交。" });
    next();
  });
  app.use(express.json({ limit: "32kb", strict: true }));

  const formLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => Boolean(options.testMode),
    message: { error: "提交过于频繁，请稍后再试。" },
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => Boolean(options.testMode),
    message: { error: "登录尝试过多，请 15 分钟后重试。" },
  });
  const requireAuth = (req, res, next) => {
    req.user = getSessionUser(db, req);
    if (!req.user) return res.status(401).json({ error: "请先登录管理后台。" });
    next();
  };

  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });
  app.get("/api/site", (_req, res) => {
    res.json({
      settings: JSON.parse(
        db.prepare("SELECT data FROM settings WHERE id=1").get().data,
      ),
      projects: db
        .prepare(
          "SELECT * FROM projects WHERE published=1 ORDER BY sort_order,id",
        )
        .all()
        .map(projectFromRow),
    });
  });
  app.post("/api/inquiries", formLimit, (req, res) => {
    const data = parseBody(inquirySchema, req.body, res);
    if (!data) return;
    if (data.website.trim())
      return res.status(400).json({ error: "提交未通过验证，请重试。" });
    const { service, name, contact, budget, description, idempotencyKey } =
      data;
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ service, name, contact, budget, description }))
      .digest("hex");
    const previous = db
      .prepare(
        "SELECT id,reference,created_at,payload_hash FROM inquiries WHERE idempotency_key=?",
      )
      .get(idempotencyKey);
    if (previous) {
      if (previous.payload_hash !== payloadHash)
        return res
          .status(409)
          .json({ error: "此需求已提交，请刷新后创建新的需求。" });
      return res
        .status(200)
        .json({
          inquiry: {
            id: previous.id,
            reference: previous.reference,
            createdAt: previous.created_at,
          },
        });
    }
    const id = randomUUID();
    const date = new Date().toISOString();
    const reference = `MG-${date.slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
    db.prepare(
      "INSERT INTO inquiries (id,reference,service,name,contact,budget,description,idempotency_key,payload_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      reference,
      service,
      name,
      contact,
      budget,
      description,
      idempotencyKey,
      payloadHash,
      date,
      date,
    );
    res.status(201).json({ inquiry: { id, reference, createdAt: date } });
  });

  app.get("/api/auth/session", (req, res) => {
    res.json({ user: getSessionUser(db, req) });
  });
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const data = parseBody(loginSchema, req.body, res);
    if (!data) return;
    const admin = db
      .prepare("SELECT id,email,password_hash FROM admins WHERE email=?")
      .get(data.email);
    const valid = await verifyPassword(
      data.password,
      admin?.password_hash || dummyPasswordHash,
    );
    if (!admin || !valid)
      return res.status(401).json({ error: "邮箱或密码不正确。" });
    startSession(db, req, res, admin.id, cookieSecure);
    res.json({ user: { id: admin.id, email: admin.email } });
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = readSessionToken(req);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        tokenHash(token),
      );
    const { maxAge, ...cookieOptions } = sessionCookieOptions(cookieSecure);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.json({ ok: true });
  });

  app.use("/api/admin", requireAuth);
  attachBusinessRoutes(app, db);
  app.get("/api/admin/inquiries", (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status = req.query.status || "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (status && !STATUSES.includes(status)) ||
      q.length > 100
    )
      return res.status(400).json({ error: "筛选条件不正确。" });
    const where = [];
    const values = [];
    if (status) {
      where.push("status=?");
      values.push(status);
    }
    if (q) {
      where.push(
        "(name LIKE ? OR contact LIKE ? OR reference LIKE ? OR description LIKE ?)",
      );
      values.push(...Array(4).fill(`%${q}%`));
    }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM inquiries${clause}`)
      .get(...values).count;
    const items = db
      .prepare(
        `SELECT * FROM inquiries${clause} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, (page - 1) * limit)
      .map(inquiryFromRow);
    const stats = { new: 0, contacted: 0, in_progress: 0, closed: 0, total: 0 };
    db.prepare("SELECT status,COUNT(*) AS count FROM inquiries GROUP BY status")
      .all()
      .forEach((row) => {
        stats[row.status] = row.count;
        stats.total += row.count;
      });
    res.json({ items, total, page, pageSize: limit, stats });
  });
  app.patch("/api/admin/inquiries/:id", (req, res) => {
    const data = parseBody(inquiryUpdateSchema, req.body, res);
    if (!data) return;
    const previous = db
      .prepare("SELECT * FROM inquiries WHERE id=?")
      .get(req.params.id);
    if (!previous) return res.status(404).json({ error: "没有找到这条需求。" });
    db.prepare(
      "UPDATE inquiries SET status=?,notes=?,updated_at=? WHERE id=?",
    ).run(
      data.status ?? previous.status,
      data.notes ?? previous.notes,
      new Date().toISOString(),
      req.params.id,
    );
    res.json({
      inquiry: inquiryFromRow(
        db.prepare("SELECT * FROM inquiries WHERE id=?").get(req.params.id),
      ),
    });
  });

  app.get("/api/admin/projects", (_req, res) => {
    res.json({
      projects: db
        .prepare("SELECT * FROM projects ORDER BY sort_order,id")
        .all()
        .map(projectFromRow),
    });
  });
  const projectValues = (p) => [
    p.title,
    p.category,
    p.image,
    p.description,
    p.service,
    JSON.stringify(p.stack),
    JSON.stringify(p.details),
    p.tone,
    Number(p.isDemo),
    p.sortOrder,
    Number(p.published),
    p.previewUrl,
  ];
  app.post("/api/admin/projects", (req, res) => {
    const data = parseBody(projectSchema, req.body, res);
    if (!data) return;
    const result = db
      .prepare(
        "INSERT INTO projects (title,category,image,description,service,stack,details,tone,is_demo,sort_order,published,preview_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(...projectValues(data));
    res
      .status(201)
      .json({
        project: projectFromRow(
          db
            .prepare("SELECT * FROM projects WHERE id=?")
            .get(result.lastInsertRowid),
        ),
      });
  });
  app.put("/api/admin/projects/:id", (req, res) => {
    const data = parseBody(projectSchema, req.body, res);
    if (!data) return;
    const result = db
      .prepare(
        "UPDATE projects SET title=?,category=?,image=?,description=?,service=?,stack=?,details=?,tone=?,is_demo=?,sort_order=?,published=?,preview_url=? WHERE id=?",
      )
      .run(...projectValues(data), req.params.id);
    if (!result.changes)
      return res.status(404).json({ error: "没有找到这个作品。" });
    res.json({
      project: projectFromRow(
        db.prepare("SELECT * FROM projects WHERE id=?").get(req.params.id),
      ),
    });
  });
  app.delete("/api/admin/projects/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM projects WHERE id=?")
      .run(req.params.id);
    if (!result.changes)
      return res.status(404).json({ error: "没有找到这个作品。" });
    res.json({ ok: true });
  });
  app.put("/api/admin/settings", (req, res) => {
    const data = parseBody(settingsSchema, req.body, res);
    if (!data) return;
    db.prepare("UPDATE settings SET data=? WHERE id=1").run(
      JSON.stringify(data),
    );
    res.json({ settings: data });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "接口不存在。" });
  });
  if (production) {
    const dist = resolve(options.staticDirectory || "dist");
    if (existsSync(resolve(dist, "index.html"))) {
      app.use(express.static(dist, { index: false }));
      app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
        if (req.path.startsWith("/assets/"))
          return res.status(404).send("Not found");
        res.sendFile(resolve(dist, "index.html"));
      });
    }
  }
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "提交内容过大，请缩短内容。" });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "请求内容不是有效的 JSON。" });
    console.error(`API request failed: ${error.name || "Error"}`);
    res.status(500).json({ error: "服务器暂时无法处理请求，请稍后重试。" });
  });
  return app;
}
