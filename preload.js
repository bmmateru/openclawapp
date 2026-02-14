const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openclaw', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  setVibrancy: (type) => ipcRenderer.invoke('set-vibrancy', type)
});
