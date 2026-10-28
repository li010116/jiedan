import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { migrateBusiness } from "./business.js";

export const defaultSettings = {
  studioName: "MOGUSTACK",
  tagline: "独立开发 · 认真创造",
  email: "",
  wechat: "",
  about:
    "MOGUSTACK 是一家独立软件开发工作室。用清晰的沟通和扎实的代码，将你的想法变成真实、好用、可持续的产品。",
};

const initialProjects = [
  {
    title: "SaaS 数据管理平台",
    category: "WEB APPLICATION",
    image: "/assets/work-dashboard.png",
    description: "让复杂的数据，变成清晰的业务洞察。",
    service: "网站开发",
    stack: ["React", "数据可视化", "响应式设计"],
    details: [
      "将核心指标与趋势集中呈现",
      "清晰的侧边导航与多层数据视图",
      "适配桌面与平板的工作界面",
    ],
    tone: "lilac",
  },
  {
    title: "生活方式电商小程序",
    category: "MINI PROGRAM",
    image: "/assets/work-commerce.png",
    description: "从发现好物到轻松下单，一气呵成。",
    service: "小程序 / App",
    stack: ["小程序", "商品管理", "移动体验"],
    details: [
      "简洁的商品发现与分类体验",
      "注重细节的产品展示页面",
      "围绕移动端使用习惯设计",
    ],
    tone: "peach",
  },
  {
    title: "AI 智能工作助手",
    category: "AI APPLICATION",
    image: "/assets/work-ai.png",
    description: "一个对话入口，连接知识与灵感。",
    service: "AI 应用",
    stack: ["大模型应用", "知识库", "对话界面"],
    details: [
      "自然、直观的对话式交互",
      "整理历史会话与常用任务",
      "为知识检索与内容创作设计",
    ],
    tone: "mint",
  },
];

export function openDatabase(
  databasePath = process.env.DATABASE_PATH || "data/mogustack.sqlite",
) {
  const path =
    databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 3) {
    db.close();
    throw new Error("数据库版本高于当前程序支持版本，请先升级程序。");
  }
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE admins (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE INDEX sessions_expiry ON sessions(expires_at);
      CREATE TABLE inquiries (
        id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, service TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL,
        budget TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','in_progress','closed')),
        notes TEXT NOT NULL DEFAULT '', idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX inquiries_created ON inquiries(created_at DESC);
      CREATE INDEX inquiries_status ON inquiries(status);
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL,
        description TEXT NOT NULL, service TEXT NOT NULL, stack TEXT NOT NULL, details TEXT NOT NULL, tone TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
    try {
      db.prepare("INSERT INTO settings (id,data) VALUES (1,?)").run(
        JSON.stringify(defaultSettings),
      );
      const statement = db.prepare(
        `INSERT INTO projects (title,category,image,description,service,stack,details,tone,is_demo,sort_order,published) VALUES (?,?,?,?,?,?,?,?,1,?,1)`,
      );
      initialProjects.forEach((p, i) =>
        statement.run(
          p.title,
          p.category,
          p.image,
          p.description,
          p.service,
          JSON.stringify(p.stack),
          JSON.stringify(p.details),
          p.tone,
          i,
        ),
      );
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      db.close();
      throw error;
    }
  }
  migrateBusiness(db);
  if (db.prepare("PRAGMA user_version").get().user_version < 3) {
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec("ALTER TABLE projects ADD COLUMN preview_url TEXT NOT NULL DEFAULT ''; PRAGMA user_version = 3; COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      db.close();
      throw error;
    }
  }
  return db;
}

export function projectFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    image: row.image,
    previewUrl: row.preview_url || "",
    description: row.description,
    service: row.service,
    stack: JSON.parse(row.stack),
    details: JSON.parse(row.details),
    tone: row.tone,
    isDemo: Boolean(row.is_demo),
    sortOrder: row.sort_order,
    published: Boolean(row.published),
  };
}

export function inquiryFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    service: row.service,
    name: row.name,
    contact: row.contact,
    budget: row.budget,
    description: row.description,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
