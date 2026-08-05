import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CurrentPage from './CurrentPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentPage />
  </StrictMode>,
)
