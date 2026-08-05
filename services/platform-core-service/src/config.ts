import {z} from 'zod';

const schema=z.object({
  PORT:z.coerce.number().int().min(1).max(65535).default(4300),
  DATABASE_URL:z.string().min(1),
  SUPABASE_URL:z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY:z.string().default(''),
  APP_ORIGIN:z.string().url().default('http://localhost:5173'),
});

export const config=schema.parse(process.env);
