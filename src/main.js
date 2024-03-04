const { app, BrowserWindow } = require('electron');
const path = require("path");
const fs = require("fs");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 2560,
    height: 1440,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('https://taxi.yandex.ru');

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Загружаем CSS из файла
  fs.readFile('styles.css', 'utf8', (err, css) => {
    if (err) {
      console.error('Failed to read CSS file', err);
    } else {
      const insertCSS = `
                const style = document.createElement('style');
                style.textContent = \`${css}\`;
                document.head.appendChild(style);
            `;
      mainWindow.webContents.executeJavaScript(insertCSS).then(() => {
        console.log('CSS inserted');
      });
    }
  });

  // Set an interval to log the localStorage value
  mainWindow.webContents.once('dom-ready', () => {
    // Загружаем скрипт из файла
    fs.readFile('script.js', 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read script file', err);
      } else {
        mainWindow.webContents.executeJavaScript(data).then(() => {
          console.log('Script loaded and executed.');
        });
      }
    });
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
