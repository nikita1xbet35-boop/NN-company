import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch() {
    // Hide splash when error caught
    if (window.__ready) window.__ready()
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding:'40px 20px', textAlign:'center', color:'#f1f1f1',
          background:'#0f0f13', minHeight:'100vh',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'16px',
        }}>
          <div style={{fontSize:'48px'}}>⚠️</div>
          <div style={{fontSize:'18px', fontWeight:700}}>Ошибка загрузки</div>
          <div style={{fontSize:'13px', color:'#6b7280', maxWidth:'300px', wordBreak:'break-word'}}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding:'12px 24px', borderRadius:'12px', border:'none',
              background:'#6366f1', color:'#fff',
              fontSize:'14px', fontWeight:600, cursor:'pointer',
            }}
          >Перезагрузить</button>
        </div>
      )
    }
    return this.props.children
  }
}
