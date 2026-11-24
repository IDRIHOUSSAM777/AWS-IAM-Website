import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ProfileGate from './profile/ProfileGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileGate>
      <App />
    </ProfileGate>
  </StrictMode>,
)
