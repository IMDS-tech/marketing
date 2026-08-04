import {FormEvent,useState} from 'react';
import {Button,Card} from '@imds/ui';
import {useAuth} from '../app/AuthProvider';
import {useI18n} from '../i18n/I18nProvider';

export function LoginPage(){const{signIn,error,loading}=useAuth();const{t}=useI18n();const[email,setEmail]=useState('');const[password,setPassword]=useState('');async function submit(event:FormEvent){event.preventDefault();await signIn(email,password)}return <div className="auth-page"><Card className="auth-card"><div className="brand auth-brand"><div className="brand-mark">IM</div><div><strong>IMDS</strong><span>{t('common.marketingPlatform')}</span></div></div><h1>{t('auth.title')}</h1><p>{t('auth.subtitle')}</p><form onSubmit={submit}><label>{t('auth.email')}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>{t('auth.password')}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{error&&<div className="form-error">{error}</div>}<Button disabled={loading}>{loading?t('auth.signingIn'):t('auth.signIn')}</Button></form></Card></div>}
