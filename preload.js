const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const url = require("url");
const path = require("path");
// const TabGroup = require("electron-tabs");
const Main = require("electron/main");
const dirname = __dirname;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
    sendToMain: (channel, data) => {
        // whitelist channels
        let validChannels = [
            "toMain",
            "html:write",
            "open:request",
            "external:request",
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    sendToTab: (id, channel, data) => {
        if (channel === "htmlString:send") {
            ipcRenderer.send(id, channel, data);
        }
    },
    sendToHost: (channel, data = "") => {
        let validChannels = [
            "file:did-save",
            "menu:close",
            "undo:attempted",
            "file:changed",
            "file:unchanged",
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.sendToHost(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = [
            "fromMain",
            "tab:open",
            "htmlString:send",
            "tab:close",
            "isMac:send",
            "file:saving",
        ];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    readFile: (path, func) =>
        fs.readFile(path, "utf8", (...args) => func(...args)),
    makePath: (filePath) =>
        url.pathToFileURL(path.join(dirname, filePath)).href,
    // tabGroup: TabGroup,
});
