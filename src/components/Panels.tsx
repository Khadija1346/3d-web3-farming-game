import type { ReactNode } from 'react'
import { ECONOMY, FACTORY_STAGES } from '../fixtures/catalog'
import type { GameStore, Snapshot } from '../game/state'

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

export function FactoryPanel({ s, store }: { s: Snapshot; store: GameStore }) {
  const job = s.factory
  return (
    <Sheet title="Garri Factory" onClose={() => store.setPanel(null)}>
      {!job ? (
        <div className="sheet-body">
          <p className="muted">
            Load {ECONOMY.rootsPerBatch} fresh cassava roots to start a batch. Each batch yields {ECONOMY.bagsPerBatch} bags of
            garri.
          </p>
          <div className="meter-row">
            <span>Roots on hand</span>
            <b>{s.roots}</b>
          </div>
          <button className="btn btn-primary btn-block" disabled={s.roots < ECONOMY.rootsPerBatch} onClick={() => store.startBatch()}>
            {s.roots < ECONOMY.rootsPerBatch ? `Need ${ECONOMY.rootsPerBatch - s.roots} more roots` : 'Load a batch'}
          </button>
        </div>
      ) : (
        <div className="sheet-body">
          <ol className="pipeline">
            {FACTORY_STAGES.map((st, i) => {
              const state = i < job.stageIndex ? 'done' : i === job.stageIndex ? 'current' : 'todo'
              return (
                <li key={st.id} className={`pipe-${state}`}>
                  <span className="pipe-dot">{state === 'done' ? '✓' : i + 1}</span>
                  <span className="pipe-label">{st.label}</span>
                </li>
              )
            })}
          </ol>
          {(() => {
            const st = FACTORY_STAGES[job.stageIndex]
            return (
              <div className="stage-card">
                <h3>{st.label}</h3>
                <p>{st.detail}</p>
                <div className="bar">
                  <i style={{ width: `${Math.round(job.progress * 100)}%` }} />
                </div>
                <button
                  className="btn btn-primary btn-block"
                  disabled={job.running && job.progress < 1}
                  onClick={() => job.running ? store.completeFactoryStage() : store.runStage()}
                >
                  {job.running
                    ? job.progress >= 1 ? 'Complete stage' : `${st.label}… ${Math.round(job.progress * 100)}%`
                    : st.verb}
                </button>
              </div>
            )
          })()}
        </div>
      )}
      <p className="fine">Packaged garri goes into your carry bag — take it to the warehouse next door.</p>
    </Sheet>
  )
}

export function WarehousePanel({ s, store }: { s: Snapshot; store: GameStore }) {
  return (
    <Sheet title="Warehouse" onClose={() => store.setPanel(null)}>
      <div className="sheet-body">
        <div className="meter-row">
          <span>Garri you’re carrying</span>
          <b>{s.garriCarried} bags</b>
        </div>
        <div className="meter-row">
          <span>Stored in warehouse</span>
          <b>{s.garriStored} bags</b>
        </div>
        <button className="btn btn-primary btn-block" disabled={s.garriCarried <= 0} onClick={() => store.deposit()}>
          Store all bags
        </button>
        <p className="fine">Stored bags can be sold from Oja market.</p>
      </div>
    </Sheet>
  )
}

export function MarketPanel({ s, store }: { s: Snapshot; store: GameStore }) {
  return (
    <Sheet title="Oja Market" onClose={() => store.setPanel(null)}>
      <div className="sheet-body">
        <div className="trade">
          <div>
            <strong>Sell a bag of garri</strong>
            <small>{s.garriStored} in warehouse</small>
          </div>
          <button className="btn btn-primary" disabled={s.garriStored <= 0} onClick={() => store.sellBag()}>
            +₦{ECONOMY.garriBagPrice.toLocaleString()}
          </button>
        </div>
        <div className="trade">
          <div>
            <strong>Buy 4 cassava stems</strong>
            <small>{s.stems} stems in bag</small>
          </div>
          <button className="btn btn-ghost" disabled={s.naira < ECONOMY.stemBundlePrice} onClick={() => store.buyStems()}>
            −₦{ECONOMY.stemBundlePrice}
          </button>
        </div>
        <p className="fine">Prices are in in-game naira (₦) — a play currency with no cash value.</p>
      </div>
    </Sheet>
  )
}
