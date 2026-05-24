import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initTelegram } from './lib/telegram'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import AddLead from './pages/AddLead'
import LeadDetail from './pages/LeadDetail'

export default function App() {
  useEffect(() => {
    initTelegram()
    // Auto-setup Telegram webhook on first load (idempotent, safe to call every time)
    fetch('/api/setup').catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#f1f1f1' }}>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/leads"     element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/add"       element={<AddLead />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
