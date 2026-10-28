import MoguCopperRibbon from './components/MoguCopperRibbon'

/** Demo shell ONLY. The actual component renders solely the right-side sculpture. */
export default function App() {
  return (
    <>
      <main className="hero-shell">
        <header className="header site-width">
          <a href="#home" className="wordmark">MOGUSTACK<span>.</span></a>
          <nav className="nav" aria-label="主导航">
            <a href="#services">服务能力</a>
            <a href="#works">精选作品</a>
            <a href="#process">合作流程</a>
          </nav>
          <a className="header-contact" href="#below">聊聊你的项目 ↗</a>
        </header>
        <div className="hero-content site-width" id="home">
          <section className="hero-copy">
            <h1>让你的想法，<br />真正上线。</h1>
            <p className="eyebrow">GOOD IDEAS. GREAT CODE.</p>
            <p className="primary">从第一行代码，到产品正式上线。</p>
            <p className="secondary">独立开发，认真对待每一个好想法。</p>
            <div className="hero-actions">
              <a className="button-lime" href="#below">聊聊你的项目 <span>↗</span></a>
              <a className="button-scroll" href="#below" aria-label="向下探索">↓</a>
            </div>
          </section>
          <div className="hero-right">
            <MoguCopperRibbon fallbackSrc="/ribbon-fallback.webp" />
          </div>
        </div>
        <div className="hero-scallop" aria-hidden="true" />
        <a className="explore" href="#below"><small>EXPLORE MORE</small><strong>↓</strong><small>向下探索</small></a>
      </main>
      <section id="below" className="below"><span>右侧 Three.js 动态视觉集成示例</span></section>
    </>
  )
}
