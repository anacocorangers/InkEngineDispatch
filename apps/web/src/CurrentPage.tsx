import App from './App.tsx'
import DiscordSetup from './DiscordSetup.tsx'
import { PrivacyPage, TermsPage } from './Legal.tsx'

export default function CurrentPage() {
  if (window.location.pathname === '/terms') return <TermsPage />
  if (window.location.pathname === '/privacy') return <PrivacyPage />
  if (window.location.pathname === '/discord/setup') return <DiscordSetup />
  return <App />
}