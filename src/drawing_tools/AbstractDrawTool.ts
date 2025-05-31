/**
 * AbstractDrawTool - نظام الأدوات المتقدم للرسم
 * فئة أساسية متطورة لجميع أدوات الرسم والتصميم
 */

import { Vector3, Object3D, Mesh, BufferGeometry, Material } from 'three';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { Logger } from '../core/Logger';
import { CommandManager, Command } from '../core/CommandManager';
import { SnapSystem, SnapResult, SnapType } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { GeometricObject } from '../models/GeometricObject';

// حالات أداة الرسم المتقدمة
export enum DrawToolState {
    IDLE = 'idle',
    ACTIVE = 'active',
    DRAWING = 'drawing',
    PREVIEW = 'preview',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    ERROR = 'error'
}

// أنماط الرسم
export enum DrawMode {
    SINGLE = 'single',           // رسم واحد
    CONTINUOUS = 'continuous',   // رسم متتابع
    CHAIN = 'chain',            // رسم متسلسل
    ARRAY = 'array'             // رسم مصفوفة
}

// نوع الإدخال
export enum InputType {
    POINT = 'point',
    DISTANCE = 'distance',
    ANGLE = 'angle',
    TEXT = 'text',
    SELECTION = 'selection'
}

// خيارات الأداة المتقدمة
export interface DrawToolOptions {
    snapEnabled?: boolean;
    measurementEnabled?: boolean;
    previewEnabled?: boolean;
    autoComplete?: boolean;
    undoEnabled?: boolean;
    constraintsEnabled?: boolean;
    
    // إعدادات متقدمة
    precision?: number;
    tolerance?: number;
    maxPoints?: number;
    minPoints?: number;
    
    // إعدادات البصرية
    previewColor?: string;
    previewOpacity?: number;
    highlightColor?: string;
    
    // إعدادات السلوك
    drawMode?: DrawMode;
    continuousMode?: boolean;
    chainMode?: boolean;
    orthoMode?: boolean;
    polarMode?: boolean;
}

// نتيجة الرسم المتقدمة
export interface DrawResult {
    success: boolean;
    objectId?: string;
    objects?: GeometricObject[];
    error?: string;
    warnings?: string[];
    metrics?: {
        pointCount: number;
        totalLength?: number;
        area?: number;
        executionTime: number;
    };
}

// معلومات النقطة المدخلة
export interface InputPoint {
    position: Vector3;
    snapResult?: SnapResult;
    timestamp: number;
    inputType: InputType;
    metadata?: any;
}

// قيود الرسم
export interface DrawConstraints {
    minDistance?: number;
    maxDistance?: number;
    angleConstraint?: number[];  // زوايا مسموحة
    gridConstraint?: boolean;
    heightConstraint?: number;
    planeConstraint?: Vector3;   // التقييد لمستوى معين
}

// معلومات المعاينة
export interface PreviewInfo {
    isActive: boolean;
    geometry?: BufferGeometry;
    material?: Material;
    position?: Vector3;
    rotation?: Vector3;
    scale?: Vector3;
    metadata?: any;
}

// إحصائيات الأداة
export interface ToolStats {
    activationCount: number;
    completionCount: number;
    cancellationCount: number;
    errorCount: number;
    averageExecutionTime: number;
    totalPointsInput: number;
    averagePointsPerOperation: number;
}

/**
 * الفئة الأساسية المجردة المتقدمة لأدوات الرسم
 */
export abstract class AbstractDrawTool {
    protected geometryEngine: GeometryEngine;
    protected logger: Logger;
    protected commandManager: CommandManager;
    protected snapSystem: SnapSystem;
    protected measurementSystem: MeasurementSystem;
    
    // حالة الأداة
    protected state: DrawToolState = DrawToolState.IDLE;
    protected options: DrawToolOptions;
    protected constraints: DrawConstraints = {};
    
    // نقاط الإدخال
    protected inputPoints: InputPoint[] = [];
    protected currentPoint: Vector3 | null = null;
    protected lastSnapResult: SnapResult | null = null;
    
    // كائنات المعاينة
    protected previewObjects: Object3D[] = [];
    protected previewInfo: PreviewInfo = { isActive: false };
    
    // معرف الأداة والبيانات الوصفية
    protected toolId: string;
    protected toolName: string;
    protected toolDescription: string;
    protected toolVersion: string = '1.0.0';
    
    // إدارة الأحداث
    private eventListeners: Map<string, Function[]> = new Map();
    
