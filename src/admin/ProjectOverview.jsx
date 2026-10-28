import React from "react";
import { ArrowLeft, ArrowUpRight, Plus, Pencil, CalendarDays, UserRound } from "lucide-react";
import { formatDate } from "./Common";
import "./project-overview.css";

const money = value => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value / 100);
export default function ProjectOverview({ overview: o, labels, onNavigate, onEdit, onBack }) {
  const { project, client } = o;
  const context = { project: project.id };
  const open = (section, id) => onNavigate(section, { ...context, record: id, ...(section !== "payments" && section !== "clients" ? { parent: project.id } : {}) });
  const all = section => onNavigate(section, { ...context, ...(section !== "payments" ? { parent: project.id } : {}) });
  const create = section => onNavigate(section, { ...context, parent: project.id, create: "1" });
  const percent = o.counts.tasks ? Math.round(o.completedTasks / o.counts.tasks * 100) : 0;
  return <section className="admin-section project-overview" aria-label="项目详情">
    <button className="admin-text-link project-back" onClick={onBack}><ArrowLeft size={16} />返回项目列表</button>
    <div className="admin-panel project-summary">
      <div><p className="project-eyebrow">PROJECT / 项目详情</p><h2>{project.title}</h2><div className="project-summary-meta"><span className="biz-badge">{labels.engagements[project.status]}</span><span><UserRound size={14} />{client?.name || "未找到关联客户"}</span><span><CalendarDays size={14} />交付日期：{project.due_date || "未安排"}</span></div></div>
      <button className="admin-button admin-button-secondary" onClick={onEdit}><Pencil size={15} />编辑项目</button>
    </div>
    <div className="project-money-grid">
      {[["有效合同金额", o.contracted, "contracts", "effective"], ["已到账", o.received, "payments", "received"], ["合同待收余额", o.outstanding, "contracts", "outstanding"]].map(([label, amount, section, status]) => <button className="admin-panel project-money" key={label} onClick={() => onNavigate(section, { ...context, status, ...(section === "contracts" ? { parent: project.id } : {}) })}><span>{label}<ArrowUpRight size={15} /></span><strong>{money(amount)}</strong></button>)}
    </div>
    <div className="project-context-grid">
      <div className="admin-panel project-context"><h3>项目范围</h3><p className="project-description">{project.description || "暂未填写项目范围，可通过编辑项目补充。"}</p><p className="project-timestamp">创建于 {formatDate(project.created_at)} · 更新于 {formatDate(project.updated_at)}</p></div>
      <div className="admin-panel project-context"><div className="project-block-heading"><h3>客户信息</h3>{client && <button className="admin-text-link" onClick={() => open("clients", client.id)}>查看客户 <ArrowUpRight size={14} /></button>}</div>{client ? <dl className="project-client"><div><dt>客户名称</dt><dd>{client.name}</dd></div><div><dt>联系方式</dt><dd>{client.contact}</dd></div><div><dt>公司 / 团队</dt><dd>{client.company || "未填写"}</dd></div><div><dt>下次跟进</dt><dd>{client.next_date || "未安排"}</dd></div></dl> : <p className="project-muted">暂无客户信息。</p>}</div>
    </div>
    <div className="admin-panel project-records">
      <div className="project-block-heading"><div><h3>交付任务 <span>{o.completedTasks} / {o.counts.tasks}</span></h3><p>按项目汇总任务进度</p></div><div className="project-actions"><button className="admin-text-link" onClick={() => all("tasks")}>全部任务 <ArrowUpRight size={14} /></button><button className="admin-button admin-button-secondary" onClick={() => create("tasks")}><Plus size={14} />新增任务</button></div></div>
      <div className="project-progress"><progress max={100} value={percent} aria-label="项目任务完成百分比" /><span>{percent}%</span></div>
      <RecordList items={o.tasks.slice(0, 5)} section="tasks" labels={labels} onOpen={open} empty="还没有任务，先拆解这个项目的交付事项。" />
      {o.counts.tasks > 5 && <button className="admin-text-link project-more" onClick={() => all("tasks")}>查看全部 {o.counts.tasks} 项任务 <ArrowUpRight size={14} /></button>}
    </div>
    <div className="project-related-grid">
      {[['quotes', '报价', o.quotes], ['contracts', '合同', o.contracts], ['payments', '收款', o.payments]].map(([section, title, items]) => <div key={section} className="admin-panel project-records"><div className="project-block-heading"><h3>{title}<span>{o.counts[section]}</span></h3><button className="admin-text-link" onClick={() => all(section)}>查看全部 <ArrowUpRight size={14} /></button></div><RecordList items={items.slice(0, 4)} section={section} labels={labels} onOpen={open} empty={`暂无${title}记录。`} />{section !== "payments" && <button className="admin-text-link project-more" onClick={() => create(section)}><Plus size={14} />新增{title}</button>}{section === "payments" && <p className="project-finance-note">合同待收余额按有效合同减去实收计算，包含尚未登记收款计划的金额。{!o.effectiveContractsCount && "签署合同后可登记收款。"}</p>}</div>)}
    </div>
  </section>;
}

function RecordList({ items, section, labels, onOpen, empty }) {
  if (!items.length) return <p className="project-list-empty">{empty}</p>;
  return <ul className="project-record-list">{items.map(item => <li key={item.id}><button onClick={() => onOpen(section, item.id)}><div><strong>{item.title}</strong><span>{item.number ? `${item.number} · ` : ""}{item.due_date || item.valid_until || "未设置日期"}</span></div><div className="project-record-meta">{item.amount_cents != null && <strong>{money(item.amount_cents)}</strong>}<span className={`biz-badge${["done", "received", "completed"].includes(item.status) ? " biz-badge-done" : ""}`}>{labels[section][item.status]}</span></div><ArrowUpRight size={15} aria-hidden="true" /></button></li>)}</ul>;
}
