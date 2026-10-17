'use client';
import {useI18n} from '@/lib/i18n/provider';

import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { minorUnits,validateRefund } from '@/modules/invoices/domain/refunds';
import styles from '../../workspace.module.css';
export default function RefundForm({id,currency,remaining}:{id:string;currency:string;remaining:string}){
 const {t,locale}=useI18n();

 const [amount,setAmount]=useState(remaining);const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const pending=useRef<{fingerprint:string;request:string}|null>(null);const router=useRouter();
 return <section className={styles.section}><h2>{t("Registrar devolución recibida")}</h2>
  <p className={styles.description}>{t("Simula dinero devuelto por el proveedor: acredita la wallet en ")}{t(currency)}{t(" y revierte gasto en el presupuesto del periodo original. Disponible para devolver: ")}{t(currency)} {t(remaining)}{t(".")}</p>
  <form className={styles.form} onSubmit={async event=>{
   event.preventDefault();if(busy)return;setMessage('');
   const values={amount,reason};const fingerprint=JSON.stringify(values);
   if(!pending.current||pending.current.fingerprint!==fingerprint)pending.current={fingerprint,request:crypto.randomUUID()};
   let input;
   try{input=validateRefund({...values,request_id:pending.current.request});if(minorUnits(input.amount)>minorUnits(remaining))throw new Error('El importe excede lo pendiente de reembolso.');}
   catch(error){setMessage(error instanceof Error?error.message:'Revisa los datos.');return;}
   setBusy(true);
   try{
    const response=await fetch(`/api/invoices/${id}/refund`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();
    if(!response.ok){setMessage(result.error||'No se pudo registrar.');router.refresh();return;}
    pending.current=null;setMessage(`Reembolso simulado registrado: ${result.currency} ${result.refund_amount}.`);router.refresh();
   }catch{setMessage('La conexión se interrumpió. Comprueba el historial. Reintentar sin cambiar importe ni motivo utiliza la misma solicitud.');}
   finally{setBusy(false);}
  }}>
   <label htmlFor="refund-amount">{t("Importe recibido · ")}{t(currency)}</label><input id="refund-amount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" maxLength={21} required disabled={busy}/>
   <label htmlFor="refund-reason">{t("Motivo del reembolso")}</label><textarea id="refund-reason" value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={1000} required disabled={busy}/>
   <button className={styles.button} disabled={busy}>{t(busy?'Registrando…':'Registrar reembolso recibido · simulación')}</button>
   {message&&<p role="status" aria-live="polite" className={styles.note}>{t(message)}</p>}
  </form>
 </section>;
}
