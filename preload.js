const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openclaw', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  setVibrancy: (type) => ipcRenderer.invoke('set-vibrancy', type),
  getGatewayConfig: () => ipcRenderer.invoke('get-gateway-config'),
  reconnectGateway: () => ipcRenderer.invoke('reconnect-gateway'),
  scanNetwork: () => ipcRenderer.invoke('scan-network'),
  getThemes: () => ipcRenderer.invoke('get-themes'),
  setTheme: (themeId) => ipcRenderer.invoke('set-theme', themeId)
});
