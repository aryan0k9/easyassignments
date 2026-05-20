// ============================================
// MAIN.JSX - Entry point of your React app
// AuthProvider wraps everything so any component
// can access user data and auth functions
// ============================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import App from './App.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* AuthProvider gives ALL components access to:
          - user (current logged in user)
          - isAuthenticated (true/false)
          - logout() function
          - getUserName() helper
          - getUserAvatar() helper */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
