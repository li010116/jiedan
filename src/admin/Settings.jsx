import React, { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Notice } from "./Common";
import { useUnsavedChanges } from "./UnsavedChanges";

export default function Settings({ request }) {
  const [fields, setFields] = useState({
    studioName: "",
    tagline: "",
    email: "",
    wechat: "",
    about: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { markSaved } = useUnsavedChanges(fields, saving);
  const markSavedRef = React.useRef(markSaved);
  markSavedRef.current = markSaved;
  useEffect(() => {
    const controller = new AbortController();
    request("/api/site", { signal: controller.signal })
      .then((data) => { markSavedRef.current(data.settings); setFields(data.settings); })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  function update(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setMessage("");
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await request("/api/admin/settings", {
        method: "PUT",
        body: fields,
      });
      setFields(result.settings);
      markSaved(result.settings);
      setMessage("网站设置已保存。");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="admin-section admin-settings" aria-label="网站设置">
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>让客户更了解你</h2>
            <p>这些信息会同步展示在网站上。</p>
          </div>
          <a
            className="admin-text-link"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            查看网站
            <ExternalLink size={14} />
          </a>
        </div>
        <Notice>{error}</Notice>
        {loading ? (
          <div className="admin-loading" role="status">
            正在加载网站设置…
          </div>
        ) : (
          <form className="admin-form admin-settings-form" onSubmit={save}>
            <div className="admin-form-section">
              <h3>品牌信息</h3>
              <div className="admin-form-grid">
                <label>
                  工作室名称
                  <input
                    name="studioName"
                    required
                    maxLength={80}
                    value={fields.studioName}
                    onChange={update}
                  />
                </label>
                <label>
                  品牌标语
                  <input
                    name="tagline"
                    required
                    maxLength={120}
                    value={fields.tagline}
                    onChange={update}
                  />
                </label>
              </div>
              <label>
                工作室介绍
                <textarea
                  name="about"
                  rows={4}
                  required
                  maxLength={1000}
                  value={fields.about}
                  onChange={update}
                />
              </label>
            </div>
            <div className="admin-form-section">
              <h3>联系信息</h3>
              <p>填写希望公开展示的联系方式；留空的项目不会显示。</p>
              <div className="admin-form-grid">
                <label>
                  业务邮箱
                  <input
                    type="email"
                    name="email"
                    maxLength={254}
                    autoComplete="email"
                    value={fields.email}
                    onChange={update}
                    placeholder="hello@example.com"
                  />
                </label>
                <label>
                  微信号
                  <input
                    name="wechat"
                    maxLength={100}
                    value={fields.wechat}
                    onChange={update}
                    placeholder="你的业务微信号"
                  />
                </label>
              </div>
            </div>
            <Notice success>{message}</Notice>
            <div className="admin-form-actions">
              <button className="admin-button" disabled={saving}>
                <Check size={16} />
                {saving ? "保存中…" : "保存设置"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
