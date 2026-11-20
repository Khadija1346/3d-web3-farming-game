import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession, fetchModeratorOffice, submitModeratorAction, type ModeratorOfficeData, type ModeratorReport } from '../lib/auth'

function dateLabel(value: string) {
  return new Date(value).toLocaleString()
}

export default function ModeratorOffice() {
  const [data, setData] = useState<ModeratorOfficeData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed_out' | 'forbidden' | 'error'>(
    getSession() ? 'loading' : 'signed_out',
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const refresh = useCallback(async () => {
    if (!getSession()) { setStatus('signed_out'); return }
    setStatus('loading')
    try {
      const result = await fetchModeratorOffice()
      setData(result)
      setStatus('ready')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'request_failed'
      setStatus(reason === 'moderator_access_required' ? 'forbidden' : 'error')
      setMessage(reason.replaceAll('_', ' '))
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const suspensions = useMemo(() => new Map((data?.suspensions || []).map(s => [s.user_id, s])), [data])
  const filteredPlayers = useMemo(() => (data?.players || []).filter(player =>
    player.display_name.toLowerCase().includes(search.toLowerCase()) || player.user_id.toLowerCase().includes(search.toLowerCase()),
  ), [data, search])
  const isAdmin = Boolean(data?.staff.roles.includes('admin'))
  const canModerateReports = Boolean(data?.staff.roles.some(role => role === 'admin' || role === 'moderator'))

  async function act(key: string, payload: Parameters<typeof submitModeratorAction>[0]) {
    setBusy(key); setMessage('')
    try {
      await submitModeratorAction(payload)
      setMessage('Action saved and added to the audit log.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message.replaceAll('_', ' ') : 'Action failed.')
    } finally { setBusy(null) }
  }
  function reportAction(report: ModeratorReport, action: 'review_report' | 'resolve_report' | 'dismiss_report') {
    const reason = window.prompt('Add a short reason for the audit log:')
    if (!reason?.trim()) return
    void act(report.id, { action, reportId: report.id, reason: reason.trim() })
  }
  function playerAction(userId: string, suspended: boolean) {
    const reason = window.prompt(suspended ? 'Reason for unsuspending this player:' : 'Reason for suspending this player:')
    if (!reason?.trim()) return
    void act(userId, {
      action: suspended ? 'unsuspend_player' : 'suspend_player',
      targetUserId: userId,
      reason: reason.trim(),
      suspensionHours: 24 * 7,
    })
  }

  return (
    <main className="moderator-page">
      <header className="moderator-header">
        <Link to="/" className="moderator-brand"><span>G</span><span>GARRIVERSE<small>MODERATOR OFFICE</small></span></Link>
        <nav><Link to="/play">Village</Link><Link to="/hub">Community hub</Link><button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>Refresh</button></nav>
      </header>
      <section className="moderator-intro">
        <p className="eyebrow">Staff workspace</p>
        <h1>Moderator Office</h1>
        <p className="muted">Review player reports, manage account suspensions and keep a traceable record of staff actions.</p>
      </section>
      {status === 'signed_out' && <section className="moderator-notice"><h2>Sign in required</h2><p>Sign in with your GARRIVERSE staff account to continue.</p><Link className="btn btn-primary" to="/">Go to sign in</Link></section>}
      {status === 'forbidden' && <section className="moderator-notice"><h2>Staff access not assigned</h2><p>Your account is signed in, but it does not have an active Moderator Office role yet. An administrator must assign your role securely.</p></section>}
      {status === 'error' && <section className="moderator-notice"><h2>Office unavailable</h2><p>{message || 'The moderator service could not be reached.'}</p><button className="btn btn-primary" onClick={() => void refresh()}>Try again</button></section>}
      {status === 'loading' && <p className="moderator-loading">Loading secure staff workspace…</p>}
      {status === 'ready' && data && <>
        <div className="moderator-meta"><span>Signed in staff ID: <code>{data.staff.userId.slice(0, 8)}…</code></span><span>Role: <strong>{data.staff.roles.join(', ')}</strong></span></div>
        <section className="moderator-stats">
          <article><span>Open reports</span><strong>{data.summary.openReports}</strong></article>
          <article><span>In review</span><strong>{data.summary.inReview}</strong></article>
          <article><span>Registered players</span><strong>{data.summary.totalPlayers}</strong></article>
          <article><span>Recent actions</span><strong>{data.summary.recentActions}</strong></article>
        </section>
        {message && <p className="moderator-message" role="status">{message}</p>}
        <section className="moderator-panel">
          <div className="moderator-panel-head"><div><p className="eyebrow">Player safety</p><h2>Report queue</h2></div><span>{data.reports.length} recent</span></div>
          {data.reports.length === 0 ? <p className="moderator-empty">No player reports have been submitted.</p> : <div className="moderator-table-wrap"><table className="moderator-table"><thead><tr><th>Report</th><th>Details</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>
            {data.reports.map(report => <tr key={report.id}><td><strong>{report.category}</strong><small>{report.id.slice(0, 8)}…</small>{report.target_user_id && <small>Target: {report.target_user_id.slice(0, 8)}…</small>}</td><td className="moderator-details">{report.details}</td><td><span className={'moderator-status status-' + report.status}>{report.status.replace('_', ' ')}</span></td><td>{dateLabel(report.created_at)}</td><td><div className="moderator-actions">{canModerateReports && report.status === 'open' && <button disabled={busy === report.id} onClick={() => reportAction(report, 'review_report')}>Review</button>}{canModerateReports && report.status !== 'resolved' && report.status !== 'dismissed' && <><button disabled={busy === report.id} onClick={() => reportAction(report, 'resolve_report')}>Resolve</button><button disabled={busy === report.id} onClick={() => reportAction(report, 'dismiss_report')}>Dismiss</button></>}</div></td></tr>)}
          </tbody></table></div>}
        </section>
        <section className="moderator-panel">
          <div className="moderator-panel-head"><div><p className="eyebrow">Account controls</p><h2>Player management</h2></div><input aria-label="Search players" placeholder="Search name or user ID" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="moderator-player-list">{filteredPlayers.map(player => {
            const state = suspensions.get(player.user_id)
            const activeSuspension = Boolean(state?.suspended_until && new Date(state.suspended_until).getTime() > Date.now())
            return <article key={player.user_id}><div><strong>{player.display_name}</strong><small>{player.user_id}</small><small>Level {player.level} · {player.xp} XP</small>{activeSuspension && <em>Suspended until {dateLabel(state!.suspended_until!)}</em>}</div>{isAdmin && <button className="btn btn-sm btn-ghost" disabled={busy === player.user_id} onClick={() => playerAction(player.user_id, activeSuspension)}>{activeSuspension ? 'Unsuspend' : 'Suspend 7 days'}</button>}</article>
          })}{filteredPlayers.length === 0 && <p className="moderator-empty">No players match that search.</p>}</div>
          {!isAdmin && <p className="fine">Player suspension controls are restricted to administrators.</p>}
        </section>
        <section className="moderator-panel">
          <div className="moderator-panel-head"><div><p className="eyebrow">Accountability</p><h2>Recent audit log</h2></div></div>
          {data.actions.length === 0 ? <p className="moderator-empty">No moderation actions recorded yet.</p> : <ol className="moderator-audit">{data.actions.map(item => <li key={item.id}><strong>{item.action.replaceAll('_', ' ')}</strong><span>{item.reason}</span><small>{dateLabel(item.created_at)} · Staff {item.actor_user_id.slice(0, 8)}…</small></li>)}</ol>}
        </section>
      </>}
      <footer className="moderator-footer">GARRIVERSE · Staff actions are permission-checked and audit-logged on the server.</footer>
    </main>
  )
}
