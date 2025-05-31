import { Vector3 } from 'three';

// نموذج يمثل جدار في المشروع
export class Wall {
    private _id: string;
    private _start: Vector3;
    private _end: Vector3;
    private _height: number;
    private _thickness: number;
    private _selected: boolean = false;
    private _highlighted: boolean = false;

    constructor(
        start: Vector3,
        end: Vector3,
        height: number = 3,
        thickness: number = 0.2
    ) {
        // توليد معرف فريد للجدار
        this._id = `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this._start = start.clone();
        this._end = end.clone();
        this._height = height;
        this._thickness = thickness;
    }

    // Getters
    get id(): string { return this._id; }
    get start(): Vector3 { return this._start.clone(); }
    get end(): Vector3 { return this._end.clone(); }
    get height(): number { return this._height; }
    get thickness(): number { return this._thickness; }
    get selected(): boolean { return this._selected; }
    get highlighted(): boolean { return this._highlighted; }

    // Setters
    set selected(value: boolean) { this._selected = value; }
    set highlighted(value: boolean) { this._highlighted = value; }

    // حساب طول الجدار
    get length(): number {
        return this._start.distanceTo(this._end);
    }

    // حساب زاوية الجدار بالراديان
    get angle(): number {
        return Math.atan2(
            this._end.y - this._start.y,
            this._end.x - this._start.x
        );
    }

    // حساب زاوية الجدار بالدرجات
    get angleDegrees(): number {
        return (this.angle * 180) / Math.PI;
    }

    // الحصول على نقطة المنتصف
    get midPoint(): Vector3 {
        return new Vector3().addVectors(this._start, this._end).multiplyScalar(0.5);
    }

    // الحصول على متجه الاتجاه
    get direction(): Vector3 {
        return new Vector3()
            .subVectors(this._end, this._start)
            .normalize();
    }

    // الحصول على متجه عمودي على الجدار
    get normal(): Vector3 {
        const dir = this.direction;
        return new Vector3(-dir.y, dir.x, 0).normalize();
    }

    // تحديث نقطة البداية
    updateStart(point: Vector3): void {
        this._start = point.clone();
    }

    // تحديث نقطة النهاية
    updateEnd(point: Vector3): void {
        this._end = point.clone();
    }

    // التحقق من تقاطع الجدار مع نقطة (مع مسافة تسامح)
    isPointNear(point: Vector3, tolerance: number = 0.5): boolean {
        const distToStart = point.distanceTo(this._start);
        const distToEnd = point.distanceTo(this._end);
        const wallLength = this.length;

        // التحقق من القرب من نقاط النهاية
        if (distToStart < tolerance || distToEnd < tolerance) {
            return true;
        }

        // التحقق من القرب من خط الجدار
        const totalDist = distToStart + distToEnd;
        return Math.abs(totalDist - wallLength) < tolerance;
    }

    // الحصول على أقرب نقطة على الجدار من نقطة معينة
    getClosestPoint(point: Vector3): Vector3 {
        const wallVector = new Vector3().subVectors(this._end, this._start);
        const pointVector = new Vector3().subVectors(point, this._start);
        
        const wallLengthSquared = wallVector.lengthSq();
        if (wallLengthSquared === 0) return this._start.clone();
        
        const t = Math.max(0, Math.min(1, pointVector.dot(wallVector) / wallLengthSquared));
        
        return new Vector3()
            .copy(this._start)
            .add(wallVector.multiplyScalar(t));
    }

    // استنساخ الجدار
    clone(): Wall {
        const cloned = new Wall(this._start, this._end, this._height, this._thickness);
        cloned._selected = this._selected;
        cloned._highlighted = this._highlighted;
        return cloned;
    }

    // تحويل إلى كائن JSON
    toJSON(): object {
        return {
            id: this._id,
            start: { x: this._start.x, y: this._start.y, z: this._start.z },
            end: { x: this._end.x, y: this._end.y, z: this._end.z },
            height: this._height,
            thickness: this._thickness
        };
    }

    // إنشاء من كائن JSON
    static fromJSON(data: any): Wall {
        const start = new Vector3(data.start.x, data.start.y, data.start.z);
        const end = new Vector3(data.end.x, data.end.y, data.end.z);
        return new Wall(start, end, data.height, data.thickness);
    }
}