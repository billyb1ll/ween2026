import { Box } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { UserProvider, useUser } from './context/UserContext'
import { Toaster } from './components/ui/toaster'
import { LoadingFallback } from './components/LoadingFallback'

// Dynamic Route Splitting for Named Exports
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const VibeCheckPage = lazy(() => import('./pages/VibeCheckPage').then((module) => ({ default: module.VibeCheckPage })))
const BoardPage = lazy(() => import('./pages/BoardPage').then((module) => ({ default: module.BoardPage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage').then((module) => ({ default: module.ProfileSetupPage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))

// Route Interceptor for Complete Profiles
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const location = useLocation()

  if (loading) {
    return <LoadingFallback />
  }

  // If user is logged in but has no nickname or faculty, force redirect to setup
  if (user && (!user.nickname || !user.faculty) && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />
  }

  return <>{children}</>
}

// Protected Route for Admin Access
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return <LoadingFallback />
  }

  // Only allow superadmin, media_admin, or staff roles
  if (!user || user.role === 'student') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppContent() {
  return (
    <Box minH="100vh" bg="bg.canvas" position="relative">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Toaster />
      <Navbar />
      <Box
        as="main"
        id="main-content"
        tabIndex={-1}
        pb={{ base: 'calc(var(--dock-height) + 16px)', md: 0 }}
        style={{ outline: 'none' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public/Standard Routes */}
            <Route path="/" element={<RequireCompleteProfile><HomePage /></RequireCompleteProfile>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile-setup" element={<ProfileSetupPage />} />

            {/* Platform Feature Routes (Protected by profile setup completion) */}
            <Route path="/vibe-check" element={<RequireCompleteProfile><VibeCheckPage /></RequireCompleteProfile>} />
            <Route path="/board" element={<RequireCompleteProfile><BoardPage /></RequireCompleteProfile>} />
            <Route path="/gallery" element={<RequireCompleteProfile><GalleryPage /></RequireCompleteProfile>} />

            {/* Administrative Dashboard Route */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <RequireCompleteProfile>
                    <AdminDashboardPage />
                  </RequireCompleteProfile>
                </RequireAdmin>
              }
            />
          </Routes>
        </Suspense>
      </Box>
      <Footer />
    </Box>
  )
}

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </UserProvider>
  )
}

export default App
