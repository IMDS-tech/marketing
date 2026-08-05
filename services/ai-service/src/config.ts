import {z} from 'zod';
const schema=z.object({
  PORT:z.coerce.number().int().min(1).max(65535).default(4304),
  DATABASE_URL:z.string().min(1),
  SUPABASE_URL:z.string().url(),
  APP_ORIGIN:z.string().url(),
  AI_PROVIDER_BASE_URL:z.string().url(),
  AI_PROVIDER_API_KEY:z.string().default(''),
  AI_PROVIDER_MODEL:z.string().min(1).default('default-model'),
  AI_MAX_INPUT_CHARS:z.coerce.number().int().min(1000).max(200000).default(24000),
  AI_ALLOWED_TOOLS:z.string().default('search,metric-summary'),
});
const parsed=schema.parse(process.env);
export const config={...parsed,AI_ALLOWED_TOOLS:new Set(parsed.AI_ALLOWED_TOOLS.split(',').map(value=>value.trim()).filter(Boolean))};
