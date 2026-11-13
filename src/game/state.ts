import { CROP, ECONOMY, FACTORY_STAGES, XP_REWARDS } from '../fixtures/catalog'

/**
 * Preview game-rules store.
 *
 * All rule changes go through named commands (till, plant, water, …). In a later milestone
 * each command becomes a server API call and the server becomes authoritative; the 3D world
 * and HUD only read snapshots, so they do not need to change.
 */

export type PlotStage = 'wild' | 'tilled' | 'planted' | 'mature'

export interface Plot {
  id: number
  stage: PlotStage
  growth: number // 0..1
  water: number // 0..1
  weeds: number // 0..1
}

export type Panel = null | 'factory' | 'market' | 'warehouse'
export type VehicleKind = 'tractor' | 'tanker'

export interface Prompt {
  label: string
  sub?: string
  disabled?: boolean
}

export interface FactoryJob {
  stageIndex: number
  running: boolean
  progress: number // 0..1 for the current stage
}

export interface Toast {
  id: number
  text: string
  tone: 'xp' | 'info' | 'warn'
}

export interface Snapshot {
  plots: Plot[]
  stems: number
  roots: number
  garriCarried: number
  garriStored: number
  naira: number
  waterCan: number
  tankerWater: number
  xp: number
  level: number
  timeOfDay: number // 0..24
  day: number
  weather: 'clear' | 'rain'
  prompt: Prompt | null
  vehicle: VehicleKind | null
  nearVehicle: VehicleKind | null
  panel: Panel
  factory: FactoryJob | null
  toasts: Toast[]
  stats: { harvested: number; bagsMade: number; plotsTilled: number }
}

export const xpForLevel = (level: number) => 100 + (level - 1) * 60

const DAY_SECONDS = 420 // one full day/night cycle in real seconds

let toastId = 1

export class GameStore {
  private s: Snapshot
  private published!: Snapshot
  private listeners = new Set<() => void>()
  private dirty = false
  private emitTimer = 0
  private weatherTimer = 70
  private cloudHandler: ((action: 'till' | 'plant' | 'water' | 'weed' | 'harvest', plotId: number, revision: number) => Promise<{ state: Record<string, unknown>; revision: number }>) | null = null
  private cloudReady = false
  private cloudRevision = 0
  private cloudPending = new Set<string>()
  private cloudKeys = new Map<string, string>()

  constructor(plotCount: number) {
    this.s = {
      plots: Array.from({ length: plotCount }, (_, id) => ({ id, stage: 'wild', growth: 0, water: 0, weeds: 0 })),
      stems: ECONOMY.startingStems,
      roots: 0,
      garriCarried: 0,
      garriStored: 0,
      naira: ECONOMY.startingNaira,
      waterCan: ECONOMY.wateringCanUses,
      tankerWater: ECONOMY.tankerCapacity,
      xp: 0,
      level: 1,
      timeOfDay: 7.5,
      day: 1,
      weather: 'clear',
      prompt: null,
      vehicle: null,
      nearVehicle: null,
      panel: null,
      factory: null,
      toasts: [],
      stats: { harvested: 0, bagsMade: 0, plotsTilled: 0 },
    }
    this.published = this.s
  }

  setCloudCommandHandler(handler: ((action: 'till' | 'plant' | 'water' | 'weed' | 'harvest', plotId: number, revision: number) => Promise<{ state: Record<string, unknown>; revision: number }>) | null, ready = false) {
    this.cloudHandler = handler
    this.cloudReady = ready
  }

  setCloudReady(ready: boolean, revision = this.cloudRevision) {
    this.cloudReady = ready
    this.cloudRevision = revision
  }

