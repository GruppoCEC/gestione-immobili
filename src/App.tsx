import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FornitoreSessione, useSessione, useUtente } from './lib/sessione'
import { ContestoSoloLettura } from './components/SoloLettura'
import { primoPercorso, puoModificare, puoVedere, type Sezione } from './lib/permessi'
import { Caricamento } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'

// Le pagine si scaricano solo quando si aprono (la prima volta): l'apertura del sito è più veloce
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Impostazioni = lazy(() => import('./pages/Impostazioni'))
const PaginaSocieta = lazy(() => import('./pages/Societa'))
const PaginaImmobili = lazy(() => import('./pages/Immobili'))
const PaginaConduttori = lazy(() => import('./pages/Conduttori'))
const PaginaCondomini = lazy(() => import('./pages/Condomini'))
const PaginaContratti = lazy(() => import('./pages/Contratti'))
const PaginaImporta = lazy(() => import('./pages/Importa'))
const PaginaStorico = lazy(() => import('./pages/Storico'))
const PaginaRegistro = lazy(() => import('./pages/Registro'))
const PaginaCanoni = lazy(() => import('./pages/Canoni'))
const PaginaCondominio = lazy(() => import('./pages/Condominio'))
const SchedaImmobile = lazy(() => import('./pages/SchedaImmobile'))
const PaginaComunicazioni = lazy(() => import('./pages/Comunicazioni'))
const PaginaTributi = lazy(() => import('./pages/Tributi'))
const PaginaFornitori = lazy(() => import('./pages/Fornitori'))
const StampaLetteraIstat = lazy(() => import('./pages/StampaDocumenti').then((m) => ({ default: m.StampaLetteraIstat })))
const StampaTributi = lazy(() => import('./pages/StampaTributi'))
const StampaScadenzaTributi = lazy(() => import('./pages/StampaTributi').then((m) => ({ default: m.StampaScadenzaTributi })))
const StampaFattureFornitori = lazy(() => import('./pages/StampaFornitori').then((m) => ({ default: m.StampaFattureFornitori })))
const StampaRoyalty = lazy(() => import('./pages/StampaFornitori').then((m) => ({ default: m.StampaRoyalty })))

/** Mostra le pagine interne solo se l'utente ha effettuato l'accesso. */
function AreaProtetta() {
  const { sessione } = useSessione()
  if (!sessione) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route path="/stampa/immobile/:id" element={<Guardia sezione="contratti"><SchedaImmobile /></Guardia>} />
      <Route path="/stampa/lettera-istat/:id" element={<Guardia sezione="comunicazioni"><StampaLetteraIstat /></Guardia>} />
      <Route path="/stampa/tributi-scadenza/:data" element={<Guardia sezione="tributi"><StampaScadenzaTributi /></Guardia>} />
      <Route path="/stampa/tributi/:tipo/:valore" element={<Guardia sezione="tributi"><StampaTributi /></Guardia>} />
      <Route path="/stampa/fornitori/:tipo/:valore" element={<Guardia sezione="fornitori"><StampaFattureFornitori /></Guardia>} />
      <Route path="/stampa/royalty/:fornitore/:anno" element={<Guardia sezione="fornitori"><StampaRoyalty /></Guardia>} />
      <Route path="/*" element={<AreaConMenu />} />
    </Routes>
  )
}

/** Controlla il permesso dell'utente sulla sezione: se non può vederla lo rimanda alla prima consentita; se può solo leggerla, attiva la sola lettura. */
function Guardia({ sezione, children }: { sezione: Sezione; children: ReactNode }) {
  const utente = useUtente()
  if (!puoVedere(utente, sezione)) return <Navigate to={primoPercorso(utente)} replace />
  return (
    <ContestoSoloLettura.Provider value={!puoModificare(utente, sezione)}>
      <Suspense fallback={<Caricamento />}>{children}</Suspense>
    </ContestoSoloLettura.Provider>
  )
}

function AreaConMenu() {
  const utente = useUtente()
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Guardia sezione="dashboard"><Dashboard /></Guardia>} />
        <Route path="/societa" element={<Guardia sezione="anagrafiche"><PaginaSocieta /></Guardia>} />
        <Route path="/immobili" element={<Guardia sezione="anagrafiche"><PaginaImmobili /></Guardia>} />
        <Route path="/conduttori" element={<Guardia sezione="anagrafiche"><PaginaConduttori /></Guardia>} />
        <Route path="/condomini" element={<Guardia sezione="anagrafiche"><PaginaCondomini /></Guardia>} />
        <Route path="/contratti" element={<Guardia sezione="contratti"><PaginaContratti /></Guardia>} />
        <Route path="/registro" element={<Guardia sezione="registro"><PaginaRegistro /></Guardia>} />
        <Route path="/canoni" element={<Guardia sezione="canoni"><PaginaCanoni /></Guardia>} />
        <Route path="/condominio" element={<Guardia sezione="condominio"><PaginaCondominio /></Guardia>} />
        <Route path="/comunicazioni" element={<Guardia sezione="comunicazioni"><PaginaComunicazioni /></Guardia>} />
        <Route path="/tributi" element={<Guardia sezione="tributi"><PaginaTributi /></Guardia>} />
        <Route path="/fornitori" element={<Guardia sezione="fornitori"><PaginaFornitori /></Guardia>} />
        <Route path="/importa" element={<Guardia sezione="importa"><PaginaImporta /></Guardia>} />
        <Route path="/storico" element={<Guardia sezione="storico"><PaginaStorico /></Guardia>} />
        <Route path="/impostazioni" element={<Guardia sezione="impostazioni"><Impostazioni /></Guardia>} />
        <Route path="*" element={<Navigate to={primoPercorso(utente)} replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <FornitoreSessione>
      {/* HashRouter: gli indirizzi usano "#/..." così GitHub Pages non dà mai "404" al ricaricamento */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AreaProtetta />} />
        </Routes>
      </HashRouter>
    </FornitoreSessione>
  )
}