    // إحصائيات الأداء
    protected stats: ToolStats = {
        activationCount: 0,
        completionCount: 0,
        cancellationCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
        totalPointsInput: 0,
        averagePointsPerOperation: 0
    };
    
    // توقيت العمليات
    private operationStartTime: number = 0;
    private lastOperationTime: number = 0;
    
    // ذاكرة التخزين المؤقت
    private geometryCache: Map<string, any> = new Map();
    private resultCache: Map<string, DrawResult> = new Map();

    constructor(
        toolId: string,
        toolName: string,
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: DrawToolOptions = {}
    ) {
        this.toolId = toolId;
        this.toolName = toolName;
        this.toolDescription = `أداة ${toolName} للرسم المتقدم`;
        
        this.geometryEngine = geometryEngine;
        this.commandManager = commandManager;
        this.snapSystem = snapSystem;
        this.measurementSystem = measurementSystem;
        this.logger = Logger.getInstance();
        
        // دمج الخيارات الافتراضية
        this.options = {
            snapEnabled: true,
            measurementEnabled: true,
            previewEnabled: true,
            autoComplete: false,
            undoEnabled: true,
            constraintsEnabled: true,
            precision: 0.001,
            tolerance: 0.1,
            maxPoints: 100,
            minPoints: 1,
            previewColor: '#2196F3',
            previewOpacity: 0.7,
            highlightColor: '#FF9800',
            drawMode: DrawMode.SINGLE,
            continuousMode: false,
            chainMode: false,
            orthoMode: false,
            polarMode: false,
            ...options
        };
        
        this.logger.debug(`تم إنشاء أداة الرسم المتقدمة: ${this.toolName} (${this.toolId})`);
    }

    // ==================== الدوال المجردة ====================
    
    /**
     * الحصول على عدد النقاط المطلوبة
     */
    protected abstract getRequiredPointCount(): number;
    
    /**
     * التحقق من صحة النقاط المدخلة
     */
    protected abstract validatePoints(): boolean;
    
    /**
     * إنشاء الهندسة من النقاط
     */
    protected abstract createGeometry(): GeometricObject | GeometricObject[] | null;
    
    /**
     * تحديث معاينة الرسم
     */
    protected abstract updatePreview(): void;
    
    /**
     * الحصول على اسم الأداة المعروض
     */
    protected abstract getDisplayName(): string;
    
    /**
     * التحقق من إمكانية إكمال الرسم
     */
    protected abstract canComplete(): boolean;

    // ==================== إدارة دورة حياة الأداة ====================
    
    /**
     * تفعيل الأداة
     */
    public activate(): void {
        this.state = DrawToolState.ACTIVE;
        this.stats.activationCount++;
        this.operationStartTime = performance.now();
        
        this.resetTool();
        this.setupEventHandlers();
        
        this.emit('activated', { 
            toolId: this.toolId, 
            toolName: this.toolName,
            timestamp: Date.now()
        });
        
        this.logger.info(`تم تفعيل أداة: ${this.getDisplayName()}`);
    }

    /**
     * إلغاء تفعيل الأداة
     */
    public deactivate(): void {
        this.cancelDrawing();
        this.cleanup();
        
        this.state = DrawToolState.IDLE;
        
        this.emit('deactivated', { 
            toolId: this.toolId,
            stats: this.getStats(),
            timestamp: Date.now()
        });
        
        this.logger.info(`تم إلغاء تفعيل أداة: ${this.getDisplayName()}`);
    }

    /**
     * تعليق الأداة مؤقتاً
     */
    public suspend(): void {
        if (this.state === DrawToolState.ACTIVE || this.state === DrawToolState.DRAWING) {
            this.clearPreview();
            this.emit('suspended', { toolId: this.toolId });
        }
    }

    /**
     * استئناف الأداة
     */
    public resume(): void {
        if (this.state !== DrawToolState.IDLE) {
            this.updatePreview();
            this.emit('resumed', { toolId: this.toolId });
        }
    }

    // ==================== معالجة الإدخال ====================
    
