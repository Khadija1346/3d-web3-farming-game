import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core'

/**
 * Procedural low-poly asset kit for the village. Everything is built from primitives at
 * runtime (no downloaded models), so there are no third-party asset licences to manage and
 * the whole world streams in a few hundred KB. A later milestone can swap individual
 * builders for licensed glTF models without touching the game logic.
 */

export const hex = (h: string) => Color3.FromHexString(h)

export class Mats {
  private cache = new Map<string, StandardMaterial>()
  constructor(private scene: Scene) {}
  get(color: string, opts: { spec?: number; emissive?: string; alpha?: number } = {}) {
    const key = `${color}|${opts.spec ?? ''}|${opts.emissive ?? ''}|${opts.alpha ?? ''}`
    let m = this.cache.get(key)
    if (!m) {
      m = new StandardMaterial(`m-${key}`, this.scene)
      m.diffuseColor = hex(color)
      const s = opts.spec ?? 0.04
      m.specularColor = new Color3(s, s, s)
      if (opts.emissive) m.emissiveColor = hex(opts.emissive)
      if (opts.alpha !== undefined) m.alpha = opts.alpha
      this.cache.set(key, m)
    }
    return m
  }
}

const box = (scene: Scene, name: string, w: number, h: number, d: number) =>
  MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)

// ---------------------------------------------------------------- characters

export interface Look {
  skin: string
  top: string
  bottom: string
  hair: string
  wrap?: string
}

export interface Humanoid {
  root: TransformNode
  lArm: TransformNode
  rArm: TransformNode
  lLeg: TransformNode
  rLeg: TransformNode
  meshes: Mesh[]
  phase: number
}

export function createHumanoid(scene: Scene, mats: Mats, name: string, look: Look): Humanoid {
  const root = new TransformNode(name, scene)
  const meshes: Mesh[] = []
  const add = (m: Mesh, parent: TransformNode, color: string) => {
    m.parent = parent
    m.material = mats.get(color)
    meshes.push(m)
    return m
  }
  add(box(scene, `${name}-torso`, 0.52, 0.62, 0.3), root, look.top).position.y = 1.27
  add(box(scene, `${name}-hips`, 0.5, 0.24, 0.31), root, look.bottom).position.y = 0.9
  const head = add(MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.34, segments: 10 }, scene), root, look.skin)
  head.position.y = 1.78
  if (look.wrap) {
    const wrap = add(MeshBuilder.CreateCylinder(`${name}-wrap`, { diameterTop: 0.46, diameterBottom: 0.34, height: 0.22, tessellation: 10 }, scene), root, look.wrap)
    wrap.position.y = 1.93
  } else {
    const hair = add(MeshBuilder.CreateSphere(`${name}-hair`, { diameter: 0.36, segments: 8 }, scene), root, look.hair)
    hair.scaling.y = 0.55
    hair.position.y = 1.88
  }
  for (const side of [-1, 1]) {
    const eye = add(MeshBuilder.CreateSphere(`${name}-eye`, { diameter: 0.05, segments: 4 }, scene), root, '#140c08')
    eye.position.set(side * 0.07, 1.8, 0.155)
  }
  const limb = (x: number, y: number, w: number, h: number, color: string, endColor: string) => {
    const pivot = new TransformNode(`${name}-pivot`, scene)
    pivot.parent = root
    pivot.position.set(x, y, 0)
    add(box(scene, `${name}-limb`, w, h, w), pivot, color).position.y = -h / 2
    const end = add(box(scene, `${name}-end`, w * 1.05, 0.14, w * 1.4), pivot, endColor)
    end.position.set(0, -h - 0.04, w * 0.2)
    return pivot
  }
  const lArm = limb(-0.34, 1.55, 0.13, 0.6, look.top, look.skin)
  const rArm = limb(0.34, 1.55, 0.13, 0.6, look.top, look.skin)
  const lLeg = limb(-0.13, 0.84, 0.17, 0.72, look.bottom, '#2a1a10')
  const rLeg = limb(0.13, 0.84, 0.17, 0.72, look.bottom, '#2a1a10')
  return { root, lArm, rArm, lLeg, rLeg, meshes, phase: Math.random() * 6 }
}

