export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ServerConfig {
  host: string;
  port: number;
  requestTimeout: number;
}

export interface ApiKeyEntry {
  key: string;
  clientId: string;
}

export interface AuthConfig {
  apiKeys: ApiKeyEntry[];
}

export interface SessionConfig {
  ttlSeconds: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  maxPerMinute: number;
}

export interface RedisConfig {
  url: string;
}

export interface AnthropicProviderConfig {
  apiKey: string;
  defaultModel: string;
}

export interface OpenAIProviderConfig {
  apiKey: string;
  defaultModel: string;
}

export interface AzureOpenAIProviderConfig {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  deployment: string;
  defaultModel: string;
}

export type ProviderConfig =
  | { type: 'anthropic'; anthropic: AnthropicProviderConfig }
  | { type: 'openai'; openai: OpenAIProviderConfig }
  | { type: 'azure-openai'; azure: AzureOpenAIProviderConfig };

export interface LoggingConfig {
  level: LogLevel;
  prettyPrint: boolean;
}

export interface AdminConfig {
  enabled: boolean;
  adminKey?: string;
}

export interface AlertWebhookConfig {
  url: string;
  name: string;
  events: ('CRITICAL_RISK' | 'NEW_PII_IN_RESPONSE')[];
}

export interface AlertsConfig {
  enabled: boolean;
  webhooks: AlertWebhookConfig[];
}

export interface RoutingConfig {
  rejectCritical: boolean;
  costOptimize: boolean;
  cheapModel?: string;
}

export interface GatewayConfig {
  server: ServerConfig;
  auth: AuthConfig;
  session: SessionConfig;
  rateLimit?: RateLimitConfig;
  redis?: RedisConfig;
  provider: ProviderConfig;
  logging: LoggingConfig;
  admin?: AdminConfig;
  alerts?: AlertsConfig;
  routing?: RoutingConfig;
}

export interface TurkishPiiEntities {
  tcId: boolean;
  phone: boolean;
  email: boolean;
  name: boolean;
}

export interface FinancialEntities {
  iban: boolean;
  creditCard: boolean;
}

export interface MedicalEntities {
  diagnosisCodes: boolean;
  medications: boolean;
  patientId: boolean;
}

export interface KeywordsConfig {
  enabled: boolean;
  blocklist: string[];
  caseSensitive: boolean;
}

export interface DetectorsConfig {
  turkishPii: { enabled: boolean; entities: TurkishPiiEntities };
  financial: { enabled: boolean; entities: FinancialEntities };
  medical: {
    enabled: boolean;
    entities: MedicalEntities;
    medicationList?: string[];
  };
  keywords: KeywordsConfig;
}

export interface MaskingConfig {
  detectors: DetectorsConfig;
  confidenceThreshold: number;
}
