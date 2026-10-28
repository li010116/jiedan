import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Globe2,
  Menu,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import ProjectDialog from "./components/ProjectDialog";
import HeroDotMatrix from "./components/HeroDotMatrix";
import "./components/PublicContact.css";

const MoguCopperRibbon = lazy(() => import("./components/MoguCopperRibbon"));

const services = [
  {
    name: "网站开发",
    icon: Globe2,
    description: "围绕业务流程，搭建品牌官网、内容站与管理系统。",
    tags: "品牌官网 · 管理系统 · SaaS",
  },
  {
    name: "小程序 / App",
    icon: Smartphone,
    description: "为微信和跨平台场景开发轻量、易用的移动产品。",
    tags: "微信小程序 · 跨平台应用",
  },
  {
    name: "AI 应用",
    icon: Sparkles,
    description: "将 AI 接入业务流程，构建助手、知识库与自动化工具。",
    tags: "智能助手 · 知识库 · 自动化",
  },
  {
    name: "技术支持",
    icon: Code2,
    description: "处理功能迭代、性能优化与产品上线后的维护。",
    tags: "功能迭代 · 性能优化 · 维护",
  },
];

const defaultSettings = {
  studioName: "MOGUSTACK",
  tagline: "独立开发 · 认真创造",
  email: "",
  wechat: "",
  about:
    "MOGUSTACK 是一家独立软件开发工作室。\n用清晰的沟通和扎实的代码，将你的想法\n变成真实、好用、可持续的产品。",
};

const steps = [
  ["沟通需求", "明确目标、使用场景与核心功能。", "需求清单"],
  ["方案规划", "确认功能范围、开发安排与预算。", "实施方案与报价"],
  ["开发实现", "分阶段开发，提供可体验版本并同步进展。", "阶段演示版本"],
  ["上线交付", "完成测试、部署与资料交接。", "源码与部署文档"],
];

function Brand({ footer = false, name }) {
  return (
    <a
      className={`brand${footer ? " brand-footer" : ""}`}
      href="#top"
      aria-label={`${name} 返回首页`}
    >
      {name}
      <span className="brand-dot">.</span>
    </a>
  );
}

function Header({ onContact, studioName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="site-header content-width">
      <Brand name={studioName} />
      <nav
        className={menuOpen ? "navigation is-open" : "navigation"}
        aria-label="主导航"
        id="main-navigation"
      >
        <a href="#services" onClick={closeMenu}>
          服务能力
        </a>
        <a href="#work" onClick={closeMenu}>
          精选作品
        </a>
        <a href="#process" onClick={closeMenu}>
          合作流程
        </a>
        <button
          className="mobile-contact"
          onClick={() => {
            closeMenu();
            onContact();
          }}
        >
          聊聊你的项目 <ArrowUpRight size={16} />
        </button>
      </nav>
      <button className="button button-nav" onClick={onContact}>
        聊聊你的项目 <ArrowUpRight size={16} />
      </button>
      <button
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        aria-label={menuOpen ? "关闭导航" : "打开导航"}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X /> : <Menu />}
      </button>
    </header>
  );
}

