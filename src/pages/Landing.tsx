import { Link } from 'react-router-dom'
import { SiteFooter, SiteHeader, StatusPill, cdn } from '../components/Brand'
import AccountPanel from '../components/AccountPanel'
import { FACTORY_STAGES, INTEGRATIONS } from '../fixtures/catalog'

const LOOP = [
  { n: '01', title: 'Plant', body: 'Clear the bush, till ridges and set cassava stems — by hand or with the tractor.' },
  { n: '02', title: 'Grow', body: 'Haul water from the borehole, pull weeds and watch for rain. Neglect slows the crop.' },
  { n: '03', title: 'Process', body: 'Carry roots to the factory and work all eight stages from peeling to frying.' },
  { n: '04', title: 'Trade', body: 'Store bags in the warehouse and sell at Oja market to grow your farm.' },
]

export default function Landing() {
  return (
    <div className="page">
      <SiteHeader />
      <section className="hero">
        <img className="hero-img" src={cdn('hero.png', 1800)} srcSet={`${cdn('hero.png', 900)} 900w, ${cdn('hero.png', 1800)} 1800w`} sizes="100vw" alt="A young farmer holding fresh cassava in a golden-hour Nigerian village with a red tractor and a garri kitchen" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">A 3D Nigerian farming town</p>
          <h1>GARRI<span>Rise of the Town</span></h1>
          <p className="lede">Plant cassava, drive the tractor, fry garri over firewood and build your name in a living village — on your phone or desktop, with real Web3 ownership on the way.</p>
          <div className="hero-cta">
            <Link to="/play" className="btn btn-primary btn-lg">Enter the village</Link>
            <Link to="/hub" className="btn btn-ghost btn-lg">$GARRI &amp; community</Link>
          </div>
          <p className="hero-note">Free to play in your browser · No wallet needed to farm</p>
        </div>
      </section>
      <AccountPanel />
      <section className="section">
        <div className="section-head"><p className="eyebrow">The loop</p><h2>From bush to bag of garri</h2></div>
        <div className="loop-grid">{LOOP.map(s => <article key={s.n} className="loop-card"><span className="loop-n">{s.n}</span><h3>{s.title}</h3><p>{s.body}</p></article>)}</div>
      </section>
      <section className="section factory-section">
        <img className="factory-img" src={cdn('factory.png', 900)} loading="lazy" alt="Workers frying and sieving garri inside a village processing workshop" />
        <div><p className="eyebrow">The factory</p><h2>Eight real stages. No shortcuts.</h2><p className="muted">Garri is made the way it is in Nigerian towns: every batch moves through each step in order, and fermentation takes its time.</p>
          <ol className="stage-list">{FACTORY_STAGES.map((s, i) => <li key={s.id}><b>{String(i + 1).padStart(2, '0')}</b><span><strong>{s.label}</strong> — {s.detail}</span></li>)}</ol>
        </div>
      </section>
      <section className="section">
        <div className="section-head"><p className="eyebrow">Built honestly</p><h2>What’s live, and what’s coming</h2><p className="muted narrow">Balances, NFTs, rankings and social checks only appear once they are backed by real services. Until then you’ll see exactly where each piece stands.</p></div>
        <ul className="status-list">{INTEGRATIONS.map(i => <li key={i.name}><div><strong>{i.name}</strong><span>{i.note}</span></div><StatusPill state={i.state} /></li>)}</ul>
      </section>
      <section className="section embed-band">
        <div><p className="eyebrow">For the Asta DAO app</p><h2>One module, embeddable anywhere</h2><p className="muted">The village runs as a self-contained web module at <code>/embed</code> — full-screen, touch-first and ready to wrap with Capacitor. It talks to its host through documented window messages, never private APIs.</p></div>
        <Link to="/embed" className="btn btn-ghost btn-lg">Open embed view</Link>
      </section>
      <SiteFooter />
    </div>
  )
}
