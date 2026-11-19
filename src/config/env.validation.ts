import * as Joi from 'joi';

/**
 * Валидация переменных окружения на старте приложения.
 * Лучше упасть при запуске, чем получить невнятную ошибку в рантайме.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().port().default(3000),
    API_PREFIX: Joi.string().default('api/v1'),

    DATABASE_URL: Joi.string()
      .pattern(/^postgres(ql)?:\/\//)
      .required()
      .messages({ 'string.pattern.base': 'DATABASE_URL должен быть postgresql://...' }),

    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(2_592_000),

    BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),
    CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

    // Доверять X-Forwarded-For от reverse proxy (Caddy/nginx).
    TRUST_PROXY: Joi.boolean().default(false),

    // Бизнес-правило: откликнуться можно только на полностью подходящий график.
    REQUIRE_SCHEDULE_MATCH: Joi.boolean().default(true),
  });

  const { error, value } = schema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

  if (error) {
    throw new Error(`Некорректная конфигурация окружения: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