/** speed01: 0 = idle, 1 = full run. work = arms busy (stirring, sieving). */
export function animateHumanoid(h: Humanoid, speed01: number, dt: number, work = false) {
  h.phase += dt * (work ? 5 : 5 + speed01 * 5)
  const swing = Math.sin(h.phase) * 0.75 * speed01
  h.lLeg.rotation.x = swing
  h.rLeg.rotation.x = -swing
  if (work) {
    h.lArm.rotation.x = -0.9 + Math.sin(h.phase) * 0.35
    h.rArm.rotation.x = -0.9 + Math.cos(h.phase) * 0.35
  } else {
    h.lArm.rotation.x = -swing * 0.9
    h.rArm.rotation.x = swing * 0.9
  }
  h.meshes[0].position.y = 1.27 + Math.abs(Math.sin(h.phase)) * 0.04 * speed01
}

// ---------------------------------------------------------------- vehicles

export interface VehicleRig {
  root: TransformNode
  wheels: { mesh: Mesh; radius: number }[]
  meshes: Mesh[]
}

function wheel(scene: Scene, mats: Mats, rig: VehicleRig, d: number, w: number, x: number, y: number, z: number) {
  const m = MeshBuilder.CreateCylinder('wheel', { diameter: d, height: w, tessellation: 14 }, scene)
  m.rotation.z = Math.PI / 2
  m.position.set(x, y, z)
  m.parent = rig.root
  m.material = mats.get('#1c1a18')
  const hub = MeshBuilder.CreateCylinder('hub', { diameter: d * 0.45, height: w + 0.02, tessellation: 8 }, scene)
  hub.parent = m
  hub.material = mats.get('#d8b13a', { spec: 0.3 })
  rig.wheels.push({ mesh: m, radius: d / 2 })
  rig.meshes.push(m, hub)
}

function part(scene: Scene, mats: Mats, rig: VehicleRig, color: string, w: number, h: number, d: number, x: number, y: number, z: number, spec = 0.25) {
  const m = box(scene, 'part', w, h, d)
  m.position.set(x, y, z)
  m.parent = rig.root
  m.material = mats.get(color, { spec })
  rig.meshes.push(m)
  return m
}

export function createTractor(scene: Scene, mats: Mats): VehicleRig {
  const rig: VehicleRig = { root: new TransformNode('tractor', scene), wheels: [], meshes: [] }
  part(scene, mats, rig, '#b8321f', 1.25, 0.7, 2.8, 0, 1.05, 0.1)
  part(scene, mats, rig, '#c93a24', 1.0, 0.6, 1.4, 0, 1.6, 0.75)
  part(scene, mats, rig, '#2b2622', 0.95, 0.35, 0.1, 0, 1.25, 1.52)
  part(scene, mats, rig, '#3a302a', 0.7, 0.12, 0.6, 0, 1.7, -0.7)
  part(scene, mats, rig, '#3a302a', 0.7, 0.6, 0.12, 0, 2.0, -1.0)
  part(scene, mats, rig, '#e8e0cf', 1.5, 0.08, 1.6, 0, 3.0, -0.55, 0.1)
  for (const x of [-0.68, 0.68]) for (const z of [-1.25, 0.15]) part(scene, mats, rig, '#2b2622', 0.07, 1.45, 0.07, x, 2.27, z - 0.0)
  const stack = MeshBuilder.CreateCylinder('stack', { diameter: 0.12, height: 0.9 }, scene)
  stack.parent = rig.root
  stack.position.set(0.32, 2.2, 1.05)
  stack.material = mats.get('#222')
  rig.meshes.push(stack)
  // tiller behind
  part(scene, mats, rig, '#5b524a', 2.2, 0.18, 0.4, 0, 0.45, -1.9)
  for (const x of [-0.8, -0.27, 0.27, 0.8]) part(scene, mats, rig, '#77706a', 0.08, 0.45, 0.12, x, 0.25, -1.9)
  wheel(scene, mats, rig, 1.55, 0.5, -0.9, 0.78, -0.55)
  wheel(scene, mats, rig, 1.55, 0.5, 0.9, 0.78, -0.55)
  wheel(scene, mats, rig, 0.85, 0.32, -0.75, 0.43, 1.1)
  wheel(scene, mats, rig, 0.85, 0.32, 0.75, 0.43, 1.1)
  return rig
}