function Hero({ onContact, studioName }) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <HeroDotMatrix />
      <Header onContact={onContact} studioName={studioName} />
      <div className="hero-copy content-width">
        <div className="hero-text" data-reveal style={{ "--reveal-delay": "90ms" }}>
        <div className="hero-heading">
          <h1 id="hero-title">
            开发网站
            <br />
            小程序与 AI 应用
          </h1>
        </div>
        <div className="hero-intro">
          <p className="hero-lead">
            独立软件开发工作室，
            <br />
            从需求梳理到上线交付。
          </p>
          <p className="hero-detail">分阶段开发，涵盖测试、部署与资料交接。</p>
          <div className="hero-actions">
            <button className="button button-lime" onClick={onContact}>
              聊聊你的项目 <ArrowUpRight size={20} />
            </button>
            <a className="round-link" href="#work" aria-label="浏览作品">
              <ArrowDown size={21} />
            </a>
          </div>
        </div>
        </div>
      <div className="hero-visual hero-visual-3d">
        <Suspense fallback={<div className="hero-3d-loading" role="status">正在加载铜色飘带…</div>}>
          <MoguCopperRibbon
            autoMotion
            mouseParallax
            ribbonSrc="/assets/copper-ribbon-v2/ribbon.png"
            orbSrc="/assets/copper-ribbon-v2/orb.png"
            fallbackSrc="/assets/copper-ribbon-v2/reference-composite.png"
          />
        </Suspense>
      </div>
      </div>
      <svg className="hero-transition" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hero-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fafbf9" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <filter id="hero-edge-softness" x="-25%" y="-100%" width="150%" height="300%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="13" />
          </filter>
        </defs>
        <path fill="url(#hero-surface)" d="M0 0Q0 24 24 24H580C638 24 648 112 720 112S802 24 860 24H1416Q1440 24 1440 0V120H0Z" />
        <path className="hero-edge-shadow" d="M480 24H580C638 24 648 112 720 112S802 24 860 24H960" fill="none" stroke="#30352b" strokeWidth="10" opacity=".12" filter="url(#hero-edge-softness)" />
      </svg>
      <a className="hero-explore" href="#services" aria-label="探索服务能力">
        <ArrowDown size={24} strokeWidth={1.5} />
      </a>
      <a className="hero-scroll" href="#services">
        <span>SCROLL TO EXPLORE</span>
        <ArrowDown size={15} />
      </a>
    </section>
  );
}

