import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  InstancedMesh,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import {
  Mats,
  animateHumanoid,
  createBroadTreeTemplate,
  createCassavaTemplate,
  createHouseTemplate,
  createHumanoid,
  createPalmTemplate,
  createTanker,
  createTractor,
  hex,
  makeDotTexture,
  makeSign,
  type Humanoid,
  type Look,
  type VehicleRig,
} from './builders'
import type { GameStore, Panel, VehicleKind } from './state'

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
interface Zone {
  kind: 'borehole' | 'riverPump' | 'factory' | 'warehouse' | 'market'
  x: number
  z: number
  r: number
}
interface Vehicle {
  kind: VehicleKind
  rig: VehicleRig
  pos: Vector3
  yaw: number
  speed: number
  maxSpeed: number
}
interface Npc {
  h: Humanoid
  path: Vector3[]
  idx: number
  speed: number
  work: boolean
}
interface PlotView {
  rect: Rect
  cx: number
  cz: number
  soil: Mesh
  ridges: Mesh[]
  weeds: AbstractMesh[]
  plants: AbstractMesh[]
  marker: Mesh
  key: string
}

const PLOT_COLS = 4
const PLOT_ROWS = 3
export const PLOT_COUNT = PLOT_COLS * PLOT_ROWS
const PLOT_SIZE = 5
const BOUNDS = { minX: -50, maxX: 72, minZ: -72, maxZ: 72 }

