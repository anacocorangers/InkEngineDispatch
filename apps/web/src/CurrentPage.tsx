import App from './App.tsx'
import { PrivacyPage, TermsPage } from './Legal.tsx'

export default function CurrentPage() {
  if (window.location.pathname === '/terms') return <TermsPage />
  if (window.location.pathname === '/privacy') return <PrivacyPage />
  return <App />
}