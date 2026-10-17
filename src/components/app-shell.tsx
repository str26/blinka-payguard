'use client';
import {useEffect,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Brand from './brand';
import ThemeControl from './theme-control';
const links=[['summary','Resumen','▦'],['invoices','Facturas','▤'],['review','Revisión humana','◷'],['rules','Reglas y acuerdos','◇'],['audit','Registro','≡'],['settings','Ajustes','⚙']];
export default function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname(),params=useSearchParams();const [open,setOpen]=useState(false);
 const company=params.get('company');const view=path.startsWith('/invoices')?'invoices':params.get('view')||'summary';
 const href=(key:string)=>{const q=new URLSearchParams();if(company)q.set('company',company);if(key!=='invoices')q.set('view',key);return `${key==='invoices'?'/invoices':'/dashboard'}?${q}`;};
 useEffect(()=>{setOpen(false);},[path,params]);
 useEffect(()=>{function escape(e:KeyboardEvent){if(e.key==='Escape')setOpen(false);}document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[]);
 if(!path.startsWith('/dashboard')&&!path.startsWith('/invoices'))return <>{children}</>;
 return <div className="pg-app"><a className="pg-skip" href="#workspace-content">Ir al contenido</a>{open&&<button className="pg-overlay" aria-label="Cerrar menú" onClick={()=>setOpen(false)}/>}
 <aside id="workspace-nav" className={`pg-sidebar ${open?'is-open':''}`}><Brand/><div className="pg-sidebar-caption">GESTIÓN FINANCIERA<br/><span>Autonomía con control</span></div><nav aria-label="Operación financiera">{links.map(([key,label,icon])=><Link key={key} href={href(key)} className={view===key?'is-active':''} aria-current={view===key?'page':undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav><div className="pg-sidebar-bottom"><div className="pg-trust"><span className="pg-dot"/>Entorno de simulación<small>No se mueve dinero real</small></div><Link href="/">← Presentación</Link></div></aside>
 <div className="pg-shell"><header className="pg-topbar"><div className="pg-top-left"><button className="pg-menu" aria-label="Abrir menú" aria-controls="workspace-nav" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button><span>Operación <span className="pg-crumb">/</span> <strong>PayGuard</strong></span></div><div className="pg-top-right"><span className="pg-badge warning">Simulación · Sin dinero real</span><ThemeControl/></div></header><div id="workspace-content" tabIndex={-1}>{children}</div></div></div>;
}
