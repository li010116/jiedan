import React, { useRef, useState } from "react";
import { Plus, ArrowUpRight, Download, RefreshCw, Trash2, CheckCircle2, Clock3 } from "lucide-react";
import { Dialog, Empty, Notice, formatDate } from "./Common";
import "./business.css";
import "./business-pagination.css";
import { businessQuery, useBusinessResource, useDebounced } from "./business-data";
import RecordSelect from "./RecordSelect";
import ProjectOverview from "./ProjectOverview";
import { useUnsavedChanges } from "./UnsavedChanges";

const currency = value => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format((value || 0) / 100);
const states = {
  clients: { prospect: "潜在客户", active: "合作中", archived: "已归档" },
  engagements: { planning: "待启动", active: "开发中", review: "待验收", completed: "已交付", paused: "已暂停" },
  tasks: { todo: "待开始", doing: "进行中", done: "已完成" },
  quotes: { draft: "草稿", sent: "已发送", accepted: "已接受", declined: "已拒绝" },
  contracts: { draft: "草稿", signed: "已签署", completed: "已完成", cancelled: "已取消" },
  payments: { pending: "待收款", received: "已到账", void: "已作废" },
};
const field = (key, label, type = "text", required = false) => ({ key, label, type, required });
const definitions = {
  clients: { name: "客户", hint: "整理客户档案，安排下一次沟通。", fields: [field("name", "客户名称", "text", true), field("contact", "联系方式", "text", true), field("company", "公司 / 团队"), field("next_date", "下次跟进日期", "date"), field("notes", "沟通记录", "textarea")] },
  engagements: { name: "项目", hint: "从立项到验收，持续跟进交付进度。", fields: [field("title", "项目名称", "text", true), field("client_id", "所属客户", "clients", true), field("due_date", "计划交付日期", "date"), field("description", "项目范围与交付要求", "textarea")] },
  tasks: { name: "任务", hint: "拆解交付事项，优先处理重要和临期任务。", fields: [field("title", "任务名称", "text", true), field("engagement_id", "所属项目", "engagements", true), field("priority", "优先级", "priority"), field("due_date", "截止日期", "date"), field("notes", "任务说明", "textarea")] },
  quotes: { name: "报价", hint: "按服务明细核算价格，客户接受后生成合同草稿。", fields: [field("title", "报价名称", "text", true), field("engagement_id", "所属项目", "engagements", true), field("valid_until", "有效期至", "date"), field("notes", "报价说明 / 付款条件", "textarea")] },
  contracts: { name: "合同", hint: "保存合同摘要与签署状态，衔接后续收款计划。", fields: [field("title", "合同名称", "text", true), field("number", "合同编号", "text", true), field("engagement_id", "所属项目", "engagements", true), field("amount_cents", "合同金额（元）", "money", true), field("signed_date", "签署日期", "date"), field("due_date", "约定交付日期", "date"), field("notes", "合同条款摘要 / 文件存放位置", "textarea")] },
  payments: { name: "收款记录", hint: "记录定金、阶段款与尾款。这里是收款台账，不会发起实际扣款。", fields: [field("title", "款项名称", "text", true), field("contract_id", "所属合同", "contracts", true), field("amount_cents", "收款金额（元）", "money", true), field("due_date", "应收日期", "date"), field("paid_date", "实际收款日期", "date"), field("method", "收款方式"), field("reference", "交易流水 / 凭证编号"), field("notes", "备注", "textarea")] },
};
const parentTableFor = section => ({ engagements: "client_id", tasks: "engagement_id", quotes: "engagement_id", contracts: "engagement_id", payments: "contract_id" })[section];
const parentTypeFor = section => ({ engagements: "clients", tasks: "engagements", quotes: "engagements", contracts: "engagements", payments: "contracts" })[section];
const related = (_data, item) => item.related_name || item.company || item.contact || "—";
const dueDate = item => item.due_date || item.next_date || item.valid_until || "";
const done = item => ["done", "completed", "archived", "void", "received", "cancelled", "declined", "accepted"].includes(item.status);
const overdue = (item, today) => dueDate(item) && dueDate(item) < today && !done(item);
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Business({ request, section, onNavigate, route, onRouteChange }) {
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const search = route.search || "";
  const settledSearch = useDebounced(search);
  const status = route.status || "";
  const parent = route.parent || "";
  const detail = section === "engagements" && route.record;
  const filters = { search: settledSearch, status, parent, project: route.project };
  const query = businessQuery({ ...filters, page: route.page || 1, limit: 12 });
  const path = section === "dashboard" ? "/api/admin/business/dashboard" : detail ? `/api/admin/business/project/${route.record}` : `/api/admin/business/list/${section}?${query}`;
  const { data, loading, error } = useBusinessResource(request, path, revision);
  const lastList = useRef(null);
  if (data?.items) lastList.current = data;
  const pagination = data?.items ? data : lastList.current;
  const refresh = () => setRevision(v => v + 1);
  const closeEditor = () => { setEditing(null); if (section !== "engagements" || route.create) onRouteChange({ record: "", create: "" }); };
  const saved = () => { closeEditor(); setMessage(`${definitions[section].name}已保存。`); refresh(); };
  const creating = route.create === "1" ? { ...(parentTableFor(section) ? { [parentTableFor(section)]: Number(parent) || "" } : {}) } : null;
  const editorItem = editing || creating;
  const editor = editorItem ? <Editor key={`${section}-${editorItem.id || "new"}`} type={section} item={editorItem} request={request} readOnly={section === "quotes" && !!editorItem.locked} onClose={closeEditor} onSaved={saved} /> : section !== "engagements" && route.record ? <RecordEditor key={`${section}-${route.record}`} type={section} id={route.record} request={request} onClose={closeEditor} onSaved={saved} /> : null;
  async function generateContract(item) {
    setActionError("");
    try { const result = await request(`/api/admin/business/quotes/${item.id}/contract`, { method: "POST", body: {} }); onNavigate("contracts", { record: result.item.id }); }
    catch (e) { setActionError(e.message); }
  }
  async function exportCsv() {
    setExporting(true); setActionError("");
    try {
      const blob = await request(`/api/admin/business/export/${section}?${businessQuery(filters)}`, { responseType: "blob" });
      download(`${definitions[section].name}-${data.summary.today}.csv`, blob, "text/csv;charset=utf-8");
      setMessage("已导出全部符合当前筛选的记录。");
    } catch (e) { setActionError(e.message); } finally { setExporting(false); }
  }
  if (section === "dashboard") return <><Notice>{error}</Notice>{data ? <Dashboard data={data} onNavigate={onNavigate} refresh={refresh} /> : loading ? <div className="admin-loading" role="status">正在加载经营概览…</div> : <button className="admin-button" onClick={refresh}>重试</button>}</>;
  if (detail) return <><Notice>{error}</Notice><Notice success>{message}</Notice>{data?.overview ? <ProjectOverview overview={data.overview} labels={states} onNavigate={onNavigate} onEdit={() => setEditing(data.overview.project)} onBack={() => onRouteChange({ record: "" })} /> : loading ? <div className="admin-loading" role="status">正在加载项目详情…</div> : <div className="admin-panel"><Empty title="项目详情暂不可用">请重试，或返回列表检查项目是否存在。</Empty><div className="admin-form-actions"><button className="admin-button" onClick={refresh}>重试</button><button className="admin-button admin-button-secondary" onClick={() => onRouteChange({ record: "" })}>返回项目列表</button></div></div>}{editor}</>;
  const def = definitions[section];
  const items = data?.items || [];
  const busy = loading || search !== settledSearch;
  const parentTable = parentTypeFor(section);
  const parentKey = parentTableFor(section);
  const specialStatus = { engagements: { open: "推进中的项目" }, contracts: { effective: "已签署及完成", outstanding: "有待收余额" } }[section]?.[status];
  return <section className="admin-section biz-section" aria-busy={busy}>
    <Notice>{error || actionError}</Notice><Notice success>{message}</Notice>
    {route.project && <div className="biz-context-bar"><span>来自项目：{data?.context.project?.title || (loading ? "正在读取…" : "项目不存在")}</span><button className="admin-text-link" onClick={() => onNavigate("engagements", { record: route.project })}>返回项目详情 <ArrowUpRight size={14} /></button></div>}
    {(search || status || parent || route.project) && <button className="admin-text-link" onClick={() => onRouteChange({ search: "", status: "", parent: "", project: "", page: "" })}>清除全部筛选</button>}
    <div className="biz-status-tabs" aria-label="按状态筛选">
      {[["", "全部"], ...Object.entries(states[section]), ...(specialStatus ? [[status, specialStatus]] : [])].map(([value, label]) => <button key={value} aria-pressed={status === value} className={status === value ? "selected" : ""} onClick={() => onRouteChange({ status: value, page: "" })}>{label}<span>{data ? (data.statusCounts[value] || 0) : "—"}</span></button>)}
    </div>
    <div className="admin-panel">
      <div className="admin-panel-heading"><div><h2>{def.name}管理</h2><p>{def.hint}</p></div><button className="admin-button" onClick={() => setEditing(parent ? { [parentKey]: Number(parent) } : {})}><Plus size={16} />新增{def.name}</button></div>
      <div className="biz-toolbar"><input aria-label={`搜索${def.name}`} maxLength={200} placeholder={`搜索${def.name}、关联信息或备注…`} value={search} onChange={e => onRouteChange({ search: e.target.value, page: "" })} />
        {parentTable && <RecordSelect request={request} type={parentTable} label="筛选关联记录" value={parent} onChange={value => onRouteChange({ parent: value, project: "", page: "" })} />}
        <button className="admin-button admin-button-secondary" disabled={busy || !items.length || exporting} onClick={exportCsv}><Download size={15} />{exporting ? "导出中…" : "导出"}</button><button className="admin-icon-button" aria-label="刷新业务数据" disabled={loading} onClick={refresh}><RefreshCw size={17} /></button>
      </div>
      {busy ? <div className="admin-loading" role="status">正在加载{def.name}…</div> : error ? <div className="biz-load-error"><button className="admin-button admin-button-secondary" onClick={refresh}>重新加载列表</button></div> : !items.length ? <Empty title={search || status || parent || route.project ? "没有匹配记录" : `还没有${def.name}`}>{search || status || parent || route.project ? "调整筛选条件后再试试。" : `点击“新增${def.name}”开始，也可以从项目需求逐步转入。`}</Empty> : section === "tasks" ? <><p className="biz-page-note">看板展示当前页的 {items.length} 项任务，按状态分列。</p><div className="biz-kanban">{Object.entries(states.tasks).map(([key, label]) => <div className="biz-lane" key={key}><h3>{label}<span>{items.filter(i => i.status === key).length}</span></h3>{items.filter(i => i.status === key).map(i => <button className="biz-task" key={i.id} onClick={() => onRouteChange({ record: i.id })}><small>{related(null, i)}</small><strong>{i.title}</strong><span className={overdue(i, data.summary.today) ? "biz-late" : ""}>{i.priority === "high" && "● 高优先级 · "}{i.due_date || "未安排日期"}</span></button>)}</div>)}</div></> : <div className="admin-table-wrap" tabIndex={0} role="region" aria-label={`${def.name}列表，可横向滚动`}><table className="admin-table"><thead><tr><th>{def.name} / 关联信息</th><th>状态</th><th>{section === "clients" ? "联系方式" : section === "engagements" ? "任务进度" : "金额"}</th><th>计划日期</th><th>操作</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.name || item.title}</strong><small>{item.number ? `${item.number} · ` : ""}{related(null, item)}</small></td><td><span className={`biz-badge ${done(item) ? "biz-badge-done" : ""}`}>{states[section][item.status]}</span></td><td>{section === "clients" ? item.contact : section === "engagements" ? <TaskProgress item={item} /> : currency(item.amount_cents)}</td><td className={overdue(item, data.summary.today) ? "biz-late" : "admin-date"}>{dueDate(item) || "—"}{overdue(item, data.summary.today) ? " · 已逾期" : ""}</td><td><div className="biz-row-actions"><button className="admin-text-link" onClick={() => onRouteChange({ record: item.id })}>{section === "engagements" ? "项目详情" : item.locked ? "查看" : "查看 / 编辑"}</button>{section === "quotes" && item.status === "accepted" && !item.locked && <button className="admin-text-link" onClick={() => generateContract(item)}>生成合同</button>}</div></td></tr>)}</tbody></table></div>}
      {pagination?.total > 0 && <div className="admin-pagination"><span>共 {pagination.total} 条记录 · 每页 {pagination.pageSize} 条</span><div><button className="admin-button admin-button-secondary" disabled={busy || !!error || pagination.page === 1} onClick={() => onRouteChange({ page: pagination.page - 1 })}>上一页</button><span aria-live="polite">{busy ? "加载中…" : `${pagination.page} / ${pagination.pages}`}</span><button className="admin-button admin-button-secondary" disabled={busy || !!error || pagination.page >= pagination.pages} onClick={() => onRouteChange({ page: pagination.page + 1 })}>下一页</button></div></div>}
    </div>
    {editor}
  </section>;
}

