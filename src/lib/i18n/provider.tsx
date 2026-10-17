'use client';
import {createContext,useContext,useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {translate,validLocale,type Locale} from './translate';
type Context={locale:Locale;t:<T>(value:T)=>T;setLocale:(value:Locale)=>void;pending:boolean};
const LanguageContext=createContext<Context>({locale:'es',t:value=>value,setLocale:()=>{},pending:false});
export function LanguageProvider({initialLocale,children}:{initialLocale:Locale;children:React.ReactNode}){
 const [locale,setLanguage]=useState(initialLocale);const [pending,startTransition]=useTransition();const router=useRouter();
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 function setLocale(value:Locale){const next=validLocale(value);setLanguage(next);document.documentElement.lang=next;document.cookie=`payguard-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;startTransition(()=>router.refresh());}
 return <LanguageContext.Provider value={{locale,t:value=>translate(value,locale),setLocale,pending}}>{children}</LanguageContext.Provider>;
}
export function useI18n(){return useContext(LanguageContext);}
