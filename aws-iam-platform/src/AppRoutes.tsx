import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import ProfileGate from './profile/ProfileGate'

const IAMDetails = lazy(() => import('./IAMDetails'))

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProfileGate><App /></ProfileGate>} />
        <Route path="/iam" element={<Suspense fallback={<main className="w">Loading IAM guide...</main>}><IAMDetails /></Suspense>} />
        <Route path="/iam/questions/:topicId" element={<Suspense fallback={<main className="w">Loading IAM guide...</main>}><IAMDetails /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
