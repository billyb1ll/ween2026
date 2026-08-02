import { Box } from '@chakra-ui/react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'

const handleGlobalAuthError = (error: unknown) => {
  const err = error as { code?: string; status?: number; message?: string };
  if (
    err?.code === 'P0001' ||
    err?.status === 401 ||
    err?.message?.toLowerCase().includes('jwt') ||
    (err?.message?.toLowerCase().includes('unauthorized') && err?.code !== '42501')
  ) {
    console.warn('Global Auth Interceptor: Unauthorized error detected, wiping credentials & triggering relogin.');
    localStorage.removeItem('baan7_session_token');
    localStorage.removeItem('baan7_student_id');
    sessionStorage.removeItem('baan7_admin_pin');

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }

    window.dispatchEvent(new Event('baan7_session_expired'));
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalAuthError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalAuthError,
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 5000,
    },
  },
})

// Official Vite dynamic module import failure handler
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Preload error detected for dynamic asset, reloading page:', event);
    const hasReloaded = sessionStorage.getItem('vite_preload_reloaded');
    if (!hasReloaded) {
      sessionStorage.setItem('vite_preload_reloaded', 'true');
      window.location.reload();
    }
  });
}
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { UserProvider, useUser } from './context/UserContext'
import { Toaster } from './components/ui/toaster'
import { toaster } from './components/ui/toaster'
import { LoadingFallback } from './components/LoadingFallback'
import { TermsOfUseModal } from './components/TermsOfUseModal'
import { GalleryLightboxProvider } from './context/GalleryLightboxContext'
import { ErrorBoundary } from './components/ErrorBoundary'

/**
 * Safe Lazy Loader for Dynamic Module Imports
 * Automatically retries dynamic chunk imports and reloads stale build manifests
 * when Vite serves an index.html 404 fallback ('text/html is not a valid JavaScript MIME type').
 */
function safeLazy<T extends React.ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<Record<string, unknown>>,
  exportName: string
) {
  return lazy(async () => {
    try {
      const module = await importFn();
      return { default: (module[exportName] || module.default) as T };
    } catch (err: unknown) {
      const error = err as Error;
      console.warn(`[SafeLazy] Dynamic chunk import for ${exportName} failed:`, error);
      const isMimeOrChunkError =
        error?.message?.includes("MIME type") ||
        error?.message?.includes("dynamically imported module") ||
        error?.message?.includes("Importing a module script failed") ||
        error?.name === "TypeError";

      const storageKey = `retry_lazy_${exportName}`;
      const hasRetried = sessionStorage.getItem(storageKey);

      if (isMimeOrChunkError && !hasRetried) {
        sessionStorage.setItem(storageKey, "true");
        console.warn(`[SafeLazy] Refreshing browser for updated app manifest (${exportName})...`);
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}

// Dynamic Route Splitting for Named Exports with Safe Lazy Recovery
const HomePage = safeLazy(() => import('./pages/HomePage'), 'HomePage')
const VibeCheckPage = safeLazy(() => import('./pages/VibeCheckPage'), 'VibeCheckPage')
const BoardPage = safeLazy(() => import('./pages/BoardPage'), 'BoardPage')
const GalleryPage = safeLazy(() => import('./pages/GalleryPage'), 'GalleryPage')
const MyMomentsPage = safeLazy(() => import('./pages/MyMomentsPage'), 'MyMomentsPage')
const FaceClaimPage = safeLazy(() => import('./pages/FaceClaimPage'), 'FaceClaimPage')
const LoginPage = safeLazy(() => import('./pages/LoginPage'), 'LoginPage')
const ProfileSetupPage = safeLazy(() => import('./pages/ProfileSetupPage'), 'ProfileSetupPage')
const ProfileEditPage = safeLazy(() => import('./pages/ProfileEditPage'), 'ProfileEditPage')
const AdminKpiPage = safeLazy(() => import('./pages/AdminKpiPage'), 'AdminKpiPage')
const AdminDashboardPage = safeLazy(() => import('./pages/AdminDashboardPage'), 'AdminDashboardPage')

// Global Auth Expiry Listener — intercepts sessionExpired on ANY route and redirects to /login
function GlobalAuthListener() {
  const { sessionExpired, clearSessionExpired } = useUser()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionExpired) {
      toaster.create({
        title: 'Session expired',
        description: 'Please log in again to continue.',
        type: 'warning',
        duration: 5000,
        closable: true,
      })
      clearSessionExpired()
      if (location.pathname !== '/login') {
        navigate('/login', { state: { from: location }, replace: true })
      }
    }
  }, [sessionExpired, clearSessionExpired, navigate, location])

  return null
}

// Protected Route for Authenticated Users
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const location = useLocation()

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
      <Box minH="100vh" maxW="100vw" bg="bg.canvas" position="relative" overflowX="hidden">
        <a href="#main-content" className="skip-link">
          Skip to content
      </a>
      <Toaster />
      <GlobalAuthListener />
      <TermsOfUseModal />
      <Navbar />
      <Box
        as="main"
        id="main-content"
        tabIndex={-1}
        maxW="100vw"
        overflowX="hidden"
        pb={{ base: 'calc(var(--dock-height) + 16px)', md: 0 }}
        style={{ outline: 'none' }}
      >

        <ErrorBoundary>
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
        </ErrorBoundary>
      </Box>
      <Footer />
    </Box>
    </GalleryLightboxProvider>
  )
}



import { SpeedInsights } from "@vercel/speed-insights/react";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BrowserRouter>
          <AppContent />
          <SpeedInsights />
        </BrowserRouter>
      </UserProvider>
    </QueryClientProvider>
  )
}
export default App