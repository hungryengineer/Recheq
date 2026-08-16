import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL connection string')
    .refine((val) => val.startsWith('postgres:') || val.startsWith('postgresql:'), {
      message: 'DATABASE_URL must use postgres: or postgresql: scheme',
    }),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL').optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'], {
      errorMap: () => ({
        message: 'S3_FORCE_PATH_STYLE must be exactly "true" or "false"',
      }),
    })
    .optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL').optional(),
  // Development-only identity constants. Required in non-production environments
  // that use them; must never fall back to hardcoded UUIDs in production.
  DEV_USER_ID: z.string().uuid().optional(),
  DEV_ORG_ID: z.string().uuid().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  EXTRACTION_MODEL: z.string().optional(),
  EXTRACTION_FALLBACK: z.string().optional(),
  EPFO_PROVIDER: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEMO_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnv(): Environment {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten();
    console.error('❌ Environment validation failed:\n');
    Object.entries(errors.fieldErrors).forEach(([field, messages]) => {
      console.error(`  ${field}: ${messages?.join(', ')}`);
    });
    if (errors.formErrors.length > 0) {
      console.error(`\n${errors.formErrors.join('\n')}`);
    }
    process.exit(1);
  }

  return result.data;
}

export function getEnv(): Environment {
  return validateEnv();
}
