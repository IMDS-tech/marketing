import {Button,EmptyState} from '@imds/ui';
import {useI18n} from '../i18n/I18nProvider';

export function EmptySectionPage({titleKey}:{titleKey:string}){const{t}=useI18n();const section=t(titleKey);return <EmptyState icon="▦" title={t('empty.title',{section})} description={t('empty.description')} benefits={[t('empty.benefitPermissions'),t('empty.benefitDesign'),t('empty.benefitIntegrations')]} action={<Button>{t('common.createFirstItem')}</Button>}/>}
