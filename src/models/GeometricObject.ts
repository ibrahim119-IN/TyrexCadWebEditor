/**
 * GeometricObject - الفئة الأساسية لجميع الكيانات الهندسية
 * 
 * هذه الفئة تحدد الخصائص والسلوكيات المشتركة بين جميع الأشكال الهندسية
 * مثل المعرف الفريد، الطبقة، اللون، الرؤية، والتحويلات الهندسية
 */

import { GeometryEngine, OCShapeHandle } from '../core/GeometryEngine';
import { Logger } from '../core/Logger';

// تعداد لأنواع الكيانات الهندسية
export enum GeometricObjectType {
    POINT = 'point',
    LINE = 'line',
    CIRCLE = 'circle',
    ARC = 'arc',
    POLYLINE = 'polyline',
    SOLID = 'solid',
    SURFACE = 'surface',
    CURVE = 'curve',
    COMPOUND = 'compound'
}

// واجهة للخصائص المرئية
export interface VisualProperties {
    color: string;
    opacity: number;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    fillPattern?: 'solid' | 'hatch' | 'none';
}

// واجهة للتحويلات الهندسية
export interface Transform {
    translation: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; angle: number };
    scale: { x: number; y: number; z: number };
}

// واجهة للبيانات الوصفية
export interface Metadata {
    name?: string;
    description?: string;
    author?: string;
    createdAt: Date;
    modifiedAt: Date;
    customProperties?: Record<string, any>;
}

/**
 * الفئة الأساسية المجردة لجميع الكيانات الهندسية
 */
export abstract class GeometricObject {
    // المعرف الفريد للكائن
    protected _id: string;
    
    // النوع الهندسي
    protected _type: GeometricObjectType;
    
    // معرف الشكل في OpenCASCADE
    protected _ocHandle: OCShapeHandle | null = null;
    
    // الطبقة التي ينتمي إليها الكائن
    protected _layerId: string = 'default';
    
    // حالة الرؤية
    protected _visible: boolean = true;
    
    // حالة القفل (منع التعديل)
    protected _locked: boolean = false;
    
    // حالة التحديد
    protected _selected: boolean = false;
    
    // الخصائص المرئية
    protected _visualProperties: VisualProperties = {
        color: '#000000',
        opacity: 1.0,
        lineWidth: 1,
        lineStyle: 'solid',
        fillPattern: 'solid'
    };
    
