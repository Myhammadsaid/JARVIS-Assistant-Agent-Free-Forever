import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'
import si from 'systeminformation'
import { LLMManager } from './llm/llmManager'
import { ChatMessage } from './llm/llmProvider'
import { DatabaseManager, DBMessage } from './memory/database'


const llmManager = new LLMManager();
const activeStreams = new Map<string, AbortController>();

let mainWindow: BrowserWindow | null = null;
let metricsInterval: NodeJS.Timeout | null = null;

function startMetricsMonitor(win: BrowserWindow) {
  if (metricsInterval) clearInterval(metricsInterval);

  metricsInterval = setInterval(async () => {
    try {
      const [load, temp, mem] = await Promise.all([
        si.currentLoad(),
        si.cpuTemperature(),
        si.mem()
      ]);

      const metrics = {
        cpuUsage: Math.round(load.currentLoad),
        // Linux fallback to 45°C if hardware sensors require elevated permissions
        cpuTemp: temp.main ? Math.round(temp.main) : 45, 
        ramUsage: Math.round((mem.active / mem.total) * 100),
      };

      if (win && !win.isDestroyed()) {
        win.webContents.send('system-metrics-update', metrics);
      }
    } catch (error) {
      console.error('Failed to fetch hardware metrics:', error);
    }
  }, 2000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#050a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Was previously gated behind NODE_ENV === 'development', so hardware
  // telemetry silently stopped working in any packaged/production build.
  startMetricsMonitor(mainWindow);
}

app.whenReady().then(async () => {
  // Without this, Electron's default permission behavior for `media`
  // requests (mic access, which both getUserMedia and the Web Speech
  // API rely on) varies by platform/version and can deny or silently
  // hang the request — which surfaces in the UI as voice mode getting
  // stuck before it even starts listening.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();

  // Validate Ollama startup status
  const startupCheck = await llmManager.initialize();
  console.log(`[JARVIS LLM Init]: ${startupCheck.message}`);

  // IPC Handlers
  ipcMain.handle('llm:check-status', async () => {
    return await llmManager.initialize();
  });

  ipcMain.handle(
    'llm:generate-stream',
    async (event, requestId: string, messages: ChatMessage[]) => {
      const provider = llmManager.getProvider();
      const controller = new AbortController();
      activeStreams.set(requestId, controller);
      try {
        return await provider.streamChat(
          messages,
          (chunk: string) => {
            if (mainWindow) {
              mainWindow.webContents.send('llm:stream-chunk', requestId, chunk);
            }
          },
          { signal: controller.signal }
        );
      } catch (error: any) {
        console.error('[LLM Stream Error]:', error);
        throw error;
      } finally {
        activeStreams.delete(requestId);
      }
    }
  );

  ipcMain.handle('llm:abort-stream', (_event, requestId: string) => {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
      return true;
    }
    return false;
  });


const dbManager = new DatabaseManager();

// IPC Storage Handlers
ipcMain.handle('db:get-conversations', () => dbManager.getConversations());

ipcMain.handle('db:create-conversation', (_event, id: string, title?: string) => 
  dbManager.createConversation(id, title)
);

ipcMain.handle('db:get-messages', (_event, conversationId: string) => 
  dbManager.getMessages(conversationId)
);

ipcMain.handle('db:save-message', (_event, msg: DBMessage) => 
  dbManager.addMessage(msg)
);

ipcMain.handle('db:delete-conversation', (_event, id: string) => 
  dbManager.deleteConversation(id)
);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});