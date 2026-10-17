'use client';
import {useI18n} from '@/lib/i18n/provider';

import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateReview } from '@/modules/invoices/domain/review';
import styles from '../../workspace.module.css';
export type SupplierOption={id:string;code:string;name:string;allowed:boolean};
export type AgreementOption={id:string;supplier_id:string;reference:string;currency:string;amount:string};
export type ReviewFields={supplier_id:string;agreement_id:string;invoice_number:string;currency:string;amount:string;issue_date:string;due_date:string};
export default function ReviewForm({id,version,initial,suppliers,agreements,agentEnabled=false}:{id:string;version:number;initial:ReviewFields;suppliers:SupplierOption[];agreements:AgreementOption[];agentEnabled?:boolean}){
 const {t,locale}=useI18n();

 const [fields,setFields]=useState(initial);const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState('');
 const pending=useRef<{fingerprint:string;request:string}|null>(null);const router=useRouter();
 function change(key:keyof ReviewFields,value:string){setAcknowledged(false);setFields(old=>({...old,[key]:value,...((key==='supplier_id'||key==='currency')?{agreement_id:''}:{})}));}
 const available=agreements.filter(a=>a.supplier_id===fields.supplier_id && a.currency===fields.currency);
 return <section className={styles.section}><h2>{t(agentEnabled?'Resolver excepción y reanudar':'Revisar y confirmar')}</h2>
  <p className={styles.description}>{t(agentEnabled?'Corrige los datos contra el original y selecciona proveedor y acuerdo. Al confirmar, el agente vuelve a validar y ejecuta el pago simulado si todas las reglas lo permiten.':'Corrige los datos contra el original. Selecciona proveedor y acuerdo. Si las reglas autorizan, se reservarán fondos.')}</p>
  <form className={styles.form} onSubmit={async event=>{
   event.preventDefault();if(busy)return;setError('');setResult('');
   const values={version,...fields,agreement_id:fields.agreement_id||null,acknowledged};
   const fingerprint=JSON.stringify(values);
   if(!pending.current || pending.current.fingerprint!==fingerprint)pending.current={fingerprint,request:crypto.randomUUID()};
   let input;
   try{input=validateReview({...values,request_id:pending.current.request});}
   catch(error){setError(error instanceof Error?error.message:'Revisa los datos.');return;}
   setBusy(true);
   try{
    const res=await fetch(`/api/invoices/${id}/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const body=await res.json();
    if(!res.ok){setError(body.error||'No se pudo confirmar.');return;}
    pending.current=null;
    setResult(body.status==='pending_approval'?'Datos confirmados. Falta la aprobación del gasto: un admin o approver debe indicar un motivo y pulsar «Aprobar y continuar con el agente» en Acciones.':body.status==='blocked'?'El pago sigue bloqueado por una regla. Revisa la tabla de reglas; confirmar otra vez los mismos datos no elimina el bloqueo.':body.status==='paid_simulated'?'Pago simulado completado.':body.status==='needs_review'?'Todavía falta una validación. Consulta los motivos antes de volver a confirmar.':'Datos confirmados. Consulta el estado actualizado.');
    router.refresh();
   }catch{setError('No se pudo confirmar la respuesta. Reintenta sin cambiar los datos: se usará la misma solicitud para evitar duplicados.');}
   finally{setBusy(false);}
  }}>
   <label htmlFor="review-number">{t("Número de factura")}</label><input id="review-number" value={fields.invoice_number} onChange={e=>change('invoice_number',e.target.value)} required maxLength={100} disabled={busy}/>
   <label htmlFor="review-supplier">{t("Proveedor registrado")}</label><select id="review-supplier" value={fields.supplier_id} onChange={e=>change('supplier_id',e.target.value)} required disabled={busy}><option value="">{t("Seleccionar proveedor")}</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}{t(" · ")}{s.code}{t(s.allowed?'':' · NO permitido')}</option>)}</select>
   <label htmlFor="review-currency">{t("Moneda")}</label><select id="review-currency" value={fields.currency} onChange={e=>change('currency',e.target.value)} required disabled={busy}><option value="">{t("Seleccionar moneda")}</option>{['USD','COP','MXN'].map(c=><option key={c}>{t(c)}</option>)}</select>
   <label htmlFor="review-amount">{t("Importe decimal · ejemplo 800.00")}</label><input id="review-amount" inputMode="decimal" value={fields.amount} onChange={e=>change('amount',e.target.value)} required maxLength={21} disabled={busy}/>
   <label htmlFor="review-agreement">{t("Acuerdo del proveedor y moneda")}</label><select id="review-agreement" value={fields.agreement_id} onChange={e=>change('agreement_id',e.target.value)} disabled={busy}><option value="">{t("Sin acuerdo confirmado · requerirá revisión")}</option>{available.map(a=><option key={a.id} value={a.id}>{a.reference}{t(" · ")}{a.currency} {a.amount}</option>)}</select>
   <label htmlFor="review-issued">{t("Fecha de emisión")}</label><input id="review-issued" type="date" value={fields.issue_date} onChange={e=>change('issue_date',e.target.value)} min="1900-01-01" max="9999-12-31" required disabled={busy}/>
   <label htmlFor="review-due">{t("Fecha de vencimiento")}</label><input id="review-due" type="date" value={fields.due_date} onChange={e=>change('due_date',e.target.value)} min={fields.issue_date||'1900-01-01'} max="9999-12-31" required disabled={busy}/>
   <label className={styles.confirmation}><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} required disabled={busy}/>{t("Revisé los campos y las advertencias de Gemini contra el documento original. ")}{t(agentEnabled?'Confirmo los datos corregidos para que el agente evalúe y, si procede, pague en simulación.':'Confirmo los datos para evaluar las reglas y, si procede, reservar fondos de simulación.')}</label>
   {result && <p role="status" className={styles.note}>{t(result)}</p>}
   {error && <p role="alert" className={styles.error}>{t(error)}</p>}
   <button className={styles.button} disabled={busy}>{t(busy?'Confirmando y evaluando…':agentEnabled?'Confirmar corrección y reanudar agente':'Confirmar datos y evaluar reglas')}</button>
  </form>
 </section>;
}
