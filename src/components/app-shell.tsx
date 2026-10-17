'use client';
import LanguageControl from '@/components/language-control';
import {useI18n} from '@/lib/i18n/provider';

import {useEffect,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Brand from './brand';
import ThemeControl from './theme-control';
const links=[['summary','Resumen','▦'],['invoices','Facturas','▤'],['review','Revisión humana','◷'],['rules','Reglas y acuerdos','◇'],['audit','Registro','≡'],['settings','Ajustes','⚙']];
export default function AppShell({children}:{children:React.ReactNode}){
 const {t,locale}=useI18n();

 const path=usePathname(),params=useSearchParams();const [open,setOpen]=useState(false);
 const company=params.get('company');const view=path.startsWith('/invoices')?'invoices':params.get('view')||'summary';
 const href=(key:string)=>{const q=new URLSearchParams();if(company)q.set('company',company);if(key!=='invoices')q.set('view',key);return `${key==='invoices'?'/invoices':'/dashboard'}?${q}`;};
 useEffect(()=>{setOpen(false);},[path,params]);
 useEffect(()=>{function escape(e:KeyboardEvent){if(e.key==='Escape')setOpen(false);}document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[]);
 if(!path.startsWith('/dashboard')&&!path.startsWith('/invoices'))return <>{t(children)}</>;
 return <div className="pg-app"><a className="pg-skip" href="#workspace-content">{t("Ir al contenido")}</a>{open&&<button className="pg-overlay" aria-label={t("Cerrar menú")} onClick={()=>setOpen(false)}/>}
 <aside id="workspace-nav" className={`pg-sidebar ${open?'is-open':''}`}><Brand/><div className="pg-sidebar-caption">{t("GESTIÓN FINANCIERA")}<br/><span>{t("Autonomía con control")}</span></div><nav aria-label={t("Operación financiera")}>{links.map(([key,label,icon])=><Link key={key} href={href(key)} className={view===key?'is-active':''} aria-current={view===key?'page':undefined}><span aria-hidden="true">{t(icon)}</span>{t(label)}</Link>)}</nav><div className="pg-sidebar-bottom"><div className="pg-trust"><span className="pg-dot"/>{t("Entorno de simulación")}<small>{t("No se mueve dinero real")}</small></div><Link href="/">{t("← Presentación")}</Link></div></aside>
 <div className="pg-shell"><header className="pg-topbar"><div className="pg-top-left"><button className="pg-menu" aria-label={t("Abrir menú")} aria-controls="workspace-nav" aria-expanded={open} onClick={()=>setOpen(!open)}>{t("☰")}</button><span>{t("Operación ")}<span className="pg-crumb">{t("/")}</span> <strong>{t("PayGuard")}</strong></span></div><div className="pg-top-right"><span className="pg-badge warning">{t("Simulación · Sin dinero real")}</span><LanguageControl/><ThemeControl/></div></header><div id="workspace-content" tabIndex={-1}>{t(children)}</div></div></div>;
}
