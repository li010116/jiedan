import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Dialog, Empty, Notice } from "./Common";
import { useUnsavedChanges } from "./UnsavedChanges";

const BLANK = {
  title: "",
  category: "WEB APPLICATION",
  image: "",
  previewUrl: "",
  description: "",
  service: "网站开发",
  stack: [],
  details: [],
  tone: "lilac",
  isDemo: true,
  sortOrder: 0,
  published: false,
};

export default function Projects({ request }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request("/api/admin/projects", { signal: controller.signal })
      .then((data) => setProjects(data.projects))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request, revision]);
  async function remove() {
    setDeleting(true);
    setDeleteError("");
    try {
      await request(`/api/admin/projects/${encodeURIComponent(removing.id)}`, {
        method: "DELETE",
      });
      setRemoving(null);
      setRevision((r) => r + 1);
      setMessage("作品已删除。");
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className="admin-section" aria-label="作品管理">
      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>精选作品</h2>
            <p>编辑展示内容，决定哪些作品出现在首页。</p>
          </div>
          <button
            className="admin-button"
            onClick={() => setEditing({ ...BLANK, sortOrder: projects.length })}
          >
            <Plus size={17} />
            添加作品
          </button>
        </div>
        <Notice>{error}</Notice>
        <Notice success>{message}</Notice>
        {loading ? (
          <div className="admin-loading" role="status">
            正在加载作品…
          </div>
        ) : projects.length ? (
          <div className="admin-project-grid">
            {projects.map((project) => (
              <article className="admin-project" key={project.id}>
                <div className="admin-project-image">
                  <img src={project.image} alt={project.title} />
                  <span
                    className={`admin-publish-badge ${project.published ? "is-published" : ""}`}
                  >
                    {project.published ? (
                      <Eye size={13} />
                    ) : (
                      <EyeOff size={13} />
                    )}
                    {project.published ? "已发布" : "草稿"}
                  </span>
                </div>
                <div className="admin-project-body">
                  <p>
                    {project.category} {project.isDemo ? "· 演示项目" : ""}
                  </p>
                  <h3>{project.title}</h3>
                  <span>{project.description}</span>
                  <div className="admin-project-actions">
                    <button
                      className="admin-button admin-button-secondary"
                      onClick={() => setEditing(project)}
                    >
                      <Pencil size={14} />
                      编辑
                    </button>
                    <button
                      className="admin-icon-button admin-danger-text"
                      onClick={() => {
                        setDeleteError("");
                        setRemoving(project);
                      }}
                      aria-label={`删除${project.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="从你的第一件作品开始">
            添加项目图片、介绍和技术标签，展示你的开发能力。
          </Empty>
        )}
      </div>
      {editing && (
        <ProjectEditor
          project={editing}
          request={request}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((r) => r + 1);
            setMessage("作品已保存，已发布的内容会同步到首页。");
          }}
        />
      )}
      {removing && (
        <Dialog
          title="删除这件作品？"
          onClose={() => !deleting && setRemoving(null)}
        >
          <p className="admin-delete-description">
            “{removing.title}”将从作品库中删除。此操作无法恢复。
          </p>
          <Notice>{deleteError}</Notice>
          <div className="admin-form-actions">
            <button
              className="admin-button admin-button-danger"
              disabled={deleting}
              onClick={remove}
            >
              {deleting ? "删除中…" : "确认删除"}
            </button>
            <button
              className="admin-button admin-button-secondary"
              disabled={deleting}
              onClick={() => setRemoving(null)}
            >
              保留作品
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function ProjectEditor({ project, request, onClose, onSaved }) {
  const [fields, setFields] = useState({
    ...project,
    previewUrl: project.previewUrl || "",
    stack: (project.stack || []).join("\n"),
    details: (project.details || []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { requestLeave, markSaved } = useUnsavedChanges(fields, saving);
  const close = () => requestLeave(onClose);
  function update(e) {
    const { name, type, value, checked } = e.target;
    setFields((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      title: fields.title.trim(),
      category: fields.category.trim(),
      image: fields.image.trim(),
      previewUrl: fields.previewUrl.trim(),
      description: fields.description.trim(),
      service: fields.service,
      tone: fields.tone,
      isDemo: fields.isDemo,
      published: fields.published,
      sortOrder: Number(fields.sortOrder),
      stack: fields.stack
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      details: fields.details
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      await request(
        project.id
          ? `/api/admin/projects/${encodeURIComponent(project.id)}`
          : "/api/admin/projects",
        { method: project.id ? "PUT" : "POST", body },
      );
      markSaved();
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title={project.id ? "编辑作品" : "添加作品"}
      wide
      onClose={close}
    >
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-grid">
          <label>
            作品名称
            <input
              name="title"
              required
              maxLength={100}
              value={fields.title}
              onChange={update}
              placeholder="例如：品牌官网设计开发"
            />
          </label>
          <label>
            英文分类
            <input
              name="category"
              required
              maxLength={80}
              value={fields.category}
              onChange={update}
              placeholder="WEB APPLICATION"
            />
          </label>
        </div>
        <label>
          预览图片地址
          <input
            name="image"
            required
            maxLength={1000}
            value={fields.image}
            onChange={update}
            placeholder="/assets/work-dashboard.png 或 https://…"
          />
          <small>支持本站 /assets/ 图片路径或 HTTPS 图片链接。</small>
        </label>
        <label>
          在线体验链接（选填）
          <input
            type="url"
            name="previewUrl"
            maxLength={2000}
            value={fields.previewUrl}
            onChange={update}
            placeholder="https://your-project.com"
          />
          <small>填写完整的 HTTP 或 HTTPS 地址，前台作品详情将显示“在线体验”，在新标签页打开；留空则隐藏入口。</small>
        </label>
        <label>
          简短介绍
          <textarea
            name="description"
            required
            rows={2}
            maxLength={500}
            value={fields.description}
            onChange={update}
          />
        </label>
        <div className="admin-form-grid">
          <label>
            对应服务
            <select name="service" value={fields.service} onChange={update}>
              {["网站开发", "小程序 / App", "AI 应用", "技术支持"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            展示色调
            <select name="tone" value={fields.tone} onChange={update}>
              <option value="lilac">浅紫</option>
              <option value="peach">暖白</option>
              <option value="mint">薄荷绿</option>
            </select>
          </label>
        </div>
        <div className="admin-form-grid">
          <label>
            技术标签
            <textarea
              name="stack"
              rows={3}
              value={fields.stack}
              maxLength={1000}
              onChange={update}
              placeholder={"每行一个标签\nReact\n响应式设计"}
            />
          </label>
          <label>
            项目亮点
            <textarea
              name="details"
              rows={3}
              value={fields.details}
              maxLength={3000}
              onChange={update}
              placeholder="每行一条项目亮点"
            />
          </label>
        </div>
        <div className="admin-editor-options">
          <label>
            排序
            <input
              type="number"
              min={0}
              max={9999}
              step={1}
              name="sortOrder"
              value={fields.sortOrder}
              onChange={update}
              required
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              name="isDemo"
              checked={fields.isDemo}
              onChange={update}
            />
            标记为演示项目
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              name="published"
              checked={fields.published}
              onChange={update}
            />
            发布到首页
          </label>
        </div>
        <Notice>{error}</Notice>
        <div className="admin-form-actions">
          <button className="admin-button" disabled={saving}>
            {saving ? "保存中…" : "保存作品"}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            disabled={saving}
            onClick={close}
          >
            取消
          </button>
        </div>
      </form>
    </Dialog>
  );
}
