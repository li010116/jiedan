import { z } from "zod";
import { randomUUID } from "node:crypto";
import { parseBody } from "./validation.js";
import { attachBusinessReadRoutes } from "./business-read.js";

const text = (max = 200) => z.string().trim().max(max);
const required = text().min(1, "请填写必填内容");
const id = z.number().int().positive();
const money = z.number().int().min(0).max(10000000000);
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "日期无效")]);
const schemas = {
  clients: z.object({ name: required, contact: required, company: text(), status: z.enum(["prospect", "active", "archived"]), notes: text(5000), next_date: date }),
  engagements: z.object({ client_id: id, title: required, status: z.enum(["planning", "active", "review", "completed", "paused"]), due_date: date, description: text(5000) }),
  tasks: z.object({ engagement_id: id, title: required, status: z.enum(["todo", "doing", "done"]), priority: z.enum(["normal", "high"]), due_date: date, notes: text(5000) }),
  quotes: z.object({ engagement_id: id, title: required, status: z.enum(["draft", "sent", "accepted", "declined"]), valid_until: date, notes: text(5000), items: z.array(z.object({ title: required, quantity: z.number().int().min(1).max(10000), unit_cents: money })).min(1).max(30) }),
  contracts: z.object({ engagement_id: id, title: required, number: required, amount_cents: money, status: z.enum(["draft", "signed", "completed", "cancelled"]), signed_date: date, due_date: date, notes: text(5000) }),
  payments: z.object({ contract_id: id, title: required, amount_cents: money.refine(v => v > 0, "收款金额须大于零"), status: z.enum(["pending", "received", "void"]), due_date: date, paid_date: date, method: text(80), notes: text(5000), reference: text(100) }),
};
const labels = { clients: "客户", engagements: "项目", tasks: "任务", quotes: "报价", contracts: "合同", payments: "收款" };
const relations = { engagements: ["client_id", "clients"], tasks: ["engagement_id", "engagements"], quotes: ["engagement_id", "engagements"], contracts: ["engagement_id", "engagements"], payments: ["contract_id", "contracts"] };

