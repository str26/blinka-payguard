import type {Metadata} from 'next';
import {Suspense} from 'react';
import AppShell from '@/components/app-shell';
import {LanguageProvider} from '@/lib/i18n/provider';
import {getI18n} from '@/lib/i18n/server';
import './globals.css';
export async function generateMetadata():Promise<Metadata>{const {t}=await getI18n();return {title:t('Blinka PayGuard | Autonomía con control'),description:t('Agente de pagos simulados que valida facturas según tus reglas y consulta las excepciones.'),icons:{icon:'/brand/favicon.svg'}};}
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>){const {locale}=await getI18n();return <html lang={locale} suppressHydrationWarning><body><LanguageProvider initialLocale={locale}><Suspense fallback={children}><AppShell>{children}</AppShell></Suspense></LanguageProvider></body></html>;}
