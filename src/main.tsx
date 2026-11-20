// Per primo: aggiunge le funzioni mancanti nei browser datati (Chrome 109 su Windows 7)
import './lib/compatibilita'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
