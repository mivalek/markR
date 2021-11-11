// 1. Require the module
// const TabGroup = window.electron.require("electron-tabs");
const TabGroup = require("electron-tabs");
const dragula = require("dragula");
const { ipcRenderer } = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");

let isMac, dialogResponse;

// 2. Define the instance of the tab group (container)
let tabGroup = new TabGroup({
    //   If you want a new button that appends a new tab, include:
    // newTab: {
    //     title: "New Tab",
    //     // The file will need to be local, probably a local-ntp.html file
    //     // like in the Google Chrome Browser.
    //     src: url.pathToFileURL(path.join(__dirname, "default_tab.html")).href,
    //     visible: true,
    //     active: true,
    //     webviewAttributes: {
    //         nodeIntegration: false,
    //         contextIsolation: true,
    //         preload: path.join(__dirname, "preload.js"), //"./preload.js",
    //     },
    // },

    ready: function (tabGroup) {
        dragula([tabGroup.tabContainer], {
            direction: "horizontal",
        });
    },
});

// 3. Add a tab from a website
let tab1 = tabGroup.addTab({
    title: "Welcome",
    src: url.pathToFileURL(path.join(__dirname, "default_tab.html")).href,
    visible: true,
    active: true,
    closable: false,
    webviewAttributes: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"), //"./preload.js",
    },
});

tab1.webview.addEventListener("dom-ready", () => {
    const defaultTabId = tab1.webview.getWebContentsId();
    ipcRenderer.sendTo(defaultTabId, "isMac:send", isMac.toString());
    console.log(isMac + " sent to tab");

    tab1.webview.openDevTools();
});

// tab1.webview.addEventListener("dom-ready", () => {
//     const defaultTabId = tab1.webview.getWebContentsId();
//     ipcRenderer.sendTo(defaultTabId, "isMac:send", isMac.toString());
//     console.log(isMac + " sent to tab");
// });

tab1.webview.addEventListener("ipc-message", (event) => {
    if (event.channel == "menu:close") {
        closeMenu();
    }
});

let tabs = [];
ipcRenderer.on("tab:open", (e, fPath) => {
    let htmlString;
    fs.readFile(fPath, "utf8", (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        htmlString = data;
        fPathSanitised = fPath.replaceAll("\\", "/");
        const tabTitle = path.basename(fPathSanitised).split(".")[0];
        // if file already open, switch to tab
        if (tabs.map((t) => t.path).includes(fPathSanitised)) {
            tabs.find((e) => e.path === fPathSanitised).tab.activate();
            return;
        }
        const thisTab = tabGroup.addTab({
            title: fPathSanitised,
            src: url.pathToFileURL(path.join(__dirname, "editorWindow.html"))
                .href,
            visible: true,
            active: true,
            unsaved: false,
            webviewAttributes: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "preload.js"), //"./preload.js",
            },
        });

        document.querySelector(
            `.etabs-tab-title[title="${fPathSanitised}"]`
        ).innerText = tabTitle;

        thisTab.webview.addEventListener("dom-ready", () => {
            thisTab.webview.openDevTools();
        });
        thisTab.webview.addEventListener("ipc-message", (event) => {
            if (event.channel === "menu:close") {
                closeMenu();
                return;
            }
            // don't know how to implement undo
            // if (event.channel === "undo:attempted") {
            //     console.log(event.target);
            //     return;
            // }
            if (event.channel === "file:changed") {
                document
                    .querySelector(".etabs-tab.active")
                    .querySelector(".etabs-tab-title")
                    .classList.add("unsaved");
                tabGroup.getActiveTab().unsaved = true;
                return;
            }
            if (event.channel === "file:unchanged") {
                document
                    .querySelector(".etabs-tab.active")
                    .querySelector(".etabs-tab-title")
                    .classList.remove("unsaved");
                tabGroup.getActiveTab().unsaved = false;
                return;
            }
            const tab = tabGroup.getTab(event.args[0]); // args[0] is tabID
            tab._events.closing = function () {}; // remove on("closing")
            tab.close();
        });
        tabs.push({ title: tabTitle, path: fPathSanitised, tab: thisTab });
        thisTab.on("webview-ready", (tab) => {
            const webContentsID = tab.webview.getWebContentsId();
            ipcRenderer.sendTo(webContentsID, "htmlString:send", {
                path: fPath,
                content: htmlString,
            });
            thisTab.on("closing", (tab, abort) => {
                abort();
                if (tab.unsaved) {
                    tab.activate();
                    showDialog("save-current", tab.id);
                    return;
                }
                closeTab(tab.id);
            });
        });
    });
});

ipcRenderer.on("file:save", () => {
    const tab = tabGroup.getActiveTab();
    ipcRenderer.sendTo(tab.webview.getWebContentsId(), "file:saving");
});

