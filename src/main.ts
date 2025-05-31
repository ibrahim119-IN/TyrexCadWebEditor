import './styles/main.css';
import { Viewer } from './core/Viewer';
import { Constants } from './core/Constants';

// الدالة الرئيسية لبدء التطبيق
function initializeApp(): void {
    // الحصول على العناصر من DOM
    const container = document.getElementById('viewer-container');
    
    if (!container) {
        console.error('Viewer container not found!');
        return;
    }

    // إنشاء مثيل من المشاهد
    const viewer = new Viewer(container);
    (window as any).viewer = viewer; // جعله متاحاً للتطوير

    // ربط أزرار شريط الأدوات
    setupToolbarButtons(viewer);

    // ربط عناصر التحكم في الإعدادات
    setupSettingsControls(viewer);

    // تحديث شريط المعلومات
    setupInfoBar(viewer);

    // إظهار رسالة الترحيب
    showWelcomeMessage();

    // إعداد أدوات الرسم الجديدة
    setupDrawingTools(viewer);

    // إعداد Undo/Redo
    setupUndoRedo(viewer);

    // إعداد حفظ/تحميل المشروع
    setupProjectManagement(viewer);
}

// إعداد أزرار شريط الأدوات الأساسية
function setupToolbarButtons(viewer: Viewer): void {
    // زر التبديل إلى العرض ثنائي الأبعاد
    const btn2D = document.getElementById('switch-to-2d');
    if (btn2D) {
        btn2D.addEventListener('click', () => {
            viewer.setView(true);
            updateViewButtons(true);
        });
    }

    // زر التبديل إلى العرض ثلاثي الأبعاد
    const btn3D = document.getElementById('switch-to-3d');
    if (btn3D) {
        btn3D.addEventListener('click', () => {
            viewer.setView(false);
            updateViewButtons(false);
        });
    }

    // زر ملائمة الزوم
    const btnZoomFit = document.getElementById('zoom-fit');
    if (btnZoomFit) {
        btnZoomFit.addEventListener('click', () => {
            viewer.zoomExtend();
        });
    }
}

// إعداد عناصر التحكم في الإعدادات
function setupSettingsControls(viewer: Viewer): void {
    // خانة اختيار الانجذاب للشبكة
    const snapToGridCheckbox = document.getElementById('snap-to-grid') as HTMLInputElement;
    if (snapToGridCheckbox) {
        snapToGridCheckbox.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            viewer.setSnapToGrid(target.checked);
        });
    }

    // قائمة حجم الشبكة
    const gridSizeSelect = document.getElementById('grid-size') as HTMLSelectElement;
    if (gridSizeSelect) {
        gridSizeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const size = parseFloat(target.value);
            viewer.setGridSize(size);
        });
    }
}

// إعداد شريط المعلومات
function setupInfoBar(viewer: Viewer): void {
    const cursorPositionElement = document.getElementById('cursor-position');
    const wallInfoElement = document.getElementById('wall-info');

    if (!cursorPositionElement || !wallInfoElement) return;

    // تحديث موضع المؤشر
    let updateTimer: number | null = null;
    
    document.addEventListener('mousemove', (e) => {
        // استخدام throttling لتحسين الأداء
        if (updateTimer) return;
        
        updateTimer = window.setTimeout(() => {
            const worldPos = viewer.getWorldPosition(e.clientX, e.clientY);
            if (worldPos) {
                cursorPositionElement.textContent = 
                    `X: ${worldPos.x.toFixed(2)}, Y: ${worldPos.y.toFixed(2)}`;
            }
            updateTimer = null;
        }, Constants.UI.INFO_UPDATE_RATE);
    });

    // الاستماع لأحداث المشاهد لتحديث معلومات الجدار
    viewer.on('wallDrawing', (info: any) => {
        if (info.length && info.angle !== undefined) {
            wallInfoElement.textContent = 
                `Length: ${info.length.toFixed(2)}m, Angle: ${info.angle.toFixed(1)}°`;
        } else {
            wallInfoElement.textContent = '';
        }
    });

    viewer.on('wallSelected', (wall: any) => {
        if (wall) {
            wallInfoElement.textContent = 
                `Selected Wall: ${wall.length.toFixed(2)}m`;
        } else {
            wallInfoElement.textContent = '';
        }
    });
}

// إعداد أدوات الرسم
function setupDrawingTools(viewer: Viewer): void {
    // أداة الجدار
    document.getElementById('tool-wall')?.addEventListener('click', () => {
        viewer.setCurrentTool('wall');
        updateToolButtons('wall');
    });

    // أداة الباب
    document.getElementById('tool-door')?.addEventListener('click', () => {
        viewer.setCurrentTool('door');
        updateToolButtons('door');
    });

    // أداة النافذة
    document.getElementById('tool-window')?.addEventListener('click', () => {
        viewer.setCurrentTool('window');
        updateToolButtons('window');
    });
}

// إعداد Undo/Redo
function setupUndoRedo(viewer: Viewer): void {
    // زر التراجع
    document.getElementById('undo')?.addEventListener('click', () => {
        viewer.undo();
    });

    // زر الإعادة
    document.getElementById('redo')?.addEventListener('click', () => {
        viewer.redo();
    });

    // اختصارات لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            viewer.undo();
        } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            viewer.redo();
        }
    });
}

// إعداد إدارة المشروع
function setupProjectManagement(viewer: Viewer): void {
    // حفظ المشروع
    document.getElementById('save-project')?.addEventListener('click', () => {
        viewer.saveProject();
    });

    // تحميل المشروع
    document.getElementById('load-project')?.addEventListener('click', () => {
        viewer.loadProject();
    });
}

// تحديث حالة أزرار العرض
function updateViewButtons(is2D: boolean): void {
    const btn2D = document.getElementById('switch-to-2d');
    const btn3D = document.getElementById('switch-to-3d');

    if (btn2D && btn3D) {
        if (is2D) {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
        } else {
            btn2D.classList.remove('active');
            btn3D.classList.add('active');
        }
    }
}

// تحديث حالة أزرار الأدوات
function updateToolButtons(activeTool: string): void {
    ['wall', 'door', 'window'].forEach(tool => {
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) {
            if (tool === activeTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// عرض رسالة الترحيب
function showWelcomeMessage(): void {
    const helpMessage = document.querySelector('.help-message');
    if (helpMessage) {
        // إخفاء الرسالة بعد 5 ثوانٍ
        setTimeout(() => {
            helpMessage.classList.add('fade-out');
            setTimeout(() => {
                helpMessage.remove();
            }, 300);
        }, 5000);
    }
}

// إضافة نمط fade-out ديناميكياً
const style = document.createElement('style');
style.textContent = `
    .fade-out {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
        transition: all 0.3s ease-out;
    }
`;
document.head.appendChild(style);

// بدء التطبيق عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// معالجة الأخطاء العامة
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
});

// معالجة رفض الوعود غير المعالجة
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});