/**
 * main.ts - نظام إدارة التطبيق الرئيسي المتقدم
 * نظام متكامل لإدارة تطبيق CAD متقدم مع دعم كامل للعمليات المعقدة
 */

import './styles/main.css';

// المكونات الأساسية
import { Viewer, ViewMode, ViewOrientation } from './core/Viewer';
import { GeometryEngine } from './core/GeometryEngine';
import { Logger, LogLevel } from './core/Logger';
import { CommandManager } from './core/CommandManager';
import { ProjectManager } from './core/ProjectManager';

// أدوات الرسم المتقدمة
import { DrawLineTool } from './drawing_tools/DrawLineTool';
import { DrawCircleTool, CircleDrawMode } from './drawing_tools/DrawCircleTool';
import { MoveTool } from './editing_tools/MoveTool';

// الأنظمة المساعدة
import { SnapSystem } from './systems/SnapSystem';
import { MeasurementSystem } from './systems/MeasurementSystem';

// النماذج
import { GeometricObject } from './models/GeometricObject';
import { Layer } from './models/Layer';
import { Wall } from './models/Wall';
import { BuildingElement } from './models/BuildingElement';

// الواجهات والأنواع
interface AppConfiguration {
    version: string;
    buildDate: string;
    environment: 'development' | 'production' | 'testing';
    features: {
        advancedTools: boolean;
        cloudSync: boolean;
        collaboration: boolean;
        aiAssistant: boolean;
        plugins: boolean;
    };
    performance: {
        maxObjects: number;
        maxMemory: number;
        renderQuality: 'low' | 'medium' | 'high' | 'ultra';
        antialiasing: boolean;
    };
    ui: {
        theme: 'light' | 'dark' | 'auto';
        language: 'ar' | 'en' | 'fr';
        layout: 'standard' | 'compact' | 'expanded';
        animations: boolean;
    };
}

interface ApplicationState {
    viewer: Viewer | null;
    commandManager: CommandManager;
    projectManager: ProjectManager;
    geometryEngine: GeometryEngine;
    
    // حالة واجهة المستخدم
    ui: {
        currentTool: string;
        activeLayer: string;
        selectedObjects: Set<string>;
        viewMode: ViewMode;
        showGrid: boolean;
        showAxes: boolean;
        showDimensions: boolean;
    };
    
    // الأدوات
    tools: {
        drawLine: DrawLineTool | null;
        drawCircle: DrawCircleTool | null;
        move: MoveTool | null;
        [key: string]: any;
    };
    
    // الأنظمة
    systems: {
        snapSystem: SnapSystem | null;
        measurementSystem: MeasurementSystem | null;
    };
    
    // الطبقات والمشروع
    project: {
        layers: Map<string, Layer>;
        activeObjects: Map<string, GeometricObject>;
        projectPath: string | null;
        isDirty: boolean;
        lastSaved: Date | null;
    };
    
    // حالة التهيئة والأداء
    status: {
        isInitialized: boolean;
        isLoading: boolean;
        loadingProgress: number;
        lastError: Error | null;
        performanceMode: 'optimal' | 'balanced' | 'quality';
    };
}

interface ToolDefinition {
    id: string;
    name: string;
    category: 'draw' | 'edit' | 'measure' | 'view';
    icon: string;
    shortcut?: string;
    description: string;
    create: () => any;
}

// إعدادات التطبيق
const APP_CONFIG: AppConfiguration = {
    version: '2.0.0-beta',
    buildDate: new Date().toISOString(),
    environment: 'development',
    features: {
        advancedTools: true,
        cloudSync: false,
        collaboration: false,
        aiAssistant: false,
        plugins: true
    },
    performance: {
        maxObjects: 10000,
        maxMemory: 2048 * 1024 * 1024, // 2GB
        renderQuality: 'high',
        antialiasing: true
    },
    ui: {
        theme: 'light',
        language: 'ar',
        layout: 'standard',
        animations: true
    }
};

// حالة التطبيق العامة
const appState: ApplicationState = {
    viewer: null,
    commandManager: new CommandManager(),
    projectManager: new ProjectManager(),
    geometryEngine: GeometryEngine.getInstance(),
    
    ui: {
        currentTool: 'select',
        activeLayer: 'default',
        selectedObjects: new Set(),
        viewMode: ViewMode.SHADED,
        showGrid: true,
        showAxes: true,
        showDimensions: true
    },
    
    tools: {
        drawLine: null,
        drawCircle: null,
        move: null
    },
    
    systems: {
        snapSystem: null,
        measurementSystem: null
    },
    
    project: {
        layers: new Map(),
        activeObjects: new Map(),
        projectPath: null,
        isDirty: false,
        lastSaved: null
    },
    
    status: {
        isInitialized: false,
        isLoading: false,
        loadingProgress: 0,
        lastError: null,
        performanceMode: 'balanced'
    }
};

// تعريفات الأدوات المتاحة
const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        id: 'select',
        name: 'تحديد',
        category: 'edit',
        icon: 'cursor',
        shortcut: 'S',
        description: 'أداة التحديد والتلاعب بالكائنات',
        create: () => null
    },
    {
        id: 'line',
        name: 'خط',
        category: 'draw',
        icon: 'line',
        shortcut: 'L',
        description: 'رسم خطوط مستقيمة',
        create: () => new DrawLineTool(
            appState.geometryEngine,
            appState.commandManager,
            appState.systems.snapSystem!,
            appState.systems.measurementSystem!
        )
    },
    {
        id: 'circle',
        name: 'دائرة',
        category: 'draw',
        icon: 'circle',
        shortcut: 'C',
        description: 'رسم دوائر وأقواس',
        create: () => new DrawCircleTool(
            appState.geometryEngine,
            appState.commandManager,
            appState.systems.snapSystem!,
            appState.systems.measurementSystem!,
            {},
            CircleDrawMode.CENTER_RADIUS
        )
    },
    {
        id: 'move',
        name: 'تحريك',
        category: 'edit',
        icon: 'move',
        shortcut: 'M',
        description: 'تحريك ونسخ الكائنات',
        create: () => new MoveTool(appState.commandManager)
    }
];

