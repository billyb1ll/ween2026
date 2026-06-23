import { Box } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { UserProvider, useUser } from './context/UserContext'
import { Toaster } from './components/ui/toaster'
import { LoadingFallback } from './components/LoadingFallback'
import { TermsOfUseModal } from './components/TermsOfUseModal'

// Dynamic Route Splitting for Named Exports
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const VibeCheckPage = lazy(() => import('./pages/VibeCheckPage').then((module) => ({ default: module.VibeCheckPage })))
const BoardPage = lazy(() => import('./pages/BoardPage').then((module) => ({ default: module.BoardPage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage').then((module) => ({ default: module.ProfileEditPage })))
const AdminKpiPage = lazy(() => import('./pages/AdminKpiPage').then((module) => ({ default: module.AdminKpiPage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))

// Route Interceptor for Complete Profiles
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const location = useLocation()

  if (loading) {
    return <LoadingFallback />
  }

  // If user is logged in but has no nickname or faculty, force redirect to edit
  if (user && (!user.nickname || !user.faculty) && location.pathname !== '/profile-edit') {
    return <Navigate to="/profile-edit" replace />
  }

  return <>{children}</>
}

// Protected Route for Admin Access
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return <LoadingFallback />
  }

  // Only allow moderator, media_admin, or staff roles
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
      <TermsOfUseModal />
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
            <Route path="/profile-edit" element={<ProfileEditPage />} />

            {/* Platform Feature Routes (Protected by profile setup completion) */}
            <Route path="/vibe-check" element={<RequireCompleteProfile><VibeCheckPage /></RequireCompleteProfile>} />
            <Route path="/board" element={<RequireCompleteProfile><BoardPage /></RequireCompleteProfile>} />
            <Route path="/gallery" element={<RequireCompleteProfile><GalleryPage /></RequireCompleteProfile>} />


            {/* Administrative Dashboard Route (Unified) */}
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
            <Route
              path="/admin/kpi"
              element={
                <RequireAdmin>
                  <RequireCompleteProfile>
                    <AdminKpiPage />
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