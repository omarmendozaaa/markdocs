import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api, AppState } from '../shared/types'

const call =
  (channel: string) =>
  (...args: unknown[]): Promise<any> =>
    ipcRenderer.invoke(channel, ...args)

const api: Api = {
  getState: call('state:get'),
  onState(cb) {
    const listener = (_e: unknown, s: AppState): void => cb(s)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  createFolder: call('folder:create'),
  renameFolder: call('folder:rename'),
  deleteFolder: call('folder:delete'),
  chooseFolderOutput: call('folder:chooseOutput'),
  setFolderOutputBeside: call('folder:outputBeside'),
  addFilesDialog: call('files:addDialog'),
  importFolderDialog: call('files:importFolderDialog'),
  addPaths: call('files:addPaths'),
  removeFiles: call('files:remove'),
  moveFiles: call('files:move'),
  convert: call('convert'),
  cancel: call('cancel'),
  setSettings: call('settings:set'),
  chooseOutputRoot: call('settings:chooseOutputRoot'),
  installEngine: call('engine:install'),
  readOutput: call('output:read'),
  showInFolder: call('shell:showInFolder'),
  openPath: call('shell:openPath'),
  copyText: call('clipboard:write'),
  pathForFile: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('api', api)