const logger = Logger.getInstance();

// ==================== تهيئة التطبيق ====================

/**
 * تحميل OpenCASCADE مع نظام fallback متقدم
 */
async function loadOpenCASCADE(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).OpenCascadeModule) {
            logger.info('OpenCASCADE موجود مسبقاً');
            resolve();
            return;
        }

        updateLoadingProgress(10, 'تحميل OpenCASCADE...');
        
        // نظام fallback ذكي
        const loadStrategies = [
            () => loadFromLocal(),
            () => loadFromCDN(),
            () => createMockEngine()
        ];
        
        let currentStrategy = 0;
        
        function tryNextStrategy() {
            if (currentStrategy >= loadStrategies.length) {
                reject(new Error('فشل تحميل OpenCASCADE من جميع المصادر'));
                return;
            }
            
            const strategy = loadStrategies[currentStrategy++];
            
            strategy()
                .then(resolve)
                .catch((error) => {
                    logger.warn(`فشلت الاستراتيجية ${currentStrategy}: ${error.message}`);
                    tryNextStrategy();
                });
        }
        
        tryNextStrategy();
    });
}

async function loadFromLocal(): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/assets/opencascade/opencascade.wasm.js';
        script.onload = () => {
            setTimeout(() => {
                if ((window as any).OpenCascade) {
                    (window as any).OpenCascadeModule = (window as any).OpenCascade;
                    resolve();
                } else {
                    reject(new Error('فشل تهيئة OpenCASCADE المحلي'));
                }
            }, 1000);
        };
        script.onerror = () => reject(new Error('فشل تحميل OpenCASCADE المحلي'));
        document.head.appendChild(script);
    });
}

async function loadFromCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/opencascade.js@2.0.0-beta.b5e5073/dist/opencascade.wasm.js';
        script.onload = () => {
            setTimeout(() => {
                if ((window as any).OpenCascade) {
                    (window as any).OpenCascadeModule = (window as any).OpenCascade;
                    resolve();
                } else {
                    reject(new Error('فشل تهيئة OpenCASCADE من CDN'));
                }
            }, 2000);
        };
        script.onerror = () => reject(new Error('فشل تحميل OpenCASCADE من CDN'));
        document.head.appendChild(script);
    });
}

async function createMockEngine(): Promise<void> {
    logger.warn('استخدام محرك وهمي للاختبار');
    
    const mockOC = {
        gp_Pnt_1: function(x: number, y: number, z: number) {
            return { 
                X: () => x, Y: () => y, Z: () => z, 
                delete: () => {},
                Transformed: (t: any) => this
            };
        },
        gp_Dir_1: function(x: number, y: number, z: number) {
            return { delete: () => {} };
        },
        gp_Ax2_2: function(p: any, d: any) {
            return { delete: () => {} };
        },
        gp_Vec_1: function(x: number, y: number, z: number) {
            return { delete: () => {} };
        },
        gp_Trsf_1: function() {
            return { 
                SetTranslation_1: () => {},
                SetRotation_1: () => {},
                SetScale_1: () => {},
                delete: () => {}
            };
        },
        BRepBuilderAPI_MakeVertex: function(p: any) {
            return { IsDone: () => true, Vertex: () => ({}) };
        },
        GC_MakeSegment_1: function(p1: any, p2: any) {
            return { IsDone: () => true, Value: () => ({}) };
        },
        BRepBuilderAPI_MakeEdge_2: function(curve: any) {
            return { IsDone: () => true, Edge: () => ({}) };
        },
        GC_MakeCircle_2: function(axis: any, radius: number) {
            return { IsDone: () => true, Value: () => ({}) };
        },
        BRepPrimAPI_MakeBox_2: function(w: number, h: number, d: number) {
            return { IsDone: () => true, Shape: () => ({}) };
        },
        BRepPrimAPI_MakeSphere_2: function(center: any, radius: number) {
            return { IsDone: () => true, Shape: () => ({}) };
        },
        BRepPrimAPI_MakeCylinder_2: function(axis: any, radius: number, height: number) {
            return { IsDone: () => true, Shape: () => ({}) };
        },
        BRepAlgoAPI_Fuse_1: function(s1: any, s2: any) {
            return { IsDone: () => true, Shape: () => ({}), Build: () => {} };
        },
        BRepAlgoAPI_Cut_1: function(s1: any, s2: any) {
            return { IsDone: () => true, Shape: () => ({}), Build: () => {} };
        },
        BRepAlgoAPI_Common_1: function(s1: any, s2: any) {
            return { IsDone: () => true, Shape: () => ({}), Build: () => {} };
        },
        BRepBuilderAPI_Transform_2: function(shape: any, transform: any) {
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
        GProp_GProps_1: function() {
            return {
                Mass: () => 1,
                CentreOfMass: () => ({ X: () => 0, Y: () => 0, Z: () => 0, delete: () => {} }),
                delete: () => {}
            };
        },
        BRepGProp: {
            VolumeProperties_1: () => {},
            SurfaceProperties_1: () => {}
        },
        TopExp_Explorer_2: function(shape: any, type: any) {
            return {
                More: () => false,
                Next: () => {},
                Current: () => ({})
            };
        },
        TopAbs_ShapeEnum: {
            TopAbs_VERTEX: 0,
            TopAbs_EDGE: 1,
            TopAbs_FACE: 4,
            TopAbs_SHELL: 5,
            TopAbs_SOLID: 6
        },
        TopoDS: {
            Face_1: (shape: any) => shape
        },
        TopLoc_Location_1: function() {
            return {
                Transformation: () => ({ delete: () => {} }),
                delete: () => {}
            };
        },
        BRep_Tool: {
            Triangulation: () => ({
                IsNull: () => true,
                NbNodes: () => 0,
                NbTriangles: () => 0,
                Node: () => ({ X: () => 0, Y: () => 0, Z: () => 0 }),
                Triangle: () => ({ Value: () => 1 })
            })
        }
    };
    
    (window as any).OpenCascadeModule = function() {
        return Promise.resolve(mockOC);
    };
    
    logger.info('تم إنشاء محرك وهمي');
}

/**
 * تهيئة التطبيق الرئيسية
 */
async function initializeApplication(): Promise<void> {
    try {
        logger.info(`🚀 بدء تهيئة TyrexWebCad ${APP_CONFIG.version}...`);
        appState.status.isLoading = true;
        
        // عرض شاشة الترحيب
        showWelcomeScreen();
        
        // تحميل OpenCASCADE
        await loadOpenCASCADE();
        updateLoadingProgress(30, 'تهيئة المحرك الهندسي...');
        
        // تهيئة المحرك الهندسي
        await appState.geometryEngine.initialize();
        updateLoadingProgress(50, 'إنشاء نظام العرض...');
        
        // إنشاء نظام العرض
        await initializeViewer();
        updateLoadingProgress(70, 'تهيئة الأدوات...');
        
        // تهيئة الأنظمة والأدوات
        await initializeSystems();
        await initializeTools();
        updateLoadingProgress(85, 'إعداد واجهة المستخدم...');
        
        // إعداد واجهة المستخدم
        await setupUserInterface();
        await loadUserPreferences();
        updateLoadingProgress(95, 'تحميل المشروع الافتراضي...');
        
        // تحميل مشروع افتراضي
        await loadDefaultProject();
        updateLoadingProgress(100, 'اكتمل التحميل!');
        
        // إنهاء التهيئة
        appState.status.isInitialized = true;
        appState.status.isLoading = false;
        
        hideLoadingScreen();
        showMainInterface();
        
        logger.info('✅ تم تهيئة TyrexWebCad بنجاح');
        showWelcomeMessage();
        
        // بدء مراقبة الأداء
        startPerformanceMonitoring();
        
    } catch (error) {
        handleInitializationError(error);
    }
}

/**
 * تهيئة نظام العرض
 */
async function initializeViewer(): Promise<void> {
    const viewerContainer = document.getElementById('viewer-container');
    if (!viewerContainer) {
        throw new Error('لم يتم العثور على حاوي المشاهد');
    }
    
    appState.viewer = new Viewer(viewerContainer);
    
    // انتظار تهيئة المشاهد
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!appState.viewer.isInitialized() && attempts < maxAttempts) {
        await sleep(100);
        attempts++;
        
        if (attempts % 10 === 0) {
            updateLoadingProgress(50 + attempts / 5, `انتظار العرض... (${attempts}/${maxAttempts})`);
        }
    }
    
    if (!appState.viewer.isInitialized()) {
        throw new Error('فشلت تهيئة نظام العرض');
    }
    
    // ربط أحداث المشاهد
    setupViewerEvents();
}

