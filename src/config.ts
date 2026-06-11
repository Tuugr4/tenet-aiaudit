import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const ConfigSchema = Type.Object({
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  LOG_LEVEL: Type.Union(
    ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].map((l) => Type.Literal(l)),
    { default: 'info' },
  ),
  DATABASE_URL: Type.String(),
  RATE_LIMIT_AUTHENTICATED: Type.Number({ default: 600 }),
  RATE_LIMIT_ANONYMOUS: Type.Number({ default: 60 }),
});

export type Config = Static<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(ConfigSchema.properties)) {
    if (env[key] !== undefined && env[key] !== '') raw[key] = env[key];
  }
  const withDefaults = Value.Default(ConfigSchema, raw);
  const converted = Value.Convert(ConfigSchema, withDefaults);
  if (!Value.Check(ConfigSchema, converted)) {
    const errors = [...Value.Errors(ConfigSchema, converted)]
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${errors}`);
  }
  return converted;
}
