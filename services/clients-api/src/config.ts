import {z} from 'zod';
const schema=z.object({DATABASE_URL:z.string().min(1),SUPABASE_URL:z.string().url(),PORT:z.coerce.number().int().positive().default(4102),CORS_ORIGIN:z.string().default('*')});
export const config=schema.parse(process.env);