export function migrateBusiness(db) {
  if (db.prepare("PRAGMA user_version").get().user_version >= 2) return;
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT NOT NULL, company TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL, next_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE engagements (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id), inquiry_id TEXT UNIQUE REFERENCES inquiries(id), title TEXT NOT NULL, status TEXT NOT NULL, due_date TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL REFERENCES engagements(id), title TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL REFERENCES engagements(id), title TEXT NOT NULL, status TEXT NOT NULL, valid_until TEXT NOT NULL, notes TEXT NOT NULL, items TEXT NOT NULL, amount_cents INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE contracts (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL REFERENCES engagements(id), quote_id INTEGER UNIQUE REFERENCES quotes(id), title TEXT NOT NULL, number TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL, status TEXT NOT NULL, signed_date TEXT NOT NULL, due_date TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id INTEGER NOT NULL REFERENCES contracts(id), title TEXT NOT NULL, amount_cents INTEGER NOT NULL, status TEXT NOT NULL, due_date TEXT NOT NULL, paid_date TEXT NOT NULL, method TEXT NOT NULL, notes TEXT NOT NULL, reference TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE business_events (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX engagements_client ON engagements(client_id);
    CREATE INDEX tasks_project ON tasks(engagement_id);
    CREATE INDEX quotes_project ON quotes(engagement_id);
    CREATE INDEX contracts_project ON contracts(engagement_id);
    CREATE INDEX payments_contract ON payments(contract_id);
    PRAGMA user_version = 2;
    COMMIT;`);
}

const row = (v) => v && ({ ...v, ...(v.items ? { items: JSON.parse(v.items) } : {}) });
export function attachBusinessRoutes(app, db) {
  attachBusinessReadRoutes(app, db);
  const all = table => db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all().map(row);
  const get = (table, value) => row(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(value));
  const event = (req, message) => db.prepare("INSERT INTO business_events(actor,message,created_at) VALUES(?,?,?)").run(req.user.email, message, new Date().toISOString());
  const insert = (table, data) => {
    const now = new Date().toISOString();
    const values = { ...data, created_at: now, updated_at: now };
    const result = db.prepare(`INSERT INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.keys(values).map(() => "?").join(",")})`).run(...Object.values(values));
    return get(table, Number(result.lastInsertRowid));
  };
  const transaction = fn => { db.exec("BEGIN IMMEDIATE"); try { const result = fn(); db.exec("COMMIT"); return result; } catch (e) { db.exec("ROLLBACK"); throw e; } };

  app.get("/api/admin/business", (_req, res) => {
    const data = Object.fromEntries(Object.keys(schemas).map(table => [table, all(table)]));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
    const signed = data.contracts.filter(c => ["signed", "completed"].includes(c.status));
    const received = data.payments.filter(p => p.status === "received");
    data.summary = {
      clients: data.clients.filter(c => c.status !== "archived").length,
      activeProjects: data.engagements.filter(p => ["planning", "active", "review"].includes(p.status)).length,
      contracted: signed.reduce((s, c) => s + c.amount_cents, 0),
      received: received.reduce((s, p) => s + p.amount_cents, 0),
      outstanding: signed.reduce((s, c) => s + c.amount_cents - received.filter(p => p.contract_id === c.id).reduce((a, p) => a + p.amount_cents, 0), 0),
      newInquiries: db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status='new'").get().n,
      overdueTasks: data.tasks.filter(t => t.status !== "done" && t.due_date && t.due_date < today).length,
      today,
    };
    data.events = db.prepare("SELECT * FROM business_events ORDER BY id DESC LIMIT 20").all();
    res.json(data);
  });

  for (const [table, schema] of Object.entries(schemas)) {
    const save = (req, res) => {
      const data = parseBody(schema, req.body, res); if (!data) return;
      const previous = req.params.id ? get(table, req.params.id) : null;
      if (req.params.id && !previous) return res.status(404).json({ error: "记录不存在。" });
      const relation = relations[table];
      if (relation && !get(relation[1], data[relation[0]])) return res.status(400).json({ error: "关联记录不存在，请刷新后重新选择。" });
      if (table === "quotes") {
        data.amount_cents = data.items.reduce((s, i) => s + i.quantity * i.unit_cents, 0);
        if (!Number.isSafeInteger(data.amount_cents) || data.amount_cents > 10000000000) return res.status(400).json({ error: "报价总额超出允许范围。" });
        if (previous && db.prepare("SELECT id FROM contracts WHERE quote_id=?").get(previous.id)) return res.status(409).json({ error: "此报价已生成合同，请在合同中跟进；如需变更报价请新建。" });
        data.items = JSON.stringify(data.items);
      }
      if (table === "contracts") {
        if (data.status === "signed" && !data.signed_date) return res.status(400).json({ error: "请填写签署日期。" });
        if (db.prepare("SELECT id FROM contracts WHERE number=? AND id<>?").get(data.number, previous?.id || 0)) return res.status(409).json({ error: "合同编号已存在。" });
        if (previous) {
          const booked = db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE contract_id=? AND status<>'void'").get(previous.id).n;
          if (data.amount_cents < booked || (booked > 0 && (!['signed','completed'].includes(data.status) || data.engagement_id !== previous.engagement_id))) return res.status(409).json({ error: "已有收款计划或实收，不能降低金额、变更所属项目或取消合同。请先处理相关收款记录。" });
        }
      }
      if (table === "payments" && data.status !== "void") {
        const contract = get("contracts", data.contract_id);
        if (!["signed", "completed"].includes(contract.status)) return res.status(400).json({ error: "只能为已签署或已完成的合同登记收款。" });
        const booked = db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM payments WHERE contract_id=? AND status<>'void' AND id<>?").get(data.contract_id, previous?.id || 0).n;
        if (booked + data.amount_cents > contract.amount_cents) return res.status(409).json({ error: "收款计划与实收合计不能超过合同金额。" });
        if (data.status === "received" && !data.paid_date) return res.status(400).json({ error: "请填写实际收款日期。" });
      }
      const saved = transaction(() => {
        let saved;
        if (previous) {
          data.updated_at = new Date().toISOString();
          db.prepare(`UPDATE ${table} SET ${Object.keys(data).map(k => `${k}=?`).join(",")} WHERE id=?`).run(...Object.values(data), previous.id);
          saved = get(table, previous.id);
        } else saved = insert(table, data);
        event(req, `${previous ? "更新" : "新增"}${labels[table]} · ${saved.title || saved.name}`);
        return saved;
      });
      res.status(previous ? 200 : 201).json({ item: saved });
    };
    app.post(`/api/admin/business/${table}`, save);
    app.put(`/api/admin/business/${table}/:id`, save);
  }

  app.post("/api/admin/inquiries/:id/convert", (req, res) => {
    const inquiry = db.prepare("SELECT * FROM inquiries WHERE id=?").get(req.params.id);
    if (!inquiry) return res.status(404).json({ error: "需求不存在。" });
    const existing = db.prepare("SELECT * FROM engagements WHERE inquiry_id=?").get(inquiry.id);
    if (existing) return res.json({ engagement: existing, client: get("clients", existing.client_id) });
    const result = transaction(() => {
      const client = db.prepare("SELECT * FROM clients WHERE contact=? AND name=? ORDER BY id LIMIT 1").get(inquiry.contact, inquiry.name) || insert("clients", { name: inquiry.name, contact: inquiry.contact, company: "", status: "prospect", notes: "", next_date: "" });
      const engagement = insert("engagements", { client_id: client.id, inquiry_id: inquiry.id, title: `${inquiry.name} · ${inquiry.service}`, status: "planning", due_date: "", description: inquiry.description });
      db.prepare("UPDATE inquiries SET status='in_progress',updated_at=? WHERE id=?").run(new Date().toISOString(), inquiry.id);
      event(req, `需求转项目 · ${engagement.title}`);
      return { client, engagement };
    });
    res.status(201).json(result);
  });
  app.post("/api/admin/business/quotes/:id/contract", (req, res) => {
    const quote = get("quotes", req.params.id);
    if (!quote) return res.status(404).json({ error: "报价不存在。" });
    const existing = db.prepare("SELECT * FROM contracts WHERE quote_id=?").get(quote.id);
    if (existing) return res.json({ item: existing });
    if (quote.status !== "accepted") return res.status(409).json({ error: "请先将报价标记为客户已接受。" });
    const contract = transaction(() => {
      const created = insert("contracts", { engagement_id: quote.engagement_id, quote_id: quote.id, title: quote.title, number: `MG-${randomUUID().slice(0, 8).toUpperCase()}`, amount_cents: quote.amount_cents, status: "draft", signed_date: "", due_date: "", notes: quote.items.map(i => `${i.title} × ${i.quantity}：¥${(i.unit_cents / 100).toFixed(2)}`).join("\n") + "\n" + quote.notes });
      event(req, `报价生成合同草稿 · ${created.number}`); return created;
    });
    res.status(201).json({ item: contract });
  });
}
