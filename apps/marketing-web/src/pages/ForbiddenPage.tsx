import {Button,EmptyState} from '@imds/ui';
export function ForbiddenPage(){return <EmptyState icon="403" title="Нет доступа" description="У вашей роли нет разрешения на этот раздел." benefits={["Доступ управляется на уровне агентства","Клиент видит только назначенные проекты","Все проверки дублируются RLS"]} action={<Button onClick={()=>history.back()}>Назад</Button>}/>}
