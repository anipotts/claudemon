export interface Env {
  SESSION_ROOM: DurableObjectNamespace;
  API_KEYS: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  WEBHOOK_SECRET?: string;
  SINGLE_USER?: string; // "true" for self-hosted mode
}
