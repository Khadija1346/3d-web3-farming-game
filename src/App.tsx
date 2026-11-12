import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Hub from './pages/Hub'

// Babylon.js is heavy — only load it when someone actually enters the village.
const Play = lazy(() => import('./pages/Play'))

const Loading = () => (
  <div className="boot">
    <div className="boot-mark">G</div>
    <p>Loading the village…</p>
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play" element={<Play />} />
        <Route path="/embed" element={<Play embed />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  )
}
