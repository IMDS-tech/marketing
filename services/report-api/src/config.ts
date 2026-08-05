import {z} from 'zod';

const schema=z.object({
  PORT:z.coerce.number().int().positive().default(4200),
  DATABASE_URL:z.string().min(1),
  SUPABASE_URL:z.string().url(),
  APP_ORIGIN:z.string().url(),
});

export const config=schema.parse(process.env);
