'use client';
import {useI18n} from '@/lib/i18n/provider';

import {useEffect,useState} from 'react';
type Theme='light'|'dark'|'system';
export default function ThemeControl(){
 const {t,locale}=useI18n();

 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{try{const value=localStorage.getItem('payguard-theme');if(value==='light'||value==='dark'||value==='system')setTheme(value);}catch{}},[]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[theme]);
 return <select className="pg-theme" aria-label={t("Apariencia")} value={theme} onChange={e=>{const value=e.target.value as Theme;setTheme(value);try{localStorage.setItem('payguard-theme',value);}catch{}}}><option value="light">{t("Claro")}</option><option value="dark">{t("Oscuro")}</option><option value="system">{t("Sistema")}</option></select>;
}
