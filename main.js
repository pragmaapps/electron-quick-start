// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    kiosk: true, // Ensure kiosk mode is enabled for the main window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Disable default keyboard shortcuts
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      webSecurity: true,
      // Add this line to disable default shortcuts
      additionalArguments: ['--disable-dev-shm-usage']
    }
  })
  
  // Handle new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url, features }) => {
    console.log('[Kiosk Mode]: Opening URL:', url); // Log the URL being opened

    // Parse the features string
    const featurePairs = features.split(',');
    const featureObject = {};
    featurePairs.forEach(pair => {
      const [key, value] = pair.split('=');
      featureObject[key.trim()] = parseInt(value.trim(), 10);
    });

    const { left, top, width, height } = featureObject; // Extract features
    console.log('[Kiosk Mode]: Parsed URL features:', featureObject); // Log the parsed features

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: width || 800, // Use provided width or default
        height: height || 600, // Use provided height or default
        x: left, // Set window position
        y: top, // Set window position
        frame: true, // Enable window frame for controls
        resizable: true, // Allow resizing
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      }
    };
  });

  // Prevent default shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // Disable F12 (DevTools)
      if (input.key === 'F12') {
        event.preventDefault();
      }
      // Disable Ctrl+Shift+I (DevTools)
      if (input.control && input.shift && input.key === 'I') {
        event.preventDefault();
      }
      // Disable Ctrl+N (New Window)
      if (input.control && input.key === 'N') {
        event.preventDefault();
      }
      // Disable Ctrl+T (New Tab)
      if (input.control && input.key === 'T') {
        event.preventDefault();
      }
      // Disable Ctrl+W (Close Tab)
      if (input.control && input.key === 'W') {
        event.preventDefault();
      }
      // Disable Ctrl+R (Reload)
      if (input.control && input.key === 'R') {
        event.preventDefault();
      }
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')
  //mainWindow.setFullScreen(true)
  mainWindow.maximize()
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()


  // Function to open a popup window for external URL
const openPopup = (url) => {
  console.log('[IPC][open popup]: Received request to open URL:', url);
  const popupWindow = new BrowserWindow({
    width: 400,
    height: 400,
    parent: mainWindow, // Remove `modal: true` so it acts independently
    resizable: true, // Allow resizing
    movable: true, // Allow moving
    show: false, // Hide until fully loaded
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  popupWindow.loadURL(url);
  popupWindow.once('ready-to-show', () => popupWindow.show());
};

// Listen for request from React to open URL in popup
ipcMain.on('create-new-window', (event, url) => {
  openPopup(url);
});

  // Listen for new window creation requests from the renderer process
  ipcMain.on('create-new-window-bk', (event, { url, features }) => {
    console.log('[IPC]: Received request to open URL:', url);

    // Parse the features string
    const featurePairs = features.split(',');
    const featureObject = {};
    featurePairs.forEach(pair => {
      const [key, value] = pair.split('=');
      featureObject[key.trim()] = parseInt(value.trim(), 10);
    });

    const { left, top, width, height } = featureObject;

    // Create a new window with the specified options
    const newWindow = new BrowserWindow({
      width: width || 800,
      height: height || 600,
      x: left,
      y: top,
      frame: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    newWindow.loadURL(url);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