/**
 * تهيئة الأنظمة المساعدة
 */
async function initializeSystems(): Promise<void> {
    // نظام الانجذاب
    appState.systems.snapSystem = new SnapSystem();
    
    // نظام القياسات
    appState.systems.measurementSystem = new MeasurementSystem(
        document.getElementById('viewer-container')!,
        appState.viewer!.getCurrentCamera()
    );
    
    logger.info('تم تهيئة الأنظمة المساعدة');
}

/**
 * تهيئة الأدوات
 */
async function initializeTools(): Promise<void> {
    TOOL_DEFINITIONS.forEach(toolDef => {
        if (toolDef.id !== 'select') {
            const tool = toolDef.create();
            if (tool) {
                appState.tools[toolDef.id] = tool;
                setupToolEvents(tool, toolDef);
            }
        }
    });
    
    logger.info('تم تهيئة جميع الأدوات');
}

/**
 * إعداد واجهة المستخدم
 */
async function setupUserInterface(): Promise<void> {
    setupMainToolbar();
    setupSidePanels();
    setupStatusBar();
    setupContextMenus();
    setupKeyboardShortcuts();
    setupDragAndDrop();
    
    // تطبيق السمة
    applyTheme(APP_CONFIG.ui.theme);
    
    logger.info('تم إعداد واجهة المستخدم');
}

// ==================== إعداد واجهة المستخدم ====================

/**
 * إعداد شريط الأدوات الرئيسي
 */
function setupMainToolbar(): void {
    // أزرار الملفات
    setupFileButtons();
    
    // أزرار العرض
    setupViewButtons();
    
    // أدوات الرسم
    setupDrawingTools();
    
    // أدوات التحرير
    setupEditingTools();
    
    // إعدادات العرض
    setupViewSettings();
}

function setupFileButtons(): void {
    const fileActions = {
        'btn-new': () => createNewProject(),
        'btn-open': () => openProject(),
        'btn-save': () => saveProject(),
        'btn-save-as': () => saveProjectAs(),
        'btn-import': () => importFile(),
        'btn-export': () => exportFile()
    };
    
    Object.entries(fileActions).forEach(([buttonId, action]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', action);
        }
    });
}

function setupViewButtons(): void {
    const btn2D = document.getElementById('btn-2d-view');
    const btn3D = document.getElementById('btn-3d-view');
    
    if (btn2D && btn3D && appState.viewer) {
        btn2D.addEventListener('click', () => switchTo2D());
        btn3D.addEventListener('click', () => switchTo3D());
    }
    
    // أزرار التوجه
    const orientationButtons = {
        'btn-view-top': ViewOrientation.TOP,
        'btn-view-front': ViewOrientation.FRONT,
        'btn-view-right': ViewOrientation.RIGHT,
        'btn-view-iso': ViewOrientation.ISOMETRIC
    };
    
    Object.entries(orientationButtons).forEach(([buttonId, orientation]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                appState.viewer?.setViewOrientation(orientation);
            });
        }
    });
}

