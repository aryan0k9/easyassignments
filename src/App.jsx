import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'

import TopBar from './components/TopBar'
import Header from './components/Header'
import Footer from './components/Footer'
import LiveChat from './components/LiveChat'

// Redirects logged-in students away from the public site to their dashboard
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

import Home from './pages/Home'
import Services from './pages/Services'
import About from './pages/About'
import Contact from './pages/Contact'
import Order from './pages/Order'
import Experts from './pages/Experts'
import SubjectDetail from './pages/SubjectDetail'
import Reviews from './pages/Reviews'
import PlagiarismChecker from './pages/PlagiarismChecker'
import WordCounter from './pages/WordCounter'
import InfoPage from './pages/InfoPage'
import CountryPage from './pages/CountryPage'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'

// Student Panel
import Dashboard from './pages/student/Dashboard'
import Messages from './pages/student/Messages'
import MyOrders from './pages/student/MyOrders'
import OrderDetail from './pages/student/OrderDetail'
import NewOrder from './pages/student/NewOrder'

import StudentNotifications from './pages/student/Notifications'
import Wallet from './pages/student/Wallet'
import Payments from './pages/student/Payments'
import Checkout from './pages/student/Checkout'
import Deadlines from './pages/student/Deadlines'
import MyFiles from './pages/student/MyFiles'
import Profile from './pages/student/Profile'
import Achievements from './pages/student/Achievements'
import Referrals from './pages/student/Referrals'
import DashboardExperts from './pages/student/Experts'

// Blog
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'

// Scroll to top whenever route changes
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/reset-password'
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const hideChrome = isAdminRoute || isAuthRoute || isDashboardRoute

  return (
    <>
      <ScrollToTop />

      {/* Hide top bar, header, footer, and WhatsApp on admin and auth routes */}
      {!hideChrome && (
        <>
          <TopBar />
          <Header />
        </>
      )}

      <main>
        <Routes>
          {/* Public site redirects to /dashboard if already logged in */}
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/services" element={<PublicRoute><Services /></PublicRoute>} />
          <Route path="/about" element={<PublicRoute><About /></PublicRoute>} />
          <Route path="/contact" element={<PublicRoute><Contact /></PublicRoute>} />
          <Route path="/order" element={<PublicRoute><Order /></PublicRoute>} />
          <Route path="/experts" element={<PublicRoute><Experts /></PublicRoute>} />
          <Route path="/reviews" element={<PublicRoute><Reviews /></PublicRoute>} />
          <Route path="/subject/:slug" element={<PublicRoute><SubjectDetail /></PublicRoute>} />
          <Route path="/subject-preview" element={<PublicRoute><SubjectDetail /></PublicRoute>} />

          {/* Tools */}
          <Route path="/tools/plagiarism-checker" element={<PublicRoute><PlagiarismChecker /></PublicRoute>} />
          <Route path="/tools/word-counter" element={<PublicRoute><WordCounter /></PublicRoute>} />

          {/* Info pages (Privacy, Terms, Honor Code, etc.) */}
          <Route path="/page/:slug" element={<PublicRoute><InfoPage /></PublicRoute>} />

          {/* Country pages */}
          <Route path="/country/:slug" element={<PublicRoute><CountryPage /></PublicRoute>} />

          {/* Auth pages */}
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Student Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/orders" element={<MyOrders />} />
          <Route path="/dashboard/orders/:orderId" element={<OrderDetail />} />
          <Route path="/dashboard/new-order" element={<NewOrder />} />
          <Route path="/dashboard/messages" element={<Messages />} />

          <Route path="/dashboard/notifications" element={<StudentNotifications />} />
          <Route path="/dashboard/wallet" element={<Wallet />} />
          <Route path="/dashboard/payments" element={<Payments />} />
          <Route path="/dashboard/checkout" element={<Checkout />} />
          <Route path="/dashboard/deadlines" element={<Deadlines />} />
          <Route path="/dashboard/files" element={<MyFiles />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/achievements" element={<Achievements />} />
          <Route path="/dashboard/referrals" element={<Referrals />} />
          <Route path="/dashboard/experts" element={<DashboardExperts />} />

          {/* Blog */}
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
        </Routes>
      </main>

      {!hideChrome && (
        <>
          <Footer />
        </>
      )}

      {/* Render LiveChat everywhere EXCEPT Admin routes */}
      {!isAdminRoute && <LiveChat />}
    </>
  )
}

export default App
