/**
 * main.ts - نقطة الدخول الرئيسية لتطبيق TyrexWebCad
 * 
 * هذا الملف مسؤول عن:
 * - انتظار تحميل المكتبات المطلوبة (OpenCASCADE)
 * - تهيئة المكونات الأساسية بالترتيب الصحيح
 * - ربط أحداث واجهة المستخدم
 * - إدارة دورة حياة التطبيق
 */

import './styles/main.css';
import { Viewer } from './core/Viewer';
import { GeometryEngine } from './core/GeometryEngine';
import { Logger, LogLevel } from './core/Logger';
import { Constants } from './core/Constants';
import { CommandManager } from './core/CommandManager';
import { ProjectManager } from './core/ProjectManager';

// واجهة لحالة التطبيق
interface AppState {
    viewer: Viewer | null;
    commandManager: CommandManager;
    projectManager: ProjectManager;
    currentTool: string;
    isInitialized: boolean;
}

// حالة التطبيق العامة
const appState: AppState = {
    viewer: null,
    commandManager: new CommandManager(),
    projectManager: new ProjectManager(),
    currentTool: 'select',
    isInitialized: false
};

// مثيل Logger
const logger = Logger.getInstance();

/**
 * الدالة الرئيسية لتهيئة التطبيق
 * تُستدعى بعد تحميل DOM و OpenCASCADE
 */
async function initializeApp(): Promise<void> {
    try {
        logger.info('بدء تهيئة TyrexWebCad...');
        updateLoadingProgress(20, 'جاري تهيئة المحرك الهندسي...');
        
        // تهيئة المحرك الهندسي
        const geometryEngine = GeometryEngine.getInstance();
        await geometryEngine.initialize();
        
        updateLoadingProgress(40, 'جاري إنشاء واجهة المستخدم...');
        
        // الحصول على حاوي المشاهد
        const viewerContainer = document.getElementById('viewer-container');
        if (!viewerContainer) {
            throw new Error('لم يتم العثور على حاوي المشاهد');
        }
        
        // إنشاء المشاهد
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
        
        updateLoadingProgress(60, 'جاري ربط أحداث واجهة المستخدم...');
        
        // ربط أحداث واجهة المستخدم
        setupUIEvents();
        
        updateLoadingProgress(80, 'جاري تحميل الإعدادات...');
        
        // تحميل الإعدادات المحفوظة
        loadSettings();
        
        updateLoadingProgress(100, 'اكتمل التحميل!');
        
        // إخفاء شاشة التحميل بعد فترة قصيرة
        setTimeout(() => {
            window.dispatchEvent(new Event('app-initialized'));
            appState.isInitialized = true;
            logger.info('تم تهيئة TyrexWebCad بنجاح');
            
            // عرض رسالة ترحيب
            showToast('مرحباً بك في TyrexWebCad', 'success');
        }, 500);
        
    } catch (error) {
        logger.error('فشلت تهيئة التطبيق:', error);
        showErrorDialog('خطأ في التهيئة', 'فشل تحميل التطبيق. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
    }
}

/**
 * ربط أحداث واجهة المستخدم
 */
function setupUIEvents(): void {
    // أزرار الملف
    setupFileButtons();
    
    // أزرار العرض
    setupViewButtons();
    
    // أدوات الرسم
    setupDrawingTools();
    
    // أزرار التراجع/الإعادة
    setupUndoRedoButtons();
    
    // إعدادات الشبكة
    setupGridSettings();
    
    // اختصارات لوحة المفاتيح
    setupKeyboardShortcuts();
    
    // أحداث المشاهد
    setupViewerEvents();
    
    logger.debug('تم ربط جميع أحداث واجهة المستخدم');
}

/**
 * إعداد أزرار الملف
 */
function setupFileButtons(): void {
    // زر مشروع جديد
    const btnNew = document.getElementById('btn-new');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            if (confirm('هل تريد إنشاء مشروع جديد؟ سيتم فقدان التغييرات غير المحفوظة.')) {
                createNewProject();
            }
        });
    }
    
    // زر فتح مشروع
    const btnOpen = document.getElementById('btn-open');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            openProject();
        });
    }
    
    // زر حفظ المشروع
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            saveProject();
        });
    }
}

/**
 * إعداد أزرار العرض
 */
function setupViewButtons(): void {
    const btn2D = document.getElementById('btn-2d-view');
    const btn3D = document.getElementById('btn-3d-view');
    
    if (btn2D && btn3D && appState.viewer) {
        btn2D.addEventListener('click', () => {
            appState.viewer!.setView(true);
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            logger.info('تم التبديل إلى العرض ثنائي الأبعاد');
        });
        
        btn3D.addEventListener('click', () => {
            appState.viewer!.setView(false);
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            logger.info('تم التبديل إلى العرض ثلاثي الأبعاد');
        });
    }
}

