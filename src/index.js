const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Yandex.Go Price Manager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
    }
  });

  mainWindow.loadURL('https://taxi.yandex.ru');
  isDev && mainWindow.webContents.openDevTools(); // Open the DevTools.


  // Function to load and execute JavaScript from a file
  function loadAndExecuteScript() {
    const cssPath = path.join(__dirname, '../dist', 'injection.styles.css');
    fs.readFile(cssPath, 'utf8', (err, css) => {
      if (err) {
        console.error('Failed to read bundle-CSS file', err);
      } else {
        mainWindow.webContents.insertCSS(css).then(() => {
          console.log('CSS inserted');
        });
      }
    });

    const scriptPath = path.join(__dirname, '../dist', 'injection.js');
    fs.readFile(scriptPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read injection-bundle file', err);
      } else {
        mainWindow.webContents.executeJavaScript(data).then(() => {
          console.log('Bundle loaded and executed.');
        });
      }
    });
  }

  const loadScriptOnNavigation = () => loadAndExecuteScript();
  // did-navigate срабатывает при загрузке страницы яндекса, а также при обновлении окна
  mainWindow.webContents.on('did-navigate', loadScriptOnNavigation);
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
