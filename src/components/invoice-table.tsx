'use client';
import {useI18n} from '@/lib/i18n/provider';

import {useState} from 'react';
import Link from 'next/link';
import {statusLabels} from '@/modules/invoices/domain/review';
type Row={id:string;status:string;extraction_state:string;invoice_number:string|null;currency:string|null;amount:string|null;documents:unknown};
const extraction:Record<string,string>={pending:'Pendiente',processing:'Procesando',completed:'Completada',failed:'Fallida'};
export default function InvoiceTable({invoices,company}:{invoices:Row[];company:string}){
 const {t,locale}=useI18n();

 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
 const rows=invoices.filter(i=>(filter==='all'||i.status===filter)&&`${i.invoice_number??''} ${(i.documents as {original_name?:string}|null)?.original_name??''}`.toLowerCase().includes(search.toLowerCase()));
 return <><input className="pg-search" aria-label={t("Buscar factura o archivo")} type="search" placeholder={t("Buscar por número o archivo…")} value={search} onChange={e=>setSearch(e.target.value)}/><div className="pg-filters" role="group" aria-label={t("Filtrar facturas")}>{[['all','Todas'],['paid_simulated','Pagadas'],['pending_approval','Por aprobar'],['blocked','Bloqueadas'],['needs_review','Por revisar']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{t(label)}</button>)}</div><div className="pg-table"><table><thead><tr><th>{t("Factura")}</th><th>{t("Importe")}</th><th>{t("Extracción")}</th><th>{t("Estado")}</th><th></th></tr></thead><tbody>{rows.map(i=><tr key={i.id}><td><strong>{i.invoice_number??t('Sin datos confirmados')}</strong><small>{(i.documents as {original_name?:string}|null)?.original_name??t('Documento')}</small></td><td className="pg-amount">{i.currency&&i.amount?`${i.currency} ${i.amount}`:t('Por extraer')}</td><td>{t(extraction[i.extraction_state]??i.extraction_state)}</td><td><span className={`pg-badge ${i.status==='paid_simulated'?'good':i.status==='blocked'||i.status==='cancelled'?'bad':'warning'}`}>{t(statusLabels[i.status]??i.status)}</span></td><td><Link href={`/invoices/${i.id}?company=${company}`}>{t("Ver →")}</Link></td></tr>)}</tbody></table>{!rows.length&&<p className="pg-empty">{t("No hay facturas que coincidan con estos filtros.")}</p>}</div></>;
}
