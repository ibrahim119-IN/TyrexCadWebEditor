/**
 * AbstractDrawTool - الفئة الأساسية المجردة لجميع أدوات الرسم
 * 
 * تحدد الواجهة المشتركة وإدارة الحالة لأدوات الرسم المختلفة
 */

import { Vector3 } from 'three';
import { GeometryEngine } from '../core/GeometryEngine';
import { Logger } from '../core/Logger';
import { CommandManager } from '../core/CommandManager';
import { SnapSystem, SnapResult } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';

// حالات أداة الرسم
export enum DrawToolState {
    IDLE = 'idle',
    ACTIVE = 'active',
    DRAWING = 'drawing',
    PREVIEW = 'preview',
    COMPLETED = 'completed'
}

// نتيجة عملية الرسم
export interface DrawResult {
    success: boolean;
    objectId?: string;
    error?: string;
}

// خيارات أداة الرسم
export interface DrawToolOptions {
    snapEnabled?: boolean;
    measurementEnabled?: boolean;
    previewEnabled?: boolean;
    autoComplete?: boolean;
}

/**
 * الفئة الأساسية المجردة لأدوات الرسم
 */
export abstract class AbstractDrawTool {
    protected geometryEngine: GeometryEngine;
    protected logger: Logger;
    protected commandManager: CommandManager;
    protected snapSystem: SnapSystem;
    protected measurementSystem: MeasurementSystem;
    
    protected state: DrawToolState = DrawToolState.IDLE;
    protected options: DrawToolOptions;
    protected points: Vector3[] = [];
    protected currentPoint: Vector3 | null = null;
    protected previewObject: any = null;
    
    // معرف الأداة
    protected toolId: string;
    
    // أحداث الأداة
    private eventListeners: Map<string, Function[]> = new Map();

    constructor(
        toolId: string,
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: DrawToolOptions = {}
    ) {
        this.toolId = toolId;
        this.geometryEngine = geometryEngine;
        this.commandManager = commandManager;
        this.snapSystem = snapSystem;
        this.measurementSystem = measurementSystem;
        this.logger = Logger.getInstance();
        
        // الخيارات الافتراضية
        this.options = {
            snapEnabled: true,
            measurementEnabled: true,
            previewEnabled: true,
            autoComplete: false,
            ...options
        };
        
        this.logger.debug(`تم إنشاء أداة الرسم: ${this.toolId}`);
    }

    /**
     * دوال مجردة يجب تنفيذها في الفئات المشتقة
     */
    protected abstract getRequiredPointCount(): number;
    protected abstract validatePoints(): boolean;
    protected abstract createGeometry(): any;
    protected abstract updatePreview(): void;
    protected abstract getToolName(): string;

    /**
     * تفعيل الأداة
     */
    public activate(): void {
        this.state = DrawToolState.ACTIVE;
        this.resetTool();
        this.emit('activated', { toolId: this.toolId });
        this.logger.info(`تم تفعيل أداة: ${this.getToolName()}`);
    }

    /**
     * إلغاء تفعيل الأداة
     */
    public deactivate(): void {
        this.cancelDrawing();
        this.state = DrawToolState.IDLE;
        this.emit('deactivated', { toolId: this.toolId });
        this.logger.info(`تم إلغاء تفعيل أداة: ${this.getToolName()}`);
    }

    /**
     * معالج حركة الماوس
     */
    public onMouseMove(point: Vector3, existingObjects: any[] = []): void {
        if (this.state !== DrawToolState.ACTIVE && this.state !== DrawToolState.DRAWING) {
            return;
        }

        let finalPoint = point;

        // تطبيق الانجذاب إذا كان مفعلاً
        if (this.options.snapEnabled) {
            const snapResult = this.snapSystem.snap(
                point,
                existingObjects,
                this.points.length > 0 ? this.points[this.points.length - 1] : undefined
            );
            
            if (snapResult.snapped) {
                finalPoint = snapResult.point;
                this.emit('snap', { snapResult, point: finalPoint });
            }
        }

        this.currentPoint = finalPoint;

        // تحديث المعاينة
        if (this.options.previewEnabled && this.points.length > 0) {
            this.updatePreview();
        }

        // عرض القياسات المؤقتة
        if (this.options.measurementEnabled && this.points.length > 0) {
            this.measurementSystem.showPreviewDimension(
                this.points[this.points.length - 1],
                finalPoint
            );
        }

        this.emit('mousemove', { point: finalPoint, originalPoint: point });
    }

