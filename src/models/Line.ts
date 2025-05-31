/**
 * Line - فئة تمثل خطاً مستقيماً في الفضاء ثلاثي الأبعاد
 * 
 * هذه الفئة ترث من GeometricObject وتنفذ جميع الدوال المجردة
 * لتمثيل خط بسيط بين نقطتين
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle, OCPointHandle } from '../core/GeometryEngine';

/**
 * فئة Line - تمثل خطاً مستقيماً
 */
export class Line extends GeometricObject {
    // نقطة البداية
    private _startPoint: Point3D;
    
    // نقطة النهاية
    private _endPoint: Point3D;
    
    // معرفات النقاط في OpenCASCADE (للأداء)
    private _startPointHandle: OCPointHandle | null = null;
    private _endPointHandle: OCPointHandle | null = null;

    /**
     * المُنشئ - ينشئ خطاً بين نقطتين
     */
    constructor(startPoint: Point3D, endPoint: Point3D) {
        super(GeometricObjectType.LINE);
        
        this._startPoint = { ...startPoint };
        this._endPoint = { ...endPoint };
        
        this.logger.info(`تم إنشاء خط من (${startPoint.x}, ${startPoint.y}, ${startPoint.z}) إلى (${endPoint.x}, ${endPoint.y}, ${endPoint.z})`);
    }

    /**
     * إنشاء الشكل الهندسي في OpenCASCADE
     * هذه الدالة تُستدعى عند الحاجة الأولى للشكل
     */
    protected createOCShape(): OCShapeHandle {
        try {
            // إنشاء النقاط في OpenCASCADE إذا لم تكن موجودة
            if (!this._startPointHandle) {
                this._startPointHandle = this.geometryEngine.createPoint(
                    this._startPoint.x,
                    this._startPoint.y,
                    this._startPoint.z
                );
            }
            
            if (!this._endPointHandle) {
                this._endPointHandle = this.geometryEngine.createPoint(
                    this._endPoint.x,
                    this._endPoint.y,
                    this._endPoint.z
                );
            }
            
            // إنشاء الخط
            const lineHandle = this.geometryEngine.createLine(
                this._startPointHandle,
                this._endPointHandle
            );
            
            this.logger.debug(`تم إنشاء خط في OpenCASCADE - Handle: ${lineHandle}`);
            
            return lineHandle;
        } catch (error) {
            this.logger.error(`فشل إنشاء الخط في OpenCASCADE`, error);
            throw error;
        }
    }

    /**
     * تحديث الشكل الهندسي عند تغيير الخصائص
     * يُستدعى عند تعديل نقاط البداية أو النهاية
     */
    protected updateOCShape(): void {
        // حذف الشكل القديم
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
        
        // حذف النقاط القديمة
        if (this._startPointHandle) {
            this.geometryEngine.deleteShape(this._startPointHandle);
            this._startPointHandle = null;
        }
        
        if (this._endPointHandle) {
            this.geometryEngine.deleteShape(this._endPointHandle);
            this._endPointHandle = null;
        }
        
        // سيتم إنشاء شكل جديد عند الحاجة التالية
        this.logger.debug(`تم تحديث الخط ${this._id}`);
    }

