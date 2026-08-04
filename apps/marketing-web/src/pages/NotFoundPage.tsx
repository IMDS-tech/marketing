import {Button,EmptyState} from '@imds/ui';
import {useI18n} from '../i18n/I18nProvider';
export function NotFoundPage(){const{t}=useI18n();return <EmptyState icon="404" title={t('notFound.title')} description={t('notFound.description')} benefits={[t('notFound.benefitAddress'),t('notFound.benefitClients'),t('notFound.benefitNavigation')]} action={<Button onClick={()=>location.assign('/')}>{t('notFound.action')}</Button>}/>}
