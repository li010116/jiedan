import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { Dialog, Empty, Notice, STATUS, formatDate } from "./Common";
import { useUnsavedChanges } from "./UnsavedChanges";

export default function Inquiries({ request, route, onRouteChange, onNavigate }) {
  const [result, setResult] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    stats: {},
  });
  const page = Number(route.page) || 1;
  const status = ["new", "contacted", "in_progress", "closed"].includes(route.status) ? route.status : "";
  const [search, setSearch] = useState(route.search || "");
  const query = route.search || "";
  const setPage = value => onRouteChange({ page: typeof value === "function" ? value(page) : value });
  useEffect(() => setSearch(route.search || ""), [route.search]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(
      `/api/admin/inquiries?${new URLSearchParams({ page: String(page), limit: "10", status, q: query })}`,
      { signal: controller.signal },
    )
      .then(setResult)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request, page, status, query, revision]);

  const pages = Math.max(1, Math.ceil(result.total / (result.pageSize || 10)));
  return (
    <section className="admin-section" aria-label="项目需求管理">
      <div className="admin-stats">
        {[
          ["total", "全部需求"],
          ["new", "待处理"],
          ["contacted", "已联系"],
          ["in_progress", "进行中"],
        ].map(([key, label]) => (
          <div
            className={`admin-stat ${key === "new" ? "admin-stat-highlight" : ""}`}
            key={key}
          >
            <span>{label}</span>
            <strong>{result.stats?.[key] ?? 0}</strong>
            {key === "new" && <small>新的合作可能</small>}
          </div>
        ))}
      </div>
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>项目需求</h2>
            <p>从第一次沟通开始，记录每个项目的进展。</p>
          </div>
          <button
            className="admin-button admin-button-secondary"
            onClick={() => setRevision((r) => r + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} />
            刷新
          </button>
        </div>
        <div className="admin-toolbar">
          <form
            className="admin-search"
            onSubmit={(e) => {
              e.preventDefault();
              onRouteChange({ search: search.trim(), page: "" });
            }}
          >
            <Search size={17} />
            <input
              aria-label="搜索项目需求"
              placeholder="搜索称呼、联系方式或项目内容"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit">搜索</button>
          </form>
          <label className="admin-filter">
            <span className="admin-visually-hidden">筛选需求状态</span>
            <select
              aria-label="筛选需求状态"
              value={status}
              onChange={(e) => {
                onRouteChange({ status: e.target.value, page: "" });
              }}
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Notice>{error}</Notice>
        {loading ? (
          <div className="admin-loading" role="status">
            正在加载项目需求…
          </div>
        ) : result.items.length ? (
          <>
            <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="项目需求列表，可横向滚动">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>客户 / 编号</th>
                    <th>项目类型</th>
                    <th>预算</th>
                    <th>状态</th>
                    <th>收到时间</th>
                    <th>
                      <span className="admin-visually-hidden">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.reference}</small>
                      </td>
                      <td>{item.service}</td>
                      <td>{item.budget}</td>
                      <td>
                        <span
                          className={`admin-status admin-status-${item.status}`}
                        >
                          {STATUS[item.status] || item.status}
                        </span>
                      </td>
                      <td className="admin-date">
                        {formatDate(item.createdAt)}
                      </td>
                      <td>
                        <button
                          className="admin-icon-button"
                          aria-label={`查看 ${item.name} 的需求`}
                          onClick={() => setSelected(item)}
                        >
                          <ArrowRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <span>共 {result.total} 条需求</span>
              <div>
                <button
                  className="admin-icon-button"
                  aria-label="上一页"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {page} / {pages}
                </span>
                <button
                  className="admin-icon-button"
                  aria-label="下一页"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={query || status ? "没有匹配的需求" : "等待下一个好想法"}
          >
            {query || status
              ? "试试其他关键词，或选择全部状态。"
              : "访客提交的项目需求会出现在这里。"}
          </Empty>
        )}
      </div>
      {selected && (
        <InquiryDetail
          item={selected}
          request={request}
          onNavigate={onNavigate}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setSelected(updated);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </section>
  );
}

function InquiryDetail({ item, request, onClose, onSaved, onNavigate }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { requestLeave, markSaved } = useUnsavedChanges({ status, notes }, saving);
  const close = () => requestLeave(onClose);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await request(
        `/api/admin/inquiries/${encodeURIComponent(item.id)}`,
        { method: "PATCH", body: { status, notes } },
      );
      markSaved();
      onSaved(result.inquiry);
      setSuccess("跟进记录已保存。");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog title="项目需求详情" onClose={close}>
      <p className="admin-dialog-kicker">
        {item.reference} · {formatDate(item.createdAt)}
      </p>
      <dl className="admin-details">
        <div>
          <dt>客户称呼</dt>
          <dd>{item.name}</dd>
        </div>
        <div>
          <dt>联系方式</dt>
          <dd>{item.contact}</dd>
        </div>
        <div>
          <dt>项目类型</dt>
          <dd>{item.service}</dd>
        </div>
        <div>
          <dt>预计预算</dt>
          <dd>{item.budget}</dd>
        </div>
        <div className="admin-details-full">
          <dt>项目描述</dt>
          <dd>{item.description}</dd>
        </div>
      </dl>
      <form className="admin-form" onSubmit={save}>
        <label>
          跟进状态
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSuccess("");
            }}
          >
            {Object.entries(STATUS).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          内部备注
          <textarea
            rows={4}
            maxLength={5000}
            placeholder="记录沟通要点、下一步计划或交付安排…"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSuccess("");
            }}
          />
        </label>
        <Notice>{error}</Notice>
        <Notice success>{success}</Notice>
        <div className="admin-form-actions">
          <button type="button" className="admin-button admin-button-secondary" disabled={saving} onClick={() => requestLeave(async () => {
            setSaving(true); setError(""); setSuccess("");
            try {
              const result = await request(`/api/admin/inquiries/${encodeURIComponent(item.id)}/convert`, { method: "POST", body: {} });
              setStatus("in_progress"); onSaved({ ...item, status: "in_progress" });
              markSaved();
              onNavigate("engagements", { record: result.engagement.id });
            } catch (e) { setError(e.message); } finally { setSaving(false); }
          })}>转为客户与项目</button>
          <button className="admin-button" disabled={saving}>
            {saving ? "保存中…" : "保存跟进记录"}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={close}
          >
            关闭
          </button>
        </div>
      </form>
    </Dialog>
  );
}
