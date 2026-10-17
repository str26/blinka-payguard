'use client';
import {useI18n} from '@/lib/i18n/provider';
export default function LanguageControl(){const {locale,setLocale,t,pending}=useI18n();return <select className="pg-theme pg-language" aria-label={t('Idioma')} value={locale} aria-busy={pending} onChange={e=>setLocale(e.target.value==='en'?'en':'es')}><option value="es">Español</option><option value="en">English</option></select>;}
