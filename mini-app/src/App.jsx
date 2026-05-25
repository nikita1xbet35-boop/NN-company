import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { initTelegram } from './lib/telegram'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import AddLead from './pages/AddLead'
import LeadDetail from './pages/LeadDetail'
import Partners from './pages/Partners'
import PartnerCard from './pages/PartnerCard'
import PartnerApp from './pages/partner/PartnerApp'

export default function App() {
  const location = useLocation()
  const isPartnerRoute = location.pathname.startsWith('/partner')

  useEffect(() => {
    initTelegram()
    if (window.__ready) window.__ready()
    fetch('/api/setup').catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: isPartnerRoute ? '#080b12' : '#0f0f13', color: '#f1f1f1' }}>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/leads"         element={<Leads />} />
        <Route path="/leads/:id"     element={<LeadDetail />} />
        <Route path="/add"           element={<AddLead />} />
        <Route path="/partners"      element={<Partners />} />
        <Route path="/partners/:id"  element={<PartnerCard />} />
        <Route path="/partner/*"     element={<PartnerApp />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
      {!isPartnerRoute && <BottomNav />}
    </div>
  )
}