    /**
     * معالج حركة الماوس المتقدم
     */
    public onMouseMove(point: Vector3, existingObjects: any[] = []): void {
        if (!this.isActiveState()) return;

        const startTime = performance.now();
        
        try {
            let finalPoint = point.clone();
            this.lastSnapResult = null;

            // تطبيق القيود
            finalPoint = this.applyConstraints(finalPoint);
            
            // تطبيق الانجذاب
            if (this.options.snapEnabled) {
                const snapResult = this.performSnapping(finalPoint, existingObjects);
                if (snapResult.snapped) {
                    finalPoint = snapResult.point.clone();
                    this.lastSnapResult = snapResult;
                    this.emit('snap', { 
                        snapResult, 
                        point: finalPoint,
                        snapType: snapResult.type 
                    });
                }
            }

            // تحديث النقطة الحالية
            this.currentPoint = finalPoint;

            // تحديث المعاينة
            if (this.options.previewEnabled && this.shouldShowPreview()) {
                this.updatePreview();
            }

            // عرض القياسات
            if (this.options.measurementEnabled && this.shouldShowMeasurements()) {
                this.updateMeasurements();
            }

            // تحديث معلومات الحالة
            this.updateStatusInfo();

            this.emit('mousemove', { 
                point: finalPoint, 
                originalPoint: point,
                snapResult: this.lastSnapResult,
                processingTime: performance.now() - startTime
            });
            
        } catch (error) {
            this.handleError('خطأ في معالجة حركة الماوس', error);
        }
    }

    /**
     * معالج نقرة الماوس المتقدم
     */
    public onMouseClick(point: Vector3, existingObjects: any[] = []): DrawResult {
        if (!this.isActiveState()) {
            return { success: false, error: 'الأداة غير نشطة' };
        }

        const startTime = performance.now();
        
        try {
            let finalPoint = point.clone();

            // تطبيق القيود والانجذاب
            finalPoint = this.applyConstraints(finalPoint);
            
            if (this.options.snapEnabled) {
                const snapResult = this.performSnapping(finalPoint, existingObjects);
                if (snapResult.snapped) {
                    finalPoint = snapResult.point.clone();
                }
            }

            // التحقق من صحة النقطة
            if (!this.isValidPoint(finalPoint)) {
                return { 
                    success: false, 
                    error: 'النقطة المدخلة غير صالحة',
                    warnings: ['تحقق من القيود والمتطلبات']
                };
            }

            // إضافة النقطة
            const inputPoint: InputPoint = {
                position: finalPoint,
                snapResult: this.lastSnapResult || undefined,
                timestamp: Date.now(),
                inputType: InputType.POINT,
                metadata: this.gatherPointMetadata(finalPoint)
            };

            this.inputPoints.push(inputPoint);
            this.state = DrawToolState.DRAWING;
            this.stats.totalPointsInput++;

            this.logger.debug(`نقطة جديدة: (${finalPoint.x.toFixed(3)}, ${finalPoint.y.toFixed(3)}, ${finalPoint.z.toFixed(3)})`);

            // التحقق من إمكانية الإكمال
            if (this.canComplete() && 
                (this.options.autoComplete || this.inputPoints.length >= this.getRequiredPointCount())) {
                return this.completeDraw();
            }

            // تحديث المعاينة للنقطة التالية
            this.updatePreview();

            const executionTime = performance.now() - startTime;
            this.emit('pointAdded', { 
                point: finalPoint, 
                pointIndex: this.inputPoints.length - 1,
                totalPoints: this.inputPoints.length,
                requiredPoints: this.getRequiredPointCount(),
                canComplete: this.canComplete(),
                executionTime
            });
            
            return { 
                success: true,
                metrics: {
                    pointCount: this.inputPoints.length,
                    executionTime
                }
            };
            
        } catch (error) {
            this.stats.errorCount++;
            return this.handleError('خطأ في معالجة النقرة', error);
        }
    }