/** Deterministic RNG so the village layout is identical for every player. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const inRect = (x: number, z: number, r: Rect, pad = 0) =>
  x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad

const rectAt = (cx: number, cz: number, w: number, d: number): Rect => ({
  minX: cx - w / 2,
  maxX: cx + w / 2,
  minZ: cz - d / 2,
  maxZ: cz + d / 2,
})

const LOOKS: Look[] = [
  { skin: '#5a3825', top: '#d8452b', bottom: '#2f3f7a', hair: '#141010' },
  { skin: '#6b4430', top: '#2f8f6a', bottom: '#e4b23a', hair: '#141010', wrap: '#e4b23a' },
  { skin: '#4a2e1f', top: '#f0c419', bottom: '#5b2a86', hair: '#141010' },
  { skin: '#7a4f36', top: '#ffffff', bottom: '#2b2b2b', hair: '#1a1210' },
  { skin: '#55351f', top: '#8e2b5e', bottom: '#8e2b5e', hair: '#141010', wrap: '#f07b2c' },
  { skin: '#603c28', top: '#3b6fb6', bottom: '#c8b48a', hair: '#141010' },
]

export class GarriWorld {
  readonly engine: Engine
  readonly scene: Scene
  private camera: ArcRotateCamera
  private sun: DirectionalLight
  private hemi: HemisphericLight
  private shadows: ShadowGenerator
  private mats: Mats
  private player: Humanoid
  private playerPos = new Vector3(2, 0, -6)
  private playerYaw = 0
  private keys = new Set<string>()
  private touch = { x: 0, z: 0 }
  private sprint = false
  private vehicles: Vehicle[] = []
  private driving: Vehicle | null = null
  private npcs: Npc[] = []
  private plots: PlotView[] = []
  private obstacles: Rect[] = []
  private zones: Zone[] = []
  private lampMat: StandardMaterial
  private emberMat: StandardMaterial
  private rain!: ParticleSystem
  private action: (() => void) | null = null
  private canoes: TransformNode[] = []
  private disposed = false

  constructor(
    canvas: HTMLCanvasElement,
    private store: GameStore,
    private mobile: boolean,
  ) {
    this.engine = new Engine(canvas, !mobile, { stencil: true, preserveDrawingBuffer: false }, true)
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75))
    const scene = (this.scene = new Scene(this.engine))
    scene.skipPointerMovePicking = true
    scene.fogMode = Scene.FOGMODE_EXP2
    scene.fogDensity = 0.0065
    this.mats = new Mats(scene)

    // camera
    const cam = (this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.08, 15, new Vector3(2, 1.6, -6), scene))
    cam.attachControl(canvas, true)
    cam.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
    cam.lowerRadiusLimit = 6
    cam.upperRadiusLimit = 34
    cam.lowerBetaLimit = 0.4
    cam.upperBetaLimit = 1.42
    cam.panningSensibility = 0
    cam.wheelDeltaPercentage = 0.012
    cam.pinchDeltaPercentage = 0.004
    cam.angularSensibilityX = mobile ? 900 : 1600
    cam.angularSensibilityY = mobile ? 900 : 1600
    cam.minZ = 0.3
    cam.maxZ = 600

    // lights
    this.hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene)
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.4), scene)
    this.sun.autoUpdateExtends = false
    this.sun.shadowFrustumSize = 70
    this.sun.shadowMinZ = 1
    this.sun.shadowMaxZ = 160
    this.shadows = new ShadowGenerator(mobile ? 1024 : 2048, this.sun)
    this.shadows.usePercentageCloserFiltering = true
    this.shadows.bias = 0.0015
    this.shadows.normalBias = 0.02
    this.shadows.darkness = 0.25

    this.lampMat = this.mats.get('#fff1c4', { emissive: '#3a2a10' })
    this.emberMat = this.mats.get('#ff7a1a', { emissive: '#ff5a00' })

    this.buildTerrain()
    this.buildVillage()
    this.buildFarm()
    this.buildIndustry()
    this.buildWaterDistrict()
    this.buildVegetation()
    this.buildPeople()
    this.buildVehicles()
    this.buildWeather()

    this.player = createHumanoid(scene, this.mats, 'player', {
      skin: '#5b3923',
      top: '#e35d1d',
      bottom: '#1d4d8f',
      hair: '#120d0a',
    })
    this.player.meshes.forEach((m) => this.shadows.addShadowCaster(m))
    // straw hat so the player is recognisable among NPCs
    const hat = MeshBuilder.CreateCylinder('hat', { diameterTop: 0.25, diameterBottom: 0.75, height: 0.22, tessellation: 12 }, scene)
    hat.parent = this.player.root
    hat.position.y = 2.0
    hat.material = this.mats.get('#e7c76d')
    this.player.meshes.push(hat)

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('blur', this.onBlur)

    scene.onBeforeRenderObservable.add(() => this.update(Math.min(this.engine.getDeltaTime() / 1000, 0.05)))
    this.engine.runRenderLoop(() => scene.render())
  }

  // ------------------------------------------------------------------ public API (HUD)

  setTouchMove(x: number, z: number) {
    this.touch.x = x
    this.touch.z = z
  }
  setSprint(on: boolean) {
    this.sprint = on
  }
  interact() {
    this.action?.()
  }
  toggleVehicle() {
    if (this.driving) {
      const v = this.driving
      const right = new Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw))
      this.playerPos.copyFrom(v.pos.add(right.scale(2.4)))
      this.clampToBounds(this.playerPos)
      this.driving = null
      this.player.root.setEnabled(true)
      this.store.setVehicle(null)
      return
    }
    const near = this.nearestVehicle()
    if (!near) return
    this.driving = near
    this.player.root.setEnabled(false)
    this.store.setVehicle(near.kind)
    this.store.setPanel(null)
    this.store.toast(near.kind === 'tractor' ? 'Tractor: drive over wild plots to till them' : 'Water tanker: drive over planted plots to water them')
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('blur', this.onBlur)
    this.engine.dispose()
  }

  // ------------------------------------------------------------------ input

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'e' && !e.repeat) this.interact()
    if (k === 'f' && !e.repeat) this.toggleVehicle()
    if (k === 'escape') this.store.setPanel(null)
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
  private onBlur = () => this.keys.clear()
  private onResize = () => this.engine.resize()

  private readInput() {
    const k = this.keys
    let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    let z = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    x += this.touch.x
    z += this.touch.z
    const len = Math.hypot(x, z)
    if (len > 1) {
      x /= len
      z /= len
    }
    return { x, z, sprint: this.sprint || k.has('shift') }
  }

  // ------------------------------------------------------------------ world building

  /** Mark a mesh as static scenery. Instances inherit shadow settings from their source. */
  private fix(m: AbstractMesh, cast = true) {
    if (!(m instanceof InstancedMesh)) {
      m.receiveShadows = true
      if (cast) this.shadows.addShadowCaster(m)
    }
    m.freezeWorldMatrix()
    m.isPickable = false
  }

  private buildTerrain() {
    const s = this.scene
    const ground = MeshBuilder.CreateGround('ground', { width: 320, height: 320 }, s)
    ground.material = this.mats.get('#6c9a3f')
    this.fix(ground, false)

    const patch = (cx: number, cz: number, w: number, d: number, color: string, y = 0.02) => {
      const p = MeshBuilder.CreateGround('patch', { width: w, height: d }, s)
      p.position.set(cx, y, cz)
      p.material = this.mats.get(color)
      this.fix(p, false)
      return p
    }
    // laterite plaza and roads
    const plaza = MeshBuilder.CreateDisc('plaza', { radius: 11, tessellation: 40 }, s)
    plaza.rotation.x = Math.PI / 2
    plaza.position.y = 0.03
    plaza.material = this.mats.get('#b8673d')
    this.fix(plaza, false)
    patch(0, 0, 6, 150, '#b0603a', 0.04)
    patch(11, 0, 122, 6, '#b0603a', 0.045)
    patch(21, -14, 42, 4.5, '#b46a40', 0.05)
    patch(28, 9, 4.5, 12, '#b46a40', 0.05)
    patch(52, 9, 4.5, 12, '#b46a40', 0.05)
    patch(-22, 7, 4.5, 8, '#b46a40', 0.05)
    // farm field base
    patch(27, -28.5, 32, 24, '#7c8f3c', 0.03)

    // distant hills
    const r = rng(7)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const d = 135 + r() * 25
      const hill = MeshBuilder.CreateIcoSphere('hill', { radius: 1, subdivisions: 2 }, s)
      hill.scaling.set(22 + r() * 20, 10 + r() * 16, 22 + r() * 20)
      hill.position.set(Math.cos(a) * d, -2, Math.sin(a) * d)
      hill.material = this.mats.get(i % 2 ? '#4d7a35' : '#5a8a3c')
      this.fix(hill, false)
    }

    // lamp posts along roads
    const post = MeshBuilder.CreateCylinder('lamp-post', { height: 4.2, diameter: 0.14, tessellation: 6 }, s)
    post.material = this.mats.get('#3b3633')
    post.position.y = 2.1
    const bulb = MeshBuilder.CreateSphere('bulb', { diameter: 0.45, segments: 6 }, s)
    bulb.material = this.lampMat
    bulb.position.y = 4.25
    const lampPositions: [number, number][] = []
    for (let z = -60; z <= 60; z += 15) if (Math.abs(z) > 8) lampPositions.push([3.6, z])
    for (let x = -42; x <= 66; x += 15) if (Math.abs(x) > 10) lampPositions.push([x, 3.6])
    lampPositions.forEach(([x, z], i) => {
      const p = i === 0 ? post : post.createInstance('lp')
      const b = i === 0 ? bulb : bulb.createInstance('lb')
      p.position.set(x, 2.1, z)
      b.position.set(x, 4.25, z)
      this.fix(p)
      this.fix(b, false)
    })
  }

  private buildVillage() {
    const s = this.scene
    const templates = [
      createHouseTemplate(s, this.mats, 'house-a', '#c9744a', '#8b9196'),
      createHouseTemplate(s, this.mats, 'house-b', '#e6d3ad', '#9a5a3a'),
      createHouseTemplate(s, this.mats, 'house-c', '#d99a4e', '#7c8287'),
      createHouseTemplate(s, this.mats, 'house-d', '#a85a3a', '#a7adb0'),
    ]
    templates.forEach((t) => {
      t.receiveShadows = true
      this.shadows.addShadowCaster(t)
      t.position.y = -100 // template hidden; instances placed below
    })
    // [x, z, yaw] — houses face their nearest road
    const spots: [number, number, number][] = [
      [-12, -10, Math.PI], [-22, -10, Math.PI], [-32, -10, Math.PI], [-42, -11, Math.PI],
      [-12, -24, 0], [-23, -25, 0.1], [-34, -24, -0.1], [-14, -38, Math.PI / 2], [-28, -40, 0],
      [-9, 32, Math.PI / 2], [-10, 44, Math.PI / 2], [-10, 56, Math.PI / 2],
      [-22, 34, 0], [-34, 36, 0.15], [-24, 48, Math.PI], [-38, 50, Math.PI],
      [10, 34, -Math.PI / 2], [10, 46, -Math.PI / 2], [10, 58, -Math.PI / 2], [22, 52, Math.PI],
      [34, 56, Math.PI], [46, 50, Math.PI], [-10, -52, Math.PI / 2], [10, -52, -Math.PI / 2],
      [10, -64, -Math.PI / 2], [-12, -64, Math.PI / 2], [62, -10, Math.PI], [62, 36, -Math.PI / 2],
    ]
    spots.forEach(([x, z, yaw], i) => {
      const inst = templates[i % templates.length].createInstance(`house-${i}`)
      const sc = 0.9 + ((i * 37) % 10) / 30
      inst.scaling.setAll(sc)
      inst.position.set(x, 0, z)
      inst.rotation.y = yaw
      this.fix(inst, false)
      const rotated = Math.abs(Math.sin(yaw)) > 0.7
      this.obstacles.push(rectAt(x, z, (rotated ? 5.4 : 6.4) * sc, (rotated ? 6.4 : 5.4) * sc))
    })

    // town square centrepiece
    const plinth = MeshBuilder.CreateCylinder('plinth', { diameter: 3.2, height: 0.8, tessellation: 16 }, s)
    plinth.position.set(-6, 0.4, 6)
    plinth.material = this.mats.get('#e9dcc0')
    this.fix(plinth)
    const sign = makeSign(s, 'GARRI TOWN', '#7a2e17', 7)
    sign.position.set(-6, 3.6, 6)
    const pole = MeshBuilder.CreateCylinder('pole', { diameter: 0.2, height: 3 }, s)
    pole.position.set(-6, 2, 6)
    pole.material = this.mats.get('#3b3633')
    this.fix(pole)
    this.obstacles.push(rectAt(-6, 6, 3, 3))
  }

  private buildFarm() {
    const s = this.scene
    const plant = createCassavaTemplate(s, this.mats)
    plant.position.y = -100
    plant.receiveShadows = true
    this.shadows.addShadowCaster(plant)
    const weed = MeshBuilder.CreateCylinder('weed', { diameterTop: 0, diameterBottom: 0.35, height: 0.5, tessellation: 4 }, s)
    weed.material = this.mats.get('#5d8f2e')
    weed.position.y = -100
    const ridgeMat = this.mats.get('#6a432a')
    const markerMat = this.mats.get('#ffd23f', { emissive: '#b8860b' })

    for (let r = 0; r < PLOT_ROWS; r++) {
      for (let c = 0; c < PLOT_COLS; c++) {
        const cx = 16.5 + c * 7
        const cz = -35.5 + r * 7
        const soil = MeshBuilder.CreateBox('soil', { width: PLOT_SIZE, height: 0.2, depth: PLOT_SIZE }, s)
        soil.position.set(cx, 0.1, cz)
        this.fix(soil, false)
        const ridges: Mesh[] = []
        for (let i = 0; i < 4; i++) {
          const ridge = MeshBuilder.CreateBox('ridge', { width: 4.5, height: 0.22, depth: 0.55 }, s)
          ridge.position.set(cx, 0.3, cz - 1.8 + i * 1.2)
          ridge.material = ridgeMat
          this.fix(ridge, false)
          ridges.push(ridge)
        }
        const plants: AbstractMesh[] = []
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 3; j++) {
            const p = plant.createInstance('plant')
            p.position.set(cx - 1.6 + j * 1.6, 0.38, cz - 1.8 + i * 1.2)
            p.rotation.y = (i * 3 + j) * 1.3
            p.isPickable = false
            plants.push(p)
          }
        const weeds: AbstractMesh[] = []
        for (let i = 0; i < 7; i++) {
          const w = weed.createInstance('w')
          w.position.set(cx - 2 + ((i * 1.7) % 4), 0.42, cz - 2 + ((i * 2.3) % 4))
          w.isPickable = false
          weeds.push(w)
        }
        const marker = MeshBuilder.CreatePolyhedron('marker', { type: 1, size: 0.35 }, s)
        marker.position.set(cx, 2.6, cz)
        marker.material = markerMat
        marker.isPickable = false
        this.plots.push({ rect: rectAt(cx, cz, PLOT_SIZE, PLOT_SIZE), cx, cz, soil, ridges, weeds, plants, marker, key: '' })
      }
    }
    const farmSign = makeSign(s, 'CASSAVA FARM', '#2f6b2a', 7)
    farmSign.position.set(13, 4, -17)

    // borehole water tower
    const tank = MeshBuilder.CreateCylinder('tower-tank', { diameter: 2.6, height: 2.2, tessellation: 16 }, s)
    tank.position.set(8, 5.2, -24)
    tank.material = this.mats.get('#2e7fb0', { spec: 0.4 })
    this.fix(tank)
    for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const leg = MeshBuilder.CreateBox('leg', { width: 0.16, height: 4.2, depth: 0.16 }, s)
      leg.position.set(8 + dx, 2.1, -24 + dz)
      leg.material = this.mats.get('#4a4441')
      this.fix(leg)
    }
    const pump = MeshBuilder.CreateBox('pump', { width: 0.5, height: 1.1, depth: 0.5 }, s)
    pump.position.set(9.6, 0.55, -22)
    pump.material = this.mats.get('#5a6a72', { spec: 0.4 })
    this.fix(pump)
    const bSign = makeSign(s, 'BOREHOLE', '#1f5f8b', 4.5)
    bSign.position.set(8, 7.4, -24)
    this.obstacles.push(rectAt(8, -24, 2.4, 2.4))
    this.zones.push({ kind: 'borehole', x: 9.5, z: -22, r: 3.2 })

    // fence along the far edges
    const fence = MeshBuilder.CreateBox('fence', { width: 0.14, height: 1.1, depth: 0.14 }, s)
    fence.material = this.mats.get('#7a5636')
    fence.position.y = -100
    for (let x = 12; x <= 42; x += 2) {
      const f = fence.createInstance('f')
      f.position.set(x, 0.55, -40)
      this.fix(f, false)
    }
    for (let z = -40; z <= -18; z += 2) {
      const f = fence.createInstance('f')
      f.position.set(42, 0.55, z)
      this.fix(f, false)
    }
    const rail = MeshBuilder.CreateBox('rail', { width: 30, height: 0.1, depth: 0.08 }, s)
    rail.position.set(27, 0.85, -40)
    rail.material = fence.material
    this.fix(rail, false)
    const rail2 = MeshBuilder.CreateBox('rail', { width: 0.08, height: 0.1, depth: 22 }, s)
    rail2.position.set(42, 0.85, -29)
    rail2.material = fence.material
    this.fix(rail2, false)
    this.obstacles.push({ minX: 12, maxX: 42, minZ: -40.5, maxZ: -39.6 }, { minX: 41.6, maxX: 42.5, minZ: -40, maxZ: -18 })
  }

  private buildIndustry() {
    const s = this.scene
    const add = (m: Mesh, color: string, cast = true, spec = 0.05) => {
      m.material = this.mats.get(color, { spec })
      this.fix(m, cast)
      return m
    }
    const B = (n: string, w: number, h: number, d: number, x: number, y: number, z: number, color: string, cast = true) => {
      const m = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, s)
      m.position.set(x, y, z)
      return add(m, color, cast)
    }

    // ---- processing factory (open-fronted shed at 28,22)
    const fx = 28
    const fz = 22
    B('f-floor', 18, 0.3, 12, fx, 0.15, fz, '#9c8f7f', false)
    B('f-back', 18, 5, 0.4, fx, 2.5, fz + 5.8, '#e2d2b0')
    B('f-left', 0.4, 5, 12, fx - 8.8, 2.5, fz, '#e2d2b0')
    B('f-right', 0.4, 5, 12, fx + 8.8, 2.5, fz, '#e2d2b0')
    for (const x of [-8.8, -3, 3, 8.8]) B('f-col', 0.4, 5, 0.4, fx + x, 2.5, fz - 5.8, '#7a5636')
    const roof = B('f-roof', 19.5, 0.2, 13.5, fx, 5.35, fz, '#8f969b', true)
    roof.material = this.mats.get('#8f969b', { spec: 0.4 })
    B('f-band', 18, 0.6, 0.2, fx, 4.8, fz - 5.9, '#b8321f')
    // stations
    B('grater', 1.6, 1.2, 1.2, fx - 6, 0.9, fz + 2, '#4f5d63')
    B('hopper', 1.2, 0.6, 1.2, fx - 6, 1.8, fz + 2, '#6b7a80')
    B('press', 1.3, 2.2, 1.3, fx - 2.5, 1.4, fz + 3.5, '#6a4a2e')
    B('press-screw', 0.2, 1.2, 0.2, fx - 2.5, 3, fz + 3.5, '#9aa3a8')
    for (let i = 0; i < 3; i++) {
      const hearth = B('hearth', 2.2, 0.8, 2.2, fx + 1 + i * 2.8, 0.7, fz + 3, '#a0522d')
      hearth.material = this.mats.get('#a0522d')
      const pan = MeshBuilder.CreateCylinder('pan', { diameterTop: 2.1, diameterBottom: 1.6, height: 0.25, tessellation: 20 }, s)
      pan.position.set(fx + 1 + i * 2.8, 1.2, fz + 3)
      add(pan, '#2f2f30', true, 0.5)
      const garri = MeshBuilder.CreateCylinder('garri', { diameter: 1.7, height: 0.06, tessellation: 20 }, s)
      garri.position.set(fx + 1 + i * 2.8, 1.33, fz + 3)
      add(garri, '#f3e6c4', false)
      const ember = MeshBuilder.CreateBox('ember', { width: 1.2, height: 0.2, depth: 0.3 }, s)
      ember.position.set(fx + 1 + i * 2.8, 0.45, fz + 1.88)
      ember.material = this.emberMat
      this.fix(ember, false)
    }
    // garri sacks
    const sack = MeshBuilder.CreateCylinder('sack', { diameterTop: 0.55, diameterBottom: 0.7, height: 0.95, tessellation: 8 }, s)
    add(sack, '#efe6cf')
    sack.unfreezeWorldMatrix()
    sack.position.set(fx + 7, 0.75, fz - 2)
    sack.freezeWorldMatrix()
    for (let i = 1; i < 9; i++) {
      const sk = sack.createInstance('sk')
      sk.position.set(fx + 7 - (i % 3) * 0.75, 0.75, fz - 2 + Math.floor(i / 3) * 0.75)
      this.fix(sk, false)
    }
    // chimney + smoke
    const chimney = MeshBuilder.CreateCylinder('chimney', { diameter: 0.9, height: 4.5, tessellation: 10 }, s)
    chimney.position.set(fx + 4, 7.4, fz + 4.5)
    add(chimney, '#7c4a35')
    const smoke = new ParticleSystem('smoke', this.mobile ? 120 : 260, s)
    smoke.particleTexture = makeDotTexture(s, 'smoke-tex')
    smoke.emitter = new Vector3(fx + 4, 9.7, fz + 4.5)
    smoke.minEmitBox = new Vector3(-0.2, 0, -0.2)
    smoke.maxEmitBox = new Vector3(0.2, 0, 0.2)
    smoke.color1 = new Color4(0.85, 0.85, 0.85, 0.45)
    smoke.color2 = new Color4(0.7, 0.7, 0.7, 0.35)
    smoke.colorDead = new Color4(0.6, 0.6, 0.6, 0)
    smoke.minSize = 0.8
    smoke.maxSize = 2.6
    smoke.minLifeTime = 2.5
    smoke.maxLifeTime = 4.5
    smoke.emitRate = this.mobile ? 18 : 35
    smoke.direction1 = new Vector3(-0.3, 1.6, -0.2)
    smoke.direction2 = new Vector3(0.4, 2.4, 0.3)
    smoke.gravity = new Vector3(0.5, 0.2, 0.15)
    smoke.minEmitPower = 0.5
    smoke.maxEmitPower = 1
    smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD
    smoke.start()

    const fSign = makeSign(s, 'GARRI FACTORY', '#b8321f', 8)
    fSign.position.set(fx, 7, fz - 6)
    this.obstacles.push(
      { minX: fx - 9.1, maxX: fx + 9.1, minZ: fz + 5.5, maxZ: fz + 6.1 },
      { minX: fx - 9.1, maxX: fx - 8.5, minZ: fz - 6, maxZ: fz + 6 },
      { minX: fx + 8.5, maxX: fx + 9.1, minZ: fz - 6, maxZ: fz + 6 },
      rectAt(fx - 6, fz + 2, 1.8, 1.4),
      rectAt(fx - 2.5, fz + 3.5, 1.5, 1.5),
      { minX: fx - 0.2, maxX: fx + 7.8, minZ: fz + 1.8, maxZ: fz + 4.2 },
      { minX: fx + 5.2, maxX: fx + 7.4, minZ: fz - 2.4, maxZ: fz - 0.3 },
    )
    this.zones.push({ kind: 'factory', x: fx, z: fz - 2, r: 7.5 })

    // ---- warehouse (52,22)
    const wx = 52
    const wz = 22
    B('wh', 13, 6, 11, wx, 3, wz, '#d6c7a7')
    const whRoof = B('wh-roof', 14, 0.25, 12, wx, 6.1, wz, '#7d8387')
    whRoof.material = this.mats.get('#7d8387', { spec: 0.35 })
    B('wh-door', 5, 4.2, 0.1, wx, 2.1, wz - 5.52, '#5b6d78')
    B('wh-stripe', 13.05, 0.5, 11.05, wx, 5.2, wz, '#1f6f8b')
    for (let i = 0; i < 4; i++) B('pallet', 1.2, 0.9, 1.2, wx - 5 + i * 1.4, 0.45, wz - 6.5, i % 2 ? '#efe6cf' : '#e8dcc0')
    const wSign = makeSign(s, 'WAREHOUSE', '#1f6f8b', 6)
    wSign.position.set(wx, 8, wz - 5.6)
    this.obstacles.push(rectAt(wx, wz, 13.2, 11.2), { minX: wx - 5.7, maxX: wx - 0.4, minZ: wz - 7.2, maxZ: wz - 5.8 })
    this.zones.push({ kind: 'warehouse', x: wx + 2, z: wz - 8, r: 4.5 })

    // ---- market (-22,16)
    const canopy = ['#d8452b', '#f0c419', '#2f8f6a', '#3b6fb6', '#8e2b5e', '#f07b2c']
    const produce = ['#f3e6c4', '#e06a2c', '#d94040', '#f0c419', '#7a4b2a', '#4fa63d']
    let k = 0
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const x = -30 + col * 8
        const z = 14 + row * 7
        B('table', 3.2, 0.9, 1.6, x, 0.45, z, '#8a5a36')
        for (const [dx, dz] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) B('stall-post', 0.12, 2.6, 0.12, x + dx, 1.3, z + dz, '#5c4130')
        const top = B('canopy', 3.6, 0.12, 2.4, x, 2.65, z, canopy[k % canopy.length])
        top.rotation.x = 0.12
        top.unfreezeWorldMatrix()
        top.freezeWorldMatrix()
        for (let i = 0; i < 5; i++) {
          const heap = MeshBuilder.CreateSphere('produce', { diameter: 0.5, segments: 5 }, s)
          heap.scaling.y = 0.6
          heap.position.set(x - 1.2 + i * 0.6, 1.0, z)
          add(heap, produce[(k + i) % produce.length], false)
        }
        this.obstacles.push(rectAt(x, z, 3.4, 1.8))
        k++
      }
    const mSign = makeSign(s, 'OJA MARKET', '#8e2b5e', 6.5)
    mSign.position.set(-22, 5.2, 10)
    this.zones.push({ kind: 'market', x: -22, z: 11, r: 6.5 })
  }

  private buildWaterDistrict() {
    const s = this.scene
    const water = MeshBuilder.CreateGround('river', { width: 22, height: 320 }, s)
    water.position.set(-62, 0.08, 0)
    const wm = new StandardMaterial('water', s)
    wm.diffuseColor = hex('#2a7fa0')
    wm.specularColor = new Color3(0.9, 0.9, 0.9)
    wm.specularPower = 64
    wm.alpha = 0.92
    water.material = wm
    water.isPickable = false
    const bank = MeshBuilder.CreateGround('bank', { width: 4, height: 320 }, s)
    bank.position.set(-50, 0.05, 0)
    bank.material = this.mats.get('#d8c08a')
    this.fix(bank, false)

    // stilt fishing huts over the water
    for (const z of [22, 34, 48, -30, -46]) {
      const hut = MeshBuilder.CreateBox('stilt-hut', { width: 4, height: 2.4, depth: 3.5 }, s)
      hut.position.set(-56, 3.2, z)
      hut.material = this.mats.get('#9a6a43')
      this.fix(hut)
      const hr = MeshBuilder.CreateCylinder('stilt-roof', { diameterTop: 0, diameterBottom: 6, height: 1.8, tessellation: 4 }, s)
      hr.position.set(-56, 5.3, z)
      hr.rotation.y = Math.PI / 4
      hr.material = this.mats.get('#c7a35a')
      this.fix(hr)
      for (const [dx, dz] of [[-1.7, -1.5], [1.7, -1.5], [-1.7, 1.5], [1.7, 1.5]]) {
        const st = MeshBuilder.CreateCylinder('stilt', { diameter: 0.18, height: 2.2 }, s)
        st.position.set(-56 + dx, 1, z + dz)
        st.material = this.mats.get('#5c4130')
        this.fix(st)
      }
      const pier = MeshBuilder.CreateBox('pier', { width: 6, height: 0.15, depth: 1.2 }, s)
      pier.position.set(-51.5, 1.95, z)
      pier.material = this.mats.get('#8a6a48')
      this.fix(pier)
    }
    // canoes drifting downstream
    for (let i = 0; i < 3; i++) {
      const canoe = new TransformNode('canoe', s)
      const hull = MeshBuilder.CreateCylinder('hull', { diameter: 0.9, height: 5, tessellation: 8 }, s)
      hull.rotation.x = Math.PI / 2
      hull.scaling.set(1, 1, 0.5)
      hull.parent = canoe
      hull.material = this.mats.get('#6b4226')
      const rower = createHumanoid(s, this.mats, `rower${i}`, LOOKS[i + 2])
      rower.root.parent = canoe
      rower.root.position.y = -0.7
      rower.root.scaling.setAll(0.9)
      canoe.position.set(-64 + i * 3, 0.25, -120 + i * 80)
      this.canoes.push(canoe)
    }
    // river pump station
    const ps = MeshBuilder.CreateBox('pump-station', { width: 3, height: 2.4, depth: 3 }, s)
    ps.position.set(-46, 1.2, -9)
    ps.material = this.mats.get('#d6c7a7')
    this.fix(ps)
    const pipe = MeshBuilder.CreateCylinder('pipe', { diameter: 0.35, height: 9 }, s)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(-51, 0.5, -9)
    pipe.material = this.mats.get('#5a6a72', { spec: 0.4 })
    this.fix(pipe)
    const pSign = makeSign(s, 'RIVER PUMP', '#1f5f8b', 5)
    pSign.position.set(-46, 4.2, -9)
    this.obstacles.push(rectAt(-46, -9, 3.2, 3.2))
    this.zones.push({ kind: 'riverPump', x: -45, z: -5.5, r: 4.5 })
  }

  private buildVegetation() {
    const s = this.scene
    const palm = createPalmTemplate(s, this.mats)
    const broad = createBroadTreeTemplate(s, this.mats)
    const bush = MeshBuilder.CreateIcoSphere('bush', { radius: 1, subdivisions: 1 }, s)
    bush.material = this.mats.get('#3f7d32')
    for (const t of [palm, broad, bush]) {
      t.position.y = -100
      t.receiveShadows = true
      this.shadows.addShadowCaster(t)
    }
    const blocked: Rect[] = [
      ...this.obstacles.map((o) => ({ minX: o.minX - 2, maxX: o.maxX + 2, minZ: o.minZ - 2, maxZ: o.maxZ + 2 })),
      { minX: -5, maxX: 5, minZ: -80, maxZ: 80 },
      { minX: -50, maxX: 75, minZ: -5, maxZ: 5 },
      { minX: 0, maxX: 44, minZ: -42, maxZ: -12 },
      { minX: 17, maxX: 64, minZ: 6, maxZ: 30 },
      { minX: -36, maxX: -8, minZ: 6, maxZ: 26 },
      { minX: -14, maxX: 2, minZ: -4, maxZ: 16 },
      { minX: -90, maxX: -47, minZ: -200, maxZ: 200 },
    ]
    const r = rng(42)
    const count = this.mobile ? 90 : 170
    let placed = 0
    let guard = 0
    while (placed < count && guard++ < 4000) {
      const x = -46 + r() * 150
      const z = -110 + r() * 220
      if (blocked.some((b) => inRect(x, z, b))) continue
      const roll = r()
      const tpl = roll < 0.55 ? palm : roll < 0.8 ? broad : bush
      const inst = tpl.createInstance('veg')
      inst.position.set(x, tpl === bush ? 0.3 : 0, z)
      inst.rotation.y = r() * Math.PI * 2
      const sc = tpl === bush ? 0.8 + r() * 0.9 : 0.75 + r() * 0.55
      inst.scaling.set(sc, tpl === bush ? sc * 0.7 : sc, sc)
      this.fix(inst, false)
      if (tpl !== bush && Math.abs(x) < 75 && Math.abs(z) < 75) this.obstacles.push(rectAt(x, z, 0.9, 0.9))
      placed++
    }
  }

  private buildPeople() {
    const s = this.scene
    const routes: { path: [number, number][]; speed: number }[] = [
      { path: [[-2, -60], [-2, 60]], speed: 1.6 },
      { path: [[2, 55], [2, -55]], speed: 1.3 },
      { path: [[-40, -2], [64, -2]], speed: 1.5 },
      { path: [[60, 2], [-35, 2]], speed: 1.8 },
      { path: [[-26, 11], [-18, 11], [-18, 18], [-26, 18]], speed: 1.0 },
      { path: [[-14, 24], [-30, 24]], speed: 1.1 },
      { path: [[13, -15], [40, -15], [40, -19], [13, -19]], speed: 1.2 },
      { path: [[50, 12], [32, 12], [32, 6]], speed: 1.4 },
      { path: [[-44, -5], [-8, -5], [-8, -17], [-40, -17]], speed: 1.2 },
    ]
    routes.forEach((r, i) => {
      const h = createHumanoid(s, this.mats, `npc${i}`, LOOKS[i % LOOKS.length])
      h.meshes.forEach((m) => this.shadows.addShadowCaster(m))
      const path = r.path.map(([x, z]) => new Vector3(x, 0, z))
      h.root.position.copyFrom(path[0])
      this.npcs.push({ h, path, idx: 1, speed: r.speed, work: false })
    })
    // factory workers & market sellers (stationary, working)
    const workers: [number, number, number][] = [
      [29, 22.9, 0], [31.8, 22.9, 0], [22, 22.6, 0], [25.5, 24.2, 0], [-30, 15.5, Math.PI], [-22, 22.5, Math.PI], [-14, 15.5, Math.PI],
    ]
    workers.forEach(([x, z, yaw], i) => {
      const h = createHumanoid(s, this.mats, `worker${i}`, LOOKS[(i + 3) % LOOKS.length])
      h.meshes.forEach((m) => this.shadows.addShadowCaster(m))
      h.root.position.set(x, 0, z)
      h.root.rotation.y = yaw
      this.npcs.push({ h, path: [], idx: 0, speed: 0, work: true })
    })
  }

  private buildVehicles() {
    const t = createTractor(this.scene, this.mats)
    const k = createTanker(this.scene, this.mats)
    for (const rig of [t, k]) rig.meshes.forEach((m) => this.shadows.addShadowCaster(m))
    this.vehicles.push(
      { kind: 'tractor', rig: t, pos: new Vector3(9, 0, -12), yaw: Math.PI / 2, speed: 0, maxSpeed: 8 },
      { kind: 'tanker', rig: k, pos: new Vector3(-8, 0, -18), yaw: 0, speed: 0, maxSpeed: 11 },
    )
    const vSign = makeSign(this.scene, 'VEHICLE YARD', '#3a3330', 5)
    vSign.position.set(-4.5, 4, -14)
  }

  private buildWeather() {
    const s = this.scene
    const rain = (this.rain = new ParticleSystem('rain', this.mobile ? 1200 : 3000, s))
    const tex = makeDotTexture(s, 'rain-tex')
    rain.particleTexture = tex
    rain.emitter = new Vector3(0, 20, 0)
    rain.minEmitBox = new Vector3(-28, 0, -28)
    rain.maxEmitBox = new Vector3(28, 0, 28)
    rain.direction1 = new Vector3(-0.1, -1, 0)
    rain.direction2 = new Vector3(0.1, -1, 0.05)
    rain.minEmitPower = 26
    rain.maxEmitPower = 32
    rain.minLifeTime = 0.6
    rain.maxLifeTime = 0.8
    rain.minSize = 0.05
    rain.maxSize = 0.09
    rain.minScaleY = 6
    rain.maxScaleY = 9
    rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
    rain.color1 = new Color4(0.75, 0.82, 0.95, 0.55)
    rain.color2 = new Color4(0.7, 0.78, 0.9, 0.45)
    rain.colorDead = new Color4(0.7, 0.78, 0.9, 0)
    rain.emitRate = 0
    rain.start()
  }

  // ------------------------------------------------------------------ simulation

  private clampToBounds(p: Vector3) {
    p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x))
    p.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, p.z))
  }

  private collide(p: Vector3, radius: number) {
    for (const o of this.obstacles) {
      if (!inRect(p.x, p.z, o, radius)) continue
      const pushL = p.x - (o.minX - radius)
      const pushR = o.maxX + radius - p.x
      const pushD = p.z - (o.minZ - radius)
      const pushU = o.maxZ + radius - p.z
      const m = Math.min(pushL, pushR, pushD, pushU)
      if (m === pushL) p.x -= pushL
      else if (m === pushR) p.x += pushR
      else if (m === pushD) p.z -= pushD
      else p.z += pushU
    }
    this.clampToBounds(p)
  }

  private nearestVehicle(): Vehicle | null {
    let best: Vehicle | null = null
    let bd = 3.6
    for (const v of this.vehicles) {
      const d = Vector3.Distance(v.pos, this.playerPos)
      if (d < bd) {
        bd = d
        best = v
      }
    }
    return best
  }

  private plotAt(x: number, z: number, pad: number) {
    return this.plots.findIndex((p) => inRect(x, z, p.rect, pad))
  }

  private update(dt: number) {
    if (this.disposed) return
    const store = this.store
    store.tick(dt)
    const st = store.state
    const input = this.readInput()

    // camera-relative basis
    const cam = this.camera
    const fwd = cam.target.subtract(cam.position)
    fwd.y = 0
    fwd.normalize()
    const right = Vector3.Cross(Vector3.Up(), fwd)

    let focus: Vector3
    if (this.driving) {
      const v = this.driving
      const target = input.z * v.maxSpeed * (input.z < 0 ? 0.45 : 1)
      v.speed += (target - v.speed) * Math.min(1, dt * 1.8)
      const steer = input.x * Math.min(1, Math.abs(v.speed) / 2.5) * Math.sign(v.speed || 1)
      v.yaw += steer * dt * 1.5
      v.pos.x += Math.sin(v.yaw) * v.speed * dt
      v.pos.z += Math.cos(v.yaw) * v.speed * dt
      this.collide(v.pos, 1.5)
      focus = v.pos
      // field work while driving
      const id = this.plotAt(v.pos.x, v.pos.z, 0)
      if (id >= 0 && Math.abs(v.speed) > 1) {
        if (v.kind === 'tractor' && st.plots[id].stage === 'wild') store.till(id, true)
        if (v.kind === 'tanker' && st.plots[id].stage === 'planted' && st.plots[id].water < 0.85 && st.tankerWater >= 10) store.water(id, 'tanker')
      }
    } else {
      const dir = fwd.scale(input.z).add(right.scale(input.x))
      const mag = Math.min(1, dir.length())
      const speed = (input.sprint ? 7.2 : 4.3) * mag
      if (mag > 0.05) {
        dir.normalize()
        this.playerPos.addInPlace(dir.scale(speed * dt))
        const targetYaw = Math.atan2(dir.x, dir.z)
        let dy = targetYaw - this.playerYaw
        while (dy > Math.PI) dy -= Math.PI * 2
        while (dy < -Math.PI) dy += Math.PI * 2
        this.playerYaw += dy * Math.min(1, dt * 12)
      }
      this.collide(this.playerPos, 0.4)
      this.player.root.position.copyFrom(this.playerPos)
      this.player.root.rotation.y = this.playerYaw
      animateHumanoid(this.player, speed / 7.2, dt)
      focus = this.playerPos
    }

    // vehicles
    for (const v of this.vehicles) {
      if (v !== this.driving) v.speed *= Math.max(0, 1 - dt * 3)
      v.rig.root.position.copyFrom(v.pos)
      v.rig.root.rotation.y = v.yaw
      for (const w of v.rig.wheels) w.mesh.rotation.x += (v.speed * dt) / w.radius
    }

    // camera follow
    const desired = focus.add(new Vector3(0, this.driving ? 2.2 : 1.6, 0))
    cam.target.copyFrom(Vector3.Lerp(cam.target, desired, Math.min(1, dt * 7)))

    // NPCs
    for (const n of this.npcs) {
      if (n.work) {
        animateHumanoid(n.h, 0, dt, true)
        continue
      }
      const pos = n.h.root.position
      const goal = n.path[n.idx]
      const d = goal.subtract(pos)
      d.y = 0
      const dist = d.length()
      if (dist < 0.3) n.idx = (n.idx + 1) % n.path.length
      else {
        d.scaleInPlace(1 / dist)
        pos.addInPlace(d.scale(n.speed * dt))
        n.h.root.rotation.y = Math.atan2(d.x, d.z)
      }
      animateHumanoid(n.h, n.speed / 4, dt)
    }

    // canoes
    for (const c of this.canoes) {
      c.position.z += dt * 1.6
      if (c.position.z > 140) c.position.z = -140
    }

    this.updatePlots()
    this.updateSky(st.timeOfDay, st.weather, focus)
    this.updateInteraction()
  }

  private updatePlots() {
    const st = this.store.state
    const wildMat = this.mats.get('#5f8a34')
    const dryMat = this.mats.get('#7a5134')
    const wetMat = this.mats.get('#4a2f1e')
    st.plots.forEach((p, i) => {
      const v = this.plots[i]
      const growthStep = Math.round(p.growth * 40)
      const key = `${p.stage}|${growthStep}|${p.water > 0.05 ? 1 : 0}|${p.weeds > 0.4 ? 1 : 0}`
      if (key === v.key) {
        if (p.stage === 'mature') v.marker.rotation.y += 0.04
        return
      }
      v.key = key
      v.soil.material = p.stage === 'wild' ? wildMat : p.water > 0.05 ? wetMat : dryMat
      v.ridges.forEach((r) => r.setEnabled(p.stage !== 'wild'))
      const showWeeds = p.stage === 'wild' || (p.stage === 'planted' && p.weeds > 0.4)
      v.weeds.forEach((w) => w.setEnabled(showWeeds))
      const showPlants = p.stage === 'planted' || p.stage === 'mature'
      const sc = 0.12 + p.growth * 0.95
      v.plants.forEach((pl) => {
        pl.setEnabled(showPlants)
        pl.scaling.setAll(sc)
      })
      v.marker.setEnabled(p.stage === 'mature')
    })
  }

  private updateSky(t: number, weather: 'clear' | 'rain', focus: Vector3) {
    const angle = ((t - 6) / 12) * Math.PI
    const elev = Math.sin(angle)
    const day = Math.min(1, Math.max(0, elev * 1.8 + 0.15))
    const wet = weather === 'rain' ? 1 : 0
    const night = hex('#0d1533')
    const dawn = hex('#f08c55')
    const noon = hex('#94cbeb')
    const storm = hex('#6f7a86')
    let sky = Color3.Lerp(night, dawn, Math.min(1, Math.max(0, (elev + 0.18) / 0.3)))
    sky = Color3.Lerp(sky, noon, Math.min(1, Math.max(0, (elev - 0.08) / 0.35)))
    if (wet) sky = Color3.Lerp(sky, storm.scale(0.4 + day * 0.6), 0.6)
    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1)
    this.scene.fogColor = sky
    this.scene.fogDensity = wet ? 0.011 : 0.0065

    const sunUp = elev > -0.05
    const dirAngle = sunUp ? angle : angle + Math.PI
    this.sun.direction = new Vector3(-Math.cos(dirAngle), -Math.max(0.25, Math.abs(Math.sin(dirAngle))), 0.45).normalize()
    this.sun.position = focus.subtract(this.sun.direction.scale(70))
    this.sun.intensity = (sunUp ? 0.25 + day * 1.55 : 0.22) * (wet ? 0.5 : 1)
    this.sun.diffuse = sunUp ? Color3.Lerp(hex('#ffb37a'), hex('#fff4e0'), Math.min(1, elev * 2)) : hex('#8ea6ff')
    this.hemi.intensity = 0.28 + day * 0.5
    this.hemi.diffuse = Color3.Lerp(hex('#5a6aa8'), hex('#e8f1ff'), day)
    this.hemi.groundColor = Color3.Lerp(hex('#1a1a2a'), hex('#6b5a3a'), day)
    this.lampMat.emissiveColor = day < 0.35 ? hex('#ffc864') : hex('#3a2a10')

    this.rain.emitRate = wet ? (this.mobile ? 900 : 2200) : 0
    ;(this.rain.emitter as Vector3).set(focus.x, 20, focus.z)
  }

  private updateInteraction() {
    const store = this.store
    const st = store.state
    let prompt: { label: string; sub?: string; disabled?: boolean } | null = null
    let action: (() => void) | null = null
    let zone: Zone | null = null

    if (this.driving) {
      const v = this.driving
      const nearPump = this.zones.find((z) => (z.kind === 'riverPump' || z.kind === 'borehole') && Math.hypot(v.pos.x - z.x, v.pos.z - z.z) < z.r + 3)
      if (v.kind === 'tanker' && nearPump) {
        prompt = { label: 'Refill tanker', sub: `Tank ${st.tankerWater}%` }
        action = () => store.refillTanker()
      } else
        prompt = {
          label: v.kind === 'tractor' ? 'Drive over wild plots to till' : 'Drive over planted plots to water',
          sub: v.kind === 'tanker' ? `Tank ${st.tankerWater}% · refill at the river pump` : 'Tractor engaged',
          disabled: true,
        }
      store.setNearVehicle(null)
    } else {
      const p = this.playerPos
      const id = this.plotAt(p.x, p.z, 0.9)
      if (id >= 0) {
        const plot = st.plots[id]
        const n = id + 1
        if (plot.stage === 'wild') {
          prompt = { label: `Clear & till plot ${n}`, sub: 'Prepare the soil into ridges' }
          action = () => store.till(id)
        } else if (plot.stage === 'tilled') {
          prompt = { label: `Plant cassava stems`, sub: `${st.stems} stems in your bag`, disabled: st.stems <= 0 }
          action = () => store.plant(id)
        } else if (plot.stage === 'planted') {
          const pct = Math.round(plot.growth * 100)
          if (plot.water < 0.35) {
            prompt = { label: 'Water the cassava', sub: `Growth ${pct}% · can ${st.waterCan}/5`, disabled: st.waterCan <= 0 }
            action = () => store.water(id)
          } else if (plot.weeds > 0.4) {
            prompt = { label: 'Pull the weeds', sub: `Weeds are slowing growth (${pct}%)` }
            action = () => store.weed(id)
          } else prompt = { label: `Growing · ${pct}%`, sub: `Water ${Math.round(plot.water * 100)}% · weeds ${Math.round(plot.weeds * 100)}%`, disabled: true }
        } else {
          prompt = { label: 'Harvest cassava', sub: 'Roots are ready to lift' }
          action = () => store.harvest(id)
        }
      } else {
        zone = this.zones.find((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r) ?? null
        if (zone) {
          const panelFor: Record<string, Panel> = { factory: 'factory', warehouse: 'warehouse', market: 'market' }
          const label: Record<Zone['kind'], string> = {
            borehole: 'Refill watering can',
            riverPump: 'Refill watering can',
            factory: 'Enter garri factory',
            warehouse: 'Open warehouse',
            market: 'Trade at Oja market',
          }
          prompt = { label: label[zone.kind] }
          if (zone.kind === 'borehole' || zone.kind === 'riverPump') {
            prompt.sub = `Can ${st.waterCan}/5`
            action = () => store.refillCan()
          } else {
            const panel = panelFor[zone.kind]
            action = () => store.setPanel(st.panel === panel ? null : panel)
          }
        }
      }
      const near = this.nearestVehicle()
      store.setNearVehicle(near?.kind ?? null)
    }

    // panels close when the player walks away
    if (st.panel && (!zone || zone.kind !== st.panel)) store.setPanel(null)
    this.action = action
    store.setPrompt(prompt)
  }
}
