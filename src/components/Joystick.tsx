import { useRef, useState, type PointerEvent } from 'react'

/** Virtual thumbstick. Reports x (right +) and y (forward +) in -1..1. */
export function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  const update = (e: PointerEvent) => {
    const el = base.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const radius = r.width / 2
    let dx = e.clientX - (r.left + radius)
    let dy = e.clientY - (r.top + radius)
    const len = Math.hypot(dx, dy)
    if (len > radius) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    setKnob({ x: dx, y: dy })
    onMove(dx / radius, -dy / radius)
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onMove(0, 0)
  }

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        active.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