  hydrateCloudState(value: Record<string, unknown>, revision: number) {
    const plots = Array.isArray(value.plots) ? value.plots as Plot[] : null
    if (!plots || plots.length !== this.s.plots.length || plots.some((p, i) => p.id !== i || !['wild','tilled','planted','mature'].includes(p.stage))) {
      throw new Error('invalid_cloud_game_state')
    }
    const numeric = (key: string, fallback: number) => typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : fallback
    this.s = {
      ...this.s,
      plots,
      stems: numeric('stems', this.s.stems),
      roots: numeric('roots', this.s.roots),
      garriCarried: numeric('garriCarried', this.s.garriCarried),
      garriStored: numeric('garriStored', this.s.garriStored),
      naira: numeric('naira', this.s.naira),
      waterCan: numeric('waterCan', this.s.waterCan),
      tankerWater: numeric('tankerWater', this.s.tankerWater),
      xp: numeric('xp', this.s.xp),
      level: numeric('level', this.s.level),
      stats: (value.stats && typeof value.stats === 'object' ? value.stats : this.s.stats) as Snapshot['stats'],
    }
    this.cloudRevision = revision
    this.emit()
  }

  private cloudAction(action: 'till' | 'plant' | 'water' | 'weed' | 'harvest', id: number) {
    if (!this.cloudHandler) return false
    if (!this.cloudReady) { this.toast('Cloud save is still connecting. Please wait.', 'warn'); return true }
    const key = action + ':' + id
    if (this.cloudPending.has(key)) return true
    this.cloudPending.add(key)
    const handler = this.cloudHandler
    const idempotencyKey = this.cloudKeys.get(key) ?? crypto.randomUUID()
    this.cloudKeys.set(key, idempotencyKey)
    void handler(action, id, this.cloudRevision, idempotencyKey).then(result => {
      if (this.cloudHandler !== handler) return
      this.hydrateCloudState(result.state, result.revision)
      this.cloudKeys.delete(key)
      this.toast('Farming progress saved to your account', 'info')
    }).catch(error => {
      this.toast(error instanceof Error ? error.message.replaceAll('_',' ') : 'Cloud action failed. Try again.', 'warn')
    }).finally(() => this.cloudPending.delete(key))
    return true
  }

  // ---- subscription (useSyncExternalStore) ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.published

  private commit(patch: Partial<Snapshot>, immediate = true) {
    this.s = { ...this.s, ...patch }
    if (immediate) this.emit()
    else this.dirty = true
  }
  private emit() {
    this.dirty = false
    this.published = this.s
    this.listeners.forEach((l) => l())
  }

  get state() {
    return this.s
  }

  toast(text: string, tone: Toast['tone'] = 'info') {
    const t = { id: toastId++, text, tone }
    this.commit({ toasts: [...this.s.toasts.slice(-3), t] })
    setTimeout(() => this.commit({ toasts: this.s.toasts.filter((x) => x.id !== t.id) }), 2600)
  }