/**
 * إعداد أدوات الرسم
 */
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

/**
 * تعيين الأداة النشطة
 */
function setActiveTool(toolName: string): void {
    // إزالة الحالة النشطة من جميع الأزرار
    document.querySelectorAll('#drawing-tools .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // إضافة الحالة النشطة للأداة المختارة
    const activeButton = document.getElementById(`tool-${toolName}`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    appState.currentTool = toolName;
    
    // تحديث الأداة في المشاهد
    if (appState.viewer) {
        // سيتم تنفيذ هذا لاحقاً عند إضافة أدوات الرسم
        // appState.viewer.setCurrentTool(toolName);
    }
    
    logger.info(`تم تفعيل أداة: ${toolName}`);
}

/**
 * إعداد أزرار التراجع/الإعادة
 */
function setupUndoRedoButtons(): void {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (appState.commandManager.canUndo()) {
                appState.commandManager.undo();
                logger.info('تم التراجع عن آخر عملية');
            }
        });
    }
    
    if (btnRedo) {
        btnRedo.addEventListener('click', () => {
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
                logger.info('تمت إعادة آخر عملية');
            }
        });
    }
}

/**
 * إعداد إعدادات الشبكة
 */
function setupGridSettings(): void {
    const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
    const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
    
    if (snapCheckbox && appState.viewer) {
        snapCheckbox.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            // سيتم تنفيذ هذا لاحقاً
            // appState.viewer.setSnapToGrid(target.checked);
            logger.info(`المحاذاة للشبكة: ${target.checked ? 'مفعلة' : 'معطلة'}`);
        });
    }
    
    if (gridSizeSelect && appState.viewer) {
        gridSizeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const size = parseFloat(target.value);
            // سيتم تنفيذ هذا لاحقاً
            // appState.viewer.setGridSize(size);
            logger.info(`حجم الشبكة: ${size} متر`);
        });
    }
}

/**
 * إعداد اختصارات لوحة المفاتيح
 */
function setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        // منع الاختصارات أثناء الكتابة في حقول الإدخال
        if ((e.target as HTMLElement).tagName === 'INPUT') {
            return;
        }
        
        // Ctrl+Z - تراجع
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (appState.commandManager.canUndo()) {
                appState.commandManager.undo();
            }
        }
        
        // Ctrl+Y أو Ctrl+Shift+Z - إعادة
        if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            if (appState.commandManager.canRedo()) {
                appState.commandManager.redo();
            }
        }
        
        // Ctrl+S - حفظ
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveProject();
        }
        
        // Ctrl+O - فتح
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            openProject();
        }
        
        // Ctrl+N - جديد
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (confirm('هل تريد إنشاء مشروع جديد؟ سيتم فقدان التغييرات غير المحفوظة.')) {
                createNewProject();
            }
        }
        
        // ESC - إلغاء العملية الحالية
        if (e.key === 'Escape') {
            // سيتم تنفيذ هذا في المشاهد
        }
        
        // Delete - حذف العناصر المحددة
        if (e.key === 'Delete') {
            // سيتم تنفيذ هذا في المشاهد
        }
    });
}

/**
 * إعداد أحداث المشاهد
 */
function setupViewerEvents(): void {
    if (!appState.viewer) return;
    
    // الاستماع لأحداث المشاهد
    appState.viewer.on('objectAdded', (object) => {
        logger.debug('تمت إضافة كائن:', object);
        updateStatusBar(`تمت إضافة ${object.type}`);
    });
    
    appState.viewer.on('objectRemoved', (object) => {
        logger.debug('تمت إزالة كائن:', object);
        updateStatusBar(`تمت إزالة ${object.type}`);
    });
    
    appState.viewer.on('objectSelected', (object) => {
        if (object) {
            updateObjectInfo(object);
            showObjectProperties(object);
        } else {
            clearObjectInfo();
            clearProperties();
        }
    });
}

/**
 * إنشاء مشروع جديد
 */
function createNewProject(): void {
    logger.info('إنشاء مشروع جديد...');
    
    // مسح المشهد الحالي
    if (appState.viewer) {
        // سيتم تنفيذ هذا لاحقاً
        // appState.viewer.clearAll();
    }
    
    // مسح سجل الأوامر
    appState.commandManager.clear();
    
    updateStatusBar('تم إنشاء مشروع جديد');
    showToast('تم إنشاء مشروع جديد', 'success');
}

/**
 * فتح مشروع
 */
async function openProject(): Promise<void> {
    try {
        const fileData = await appState.projectManager.openProject();
        
        if (fileData && appState.viewer) {
            // سيتم تنفيذ هذا لاحقاً
            // appState.viewer.loadProject(fileData);
            
            updateStatusBar('تم فتح المشروع بنجاح');
            showToast('تم فتح المشروع', 'success');
        }
    } catch (error) {
        logger.error('فشل فتح المشروع:', error);
        showToast('فشل فتح المشروع', 'error');
    }
}

