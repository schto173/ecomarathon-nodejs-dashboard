import { useRef, useState, useEffect } from 'react'

export default function Draggable({ defaultX, defaultY, storageKey, children }) {
  const [pos, setPos] = useState(() => {
    try {
      const s = storageKey && localStorage.getItem('drag_' + storageKey)
      return s ? JSON.parse(s) : { x: defaultX, y: defaultY }
    } catch {
      return { x: defaultX, y: defaultY }
    }
  })

  const posRef = useRef(pos)
  const drag   = useRef(null)

  useEffect(() => { posRef.current = pos }, [pos])

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return
      setPos({
        x: drag.current.startX + e.clientX - drag.current.mx,
        y: drag.current.startY + e.clientY - drag.current.my,
      })
    }
    const onUp = () => {
      if (!drag.current) return
      if (storageKey) {
        try { localStorage.setItem('drag_' + storageKey, JSON.stringify(posRef.current)) } catch {}
      }
      drag.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',  onUp)
    }
  }, [storageKey])

  const onMouseDown = (e) => {
    e.stopPropagation()   // prevent Leaflet map pan
    e.preventDefault()
    drag.current = { startX: pos.x, startY: pos.y, mx: e.clientX, my: e.clientY }
  }

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 1000, userSelect: 'none' }}
      onMouseDown={onMouseDown}
    >
      {/* Drag handle indicator */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-white/20 cursor-grab active:cursor-grabbing" />
      {children}
    </div>
  )
}
