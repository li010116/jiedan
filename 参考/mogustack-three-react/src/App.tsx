import MoguHero3D from './components/MoguHero3D'
import './styles/demo.css'

const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export default function App() {
  return (
    <main>
      <section className="hero-shell" id="top">
        <div className="hero-geometry-bg" aria-hidden="true" />
        <div className="hero-content">
          <header className="site-nav">
            <a className="wordmark" href="#top" aria-label="MOGUSTACK 首页">MOGUSTACK<span>.</span></a>
            <nav aria-label="网站导航">
              <a href="#services">服务能力</a>
              <a href="#works">精选作品</a>
              <a href="#process">合作流程</a>
            </nav>
            <a href="#contact" className="nav-cta">聊聊你的项目 <span aria-hidden="true">↗</span></a>
          </header>
          <div className="hero-row">
            <div className="hero-copy">
              <h1>让你的想法，<br />真正上线。</h1>
              <p className="eyebrow">GOOD IDEAS. GREAT CODE.</p>
              <p className="support">从第一行代码，到产品正式上线。</p>
              <p className="support-muted">独立开发，认真对待每一个好想法。</p>
              <div className="hero-actions">
                <a href="#contact" className="primary-btn">聊聊你的项目 <span aria-hidden="true">↗</span></a>
                <button className="round-btn" type="button" aria-label="向下探索" onClick={() => scrollToSection('services')}>↓</button>
              </div>
            </div>
            {/* ONLY the right-side red-box area is replaced by the React 3D component. */}
            <div className="hero-right">
              <MoguHero3D accent="#D4FF56" autoMotion mouseParallax maxPixelRatio={1.8} />
            </div>
          </div>
        </div>
        <button className="scroll-cue" type="button" aria-label="向下探索" onClick={() => scrollToSection('services')}>
          <span className="scroll-eyebrow">EXPLORE MORE</span>
          <span className="scroll-arrow">↓</span>
          <span className="scroll-small">向下探索</span>
        </button>
      </section>
      {/* Demo-only placeholders. These are NOT meant to overwrite your existing site. */}
      <div className="below-content">
        <section className="placeholder-section" id="services"><span className="section-index">01 / SERVICES</span><h2>服务能力</h2><p>本页仅用于独立预览。集成时仅拷贝 MoguHero3D.tsx 到现有项目。</p></section>
        <section className="placeholder-section" id="works"><span className="section-index">02 / WORKS</span><h2>精选作品</h2></section>
        <section className="placeholder-section" id="process"><span className="section-index">03 / PROCESS</span><h2>合作流程</h2></section>
        <section className="placeholder-section" id="contact"><span className="section-index">04 / CONTACT</span><h2>项目咨询</h2><p>演示页占位区；实际项目保留你原有的联系方式。</p></section>
      </div>
    </main>
  )
}
