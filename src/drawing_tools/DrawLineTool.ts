/**
 * DrawLineTool - أداة رسم الخطوط المتقدمة
 * أداة متكاملة لرسم خطوط مستقيمة مع ميزات متقدمة
 */

import { Vector3, BufferGeometry, LineBasicMaterial, Line as ThreeLine, BufferAttribute } from 'three';
import { AbstractDrawTool, DrawToolOptions, DrawResult, DrawMode, InputType } from './AbstractDrawTool';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { CommandManager, Command } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Line } from '../models/Line';
import { GeometricObject } from '../models/GeometricObject';

// أنماط رسم الخطوط
export enum LineDrawMode {
    SINGLE = 'single',           // خط واحد بين نقطتين
    CONTINUOUS = 'continuous',   // خطوط متتابعة
    POLYLINE = 'polyline',       // خط متعدد الأضلاع
    CONSTRUCTION = 'construction', // خطوط إنشائية
    INFINITE = 'infinite',       // خطوط لا نهائية
    RAY = 'ray'                 // أشعة (نصف خط)
}

// إعدادات خاصة بالخطوط
export interface LineToolOptions extends DrawToolOptions {
    lineDrawMode?: LineDrawMode;
    showLength?: boolean;
    showAngle?: boolean;
    showMidpoint?: boolean;
    constructionLines?: boolean;
    infiniteExtension?: boolean;
    angleIncrement?: number;     // زيادة الزاوية للانجذاب
    lengthIncrement?: number;    // زيادة الطول للانجذاب
}

// معلومات خاصة بالخط
export interface LineInfo {
    length: number;
    angle: number;              // بالراديان
    angleDegrees: number;       // بالدرجات
    startPoint: Point3D;
    endPoint: Point3D;
    midPoint: Point3D;
    direction: Vector3;
    slope?: number;             // الميل (للخطوط ثنائية الأبعاد)
    isHorizontal: boolean;
    isVertical: boolean;
    isDiagonal: boolean;
}

// أمر إضافة خط
class AddLineCommand implements Command {
    private line: Line;
    private viewer: any;

    constructor(line: Line, viewer: any) {
        this.line = line;
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer?.addGeometricObject(this.line);
    }

    undo(): void {
        this.viewer?.removeGeometricObject(this.line.id);
    }

    getDescription(): string {
        return `إضافة خط: ${this.line.id}`;
    }
}

/**
 * أداة رسم الخطوط المتقدمة
 */
export class DrawLineTool extends AbstractDrawTool {
    private lineDrawMode: LineDrawMode = LineDrawMode.SINGLE;
    private previewLine: ThreeLine | null = null;
    private constructionLines: ThreeLine[] = [];
    private currentLineInfo: LineInfo | null = null;
    private viewer: any = null;

    // إعدادات خاصة
    private lineOptions: LineToolOptions;
    