    /**
     * معالج نقرة الماوس
     */
    public onMouseClick(point: Vector3, existingObjects: any[] = []): DrawResult {
        if (this.state !== DrawToolState.ACTIVE && this.state !== DrawToolState.DRAWING) {
            return { success: false, error: 'الأداة غير نشطة' };
        }

        let finalPoint = point;

        // تطبيق الانجذاب
        if (this.options.snapEnabled) {
            const snapResult = this.snapSystem.snap(
                point,
                existingObjects,
                this.points.length > 0 ? this.points[this.points.length - 1] : undefined
            );
            
            if (snapResult.snapped) {
                finalPoint = snapResult.point;
            }
        }

        // إضافة النقطة
        this.points.push(finalPoint);
        this.state = DrawToolState.DRAWING;

        this.logger.debug(`نقطة جديدة: (${finalPoint.x}, ${finalPoint.y}, ${finalPoint.z})`);

        // التحقق من اكتمال الرسم
        if (this.points.length >= this.getRequiredPointCount()) {
            if (this.validatePoints()) {
                return this.completeDraw();
            } else {
                this.logger.warn('النقاط المدخلة غير صالحة');
                this.points.pop(); // إزالة النقطة غير الصالحة
                return { success: false, error: 'النقطة غير صالحة' };
            }
        }

        this.emit('pointAdded', { point: finalPoint, pointIndex: this.points.length - 1 });
        
        return { success: true };
    }

    /**
     * إكمال عملية الرسم
     */
    public completeDraw(): DrawResult {
        try {
            if (!this.validatePoints()) {
                throw new Error('النقاط المدخلة غير صالحة');
            }

            // إنشاء الكائن الهندسي
            const geometryObject = this.createGeometry();
            
            if (!geometryObject) {
                throw new Error('فشل إنشاء الكائن الهندسي');
            }

            // إنشاء أمر الإضافة
            // TODO: إنشاء AddGeometricObjectCommand
            // const command = new AddGeometricObjectCommand(geometryObject);
            // this.commandManager.execute(command);

            this.state = DrawToolState.COMPLETED;
            
            // تنظيف الأداة
            this.resetTool();
            
            this.emit('completed', { objectId: geometryObject.id, object: geometryObject });
            this.logger.info(`تم إكمال رسم ${this.getToolName()}: ${geometryObject.id}`);
            
            return { success: true, objectId: geometryObject.id };
            
        } catch (error) {
            this.logger.error(`فشل إكمال الرسم:`, error);
            this.resetTool();
            return { success: false, error: error instanceof Error ? error.message : 'خطأ غير معروف' };
        }
    }

    /**
     * إلغاء عملية الرسم
     */
    public cancelDrawing(): void {
        this.resetTool();
        this.measurementSystem.hidePreviewDimension();
        this.emit('cancelled', { toolId: this.toolId });
        this.logger.debug(`تم إلغاء رسم ${this.getToolName()}`);
    }

    /**
     * إعادة تعيين الأداة
     */
    protected resetTool(): void {
        this.points = [];
        this.currentPoint = null;
        this.clearPreview();
        
        if (this.state === DrawToolState.DRAWING) {
            this.state = DrawToolState.ACTIVE;
        }
    }

    /**
     * مسح المعاينة
     */
    protected clearPreview(): void {
        if (this.previewObject) {
            // TODO: إزالة كائن المعاينة من المشهد
            this.previewObject = null;
        }
    }

    /**
     * الحصول على معلومات الأداة
     */
    public getToolInfo(): { 
        id: string; 
        name: string; 
        state: DrawToolState; 
        pointCount: number; 
        requiredPoints: number 
    } {
        return {
            id: this.toolId,
            name: this.getToolName(),
            state: this.state,
            pointCount: this.points.length,
            requiredPoints: this.getRequiredPointCount()
        };
    }

    /**
     * تحديث خيارات الأداة
     */
    public updateOptions(newOptions: Partial<DrawToolOptions>): void {
        this.options = { ...this.options, ...newOptions };
        this.logger.debug(`تم تحديث خيارات ${this.getToolName()}`, newOptions);
    }

    /**
     * نظام الأحداث
     */
    public on(event: string, listener: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    public off(event: string, listener: Function): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    protected emit(event: string, data: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    this.logger.error(`خطأ في معالج الحدث ${event}:`, error);
                }
            });
        }
    }

    /**
     * تنظيف الموارد
     */
    public dispose(): void {
        this.cancelDrawing();
        this.eventListeners.clear();
        this.logger.debug(`تم تنظيف أداة الرسم: ${this.toolId}`);
    }
}