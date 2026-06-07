import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { GatewayConfig, MaskingConfig } from './types';

function interpolateEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key: string) => process.env[key] ?? '');
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnvVars);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        interpolateEnvVars(v),
      ])
    );
  }
  return obj;
}

function loadYaml<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = yaml.load(content);
  if (raw === null || raw === undefined) {
    throw new Error(`Config file is empty: ${filePath}`);
  }
  return interpolateEnvVars(raw) as T;
}

export function loadGatewayConfig(
  configDir: string = path.join(process.cwd(), 'config')
): GatewayConfig {
  return loadYaml<GatewayConfig>(path.join(configDir, 'gateway.yaml'));
}

export function loadMaskingConfig(
  configDir: string = path.join(process.cwd(), 'config')
): MaskingConfig {
  return loadYaml<MaskingConfig>(path.join(configDir, 'masking.yaml'));
}
