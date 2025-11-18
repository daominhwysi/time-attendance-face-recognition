// src/main.tsx (or wherever your router is)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import Login from './login/page.tsx'
import SignUp from './signup/page.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx' // Import ProtectedRoute
import ManageFacesPage from './manage-faces/page.tsx' // Import the new page
import './index.css'
import StreamPage from './stream/page.tsx'
import { ReportPage } from './report/page.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/report" element={<ReportPage />} />
          {/* Add the new protected route here */}
          <Route
            path="/manage-faces"
            element={
              <ProtectedRoute>
                <ManageFacesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stream"
            element={
              <ProtectedRoute>
                <StreamPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