function RecordEditor({ type, id, request, onClose, onSaved }) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useBusinessResource(request, `/api/admin/business/record/${type}/${id}`, revision);
  if (data) return <Editor type={type} item={data.item} request={request} readOnly={type === "quotes" && !!data.item.locked} onClose={onClose} onSaved={onSaved} />;
  return <Dialog title={`读取${definitions[type].name}`} onClose={onClose}><Notice>{error}</Notice>{loading ? <p role="status">正在加载记录…</p> : <button className="admin-button" onClick={() => setRevision(n => n + 1)}>重试</button>}</Dialog>;
}

function TaskProgress({ item }) { return <div className="biz-progress"><span>{item.task_done} / {item.task_total} 完成</span><progress max={item.task_total || 1} value={item.task_done} aria-label="任务完成进度" /></div>; }

function Dashboard({ data, onNavigate, refresh }) {
  const s = data.summary;
  const { reminders, projects, months } = data;
  const max = Math.max(1, ...months.map(m => m.amount));
  return <section className="admin-section biz-dashboard">
    <div className="biz-welcome"><div><p>YOUR STUDIO, AT A GLANCE</p><h2>把好想法，交付成好作品。</h2><span>{s.today} · {s.newInquiries} 条新需求 · {s.overdueTasks} 项逾期任务</span></div><button className="admin-button" onClick={() => onNavigate("inquiries", { status: "new" })}>处理项目需求 <ArrowUpRight size={18} /></button></div>
    <div className="admin-stats">{[["累计签约金额", currency(s.contracted), "contracts"], ["累计已到账", currency(s.received), "payments"], ["合同待收余额", currency(s.outstanding), "contracts"], ["推进中的项目", s.activeProjects, "engagements"]].map(([label, value, to], i) => <button key={label} className={`admin-stat biz-stat ${i === 1 ? "admin-stat-highlight" : ""}`} onClick={() => onNavigate(to, { status: ["effective", "received", "outstanding", "open"][i] })}><span>{label}<ArrowUpRight size={15} /></span><strong>{value}</strong><small>{i === 3 ? `${s.clients} 位未归档客户` : "人民币 · 含历史累计"}</small></button>)}</div>
    <div className="biz-dashboard-grid"><div className="admin-panel"><div className="admin-panel-heading"><div><h2>收款趋势</h2><p>近六个月实收金额，按到账日期统计</p></div><button className="admin-icon-button" aria-label="刷新概览" onClick={refresh}><RefreshCw size={17} /></button></div><div className="biz-chart">{months.map(m => <div key={m.key}><span>{currency(m.amount)}</span><div className="biz-bar-track"><div className="biz-bar" style={{ height: `${Math.max(2, m.amount / max * 100)}%` }} /></div><small>{m.key.slice(5)} 月</small></div>)}</div></div>
    <div className="admin-panel"><div className="admin-panel-heading"><div><h2>近期安排</h2><p>任务、收款与客户跟进</p></div><Clock3 size={20} /></div>{reminders.length ? <div className="biz-reminders">{reminders.map(i => <button key={`${i.section}-${i.id}`} onClick={() => onNavigate(i.section, { record: i.id })}><span className="biz-reminder-dot" /><div><strong>{i.title}</strong><small>{i.kind}</small></div><span className={overdue(i, s.today) ? "biz-late" : ""}>{dueDate(i)}</span></button>)}</div> : <Empty title="日程暂时空着">为任务、客户或收款设置日期后，会出现在这里。</Empty>}</div>
    <div className="admin-panel"><div className="admin-panel-heading"><div><h2>交付中的项目</h2><p>让每一步进度都清晰可见</p></div><button className="admin-text-link" onClick={() => onNavigate("engagements")}>全部项目 <ArrowUpRight size={15} /></button></div>{projects.length ? <div className="biz-projects">{projects.slice(0, 5).map(i => <button key={i.id} onClick={() => onNavigate("engagements", { record: i.id })}><div><strong>{i.title}</strong><small>{related(data, i)} · {states.engagements[i.status]}</small></div><TaskProgress item={i} /></button>)}</div> : <Empty title="准备好启动下一个项目">从需求转入，或在项目交付中新建立项。</Empty>}</div>
    <div className="admin-panel"><div className="admin-panel-heading"><div><h2>业务动态</h2><p>最近 20 次业务操作</p></div><CheckCircle2 size={20} /></div>{data.events.length ? <ol className="biz-events">{data.events.slice(0, 6).map(e => <li key={e.id}><strong>{e.message}</strong><small>{formatDate(e.created_at)} · {e.actor}</small></li>)}</ol> : <Empty title="工作室已就绪">创建第一条业务记录，开始积累你的合作旅程。</Empty>}</div></div>
  </section>;
}