export function createTanker(scene: Scene, mats: Mats): VehicleRig {
  const rig: VehicleRig = { root: new TransformNode('tanker', scene), wheels: [], meshes: [] }
  part(scene, mats, rig, '#2f2a26', 1.9, 0.35, 5.6, 0, 0.85, 0)
  part(scene, mats, rig, '#f1ede4', 2.0, 1.5, 1.7, 0, 1.75, 1.9)
  part(scene, mats, rig, '#1e3c55', 1.85, 0.6, 0.08, 0, 2.05, 2.76, 0.8)
  part(scene, mats, rig, '#1f6f8b', 2.02, 0.35, 1.72, 0, 1.15, 1.9)
  const tank = MeshBuilder.CreateCylinder('tank', { diameter: 1.75, height: 3.5, tessellation: 18 }, scene)
  tank.rotation.x = Math.PI / 2
  tank.position.set(0, 1.95, -0.85)
  tank.parent = rig.root
  tank.material = mats.get('#2b8fb3', { spec: 0.5 })
  rig.meshes.push(tank)
  wheel(scene, mats, rig, 0.95, 0.4, -0.95, 0.5, 1.9)
  wheel(scene, mats, rig, 0.95, 0.4, 0.95, 0.5, 1.9)
  wheel(scene, mats, rig, 0.95, 0.4, -0.95, 0.5, -1.2)
  wheel(scene, mats, rig, 0.95, 0.4, 0.95, 0.5, -1.2)
  wheel(scene, mats, rig, 0.95, 0.4, -0.95, 0.5, -2.2)
  wheel(scene, mats, rig, 0.95, 0.4, 0.95, 0.5, -2.2)
  return rig
}

// ---------------------------------------------------------------- buildings & props

export function createHouseTemplate(scene: Scene, mats: Mats, name: string, wall: string, roof: string): Mesh {
  const parts: Mesh[] = []
  const add = (m: Mesh, color: string, spec = 0.04) => {
    m.material = mats.get(color, { spec })
    parts.push(m)
    return m
  }
  add(box(scene, 'body', 6, 3, 5), wall).position.y = 1.5
  add(box(scene, 'plinth', 6.3, 0.35, 5.3), '#8a5a3a').position.y = 0.17
  for (const s of [-1, 1]) {
    const r = add(box(scene, 'roof', 7, 0.12, 3.25), roof, 0.35)
    r.rotation.x = s * 0.5
    r.position.set(0, 3.75, s * 1.35)
  }
  // triangular prism filling the space under the pitched roof (apex up, axis along x)
  const gable = add(MeshBuilder.CreateCylinder('gable', { diameter: 5.77, height: 5.9, tessellation: 3 }, scene), wall)
  gable.rotation.z = Math.PI / 2
  gable.scaling.x = 0.316
  gable.position.y = 3.456
  add(box(scene, 'door', 1.1, 2.0, 0.08), '#4a2c1a').position.set(-1.2, 1.15, 2.52)
  for (const x of [0.9, 2.1]) add(box(scene, 'win', 0.8, 0.8, 0.08), '#2a3b45', 0.5).position.set(x, 1.8, 2.52)
  add(box(scene, 'win', 0.08, 0.8, 0.9), '#2a3b45', 0.5).position.set(3.02, 1.8, 0)
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!
  merged.name = name
  return merged
}

