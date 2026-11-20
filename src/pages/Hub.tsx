import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SiteFooter, SiteHeader, StatusPill } from '../components/Brand'
import { GARRI_SOCIAL, GARRI_TOKEN, isTokenConfigured } from '../config/garri'
import { QUEST_TEMPLATES } from '../fixtures/catalog'
import { claimQuest, fetchLeaderboard, fetchQuests, getSession, submitPlayerReport, type QuestProgress } from '../lib/auth'

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return <button className="btn btn-sm btn-ghost" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600) }}>{copied ? 'Copied' : 'Copy'}</button>
}
export default function Hub() {
  const tokenReady = isTokenConfigured()
  const [players, setPlayers] = useState<Array<{ user_id: string; display_name: string; xp: number; level: number; rank: number }>>([])
  const [leaderboardStatus, setLeaderboardStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [questState, setQuestState] = useState<{ revision: number; quests: QuestProgress[] } | null>(null)
  const [questStatus, setQuestStatus] = useState<'loading' | 'ready' | 'signed_out' | 'error'>(getSession() ? 'loading' : 'signed_out')
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null)
  const [questMessage, setQuestMessage] = useState('')
  const [reportCategory, setReportCategory] = useState<'abuse' | 'cheating' | 'impersonation' | 'scam' | 'other'>('other')
  const [reportTarget, setReportTarget] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  useEffect(() => { let active = true; fetchLeaderboard().then(data => { if (!active) return; setPlayers(data.players || []); setLeaderboardStatus(data.players?.length ? 'ready' : 'empty') }).catch(() => { if (active) setLeaderboardStatus('error') }); return () => { active = false } }, [])
  useEffect(() => { if (!getSession()) { setQuestStatus('signed_out'); return }; let active = true; fetchQuests().then(data => { if (active) { setQuestState(data); setQuestStatus('ready') } }).catch(() => { if (active) setQuestStatus('error') }); return () => { active = false } }, [])
  async function handlePlayerReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!getSession()) { setReportMessage('Sign in before submitting a report.'); return }
    setReportBusy(true); setReportMessage('')
    try {
      await submitPlayerReport({ category: reportCategory, details: reportDetails, ...(reportTarget.trim() ? { targetUserId: reportTarget.trim() } : {}) })
      setReportDetails(''); setReportTarget(''); setReportMessage('Your report has been sent to the moderation team.')
    } catch (error) { setReportMessage(error instanceof Error ? error.message.replaceAll('_', ' ') : 'Report could not be submitted.') }
    finally { setReportBusy(false) }
  }
  async function handleQuestClaim(quest: QuestProgress) {
    if (!questState || claimingQuest) return
    setClaimingQuest(quest.id); setQuestMessage('')
    try {
      await claimQuest(quest.id, quest.periodKey, questState.revision)
      const latest = await fetchQuests(); setQuestState(latest); setQuestMessage('Quest reward saved to your account.')
    } catch (error) { setQuestMessage(error instanceof Error ? error.message.replaceAll('_', ' ') : 'Quest claim failed.') }
    finally { setClaimingQuest(null) }
  }
  return (
    <div className="page">
      <SiteHeader />
      <section className="hub-head"><p className="eyebrow">GARRI ecosystem</p><h1>Token &amp; Community Hub</h1><p className="lede">Everything official in one place. Anything not yet confirmed by the GARRI team is clearly marked — we never show placeholder addresses, balances or verifications.</p></section>
      <div className="hub-grid">
        <section className="card token-card"><div className="card-top"><h2>{GARRI_TOKEN.symbol}</h2><StatusPill state={tokenReady ? 'live' : 'pending'} /></div>
          <dl className="kv"><dt>Network</dt><dd>{GARRI_TOKEN.network}</dd><dt>Contract address</dt><dd className="addr">{tokenReady ? <><code>{GARRI_TOKEN.mintAddress}</code><CopyAddress value={GARRI_TOKEN.mintAddress} /></> : <span className="muted">Awaiting official confirmation from the GARRI team</span>}</dd><dt>Chain ID</dt><dd>{GARRI_TOKEN.chainId}</dd><dt>Your balance</dt><dd className="muted">Robinhood Chain EVM wallet connection and live balance reads are being integrated.</dd><dt>Transactions</dt><dd><a href={GARRI_TOKEN.explorerUrl} target="_blank" rel="noreferrer">View verified $GARRI transactions and holders</a></dd></dl>
          <a className="btn btn-primary btn-lg btn-block" href={GARRI_TOKEN.explorerUrl} target="_blank" rel="noreferrer">VIEW $GARRI ON ROBINHOOD CHAIN</a>
          <p className="fine">Verify the contract address and network before interacting with $GARRI.</p>
        </section>
        <section className="card"><div className="card-top"><h2>Official channels</h2></div><div className="social-list">
          <a href={GARRI_SOCIAL.x.url} target="_blank" rel="noreferrer" className="social"><span className="social-ico">𝕏</span><span><strong>{GARRI_SOCIAL.x.handle}</strong><small>News, drops and seasonal competitions</small></span></a>
          <a href={GARRI_SOCIAL.telegram.url} target="_blank" rel="noreferrer" className="social"><span className="social-ico tg">✈</span><span><strong>{GARRI_SOCIAL.telegram.handle}</strong><small>Community chat and support</small></span></a>
          {GARRI_SOCIAL.website ? <a href={GARRI_SOCIAL.website} target="_blank" rel="noreferrer" className="social"><span className="social-ico web">◎</span><span><strong>Website</strong><small>{GARRI_SOCIAL.website}</small></span></a> : null}
        </div><h3 className="sub">Social quests</h3><ul className="task-list"><li><span>Follow {GARRI_SOCIAL.x.handle}</span><StatusPill state="pending" /></li><li><span>Join {GARRI_SOCIAL.telegram.handle}</span><StatusPill state="pending" /></li></ul><p className="fine">Social verification remains locked until approved X API access and the GARRI Telegram membership bot are connected.</p></section>
        <section className="card wide"><div className="card-top"><h2>How rewards are separated</h2></div><div className="tiers">
          <div className="tier"><h3>XP &amp; levels</h3><p>Earned from every farming and factory action. Playable now in the village.</p><StatusPill state="preview" /></div>
          <div className="tier"><h3>In-game resources</h3><p>Stems, roots, garri bags and in-game naira (₦). No cash value, never withdrawable.</p><StatusPill state="preview" /></div>
          <div className="tier locked"><h3>Real $GARRI rewards</h3><p>Team approval has been reported. Payouts remain disabled until the exact approved contract, tokenomics, eligibility rules, audit and payout operations are configured.</p><StatusPill state="pending" /></div>
        </div></section>
        <section className="card"><div className="card-top"><h2>Quests</h2><StatusPill state={questStatus === 'ready' ? 'live' : questStatus === 'loading' ? 'preview' : 'pending'} /></div>
          {questStatus === 'ready' && questState ? <ul className="quest-list">{questState.quests.map(q => <li key={q.id}><span className={`cad cad-${q.cadence}`}>{q.cadence}</span><div><strong>{q.title}</strong><small>{q.progress}/{q.target} complete · {q.reward.xp} XP{q.reward.stems ? ` · ${q.reward.stems} stems` : ''}</small><div className="xpbar"><i style={{ width: `${Math.min(100, q.progress / q.target * 100)}%` }} /></div></div><button className="btn btn-sm btn-primary" disabled={q.claimed || q.progress < q.target || Boolean(claimingQuest)} onClick={() => handleQuestClaim(q)}>{q.claimed ? 'Claimed' : claimingQuest === q.id ? 'Claiming…' : 'Claim'}</button></li>)}</ul>
          : <ul className="quest-list">{QUEST_TEMPLATES.map(q => <li key={q.id}><span className={`cad cad-${q.cadence}`}>{q.cadence}</span><div><strong>{q.title}</strong><small>{q.goal} · {q.reward}</small></div></li>)}</ul>}
          {questMessage && <p className="fine" role="status">{questMessage}</p>}
          {questStatus === 'signed_out' && <p className="fine">Sign in to track server-verified progress and claim XP rewards. No progress is fabricated.</p>}
          {questStatus === 'error' && <p className="fine">Quest service is not reachable. Try again after the backend is deployed and migration 0005 is applied.</p>}
        </section>
        <section className="card"><div className="card-top"><h2>Global leaderboard</h2><StatusPill state={leaderboardStatus === 'ready' ? 'live' : leaderboardStatus === 'loading' ? 'preview' : 'pending'} /></div>
          {leaderboardStatus === 'ready' ? <ol className="leaderboard-list">{players.map(p => <li key={p.user_id}><span className="leader-rank">#{p.rank}</span><span className="leader-name">{p.display_name}</span><span className="leader-score">Lv {p.level} · {p.xp} XP</span></li>)}</ol> : <div className="empty"><p>{leaderboardStatus === 'loading' ? 'Loading rankings…' : leaderboardStatus === 'error' ? 'Leaderboard is temporarily unavailable.' : 'No rankings yet.'}</p><small>Only registered players with server-verified actions appear here.</small></div>}
          <Link to="/" className="btn btn-ghost btn-block">Farmer account</Link><Link to="/play" className="btn btn-ghost btn-block">Practise in the village</Link>
        </section>
        <section className="card"><div className="card-top"><h2>NFT gallery</h2><StatusPill state="pending" /></div><div className="nft-kinds">{['Characters', 'Land', 'Vehicles', 'Equipment', 'Achievements'].map(k => <span key={k}>{k}</span>)}</div><div className="empty"><p>Your NFTs will show here.</p><small>Ownership is read from the chain for your signed-in wallet. No sample or placeholder NFTs are shown.</small></div></section>
      </div>
      <section className="card report-card">
        <div className="card-top"><h2>Report a player or issue</h2><StatusPill state="live" /></div>
        <p className="fine">Reports are reviewed by the GARRIVERSE moderation team. Do not include passwords, private keys or recovery phrases.</p>
        <form className="report-form" onSubmit={handlePlayerReport}>
          <label>Report category<select value={reportCategory} onChange={e => setReportCategory(e.target.value as typeof reportCategory)}><option value="other">Other</option><option value="abuse">Abuse or harassment</option><option value="cheating">Cheating</option><option value="impersonation">Impersonation</option><option value="scam">Scam or suspicious activity</option></select></label>
          <label>Player user ID (optional)<input value={reportTarget} onChange={e => setReportTarget(e.target.value)} placeholder="Paste the player's account ID if known" /></label>
          <label>What happened?<textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} minLength={10} maxLength={2000} required rows={4} placeholder="Describe the issue clearly (10–2000 characters)." /></label>
          <button className="btn btn-primary" type="submit" disabled={reportBusy || reportDetails.trim().length < 10}>{reportBusy ? 'Sending…' : 'Submit report'}</button>
          {reportMessage && <p className="fine" role="status">{reportMessage}</p>}
        </form>
      </section>
      <div className="hub-staff-link"><Link to="/moderator">Moderator Office · Staff access</Link></div>
      <SiteFooter />
    </div>
  )
}