  private gainXp(amount: number, reason: string) {
    let xp = this.s.xp + amount
    let level = this.s.level
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level)
      level++
    }
    const leveled = level > this.s.level
    this.commit({ xp, level })
    this.toast(`+${amount} XP · ${reason}`, 'xp')
    if (leveled) this.toast(`Level up! You are now level ${level}`, 'info')
  }

  private updatePlot(id: number, patch: Partial<Plot>) {
    this.commit({ plots: this.s.plots.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  }

  // ---- farming commands ----
  till(id: number, byTractor = false) {
    if (this.cloudAction('till', id)) return true
    const p = this.s.plots[id]
    if (!p || p.stage !== 'wild') return false
    this.updatePlot(id, { stage: 'tilled', growth: 0, water: 0, weeds: 0 })
    this.commit({ stats: { ...this.s.stats, plotsTilled: this.s.stats.plotsTilled + 1 } })
    this.gainXp(XP_REWARDS.till, byTractor ? 'Tractor tilled a plot' : 'Soil prepared')
    return true
  }

  plant(id: number) {
    if (this.cloudAction('plant', id)) return true
    const p = this.s.plots[id]
    if (!p || p.stage !== 'tilled') return false
    if (this.s.stems <= 0) {
      this.toast('No cassava stems left — buy a bundle at the market', 'warn')
      return false
    }
    this.commit({ stems: this.s.stems - 1 })
    this.updatePlot(id, { stage: 'planted', growth: 0.02, water: 0.25 })
    this.gainXp(XP_REWARDS.plant, 'Cassava planted')
    return true
  }

  water(id: number, source: 'can' | 'tanker' | 'rain' = 'can') {
    if (this.cloudHandler) {
      if (source !== 'can') { this.toast('Cloud accounts currently support watering-can actions only.', 'warn'); return false }
      return this.cloudAction('water', id)
    }
    const p = this.s.plots[id]
    if (!p || p.stage !== 'planted' || p.water > 0.85) return false
    if (source === 'can') {
      if (this.s.waterCan <= 0) {
        this.toast('Watering can is empty — refill at the borehole or river', 'warn')
        return false
      }
      this.commit({ waterCan: this.s.waterCan - 1 })
    }
    if (source === 'tanker') {
      if (this.s.tankerWater < 10) {
        this.toast('Tanker is empty — refill at the river pump', 'warn')
        return false
      }
      this.commit({ tankerWater: this.s.tankerWater - 10 })
    }
    this.updatePlot(id, { water: 1 })
    if (source !== 'rain') this.gainXp(XP_REWARDS.water, source === 'tanker' ? 'Tanker watered a plot' : 'Plot watered')
    return true
  }

  weed(id: number) {
    if (this.cloudAction('weed', id)) return true
    const p = this.s.plots[id]
    if (!p || p.stage !== 'planted' || p.weeds < 0.25) return false
    this.updatePlot(id, { weeds: 0 })
    this.gainXp(XP_REWARDS.weed, 'Weeds cleared')
    return true
  }

  harvest(id: number) {
    if (this.cloudAction('harvest', id)) return true
    const p = this.s.plots[id]
    if (!p || p.stage !== 'mature') return false
    const roots = CROP.rootsMin + Math.floor(Math.random() * (CROP.rootsMax - CROP.rootsMin + 1))
    this.updatePlot(id, { stage: 'wild', growth: 0, water: 0, weeds: 0 })
    this.commit({ roots: this.s.roots + roots, stats: { ...this.s.stats, harvested: this.s.stats.harvested + roots } })
    this.gainXp(XP_REWARDS.harvest, `Harvested ${roots} cassava roots`)
    return true
  }

  refillCan() {
    if (this.s.waterCan >= ECONOMY.wateringCanUses) return false
    this.commit({ waterCan: ECONOMY.wateringCanUses })
    this.toast('Watering can refilled')
    return true
  }

  refillTanker() {
    if (this.s.tankerWater >= ECONOMY.tankerCapacity) return false
    this.commit({ tankerWater: ECONOMY.tankerCapacity })
    this.toast('Water tanker refilled at the river pump')
    return true
  }

  // ---- factory ----
  startBatch() {
    if (this.s.factory) return false
    if (this.s.roots < ECONOMY.rootsPerBatch) {
      this.toast(`You need ${ECONOMY.rootsPerBatch} cassava roots to start a batch`, 'warn')
      return false
    }
    this.commit({ roots: this.s.roots - ECONOMY.rootsPerBatch, factory: { stageIndex: 0, running: false, progress: 0 } })
    this.toast('Batch loaded into the factory')
    return true
  }

  runStage() {
    const f = this.s.factory
    if (!f || f.running) return false
    this.commit({ factory: { ...f, running: true, progress: 0 } })
    return true
  }

  // ---- warehouse & market ----
  deposit() {
    if (this.s.garriCarried <= 0) return false
    this.commit({ garriStored: this.s.garriStored + this.s.garriCarried, garriCarried: 0 })
    this.toast('Garri stored in the warehouse')
    return true
  }

  sellBag() {
    if (this.s.garriStored <= 0) {
      this.toast('No garri in the warehouse to sell', 'warn')
      return false
    }
    this.commit({ garriStored: this.s.garriStored - 1, naira: this.s.naira + ECONOMY.garriBagPrice })
    this.gainXp(XP_REWARDS.sell, 'Sold a bag of garri')
    return true
  }

  buyStems() {
    if (this.s.naira < ECONOMY.stemBundlePrice) {
      this.toast('Not enough in-game naira', 'warn')
      return false
    }
    this.commit({ naira: this.s.naira - ECONOMY.stemBundlePrice, stems: this.s.stems + 4 })
    this.toast('Bought a bundle of 4 cassava stems')
    return true
  }

  // ---- world-driven UI state ----
  setPrompt(prompt: Prompt | null) {
    const cur = this.s.prompt
    if (cur?.label === prompt?.label && cur?.sub === prompt?.sub && cur?.disabled === prompt?.disabled) return
    this.commit({ prompt })
  }
  setPanel(panel: Panel) {
    if (this.s.panel !== panel) this.commit({ panel })
  }
  setVehicle(vehicle: VehicleKind | null) {
    this.commit({ vehicle })
  }
  setNearVehicle(v: VehicleKind | null) {
    if (this.s.nearVehicle !== v) this.commit({ nearVehicle: v })
  }

  // ---- simulation clock ----
  tick(dt: number) {
    const s = this.s
    let timeOfDay = s.timeOfDay + (dt / DAY_SECONDS) * 24
    let day = s.day
    if (timeOfDay >= 24) {
      timeOfDay -= 24
      day++
    }

    // weather
    this.weatherTimer -= dt
    let weather = s.weather
    if (this.weatherTimer <= 0) {
      weather = weather === 'clear' && Math.random() < 0.55 ? 'rain' : 'clear'
      this.weatherTimer = weather === 'rain' ? 25 + Math.random() * 20 : 60 + Math.random() * 60
      if (weather !== s.weather) this.toast(weather === 'rain' ? 'Rain is falling — crops are being watered' : 'The rain has cleared')
    }

    // crops
    let changed = false
    const matured: number[] = []
    const plots = this.cloudHandler ? s.plots : s.plots.map((p) => {
      if (p.stage !== 'planted') return p
      changed = true
      const water = weather === 'rain' ? Math.min(1, p.water + dt / 6) : Math.max(0, p.water - dt / CROP.waterDrainSeconds)
      const weeds = Math.min(1, p.weeds + dt / CROP.weedGrowSeconds)
      const rate = p.water > 0 ? 1 - weeds * 0.7 : 0
      const growth = Math.min(1, p.growth + (dt / CROP.growSeconds) * rate)
      if (growth >= 1) {
        matured.push(p.id)
        return { ...p, stage: 'mature' as const, growth: 1, water, weeds: 0 }
      }
      return { ...p, water, weeds, growth }
    })

    // factory
    let factory = s.factory
    let garriCarried = s.garriCarried
    let finishedStage: string | null = null
    let packaged = false
    if (factory?.running) {
      const stage = FACTORY_STAGES[factory.stageIndex]
      const progress = factory.progress + dt / stage.seconds
      if (progress >= 1) {
        finishedStage = stage.label
        if (factory.stageIndex === FACTORY_STAGES.length - 1) {
          factory = null
          garriCarried += ECONOMY.bagsPerBatch
          packaged = true
        } else factory = { stageIndex: factory.stageIndex + 1, running: false, progress: 0 }
      } else factory = { ...factory, progress }
    }

    this.commit(
      {
        timeOfDay,
        day,
        weather,
        plots: changed ? plots : s.plots,
        factory,
        garriCarried,
        stats: packaged ? { ...s.stats, bagsMade: s.stats.bagsMade + ECONOMY.bagsPerBatch } : s.stats,
      },
      false,
    )
    if (matured.length) this.toast(`Cassava ready to harvest on ${matured.length} plot${matured.length > 1 ? 's' : ''}`)
    if (packaged) this.gainXp(XP_REWARDS.package, `Packaged ${ECONOMY.bagsPerBatch} bags of garri`)
    else if (finishedStage) this.gainXp(XP_REWARDS.processStage, `${finishedStage} done`)

    this.emitTimer += dt
    if (this.dirty && this.emitTimer > 0.2) {
      this.emitTimer = 0
      this.emit()
    }
  }
}
