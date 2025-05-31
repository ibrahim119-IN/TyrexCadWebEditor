import './styles/main.css';
import { Viewer } from './core/Viewer';
import { GeometryEngine } from './core/GeometryEngine';
import { Logger, LogLevel } from './core/Logger';
import { CommandManager } from './core/CommandManager';
import { ProjectManager } from './core/ProjectManager';
import { DrawLineTool } from './drawing_tools/DrawLineTool';
import { DrawCircleTool, CircleDrawMode } from './drawing_tools/DrawCircleTool';
import { MoveTool } from './editing_tools/MoveTool';
import { SnapSystem } from './systems/SnapSystem';
import { MeasurementSystem } from './systems/MeasurementSystem';

interface AppState {
    viewer: Viewer | null;
    commandManager: CommandManager;
    projectManager: ProjectManager;
    currentTool: string;
    isInitialized: boolean;
    tools: {
        drawLine: DrawLineTool | null;
        drawCircle: DrawCircleTool | null;
        move: MoveTool | null;
    };
    snapSystem: SnapSystem | null;
}

const appState: AppState = {
    viewer: null,
    commandManager: new CommandManager(),
    projectManager: new ProjectManager(),
    currentTool: 'select',
    isInitialized: false,
    tools: {
        drawLine: null,
        drawCircle: null,
        move: null
    },
    snapSystem: null
};

const logger = Logger.getInstance();

// تحميل OpenCASCADE وهمي للاختبار
async function loadOpenCASCADE(): Promise<void> {
    return new Promise((resolve) => {
        if ((window as any).OpenCascadeModule) {
            resolve();
            return;
        }

        updateLoadingProgress(10, 'جاري إنشاء OpenCASCADE وهمي...');
        
        setTimeout(() => {
            const dummyOC = {
                gp_Pnt: function(x: number, y: number, z: number) {
                    return { X: () => x, Y: () => y, Z: () => z, delete: () => {} };
                },
                GC_MakeSegment_1: function() {
                    return { IsDone: () => true, Value: () => ({}) };
                },
                BRepBuilderAPI_MakeEdge_2: function() {
                    return { IsDone: () => true, Edge: () => ({}) };
                },
                GC_MakeCircle_3: function() {
                    return { IsDone: () => true, Value: () => ({}) };
                },
                BRepPrimAPI_MakeBox_2: function() {
                    return { IsDone: () => true, Shape: () => ({}) };
                },
                BRepAlgoAPI_Fuse_1: function() {
                    return { IsDone: () => true, Shape: () => ({}), Build: () => {} };
                },
                BRepAlgoAPI_Cut_1: function() {
                    return { IsDone: () => true, Shape: () => ({}), Build: () => {} };
                },
                BRepMesh_IncrementalMesh_2: function() {},
                Bnd_Box_1: function() {
                    return {
                        IsVoid: () => false,
                        CornerMin: () => ({ X: () => 0, Y: () => 0, Z: () => 0, delete: () => {} }),
                        CornerMax: () => ({ X: () => 1, Y: () => 1, Z: () => 1, delete: () => {} }),
                        delete: () => {}
                    };
                },
                BRepBndLib: { Add: () => {} },
                gp_Dir_4: function() { return {}; },
                gp_Ax2_3: function() { return {}; }
            };
            
            (window as any).OpenCascadeModule = function() {
                return Promise.resolve(dummyOC);
            };
            
            logger.info('✓ تم إنشاء OpenCASCADE وهمي');
            resolve();
        }, 1000);
    });
}

async function initializeApp(): Promise<void> {
    try {
        logger.info('🚀 بدء تهيئة TyrexWebCad...');
        
        await loadOpenCASCADE();
        updateLoadingProgress(70, 'جاري تهيئة المحرك الهندسي...');
        
        const geometryEngine = GeometryEngine.getInstance();
        await geometryEngine.initialize();
        
        updateLoadingProgress(80, 'جاري إنشاء المشاهد...');
        
        const viewerContainer = document.getElementById('viewer-container');
        if (!viewerContainer) {
            throw new Error('لم يتم العثور على حاوي المشاهد');
        }
        
        appState.viewer = new Viewer(viewerContainer);
        
        let attempts = 0;
        while (!appState.viewer.isInitialized() && attempts < 100) {
            await sleep(100);
            attempts++;
        }
        
        if (!appState.viewer.isInitialized()) {
            throw new Error('فشلت تهيئة المشاهد');
        }
        
        updateLoadingProgress(90, 'جاري إنشاء الأدوات...');
        await initializeTools();
        
        updateLoadingProgress(95, 'جاري ربط الأحداث...');
        setupUIEvents();
        loadSettings();
        
        updateLoadingProgress(100, 'اكتمل التحميل!');
        
        setTimeout(() => {
            hideLoadingScreen();
            appState.isInitialized = true;
            logger.info('✅ تم تهيئة TyrexWebCad بنجاح');
            showToast('🎉 TyrexWebCad جاهز!', 'success');
        }, 500);
        
    } catch (error) {
        logger.error('❌ فشلت تهيئة التطبيق:', error);
        showErrorDialog('خطأ في التهيئة', error instanceof Error ? error.message : 'خطأ غير معروف');
    }
}

