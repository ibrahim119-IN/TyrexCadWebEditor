import { Vector3, Vector2 } from 'three';

// مجموعة من الدوال الرياضية المساعدة للمشروع
export class MathUtils {
    
    // تحويل من درجات إلى راديان
    static degToRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    // تحويل من راديان إلى درجات
    static radToDeg(radians: number): number {
        return radians * (180 / Math.PI);
    }

    // تطبيع الزاوية لتكون بين 0 و 360 درجة
    static normalizeAngleDegrees(degrees: number): number {
        let angle = degrees % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    // تطبيع الزاوية لتكون بين -180 و 180 درجة
    static normalizeAngleDegreesSymmetric(degrees: number): number {
        let angle = degrees % 360;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    }

    // حساب المسافة بين نقطتين في 2D
    static distance2D(p1: Vector2, p2: Vector2): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // حساب المسافة بين نقطتين في 3D
    static distance3D(p1: Vector3, p2: Vector3): number {
        return p1.distanceTo(p2);
    }

    // التحقق من تساوي رقمين مع هامش خطأ
    static approximatelyEqual(a: number, b: number, epsilon: number = 0.001): boolean {
        return Math.abs(a - b) < epsilon;
    }

    // تقييد قيمة بين حد أدنى وأعلى
    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    // التحقق من وقوع نقطة على خط مستقيم
    static isPointOnLine(
        point: Vector3,
        lineStart: Vector3,
        lineEnd: Vector3,
        tolerance: number = 0.1
    ): boolean {
        const d1 = point.distanceTo(lineStart);
        const d2 = point.distanceTo(lineEnd);
        const lineLength = lineStart.distanceTo(lineEnd);
        
        return Math.abs(d1 + d2 - lineLength) < tolerance;
    }

    // حساب أقرب نقطة على خط مستقيم من نقطة معينة
    static closestPointOnLine(
        point: Vector3,
        lineStart: Vector3,
        lineEnd: Vector3
    ): Vector3 {
        const lineVector = new Vector3().subVectors(lineEnd, lineStart);
        const pointVector = new Vector3().subVectors(point, lineStart);
        
        const lineLength = lineVector.length();
        if (lineLength === 0) return lineStart.clone();
        
        const lineDirection = lineVector.normalize();
        const projectionLength = pointVector.dot(lineDirection);
        
        // تقييد النقطة لتكون على الخط
        const t = MathUtils.clamp(projectionLength / lineLength, 0, 1);
        
        return new Vector3()
            .copy(lineStart)
            .add(lineVector.multiplyScalar(t));
    }

    // حساب مساحة مضلع من نقاطه
    static calculatePolygonArea(points: Vector3[]): number {
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

    // التحقق من تقاطع خطين
    static linesIntersect(
        line1Start: Vector2,
        line1End: Vector2,
        line2Start: Vector2,
        line2End: Vector2
    ): { intersects: boolean; point?: Vector2 } {
        const x1 = line1Start.x;
        const y1 = line1Start.y;
        const x2 = line1End.x;
        const y2 = line1End.y;
        const x3 = line2Start.x;
        const y3 = line2Start.y;
        const x4 = line2End.x;
        const y4 = line2End.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 0.0001) {
            return { intersects: false };
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectionX = x1 + t * (x2 - x1);
            const intersectionY = y1 + t * (y2 - y1);
            
            return {
                intersects: true,
                point: new Vector2(intersectionX, intersectionY)
            };
        }
        
        return { intersects: false };
    }

    // تقريب رقم لأقرب مضاعف
    static roundToNearest(value: number, nearest: number): number {
        return Math.round(value / nearest) * nearest;
    }

    // حساب الزاوية بين ثلاث نقاط
    static angleBetweenPoints(p1: Vector3, vertex: Vector3, p2: Vector3): number {
        const v1 = new Vector3().subVectors(p1, vertex).normalize();
        const v2 = new Vector3().subVectors(p2, vertex).normalize();
        
        const dot = v1.dot(v2);
        const angle = Math.acos(MathUtils.clamp(dot, -1, 1));
        
        return angle;
    }

    // التحقق من كون ثلاث نقاط على خط واحد
    static areCollinear(p1: Vector3, p2: Vector3, p3: Vector3, tolerance: number = 0.001): boolean {
        // حساب مساحة المثلث المكون من النقاط الثلاث
        const area = Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - 
            (p3.x - p1.x) * (p2.y - p1.y)
        ) / 2;
        
        return area < tolerance;
    }

    // إنشاء مصفوفة تحويل للدوران حول نقطة
    static createRotationMatrix(center: Vector3, angle: number): {
        rotate: (point: Vector3) => Vector3;
    } {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        return {
            rotate: (point: Vector3): Vector3 => {
                const translated = new Vector3(
                    point.x - center.x,
                    point.y - center.y,
                    point.z
                );
                
                const rotated = new Vector3(
                    translated.x * cos - translated.y * sin,
                    translated.x * sin + translated.y * cos,
                    translated.z
                );
                
                return new Vector3(
                    rotated.x + center.x,
                    rotated.y + center.y,
                    rotated.z
                );
            }
        };
    }
}