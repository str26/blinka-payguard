import 'server-only';
import {cookies} from 'next/headers';
import {translate,validLocale} from './translate';
export async function getI18n(){const locale=validLocale((await cookies()).get('payguard-locale')?.value);return {locale,t:<T>(value:T)=>translate(value,locale)};}
