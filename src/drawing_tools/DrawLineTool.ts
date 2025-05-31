/**
 * DrawLineTool - أداة رسم الخطوط المستقيمة
 * 
 * تسمح للمستخدم برسم خطوط مستقيمة بين نقطتين
 */

import { Vector3 } from 'three';
import { AbstractDrawTool, DrawToolOptions, DrawToolState } from './AbstractDrawTool';
import { GeometryEngine } from '../core/GeometryEngine';
import { CommandManager } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Line } from '../models/Line';

/**
 * أداة رسم الخط
 */
export class DrawLineTool extends AbstractDrawTool {
    private previewLine: any = null;

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: DrawToolOptions = {}
    ) {
        super(
            'draw-line',
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
    }

    /**
     * عدد النقاط المطلوبة لرسم خط
     */
    protected getRequiredPointCount(): number {
        return 2;
    }

    /**
     * التحقق من صحة النقاط المدخلة
     */
    protected validatePoints(): boolean {
        if (this.points.length < 2) {
            return false;
        }

        const [start, end] = this.points;
        
        // التأكد من أن النقطتين مختلفتان
        const distance = start.distanceTo(end);
        if (distance < 0.001) {
            this.logger.warn('نقطتا البداية والنهاية متطابقتان');
            return false;
        }

        return true;
    }

    /**
     * إنشاء الكائن الهندسي للخط
     */
    protected createGeometry(): Line | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            const [start, end] = this.points;
            
            const line = new Line(
                { x: start.x, y: start.y, z: start.z },
                { x: end.x, y: end.y, z: end.z }
            );

            this.logger.info(`تم إنشاء خط من (${start.x}, ${start.y}) إلى (${end.x}, ${end.y})`);
            
            return line;
            
        } catch (error) {
            this.logger.error('فشل إنشاء الخط:', error);
            return null;
        }
    }

    /**
     * تحديث معاينة الخط أثناء الرسم
     */
    protected updatePreview(): void {
        if (!this.currentPoint || this.points.length === 0) {
            this.clearPreview();
            return;
        }

        try {
            const startPoint = this.points[0];
            
            // إنشاء خط معاينة مؤقت
            // TODO: تكامل مع نظام العرض لإظهار خط المعاينة
            this.previewLine = {
                start: startPoint,
                end: this.currentPoint,
                isPreview: true
            };

            this.emit('previewUpdated', {
                start: startPoint,
                end: this.currentPoint,
                length: startPoint.distanceTo(this.currentPoint)
            });

        } catch (error) {
            this.logger.error('فشل تحديث معاينة الخط:', error);
        }
    }

    /**
     * اسم الأداة
     */
    protected getToolName(): string {
        return 'خط مستقيم';
    }

    /**
     * مسح المعاينة
     */
    protected clearPreview(): void {
        this.previewLine = null;
        this.emit('previewCleared', {});
    }

    /**
     * معالج خاص لنقرة الماوس الثانية (لإكمال الخط)
     */
    public onMouseClick(point: Vector3, existingObjects: any[] = []) {
        const result = super.onMouseClick(point, existingObjects);
        
        // إذا كانت هذه النقطة الثانية، أكمل الخط تلقائياً
        if (result.success && this.points.length === 2 && this.options.autoComplete) {
            return this.completeDraw();
        }
        
        return result;
    }

    /**
     * الحصول على معلومات الخط المعاين
     */
    public getPreviewInfo(): {
        hasPreview: boolean;
        length?: number;
        angle?: number;
        start?: Vector3;
        end?: Vector3;
    } {
        if (!this.previewLine || this.points.length === 0 || !this.currentPoint) {
            return { hasPreview: false };
        }

        const start = this.points[0];
        const end = this.currentPoint;
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);

        return {
            hasPreview: true,
            length,
            angle,
            start: start.clone(),
            end: end.clone()
        };
    }

    /**
     * تعيين نقطة البداية مباشرة (للاستخدام البرمجي)
     */
    public setStartPoint(point: Vector3): void {
        if (this.state === DrawToolState.ACTIVE) {
            this.points = [point];
            this.state = DrawToolState.DRAWING;
            this.emit('pointAdded', { point, pointIndex: 0 });
        }
    }

    /**
     * الحصول على معلومات مفصلة عن الخط الحالي
     */
    public getCurrentLineInfo(): {
        pointCount: number;
        startPoint?: Vector3;
        currentPoint?: Vector3;
        length?: number;
        angle?: number;
        isValid: boolean;
    } {
        const info: any = {
            pointCount: this.points.length,
            isValid: false
        };

        if (this.points.length > 0) {
            info.startPoint = this.points[0].clone();
        }

        if (this.currentPoint) {
            info.currentPoint = this.currentPoint.clone();
        }

        if (this.points.length > 0 && this.currentPoint) {
            const start = this.points[0];
            const end = this.currentPoint;
            info.length = start.distanceTo(end);
            info.angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
            info.isValid = info.length > 0.001;
        }

        return info;
    }
}