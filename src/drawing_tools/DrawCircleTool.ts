/**
 * DrawCircleTool - أداة رسم الدوائر
 * 
 * تسمح للمستخدم برسم دوائر عن طريق تحديد المركز ونقطة على المحيط
 */

import { Vector3 } from 'three';
import { AbstractDrawTool, DrawToolOptions } from './AbstractDrawTool';
import { GeometryEngine } from '../core/GeometryEngine';
import { CommandManager } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Circle } from '../models/Circle';

export enum CircleDrawMode {
    CENTER_RADIUS = 'center-radius',    // مركز + نقطة على المحيط
    TWO_POINTS = 'two-points',          // نقطتان على القطر
    THREE_POINTS = 'three-points'       // ثلاث نقاط على المحيط
}

/**
 * أداة رسم الدائرة
 */
export class DrawCircleTool extends AbstractDrawTool {
    private drawMode: CircleDrawMode = CircleDrawMode.CENTER_RADIUS;
    private previewCircle: any = null;

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: DrawToolOptions = {},
        mode: CircleDrawMode = CircleDrawMode.CENTER_RADIUS
    ) {
        super(
            'draw-circle',
            geometryEngine,
            commandManager,
            snapSystem,
            measurementSystem,
            {
                snapEnabled: true,
                measurementEnabled: true,
                previewEnabled: true,
                autoComplete: true,
                ...options
            }
        );

        this.drawMode = mode;
    }

    /**
     * عدد النقاط المطلوبة حسب نمط الرسم
     */
    protected getRequiredPointCount(): number {
        switch (this.drawMode) {
            case CircleDrawMode.CENTER_RADIUS:
                return 2;
            case CircleDrawMode.TWO_POINTS:
                return 2;
            case CircleDrawMode.THREE_POINTS:
                return 3;
            default:
                return 2;
        }
    }

    /**
     * التحقق من صحة النقاط المدخلة
     */
    protected validatePoints(): boolean {
        const requiredPoints = this.getRequiredPointCount();
        
        if (this.points.length < requiredPoints) {
            return false;
        }

        switch (this.drawMode) {
            case CircleDrawMode.CENTER_RADIUS:
                return this.validateCenterRadius();
            case CircleDrawMode.TWO_POINTS:
                return this.validateTwoPoints();
            case CircleDrawMode.THREE_POINTS:
                return this.validateThreePoints();
            default:
                return false;
        }
    }

    /**
     * التحقق من صحة نمط المركز + نصف القطر
     */
    private validateCenterRadius(): boolean {
        if (this.points.length < 2) return false;
        
        const [center, radiusPoint] = this.points;
        const radius = center.distanceTo(radiusPoint);
        
        if (radius < 0.001) {
            this.logger.warn('نصف قطر الدائرة صغير جداً');
            return false;
        }

        return true;
    }

    /**
     * التحقق من صحة نمط النقطتين
     */
    private validateTwoPoints(): boolean {
        if (this.points.length < 2) return false;
        
        const [p1, p2] = this.points;
        const diameter = p1.distanceTo(p2);
        
        if (diameter < 0.002) {
            this.logger.warn('قطر الدائرة صغير جداً');
            return false;
        }

        return true;
    }

    /**
     * التحقق من صحة نمط النقاط الثلاث
     */
    private validateThreePoints(): boolean {
        if (this.points.length < 3) return false;
        
        const [p1, p2, p3] = this.points;
        
        // التحقق من عدم وقوع النقاط على خط واحد
        const area = this.calculateTriangleArea(p1, p2, p3);
        if (Math.abs(area) < 0.001) {
            this.logger.warn('النقاط الثلاث تقع على خط واحد');
            return false;
        }

        return true;
    }

    /**
     * حساب مساحة المثلث للتحقق من عدم الخطية
     */
    private calculateTriangleArea(p1: Vector3, p2: Vector3, p3: Vector3): number {
        return 0.5 * Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - 
            (p3.x - p1.x) * (p2.y - p1.y)
        );
    }

    /**
     * إنشاء الكائن الهندسي للدائرة
     */
    protected createGeometry(): Circle | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            let center: Vector3;
            let radius: number;

            switch (this.drawMode) {
                case CircleDrawMode.CENTER_RADIUS:
                    center = this.points[0];
                    radius = center.distanceTo(this.points[1]);
                    break;

                case CircleDrawMode.TWO_POINTS:
                    const [p1, p2] = this.points;
                    center = new Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                    radius = p1.distanceTo(p2) / 2;
                    break;

                case CircleDrawMode.THREE_POINTS:
                    const circleInfo = this.calculateCircleFromThreePoints();
                    if (!circleInfo) return null;
                    center = circleInfo.center;
                    radius = circleInfo.radius;
                    break;

                default:
                    throw new Error('نمط رسم غير مدعوم');
            }

            // إنشاء كائن الدائرة
            const circle = new Circle(
                { x: center.x, y: center.y, z: center.z },
                radius
            );

            this.logger.info(`تم إنشاء دائرة - المركز: (${center.x}, ${center.y}), نصف القطر: ${radius}`);
            
            return circle;
            
        } catch (error) {
            this.logger.error('فشل إنشاء الدائرة:', error);
            return null;
        }
    }

    /**
     * حساب مركز ونصف قطر الدائرة من ثلاث نقاط
     */
    private calculateCircleFromThreePoints(): { center: Vector3; radius: number } | null {
        const [p1, p2, p3] = this.points;

        // حساب مركز الدائرة المارة بالنقاط الثلاث
        const ax = p1.x; const ay = p1.y;
        const bx = p2.x; const by = p2.y;
        const cx = p3.x; const cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        
        if (Math.abs(d) < 0.001) {
            return null; // النقاط متخطة
        }

        const ux = ((ax * ax + ay * ay) * (by - cy) + 
                    (bx * bx + by * by) * (cy - ay) + 
                    (cx * cx + cy * cy) * (ay - by)) / d;
        
        const uy = ((ax * ax + ay * ay) * (cx - bx) + 
                    (bx * bx + by * by) * (ax - cx) + 
                    (cx * cx + cy * cy) * (bx - ax)) / d;

        const center = new Vector3(ux, uy, p1.z);
        const radius = center.distanceTo(p1);

        return { center, radius };
    }

    /**
     * تحديث معاينة الدائرة أثناء الرسم
     */
    protected updatePreview(): void {
        if (!this.currentPoint || this.points.length === 0) {
            this.clearPreview();
            return;
        }

        try {
            let center: Vector3;
            let radius: number;

            switch (this.drawMode) {
                case CircleDrawMode.CENTER_RADIUS:
                    center = this.points[0];
                    radius = center.distanceTo(this.currentPoint);
                    break;

                case CircleDrawMode.TWO_POINTS:
                    center = new Vector3().addVectors(this.points[0], this.currentPoint).multiplyScalar(0.5);
                    radius = this.points[0].distanceTo(this.currentPoint) / 2;
                    break;

                case CircleDrawMode.THREE_POINTS:
                    if (this.points.length < 2) return;
                    // للمعاينة، نستخدم دائرة مؤقتة
                    center = this.points[0];
                    radius = center.distanceTo(this.currentPoint);
                    break;

                default:
                    return;
            }

            this.previewCircle = {
                center,
                radius,
                isPreview: true
            };

            this.emit('previewUpdated', {
                center,
                radius,
                diameter: radius * 2,
                circumference: 2 * Math.PI * radius,
                area: Math.PI * radius * radius
            });

        } catch (error) {
            this.logger.error('فشل تحديث معاينة الدائرة:', error);
        }
    }

    /**
     * اسم الأداة
     */
    protected getToolName(): string {
        switch (this.drawMode) {
            case CircleDrawMode.CENTER_RADIUS:
                return 'دائرة (مركز + نصف قطر)';
            case CircleDrawMode.TWO_POINTS:
                return 'دائرة (نقطتان)';
            case CircleDrawMode.THREE_POINTS:
                return 'دائرة (ثلاث نقاط)';
            default:
                return 'دائرة';
        }
    }

    /**
     * مسح المعاينة
     */
    protected clearPreview(): void {
        this.previewCircle = null;
        this.emit('previewCleared', {});
    }

    /**
     * تغيير نمط الرسم
     */
    public setDrawMode(mode: CircleDrawMode): void {
        if (this.state === 'drawing') {
            this.logger.warn('لا يمكن تغيير نمط الرسم أثناء الرسم');
            return;
        }

        this.drawMode = mode;
        this.resetTool();
        this.logger.info(`تم تغيير نمط رسم الدائرة إلى: ${mode}`);
    }

    /**
     * الحصول على معلومات الدائرة المعاينة
     */
    public getPreviewInfo(): {
        hasPreview: boolean;
        center?: Vector3;
        radius?: number;
        diameter?: number;
        area?: number;
        circumference?: number;
    } {
        if (!this.previewCircle) {
            return { hasPreview: false };
        }

        const { center, radius } = this.previewCircle;

        return {
            hasPreview: true,
            center: center.clone(),
            radius,
            diameter: radius * 2,
            area: Math.PI * radius * radius,
            circumference: 2 * Math.PI * radius
        };
    }

    /**
     * الحصول على نمط الرسم الحالي
     */
    public getDrawMode(): CircleDrawMode {
        return this.drawMode;
    }
}