import { useMqtt } from './hooks/useMqtt'
import Dashboard from './components/Dashboard'

export default function App() {
  useMqtt()
  return <Dashboard />
}
