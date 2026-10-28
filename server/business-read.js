import { z } from "zod";
import { parseBody } from "./validation.js";

const states = {
  clients: ['prospect','active','archived'], engagements: ['planning','active','review','completed','paused'],
  tasks: ['todo','doing','done'], quotes: ['draft','sent','accepted','declined'],
  contracts: ['draft','signed','completed','cancelled'], payments: ['pending','received','void'],
};
const parents = { engagements: 'client_id', tasks: 'engagement_id', quotes: 'engagement_id', contracts: 'engagement_id', payments: 'contract_id' };
const positive = z.coerce.number().int().min(1).max(1000000000);
const querySchema = z.object({ page: positive.max(1000000).default(1), limit: positive.max(100).default(12), search: z.string().trim().max(500).default(''), status: z.string().max(30).default(''), parent: positive.optional(), project: positive.optional() }).strict();
const parseRow = r => r && ({ ...r, ...(r.items ? { items: JSON.parse(r.items) } : {}) });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const received = `(SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p WHERE p.contract_id=b.id AND p.status='received')`;
const literalLike = text => `%${text.toLowerCase().replace(/[!%_]/g, '!$&')}%`;

export function attachBusinessReadRoutes(app, db) {
  db.exec(`CREATE INDEX IF NOT EXISTS tasks_status_due ON tasks(status,due_date);
    CREATE INDEX IF NOT EXISTS payments_status_paid ON payments(status,paid_date);
    CREATE INDEX IF NOT EXISTS clients_status_next ON clients(status,next_date);
    CREATE INDEX IF NOT EXISTS contracts_status ON contracts(status);
    CREATE INDEX IF NOT EXISTS contracts_quote ON contracts(quote_id);`);
  const get = (table, id) => parseRow(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id));
  const count = (sql, params = []) => db.prepare(sql).get(...params).n;
  function source(table) {
    if (table === 'clients') return { from: 'clients b', related: `COALESCE(NULLIF(b.company,''),b.contact)` };
    const target = table === 'engagements' ? 'clients' : table === 'payments' ? 'contracts' : 'engagements';
    return { from: `${table} b JOIN ${target} r ON r.id=b.${parents[table]}`, related: target === 'clients' ? 'r.name' : 'r.title' };
  }
  function condition(table, q) {
    const { from, related } = source(table);
    const clauses = ['1=1'], args = [];
    if (q.parent) {
      if (!parents[table]) throw new Error('Invalid parent');
      clauses.push(`b.${parents[table]}=?`); args.push(q.parent);
    }
    if (q.project) {
      if (table === 'payments') { clauses.push('r.engagement_id=?'); args.push(q.project); }
      else if (['tasks','quotes','contracts'].includes(table)) { clauses.push('b.engagement_id=?'); args.push(q.project); }
      else if (table === 'engagements') { clauses.push('b.id=?'); args.push(q.project); }
    }
    if (q.search) {
      const fields = table === 'clients' ? ['b.name','b.contact','b.company','b.notes'] : ['b.title', table === 'engagements' ? 'b.description' : 'b.notes', ...(table === 'contracts' ? ['b.number'] : [])];
      clauses.push(`LOWER(${[...fields, related].map(f => `COALESCE(${f},'')`).join(" || ' ' || ")}) LIKE ? ESCAPE '!'`); args.push(literalLike(q.search));
    }
    return { from, related, where: clauses.join(' AND '), args };
  }
  function statusSQL(table, status) {
    if (!status) return '1=1';
    if (table === 'engagements' && status === 'open') return `b.status IN ('planning','active','review')`;
    if (table === 'contracts' && ['effective','outstanding'].includes(status)) return `b.status IN ('signed','completed')${status === 'outstanding' ? ` AND b.amount_cents>${received}` : ''}`;
    return `b.status='${status}'`; // status is validated against the fixed enum below.
  }
  function query(req, res) {
    const table = req.params.table;
    if (!states[table]) { res.status(404).json({ error: '业务类型不存在。' }); return null; }
    const q = parseBody(querySchema, req.query, res); if (!q) return null;
    if (q.parent && !parents[table]) { res.status(400).json({ error: '此类型不支持关联筛选。' }); return null; }
    if (q.status && ![...states[table], ...(table === 'engagements' ? ['open'] : table === 'contracts' ? ['effective','outstanding'] : [])].includes(q.status)) { res.status(400).json({ error: '筛选状态无效。' }); return null; }
    return { table, q, ...condition(table, q) };
  }
  function columns(table, related) {
    let extra = '';
    if (table === 'engagements') extra = `, (SELECT COUNT(*) FROM tasks t WHERE t.engagement_id=b.id) AS task_total, (SELECT COUNT(*) FROM tasks t WHERE t.engagement_id=b.id AND t.status='done') AS task_done`;
    if (table === 'quotes') extra = `, EXISTS(SELECT 1 FROM contracts c WHERE c.quote_id=b.id) AS locked`;
    return `b.*, ${related} AS related_name${extra}`;
  }
  app.get('/api/admin/business/list/:table', (req, res) => {
    const parsed = query(req, res); if (!parsed) return;
    const { table, q, from, where, args, related } = parsed;
    const filtered = `${where} AND (${statusSQL(table, q.status)})`;
    const total = count(`SELECT COUNT(*) n FROM ${from} WHERE ${filtered}`, args);
    const pages = Math.max(1, Math.ceil(total / q.limit)), page = Math.min(q.page, pages);
    const items = db.prepare(`SELECT ${columns(table, related)} FROM ${from} WHERE ${filtered} ORDER BY b.id DESC LIMIT ? OFFSET ?`).all(...args, q.limit, (page - 1) * q.limit).map(parseRow);
    const statusCounts = Object.fromEntries(db.prepare(`SELECT b.status,COUNT(*) n FROM ${from} WHERE ${where} GROUP BY b.status`).all(...args).map(r => [r.status,r.n]));
    statusCounts[''] = Object.values(statusCounts).reduce((sum,n) => sum+n,0);
    for (const special of table === 'engagements' ? ['open'] : table === 'contracts' ? ['effective','outstanding'] : []) statusCounts[special] = count(`SELECT COUNT(*) n FROM ${from} WHERE ${where} AND (${statusSQL(table,special)})`, args);
    res.json({ items, total, pages, page, pageSize: q.limit, statusCounts, context: q.project ? { project: db.prepare('SELECT id,title FROM engagements WHERE id=?').get(q.project) || null } : {}, summary: { today: today() } });
  });
  app.get('/api/admin/business/options/:table', (req, res) => {
    const table = req.params.table;
    if (!['clients','engagements','contracts'].includes(table)) return res.status(404).json({ error: '选项类型不存在。' });
    const q = parseBody(z.object({ page: positive.max(1000000).default(1), search: z.string().trim().max(500).default(''), selected: positive.optional(), eligible: z.enum(['1']).optional() }).strict(), req.query, res); if (!q) return;
    const name = table === 'clients' ? 'name' : 'title';
    const where = `${name} LIKE ? ESCAPE '!'${q.eligible && table === 'contracts' ? " AND status IN ('signed','completed')" : ''}`;
    const args = [literalLike(q.search)];
    const total = count(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`, args), pages = Math.max(1,Math.ceil(total/30)), page = Math.min(q.page,pages);
    const fields = `id,${name} AS label${table === 'contracts' ? ',number' : ''}`;
    res.json({ items: db.prepare(`SELECT ${fields} FROM ${table} WHERE ${where} ORDER BY id DESC LIMIT 30 OFFSET ?`).all(...args,(page-1)*30), selected: q.selected ? db.prepare(`SELECT ${fields} FROM ${table} WHERE id=?`).get(q.selected) || null : null, page, pages, total });
  });
  app.get('/api/admin/business/record/:table/:id', (req, res) => {
    const { table } = req.params;
    if (!states[table] || !positive.safeParse(req.params.id).success) return res.status(404).json({ error: '记录不存在。' });
    const { from, related } = source(table);
    const item = parseRow(db.prepare(`SELECT ${columns(table,related)} FROM ${from} WHERE b.id=?`).get(req.params.id));
    if (!item) return res.status(404).json({ error: '记录不存在。' });
    const project = table === 'engagements' ? item : item.engagement_id ? get('engagements',item.engagement_id) : null;
    const client = project ? get('clients',project.client_id) : null;
    res.json({ item, project, client });
  });
  app.get('/api/admin/business/project/:id', (req, res) => {
    if (!positive.safeParse(req.params.id).success) return res.status(404).json({ error: '项目不存在。' });
    const project = get('engagements', req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在。' });
    const counts = {}, preview = {};
    for (const table of ['tasks','quotes','contracts']) {
      counts[table] = count(`SELECT COUNT(*) n FROM ${table} WHERE engagement_id=?`, [project.id]);
      preview[table] = db.prepare(`SELECT * FROM ${table} WHERE engagement_id=? ORDER BY id DESC LIMIT ?`).all(project.id, table === 'tasks' ? 5 : 4).map(parseRow);
    }
    counts.payments = count('SELECT COUNT(*) n FROM payments p JOIN contracts c ON c.id=p.contract_id WHERE c.engagement_id=?',[project.id]);
    preview.payments = db.prepare('SELECT p.* FROM payments p JOIN contracts c ON c.id=p.contract_id WHERE c.engagement_id=? ORDER BY p.id DESC LIMIT 4').all(project.id);
    const contracted = count("SELECT COALESCE(SUM(amount_cents),0) n FROM contracts WHERE engagement_id=? AND status IN ('signed','completed')",[project.id]);
    const received = count("SELECT COALESCE(SUM(p.amount_cents),0) n FROM payments p JOIN contracts c ON c.id=p.contract_id WHERE c.engagement_id=? AND p.status='received'",[project.id]);
    res.json({ overview: { project, client: get('clients',project.client_id), ...preview, counts, contracted, received, outstanding: contracted-received, completedTasks: count("SELECT COUNT(*) n FROM tasks WHERE engagement_id=? AND status='done'",[project.id]), effectiveContractsCount: count("SELECT COUNT(*) n FROM contracts WHERE engagement_id=? AND status IN ('signed','completed')",[project.id]) }, summary: { today: today() } });
  });
  app.get('/api/admin/business/dashboard', (_req, res) => {
    const day = today();
    const contracted = count("SELECT COALESCE(SUM(amount_cents),0) n FROM contracts WHERE status IN ('signed','completed')");
    const receivedTotal = count("SELECT COALESCE(SUM(amount_cents),0) n FROM payments WHERE status='received'");
    const summary = { today: day, contracted, received: receivedTotal, outstanding: contracted-receivedTotal,
      clients: count("SELECT COUNT(*) n FROM clients WHERE status<>'archived'"), activeProjects: count("SELECT COUNT(*) n FROM engagements WHERE status IN ('planning','active','review')"),
      newInquiries: count("SELECT COUNT(*) n FROM inquiries WHERE status='new'"), overdueTasks: count("SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date<>'' AND due_date<?",[day]) };
    const months = Array.from({length:6},(_,n)=>{const d=new Date(`${day.slice(0,7)}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()-5+n);return {key:d.toISOString().slice(0,7),amount:0};});
    const amounts = db.prepare("SELECT substr(paid_date,1,7) month,SUM(amount_cents) amount FROM payments WHERE status='received' AND paid_date>=? AND paid_date<? GROUP BY month").all(`${months[0].key}-01`,`${day.slice(0,7)}-32`);
    for(const month of months) month.amount=amounts.find(r=>r.month===month.key)?.amount||0;
    const reminders = db.prepare(`SELECT id,title,status,due_date,section,kind FROM (
      SELECT id,title,status,due_date,'tasks' section,'任务' kind FROM tasks WHERE status<>'done' AND due_date<>''
      UNION ALL SELECT id,title,status,due_date,'payments','收款' FROM payments WHERE status='pending' AND due_date<>''
      UNION ALL SELECT id,name,status,next_date,'clients','客户跟进' FROM clients WHERE status<>'archived' AND next_date<>''
    ) ORDER BY due_date,id DESC LIMIT 8`).all();
    const {from,related}=source('engagements');
    const projects=db.prepare(`SELECT ${columns('engagements',related)} FROM ${from} WHERE b.status IN ('planning','active','review') ORDER BY b.id DESC LIMIT 5`).all();
    res.json({ summary, months, reminders, projects, events: db.prepare('SELECT * FROM business_events ORDER BY id DESC LIMIT 20').all() });
  });
  app.get('/api/admin/business/export/:table', async (req, res) => {
    const parsed = query(req,res); if(!parsed)return;
    const {table,q,from,related,where,args}=parsed;
    const safe = value => `"${String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')}"`;
    res.type('text/csv; charset=utf-8').attachment(`${table}-${today()}.csv`);
    res.write('\uFEFF'+['编号','名称','关联 / 联系方式','状态','日期','金额（元）','备注'].map(safe).join(',')+'\r\n');
    try {
      for(const item of db.prepare(`SELECT b.*,${related} related_name FROM ${from} WHERE ${where} AND (${statusSQL(table,q.status)}) ORDER BY b.id DESC`).iterate(...args)) {
        if(res.destroyed)break;
        const line=[item.id,item.name||item.title,item.related_name,item.status,item.due_date||item.next_date||item.valid_until||'',item.amount_cents==null?'':(item.amount_cents/100).toFixed(2),item.notes||item.description||''].map(safe).join(',')+'\r\n';
        if(!res.write(line)) await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});
      }
      res.end();
    } catch { res.destroy(); }
  });
}
