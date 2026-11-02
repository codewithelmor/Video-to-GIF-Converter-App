import { contextBridge, ipcRenderer, webUtils } from 'electron';

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),
  pickVideo: (current) => ipcRenderer.invoke('video:pick', current),
  pathForFile: (file) => webUtils.getPathForFile(file),
  probe: (file) => ipcRenderer.invoke('video:probe', file),
  convert: (request) => ipcRenderer.invoke('video:convert', request),
  cancel: () => ipcRenderer.invoke('video:cancel'),
  onProgress: (callback) => {
    const listener = (_e: unknown, percent: number): void => callback(percent);
    ipcRenderer.on('video:progress', listener);
    return () => ipcRenderer.removeListener('video:progress', listener);
  },
  showInFolder: (path) => ipcRenderer.invoke('file:show', path),
};

contextBridge.exposeInMainWorld('api', api);
