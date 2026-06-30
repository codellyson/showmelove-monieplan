/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| showmelove routes. The public creator page lives at /:handle, so it is
| registered last to avoid shadowing the named pages above it.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { auth } from '#lib/auth'
import { toWebRequest, sendWebResponse } from '#lib/auth_http'

const PagesController = () => import('#controllers/pages_controller')
const SupportController = () => import('#controllers/support_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const SupportersController = () => import('#controllers/supporters_controller')
const ConnectController = () => import('#controllers/connect_controller')
const AuthController = () => import('#controllers/auth_controller')
const SettingsController = () => import('#controllers/settings_controller')
const WebhooksController = () => import('#controllers/webhooks_controller')
const PayoutsController = () => import('#controllers/payouts_controller')

// Better Auth — handles /api/auth/sign-up/email, /sign-in/email, /sign-out, etc.
router.any('/api/auth/*', async (ctx) => {
  const res = await auth.handler(toWebRequest(ctx))
  return sendWebResponse(ctx, res)
})

// Payment provider webhooks (signature-verified, CSRF-exempt).
router.get('/webhooks/khaime', [WebhooksController, 'khaimeHealth'])
router.post('/webhooks/khaime', [WebhooksController, 'khaime'])

// Auth pages
router.get('/login', [AuthController, 'showLogin'])
router.get('/register', [AuthController, 'showRegister'])
router.get('/forgot', [AuthController, 'showForgot'])
router.get('/reset', [AuthController, 'showReset'])
router.post('/logout', [AuthController, 'logout'])

router.get('/', [PagesController, 'landing'])

// Authenticated creator area
router.get('/setup', [PagesController, 'setup']).use(middleware.auth())
router.post('/setup', [PagesController, 'saveSetup']).use(middleware.auth())
router.get('/dashboard', [DashboardController, 'index']).use(middleware.auth())
router.get('/supporters', [SupportersController, 'index']).use(middleware.auth())
router.get('/connect', [ConnectController, 'show']).use(middleware.auth())
router.post('/connect', [ConnectController, 'store']).use(middleware.auth())
router.post('/connect/reset', [ConnectController, 'reset']).use(middleware.auth())

router.get('/settings', [SettingsController, 'show']).use(middleware.auth())
router.post('/settings', [SettingsController, 'update']).use(middleware.auth())
router.post('/brand', [SettingsController, 'saveBrand']).use(middleware.auth())

router.get('/payouts', [PayoutsController, 'show']).use(middleware.auth())
router.post('/payouts/bank', [PayoutsController, 'setupBank']).use(middleware.auth())
router.post('/payouts/stripe', [PayoutsController, 'connectStripe']).use(middleware.auth())
router.post('/payouts/request', [PayoutsController, 'requestPayout']).use(middleware.auth())

// Public creator page + support — registered last (catch-all handle).
router.post('/:handle/support', [SupportController, 'store'])
router.get('/:handle', [SupportController, 'show'])
