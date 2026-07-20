import { Box } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { UserProvider, useUser } from './context/UserContext'
import { Toaster } from './components/ui/toaster'
import { toaster } from './components/ui/toaster'
import { LoadingFallback } from './components/LoadingFallback'
import { TermsOfUseModal } from './components/TermsOfUseModal'
import { GalleryLightboxProvider } from './context/GalleryLightboxContext'


// Dynamic Route Splitting for Named Exports
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const VibeCheckPage = lazy(() => import('./pages/VibeCheckPage').then((module) => ({ default: module.VibeCheckPage })))
const BoardPage = lazy(() => import('./pages/BoardPage').then((module) => ({ default: module.BoardPage })))
const GalleryPage = lazy(() => import('./pages/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const MyMomentsPage = lazy(() => import('./pages/MyMomentsPage').then((module) => ({ default: module.MyMomentsPage })))
const FaceClaimPage = lazy(() => import('./pages/FaceClaimPage').then((module) => ({ default: module.FaceClaimPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage').then((module) => ({ default: module.ProfileSetupPage })))
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage').then((module) => ({ default: module.ProfileEditPage })))
const AdminKpiPage = lazy(() => import('./pages/AdminKpiPage').then((module) => ({ default: module.AdminKpiPage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))

// Protected Route for Authenticated Users
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionExpired, clearSessionExpired } = useUser()
  const location = useLocation()

  useEffect(() => {
    if (sessionExpired) {
      toaster.create({
        title: 'Session expired',
        description: 'Please log in again to continue.',
        type: 'warning',
        duration: 4000,
        closable: true,
      })
      clearSessionExpired()
    }
  }, [sessionExpired, clearSessionExpired])

  if (loading) {
    return <LoadingFallback />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}


// Redirect if already logged in (for login page)
function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return <LoadingFallback />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Route Interceptor for Complete Profiles
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const location = useLocation()

  if (loading) {
    return <LoadingFallback />
  }

  // If user is logged in but has no nickname or faculty, force redirect to setup
  if (user && (!user.nickname || !user.faculty) && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}

// Route Interceptor to prevent returning to setup once profile is complete
function RequireIncompleteProfile({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return <LoadingFallback />
  }

  // If user already has a complete profile, redirect them away from setup to home
  if (user && user.nickname && user.faculty) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Protected Route for Admin Access
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) {
    return <LoadingFallback />
  }

  // Only allow moderator or staff roles
  if (!user || user.role === 'student') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppContent() {
  return (
    <GalleryLightboxProvider>
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
            <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
            <Route path="/face-claim" element={<FaceClaimPage />} />
            
            {/* Authenticated Routes without complete profile requirement */}
            <Route path="/setup" element={<RequireAuth><RequireIncompleteProfile><ProfileSetupPage /></RequireIncompleteProfile></RequireAuth>} />
            <Route path="/profile-edit" element={<RequireAuth><ProfileEditPage /></RequireAuth>} />

            {/* Platform Feature Routes (Protected by Auth + Profile Setup Completion) */}
            <Route path="/vibe-check" element={<RequireAuth><RequireCompleteProfile><VibeCheckPage /></RequireCompleteProfile></RequireAuth>} />
            <Route path="/board" element={<RequireAuth><RequireCompleteProfile><BoardPage /></RequireCompleteProfile></RequireAuth>} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/my-moments" element={<RequireAuth><RequireCompleteProfile><MyMomentsPage /></RequireCompleteProfile></RequireAuth>} />


            {/* Administrative Dashboard Route (Unified) */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireCompleteProfile>
                      <AdminDashboardPage />
                    </RequireCompleteProfile>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/kpi"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireCompleteProfile>
                      <AdminKpiPage />
                    </RequireCompleteProfile>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </Box>
      <Footer />
    </Box>
    </GalleryLightboxProvider>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 5000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </UserProvider>
    </QueryClientProvider>
  )
}
export default App