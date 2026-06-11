const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_ACTIONS = new Set(["minimize", "maximize", "close"]);

contextBridge.exposeInMainWorld("streamChargeDesktop", {
  windowControl(action) {
    if (!ALLOWED_ACTIONS.has(action)) {
      return;
    }

    ipcRenderer.send("streamcharge-window-control", action);
  }
});
