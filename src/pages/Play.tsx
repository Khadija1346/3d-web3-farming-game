import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Joystick } from '../components/Joystick'
import { FactoryPanel, MarketPanel, WarehousePanel } from '../components/Panels'
import { GameStore, xpForLevel } from '../game/state'
import { GarriWorld, PLOT_COUNT } from '../game/World'
import { postToHost } from '../embed/bridge'

const fmtTime = (t: number) => {
  const h = Math.floor(t)
  const m = Math.floor((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function Play({ embed = false }: { embed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<GarriWorld | null>(null)
  const store = useMemo(() => new GameStore(PLOT_COUNT), [])
  const s = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [help, setHelp] = useState(true)
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let world: GarriWorld | null = null
    try {
      world = new GarriWorld(canvas, store, touch)
      worldRef.current = world
      world.scene.executeWhenReady(() => {
        setReady(true)
        postToHost({ type: 'garri:ready', version: 1 })
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL is not available on this device')
    }
    return () => {
      world?.dispose()
      worldRef.current = null
    }
  }, [store, touch])

  useEffect(() => {
    if (s.level > 1) postToHost({ type: 'garri:level', level: s.level })
  }, [s.level])

  const w = () => worldRef.current
  const nextXp = xpForLevel(s.level)
  const isNight = s.timeOfDay < 6 || s.timeOfDay > 19

  return (
    <div className={`game ${embed ? 'is-embed' : ''}`}>
      <canvas ref={canvasRef} className="game-canvas" />

      {!ready && !error && (
        <div className="boot">
          <div className="boot-mark">G</div>
          <p>Building GARRI Town…</p>
        </div>
      )}
      {error && (
        <div className="boot">
          <p>Your device couldn’t start 3D graphics.</p>
          <small>{error}</small>
        </div>
      )}

      {/* top bar */}
      <div className="hud-top">
        <div className="hud-player">
          <span className="lvl">{s.level}</span>
          <div>
            <strong>Farmer</strong>
            <div className="xpbar">
              <i style={{ width: `${(s.xp / nextXp) * 100}%` }} />
            </div>
            <small>
              {s.xp}/{nextXp} XP
            </small>
          </div>
        </div>
        <div className="hud-clock">
          <span>{s.weather === 'rain' ? '🌧' : isNight ? '🌙' : '☀'}</span>
          <div>
            <strong>{fmtTime(s.timeOfDay)}</strong>
            <small>Day {s.day}</small>
          </div>
          {!embed && (
            <Link to="/" className="icon-btn" aria-label="Leave game">
              ⌂
            </Link>
          )}
        </div>
      </div>

      <div className="hud-inv">
        <span title="Cassava stems">🌱 {s.stems}</span>
        <span title="Cassava roots">🥔 {s.roots}</span>
        <span title="Garri bags carried">🛍 {s.garriCarried}</span>
        <span title="Garri bags in warehouse">🏬 {s.garriStored}</span>
        <span title="Watering can">💧 {s.waterCan}/5</span>
        <span title="In-game naira (no cash value)">₦{s.naira.toLocaleString()}</span>
      </div>

      <div className="preview-badge" title="Progress is kept only in this tab until accounts launch">
        Preview session
      </div>

      <div className="toasts">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* desktop prompt */}
      {s.prompt && !touch && (
        <div className={`prompt ${s.prompt.disabled ? 'is-info' : ''}`}>
          {!s.prompt.disabled && <kbd>E</kbd>}
          <div>
            <strong>{s.prompt.label}</strong>
            {s.prompt.sub && <small>{s.prompt.sub}</small>}
          </div>
        </div>
      )}
      {!touch && (s.nearVehicle || s.vehicle) && (
        <div className="prompt prompt-2">
          <kbd>F</kbd>
          <strong>{s.vehicle ? `Leave the ${s.vehicle === 'tanker' ? 'water tanker' : 'tractor'}` : `Drive the ${s.nearVehicle === 'tanker' ? 'water tanker' : 'tractor'}`}</strong>
        </div>
      )}

      {/* touch controls */}
      {touch && (
        <>
          <Joystick onMove={(x, y) => w()?.setTouchMove(x, y)} />
          <div className="touch-actions">
            {s.prompt && (
              <button className="act act-main" disabled={s.prompt.disabled} onClick={() => w()?.interact()}>
                <strong>{s.prompt.label}</strong>
                {s.prompt.sub && <small>{s.prompt.sub}</small>}
              </button>
            )}
            <div className="act-row">
              {(s.nearVehicle || s.vehicle) && (
                <button className="act act-round" onClick={() => w()?.toggleVehicle()}>
                  {s.vehicle ? 'Exit' : 'Drive'}
                </button>
              )}
              {!s.vehicle && (
                <button
                  className="act act-round"
                  onPointerDown={() => w()?.setSprint(true)}
                  onPointerUp={() => w()?.setSprint(false)}
                  onPointerCancel={() => w()?.setSprint(false)}
                >
                  Run
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {s.panel === 'factory' && <FactoryPanel s={s} store={store} />}
      {s.panel === 'warehouse' && <WarehousePanel s={s} store={store} />}
      {s.panel === 'market' && <MarketPanel s={s} store={store} />}

      {help && ready && (
        <div className="help">
          <div className="help-card">
            <p className="eyebrow">Welcome to GARRI Town</p>
            <h2>Grow cassava, make garri</h2>
            <ol>
              <li>Walk to the <b>Cassava Farm</b> (east of the square) and till a plot.</li>
              <li>Plant stems, then water from the <b>Borehole</b>. Pull weeds as they appear.</li>
              <li>Harvest roots and carry them to the <b>Garri Factory</b> for all 8 stages.</li>
              <li>Store bags in the <b>Warehouse</b>, then sell at <b>Oja Market</b>.</li>
            </ol>
            <p className="muted">
              {touch
                ? 'Left stick to move · drag the screen to look · pinch to zoom · tap the action button to interact.'
                : 'WASD to move · Shift to run · drag to look · scroll to zoom · E to interact · F to drive the tractor or water tanker.'}
            </p>
            <p className="fine">This preview keeps progress in this tab only. Saved progress, accounts and rewards arrive next.</p>
            <button className="btn btn-primary btn-block" onClick={() => setHelp(false)}>
              Start farming
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
