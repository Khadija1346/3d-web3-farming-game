import { Link, NavLink } from 'react-router-dom'
import { GARRI_SOCIAL } from '../config/garri'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="GARRI: Rise of the Town home">
      <span className="logo-mark">G</span>
      <span className="logo-text">
        GARRI<small>Rise of the Town</small>
      </span>
    </Link>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <Logo />
      <nav>
        <NavLink to="/hub">Token &amp; Community</NavLink>
        <a href={GARRI_SOCIAL.x.url} target="_blank" rel="noreferrer">
          X
        </a>
        <NavLink to="/play" className="btn btn-sm btn-primary">
          Play now
        </NavLink>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Logo />
      <p>A Nigerian farming town, built in the open. In-game naira and XP have no cash value.</p>
      <div className="footer-links">
        <a href={GARRI_SOCIAL.x.url} target="_blank" rel="noreferrer">
          X {GARRI_SOCIAL.x.handle}
        </a>
        <a href={GARRI_SOCIAL.telegram.url} target="_blank" rel="noreferrer">
          Telegram {GARRI_SOCIAL.telegram.handle}
        </a>
        {GARRI_SOCIAL.website && (
          <a href={GARRI_SOCIAL.website} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
      </div>
    </footer>
  )
}

export function StatusPill({ state }: { state: 'live' | 'preview' | 'pending' }) {
  const label = { live: 'Live', preview: 'Playable preview', pending: 'Pending setup' }[state]
  return <span className={`pill pill-${state}`}>{label}</span>
}

export const cdn = (file: string, w: number) => `/.netlify/images?url=/img/${file}&w=${w}&fm=webp`
