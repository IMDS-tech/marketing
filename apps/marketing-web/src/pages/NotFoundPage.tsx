import {Button,EmptyState} from '@imds/ui';
export function NotFoundPage(){return <EmptyState icon="404" title="Страница не найдена" description="Маршрут не существует или был перемещён." benefits={["Проверьте адрес","Вернитесь к списку клиентов","Используйте навигацию слева"]} action={<Button onClick={()=>location.assign('/')}>К клиентам</Button>}/>}