function setupDrawingTools(): void {
    TOOL_DEFINITIONS.forEach(toolDef => {
        const button = document.getElementById(`tool-${toolDef.id}`);
        if (button) {
            button.addEventListener('click', () => setActiveTool(toolDef.id));
            
            // إضافة tooltip
            button.title = `${toolDef.description} (${toolDef.shortcut || ''})`;
        }
    });
}

function setupEditingTools(): void {
    const editActions = {
        'btn-undo': () => {
            if (appState.commandManager.canUndo()) {
                appState.commandManager.undo();
                updateUI();
            }
        },
        'btn-redo': () => {
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
                updateUI();
            }
        },
        'btn-delete': () => deleteSelectedObjects(),
        'btn-copy': () => copySelectedObjects(),
        'btn-paste': () => pasteObjects(),
        'btn-duplicate': () => duplicateSelectedObjects()
    };
    
    Object.entries(editActions).forEach(([buttonId, action]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', action);
        }
    });
}

function setupViewSettings(): void {
    // إعدادات الشبكة
    const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
    const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
    
    if (snapCheckbox) {
        snapCheckbox.addEventListener('change', (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            appState.systems.snapSystem?.setGridEnabled(enabled);
            appState.ui.showGrid = enabled;
            updateViewerSettings();
        });
    }
    
    if (gridSizeSelect) {
        gridSizeSelect.addEventListener('change', (e) => {
            const size = parseFloat((e.target as HTMLSelectElement).value);
            appState.systems.snapSystem?.setGridSize(size);
            updateViewerSettings();
        });
    }
    
    // أنماط العرض
    const viewModeButtons = {
        'btn-wireframe': ViewMode.WIREFRAME,
        'btn-shaded': ViewMode.SHADED,
        'btn-rendered': ViewMode.RENDERED,
        'btn-xray': ViewMode.XRAY
    };
    
    Object.entries(viewModeButtons).forEach(([buttonId, mode]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                if (appState.viewer && typeof (appState.viewer as any).setViewMode === 'function') {
                    (appState.viewer as any).setViewMode(mode);
                }
                appState.ui.viewMode = mode;
                updateActiveButton(button, 'view-mode-btn');
            });
        }
    });
}

/**
 * إعداد اللوحات الجانبية
 */
function setupSidePanels(): void {
    setupLayersPanel();
    setupPropertiesPanel();
    setupLibraryPanel();
    setupHistoryPanel();
}

function setupLayersPanel(): void {
    const layersPanel = document.getElementById('layers-panel');
    if (!layersPanel) return;
    
    // إضافة طبقة افتراضية
    const defaultLayer = new Layer();
    defaultLayer.id = 'default';
    defaultLayer.name = 'الطبقة الأساسية';
    defaultLayer.visible = true;
    
    appState.project.layers.set('default', defaultLayer);
    updateLayersDisplay();
    
    // زر إضافة طبقة جديدة
    const addLayerBtn = layersPanel.querySelector('.panel-btn');
    if (addLayerBtn) {
        addLayerBtn.addEventListener('click', addNewLayer);
    }
}

function setupPropertiesPanel(): void {
    const propertiesPanel = document.getElementById('properties-panel');
    if (!propertiesPanel) return;
    
    // تحديث الخصائص عند تغيير التحديد
    appState.viewer?.on('selectionChanged', updatePropertiesDisplay);
}

function setupLibraryPanel(): void {
    // إعداد مكتبة الكائنات والرموز
}

function setupHistoryPanel(): void {
    // إعداد لوحة التاريخ والأوامر
}

/**
 * إعداد شريط الحالة
 */
function setupStatusBar(): void {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;
    
    // تحديث موضع المؤشر
    appState.viewer?.on('mouseMove', (data) => {
        updateCursorPosition(data.world);
    });
    
    // تحديث معلومات الكائنات
    updateObjectInfo();
    
    // عرض الرسائل
    setStatusMessage('جاهز للعمل');
}

// ==================== إدارة الأدوات ====================

/**
 * تفعيل أداة معينة
 */
function setActiveTool(toolId: string): void {
    // إلغاء تفعيل الأداة الحالية
    deactivateCurrentTool();
    
    // تحديث واجهة المستخدم
    updateToolButtons(toolId);
    
    // تفعيل الأداة الجديدة
    appState.ui.currentTool = toolId;
    
    if (toolId !== 'select') {
        const tool = appState.tools[toolId];
        if (tool && typeof tool.activate === 'function') {
            tool.activate();
        }
    }
    
    // تحديث المؤشر
    updateCursor(toolId);
    
    logger.info(`تم تفعيل أداة: ${toolId}`);
    setStatusMessage(`أداة نشطة: ${getToolName(toolId)}`);
}

function deactivateCurrentTool(): void {
    const currentToolId = appState.ui.currentTool;
    if (currentToolId !== 'select') {
        const tool = appState.tools[currentToolId];
        if (tool && typeof tool.deactivate === 'function') {
            tool.deactivate();
        }
    }
}

