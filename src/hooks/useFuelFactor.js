import { useRaceStore } from '../store/raceStore'

export function useFuelFactor() {
  const factor = useRaceStore(s => s.fuelFactor)
  const setFactor = useRaceStore(s => s.setFuelFactor)
  return [factor, setFactor]
}