function Services({ onContact, about }) {
  return (
    <section
      className="services section content-width"
      id="services"
      aria-labelledby="services-title"
    >
      <div className="section-copy" data-reveal>
        <h2 id="services-title">
          从需求到
          <br />
          上线交付
        </h2>
        <p className="section-description public-about">{about}</p>
        <div className="section-actions">
          <button className="button button-black" onClick={onContact}>
            聊聊你的项目 <ArrowUpRight size={17} />
          </button>
          <a className="text-link" href="#process">
            了解合作方式 <ArrowRight size={16} />
          </a>
        </div>
      </div>
      <ul className="service-list" aria-label="可咨询的服务">
        {services.map(({ name, icon: Icon, description, tags }, index) => (
          <li
            key={name}
            data-reveal
            style={{ "--reveal-delay": `${index * 70}ms` }}
          >
            <button
              type="button"
              className="service-item"
              onClick={() => onContact(name)}
              aria-label={`咨询${name}`}
            >
              <span className="service-item-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <span className="service-item-copy">
                <span className="service-item-heading">
                  <span className="service-name">{name}</span>
                  <span className="service-tags">{tags}</span>
                </span>
                <span className="service-description">{description}</span>
              </span>
              <ArrowUpRight className="service-arrow" size={19} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Work({ onSelect, projects, loading, error, onRetry }) {
  return (
    <section
      className="work-section section content-width"
      id="work"
      aria-labelledby="work-title"
    >
      <div className="section-heading">
        <div className="section-copy" data-reveal>
          <h2 id="work-title">想法，有了模样。</h2>
        </div>
        <p className="heading-description">
          {projects.length > 0 && projects.every((project) => project.isDemo)
            ? "目前展出的项目为概念演示，用于呈现设计与开发方向。"
            : "从使用场景出发，看看产品如何经过设计与开发落地。"}
        </p>
      </div>
      {loading ? (
        <p className="public-site-state" role="status">
          正在加载作品…
        </p>
      ) : null}
      {error ? (
        <div className="public-site-state public-site-error" role="alert">
          <p>作品和联系信息暂时无法加载。</p>
          <button type="button" onClick={onRetry}>
            重新加载 <ArrowRight size={14} />
          </button>
        </div>
      ) : null}
      {!loading && !error && projects.length === 0 ? (
        <p className="public-site-state">
          新的作品正在准备中，欢迎先聊聊你的项目。
        </p>
      ) : null}
      <div className="project-grid">
        {projects.map((project, index) => (
          <button
            className="project-card"
            key={project.id}
            data-reveal
            style={{ "--reveal-delay": `${index * 70}ms` }}
            onClick={() => onSelect(project)}
            aria-label={`查看${project.title}${project.isDemo ? "演示项目" : "项目"}`}
          >
            <div className={`project-image ${project.tone}`}>
              <img
                src={project.image}
                alt={project.title + (project.isDemo ? "概念界面" : "项目界面")}
                loading="lazy"
                width="1536"
                height="1024"
              />
              <span className="project-view">
                <ArrowUpRight size={24} />
              </span>
            </div>
            <div className="project-meta">
              <span>{project.category}</span>
              <span>{project.isDemo ? "概念演示" : "项目案例"}</span>
            </div>
            <div className="project-title">
              <h3>{project.title}</h3>
              <ArrowUpRight size={23} strokeWidth={1.5} />
            </div>
            <p>{project.description}</p>
            <div className="project-highlights">
              {project.details.slice(0, 2).map((detail) => <span key={detail}><Check size={14} aria-hidden="true" />{detail}</span>)}
            </div>
            <div className="project-card-bottom">
              <span>{project.service}</span>
              <span>查看项目解析 <ArrowUpRight size={15} aria-hidden="true" /></span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section
      className="process-section section content-width"
      id="process"
      aria-labelledby="process-title"
    >
      <div className="section-heading">
        <div className="section-copy" data-reveal>
          <h2 id="process-title">好合作，从清晰开始。</h2>
        </div>
        <p className="heading-description">
          你专注业务，我负责技术。
          <br />
          从第一次沟通到上线，每一步都心中有数。
        </p>
      </div>
      <ol className="process-steps" aria-label="四步合作流程">
        {steps.map(([title, description, deliverable], index) => (
          <li
            className="process-step"
            key={title}
            data-reveal
            style={{ "--reveal-delay": `${index * 70}ms` }}
          >
            <div className="step-top">
              <span
                className="step-number"
                data-step-number={`0${index + 1}`}
                aria-hidden="true"
              />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <span className="step-deliverable"><span>交付物</span>{deliverable}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Contact({ onContact, settings }) {
  const [copyMessage, setCopyMessage] = useState("");
  async function copyWechat() {
    try {
      await navigator.clipboard.writeText(settings.wechat);
      setCopyMessage("微信号已复制");
    } catch {
      setCopyMessage(`微信号：${settings.wechat}`);
    }
  }
  return (
    <>
      <section className="contact-section" id="contact">
        <div className="contact-inner content-width">
          <h2 data-reveal>
            把想法，
            <br />
            变成下一件作品。
          </h2>
          <div className="contact-copy" data-reveal style={{ "--reveal-delay": "100ms" }}>
            <p data-reveal style={{ "--reveal-delay": "170ms" }}>
              无论是一个刚刚开始的想法，
              <br />
              还是已经成型的产品计划，都欢迎聊一聊。
            </p>
            <button className="button button-lime" onClick={onContact}>
              聊聊你的项目 <ArrowUpRight size={20} />
            </button>
            {settings.email || settings.wechat ? (
              <div className="public-contact-links">
                {settings.email ? (
                  <a href={`mailto:${settings.email}`}>
                    发送邮件 <ArrowUpRight size={13} />
                  </a>
                ) : null}
                {settings.wechat ? (
                  <button type="button" onClick={copyWechat}>
                    复制微信号：{settings.wechat}
                  </button>
                ) : null}
                {copyMessage ? <span role="status">{copyMessage}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <footer className="site-footer content-width" data-reveal>
        <Brand footer name={settings.studioName} />
        <p data-reveal style={{ "--reveal-delay": "70ms" }}>{settings.tagline}</p>
        <a className="public-admin-link" href="/admin">
          工作台
        </a>
        <span>
          © {new Date().getFullYear()} {settings.studioName}
        </span>
        <a href="#top" aria-label="回到顶部">
          <ArrowUpRight size={18} />
        </a>
      </footer>
    </>
  );
}

function WorkDialog({ project, onClose, onContact }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!project) return;
    const dialog = ref.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
    };
  }, [project]);
  if (!project) return null;
  return (
    <dialog
      ref={ref}
      className="work-dialog"
      aria-labelledby="work-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="work-dialog-header">
        <span>{project.isDemo ? "概念演示 / PROJECT EXPLORATION" : "精选作品 / PROJECT OVERVIEW"}</span>
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label="关闭项目详情"
        >
          <X size={21} />
        </button>
      </div>
      <div className="work-dialog-content">
        <div className={`work-dialog-preview ${project.tone}`}>
        <img
          className="work-dialog-image"
          src={project.image}
          alt={
            project.title + (project.isDemo ? "概念界面大图" : "项目界面大图")
          }
        />
        <span>{project.isDemo ? "界面概念预览" : "项目界面预览"}</span>
        </div>
        <div className="work-dialog-copy">
          <p className="work-dialog-category">{project.service}</p>
          <h2 id="work-dialog-title">{project.title}</h2>
          <h3 className="work-detail-label">项目目标</h3>
          <p>{project.description}</p>
          <h3 className="work-detail-label">{project.isDemo ? "界面与体验重点" : "项目亮点"}</h3>
          <ul>
            {project.details.map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
          <h3 className="work-detail-label">{project.isDemo ? "技术与产品方向" : "技术栈"}</h3>
          <div className="stack-tags">
            {project.stack.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {project.isDemo ? (
            <p className="demo-note">
              展示范围：界面概念与交互方向。此项目不代表真实客户案例或已上线产品，具体功能与开发范围需结合需求确认。
            </p>
          ) : null}
        </div>
      </div>
      <div className="work-dialog-footer">
          <p>有类似的业务场景？<span>从你的目标与核心功能聊起。</span></p>
          <div className="work-dialog-actions">
          {project.previewUrl ? (
            <a className="button button-lime" href={project.previewUrl} target="_blank" rel="noopener noreferrer" aria-label="在线体验（新标签页打开）">
              在线体验 <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          ) : null}
          <button
            className="button button-black"
            onClick={() => {
              onClose();
              onContact(project.service);
            }}
          >
            我也有类似想法 <ArrowUpRight size={18} />
          </button>
          </div>
      </div>
    </dialog>
  );
}

export default function App() {
  const [site, setSite] = useState({ settings: defaultSettings, projects: [] });
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [service, setService] = useState("网站开发");
  const [selectedProject, setSelectedProject] = useState(null);
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!targets.length) return undefined;

    const revealAll = () => targets.forEach((target) => target.classList.add("is-visible"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      revealAll();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setSiteLoading(true);
    setSiteError(false);
    async function loadSite() {
      try {
        const response = await fetch("/api/site", {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("无法加载站点内容");
        const data = await response.json();
        if (!data.settings || !Array.isArray(data.projects))
          throw new Error("站点内容格式错误");
        if (!controller.signal.aborted)
          setSite({
            settings: { ...defaultSettings, ...data.settings },
            projects: data.projects,
          });
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted)
          setSiteError(true);
      } finally {
        if (!controller.signal.aborted) setSiteLoading(false);
      }
    }
    loadSite();
    return () => controller.abort();
  }, [refreshKey]);
  useEffect(() => {
    document.title = `${site.settings.studioName} — 网站、小程序与 AI 应用开发`;
  }, [site.settings.studioName]);
  const openContact = (value) => {
    setService(typeof value === "string" ? value : "网站开发");
    setContactOpen(true);
  };
  return (
    <>
      <a href="#services" className="skip-link">
        跳转到主要内容
      </a>
      <main>
        <Hero onContact={openContact} studioName={site.settings.studioName} />
        <Services onContact={openContact} about={site.settings.about} />
        <Work
          onSelect={setSelectedProject}
          projects={site.projects}
          loading={siteLoading}
          error={siteError}
          onRetry={() => setRefreshKey((value) => value + 1)}
        />
        <Process />
        <Contact onContact={openContact} settings={site.settings} />
      </main>
      <ProjectDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        initialService={service}
        studioName={site.settings.studioName}
      />
      <WorkDialog
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onContact={openContact}
      />
    </>
  );
}