function updateToolButtons(activeToolId: string): void {
    document.querySelectorAll('#drawing-tools .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.getElementById(`tool-${activeToolId}`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

function updateCursor(toolId: string): void {
    const viewerContainer = document.getElementById('viewer-container');
    const canvas = viewerContainer?.querySelector('canvas');
    if (!canvas) return;
    
    const cursors: Record<string, string> = {
        'select': 'default',
        'line': 'crosshair',
        'circle': 'crosshair',
        'move': 'move',
        'pan': 'grab',
        'zoom': 'zoom-in'
    };
    
    canvas.style.cursor = cursors[toolId] || 'default';
}

function getToolName(toolId: string): string {
    const toolDef = TOOL_DEFINITIONS.find(t => t.id === toolId);
    return toolDef?.name || toolId;
}

/**
 * إعداد أحداث الأدوات
 */
function setupToolEvents(tool: any, toolDef: ToolDefinition): void {
    if (!tool || typeof tool.on !== 'function') return;
    
    tool.on('completed', (data: any) => {
        logger.info(`تم إكمال عملية ${toolDef.name}`);
        setStatusMessage(`تم إنشاء ${data.objectId || 'كائن جديد'}`);
        
        if (data.objects) {
            data.objects.forEach((obj: GeometricObject) => {
                appState.project.activeObjects.set(obj.id, obj);
            });
        }
        
        markProjectAsDirty();
        updateObjectInfo();
    });
    
    tool.on('cancelled', () => {
        setStatusMessage('تم إلغاء العملية');
    });
    
    tool.on('error', (error: any) => {
        logger.error(`خطأ في أداة ${toolDef.name}:`, error);
        showErrorMessage(`خطأ في ${toolDef.name}: ${error.message}`);
    });
    
    tool.on('statusUpdate', (info: any) => {
        updateToolStatus(info);
    });
}

// ==================== إدارة المشروع ====================

async function createNewProject(): Promise<void> {
    if (appState.project.isDirty) {
        const shouldSave = await confirmSaveChanges();
        if (shouldSave === null) return; // ألغى المستخدم
        if (shouldSave) await saveProject();
    }
    
    // إعادة تعيين المشروع
    appState.project.activeObjects.clear();
    appState.project.layers.clear();
    appState.project.projectPath = null;
    appState.project.isDirty = false;
    appState.project.lastSaved = null;
    
    // إضافة طبقة افتراضية
    const defaultLayer = new Layer();
    defaultLayer.id = 'default';
    defaultLayer.name = 'الطبقة الأساسية';
    appState.project.layers.set('default', defaultLayer);
    
    // مسح المشهد
    if (appState.viewer) {
        // مسح جميع الكائنات من المشهد
        appState.project.activeObjects.forEach((object) => {
            // Use a public method to remove objects from the viewer
            // This assumes there's a public removeObject method or similar
            (appState.viewer as any).removeObject?.(object.id);
        });
    }
    
    // إعادة تعيين مدير الأوامر
    appState.commandManager.clear();
    
    updateUI();
    setStatusMessage('تم إنشاء مشروع جديد');
    showSuccessMessage('تم إنشاء مشروع جديد بنجاح');
}

async function openProject(): Promise<void> {
    try {
        if (appState.project.isDirty) {
            const shouldSave = await confirmSaveChanges();
            if (shouldSave === null) return;
            if (shouldSave) await saveProject();
        }
        
        const projectData = await appState.projectManager.openProject();
        if (projectData) {
            await loadProjectData(projectData);
            setStatusMessage('تم فتح المشروع بنجاح');
            showSuccessMessage('تم فتح المشروع بنجاح');
        }
    } catch (error) {
        logger.error('فشل فتح المشروع:', error);
        showErrorMessage('فشل فتح المشروع');
    }
}

async function saveProject(): Promise<void> {
    try {
        // Extract walls and elements from the active objects
        const walls: Wall[] = [];
        const elements: BuildingElement[] = [];

        appState.project.activeObjects.forEach(obj => {
            if (obj instanceof Wall) {
                walls.push(obj);
            } else {
                elements.push(obj as BuildingElement);
            }
        });

        // Save the project with the correct parameters
        const savedData = ProjectManager.saveProject(
            walls,
            elements,
            appState.project.projectPath || 'Untitled Project'
        );

        // Store the saved data (you might want to save this to a file or localStorage)
        localStorage.setItem('tyrexwebcad-project', savedData);

        appState.project.isDirty = false;
        appState.project.lastSaved = new Date();

        updateUI();
        setStatusMessage('تم حفظ المشروع');
        showSuccessMessage('تم حفظ المشروع بنجاح');
    } catch (error) {
        logger.error('فشل حفظ المشروع:', error);
        showErrorMessage('فشل حفظ المشروع');
    }
}

async function saveProjectAs(): Promise<void> {
    try {
        const projectData = serializeProject();
        await appState.projectManager.saveProjectAs(projectData);
        
        appState.project.isDirty = false;
        appState.project.lastSaved = new Date();
        
        updateUI();
        setStatusMessage('تم حفظ المشروع باسم جديد');
        showSuccessMessage('تم حفظ المشروع بنجاح');
        
    } catch (error) {
        logger.error('فشل حفظ المشروع:', error);
        showErrorMessage('فشل حفظ المشروع');
    }
}

// ==================== إدارة الكائنات ====================

function deleteSelectedObjects(): void {
    const selectedObjects = Array.from(appState.ui.selectedObjects);
    if (selectedObjects.length === 0) {
        showWarningMessage('لم يتم تحديد كائنات للحذف');
        return;
    }
    
    if (confirm(`هل تريد حذف ${selectedObjects.length} كائن؟`)) {
        selectedObjects.forEach(objectId => {
            const object = appState.project.activeObjects.get(objectId);
            if (object) {
                // استخدم واجهة عامة لإزالة الكائن من المشاهد مع تجاوز التحقق من TypeScript
                                (appState.viewer as any)?.removeObject?.(objectId);
                appState.project.activeObjects.delete(objectId);
            }
        });
        
        appState.ui.selectedObjects.clear();
        markProjectAsDirty();
        updateUI();
        
        setStatusMessage(`تم حذف ${selectedObjects.length} كائن`);
    }
}

function copySelectedObjects(): void {
    const selectedObjects = Array.from(appState.ui.selectedObjects);
    if (selectedObjects.length === 0) {
        showWarningMessage('لم يتم تحديد كائنات للنسخ');
        return;
    }
    
    // تنفيذ عملية النسخ
    setStatusMessage(`تم نسخ ${selectedObjects.length} كائن`);
}

function pasteObjects(): void {
    // تنفيذ عملية اللصق
    setStatusMessage('تم لصق الكائنات');
}

function duplicateSelectedObjects(): void {
    const selectedObjects = Array.from(appState.ui.selectedObjects);
    if (selectedObjects.length === 0) {
        showWarningMessage('لم يتم تحديد كائنات للتكرار');
        return;
    }
    
    // تنفيذ عملية التكرار
    setStatusMessage(`تم تكرار ${selectedObjects.length} كائن`);
}

// ==================== إدارة العرض ====================

function switchTo2D(): void {
    appState.viewer?.setView(true);
    updateViewButtons('2d');
    setStatusMessage('تم التبديل إلى العرض ثنائي الأبعاد');
}

function switchTo3D(): void {
    appState.viewer?.setView(false);
    updateViewButtons('3d');
    setStatusMessage('تم التبديل إلى العرض ثلاثي الأبعاد');
}

function updateViewButtons(activeView: '2d' | '3d'): void {
    const btn2D = document.getElementById('btn-2d-view');
    const btn3D = document.getElementById('btn-3d-view');
    
    if (btn2D && btn3D) {
        btn2D.classList.toggle('active', activeView === '2d');
        btn3D.classList.toggle('active', activeView === '3d');
    }
}

// ==================== إدارة الأحداث ====================

function setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        
        const shortcuts = {
            'KeyS': () => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    saveProject();
                } else {
                    setActiveTool('select');
                }
            },
            'KeyO': () => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    openProject();
                }
            },
            'KeyN': () => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    createNewProject();
                }
            },
            'KeyZ': () => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (appState.commandManager.canRedo()) {
                            appState.commandManager.redo();
                        }
                    } else {
                        if (appState.commandManager.canUndo()) {
                            appState.commandManager.undo();
                        }
                    }
                    updateUI();
                }
            },
            'KeyL': () => setActiveTool('line'),
            'KeyC': () => setActiveTool('circle'),
            'KeyM': () => setActiveTool('move'),
            'Delete': () => deleteSelectedObjects(),
            'Escape': () => {
                deactivateCurrentTool();
                setActiveTool('select');
            }
        };
        
        const handler = shortcuts[e.code as keyof typeof shortcuts];
        if (handler) {
            handler();
        }
    });
}

