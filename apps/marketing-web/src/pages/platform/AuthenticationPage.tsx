import {useState} from 'react';
import {Button,Card} from '@imds/ui';
import {useAuth} from '../../app/AuthProvider';

export function AuthenticationPage(){
  const{session,workspace,loading,error,refreshSession,signOut}=useAuth();
  const[notice,setNotice]=useState('');
  const expiresAt=session?.expires_at?new Date(session.expires_at*1000):null;
  async function refresh(){setNotice('');await refreshSession();setNotice('Сессия успешно обновлена.');}
  async function logoutEverywhere(){setNotice('');await signOut('global');}
  return <div className="platform-core-page">
    <header className="platform-core-head"><div><span>Platform Core</span><h2>Authentication</h2><p>Управление текущей учётной записью, токенами и жизненным циклом сессии.</p></div><span className="core-state core-state--progress">В работе</span></header>
    {error&&<div className="form-error">{error}</div>}{notice&&<div className="form-notice">{notice}</div>}
    <section className="platform-core-grid">
      <Card className="core-panel"><h3>Текущая сессия</h3><dl><dt>Пользователь</dt><dd>{workspace?.currentUser.name||'—'}</dd><dt>Email</dt><dd>{workspace?.currentUser.email||session?.user.email||'—'}</dd><dt>User ID</dt><dd>{session?.user.id||'demo-user'}</dd><dt>Провайдер</dt><dd>{String(session?.user.app_metadata?.provider||'demo')}</dd><dt>Истекает</dt><dd>{expiresAt?expiresAt.toLocaleString('ru-RU'):'Демо-сессия'}</dd></dl></Card>
      <Card className="core-panel"><h3>Управление</h3><div className="core-actions"><Button disabled={loading||!session} onClick={()=>void refresh()}>{loading?'Обновление…':'Обновить сессию'}</Button><Button variant="secondary" disabled={loading||!session} onClick={()=>void logoutEverywhere()}>Выйти на всех устройствах</Button></div><p className="core-hint">Access token хранится в Supabase Auth, автоматически обновляется и не сохраняется в бизнес-таблицах.</p></Card>
      <Card className="core-panel core-panel--wide"><h3>Поддерживаемые сценарии</h3><div className="core-checks"><span>✓ Email и пароль</span><span>✓ Magic Link</span><span>✓ Восстановление пароля</span><span>✓ Обновление пароля</span><span>✓ Автообновление токена</span><span>✓ Локальный и глобальный logout</span><span>○ MFA/TOTP</span><span>○ Device history</span></div></Card>
    </section>
  </div>;
}
