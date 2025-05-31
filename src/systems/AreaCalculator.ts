import { Vector3 } from 'three';
import { Wall } from '../models/Wall';

export interface AreaInfo {
    area: number;
    perimeter: number;
    wallCount: number;
    isEnclosed: boolean;
}

export class AreaCalculator {
    
    // حساب معلومات المساحة من مجموعة جدران
    static calculateAreaInfo(walls: Wall[]): AreaInfo {
        if (walls.length < 3) {
            return { area: 0, perimeter: 0, wallCount: walls.length, isEnclosed: false };
        }

        // حساب المحيط
        const perimeter = walls.reduce((sum, wall) => sum + wall.length, 0);

        // فحص إذا كانت الجدران تشكل شكل مغلق
        const isEnclosed = this.checkIfEnclosed(walls);

        // حساب المساحة إذا كان الشكل مغلق
        let area = 0;
        if (isEnclosed) {
            const points = this.getOrderedPoints(walls);
            area = this.calculatePolygonArea(points);
        }

        return { area, perimeter, wallCount: walls.length, isEnclosed };
    }

    // فحص إذا كانت الجدران تشكل شكل مغلق
    private static checkIfEnclosed(walls: Wall[]): boolean {
        if (walls.length < 3) return false;

        // إنشاء خريطة للنقاط وعدد الاتصالات
        const pointConnections = new Map<string, number>();

        walls.forEach(wall => {
            const startKey = this.pointToKey(wall.start);
            const endKey = this.pointToKey(wall.end);

            pointConnections.set(startKey, (pointConnections.get(startKey) || 0) + 1);
            pointConnections.set(endKey, (pointConnections.get(endKey) || 0) + 1);
        });

        // في الشكل المغلق، كل نقطة يجب أن تكون متصلة بجدارين بالضبط
        for (const connections of pointConnections.values()) {
            if (connections !== 2) return false;
        }

        return true;
    }

    // الحصول على النقاط مرتبة لحساب المساحة
    private static getOrderedPoints(walls: Wall[]): Vector3[] {
        if (walls.length === 0) return [];

        const points: Vector3[] = [];
        const usedWalls = new Set<Wall>();
        const wallMap = new Map<string, Wall[]>();

        // بناء خريطة الاتصالات
        walls.forEach(wall => {
            const startKey = this.pointToKey(wall.start);
            const endKey = this.pointToKey(wall.end);

            if (!wallMap.has(startKey)) wallMap.set(startKey, []);
            if (!wallMap.has(endKey)) wallMap.set(endKey, []);

            wallMap.get(startKey)!.push(wall);
            wallMap.get(endKey)!.push(wall);
        });

        // البدء من أول جدار
        let currentWall = walls[0];
        let currentPoint = currentWall.start;
        points.push(currentPoint);
        usedWalls.add(currentWall);

        // تتبع الجدران لبناء المضلع
        while (usedWalls.size < walls.length) {
            const nextPoint = currentWall.start.equals(currentPoint) ? currentWall.end : currentWall.start;
            points.push(nextPoint);

            const nextPointKey = this.pointToKey(nextPoint);
            const connectedWalls = wallMap.get(nextPointKey) || [];
            
            const nextWall = connectedWalls.find(w => !usedWalls.has(w));
            if (!nextWall) break;

            currentWall = nextWall;
            currentPoint = nextPoint;
            usedWalls.add(currentWall);
        }

        return points;
    }

    // حساب مساحة المضلع باستخدام صيغة Shoelace
    private static calculatePolygonArea(points: Vector3[]): number {
        if (points.length < 3) return 0;

        let area = 0;
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        return Math.abs(area) / 2;
    }

    // تحويل نقطة إلى مفتاح نصي للمقارنة
    private static pointToKey(point: Vector3): string {
        const precision = 3; // دقة المقارنة
        return `${point.x.toFixed(precision)},${point.y.toFixed(precision)}`;
    }

    // تنسيق المساحة للعرض
    static formatArea(area: number): string {
        return `${area.toFixed(2)} m²`;
    }

    // تنسيق المحيط للعرض
    static formatPerimeter(perimeter: number): string {
        return `${perimeter.toFixed(2)} m`;
    }
}