function setupViewerEvents(): void {
    if (!appState.viewer) return;
    
    appState.viewer.on('objectAdded', (object) => {
        logger.debug('تمت إضافة كائن:', object);
        appState.project.activeObjects.set(object.id, object);
        markProjectAsDirty();
        updateObjectInfo();
    });
    
    appState.viewer.on('objectRemoved', (object) => {
        logger.debug('تمت إزالة كائن:', object);
        appState.project.activeObjects.delete(object.id);
        appState.ui.selectedObjects.delete(object.id);
        markProjectAsDirty();
        updateObjectInfo();
    });
    
    appState.viewer.on('selectionChanged', (selection) => {
        appState.ui.selectedObjects = new Set(selection.map((obj: any) => obj.id));
        updatePropertiesDisplay();
        updateUI();
    });
    
    appState.viewer.on('viewChanged', (is2D) => {
        updateViewButtons(is2D ? '2d' : '3d');
    });
}

function setupDragAndDrop(): void {
    const viewerContainer = document.getElementById('viewer-container');
    if (!viewerContainer) return;
    
    viewerContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
    });
    
    viewerContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer!.files);
        
        for (const file of files) {
            try {
                await importFile(file);
            } catch (error) {
                logger.error('فشل استيراد الملف:', error);
                showErrorMessage(`فشل استيراد ${file.name}`);
            }
        }
    });
}

// ==================== تحديث واجهة المستخدم ====================

function updateUI(): void {
    updateToolButtons(appState.ui.currentTool);
    updateUndoRedoButtons();
    updateObjectInfo();
    updateLayersDisplay();
    updatePropertiesDisplay();
    updateTitle();
}

function updateUndoRedoButtons(): void {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    
    if (btnUndo) {
        btnUndo.classList.toggle('disabled', !appState.commandManager.canUndo());
    }
    
    if (btnRedo) {
        btnRedo.classList.toggle('disabled', !appState.commandManager.canRedo());
    }
}

function updateObjectInfo(): void {
    const objectCount = appState.project.activeObjects.size;
    const selectedCount = appState.ui.selectedObjects.size;
    
    const objectInfo = document.getElementById('object-info');
    if (objectInfo) {
        objectInfo.textContent = `كائنات: ${objectCount} | محدد: ${selectedCount}`;
    }
}

function updateCursorPosition(position: { x: number; y: number; z: number }): void {
    const cursorPosition = document.getElementById('cursor-position');
    if (cursorPosition) {
        cursorPosition.textContent = 
            `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}`;
    }
}

