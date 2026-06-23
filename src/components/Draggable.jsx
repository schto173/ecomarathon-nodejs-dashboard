import { useRef, useState, useEffect } from 'react'

export default function Draggable({ defaultX, defaultY, defaultScale = 1, storageKey, children }) {
  const [pos, setPos] = useState(() => {
    try {
      const s = storageKey && localStorage.getItem('drag_' + storageKey)
      if (s) { const p = JSON.parse(s); return { x: p.x, y: p.y, scale: p.scale ?? defaultScale } }
    } catch {}
    return { x: defaultX, y: defaultY, scale: defaultScale }
  })

  const posRef = useRef(pos)
  const drag   = useRef(null)
  const hovered = useRef(false)

  useEffect(() => { posRef.current = pos }, [pos])

  // Persist on change
  useEffect(() => {
    if (!storageKey) return
    try { localStorage.setItem('drag_' + storageKey, JSON.stringify(posRef.current)) } catch {}
  }, [pos, storageKey])

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return
      setPos(p => ({
        ...p,
        x: drag.current.startX + e.clientX - drag.current.mx,
        y: drag.current.startY + e.clientY - drag.current.my,
      }))
    }
    const onUp = () => { drag.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const onMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    drag.current = { startX: pos.x, startY: pos.y, mx: e.clientX, my: e.clientY }
  }

  const onWheel = (e) => {
    if (!hovered.current) return
    e.stopPropagation()
    e.preventDefault()
    setPos(p => ({
      ...p,
      scale: Math.min(3, Math.max(0.4, p.scale - e.deltaY * 0.001)),
    }))
  }

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 1000, userSelect: 'none',
               transform: `scale(${pos.scale})`, transformOrigin: 'top left' }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => { hovered.current = true }}
      onMouseLeave={() => { hovered.current = false }}
      onWheel={onWheel}
    >
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-white/20 cursor-grab active:cursor-grabbing" />
      {children}
    </div>
  )
}