    /**
     * إكمال عملية الرسم المتقدم
     */
    public completeDraw(): DrawResult {
        const startTime = performance.now();
        
        try {
            // التحقق من الحالة
            if (!this.canComplete()) {
                return { 
                    success: false, 
                    error: 'لا يمكن إكمال الرسم في الحالة الحالية',
                    warnings: ['تحقق من عدد النقاط والمتطلبات']
                };
            }

            // التحقق من صحة البيانات
            if (!this.validatePoints()) {
                return { 
                    success: false, 
                    error: 'النقاط المدخلة غير صالحة',
                    warnings: ['تحقق من المواضع والقيود']
                };
            }

            // إنشاء الكائن الهندسي
            const geometryResult = this.createGeometry();
            
            if (!geometryResult) {
                throw new Error('فشل إنشاء الكائن الهندسي');
            }

            // معالجة النتيجة (كائن واحد أو متعدد)
            const objects = Array.isArray(geometryResult) ? geometryResult : [geometryResult];
            const objectIds = objects.map(obj => obj.id);

            // إنشاء وتنفيذ الأوامر
            if (this.options.undoEnabled) {
                const commands = objects.map(obj => this.createAddCommand(obj));
                commands.forEach(cmd => this.commandManager.execute(cmd));
            }

            // تنظيف وإعادة تعيين
            this.state = DrawToolState.COMPLETED;
            this.stats.completionCount++;
            
            const executionTime = performance.now() - startTime;
            this.updateExecutionStats(executionTime);
            
            // إنشاء معلومات النتيجة
            const result: DrawResult = {
                success: true,
                objectId: objects.length === 1 ? objects[0].id : undefined,
                objects: objects,
                metrics: {
                    pointCount: this.inputPoints.length,
                    executionTime,
                    totalLength: this.calculateTotalLength(),
                    area: this.calculateArea()
                }
            };

            // تنظيف أو متابعة حسب النمط
            if (this.options.continuousMode) {
                this.prepareForNextDraw();
            } else {
                this.resetTool();
            }
            
            this.emit('completed', {
                result,
                toolId: this.toolId,
                objects,
                stats: this.getStats()
            });
            
            this.logger.info(`تم إكمال رسم ${this.getDisplayName()}: ${objectIds.join(', ')}`);
            
            return result;
            
        } catch (error) {
            this.stats.errorCount++;
            return this.handleError('فشل إكمال الرسم', error);
        }
    }

    /**
     * إلغاء عملية الرسم
     */
    public cancelDrawing(): void {
        try {
            this.state = DrawToolState.CANCELLED;
            this.stats.cancellationCount++;
            
            this.clearPreview();
            this.clearMeasurements();
            this.resetTool();
            
            this.emit('cancelled', { 
                toolId: this.toolId,
                pointsEntered: this.inputPoints.length,
                timestamp: Date.now()
            });
            
            this.logger.debug(`تم إلغاء رسم ${this.getDisplayName()}`);
            
        } catch (error) {
            this.handleError('خطأ في إلغاء الرسم', error);
        }
    }

    // ==================== نظام الانجذاب المتقدم ====================
    
    private performSnapping(point: Vector3, existingObjects: any[]): SnapResult {
        try {
            const referencePoint = this.inputPoints.length > 0 ? 
                this.inputPoints[this.inputPoints.length - 1].position : undefined;
            
            return this.snapSystem.snap(point, existingObjects, referencePoint);
            
        } catch (error) {
            this.logger.warn('خطأ في الانجذاب:', error);
            return { point: point.clone(), snapped: false };
        }
    }

    // ==================== نظام القيود المتقدم ====================
    
    private applyConstraints(point: Vector3): Vector3 {
        let constrainedPoint = point.clone();
        
        try {
            // قيد المستوى
            if (this.constraints.planeConstraint) {
                constrainedPoint = this.constrainToPlane(constrainedPoint, this.constraints.planeConstraint);
            }
            
            // قيد الارتفاع
            if (this.constraints.heightConstraint !== undefined) {
                constrainedPoint.z = this.constraints.heightConstraint;
            }
            
            // قيد المسافة
            if (this.inputPoints.length > 0 && this.constraints.minDistance) {
                const lastPoint = this.inputPoints[this.inputPoints.length - 1].position;
                const distance = constrainedPoint.distanceTo(lastPoint);
                
                if (distance < this.constraints.minDistance) {
                    const direction = constrainedPoint.clone().sub(lastPoint).normalize();
                    constrainedPoint = lastPoint.clone().add(direction.multiplyScalar(this.constraints.minDistance));
                }
            }
            
            // قيد الزاوية
            if (this.options.orthoMode) {
                constrainedPoint = this.constrainToOrtho(constrainedPoint);
            }
            
            if (this.options.polarMode) {
                constrainedPoint = this.constrainToPolar(constrainedPoint);
            }
            
        } catch (error) {
            this.logger.warn('خطأ في تطبيق القيود:', error);
        }
        
        return constrainedPoint;
    }

    private constrainToPlane(point: Vector3, planeNormal: Vector3): Vector3 {
        // إسقاط النقطة على المستوى
        const distance = point.dot(planeNormal);
        return point.clone().sub(planeNormal.clone().multiplyScalar(distance));
    }

