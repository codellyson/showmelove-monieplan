/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Khaime — managed payouts partner (optional; payments disabled if unset)
  |----------------------------------------------------------
  */
  KHAIME_API_KEY: Env.schema.string.optional(),
  KHAIME_API_URL: Env.schema.string.optional(),
  KHAIME_WEBHOOK_SECRET: Env.schema.string.optional(),
  KHAIME_COMMISSION_RATE: Env.schema.number.optional(),
  APP_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Brevo — transactional email (auth verification + password reset).
  | If unset, emails are logged to the console instead of sent.
  |----------------------------------------------------------
  */
  BREVO_API_KEY: Env.schema.string.optional(),
  MAIL_FROM_EMAIL: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),
})
