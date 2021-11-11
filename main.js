const rubric_url =
    "https://docs.google.com/spreadsheets/d/18IE5rAZVIWAFgBZ0kZKOrfq_qT7sR8Se-y23a7xXLwo/edit?usp=sharing";
const rubricId = rubric_url.replace(/.*\/d\/(.*)\/.*/, "$1");
let rubric;
const electron = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");
// const Main = require("electron/main");
const fetch = require("electron-fetch").default;
const Store = require("electron-store");

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = electron;

const isMac = process.platform == "darwin";
let mainWindow, isMax;

const schema = {
    // foo: {
    //     type: "object",
    //     properties: {
    //         bar: {
    //             type: "number",
    //             maximum: 1500,
    //             minimum: 400,
    //             default: 900,
    //         },
    //     },
    // },
    window: {
        type: "object",
        properties: {
            height: {
                type: "number",
                maximum: 1500,
                minimum: 400,
                default: 900,
            },
            width: {
                type: "number",
                maximum: 2500,
                minimum: 700,
                default: 1200,
            },
            fullscreen: {
                type: "string",
                enum: ["true", "false"],
                default: "false",
            },
        },
        additionalProperties: false,
    },
};
const store = new Store({
    defaults: {
        window: {
            height: 600,
            width: 800,
            fullscreen: "false",
            centre: "true",
        },
    },
    schema,
});

// Listen for app to be ready
app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        webPreferences: {
            webviewTag: true,
            contextIsolation: false,
            nodeIntegration: true,
        },
        show: false,
        frame: false,
        width: store.get("window.width"),
        height: store.get("window.height"),
        x: store.get("window.x"),
        y: store.get("window.y"),
        minHeight: 400,
        minWidth: 700,
        backgroundColor: "#2b2c31",
    });
    // Load HTML file into window
    mainWindow.loadURL(
        url.pathToFileURL(path.join(__dirname, "mainWindow.html")).href
    );
    mainWindow.once("ready-to-show", () => {
        if (store.get("window.fullscreen") === "true") mainWindow.maximize();
        mainWindow.show();
    });
    // quit app when main window closed
    mainWindow.on("closed", function () {
        app.quit();
    });

    mainWindow.on("maximize", () =>
        mainWindow.webContents.send("win:isMax", "true")
    );
    mainWindow.on("unmaximize", () =>
        mainWindow.webContents.send("win:isMax", "false")
    );

    mainWindow.webContents.on("did-finish-load", () => {
        isMax = mainWindow.isMaximized() ? "true" : "false";
        mainWindow.webContents.send("platform:send", isMac.toString());
        mainWindow.webContents.send("win:isMax", isMax);
    });

    mainWindow.on("will-move", function () {
        mainWindow.webContents.send("menu-item:destroy");
    });

    // build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    // insert menu
    Menu.setApplicationMenu(mainMenu);

    //     const response = await fetch('https://api.github.com/users/github');
    // const data = await response.json();

    fetch(`https://opensheet.vercel.app/${rubricId}/Sheet1`)
        .then((res) => res.json())
        .then((data) => {
            rubric = data;
            // console.log(data);
            // data.forEach(row => {
            //   // Do something with each row here.
            // })
        });
});

// save file
ipcMain.on("html:write", (e, data) => {
    let saveData = data;
    writeFile(saveData);
});

async function writeFile(saveData) {
    const fileHTML = await fs.promises.readFile(
        "out_template.html",
        "utf8",
        (err, data) => {
            if (err) {
                console.error(err);
                throw new Error("Template file not read");
            }
            return data;
        }
    );
    const out = fileHTML.replace("<body>", "<body>\n" + saveData.bodyHTML);
    await fs.promises.writeFile(saveData.path, out, (err) => {
        if (err) throw err;
        console.log("The file has been saved to " + saveData.path);
    });
    if (saveData.lastFile) app.quit();
}
ipcMain.on("open:request", () => createOpenFileWindow());
ipcMain.on("external:request", (e, url) => {
    console.log(url);
    shell.openExternal(url);
});
// handle open file window
function createOpenFileWindow() {
    // https://stackoverflow.com/questions/45849190/how-to-show-an-open-file-native-dialog-with-electron
    dialog
        .showOpenDialog({ properties: ["openFile"] })
        .then(function (response) {
            if (!response.canceled) {
                // handle fully qualified file name
                readFile(response.filePaths[0]);
            } else {
                console.log("no file selected");
            }
        });
}

ipcMain.on("save:request", () => mainWindow.webContents.send("file:save"));
ipcMain.on("rubric:open", () => {});
ipcMain.on("comments:open", () => mainWindow.minimize());

// ipcMain.on("undo", () => mainWindow.webContents.undo());
// ipcMain.on("redo", () => mainWindow.webContents.redo());
ipcMain.on("cut", () => mainWindow.webContents.cut());
ipcMain.on("copy", () => mainWindow.webContents.copy());
ipcMain.on("paste", () => mainWindow.webContents.paste());

ipcMain.on("win:min", () => mainWindow.minimize());
ipcMain.on("win:max", () => mainWindow.maximize());
ipcMain.on("win:unmax", () => mainWindow.unmaximize());
ipcMain.on("app:quit", () => app.quit());

function readFile(file) {
    mainWindow.webContents.send("tab:open", file);
}

// Create main menu template
const mainMenuTemplate = [
    {
        label: "File",
        submenu: [
            {
                label: "Open File...",
                accelerator: isMac ? "Command+O" : "Ctrl+O",
                click() {
                    createOpenFileWindow();
                },
            },
            {
                label: "Save",
                accelerator: isMac ? "Command+S" : "Ctrl+S",
            },
            {
                label: "Quit",
                // accelerator: isMac ? "Command+Q" : "Ctrl+Q",
                click() {
                    app.quit();
                },
            },
        ],
    },
    {
        label: "Edit",
        submenu: [
            // {
            //     label: "Undo",
            //     accelerator: isMac ? "Command+Q" : "Ctrl+Z",
            //     click: (event, focusedWindow, focusedWebContents) => {
            //         focusedWindow.webContents.undo();
            //         console.log(focusedWindow.webContents);
            //     },
            // },
            // { role: "redo" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
        ],
    },
    {
        label: "View",
        submenu: [
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
        ],
    },
];

// if macOS add empty object to menu
if (isMac) {
    mainMenuTemplate.unshift({});
}

// Add devTools in menu if not in production
if (process.env.NODE_ENV !== "production") {
    mainMenuTemplate.push({
        label: "Developer Tools",
        submenu: [
            {
                role: "reload",
            },
            {
                label: "Toggle dev tools",
                accelerator: isMac ? "Command+Shift+I" : "Ctrl+Shift+I",
                click(item, focusedWindow) {
                    focusedWindow.toggleDevTools();
                },
            },
        ],
    });
}

function saveWindowParameters() {}

function quitApp() {
    saveWindowParameters();
    app.quit();
}