ipcRenderer.on("file:did-save", (e, tabID) => {
    console.log(tabID);
    const tab = tabGroup.getTab(tabID);
    tab._events.closing = function () {}; // remove on("closing")
    tab.close();
});

ipcRenderer.on("platform:send", (e, data) => {
    console.log(data);
    isMac = data === "true";

    if (isMac) document.getElementById("titlebar").classList.add("mac");

    document.querySelectorAll(".submenu-item").forEach((el) => {
        const hotKey = document.createElement("span");
        hotKey.classList.add("hotkey");
        hotKey.innerText = makeHotkey(el.getAttribute("hk"));
        el.appendChild(hotKey);
        el.addEventListener("click", (e) => {
            console.log(el.id);
            ipcRenderer.send(el.id);
        });
    });
});

document.querySelectorAll(".menu-label").forEach((el) => {
    el.addEventListener("mouseover", (e) => {
        const activeMenuItem = document.querySelector(".menu-container.active");
        if (!activeMenuItem) return;
        closeMenu();
        const parentClass = e.target.parentNode.classList;
        parentClass.contains("active")
            ? parentClass.remove("active")
            : parentClass.add("active");
    });
    el.addEventListener("click", (e) => {
        closeMenu();
        const parentClass = e.target.parentNode.classList;
        parentClass.contains("active")
            ? parentClass.remove("active")
            : parentClass.add("active");
        e.stopPropagation();
    });
});

function minimise() {
    ipcRenderer.send("win:min");
}

function maximise() {
    ipcRenderer.send("win:max");
}

function unmaximise() {
    ipcRenderer.send("win:unmax");
}

function quit() {
    if (tabs.some((e) => e.tab.unsaved)) {
        showDialog("save-all");
    } else ipcRenderer.send("app:quit");
}

function makeHotkey(k) {
    if (!k) return "";
    controlKey = isMac ? "⌘ Cmd" : "Ctrl";
    const keys = k.toUpperCase().replace("SHIFT", "⇧");
    return controlKey + "+" + keys;
}

document
    .querySelectorAll(".menu-item .divisor, .dialog")
    .forEach((el) => el.addEventListener("click", (e) => e.stopPropagation()));

document.addEventListener("click", (e) => {
    closeMenu();
});

let shiftPressed = false;
document.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
        shiftPressed = true;
        return;
    }
    if (e.key !== "Tab") {
        return;
    }
    const dialog = document.querySelector(".dialog.show");
    const activeElement = document.activeElement;
    if (dialog) {
        if (shiftPressed && activeElement.classList.contains("yes")) {
            dialog.querySelector(".tab-placeholder-end").focus();
            return;
        }
        if (!shiftPressed && activeElement.classList.contains("cancel")) {
            dialog.querySelector(".tab-placeholder-start").focus();
        }
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key === "Shift") shiftPressed = false;
});

function closeMenu() {
    document
        .querySelectorAll(".menu-container.active")
        .forEach((el) => el.classList.remove("active"));
}

function showDialog(which, tabID) {
    document.querySelector(".etabs-views").classList.add("blur");
    document.getElementById("dialog-container").classList.add("show");
    const dialog = document.querySelector(`#${which}.dialog`);
    dialog.classList.add("show");
    dialog.setAttribute("tabId", tabID);
    dialog.querySelector(".yes").focus();
}

function hideDialog() {
    document.querySelector(".etabs-views").classList.remove("blur");
    document.getElementById("dialog-container").classList.remove("show");
    document
        .querySelectorAll(".dialog")
        .forEach((el) => el.classList.remove("show"));
}

function saveAndClose(tabID) {
    tabID = +tabID;
    const tab = tabGroup.getTab(tabID);
    ipcRenderer.sendTo(tab.webview.getWebContentsId(), "tab:close", tabID);
    console.log("tab close event triggered");
    tabs = tabs.filter(function (t) {
        return t.path !== tab.title;
    });
    hideDialog();
}

function saveAllTabs() {
    const tabsToSave = tabs.filter((t) => t.tab.unsaved === true);
    tabsToSave.forEach((t, i) => {
        ipcRenderer.sendTo(
            t.tab.webview.getWebContentsId(),
            "file:saving",
            tabsToSave.length === i + 1 ? "true" : "false"
        );
    });
    ipcRenderer.send("app:quit");
}

function closeTab(tabID) {
    tabID = +tabID;
    const tab = tabGroup.getTab(tabID);
    tab._events.closing = function () {}; // remove on("closing")
    tab.close();
    tabs = tabs.filter(function (t) {
        return t.path !== tab.title;
    });
    hideDialog();
}

ipcRenderer.on("win:isMax", (e, isMax) => {
    console.log("received isMax: " + isMax);
    const icon = document.querySelectorAll(".resize");
    isMax === "true"
        ? icon.forEach((i) => i.classList.add("maximised"))
        : icon.forEach((i) => i.classList.remove("maximised"));
});

ipcRenderer.on("menu-item:destroy", () => closeMenu());