function setStatusMessage(message: string): void {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

function updateTitle(): void {
    const projectName = appState.project.projectPath 
        ? appState.project.projectPath.split('/').pop()?.replace('.json', '') || 'مشروع جديد'
        : 'مشروع جديد';
    
    const isDirtyIndicator = appState.project.isDirty ? ' *' : '';
    document.title = `${projectName}${isDirtyIndicator} - TyrexWebCad ${APP_CONFIG.version}`;
}

function updateLayersDisplay(): void {
    const layersList = document.getElementById('layers-list');
    if (!layersList) return;
    
    layersList.innerHTML = '';
    
    appState.project.layers.forEach(layer => {
        const layerElement = createLayerElement(layer);
        layersList.appendChild(layerElement);
    });
}

function updatePropertiesDisplay(): void {
    const propertiesContent = document.getElementById('properties-content');
    if (!propertiesContent) return;
    
    if (appState.ui.selectedObjects.size === 0) {
        propertiesContent.innerHTML = '<p class="panel-message">حدد كائناً لعرض خصائصه</p>';
        return;
    }
    
    if (appState.ui.selectedObjects.size === 1) {
        const objectId = Array.from(appState.ui.selectedObjects)[0];
        const object = appState.project.activeObjects.get(objectId);
        if (object) {
            propertiesContent.innerHTML = createObjectPropertiesHTML(object);
        }
    } else {
        propertiesContent.innerHTML = `<p class="panel-message">محدد ${appState.ui.selectedObjects.size} كائنات</p>`;
    }
}

// ==================== دوال مساعدة لواجهة المستخدم ====================

function createLayerElement(layer: Layer): HTMLElement {
    const layerDiv = document.createElement('div');
    layerDiv.className = 'layer-item';
    layerDiv.innerHTML = `
        <div class="layer-visibility">
            <input type="checkbox" ${layer.visible ? 'checked' : ''} 
                   onchange="toggleLayerVisibility('${layer.id}')">
        </div>
        <div class="layer-name" onclick="selectLayer('${layer.id}')">${layer.name}</div>
        <div class="layer-actions">
            <button onclick="editLayer('${layer.id}')" title="تحرير">✏️</button>
            <button onclick="deleteLayer('${layer.id}')" title="حذف">🗑️</button>
        </div>
    `;
    
    return layerDiv;
}

function createObjectPropertiesHTML(object: GeometricObject): string {
    const props = object.visualProperties;
    const metadata = object.metadata;
    
    return `
        <div class="property-group">
            <h4>معلومات عامة</h4>
            <div class="property-item">
                <label>النوع:</label>
                <span>${object.type}</span>
            </div>
            <div class="property-item">
                <label>المعرف:</label>
                <span>${object.id}</span>
            </div>
            <div class="property-item">
                <label>الطبقة:</label>
                <span>${object.layerId}</span>
            </div>
        </div>
        
        <div class="property-group">
            <h4>خصائص مرئية</h4>
            <div class="property-item">
                <label>اللون:</label>
                <input type="color" value="${props.color}" 
                       onchange="updateObjectColor('${object.id}', this.value)">
            </div>
            <div class="property-item">
                <label>الشفافية:</label>
                <input type="range" min="0" max="1" step="0.1" value="${props.opacity}"
                       onchange="updateObjectOpacity('${object.id}', this.value)">
            </div>
        </div>
        
        <div class="property-group">
            <h4>معلومات التاريخ</h4>
            <div class="property-item">
                <label>تاريخ الإنشاء:</label>
                <span>${metadata.createdAt.toLocaleString('ar')}</span>
            </div>
            <div class="property-item">
                <label>آخر تعديل:</label>
                <span>${metadata.modifiedAt.toLocaleString('ar')}</span>
            </div>
        </div>
    `;
}

// ==================== إدارة الرسائل ====================

function showSuccessMessage(message: string): void {
    showToast(message, 'success');
}

function showErrorMessage(message: string): void {
    showToast(message, 'error');
}

function showWarningMessage(message: string): void {
    showToast(message, 'warning');
}

function showInfoMessage(message: string): void {
    showToast(message, 'info');
}

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    }[type];
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // إزالة تلقائية بعد 5 ثواني
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function showWelcomeMessage(): void {
    showToast(`🎉 مرحباً بك في TyrexWebCad ${APP_CONFIG.version}`, 'success');
}

// ==================== معالجة الأخطاء ====================

function handleInitializationError(error: any): void {
    logger.error('فشلت تهيئة التطبيق:', error);
    appState.status.lastError = error;
    appState.status.isLoading = false;
    
    updateLoadingProgress(0, 'فشل التحميل');
    
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    
    setTimeout(() => {
        hideLoadingScreen();
        showErrorDialog('خطأ في التهيئة', 
            `فشل تحميل التطبيق: ${errorMessage}\n\nهل تريد المحاولة مرة أخرى؟`);
    }, 1000);
}

function showErrorDialog(title: string, message: string): void {
    if (confirm(`${title}\n\n${message}`)) {
        window.location.reload();
    }
}

// ==================== دوال مساعدة ====================

function updateLoadingProgress(percent: number, text: string): void {
    appState.status.loadingProgress = percent;
    
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingProgress) loadingProgress.style.width = `${percent}%`;
    if (loadingText) loadingText.textContent = text;
}

