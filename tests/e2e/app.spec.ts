import { _electron as electron, expect, test } from '@playwright/test'

test('la ventana principal muestra el dashboard', async () => {
  test.skip(
    !process.env.E2E_ELECTRON,
    'Requiere E2E_ELECTRON=1, npm run build:electron y npm run build:renderer',
  )
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()
  await expect(window.getByText('Dashboard')).toBeVisible()
  await app.close()
})

test('toda la ventana es arrastrable salvo los controles', async () => {
  test.skip(
    !process.env.E2E_ELECTRON,
    'Requiere E2E_ELECTRON=1, npm run build:electron y npm run build:renderer',
  )
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()
  await expect(window.locator('.window-drag-all')).toBeVisible()
  await expect(window.locator('.window-drag-all')).toHaveCSS('app-region', 'drag')
  await expect(window.getByText('Dashboard').first()).toHaveCSS('app-region', 'no-drag')
  await app.close()
})
