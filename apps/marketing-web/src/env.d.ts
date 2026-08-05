/// <reference types="vite/client" />
interface ImportMetaEnv{readonly VITE_SUPABASE_URL?:string;readonly VITE_SUPABASE_PUBLISHABLE_KEY?:string;readonly VITE_INTEGRATION_SERVICE_URL?:string;readonly VITE_CLIENTS_API_URL?:string}
interface ImportMeta{readonly env:ImportMetaEnv}
