/**
 * Circle - فئة تمثل دائرة في الفضاء ثلاثي الأبعاد
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle, OCPointHandle } from '../core/GeometryEngine';

export class Circle extends GeometricObject {
    private _center: Point3D;
    private _radius: number;
    private _normal: Point3D;
    
    private _centerHandle: OCPointHandle | null = null;
    private _normalHandle: OCPointHandle | null = null;

    constructor(center: Point3D, radius: number, normal: Point3D = { x: 0, y: 0, z: 1 }) {
        super(GeometricObjectType.CIRCLE);
        
        this._center = { ...center };
        this._radius = Math.abs(radius);
        this._normal = { ...normal };
        
        if (this._radius < 0.001) {
            throw new Error('نصف قطر الدائرة يجب أن يكون أكبر من 0.001');
        }
        
        this.logger.info(`تم إنشاء دائرة - المركز: (${center.x}, ${center.y}, ${center.z}), نصف القطر: ${radius}`);
    }

    protected createOCShape(): OCShapeHandle {
        try {
            if (!this._centerHandle) {
                this._centerHandle = this.geometryEngine.createPoint(
                    this._center.x,
                    this._center.y,
                    this._center.z
                );
            }
            
            if (!this._normalHandle) {
                this._normalHandle = this.geometryEngine.createPoint(
                    this._normal.x,
                    this._normal.y,
                    this._normal.z
                );
            }
            
            const circleHandle = this.geometryEngine.createCircle(
                this._centerHandle,
                this._normalHandle,
                this._radius
            );
            
            this.logger.debug(`تم إنشاء دائرة في OpenCASCADE - Handle: ${circleHandle}`);
            return circleHandle;
            
        } catch (error) {
            this.logger.error(`فشل إنشاء الدائرة في OpenCASCADE`, error);
            throw error;
        }
    }

    protected updateOCShape(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
        
        if (this._centerHandle) {
            this.geometryEngine.deleteShape(this._centerHandle);
            this._centerHandle = null;
        }
        
        if (this._normalHandle) {
            this.geometryEngine.deleteShape(this._normalHandle);
            this._normalHandle = null;
        }
        
        this.logger.debug(`تم تحديث الدائرة ${this._id}`);
    }

    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: this._center.x - this._radius,
                y: this._center.y - this._radius,
                z: this._center.z - this._radius
            },
            max: {
                x: this._center.x + this._radius,
                y: this._center.y + this._radius,
                z: this._center.z + this._radius
            }
        };
    }

    public clone(): Circle {
        const clonedCircle = new Circle(this._center, this._radius, this._normal);
        
        clonedCircle._layerId = this._layerId;
        clonedCircle._visible = this._visible;
        clonedCircle._locked = this._locked;
        clonedCircle._visualProperties = { ...this._visualProperties };
        clonedCircle._transform = {
            translation: { ...this._transform.translation },
            rotation: { ...this._transform.rotation },
            scale: { ...this._transform.scale }
        };
        
        return clonedCircle;
    }

    // خصائص الدائرة
    public get center(): Point3D { 
        return { ...this._center }; 
    }
    
    public set center(value: Point3D) {
        this._center = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get radius(): number { 
        return this._radius; 
    }
    
    public set radius(value: number) {
        if (value < 0.001) {
            throw new Error('نصف قطر الدائرة يجب أن يكون أكبر من 0.001');
        }
        this._radius = value;
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get normal(): Point3D { 
        return { ...this._normal }; 
    }
    
    public set normal(value: Point3D) {
        this._normal = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }

    // حسابات الدائرة
    public get diameter(): number {
        return this._radius * 2;
    }

    public get circumference(): number {
        return 2 * Math.PI * this._radius;
    }

    public get area(): number {
        return Math.PI * this._radius * this._radius;
    }

    // التحقق من وقوع نقطة على الدائرة
    public isPointOnCircle(point: Point3D, tolerance: number = 0.001): boolean {
        const distance = Math.sqrt(
            Math.pow(point.x - this._center.x, 2) +
            Math.pow(point.y - this._center.y, 2) +
            Math.pow(point.z - this._center.z, 2)
        );
        
        return Math.abs(distance - this._radius) < tolerance;
    }

    // الحصول على نقطة على الدائرة بزاوية معينة
    public getPointAtAngle(angleRadians: number): Point3D {
        // للدوائر في المستوى XY
        return {
            x: this._center.x + this._radius * Math.cos(angleRadians),
            y: this._center.y + this._radius * Math.sin(angleRadians),
            z: this._center.z
        };
    }

    // الحصول على أقرب نقطة على الدائرة
    public getClosestPoint(point: Point3D): Point3D {
        const dx = point.x - this._center.x;
        const dy = point.y - this._center.y;
        const dz = point.z - this._center.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance === 0) {
            // النقطة في المركز، إرجاع أي نقطة على الدائرة
            return this.getPointAtAngle(0);
        }
        
        const scale = this._radius / distance;
        
        return {
            x: this._center.x + dx * scale,
            y: this._center.y + dy * scale,
            z: this._center.z + dz * scale
        };
    }

    public toJSON(): object {
        const baseJSON = super.toJSON();
        
        return {
            ...baseJSON,
            center: { ...this._center },
            radius: this._radius,
            normal: { ...this._normal },
            diameter: this.diameter,
            area: this.area,
            circumference: this.circumference
        };
    }

    public fromJSON(data: any): void {
        super.fromJSON(data);
        
        if (data.center) {
            this._center = { ...data.center };
        }
        
        if (data.radius !== undefined) {
            this._radius = data.radius;
        }
        
        if (data.normal) {
            this._normal = { ...data.normal };
        }
        
        this._centerHandle = null;
        this._normalHandle = null;
        this._ocHandle = null;
    }

    public static fromJSON(data: any): Circle {
        const circle = new Circle(
            data.center || { x: 0, y: 0, z: 0 },
            data.radius || 1,
            data.normal || { x: 0, y: 0, z: 1 }
        );
        
        circle.fromJSON(data);
        return circle;
    }
}