function Editor({ type, item, request, readOnly, onClose, onSaved }) {
  const def = definitions[type];
  const [form, setForm] = useState(() => ({ ...Object.fromEntries(def.fields.map(f => [f.key, f.type === "money" ? "0" : f.type === "priority" ? "normal" : ""])), status: Object.keys(states[type])[0], ...item, ...(item.amount_cents != null ? { amount_cents: (item.amount_cents / 100).toFixed(2) } : {}), items: item.items?.map(i => ({ ...i, price: (i.unit_cents / 100).toFixed(2) })) || [{ title: "", quantity: 1, price: "0" }] }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { requestLeave, markSaved } = useUnsavedChanges(form, saving);
  const close = () => requestLeave(onClose);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const total = form.items.reduce((s, i) => s + Math.round(Number(i.price) * 100) * Number(i.quantity), 0);
  async function save(e) {
    e.preventDefault(); setError(""); setSaving(true);
    const body = Object.fromEntries(def.fields.map(f => [f.key, ["clients", "engagements", "contracts"].includes(f.type) ? Number(form[f.key]) : f.type === "money" ? Math.round(Number(form[f.key]) * 100) : form[f.key]]));
    body.status = form.status;
    if (type === "quotes") body.items = form.items.map(i => ({ title: i.title, quantity: Number(i.quantity), unit_cents: Math.round(Number(i.price) * 100) }));
    try { await request(`/api/admin/business/${type}${item.id ? `/${item.id}` : ""}`, { method: item.id ? "PUT" : "POST", body }); markSaved(); onSaved(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function exportQuote() {
    setError("");
    try {
    const context = form.engagement_id ? await request(`/api/admin/business/record/engagements/${form.engagement_id}`) : {};
    const project = context.project;
    const customer = context.client;
    const lines = [form.title, `客户：${customer?.name || "—"}`, `项目：${project?.title || "—"}`, `有效期：${form.valid_until || "未设置"}`, "", ...form.items.map(i => `${i.title}  × ${i.quantity}  单价 ${currency(Math.round(Number(i.price) * 100))}  小计 ${currency(Math.round(Number(i.price) * 100) * Number(i.quantity))}`), "", `合计：${currency(total)}`, "", form.notes];
    download(`报价单-${item.id || "草稿"}.txt`, lines.join("\r\n"), "text/plain;charset=utf-8");
    } catch (e) { setError(e.message); }
  }
  return <Dialog title={`${readOnly ? "查看" : item.id ? "编辑" : "新增"}${def.name}`} onClose={close} wide>
    <form className="admin-form biz-editor" onSubmit={save}>
      {readOnly && <Notice success>此报价已生成合同，内容已锁定。需要调整时请新建报价。</Notice>}
      <fieldset disabled={saving || readOnly}><div className="admin-form-grid">
        {def.fields.map(f => <div className={`biz-field ${f.type === "textarea" ? "biz-full" : ""}`} key={f.key}><span>{f.label}{f.required ? " *" : ""}</span>
          {f.type === "textarea" ? <textarea aria-label={f.label} rows={4} maxLength={5000} value={form[f.key]} onBlur={e => change(f.key, e.target.value)} onChange={e => change(f.key, e.target.value)} /> : ["clients", "engagements", "contracts"].includes(f.type) ? <RecordSelect request={request} type={f.type} value={form[f.key]} onChange={value => change(f.key, value)} label={f.label} required eligible={type === "payments"} /> : f.type === "priority" ? <select aria-label={f.label} value={form.priority} onChange={e => change("priority", e.target.value)}><option value="normal">普通</option><option value="high">高优先级</option></select> : <input aria-label={f.label} type={f.type === "money" ? "number" : f.type} required={f.required} maxLength={f.key === "method" ? 80 : f.key === "reference" ? 100 : 200} min={f.type === "money" ? type === "payments" ? "0.01" : "0" : undefined} max={f.type === "money" ? "100000000" : undefined} step={f.type === "money" ? "0.01" : undefined} value={form[f.key]} onBlur={e => change(f.key, e.target.value)} onChange={e => change(f.key, e.target.value)} />}
        </div>)}
        <label>状态<select value={form.status} onChange={e => change("status", e.target.value)}>{Object.entries(states[type]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {type === "quotes" && <div className="biz-quote-items"><h3>报价明细</h3>{form.items.map((i, index) => <div className="biz-quote-line" key={index}><label>服务项目<input aria-label={`服务项目 ${index + 1}`} required maxLength={200} value={i.title} onChange={e => change("items", form.items.map((v, n) => n === index ? { ...v, title: e.target.value } : v))} /></label><label>数量<input aria-label={`数量 ${index + 1}`} type="number" required min="1" max="10000" step="1" value={i.quantity} onChange={e => change("items", form.items.map((v, n) => n === index ? { ...v, quantity: e.target.value } : v))} /></label><label>单价（元）<input aria-label={`单价 ${index + 1}`} type="number" required min="0" max="100000000" step="0.01" value={i.price} onChange={e => change("items", form.items.map((v, n) => n === index ? { ...v, price: e.target.value } : v))} /></label><button type="button" className="admin-icon-button" aria-label={`移除明细 ${index + 1}`} disabled={form.items.length === 1} onClick={() => change("items", form.items.filter((_, n) => n !== index))}><Trash2 size={16} /></button></div>)}<button type="button" className="admin-text-link" disabled={form.items.length >= 30} onClick={() => change("items", [...form.items, { title: "", quantity: 1, price: "0" }])}><Plus size={15} />添加明细</button><div className="biz-quote-total">报价合计 <strong>{currency(total)}</strong></div></div>}
      </fieldset>
      {type === "payments" && <p className="biz-help">先签署合同，再登记定金或阶段款。将待收款编辑为“已到账”即可确认实收，不需要重复新建。</p>}
      <Notice>{error}</Notice><div className="admin-form-actions">{!readOnly && <button className="admin-button" disabled={saving}>{saving ? "保存中…" : `保存${def.name}`}</button>}{type === "quotes" && <button type="button" className="admin-button admin-button-secondary" onClick={exportQuote}>下载报价单</button>}<button type="button" className="admin-button admin-button-secondary" disabled={saving} onClick={close}>关闭</button></div>
    </form>
  </Dialog>;
}