    private constrainToOrtho(point: Vector3): Vector3 {
        if (this.inputPoints.length === 0) return point;
        
        const lastPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const diff = point.clone().sub(lastPoint);
        
        // اختيار أقرب اتجاه أورثوغونالي
        const absX = Math.abs(diff.x);
        const absY = Math.abs(diff.y);
        const absZ = Math.abs(diff.z);
        
        if (absX >= absY && absX >= absZ) {
            return new Vector3(lastPoint.x + diff.x, lastPoint.y, lastPoint.z);
        } else if (absY >= absZ) {
            return new Vector3(lastPoint.x, lastPoint.y + diff.y, lastPoint.z);
        } else {
            return new Vector3(lastPoint.x, lastPoint.y, lastPoint.z + diff.z);
        }
    }

    private constrainToPolar(point: Vector3): Vector3 {
        if (this.inputPoints.length === 0) return point;
        
        const lastPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const diff = point.clone().sub(lastPoint);
        const angle = Math.atan2(diff.y, diff.x);
        const distance = diff.length();
        
        // انجذاب لأقرب زاوية 15 درجة
        const snapAngle = Math.round(angle * 12 / Math.PI) * Math.PI / 12;
        
        return lastPoint.clone().add(new Vector3(
            Math.cos(snapAngle) * distance,
            Math.sin(snapAngle) * distance,
            0
        ));
    }

    // ==================== نظام المعاينة المتقدم ====================
    
    protected shouldShowPreview(): boolean {
        return this.options.previewEnabled && 
               this.inputPoints.length > 0 && 
               this.currentPoint !== null &&
               this.state === DrawToolState.DRAWING;
    }

    protected shouldShowMeasurements(): boolean {
        return this.options.measurementEnabled && 
               this.inputPoints.length > 0 && 
               this.currentPoint !== null;
    }

    protected clearPreview(): void {
        try {
            this.previewObjects.forEach(obj => {
                if (obj.parent) {
                    obj.parent.remove(obj);
                }
                this.disposeObject(obj);
            });
            
            this.previewObjects = [];
            this.previewInfo = { isActive: false };
            
            this.emit('previewCleared', { toolId: this.toolId });
            
        } catch (error) {
            this.logger.warn('خطأ في مسح المعاينة:', error);
        }
    }

    protected clearMeasurements(): void {
        try {
            this.measurementSystem.hidePreviewDimension();
        } catch (error) {
            this.logger.warn('خطأ في مسح القياسات:', error);
        }
    }

    private updateMeasurements(): void {
        if (this.inputPoints.length > 0 && this.currentPoint) {
            const lastPoint = this.inputPoints[this.inputPoints.length - 1].position;
            this.measurementSystem.showPreviewDimension(lastPoint, this.currentPoint);
        }
    }

    private updateStatusInfo(): void {
        const info = {
            toolName: this.getDisplayName(),
            state: this.state,
            pointCount: this.inputPoints.length,
            requiredPoints: this.getRequiredPointCount(),
            canComplete: this.canComplete(),
            currentPoint: this.currentPoint?.clone(),
            lastSnap: this.lastSnapResult
        };
        
        this.emit('statusUpdate', info);
    }

    // ==================== إدارة الذاكرة والأداء ====================
    
    private disposeObject(obj: Object3D): void {
        try {
            if (obj instanceof Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            }
            
            obj.children.forEach(child => this.disposeObject(child));
            
        } catch (error) {
            this.logger.warn('خطأ في تنظيف الكائن:', error);
        }
    }

    private updateExecutionStats(executionTime: number): void {
        const totalOperations = this.stats.completionCount;
        this.stats.averageExecutionTime = 
            (this.stats.averageExecutionTime * (totalOperations - 1) + executionTime) / totalOperations;
        
        this.stats.averagePointsPerOperation = 
            this.stats.totalPointsInput / totalOperations;
        
        this.lastOperationTime = executionTime;
    }

    // ==================== دوال مساعدة ====================
    
    protected resetTool(): void {
        this.inputPoints = [];
        this.currentPoint = null;
        this.lastSnapResult = null;
        this.clearPreview();
        this.clearMeasurements();
        
        if (this.state === DrawToolState.DRAWING || this.state === DrawToolState.COMPLETED) {
            this.state = DrawToolState.ACTIVE;
        }
    }

    protected prepareForNextDraw(): void {
        // في النمط المتتابع، احتفظ ببعض البيانات
        const lastPoint = this.inputPoints.length > 0 ? 
            this.inputPoints[this.inputPoints.length - 1] : null;
        
        this.inputPoints = [];
        this.currentPoint = null;
        this.lastSnapResult = null;
        this.clearPreview();
        
        // في نمط السلسلة، ابدأ بآخر نقطة
        if (this.options.chainMode && lastPoint) {
            this.inputPoints.push(lastPoint);
        }
        
        this.state = DrawToolState.ACTIVE;
    }

