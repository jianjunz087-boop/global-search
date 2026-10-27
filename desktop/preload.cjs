const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('desktop',{saveSearchKey:key=>ipcRenderer.invoke('save-search-key',key)});