/**
 * حفظ المشروع
 */
async function saveProject(): Promise<void> {
    try {
        if (appState.viewer) {
            // سيتم تنفيذ هذا لاحقاً
            // const projectData = appState.viewer.getProjectData();
            // await appState.projectManager.saveProject(projectData);
            
            updateStatusBar('تم حفظ المشروع بنجاح');
            showToast('تم حفظ المشروع', 'success');
        }
    } catch (error) {
        logger.error('فشل حفظ المشروع:', error);
        showToast('فشل حفظ المشروع', 'error');
    }
}

/**
 * تحميل الإعدادات المحفوظة
 */
function loadSettings(): void {
    try {
        const settings = localStorage.getItem('tyrexwebcad-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            
            // تطبيق الإعدادات
            if (parsed.gridSize) {
                const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
                if (gridSizeSelect) {
                    gridSizeSelect.value = parsed.gridSize;
                }
            }
            
            if (parsed.snapToGrid !== undefined) {
                const snapCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
                if (snapCheckbox) {
                    snapCheckbox.checked = parsed.snapToGrid;
                }
            }
            
            logger.info('تم تحميل الإعدادات المحفوظة');
        }
    } catch (error) {
        logger.warn('فشل تحميل الإعدادات المحفوظة:', error);
    }
}

/**
 * حفظ الإعدادات
 */
function saveSettings(): void {
    try {
        const settings = {
            gridSize: (document.getElementById('grid-size') as HTMLSelectElement)?.value || '1',
            snapToGrid: (document.getElementById('snap-to-grid') as HTMLInputElement)?.checked ?? true,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('tyrexwebcad-settings', JSON.stringify(settings));
        logger.debug('تم حفظ الإعدادات');
    } catch (error) {
        logger.warn('فشل حفظ الإعدادات:', error);
    }
}

/**
 * دوال مساعدة لواجهة المستخدم
 */

function updateLoadingProgress(percent: number, text: string): void {
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingProgress) {
        loadingProgress.style.width = `${percent}%`;
    }
    
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function updateStatusBar(message: string): void {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

function updateObjectInfo(object: any): void {
    const objectInfo = document.getElementById('object-info');
    if (objectInfo) {
        objectInfo.textContent = `${object.type} - ${object.id}`;
    }
}

function clearObjectInfo(): void {
    const objectInfo = document.getElementById('object-info');
    if (objectInfo) {
        objectInfo.textContent = '';
    }
}

function showObjectProperties(object: any): void {
    const propertiesContent = document.getElementById('properties-content');
    if (!propertiesContent) return;
    
    // سيتم تنفيذ هذا لاحقاً - عرض خصائص الكائن
    propertiesContent.innerHTML = `
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
        </div>
    `;
}

function clearProperties(): void {
    const propertiesContent = document.getElementById('properties-content');
    if (propertiesContent) {
        propertiesContent.innerHTML = '<p class="panel-message">حدد كائناً لعرض خصائصه</p>';
    }
}

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // إزالة التنبيه بعد 3 ثوانٍ
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

function showErrorDialog(title: string, message: string): void {
    // في الإنتاج، يمكن استبدال هذا بمربع حوار مخصص
    alert(`${title}\n\n${message}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * نقطة البداية
 * ننتظر تحميل DOM و OpenCASCADE قبل بدء التطبيق
 */
function start(): void {
    // التحقق من جاهزية OpenCASCADE
    if (!(window as any).OpenCascadeModule) {
        logger.warn('OpenCASCADE غير محمل بعد، سنحاول مرة أخرى...');
        
        // إذا لم يكن OpenCASCADE محملاً، ننتظر الحدث
        window.addEventListener('opencascade-loaded', () => {
            logger.info('تم تحميل OpenCASCADE، بدء التطبيق...');
            initializeApp();
        });
    } else {
        // إذا كان محملاً، نبدأ مباشرة
        initializeApp();
    }
}

// بدء التطبيق عند تحميل DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}

// حفظ الإعدادات عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    saveSettings();
});

// معالج الأخطاء العام
window.addEventListener('error', (event) => {
    logger.error('خطأ غير معالج:', event.error);
    console.error('Unhandled error:', event.error);
});

// معالج رفض الوعود
window.addEventListener('unhandledrejection', (event) => {
    logger.error('وعد مرفوض غير معالج:', event.reason);
    console.error('Unhandled promise rejection:', event.reason);
});

// تصدير حالة التطبيق للتطوير (يمكن إزالته في الإنتاج)
(window as any).appState = appState;
(window as any).logger = logger;