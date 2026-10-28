import React, { useId, useState } from "react";
import { businessQuery, useBusinessResource, useDebounced } from "./business-data";

const names = { clients: "客户", engagements: "项目", contracts: "合同" };

export default function RecordSelect({ request, type, value, onChange, label, required = false, eligible = false }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const settled = useDebounced(search);
  const path = `/api/admin/business/options/${type}?${businessQuery({ page, search: settled, selected: value, eligible: eligible ? "1" : "" })}`;
  const { data, error, loading } = useBusinessResource(request, path, revision);
  const items = data?.items || [];
  const selected = data?.selected;
  const options = selected && !items.some(item => item.id === selected.id) ? [selected, ...items] : items;
  return <div className="biz-record-select" aria-busy={loading}>
    <div className="biz-record-select-row">
      <select aria-label={label} required={required} value={value || ""} onChange={event => onChange(event.target.value)}>
        <option value="">{required ? "请选择" : "全部"}{names[type]}</option>
        {value && !options.some(item => String(item.id) === String(value)) && <option value={value}>{loading ? "正在读取已选记录…" : "原关联记录不可用"}</option>}
        {options.map(item => <option key={item.id} value={item.id}>{item.label}{item.number ? ` (${item.number})` : ""}</option>)}
      </select>
      <button type="button" className="admin-text-link" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(open => !open)}>{expanded ? "收起搜索" : "搜索"}</button>
    </div>
    {expanded && <div id={id} className="biz-option-search">
      <input aria-label={`搜索可选${names[type]}`} placeholder={`搜索${names[type]}名称…`} maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
      <div className="biz-option-pages"><span role="status">{loading ? "加载选项…" : error || `共 ${data?.total || 0} 条 · ${data?.page || 1} / ${data?.pages || 1} 页`}</span>
        {error ? <button type="button" className="admin-text-link" onClick={() => setRevision(n => n + 1)}>重试</button> : <><button type="button" className="admin-text-link" disabled={loading || !data || data.page <= 1} onClick={() => setPage(data.page - 1)}>上页</button><button type="button" className="admin-text-link" disabled={loading || !data || data.page >= data.pages} onClick={() => setPage(data.page + 1)}>下页</button></>}
      </div>
    </div>}
    {!expanded && error && <span className="biz-option-error" role="alert">{error}<button type="button" className="admin-text-link" onClick={() => setRevision(n => n + 1)}>重试</button></span>}
  </div>;
}
