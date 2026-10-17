'use client';
import {useI18n} from '@/lib/i18n/provider';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './retry-button.module.css';
export default function RetryButton({id}:{id:string}) {
 const {t,locale}=useI18n();

  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
  async function retry(){
    if(busy)return;
    setBusy(true);setError('');
    try {
      const res=await fetch(`/api/invoices/${id}/extract`,{method:'POST'});
      const body=await res.json();
      if(!res.ok)setError(body.error || 'No se pudo completar el procesamiento del agente.');
    }catch{setError('La conexión se interrumpió. Recarga para comprobar el estado de la factura antes de reintentar.');}
    finally{setBusy(false);router.refresh();}
  }
  return <section className={styles.panel} aria-label={t("Recuperación del procesamiento")} aria-busy={busy}>
    <div className={styles.row}>
      <div className={styles.copy}><h2>{t("Reanudar procesamiento")}</h2><p>{t("Usa esta opción si el proceso se interrumpió. El agente vuelve a validar y puede ejecutar el pago simulado si las reglas lo permiten. No sustituye la aprobación de un gasto.")}</p></div>
      <button type="button" className={styles.button} disabled={busy} onClick={retry}>{t(busy?'Procesando agente…':'Reintentar agente')}</button>
    </div>
    {busy&&<p className={styles.progress} role="status" aria-live="polite">{t("El agente está procesando la factura. Espera el resultado.")}</p>}
    {error&&<p role="alert" className={styles.error}>{t(error)}</p>}
  </section>;
}
