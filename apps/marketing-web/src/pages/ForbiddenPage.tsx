import {Button,EmptyState} from '@imds/ui';
import {useI18n} from '../i18n/I18nProvider';
export function ForbiddenPage(){const{t}=useI18n();return <EmptyState icon="403" title={t('forbidden.title')} description={t('forbidden.description')} benefits={[t('forbidden.benefitAgency'),t('forbidden.benefitProjects'),t('forbidden.benefitRls')]} action={<Button onClick={()=>history.back()}>{t('common.back')}</Button>}/>}