    private isActiveState(): boolean {
        return this.state === DrawToolState.ACTIVE || this.state === DrawToolState.DRAWING;
    }

    private isValidPoint(point: Vector3): boolean {
        if (!point || !isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
            return false;
        }
        
        // فحص التكرار
        const tolerance = this.options.tolerance || 0.1;
        return !this.inputPoints.some(inputPoint => 
            inputPoint.position.distanceTo(point) < tolerance
        );
    }

    private gatherPointMetadata(point: Vector3): any {
        return {
            snapType: this.lastSnapResult?.type,
            constraints: { ...this.constraints },
            timestamp: Date.now(),
            precision: this.options.precision
        };
    }

    private calculateTotalLength(): number {
        if (this.inputPoints.length < 2) return 0;
        
        let totalLength = 0;
        for (let i = 1; i < this.inputPoints.length; i++) {
            totalLength += this.inputPoints[i].position.distanceTo(this.inputPoints[i - 1].position);
        }
        
        return totalLength;
    }

    private calculateArea(): number {
        // تنفيذ حساب المساحة للأشكال المغلقة
        if (this.inputPoints.length < 3) return 0;
        
        // حساب مساحة المضلع باستخدام صيغة الحذاء
        let area = 0;
        const points = this.inputPoints.map(ip => ip.position);
        
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    private setupEventHandlers(): void {
        // إعداد معالجات الأحداث الخاصة بالأداة
    }

    private cleanup(): void {
        this.clearPreview();
        this.clearMeasurements();
        this.geometryCache.clear();
        this.resultCache.clear();
    }

    private handleError(message: string, error: any): DrawResult {
        this.logger.error(`${message} في ${this.getDisplayName()}:`, error);
        this.state = DrawToolState.ERROR;
        
        return {
            success: false,
            error: `${message}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
        };
    }

    protected abstract createAddCommand(object: GeometricObject): Command;

    // ==================== واجهة عامة ====================
    
    public getToolInfo(): { 
        id: string; 
        name: string; 
        displayName: string;
        description: string;
        version: string;
        state: DrawToolState; 
        pointCount: number; 
        requiredPoints: number;
        canComplete: boolean;
        options: DrawToolOptions;
        constraints: DrawConstraints;
    } {
        return {
            id: this.toolId,
            name: this.toolName,
            displayName: this.getDisplayName(),
            description: this.toolDescription,
            version: this.toolVersion,
            state: this.state,
            pointCount: this.inputPoints.length,
            requiredPoints: this.getRequiredPointCount(),
            canComplete: this.canComplete(),
            options: { ...this.options },
            constraints: { ...this.constraints }
        };
    }

    public updateOptions(newOptions: Partial<DrawToolOptions>): void {
        this.options = { ...this.options, ...newOptions };
        this.emit('optionsUpdated', { toolId: this.toolId, options: this.options });
        this.logger.debug(`تم تحديث خيارات ${this.getDisplayName()}`, newOptions);
    }

    public setConstraints(constraints: Partial<DrawConstraints>): void {
        this.constraints = { ...this.constraints, ...constraints };
        this.emit('constraintsUpdated', { toolId: this.toolId, constraints: this.constraints });
        this.logger.debug(`تم تحديث قيود ${this.getDisplayName()}`, constraints);
    }

    public getStats(): ToolStats {
        return { ...this.stats };
    }

    public resetStats(): void {
        this.stats = {
            activationCount: 0,
            completionCount: 0,
            cancellationCount: 0,
            errorCount: 0,
            averageExecutionTime: 0,
            totalPointsInput: 0,
            averagePointsPerOperation: 0
        };
        
        this.emit('statsReset', { toolId: this.toolId });
    }

    // ==================== نظام الأحداث ====================
    
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
                    this.logger.error(`خطأ في معالج الحدث ${event} لأداة ${this.toolId}:`, error);
                }
            });
        }
    }

    // ==================== تنظيف الموارد ====================
    
    public dispose(): void {
        try {
            this.cancelDrawing();
            this.cleanup();
            this.eventListeners.clear();
            
            this.logger.debug(`تم تنظيف أداة الرسم: ${this.toolId}`);
            
        } catch (error) {
            this.logger.error(`خطأ في تنظيف أداة ${this.toolId}:`, error);
        }
    }
}