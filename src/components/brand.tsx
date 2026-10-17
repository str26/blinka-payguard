'use client';
import {useI18n} from '@/lib/i18n/provider';
import Link from 'next/link';
export default function Brand(){
 const {t,locale}=useI18n();
return <Link href="/" className="pg-brand" aria-label={t("Blinka PayGuard, inicio")}><span className="pg-logo"><img src="/brand/blinka-light.svg" className="pg-logo-light" width="101" height="34" alt={t("Blinka")}/><img src="/brand/blinka-dark.svg" className="pg-logo-dark" width="101" height="34" alt={t("")}/></span><span className="pg-product">{t("PayGuard")}</span></Link>;}
