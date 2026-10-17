'use client';
import {useEffect,useState} from 'react';
type Theme='light'|'dark'|'system';
export default function ThemeControl(){
 const [theme,setTheme]=useState<Theme>('light');
 useEffect(()=>{try{const value=localStorage.getItem('payguard-theme');if(value==='light'||value==='dark'||value==='system')setTheme(value);}catch{}},[]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[theme]);
 return <select className="pg-theme" aria-label="Apariencia" value={theme} onChange={e=>{const value=e.target.value as Theme;setTheme(value);try{localStorage.setItem('payguard-theme',value);}catch{}}}><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Sistema</option></select>;
}
