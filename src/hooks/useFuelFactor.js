import { useState, useCallback } from 'react'

const KEY = 'fuel-correction-factor'

function load() {
  try { return parseFloat(localStorage.getItem(KEY) || '1') || 1 } catch { return 1 }
}

export function useFuelFactor() {
  const [factor, setFactorState] = useState(load)

  const setFactor = useCallback((v) => {
    const n = parseFloat(v)
    if (!isFinite(n) || n <= 0) return
    try { localStorage.setItem(KEY, String(n)) } catch {}
    setFactorState(n)
  }, [])

  return [factor, setFactor]
}
