import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteFooter, SiteHeader, StatusPill } from '../components/Brand'
import { GARRI_SOCIAL, GARRI_TOKEN, isBuyLinkConfigured, isTokenConfigured } from '../config/garri'
import { QUEST_TEMPLATES } from '../fixtures/catalog'
import { fetchLeaderboard } from '../lib/auth'

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return <button className="btn btn-sm btn-ghost" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600) }}>{copied ? 'Copied' : 'Copy'}</button>
}
export default function Hub() {
  const tokenReady = isTokenConfigured(), buyReady = isBuyLinkConfigured()
  const [players, setPlayers] = useState<Array<{ user_id: string; display_name: string; xp: number; level: number; rank: number }>>([])
  const [leaderboardStatus, setLeaderboardStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  useEffect(() => { let active = true; fetchLeaderboard().then(data => { if (!active) return; setPlayers(data.players || []); setLeaderboardStatus(data.players?.length ? 'ready' : 'empty') }).catch(() => { if (active) setLeaderboardStatus('error') }); return () => { active = false } }, [])
  return (
    <div className="page">
      <SiteHeader />
      <section className="hub-head"><p className="eyebrow">GARRI ecosystem</p><h1>Token &amp; Community Hub</h1><p className="lede">Everything official in one place. Anything not yet confirmed by the GARRI team is clearly marked — we never show placeholder addresses, balances or verifications.</p></section>
      <div className="hub-grid">
        <section className="card token-card"><div className="card-top"><h2>{GARRI_TOKEN.symbol}</h2><StatusPill state={tokenReady ? 'live' : 'pending'} /></div>
          <dl className="kv"><dt>Network</dt><dd>{GARRI_TOKEN.network}</dd><dt>Mint address</dt><dd className="addr">{tokenReady ? <><code>{GARRI_TOKEN.mintAddress}</code><CopyAddress value={GARRI_TOKEN.mintAddress} /></> : <span className="muted">Awaiting official confirmation from the GARRI team</span>}</dd><dt>Your balance</dt><dd className="muted">Connect a wallet with a signed message — arriving with wallet sign-in</dd><dt>Transactions</dt><dd className="muted">Available after the official mint address and Solana asset data source are configured</dd></dl>
          {buyReady ? <a className="btn btn-primary btn-lg btn-block" href={GARRI_TOKEN.pumpFunUrl} target="_blank" rel="noreferrer">BUY $GARRI on Pump.fun</a> : <button className="btn btn-primary btn-lg btn-block" disabled>BUY $GARRI — link pending</button>}
          <p className="fine">Always check the mint address against official GARRI channels before buying.</p>
        </section>
        <section className="card"><div className="card-top"><h2>Official channels</h2></div><div className="social-list">
          <a href={GARRI_SOCIAL.x.url} target="_blank" rel="noreferrer" className="social"><span className="social-ico">𝕏</span><span><strong>{GARRI_SOCIAL.x.handle}</strong><small>News, drops and seasonal competitions</small></span></a>
          <a href={GARRI_SOCIAL.telegram.url} target="_blank" rel="noreferrer" className="social"><span className="social-ico tg">✈</span><span><strong>{GARRI_SOCIAL.telegram.handle}</strong><small>Community chat and support</small></span></a>
          {GARRI_SOCIAL.website ? <a href={GARRI_SOCIAL.website} target="_blank" rel="noreferrer" className="social"><span className="social-ico web">◎</span><span><strong>Website</strong><small>{GARRI_SOCIAL.website}</small></span></a> : null}
        </div><h3 className="sub">Social quests</h3><ul className="task-list"><li><span>Follow {GARRI_SOCIAL.x.handle}</span><StatusPill state="pending" /></li><li><span>Join {GARRI_SOCIAL.telegram.handle}</span><StatusPill state="pending" /></li></ul><p className="fine">Rewards for these unlock with X sign-in and the GARRI Telegram bot, so every completion is genuinely checked.</p></section>
        <section className="card wide"><div className="card-top"><h2>How rewards are separated</h2></div><div className="tiers">
          <div className="tier"><h3>XP &amp; levels</h3><p>Earned from every farming and factory action. Playable now in the village.</p><StatusPill state="preview" /></div>
          <div className="tier"><h3>In-game resources</h3><p>Stems, roots, garri bags and in-game naira (₦). No cash value, never withdrawable.</p><StatusPill state="preview" /></div>
          <div className="tier locked"><h3>Real $GARRI rewards</h3><p>Off until the GARRI team approves contracts, tokenomics and eligibility. Every future payout will be recorded in an auditable ledger.</p><StatusPill state="pending" /></div>
        </div></section>
        <section className="card"><div className="card-top"><h2>Quests</h2><StatusPill state="pending" /></div><ul className="quest-list">{QUEST_TEMPLATES.map(q => <li key={q.id}><span className={`cad cad-${q.cadence}`}>{q.cadence}</span><div><strong>{q.title}</strong><small>{q.goal} · {q.reward}</small></div></li>)}</ul><p className="fine">Quest progress is tracked on the server once accounts launch, so claims can’t be duplicated.</p></section>
        <section className="card"><div className="card-top"><h2>Global leaderboard</h2><StatusPill state={leaderboardStatus === 'ready' ? 'live' : leaderboardStatus === 'loading' ? 'preview' : 'pending'} /></div>
          {leaderboardStatus === 'ready' ? <ol className="leaderboard-list">{players.map(p => <li key={p.user_id}><span className="leader-rank">#{p.rank}</span><span className="leader-name">{p.display_name}</span><span className="leader-score">Lv {p.level} · {p.xp} XP</span></li>)}</ol> : <div className="empty"><p>{leaderboardStatus === 'loading' ? 'Loading rankings…' : leaderboardStatus === 'error' ? 'Leaderboard is temporarily unavailable.' : 'No rankings yet.'}</p><small>Only real registered players appear here. XP rankings will populate when verified game actions are enabled.</small></div>}
          <Link to="/" className="btn btn-ghost btn-block">Farmer account</Link><Link to="/play" className="btn btn-ghost btn-block">Practise in the village</Link>
        </section>
        <section className="card"><div className="card-top"><h2>NFT gallery</h2><StatusPill state="pending" /></div><div className="nft-kinds">{['Characters', 'Land', 'Vehicles', 'Equipment', 'Achievements'].map(k => <span key={k}>{k}</span>)}</div><div className="empty"><p>Your NFTs will show here.</p><small>Ownership is read from the chain for your signed-in wallet. No sample or placeholder NFTs are shown.</small></div></section>
      </div>
      <SiteFooter />
    </div>
  )
}
