import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { BusinessListings } from './pages/BusinessListings'
import { Reservations } from './pages/Reservations'
import { Analytics } from './pages/Analytics'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/businesses" element={<BusinessListings />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Layout>
  )
}

export default App