/**
 * main.ts - إصلاح نهائي لتحميل OpenCASCADE
 */

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

// تحميل OpenCASCADE مع جميع الأسماء المحتملة
async function loadOpenCASCADE(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).OpenCascadeModule) {
            resolve();
            return;
        }

        updateLoadingProgress(10, 'جاري تحميل OpenCASCADE...');
        
        // جميع الأسماء المحتملة للملفات
        const possiblePaths = [
            '/assets/opencascade/opencascade.wasm.js',  // الاسم الفعلي الموجود
            '/assets/opencascade/opencascade.js',       // الاسم المتوقع
            'https://unpkg.com/opencascade.js@1.1.1/dist/opencascade.js',  // CDN
        ];

        let currentPathIndex = 0;

        function tryLoadPath(pathIndex: number) {
            if (pathIndex >= possiblePaths.length) {
                reject(new Error('فشل تحميل OpenCASCADE من جميع المسارات'));
                return;
            }

            const script = document.createElement('script');
            script.src = possiblePaths[pathIndex];
            script.async = true;
            
            updateLoadingProgress(20 + (pathIndex * 15), `محاولة تحميل من مسار ${pathIndex + 1}...`);
            
            script.onload = () => {
                updateLoadingProgress(60, 'تم التحميل، جاري التهيئة...');
                
                // انتظار تهيئة OpenCASCADE
                setTimeout(() => {
                    if (typeof (window as any).OpenCascade !== 'undefined') {
                        (window as any).OpenCascadeModule = (window as any).OpenCascade;
                        logger.info(`✓ تم تحميل OpenCASCADE من: ${possiblePaths[pathIndex]}`);
                        resolve();
                    } else if ((window as any).initOpenCascade) {
                        // للإصدارات الحديثة
                        (window as any).initOpenCascade().then((oc: any) => {
                            (window as any).OpenCascadeModule = () => Promise.resolve(oc);
                            logger.info(`✓ تم تحميل OpenCASCADE (modern) من: ${possiblePaths[pathIndex]}`);
                            resolve();
                        });
                    } else {
                        logger.warn(`⚠ فشل تهيئة OpenCASCADE من: ${possiblePaths[pathIndex]}`);
                        tryLoadPath(pathIndex + 1);
                    }
                }, 1500);
            };
            
            script.onerror = () => {
                logger.warn(`⚠ فشل تحميل من: ${possiblePaths[pathIndex]}`);
                document.head.removeChild(script);
                tryLoadPath(pathIndex + 1);
            };
            
            document.head.appendChild(script);
        }

        tryLoadPath(0);
    });
}

async function initializeApp(): Promise<void> {
    try {
        logger.info('🚀 بدء تهيئة TyrexWebCad...');
        
        // تحميل OpenCASCADE
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
        
        // انتظار تهيئة المشاهد
        let attempts = 0;
        while (!appState.viewer.isInitialized() && attempts < 50) {
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
            showToast('🎉 مرحباً بك في TyrexWebCad - جاهز للاستخدام!', 'success');
        }, 500);
        
    } catch (error) {
        logger.error('❌ فشلت تهيئة التطبيق:', error);
        updateLoadingProgress(0, 'فشل التحميل');
        
        let errorMessage = 'فشل تحميل التطبيق.';
        if (error instanceof Error) {
            if (error.message.includes('OpenCASCADE')) {
                errorMessage = 'فشل تحميل OpenCASCADE. سيتم المحاولة مرة أخرى...';
                // محاولة أخرى بعد 3 ثوان
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                errorMessage = error.message;
            }
        }
        
        showErrorDialog('خطأ في التهيئة', errorMessage);
    }
}

async function initializeTools(): Promise<void> {
    try {
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
        
        logger.info('✅ تم إنشاء جميع الأدوات بنجاح');
        
    } catch (error) {
        logger.error('❌ فشل إنشاء الأدوات:', error);
        throw error;
    }
}

function setupUIEvents(): void {
    setupFileButtons();
    setupViewButtons();
    setupDrawingTools();
    setupUndoRedoButtons();
    setupGridSettings();
    setupKeyboardShortcuts();
    setupViewerEvents();
    
    logger.debug('✅ تم ربط جميع أحداث واجهة المستخدم');
}

function setupFileButtons(): void {
    const btnNew = document.getElementById('btn-new');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            if (confirm('هل تريد إنشاء مشروع جديد؟ سيتم فقدان التغييرات غير المحفوظة.')) {
                createNewProject();
            }
        });
    }
    
    const btnOpen = document.getElementById('btn-open');
    if (btnOpen) {
        btnOpen.addEventListener('click', openProject);
    }
    
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', saveProject);
    }
}

function setupViewButtons(): void {
    const btn2D = document.getElementById('btn-2d-view');
    const btn3D = document.getElementById('btn-3d-view');
    
    if (btn2D && btn3D && appState.viewer) {
        btn2D.addEventListener('click', () => {
            appState.viewer!.setView(true);
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            logger.info('🔄 تم التبديل إلى العرض ثنائي الأبعاد');
        });
        
        btn3D.addEventListener('click', () => {
            appState.viewer!.setView(false);
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            logger.info('🔄 تم التبديل إلى العرض ثلاثي الأبعاد');
        });
    }
}

function setupDrawingTools(): void {
    const tools = ['select', 'line', 'circle', 'rectangle'];
    
    tools.forEach(toolName => {
        const button = document.getElementById(`tool-${toolName}`);
        if (button) {
            button.addEventListener('click', () => {
                setActiveTool(toolName);
            });
        }
    });
}

