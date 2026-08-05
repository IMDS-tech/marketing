import {z} from 'zod';
const schema=z.object({PORT:z.coerce.number().int().min(1).max(65535).default(4303),DATABASE_URL:z.string().min(1),WORKER_ID:z.string().min(1).default('notification-worker'),POLL_INTERVAL_MS:z.coerce.number().int().min(250).max(60000).default(3000),EMAIL_WEBHOOK_URL:z.string().url().optional().or(z.literal('')),SLACK_WEBHOOK_URL:z.string().url().optional().or(z.literal('')),TELEGRAM_BOT_TOKEN:z.string().optional().default(''),WEBHOOK_SIGNING_SECRET:z.string().min(16),INTERNAL_SERVICE_TOKEN:z.string().min(16)});
export const config=schema.parse(process.env);
