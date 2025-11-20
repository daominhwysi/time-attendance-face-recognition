import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner' // Import Toaster
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './login/page'
import SignUp from './signup/page'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './dashboard/page' // We will create this next
import ManageFacesPage from './manage-faces/page'
import StreamPage from './stream/page'
import { ReportPage } from './report/page'
import './index.css'

// Wrap public routes to redirect to dashboard if already logged in
// const PublicOnlyRoute = () => {
//   const { user } = useAuth() // You might need to export useAuth from specific file or create wrapper
//   if (user) return <Navigate to="/" replace />
//   return <Outlet />
// }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Protected Routes with Layout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/manage-faces" element={<ManageFacesPage />} />
            <Route path="/stream" element={<StreamPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
