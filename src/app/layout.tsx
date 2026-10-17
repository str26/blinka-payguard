import type { Metadata } from 'next';
import {Suspense} from 'react';
import AppShell from '@/components/app-shell';
import './globals.css';
export const metadata:Metadata={title:'Blinka PayGuard | Autonomía con control',description:'Agente de pagos simulados que valida facturas según tus reglas y consulta las excepciones.',icons:{icon:'/brand/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es" suppressHydrationWarning><body><Suspense fallback={children}><AppShell>{children}</AppShell></Suspense></body></html>;}