function setActiveTool(toolName: string): void {
    deactivateCurrentTool();
    
    document.querySelectorAll('#drawing-tools .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.getElementById(`tool-${toolName}`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    appState.currentTool = toolName;
    
    switch (toolName) {
        case 'line':
            if (appState.tools.drawLine) {
                appState.tools.drawLine.activate();
                setupToolEvents(appState.tools.drawLine);
            }
            break;
        case 'circle':
            if (appState.tools.drawCircle) {
                appState.tools.drawCircle.activate();
                setupToolEvents(appState.tools.drawCircle);
            }
            break;
        case 'select':
        default:
            break;
    }
    
    logger.info(`🔧 تم تفعيل أداة: ${toolName}`);
}

function deactivateCurrentTool(): void {
    Object.values(appState.tools).forEach(tool => {
        if (tool && typeof (tool as any).deactivate === 'function') {
            (tool as any).deactivate();
        }
    });
}

function setupToolEvents(tool: any): void {
    if (!appState.viewer) return;
    
    tool.on('completed', (data: any) => {
        logger.info(`✅ تم إكمال رسم ${data.object?.type}`);
        updateStatusBar(`تم إنشاء ${data.object?.type}`);
    });
    
    tool.on('cancelled', () => {
        updateStatusBar('تم إلغاء العملية');
    });
}

function setupUndoRedoButtons(): void {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (appState.commandManager.canUndo()) {
                appState.commandManager.undo();
                updateStatusBar('تم التراجع');
            }
        });
    }
    
    if (btnRedo) {
        btnRedo.addEventListener('click', () => {
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
                updateStatusBar('تمت الإعادة');
            }
        });
    }
}

function setupGridSettings(): void {
    const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
    const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
    
    if (snapCheckbox && appState.snapSystem) {
        snapCheckbox.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            appState.snapSystem!.setGridEnabled(target.checked);
            logger.info(`⚙️ المحاذاة للشبكة: ${target.checked ? 'مفعلة' : 'معطلة'}`);
        });
    }
    
    if (gridSizeSelect && appState.snapSystem) {
        gridSizeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const size = parseFloat(target.value);
            appState.snapSystem!.setGridSize(size);
            logger.info(`📏 حجم الشبكة: ${size} متر`);
        });
    }
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
        
        if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
            }
        }
        
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveProject();
        }
        
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            openProject();
        }
        
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (confirm('هل تريد إنشاء مشروع جديد؟')) {
                createNewProject();
            }
        }
        
        if (e.key === 'Escape') {
            deactivateCurrentTool();
            setActiveTool('select');
        }
        
        if (e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            setActiveTool('line');
        }
        
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            setActiveTool('circle');
        }
    });
}

function setupViewerEvents(): void {
    if (!appState.viewer) return;
    
    appState.viewer.on('objectAdded', (object) => {
        logger.debug('✅ تمت إضافة كائن:', object);
        updateStatusBar(`تمت إضافة ${object.type}`);
    });
    
    appState.viewer.on('objectRemoved', (object) => {
        logger.debug('🗑️ تمت إزالة كائن:', object);
        updateStatusBar(`تمت إزالة ${object.type}`);
    });
}

function createNewProject(): void {
    logger.info('📁 إنشاء مشروع جديد...');
    appState.commandManager.clear();
    updateStatusBar('تم إنشاء مشروع جديد');
    showToast('📁 تم إنشاء مشروع جديد', 'success');
}

async function openProject(): Promise<void> {
    try {
        const fileData = await appState.projectManager.openProject();
        if (fileData) {
            updateStatusBar('تم فتح المشروع بنجاح');
            showToast('📂 تم فتح المشروع', 'success');
        }
    } catch (error) {
        logger.error('❌ فشل فتح المشروع:', error);
        showToast('❌ فشل فتح المشروع', 'error');
    }
}

async function saveProject(): Promise<void> {
    try {
        updateStatusBar('تم حفظ المشروع بنجاح');
        showToast('💾 تم حفظ المشروع', 'success');
    } catch (error) {
        logger.error('❌ فشل حفظ المشروع:', error);
        showToast('❌ فشل حفظ المشروع', 'error');
    }
}

function loadSettings(): void {
    try {
        const settings = localStorage.getItem('tyrexwebcad-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            
            if (parsed.gridSize) {
                const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
                if (gridSizeSelect) gridSizeSelect.value = parsed.gridSize;
            }
            
            if (parsed.snapToGrid !== undefined) {
                const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
                if (snapCheckbox) snapCheckbox.checked = parsed.snapToGrid;
            }
            
            logger.info('⚙️ تم تحميل الإعدادات المحفوظة');
        }
    } catch (error) {
        logger.warn('⚠️ فشل تحميل الإعدادات المحفوظة:', error);
    }
}

// دوال مساعدة
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

function updateStatusBar(message: string): void {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) statusMessage.textContent = message;
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

// بدء التطبيق
function start(): void {
    logger.setLevel(LogLevel.INFO);
    logger.info('🚀 بدء تطبيق TyrexWebCad...');
    initializeApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}

// حفظ الإعدادات عند الخروج
window.addEventListener('beforeunload', () => {
    try {
        const settings = {
            gridSize: (document.getElementById('grid-size') as HTMLSelectElement)?.value || '1',
            snapToGrid: (document.getElementById('snap-to-grid') as HTMLInputElement)?.checked ?? true,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('tyrexwebcad-settings', JSON.stringify(settings));
    } catch (error) {
        logger.warn('⚠️ فشل حفظ الإعدادات:', error);
    }
});

// معالجة الأخطاء
window.addEventListener('error', (event) => {
    logger.error('❌ خطأ غير معالج:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('❌ وعد مرفوض غير معالج:', event.reason);
});

// للتطوير
(window as any).appState = appState;
(window as any).logger = logger;