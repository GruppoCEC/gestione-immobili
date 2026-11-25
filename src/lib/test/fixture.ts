/** Dati di prova per i test automatici (record minimi, tutti fittizi). */
import type { Annualita, Contratto, Contribuente, Movimento, MultaVeicolo, Societa, Veicolo } from '../tipi'

const base = { creato_il: '', creato_da: '', modificato_il: '', modificato_da: '', eliminato_il: null }

export function contratto(parz: Partial<Contratto> = {}): Contratto {
  return {
    ...base, id: 'c1', immobile_id: 'i1', conduttore_id: 'k1', tipologia: 'abitativo_4_4', stato: 'attivo',
    data_sottoscrizione: '', data_decorrenza: '2022-01-01', durata_anni: 4, prima_scadenza: '2026-01-01',
    rinnovo_automatico: 'si', preavviso_mesi: 6, data_cessazione: '', motivo_cessazione: '',
    canone_mensile_cent: 100000, canone_annuale_cent: 1200000, periodicita: 'mensile', giorno_scadenza: null,
    gestione_incassi: 'si', deposito_cent: null, deposito_modalita: '', deposito_restituito_il: '',
    regime_iva: 'esente', iva_percento: null, istat_attivo: 'si', istat_percentuale: null, istat_mese: '',
    reg_data: '', reg_ufficio: '', reg_codice: '', reg_modalita: '', reg_imposta_cent: null, reg_quota_conduttore_cent: null,
    imposta_registro_annuale_cent: null, note: '', ...parz,
  }
}

export function annualita(parz: Partial<Annualita> = {}): Annualita {
  return {
    ...base, id: 'a1', contratto_id: 'c1', anno: 2026, data_inizio: '2026-01-01',
    istat_applicato: 'si', istat_indice_percento: null, istat_quota_percento: null,
    canone_mensile_precedente_cent: 100000, aumento_mensile_cent: 2000, canone_mensile_nuovo_cent: 102000,
    canone_precedente_cent: 1200000, aumento_cent: 24000, canone_nuovo_cent: 1224000, istat_data_lettera: '', aggiorna_canone: 'si',
    imposta_percento: 2, base_imponibile_percento: 100, imposta_cent: 24480,
    imposta_pagata: 'no', imposta_data_pagamento: '', imposta_modalita: 'f24_elide',
    quota_conduttore_cent: 12240, rimborso_ricevuto: 'no', rimborso_data: '',
    ...parz,
  } as Annualita
}

export function movimento(parz: Partial<Movimento> = {}): Movimento {
  return {
    ...base, id: 'm1', contratto_id: 'c1', tipo: 'canone', competenza: '2026-01', descrizione: '',
    imponibile_cent: 100000, iva_percento: 0, iva_cent: 0, dovuto_cent: 100000, incassato_cent: 0,
    data_incasso: '', modalita: 'bonifico', numero_fattura: '', data_fattura: '', stato: 'da_incassare', note: '', ...parz,
  } as Movimento
}

export function societa(parz: Partial<Societa> = {}): Societa {
  return { ...base, id: 's1', ragione_sociale: 'Società di prova srl', tipo: 'societa', partita_iva: '', codice_fiscale: '', sede: '', pec: '', note: '', ...parz }
}

export function contribuente(parz: Partial<Contribuente> = {}): Contribuente {
  return { ...base, id: 'A', nome: 'Ufficio Alfa', alias: [], ragione_sociale: '', codice_fiscale: '', partita_iva: '', responsabile: '', email: '', email_cc: '', studio: '', societa_id: '', conduttore_id: '', note: '', ...parz }
}

/** Vettura di prova (targa inventata), intestata ad "A" da sempre. */
export function veicolo(parz: Partial<Veicolo> = {}): Veicolo {
  return {
    ...base, id: 'v1', intestazioni: [{ contribuente_id: 'A', intestatario_testo: '', dal: '', al: '' }], marca: 'Fiat', modello: 'Panda',
    targa: 'AB123CD', telaio: '', alimentazione: '', data_immatricolazione: '', possesso: 'proprieta', stato: 'in_uso', data_inizio: '',
    data_fine: '', uscita_note: '', contratto: null, conducenti: [], scadenze: [], km: [], coperture: [], da_verificare: false, note: '', ...parz,
  }
}

export function multa(parz: Partial<MultaVeicolo> = {}): MultaVeicolo {
  return {
    ...base, id: 'mu1', veicolo_id: 'v1', tipo: 'multa', ente: 'Comune di prova', numero_verbale: '1', data_fatto: '', anno_riferimento: null,
    data_notifica: '', scadenza_pagamento: '', scadenza_ridotta: '', scadenza_conducente: '', conducente_comunicato: false,
    importo_cent: null, importo_ridotto_cent: null, spese_rinotifica_cent: null, conducente: '', stato: 'da_pagare', data_pagamento: '', note: '', ...parz,
  }
}
