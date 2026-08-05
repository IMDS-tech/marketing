import {z} from 'zod';
const bool=z.string().default('true').transform(value=>!['0','false','no','off'].includes(value.toLowerCase()));
export const config=z.object({PORT:z.coerce.number().int().min(1).max(65535).default(4305),DATABASE_URL:z.string().min(1),SUPABASE_URL:z.string().url(),APP_ORIGIN:z.string().url(),INTERNAL_SERVICE_TOKEN:z.string().min(16),WORKER_ID:z.string().min(1).default('search-indexer-1'),POLL_INTERVAL_MS:z.coerce.number().int().min(250).max(60000).default(3000),INDEXER_ENABLED:bool}).parse(process.env);