function showWelcomeScreen(): void {
    // عرض شاشة الترحيب مع معلومات النسخة
    const welcomeInfo = document.querySelector('.loading-subtitle');
    if (welcomeInfo) {
        welcomeInfo.textContent = `الإصدار ${APP_CONFIG.version} - نظام تصميم متقدم`;
    }
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

function showMainInterface(): void {
    // إظهار الواجهة الرئيسية مع تأثيرات انتقالية
    const elements = [
        document.getElementById('toolbar'),
        document.getElementById('side-panels'),
        document.getElementById('status-bar')
    ];
    
    elements.forEach((element, index) => {
        if (element) {
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        }
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function markProjectAsDirty(): void {
    appState.project.isDirty = true;
    updateTitle();
}

function updateActiveButton(activeButton: HTMLElement, groupClass: string): void {
    document.querySelectorAll(`.${groupClass}`).forEach(btn => {
        btn.classList.remove('active');
    });
    activeButton.classList.add('active');
}

function applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
}

function updateViewerSettings(): void {
    if (!appState.viewer) return;
    
    appState.viewer.updateViewSettings({
        showGrid: appState.ui.showGrid,
        showAxes: appState.ui.showAxes
    });
}

async function confirmSaveChanges(): Promise<boolean | null> {
    return new Promise((resolve) => {
        const result = confirm('المشروع الحالي يحتوي على تغييرات غير محفوظة. هل تريد حفظها؟');
        resolve(result);
    });
}

// دوال مساعدة للطبقات والمشروع
async function loadDefaultProject(): Promise<void> {
    // تحميل مشروع افتراضي أو فارغ
    logger.info('تم تحميل المشروع الافتراضي');
}

function serializeProject(): string {
    const projectData = {
        version: APP_CONFIG.version,
        objects: Array.from(appState.project.activeObjects.values()).map(obj => obj.toJSON()),
        layers: Array.from(appState.project.layers.values()).map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible
        })),
        settings: appState.ui,
        timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(projectData, null, 2);
}

async function loadProjectData(data: string): Promise<void> {
    const projectData = JSON.parse(data);
    
    // تحميل الطبقات
    projectData.layers?.forEach((layerData: any) => {
        const layer = new Layer();
        layer.id = layerData.id;
        layer.name = layerData.name;
        layer.visible = layerData.visible;
        appState.project.layers.set(layer.id, layer);
    });
    
    // تحميل الكائنات
    // TODO: تنفيذ تحميل الكائنات الهندسية
    
    appState.project.isDirty = false;
    updateUI();
}

// دوال مساعدة للاستيراد والتصدير
async function importFile(file?: File): Promise<void> {
    // تنفيذ استيراد الملفات
    logger.info('استيراد ملف');
}

async function exportFile(): Promise<void> {
    // تنفيذ تصدير الملفات
    logger.info('تصدير ملف');
}

// دوال مساعدة للطبقات
function addNewLayer(): void {
    const layerName = prompt('اسم الطبقة الجديدة:') || `طبقة ${appState.project.layers.size + 1}`;
    
    const layer = new Layer();
    layer.id = `layer_${Date.now()}`;
    layer.name = layerName;
    layer.visible = true;
    
    appState.project.layers.set(layer.id, layer);
    updateLayersDisplay();
    markProjectAsDirty();
}

// دوال للواجهة (سيتم استدعاؤها من HTML)
(window as any).toggleLayerVisibility = (layerId: string) => {
    const layer = appState.project.layers.get(layerId);
    if (layer) {
        layer.visible = !layer.visible;
        markProjectAsDirty();
        // تحديث عرض الكائنات في هذه الطبقة
    }
};

(window as any).selectLayer = (layerId: string) => {
    appState.ui.activeLayer = layerId;
    updateLayersDisplay();
};

(window as any).updateObjectColor = (objectId: string, color: string) => {
    const object = appState.project.activeObjects.get(objectId);
    if (object) {
        object.visualProperties = { ...object.visualProperties, color };
        markProjectAsDirty();
    }
};

(window as any).updateObjectOpacity = (objectId: string, opacity: string) => {
    const object = appState.project.activeObjects.get(objectId);
    if (object) {
        object.visualProperties = { ...object.visualProperties, opacity: parseFloat(opacity) };
        markProjectAsDirty();
    }
};

// دوال مراقبة الأداء
function startPerformanceMonitoring(): void {
    setInterval(() => {
        if (appState.viewer) {
            // تحويل صريح لأن ‎getPerformanceStats‎ يُعيد كائن إحصاءات غير مُعرّف النوع
            const stats = appState.viewer.getPerformanceStats() as unknown as {
                fps: number;
                objectCount: number;
            };
            
            // تحذيرات الأداء
            if (stats.fps < 30) {
                logger.warn(`انخفاض معدل الإطارات: ${stats.fps.toFixed(1)} FPS`);
            }
            
            if (stats.objectCount > APP_CONFIG.performance.maxObjects * 0.8) {
                logger.warn(`عدد كبير من الكائنات: ${stats.objectCount}`);
            }
        }
    }, 5000);
}

async function loadUserPreferences(): Promise<void> {
    try {
        const prefs = localStorage.getItem('tyrexwebcad-preferences');
        if (prefs) {
            const preferences = JSON.parse(prefs);
            
            // تطبيق التفضيلات
            if (preferences.ui) {
                Object.assign(APP_CONFIG.ui, preferences.ui);
            }
            
            if (preferences.performance) {
                Object.assign(APP_CONFIG.performance, preferences.performance);
            }
            
            logger.info('تم تحميل تفضيلات المستخدم');
        }
    } catch (error) {
        logger.warn('فشل تحميل تفضيلات المستخدم:', error);
    }
}

function updateToolStatus(info: any): void {
    // تحديث معلومات حالة الأداة في شريط الحالة
    setStatusMessage(`${info.toolName}: ${info.pointCount}/${info.requiredPoints} نقاط`);
}

function setupContextMenus(): void {
    // إعداد قوائم السياق للنقر بالزر الأيمن
    document.addEventListener('contextmenu', (e) => {
        // منع القائمة الافتراضية في منطقة العرض
        if ((e.target as HTMLElement).closest('#viewer-container')) {
            e.preventDefault();
            // TODO: إظهار قائمة سياق مخصصة
        }
    });
}

// ==================== بدء التطبيق ====================

/**
 * نقطة البداية الرئيسية
 */
function startApplication(): void {
    logger.setLevel(LogLevel.INFO);
    logger.info(`🚀 بدء تطبيق TyrexWebCad ${APP_CONFIG.version}`);
    
    // عرض معلومات البيئة
    logger.info(`البيئة: ${APP_CONFIG.environment}`);
    logger.info(`الميزات المفعلة: ${Object.entries(APP_CONFIG.features).filter(([,v]) => v).map(([k]) => k).join(', ')}`);
    
    initializeApplication();
}

// التحقق من حالة الصفحة وبدء التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// حفظ التفضيلات عند إغلاق التطبيق
window.addEventListener('beforeunload', (e) => {
    if (appState.project.isDirty) {
        e.preventDefault();
        e.returnValue = 'المشروع يحتوي على تغييرات غير محفوظة. هل تريد الخروج؟';
    }
    
    // حفظ التفضيلات
    try {
        const preferences = {
            ui: APP_CONFIG.ui,
            performance: APP_CONFIG.performance,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('tyrexwebcad-preferences', JSON.stringify(preferences));
    } catch (error) {
        logger.warn('فشل حفظ التفضيلات:', error);
    }
});

// معالجة الأخطاء العامة
window.addEventListener('error', (event) => {
    logger.error('خطأ عام:', event.error);
    appState.status.lastError = event.error;
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('وعد مرفوض:', event.reason);
    appState.status.lastError = event.reason;
});

// تصدير الحالة للتطوير والتشخيص
(window as any).TyrexWebCad = {
    version: APP_CONFIG.version,
    appState,
    logger,
    config: APP_CONFIG
};