async function initializeTools(): Promise<void> {
    const geometryEngine = GeometryEngine.getInstance();
    appState.snapSystem = new SnapSystem();
    
    const dummyCamera = {} as any;
    const measurementSystem = new MeasurementSystem(
        document.getElementById('viewer-container')!,
        dummyCamera
    );
    
    appState.tools.drawLine = new DrawLineTool(
        geometryEngine,
        appState.commandManager,
        appState.snapSystem,
        measurementSystem
    );
    
    appState.tools.drawCircle = new DrawCircleTool(
        geometryEngine,
        appState.commandManager,
        appState.snapSystem,
        measurementSystem,
        {},
        CircleDrawMode.CENTER_RADIUS
    );
    
    appState.tools.move = new MoveTool(appState.commandManager);
}

function setupUIEvents(): void {
    setupFileButtons();
    setupViewButtons();
    setupDrawingTools();
    setupUndoRedoButtons();
    setupGridSettings();
    setupKeyboardShortcuts();
}

function setupFileButtons(): void {
    const btnNew = document.getElementById('btn-new');
    const btnOpen = document.getElementById('btn-open');
    const btnSave = document.getElementById('btn-save');
    
    btnNew?.addEventListener('click', createNewProject);
    btnOpen?.addEventListener('click', openProject);
    btnSave?.addEventListener('click', saveProject);
}

function setupViewButtons(): void {
    const btn2D = document.getElementById('btn-2d-view');
    const btn3D = document.getElementById('btn-3d-view');
    
    btn2D?.addEventListener('click', () => {
        appState.viewer?.setView(true);
        btn2D.classList.add('active');
        btn3D?.classList.remove('active');
    });
    
    btn3D?.addEventListener('click', () => {
        appState.viewer?.setView(false);
        btn3D.classList.add('active');
        btn2D?.classList.remove('active');
    });
}

function setupDrawingTools(): void {
    ['select', 'line', 'circle', 'rectangle'].forEach(toolName => {
        const button = document.getElementById(`tool-${toolName}`);
        button?.addEventListener('click', () => setActiveTool(toolName));
    });
}

function setActiveTool(toolName: string): void {
    document.querySelectorAll('#drawing-tools .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`tool-${toolName}`)?.classList.add('active');
    appState.currentTool = toolName;
    
    switch (toolName) {
        case 'line':
            appState.tools.drawLine?.activate();
            break;
        case 'circle':
            appState.tools.drawCircle?.activate();
            break;
    }
}

function setupUndoRedoButtons(): void {
    document.getElementById('btn-undo')?.addEventListener('click', () => {
        if (appState.commandManager.canUndo()) {
            appState.commandManager.undo();
        }
    });
    
    document.getElementById('btn-redo')?.addEventListener('click', () => {
        if (appState.commandManager.canRedo()) {
            appState.commandManager.redo();
        }
    });
}

function setupGridSettings(): void {
    const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
    const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
    
    snapCheckbox?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        appState.snapSystem?.setGridEnabled(checked);
    });
    
    gridSizeSelect?.addEventListener('change', (e) => {
        const size = parseFloat((e.target as HTMLSelectElement).value);
        appState.snapSystem?.setGridSize(size);
    });
}

function setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (appState.commandManager.canUndo()) {
                appState.commandManager.undo();
            }
        }
        
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
            }
        }
        
        if (e.key === 'Escape') {
            setActiveTool('select');
        }
    });
}

function createNewProject(): void {
    appState.commandManager.clear();
    showToast('📁 مشروع جديد', 'success');
}

async function openProject(): Promise<void> {
    showToast('📂 فتح مشروع', 'info');
}

async function saveProject(): Promise<void> {
    showToast('💾 حفظ مشروع', 'success');
}

function loadSettings(): void {
    // تحميل الإعدادات من localStorage
}

function updateLoadingProgress(percent: number, text: string): void {
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingProgress) loadingProgress.style.width = `${percent}%`;
    if (loadingText) loadingText.textContent = text;
}

function hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app');
    
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
    
    if (appContainer) {
        appContainer.style.display = 'flex';
        setTimeout(() => {
            appContainer.style.opacity = '1';
        }, 50);
    }
}

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}

function showErrorDialog(title: string, message: string): void {
    alert(`${title}\n\n${message}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function start(): void {
    logger.setLevel(LogLevel.INFO);
    initializeApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}

(window as any).appState = appState;