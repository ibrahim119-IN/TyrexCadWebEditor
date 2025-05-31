import { Vector3 } from 'three';
import { Wall } from '../models/Wall';
import { Constants } from '../core/Constants';

// نتيجة عملية الانجذاب
export interface SnapResult {
    point: Vector3;          // النقطة بعد الانجذاب
    snapped: boolean;        // هل تم الانجذاب؟
    type?: SnapType;         // نوع الانجذاب
    target?: Wall | Vector3; // الهدف الذي تم الانجذاب إليه
}

// أنواع الانجذاب المختلفة
export enum SnapType {
    GRID = 'grid',           // انجذاب للشبكة
    ENDPOINT = 'endpoint',   // انجذاب لنهاية جدار
    MIDPOINT = 'midpoint',   // انجذاب لمنتصف جدار
    PERPENDICULAR = 'perpendicular', // انجذاب عمودي
    ANGLE = 'angle'          // انجذاب زاوي
}

// نظام الانجذاب الذكي للمساعدة في الرسم الدقيق
export class SnapSystem {
    private gridSize: number = Constants.GRID.DEFAULT_SIZE;
    private gridEnabled: boolean = true;
    private angleSnapEnabled: boolean = true;
    private endpointSnapEnabled: boolean = true;

    constructor() {}

    // تحديث حجم الشبكة
    setGridSize(size: number): void {
        this.gridSize = Math.max(
            Constants.GRID.MIN_SIZE,
            Math.min(Constants.GRID.MAX_SIZE, size)
        );
    }

    // تفعيل/تعطيل الانجذاب للشبكة
    setGridEnabled(enabled: boolean): void {
        this.gridEnabled = enabled;
    }

    // تفعيل/تعطيل الانجذاب الزاوي
    setAngleSnapEnabled(enabled: boolean): void {
        this.angleSnapEnabled = enabled;
    }

    // الدالة الرئيسية للانجذاب
    snap(
        point: Vector3,
        walls: Wall[] = [],
        currentStartPoint?: Vector3
    ): SnapResult {
        let result: SnapResult = {
            point: point.clone(),
            snapped: false
        };

        // أولوية الانجذاب: نقاط النهاية > نقاط المنتصف > الشبكة > الزوايا
        
        // 1. محاولة الانجذاب لنقاط النهاية أو المنتصف
        if (this.endpointSnapEnabled && walls.length > 0) {
            const endpointSnap = this.snapToWallPoints(point, walls);
            if (endpointSnap.snapped) {
                return endpointSnap;
            }
        }

        // 2. محاولة الانجذاب الزاوي (إذا كنا نرسم جدار)
        if (this.angleSnapEnabled && currentStartPoint) {
            const angleSnap = this.snapToAngle(point, currentStartPoint);
            if (angleSnap.snapped) {
                result = angleSnap;
            }
        }

        // 3. الانجذاب للشبكة (إذا لم يتم انجذاب زاوي أو كان أقرب)
        if (this.gridEnabled) {
            const gridSnap = this.snapToGrid(point);
            if (!result.snapped || 
                point.distanceTo(gridSnap.point) < point.distanceTo(result.point)) {
                result = gridSnap;
            }
        }

        return result;
    }

    // انجذاب للشبكة
    private snapToGrid(point: Vector3): SnapResult {
        const snappedPoint = new Vector3(
            Math.round(point.x / this.gridSize) * this.gridSize,
            Math.round(point.y / this.gridSize) * this.gridSize,
            point.z
        );

        return {
            point: snappedPoint,
            snapped: true,
            type: SnapType.GRID
        };
    }

    // انجذاب لنقاط الجدران (نهايات ومنتصفات)
    private snapToWallPoints(point: Vector3, walls: Wall[]): SnapResult {
        const snapDistance = Constants.SNAP.ENDPOINT_SNAP_DISTANCE;
        let closestPoint: Vector3 | null = null;
        let closestDistance = snapDistance;
        let snapType: SnapType = SnapType.ENDPOINT;

        for (const wall of walls) {
            // فحص نقطة البداية
            const startDist = point.distanceTo(wall.start);
            if (startDist < closestDistance) {
                closestDistance = startDist;
                closestPoint = wall.start;
                snapType = SnapType.ENDPOINT;
            }

            // فحص نقطة النهاية
            const endDist = point.distanceTo(wall.end);
            if (endDist < closestDistance) {
                closestDistance = endDist;
                closestPoint = wall.end;
                snapType = SnapType.ENDPOINT;
            }

            // فحص نقطة المنتصف
            const midPoint = wall.midPoint;
            const midDist = point.distanceTo(midPoint);
            if (midDist < closestDistance) {
                closestDistance = midDist;
                closestPoint = midPoint;
                snapType = SnapType.MIDPOINT;
            }
        }

        if (closestPoint) {
            return {
                point: closestPoint.clone(),
                snapped: true,
                type: snapType
            };
        }

        return {
            point: point.clone(),
            snapped: false
        };
    }

    // انجذاب زاوي (للحصول على زوايا محددة مثل 45°، 90°)
    private snapToAngle(point: Vector3, startPoint: Vector3): SnapResult {
        const vector = new Vector3().subVectors(point, startPoint);
        const distance = vector.length();
        
        if (distance < 0.1) {
            return { point: point.clone(), snapped: false };
        }

        // حساب الزاوية الحالية
        const currentAngle = Math.atan2(vector.y, vector.x);
        const currentAngleDegrees = (currentAngle * 180) / Math.PI;

        // البحث عن أقرب زاوية من الزوايا المحددة
        const snapAngles = Constants.SNAP.ANGLE_SNAP_DEGREES;
        const tolerance = Constants.SNAP.ANGLE_TOLERANCE;
        
        for (const targetAngle of snapAngles) {
            const diff = Math.abs(this.normalizeAngle(currentAngleDegrees - targetAngle));
            
            if (diff < tolerance) {
                // حساب النقطة الجديدة بالزاوية المنجذبة
                const targetAngleRad = (targetAngle * Math.PI) / 180;
                const snappedPoint = new Vector3(
                    startPoint.x + Math.cos(targetAngleRad) * distance,
                    startPoint.y + Math.sin(targetAngleRad) * distance,
                    point.z
                );

                return {
                    point: snappedPoint,
                    snapped: true,
                    type: SnapType.ANGLE
                };
            }
        }

        return { point: point.clone(), snapped: false };
    }

    // تطبيع الزاوية لتكون بين -180 و 180
    private normalizeAngle(angle: number): number {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    // الحصول على معلومات الانجذاب كنص
    getSnapInfo(snapResult: SnapResult): string {
        if (!snapResult.snapped) return '';

        switch (snapResult.type) {
            case SnapType.GRID:
                return `Grid (${this.gridSize}m)`;
            case SnapType.ENDPOINT:
                return 'Endpoint';
            case SnapType.MIDPOINT:
                return 'Midpoint';
            case SnapType.ANGLE:
                return 'Angle Snap';
            case SnapType.PERPENDICULAR:
                return 'Perpendicular';
            default:
                return 'Snapped';
        }
    }
}