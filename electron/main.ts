import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { registerIpcHandlers } from './ipc-handlers'

interface OverlayColors {
  color: string
  symbolColor: string
}

interface TitleBarColors extends OverlayColors {
  mode: 'light' | 'dark' | 'system'
}

const OVERLAY_HEIGHT = 36
let overlayMode: TitleBarColors['mode'] = 'system'

function overlayFromSystem(): OverlayColors {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#0b0b0f', symbolColor: '#e7e7ea' }
    : { color: '#fafafa', symbolColor: '#18181b' }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 940,
    minHeight: 640,
    // Marco oculto con controles nativos en un overlay; los colores se sincronizan con el tema.
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...overlayFromSystem(), height: OVERLAY_HEIGHT },
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.once('ready-to-show', () => window.show())

  if (!app.isPackaged) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173')
  } else {
    void window.loadFile(join(__dirname, '..', 'dist', 'index.html'))
  }
  return window
}

function applyOverlay(window: BrowserWindow, colors: OverlayColors): void {
  // WCO no está disponible en todas las combinaciones de SO/gestor de ventanas.
  try {
    window.setTitleBarOverlay({ ...colors, height: OVERLAY_HEIGHT })
  } catch {
    // Sin overlay los botones siguen visibles; la barra arrastrable no depende de él.
  }
}

ipcMain.on('flock:titlebar', (event, colors: TitleBarColors) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || typeof colors.color !== 'string' || typeof colors.symbolColor !== 'string') return
  overlayMode = colors.mode
  applyOverlay(window, { color: colors.color, symbolColor: colors.symbolColor })
})

let mainWindow: BrowserWindow | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  void app.whenReady().then(() => {
    registerIpcHandlers()
    mainWindow = createWindow()
    nativeTheme.on('updated', () => {
      if (overlayMode !== 'system') return
      if (mainWindow && !mainWindow.isDestroyed()) {
        applyOverlay(mainWindow, overlayFromSystem())
      }
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
