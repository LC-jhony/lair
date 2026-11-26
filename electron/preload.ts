import { contextBridge, ipcRenderer } from 'electron'

interface TitleBarColors {
  color: string
  symbolColor: string
  mode: 'light' | 'dark' | 'system'
}

interface FlockBridge {
  invoke<T>(cmd: string, args?: unknown): Promise<T>
  onEvent(callback: (event: unknown) => void): () => void
  setTitleBarColors: (colors: TitleBarColors) => void
}

const bridge: FlockBridge = {
  invoke: <T>(cmd: string, args?: unknown): Promise<T> =>
    ipcRenderer.invoke('flock:invoke', cmd, JSON.stringify(args ?? {})) as Promise<T>,
  onEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on('flock:event', listener)
    return () => ipcRenderer.removeListener('flock:event', listener)
  },
  setTitleBarColors: (colors: TitleBarColors) => ipcRenderer.send('flock:titlebar', colors),
}

contextBridge.exposeInMainWorld('flock', bridge)