export function createPalmTemplate(scene: Scene, mats: Mats): Mesh {
  const parts: Mesh[] = []
  const trunk = MeshBuilder.CreateCylinder('trunk', { height: 7, diameterTop: 0.28, diameterBottom: 0.5, tessellation: 7 }, scene)
  trunk.position.y = 3.5
  trunk.material = mats.get('#7a5a3c')
  parts.push(trunk)
  for (let i = 0; i < 8; i++) {
    const frond = box(scene, 'frond', 0.7, 0.05, 3.6)
    const a = (i / 8) * Math.PI * 2
    frond.rotation.set(0.45 + (i % 2) * 0.25, a, 0)
    frond.position.set(Math.sin(a) * 1.5, 6.7 - (i % 2) * 0.2, Math.cos(a) * 1.5)
    frond.material = mats.get(i % 2 ? '#3f8a35' : '#2f7a2e')
    parts.push(frond)
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!
  merged.name = 'palm'
  return merged
}

export function createBroadTreeTemplate(scene: Scene, mats: Mats): Mesh {
  const parts: Mesh[] = []
  const trunk = MeshBuilder.CreateCylinder('trunk', { height: 3.2, diameterTop: 0.5, diameterBottom: 0.8, tessellation: 7 }, scene)
  trunk.position.y = 1.6
  trunk.material = mats.get('#5c4130')
  parts.push(trunk)
  const blobs: [number, number, number, number][] = [
    [0, 4.4, 0, 4.2],
    [1.3, 3.9, 0.4, 2.8],
    [-1.2, 4.0, -0.5, 3],
    [0.2, 5.4, -0.6, 2.6],
  ]
  blobs.forEach(([x, y, z, d], i) => {
    const b = MeshBuilder.CreateIcoSphere('leaf', { radius: d / 2, subdivisions: 1 }, scene)
    b.position.set(x, y, z)
    b.material = mats.get(i % 2 ? '#4c8f3a' : '#3b7d31')
    parts.push(b)
  })
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!
  merged.name = 'broadtree'
  return merged
}

export function createCassavaTemplate(scene: Scene, mats: Mats): Mesh {
  const parts: Mesh[] = []
  const stem = MeshBuilder.CreateCylinder('stem', { height: 1.5, diameter: 0.06, tessellation: 5 }, scene)
  stem.position.y = 0.75
  stem.material = mats.get('#8b4a3a')
  parts.push(stem)
  for (const [y, n, len] of [
    [1.5, 7, 0.55],
    [1.05, 5, 0.45],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const leaf = box(scene, 'leaf', 0.11, 0.02, len)
      const a = (i / n) * Math.PI * 2 + y
      leaf.rotation.set(0.55, a, 0)
      leaf.position.set(Math.sin(a) * len * 0.45, y - 0.08, Math.cos(a) * len * 0.45)
      leaf.material = mats.get(i % 2 ? '#4fa63d' : '#3d9033')
      parts.push(leaf)
    }
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!
  merged.name = 'cassava'
  return merged
}

export function makeSign(scene: Scene, text: string, bg: string, width = 7): Mesh {
  const tex = new DynamicTexture(`sign-${text}`, { width: 1024, height: 192 }, scene, true)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1024, 192)
  ctx.strokeStyle = '#f6e7c8'
  ctx.lineWidth = 10
  ctx.strokeRect(14, 14, 996, 164)
  ctx.fillStyle = '#fff8ea'
  ctx.font = 'bold 96px "Bricolage Grotesque", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 512, 100)
  tex.update()
  const mat = new StandardMaterial(`signm-${text}`, scene)
  mat.diffuseTexture = tex
  mat.emissiveColor = new Color3(0.55, 0.55, 0.55)
  mat.specularColor = Color3.Black()
  mat.backFaceCulling = false
  const plane = MeshBuilder.CreatePlane(`sign-${text}`, { width, height: width * (192 / 1024) }, scene)
  plane.material = mat
  plane.billboardMode = Mesh.BILLBOARDMODE_Y
  return plane
}

export function makeDotTexture(scene: Scene, name: string) {
  const tex = new DynamicTexture(name, { width: 64, height: 64 }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  tex.hasAlpha = true
  tex.update()
  return tex
}
