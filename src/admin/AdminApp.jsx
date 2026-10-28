import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Inbox,
  LayoutGrid,
  LogOut,
  Settings2,
  ShieldCheck,
  ChartNoAxesCombined, Users, BriefcaseBusiness, ListTodo, FileText, FileCheck2, Wallet,
} from "lucide-react";
import Inquiries from "./Inquiries";
import Projects from "./Projects";
import Settings from "./Settings";
import Business from "./Business";
import { Notice } from "./Common";
import "./admin.css";
import { readAdminRoute, adminHash } from "./navigation";
import { UnsavedChangesProvider, useLeaveGuard } from "./UnsavedChanges";
import { createKeyedSnapshotCache } from "./snapshot-cache";
import "./admin-accessibility.css";

const TABS = [
  { id: "dashboard", label: "经营概览", icon: ChartNoAxesCombined, subtitle: "客户、交付与收款，一眼掌握工作室经营。" },
  {
    id: "inquiries",
    label: "项目需求",
    icon: Inbox,
    subtitle: "把每一次咨询，变成一次好的合作。",
  },
  {
    id: "projects",
    label: "作品管理",
    icon: LayoutGrid,
    subtitle: "让你的作品，为你说话。",
  },
  {
    id: "settings",
    label: "网站设置",
    icon: Settings2,
    subtitle: "品牌与联系信息，在这里保持更新。",
  },
];
TABS.splice(2, 0,
  { id: "clients", label: "客户管理", icon: Users, subtitle: "持续跟进，建立长期的合作关系。" },
  { id: "engagements", label: "项目交付", icon: BriefcaseBusiness, subtitle: "从想法到交付，每一步都有迹可循。" },
  { id: "tasks", label: "任务看板", icon: ListTodo, subtitle: "专注当下，让交付稳步向前。" },
  { id: "quotes", label: "报价管理", icon: FileText, subtitle: "清晰的范围，合理的价格。" },
  { id: "contracts", label: "合同记录", icon: FileCheck2, subtitle: "管理合同摘要、金额与签署进度。" },
  { id: "payments", label: "收款台账", icon: Wallet, subtitle: "从定金到尾款，每一笔收入都清楚。" },
);