    // خطوط الإنشاء والمساعدة
    private helperLines: {
        horizontal?: ThreeLine;
        vertical?: ThreeLine;
        angleReference?: ThreeLine;
        lengthReference?: ThreeLine;
    } = {};

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: LineToolOptions = {},
        mode: LineDrawMode = LineDrawMode.SINGLE
    ) {
        super(
            'draw-line',
            'رسم خط',
            geometryEngine,
            commandManager,
            snapSystem,
            measurementSystem,
            {
                snapEnabled: true,
                measurementEnabled: true,
                previewEnabled: true,
                autoComplete: true,
                undoEnabled: true,
                constraintsEnabled: true,
                precision: 0.001,
                tolerance: 0.1,
                maxPoints: 1000,
                minPoints: 2,
                drawMode: DrawMode.CONTINUOUS,
                ...options
            }
        );

        this.lineDrawMode = mode;
        this.lineOptions = {
            ...this.options,
            showLength: true,
            showAngle: true,
            showMidpoint: false,
            constructionLines: false,
            infiniteExtension: false,
            angleIncrement: 15,      // درجات
            lengthIncrement: 1,      // متر
            ...options
        } as LineToolOptions;

        this.setupLineSpecificOptions();
    }

    // ==================== الدوال المجردة المطلوبة ====================

    protected getRequiredPointCount(): number {
        switch (this.lineDrawMode) {
            case LineDrawMode.SINGLE:
                return 2;
            case LineDrawMode.CONTINUOUS:
            case LineDrawMode.POLYLINE:
                return 2; // الحد الأدنى، يمكن المتابعة
            case LineDrawMode.CONSTRUCTION:
                return 2;
            case LineDrawMode.INFINITE:
            case LineDrawMode.RAY:
                return 2;
            default:
                return 2;
        }
    }

    protected validatePoints(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        // فحص خاص للخطوط
        for (let i = 1; i < this.inputPoints.length; i++) {
            const prevPoint = this.inputPoints[i - 1].position;
            const currentPoint = this.inputPoints[i].position;
            
            const distance = prevPoint.distanceTo(currentPoint);
            if (distance < (this.options.tolerance || 0.001)) {
                this.logger.warn('نقاط متقاربة جداً في الخط');
                return false;
            }
        }

        return true;
    }

    protected createGeometry(): GeometricObject | GeometricObject[] | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            switch (this.lineDrawMode) {
                case LineDrawMode.SINGLE:
                    return this.createSingleLine();
                
                case LineDrawMode.CONTINUOUS:
                    return this.createContinuousLines();
                
                case LineDrawMode.POLYLINE:
                    return this.createPolyline();
                
                case LineDrawMode.CONSTRUCTION:
                    return this.createConstructionLine();
                
                case LineDrawMode.INFINITE:
                    return this.createInfiniteLine();
                
                case LineDrawMode.RAY:
                    return this.createRay();
                
                default:
                    return this.createSingleLine();
            }
        } catch (error) {
            this.logger.error('فشل إنشاء الخط:', error);
            return null;
        }
    }

    protected updatePreview(): void {
        if (!this.shouldShowPreview()) {
            this.clearPreview();
            return;
        }

        try {
            this.clearPreview();
            
            if (this.inputPoints.length > 0 && this.currentPoint) {
                this.createLinePreview();
                this.updateLineInfo();
                this.showHelperLines();
                
                if (this.lineOptions.showLength || this.lineOptions.showAngle) {
                    this.updateMeasurementDisplay();
                }
            }
        } catch (error) {
            this.logger.error('فشل تحديث معاينة الخط:', error);
        }
    }

    protected getDisplayName(): string {
        const modeNames = {
            [LineDrawMode.SINGLE]: 'خط مستقيم',
            [LineDrawMode.CONTINUOUS]: 'خطوط متتابعة',
            [LineDrawMode.POLYLINE]: 'خط متعدد الأضلاع',
            [LineDrawMode.CONSTRUCTION]: 'خط إنشائي',
            [LineDrawMode.INFINITE]: 'خط لا نهائي',
            [LineDrawMode.RAY]: 'شعاع'
        };
        
        return modeNames[this.lineDrawMode] || 'رسم خط';
    }

    protected canComplete(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        switch (this.lineDrawMode) {
            case LineDrawMode.SINGLE:
            case LineDrawMode.CONSTRUCTION:
            case LineDrawMode.INFINITE:
            case LineDrawMode.RAY:
                return this.inputPoints.length >= 2;
            
            case LineDrawMode.CONTINUOUS:
            case LineDrawMode.POLYLINE:
                return this.inputPoints.length >= 2; // يمكن الإكمال في أي وقت
            
            default:
                return this.inputPoints.length >= 2;
        }
    }

    protected createAddCommand(object: GeometricObject): Command {
        return new AddLineCommand(object as Line, this.viewer);
    }

    // ==================== إنشاء أنواع الخطوط ====================

    private createSingleLine(): Line {
        const startPoint = this.inputPoints[0].position;
        const endPoint = this.inputPoints[1].position;
        
        const line = new Line(
            { x: startPoint.x, y: startPoint.y, z: startPoint.z },
            { x: endPoint.x, y: endPoint.y, z: endPoint.z }
        );
        
        this.applyLineProperties(line);
        
        this.logger.info(`تم إنشاء خط مستقيم: ${line.id}`);
        return line;
    }

    private createContinuousLines(): Line[] {
        const lines: Line[] = [];
        
        for (let i = 1; i < this.inputPoints.length; i++) {
            const startPoint = this.inputPoints[i - 1].position;
            const endPoint = this.inputPoints[i].position;
            
            const line = new Line(
                { x: startPoint.x, y: startPoint.y, z: startPoint.z },
                { x: endPoint.x, y: endPoint.y, z: endPoint.z }
            );
            
            this.applyLineProperties(line);
            lines.push(line);
        }
        
        this.logger.info(`تم إنشاء ${lines.length} خط متتابع`);
        return lines;
    }

    private createPolyline(): Line {
        // إنشاء خط متعدد الأضلاع كخط واحد مركب
        // TODO: تنفيذ Polyline كفئة منفصلة
        return this.createSingleLine();
    }

    private createConstructionLine(): Line {
        const line = this.createSingleLine();
        
        // تطبيق خصائص خط الإنشاء
        line.visualProperties = {
            ...line.visualProperties,
            color: '#888888',
            lineStyle: 'dashed',
            opacity: 0.5
        };
        
        line.setMetadata('isConstruction', true);
        
        this.logger.info(`تم إنشاء خط إنشائي: ${line.id}`);
        return line;
    }

    private createInfiniteLine(): Line {
        const line = this.createSingleLine();
        
        // تمديد الخط للحدود المرئية
        const direction = new Vector3()
            .subVectors(this.inputPoints[1].position, this.inputPoints[0].position)
            .normalize();
        
        const extensionLength = 1000; // طول كبير للمحاكاة
        
        const extendedStart = this.inputPoints[0].position.clone()
            .sub(direction.clone().multiplyScalar(extensionLength));
        const extendedEnd = this.inputPoints[1].position.clone()
            .add(direction.clone().multiplyScalar(extensionLength));
        
        line.startPoint = { x: extendedStart.x, y: extendedStart.y, z: extendedStart.z };
        line.endPoint = { x: extendedEnd.x, y: extendedEnd.y, z: extendedEnd.z };
        
        line.setMetadata('isInfinite', true);
        
        this.logger.info(`تم إنشاء خط لا نهائي: ${line.id}`);
        return line;
    }

    private createRay(): Line {
        const line = this.createSingleLine();
        
        // تمديد من النقطة الأولى في اتجاه النقطة الثانية
        const direction = new Vector3()
            .subVectors(this.inputPoints[1].position, this.inputPoints[0].position)
            .normalize();
        
        const extensionLength = 1000;
        const extendedEnd = this.inputPoints[0].position.clone()
            .add(direction.clone().multiplyScalar(extensionLength));
        
        line.endPoint = { x: extendedEnd.x, y: extendedEnd.y, z: extendedEnd.z };
        line.setMetadata('isRay', true);
        
        this.logger.info(`تم إنشاء شعاع: ${line.id}`);
        return line;
    }

    // ==================== المعاينة والعرض ====================

    private createLinePreview(): void {
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const endPoint = this.currentPoint!;
        
        // إنشاء هندسة الخط
        const geometry = new BufferGeometry();
        const points = [startPoint, endPoint];
        geometry.setFromPoints(points);
        
        // إنشاء مادة المعاينة
        const material = new LineBasicMaterial({
            color: this.lineOptions.previewColor || '#2196F3',
            opacity: this.lineOptions.previewOpacity || 0.7,
            transparent: true,
            linewidth: 2
        });
        
        // تطبيق نمط الخط حسب النوع
        if (this.lineDrawMode === LineDrawMode.CONSTRUCTION) {
            material.opacity = 0.3;
            // material.lineDashSize = 0.1;
            // material.lineGapSize = 0.05;
        }
        
        this.previewLine = new ThreeLine(geometry, material);
        this.previewObjects.push(this.previewLine);
        
        // إضافة للمشهد (سيحتاج ربط مع العارض)
        this.emit('previewObjectCreated', this.previewLine);
    }

    private updateLineInfo(): void {
        if (this.inputPoints.length === 0 || !this.currentPoint) {
            this.currentLineInfo = null;
            return;
        }
        
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const endPoint = this.currentPoint;
        
        // حساب معلومات الخط
        const direction = new Vector3().subVectors(endPoint, startPoint);
        const length = direction.length();
        const angle = Math.atan2(direction.y, direction.x);
        const angleDegrees = angle * (180 / Math.PI);
        
        const midPoint = new Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        
        this.currentLineInfo = {
            length,
            angle,
            angleDegrees,
            startPoint: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
            endPoint: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
            midPoint: { x: midPoint.x, y: midPoint.y, z: midPoint.z },
            direction: direction.normalize(),
            slope: direction.x !== 0 ? direction.y / direction.x : undefined,
            isHorizontal: Math.abs(direction.y) < 0.001,
            isVertical: Math.abs(direction.x) < 0.001,
            isDiagonal: Math.abs(Math.abs(direction.x) - Math.abs(direction.y)) < 0.001
        };
        
        // إرسال معلومات محدثة
        this.emit('lineInfoUpdated', this.currentLineInfo);
    }

    private showHelperLines(): void {
        if (!(this.lineOptions.constructionLines ?? false) || !this.currentLineInfo) {
            return;
        }
        
        this.clearHelperLines();
        
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const endPoint = this.currentPoint!;
        
        // خط أفقي مساعد
        if (this.shouldShowHorizontalHelper()) {
            this.helperLines.horizontal = this.createHelperLine(
                startPoint,
                new Vector3(endPoint.x, startPoint.y, startPoint.z),
                '#FF9800',
                0.3
            );
        }
        
        // خط عمودي مساعد
        if (this.shouldShowVerticalHelper()) {
            this.helperLines.vertical = this.createHelperLine(
                startPoint,
                new Vector3(startPoint.x, endPoint.y, startPoint.z),
                '#FF9800',
                0.3
            );
        }
        
        // خط مرجعي للزاوية
        if (this.shouldShowAngleHelper()) {
            this.helperLines.angleReference = this.createAngleHelper();
        }
    }

    private createHelperLine(start: Vector3, end: Vector3, color: string, opacity: number): ThreeLine {
        const geometry = new BufferGeometry();
        geometry.setFromPoints([start, end]);
        
        const material = new LineBasicMaterial({
            color,
            opacity,
            transparent: true,
            linewidth: 1
        });
        
        const line = new ThreeLine(geometry, material);
        this.previewObjects.push(line);
        this.emit('previewObjectCreated', line);
        
        return line;
    }

    private createAngleHelper(): ThreeLine | undefined {
        if (!this.currentLineInfo || this.inputPoints.length < 1) {
            return undefined;
        }
        
        // إنشاء قوس لإظهار الزاوية
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const radius = Math.min(this.currentLineInfo.length * 0.2, 2);
        
        const points: Vector3[] = [];
        const segments = 16;
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * this.currentLineInfo.angle;
            const x = startPoint.x + Math.cos(angle) * radius;
            const y = startPoint.y + Math.sin(angle) * radius;
            points.push(new Vector3(x, y, startPoint.z));
        }
        
        const geometry = new BufferGeometry();
        geometry.setFromPoints(points);
        
        const material = new LineBasicMaterial({
            color: '#4CAF50',
            opacity: 0.6,
            transparent: true
        });
        
        const arc = new ThreeLine(geometry, material);
        this.previewObjects.push(arc);
        this.emit('previewObjectCreated', arc);
        
        return arc;
    }

    private updateMeasurementDisplay(): void {
        if (!this.currentLineInfo) return;
        
        // عرض الطول
        if (this.lineOptions.showLength) {
            const lengthText = this.formatLength(this.currentLineInfo.length);
            this.emit('measurementUpdate', {
                type: 'length',
                value: lengthText,
                position: this.currentLineInfo.midPoint
            });
        }
        
        // عرض الزاوية
        if (this.lineOptions.showAngle) {
            const angleText = this.formatAngle(this.currentLineInfo.angleDegrees);
            this.emit('measurementUpdate', {
                type: 'angle',
                value: angleText,
                position: this.currentLineInfo.startPoint
            });
        }
    }

    // ==================== معالجة الانجذاب المتقدم ====================

    public onMouseMove(point: Vector3, existingObjects: any[] = []): void {
        // تطبيق انجذاب خاص بالخطوط
        let enhancedPoint = point.clone();
        
        // انجذاب الزاوية
        if (this.inputPoints.length > 0 && this.lineOptions.angleIncrement) {
            enhancedPoint = this.applyAngleSnap(enhancedPoint);
        }
        
        // انجذاب الطول
        if (this.inputPoints.length > 0 && this.lineOptions.lengthIncrement) {
            enhancedPoint = this.applyLengthSnap(enhancedPoint);
        }
        
        // استدعاء المعالج الأساسي
        super.onMouseMove(enhancedPoint, existingObjects);
    }

    private applyAngleSnap(point: Vector3): Vector3 {
        if (this.inputPoints.length === 0) return point;
        
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const direction = point.clone().sub(startPoint);
        const length = direction.length();
        
        if (length < 0.001) return point;
        
        const angle = Math.atan2(direction.y, direction.x);
        const angleDegrees = angle * (180 / Math.PI);
        
        // انجذاب لأقرب زاوية
        const increment = this.lineOptions.angleIncrement || 15;
        const snappedAngleDegrees = Math.round(angleDegrees / increment) * increment;
        const snappedAngle = snappedAngleDegrees * (Math.PI / 180);
        
        // حساب النقطة الجديدة
        return startPoint.clone().add(new Vector3(
            Math.cos(snappedAngle) * length,
            Math.sin(snappedAngle) * length,
            0
        ));
    }

    private applyLengthSnap(point: Vector3): Vector3 {
        if (this.inputPoints.length === 0) return point;
        
        const startPoint = this.inputPoints[this.inputPoints.length - 1].position;
        const direction = point.clone().sub(startPoint);
        const length = direction.length();
        
        if (length < 0.001) return point;
        
        // انجذاب لأقرب طول
        const increment = this.lineOptions.lengthIncrement || 1;
        const snappedLength = Math.round(length / increment) * increment;
        
        // حساب النقطة الجديدة
        return startPoint.clone().add(direction.normalize().multiplyScalar(snappedLength));
    }

    // ==================== دوال مساعدة ====================

    private setupLineSpecificOptions(): void {
        // إعداد خيارات خاصة بأداة الخط
        if (this.lineDrawMode === LineDrawMode.CONTINUOUS || 
            this.lineDrawMode === LineDrawMode.POLYLINE) {
            this.options.continuousMode = true;
            this.options.autoComplete = false;
        }
    }

    private applyLineProperties(line: Line): void {
        // تطبيق خصائص خاصة بحسب نوع الخط
        if (this.lineOptions.constructionLines && 
            this.lineDrawMode === LineDrawMode.CONSTRUCTION) {
            line.visualProperties = {
                ...line.visualProperties,
                color: '#888888',
                lineStyle: 'dashed',
                opacity: 0.5
            };
        }
        
        // إضافة معلومات إضافية
        line.setMetadata('drawMode', this.lineDrawMode);
        line.setMetadata('toolVersion', this.toolVersion);
        
        if (this.currentLineInfo) {
            line.setMetadata('lineInfo', this.currentLineInfo);
        }
    }

    private shouldShowHorizontalHelper(): boolean {
        return (this.lineOptions.constructionLines === true) && 
               !!this.currentLineInfo && 
               !this.currentLineInfo.isHorizontal &&
               Math.abs(this.currentLineInfo.angleDegrees) > 5;
    }

    private shouldShowVerticalHelper(): boolean {
        return (this.lineOptions.constructionLines === true) && 
               !!this.currentLineInfo && 
               !this.currentLineInfo.isVertical &&
               Math.abs(Math.abs(this.currentLineInfo.angleDegrees) - 90) > 5;
    }

    private shouldShowAngleHelper(): boolean {
        return (this.lineOptions.showAngle === true) && 
               !!this.currentLineInfo && 
               this.currentLineInfo.length > 0.5;
    }

    private clearHelperLines(): void {
        Object.values(this.helperLines).forEach(line => {
            if (line) {
                const index = this.previewObjects.indexOf(line);
                if (index !== -1) {
                    this.previewObjects.splice(index, 1);
                }
                this.emit('previewObjectRemoved', line);
            }
        });
        
        this.helperLines = {};
    }

    private formatLength(length: number): string {
        if (length < 0.01) return '0.00م';
        
        if (length < 1) {
            return `${(length * 100).toFixed(0)}سم`;
        } else if (length < 1000) {
            return `${length.toFixed(2)}م`;
        } else {
            return `${(length / 1000).toFixed(3)}كم`;
        }
    }

    private formatAngle(degrees: number): string {
        const normalized = ((degrees % 360) + 360) % 360;
        return `${normalized.toFixed(1)}°`;
    }

    // ==================== واجهة عامة ====================

    /**
     * تغيير نمط رسم الخط
     */
    public setLineDrawMode(mode: LineDrawMode): void {
        if (this.state === 'drawing') {
            this.logger.warn('لا يمكن تغيير نمط الرسم أثناء الرسم');
            return;
        }
        
        this.lineDrawMode = mode;
        this.setupLineSpecificOptions();
        this.resetTool();
        
        this.emit('drawModeChanged', { mode, toolId: this.toolId });
        this.logger.info(`تم تغيير نمط رسم الخط إلى: ${mode}`);
    }

    /**
     * الحصول على نمط الرسم الحالي
     */
    public getLineDrawMode(): LineDrawMode {
        return this.lineDrawMode;
    }

    /**
     * الحصول على معلومات الخط الحالي
     */
    public getCurrentLineInfo(): LineInfo | null {
        return this.currentLineInfo ? { ...this.currentLineInfo } : null;
    }

    /**
     * تفعيل/تعطيل الخطوط المساعدة
     */
    public setConstructionLinesEnabled(enabled: boolean): void {
        this.lineOptions.constructionLines = enabled;
        
        if (!enabled) {
            this.clearHelperLines();
        }
        
        this.emit('constructionLinesToggled', { enabled, toolId: this.toolId });
    }

    /**
     * تعيين زيادة الانجذاب الزاوي
     */
    public setAngleIncrement(degrees: number): void {
        this.lineOptions.angleIncrement = Math.max(1, Math.min(90, degrees));
        this.emit('angleIncrementChanged', { 
            increment: this.lineOptions.angleIncrement, 
            toolId: this.toolId 
        });
    }

    /**
     * تعيين زيادة الانجذاب للطول
     */
    public setLengthIncrement(length: number): void {
        this.lineOptions.lengthIncrement = Math.max(0.001, length);
        this.emit('lengthIncrementChanged', { 
            increment: this.lineOptions.lengthIncrement, 
            toolId: this.toolId 
        });
    }

    /**
     * ربط العارض لإضافة كائنات المعاينة
     */
    public setViewer(viewer: any): void {
        this.viewer = viewer;
    }

    /**
     * الحصول على إحصائيات مفصلة
     */
    public getDetailedStats(): any {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            lineDrawMode: this.lineDrawMode,
            totalLinesDrawn: baseStats.completionCount,
            averageLineLength: this.calculateAverageLineLength(),
            mostUsedAngles: this.getMostUsedAngles(),
            constructionLinesUsed: this.lineOptions.constructionLines
        };
    }

    private calculateAverageLineLength(): number {
        // حساب متوسط طول الخطوط المرسومة
        // TODO: تنفيذ حساب فعلي بناءً على التاريخ
        return 0;
    }

    private getMostUsedAngles(): number[] {
        // إرجاع الزوايا الأكثر استخداماً
        // TODO: تنفيذ تتبع فعلي للزوايا
        return [0, 45, 90, 135, 180];
    }

    /**
     * تنظيف محسن
     */
    public dispose(): void {
        this.clearPreview();
        this.clearHelperLines();
        
        // تنظيف المراجع
        this.previewLine = null;
        this.currentLineInfo = null;
        this.viewer = null;
        
        super.dispose();
    }

    /**
     * مسح المعاينة محسن
     */
    protected clearPreview(): void {
        super.clearPreview();
        this.clearHelperLines();
        
        if (this.previewLine) {
            this.emit('previewObjectRemoved', this.previewLine);
            this.previewLine = null;
        }
    }
}