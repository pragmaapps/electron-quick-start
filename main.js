// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain,screen } = require('electron')
const path = require('node:path')

function createWindow () {
  // Create the browser window.
  // Get the primary display's size
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    kiosk: false, // Ensure kiosk mode is enabled for the main window
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
  //mainWindow.loadURL('http://192.168.0.100')
  //mainWindow.setFullScreen(true)
  mainWindow.maximize()
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()


  // Function to open a popup window for external URL
  const openPopup = (url, features) => {
    // Create a small loading window
    let { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const loadingWidth = width-10;
    const loadingHeight = height-10;
    console.log("loading width and height",loadingWidth, loadingHeight );
    const centerX = Math.floor((width - loadingWidth) / 2);
    const centerY = Math.floor((height - loadingHeight) / 2);
    const loadingWindow = new BrowserWindow({
      x: centerX,
      y: centerY,
      width: loadingWidth,
      height: loadingHeight,
      frame: true,
      kiosk: false,
      alwaysOnTop: false,
      type: 'normal',
      show:false, 
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        scrollBounce: false
      },
      // Add these Wayland-specific options
      backgroundColor: '#000000',
      useContentSize: true,
      titleBarStyle: 'default',
      autoHideMenuBar: false
    });

    // Load a simple HTML loading message
    loadingWindow.loadFile('loading.html');
    loadingWindow.once('ready-to-show', () => {
      loadingWindow.show();
      setTimeout(() => {
        loadingWindow.setBounds({ 
          x: centerX,
          y: centerY,
          width: loadingWidth,
          height: loadingHeight
        });
        loadingWindow.setAlwaysOnTop(false);
        loadingWindow.setKiosk(false);
      }, 100);
    });
    console.log('[IPC][open popup]: Received request to open URL:', url);
    console.log('[IPC][open popup]: Received request to open URL features:', features);
  
    // Parse features string
    const featureObject = {};
    if (features) {
      features.split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        featureObject[key.trim()] = parseInt(value.trim(), 10);
      });
    }
    const pLoadingWidth = width-10;
    const pLoadingHeight = height-10;
    console.log("ploading width and height",pLoadingWidth, pLoadingHeight );
    const pCenterX = Math.floor((width - pLoadingWidth) / 2);
    const pCenterY = Math.floor((height - pLoadingHeight) / 2);
    const popupWindow = new BrowserWindow({
      x: pCenterX,
      y: pCenterY,
      width: pLoadingWidth,
      height: pLoadingHeight,
      frame: true,
      kiosk: false,
      alwaysOnTop: false,
      type: 'normal',
      show:false, 
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        scrollBounce: false
      },
      // Add these Wayland-specific options
      backgroundColor: '#000000',
      useContentSize: true,
      titleBarStyle: 'default',
      autoHideMenuBar: false
    });
    popupWindow.loadURL(url);
    popupWindow.once('ready-to-show', () => {
      popupWindow.show();
      loadingWindow.close();
      // Set bounds one more time after showing
      setTimeout(() => {
        popupWindow.setBounds({ 
          x: pCenterX,
          y: pCenterY,
          width: pLoadingWidth,
          height: pLoadingHeight
        });
        popupWindow.setAlwaysOnTop(false);
        popupWindow.setKiosk(false);
      }, 100);
    });
  };

  // Listen for request from React to open URL in popup
  ipcMain.on('create-new-window', (event, { url, features }) => {
    openPopup(url, features);
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