export default function AdminApp() {
  return <UnsavedChangesProvider><AdminWorkspace /></UnsavedChangesProvider>;
}
function AdminWorkspace() {
  const requestLeave = useLeaveGuard();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [route, setRoute] = useState(() => readAdminRoute(window.location.hash));
  const tab = route.section;
  const headingRef = useRef(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const cache = useRef(createKeyedSnapshotCache());
  const navigate = useCallback((section, params = {}, replace = false) => {
    requestLeave(() => {
      const hash = adminHash(section, params);
      window.history[replace ? "replaceState" : "pushState"](null, "", hash);
      setRoute(readAdminRoute(hash));
    });
  }, [requestLeave]);
  const updateRoute = (changes) => navigate(tab, { ...route, ...changes }, true);
  useEffect(() => {
    const sync = () => {
      const target = window.location.hash;
      const next = readAdminRoute(target);
      // Fragment navigation can emit both popstate and hashchange. The second
      // event must not replace a pending leave action after restoring the URL.
      if (adminHash(next.section, next) === adminHash(routeRef.current.section, routeRef.current)) return;
      window.history.replaceState(null, "", adminHash(routeRef.current.section, routeRef.current));
      requestLeave(() => { window.history.replaceState(null, "", target); setRoute(readAdminRoute(target)); });
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, [requestLeave]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, tab === "engagements" ? route.record : undefined]);
  const [loggingOut, setLoggingOut] = useState(false);
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.ok && options.responseType === "blob") return response.blob();
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && !path.endsWith("/login")) { cache.current.clear(); setUser(null); }
      const error = new Error(data.error || "请求未完成，请稍后重试。");
      error.status = response.status;
      error.issues = data.issues;
      throw error;
    }
    if (options.method && options.method !== "GET") cache.current.clear();
    return data;
  }, []);
  const businessRequest = useCallback((path, options = {}) => {
    if (!path.startsWith("/api/admin/business/") || options.responseType || (options.method && options.method !== "GET")) return request(path, options);
    return cache.current.get(path, () => request(path), { force: options.force, signal: options.signal });
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    document.title = "管理后台 · MOGUSTACK";
    request("/api/auth/session", { signal: controller.signal })
      .then((data) => setUser(data.user))
      .catch((e) => {
        if (e.name !== "AbortError")
          setSessionError("暂时无法连接服务，请确认后端已启动后刷新页面。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  async function logout() {
    setLoggingOut(true);
    setSessionError("");
    try {
      await request("/api/auth/logout", { method: "POST", body: {} });
      setUser(null);
    } catch (e) {
      setSessionError(e.message);
    } finally {
      setLoggingOut(false);
    }
  }
  const current = TABS.find((item) => item.id === tab);
  useEffect(() => {
    if (!user) return;
    document.title = `${current.label} · MOGUSTACK 管理后台`;
    headingRef.current?.focus({ preventScroll: true });
  }, [user, tab, tab === "engagements" ? route.record : undefined]);
  if (loading)
    return (
      <div className="admin-shell admin-auth-shell">
        <div className="admin-loading">正在连接工作室…</div>
      </div>
    );
  if (!user)
    return (
      <Login request={request} onLogin={setUser} sessionError={sessionError} />
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          MOGUSTACK<span>.</span>
        </a>
        <p className="admin-sidebar-caption">STUDIO MANAGER</p>
        <nav className="admin-navigation" aria-label="后台导航">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "is-active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.5} />
              {label}
              {tab === id && <span className="admin-nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" className="admin-site-link">
            查看网站 <ArrowUpRight size={17} />
          </a>
          <div className="admin-account">
            <span className="admin-avatar">
              {user.email?.[0]?.toUpperCase() || "M"}
            </span>
            <div>
              <strong>工作室管理员</strong>
              <span title={user.email}>{user.email}</span>
            </div>
            <button
              className="admin-icon-button"
              aria-label="退出登录"
              title="退出登录"
              disabled={loggingOut}
              onClick={() => requestLeave(logout)}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p>MOGUSTACK / WORKSPACE</p>
            <h1 ref={headingRef} tabIndex={-1}>{current.label}</h1>
            <span>{current.subtitle}</span>
          </div>
          <span className="admin-connected">
            <span />
            工作室后台
          </span>
        </header>
        <Notice>{sessionError}</Notice>
        {tab === "inquiries" && <Inquiries request={request} route={route} onRouteChange={updateRoute} onNavigate={navigate} />}
        {tab === "projects" && <Projects request={request} />}
        {tab === "settings" && <Settings request={request} />}
        {!["inquiries", "projects", "settings"].includes(tab) && <Business key={tab} section={tab} request={businessRequest} route={route} onRouteChange={updateRoute} onNavigate={navigate} />}
      </main>
    </div>
  );
}

function Login({ request, onLogin, sessionError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function login(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await request("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="admin-shell admin-auth-shell">
      <div className="admin-auth-art">
        <a className="admin-brand" href="/">
          MOGUSTACK<span>.</span>
        </a>
        <div>
          <p className="admin-auth-statement">
            每个好想法，
            <br />
            都值得被看见。
          </p>
          <span>
            从一次咨询，到下一件作品。
            <br />
            你的工作室，在这里井井有条。
          </span>
        </div>
        <a href="/">
          返回网站 <ArrowUpRight size={18} />
        </a>
      </div>
      <main className="admin-login">
        <div className="admin-login-inner">
          <span className="admin-login-icon">
            <ShieldCheck size={25} strokeWidth={1.5} />
          </span>
          <h1>管理工作室</h1>
          <p>登录后管理作品、项目与客户咨询。</p>
          <form className="admin-form" onSubmit={login}>
            <label>
              管理员邮箱
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入管理员邮箱"
              />
            </label>
            <label>
              登录密码
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入登录密码"
              />
            </label>
            <Notice>{error || sessionError}</Notice>
            <button className="admin-button" disabled={saving}>
              {saving ? "正在登录…" : "登录后台"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p className="admin-setup-note">
            首次使用请先运行 <code>npm run admin:create</code>
          </p>
        </div>
      </main>
    </div>
  );
}