    /**
     * حساب الحدود الهندسية للخط
     * تُستخدم لحسابات التقريب والعرض
     */
    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: Math.min(this._startPoint.x, this._endPoint.x),
                y: Math.min(this._startPoint.y, this._endPoint.y),
                z: Math.min(this._startPoint.z, this._endPoint.z)
            },
            max: {
                x: Math.max(this._startPoint.x, this._endPoint.x),
                y: Math.max(this._startPoint.y, this._endPoint.y),
                z: Math.max(this._startPoint.z, this._endPoint.z)
            }
        };
    }

    /**
     * إنشاء نسخة من الخط
     */
    public clone(): Line {
        const clonedLine = new Line(this._startPoint, this._endPoint);
        
        // نسخ الخصائص من الكائن الأصلي
        clonedLine._layerId = this._layerId;
        clonedLine._visible = this._visible;
        clonedLine._locked = this._locked;
        clonedLine._visualProperties = { ...this._visualProperties };
        clonedLine._transform = {
            translation: { ...this._transform.translation },
            rotation: { ...this._transform.rotation },
            scale: { ...this._transform.scale }
        };
        
        return clonedLine;
    }

    /**
     * حساب طول الخط
     * هذه دالة مساعدة مفيدة خاصة بالخطوط
     */
    public getLength(): number {
        const dx = this._endPoint.x - this._startPoint.x;
        const dy = this._endPoint.y - this._startPoint.y;
        const dz = this._endPoint.z - this._startPoint.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * حساب نقطة المنتصف
     */
    public getMidPoint(): Point3D {
        return {
            x: (this._startPoint.x + this._endPoint.x) / 2,
            y: (this._startPoint.y + this._endPoint.y) / 2,
            z: (this._startPoint.z + this._endPoint.z) / 2
        };
    }

    /**
     * حساب متجه الاتجاه (مُطبَّع)
     */
    public getDirection(): Point3D {
        const length = this.getLength();
        
        if (length === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        
        return {
            x: (this._endPoint.x - this._startPoint.x) / length,
            y: (this._endPoint.y - this._startPoint.y) / length,
            z: (this._endPoint.z - this._startPoint.z) / length
        };
    }

    /**
     * حساب أقرب نقطة على الخط من نقطة معينة
     */
    public getClosestPoint(point: Point3D): Point3D {
        const direction = this.getDirection();
        const length = this.getLength();
        
        // حساب الإسقاط على الخط
        const toPoint = {
            x: point.x - this._startPoint.x,
            y: point.y - this._startPoint.y,
            z: point.z - this._startPoint.z
        };
        
        // حاصل الضرب النقطي
        let t = toPoint.x * direction.x + 
                toPoint.y * direction.y + 
                toPoint.z * direction.z;
        
        // تقييد النتيجة بين 0 و طول الخط
        t = Math.max(0, Math.min(length, t));
        
        // حساب النقطة على الخط
        return {
            x: this._startPoint.x + direction.x * t,
            y: this._startPoint.y + direction.y * t,
            z: this._startPoint.z + direction.z * t
        };
    }

    /**
     * تحويل إلى JSON مع خصائص الخط الإضافية
     */
    public toJSON(): object {
        const baseJSON = super.toJSON();
        
        return {
            ...baseJSON,
            startPoint: { ...this._startPoint },
            endPoint: { ...this._endPoint },
            length: this.getLength()
        };
    }

    /**
     * استعادة من JSON
     */
    public fromJSON(data: any): void {
        super.fromJSON(data);
        
        if (data.startPoint) {
            this._startPoint = { ...data.startPoint };
        }
        
        if (data.endPoint) {
            this._endPoint = { ...data.endPoint };
        }
        
        // إعادة تعيين المعرفات لإجبار إعادة الإنشاء
        this._startPointHandle = null;
        this._endPointHandle = null;
        this._ocHandle = null;
    }

    /**
     * إنشاء خط من JSON مباشرة
     */
    public static fromJSON(data: any): Line {
        const line = new Line(
            data.startPoint || { x: 0, y: 0, z: 0 },
            data.endPoint || { x: 1, y: 0, z: 0 }
        );
        
        line.fromJSON(data);
        return line;
    }

    // Getters و Setters للخصائص الخاصة بالخط
    
    public get startPoint(): Point3D { 
        return { ...this._startPoint }; 
    }
    
    public set startPoint(value: Point3D) {
        this._startPoint = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get endPoint(): Point3D { 
        return { ...this._endPoint }; 
    }
    
    public set endPoint(value: Point3D) {
        this._endPoint = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }
}