    // التحويلات المطبقة على الكائن
    protected _transform: Transform = {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, angle: 0 },
        scale: { x: 1, y: 1, z: 1 }
    };
    
    // البيانات الوصفية
    protected _metadata: Metadata;
    
    // المحرك الهندسي
    protected geometryEngine: GeometryEngine;
    
    // نظام التسجيل
    protected logger: Logger;

    constructor(type: GeometricObjectType) {
        this._id = this.generateUniqueId();
        this._type = type;
        this._metadata = {
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        
        this.geometryEngine = GeometryEngine.getInstance();
        this.logger = Logger.getInstance();
        
        this.logger.debug(`تم إنشاء كائن هندسي جديد: ${this._type} - ${this._id}`);
    }

    /**
     * توليد معرف فريد للكائن
     * يستخدم الطابع الزمني مع رقم عشوائي لضمان الفرادة
     */
    protected generateUniqueId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${this._type}_${timestamp}_${random}`;
    }

    /**
     * دالة مجردة - يجب تنفيذها في الفئات المشتقة
     * تقوم بإنشاء الشكل الهندسي في OpenCASCADE
     */
    protected abstract createOCShape(): OCShapeHandle;

    /**
     * دالة مجردة - يجب تنفيذها في الفئات المشتقة
     * تقوم بتحديث الشكل الهندسي عند تغيير الخصائص
     */
    protected abstract updateOCShape(): void;

    /**
     * دالة مجردة - يجب تنفيذها في الفئات المشتقة
     * تحسب الحدود الهندسية للكائن
     */
    public abstract getBounds(): { min: Point3D; max: Point3D };

    /**
     * دالة مجردة - يجب تنفيذها في الفئات المشتقة
     * تنسخ الكائن
     */
    public abstract clone(): GeometricObject;

    /**
     * الحصول على التمثيل الهندسي في OpenCASCADE
     * ينشئ الشكل إذا لم يكن موجوداً
     */
    public getOCShape(): OCShapeHandle {
        if (!this._ocHandle) {
            this._ocHandle = this.createOCShape();
        }
        return this._ocHandle;
    }

    /**
     * تطبيق تحويل هندسي على الكائن
     */
    public applyTransform(transform: Partial<Transform>): void {
        // دمج التحويل الجديد مع الحالي
        if (transform.translation) {
            this._transform.translation.x += transform.translation.x;
            this._transform.translation.y += transform.translation.y;
            this._transform.translation.z += transform.translation.z;
        }
        
        if (transform.rotation) {
            // هنا يمكن تطبيق منطق أكثر تعقيداً لدمج الدورانات
            this._transform.rotation = transform.rotation;
        }
        
        if (transform.scale) {
            this._transform.scale.x *= transform.scale.x;
            this._transform.scale.y *= transform.scale.y;
            this._transform.scale.z *= transform.scale.z;
        }
        
        // تحديث الشكل الهندسي
        this.updateOCShape();
        this.updateModifiedTime();
        
        this.logger.debug(`تم تطبيق تحويل على الكائن ${this._id}`, transform);
    }

    /**
     * تحديث وقت التعديل
     */
    protected updateModifiedTime(): void {
        this._metadata.modifiedAt = new Date();
    }

    /**
     * تحويل الكائن إلى JSON للحفظ
     */
    public toJSON(): object {
        return {
            id: this._id,
            type: this._type,
            layerId: this._layerId,
            visible: this._visible,
            locked: this._locked,
            visualProperties: { ...this._visualProperties },
            transform: {
                translation: { ...this._transform.translation },
                rotation: { ...this._transform.rotation },
                scale: { ...this._transform.scale }
            },
            metadata: {
                ...this._metadata,
                createdAt: this._metadata.createdAt.toISOString(),
                modifiedAt: this._metadata.modifiedAt.toISOString()
            }
        };
    }

    /**
     * استعادة الكائن من JSON
     */
    public fromJSON(data: any): void {
        this._id = data.id;
        this._type = data.type;
        this._layerId = data.layerId || 'default';
        this._visible = data.visible !== undefined ? data.visible : true;
        this._locked = data.locked || false;
        
        if (data.visualProperties) {
            this._visualProperties = { ...data.visualProperties };
        }
        
        if (data.transform) {
            this._transform = {
                translation: { ...data.transform.translation },
                rotation: { ...data.transform.rotation },
                scale: { ...data.transform.scale }
            };
        }
        
        if (data.metadata) {
            this._metadata = {
                ...data.metadata,
                createdAt: new Date(data.metadata.createdAt),
                modifiedAt: new Date(data.metadata.modifiedAt)
            };
        }
    }

    /**
     * تنظيف الموارد
     */
    public dispose(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
        
        this.logger.debug(`تم تنظيف الكائن الهندسي: ${this._id}`);
    }

    // Getters و Setters للخصائص الأساسية
    
    public get id(): string { return this._id; }
    
    public get type(): GeometricObjectType { return this._type; }
    
    public get layerId(): string { return this._layerId; }
    public set layerId(value: string) {
        this._layerId = value;
        this.updateModifiedTime();
    }
    
    public get visible(): boolean { return this._visible; }
    public set visible(value: boolean) {
        this._visible = value;
        this.updateModifiedTime();
    }
    
    public get locked(): boolean { return this._locked; }
    public set locked(value: boolean) {
        this._locked = value;
        this.updateModifiedTime();
    }
    
    public get selected(): boolean { return this._selected; }
    public set selected(value: boolean) {
        this._selected = value;
    }
    
    public get visualProperties(): VisualProperties { return { ...this._visualProperties }; }
    public set visualProperties(value: Partial<VisualProperties>) {
        this._visualProperties = { ...this._visualProperties, ...value };
        this.updateModifiedTime();
    }
    
    public get transform(): Transform {
        return {
            translation: { ...this._transform.translation },
            rotation: { ...this._transform.rotation },
            scale: { ...this._transform.scale }
        };
    }
    
    public get metadata(): Metadata { return { ...this._metadata }; }
    
    public setMetadata(key: string, value: any): void {
        if (!this._metadata.customProperties) {
            this._metadata.customProperties = {};
        }
        this._metadata.customProperties[key] = value;
        this.updateModifiedTime();
    }
}

// نوع مساعد للنقطة ثلاثية الأبعاد
export interface Point3D {
    x: number;
    y: number;
    z: number;
}