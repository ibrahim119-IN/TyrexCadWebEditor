// وحدة المحرك الهندسي - طبقة التجريد فوق OpenCASCADE.js
// هذه الوحدة تعزل تعقيدات OpenCASCADE وتوفر واجهة برمجية بسيطة لبقية التطبيق

import { Logger } from './Logger';

// أنواع البيانات المخصصة للتعامل مع OpenCASCADE
export type OCHandle = number;
export type OCShapeHandle = OCHandle;
export type OCPointHandle = OCHandle;
export type OCLineHandle = OCHandle;
export type OCCircleHandle = OCHandle;
export type OCSolidHandle = OCHandle;

// واجهة للنقطة ثلاثية الأبعاد
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

// واجهة لنتيجة عملية التثليث (Tessellation)
export interface TessellationResult {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
}

// واجهة لمعاملات التثليث
export interface TessellationParams {
    deflection: number;
    angleDeflection?: number;
}

/**
 * GeometryEngine - المحرك الهندسي المركزي
 * 
 * هذه الفئة تدير كل العمليات الهندسية باستخدام OpenCASCADE.js
 * وتوفر واجهة برمجية مبسطة للتطبيق
 */
export class GeometryEngine {
    private static instance: GeometryEngine;
    private oc: any = null; // مثيل OpenCASCADE
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;
    private logger: Logger;
    
    // خرائط لتخزين الأشكال المُنشأة
    private shapeCache: Map<OCShapeHandle, any> = new Map();
    private nextHandle: number = 1;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * الحصول على المثيل الوحيد للمحرك (Singleton Pattern)
     * هذا يضمن وجود مثيل واحد فقط من OpenCASCADE في التطبيق
     */
    public static getInstance(): GeometryEngine {
        if (!GeometryEngine.instance) {
            GeometryEngine.instance = new GeometryEngine();
        }
        return GeometryEngine.instance;
    }

    /**
     * تهيئة OpenCASCADE.js
     * يجب استدعاء هذه الدالة قبل أي عملية هندسية
     */
    public async initialize(): Promise<void> {
        // تجنب التهيئة المتعددة
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    private async _doInitialize(): Promise<void> {
        try {
            this.logger.info('بدء تهيئة OpenCASCADE.js...');
            
            // تحميل OpenCASCADE
            // @ts-ignore
            const OpenCascadeModule = (window as any).OpenCascadeModule;
            if (!OpenCascadeModule) {
                throw new Error('لم يتم العثور على OpenCASCADE.js - تأكد من تحميل الملفات في index.html');
            }

            // تهيئة الوحدة
            this.oc = await OpenCascadeModule({
                locateFile: (path: string) => {
                    if (path.endsWith('.wasm')) {
                        return '/assets/opencascade/opencascade.wasm';
                    }
                    return path;
                }
            });

            this.initialized = true;
            this.logger.info('تم تهيئة OpenCASCADE.js بنجاح');
        } catch (error) {
            this.logger.error('فشلت تهيئة OpenCASCADE.js:', error);
            throw error;
        }
    }

    /**
     * التحقق من جاهزية المحرك
     */
    public isReady(): boolean {
        return this.initialized && this.oc !== null;
    }

    /**
     * إنشاء نقطة هندسية
     */
    public createPoint(x: number, y: number, z: number = 0): OCPointHandle {
        this.ensureInitialized();
        
        try {
            const point = new this.oc.gp_Pnt(x, y, z);
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, point);
            
            this.logger.debug(`تم إنشاء نقطة: (${x}, ${y}, ${z}) - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشل إنشاء النقطة:', error);
            throw error;
        }
    }

    /**
     * إنشاء خط بين نقطتين
     */
    public createLine(p1Handle: OCPointHandle, p2Handle: OCPointHandle): OCLineHandle {
        this.ensureInitialized();
        
        try {
            const p1 = this.getShape(p1Handle);
            const p2 = this.getShape(p2Handle);
            
            // إنشاء مقطع خط
            const segment = new this.oc.GC_MakeSegment(p1, p2).Value();
            const edge = new this.oc.BRepBuilderAPI_MakeEdge(segment).Edge();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edge);
            
            this.logger.debug(`تم إنشاء خط بين النقطتين ${p1Handle} و ${p2Handle} - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشل إنشاء الخط:', error);
            throw error;
        }
    }

    /**
     * إنشاء دائرة
     */
    public createCircle(centerHandle: OCPointHandle, normalHandle: OCPointHandle, radius: number): OCCircleHandle {
        this.ensureInitialized();
        
        try {
            const center = this.getShape(centerHandle);
            const normal = this.getShape(normalHandle);
            
            // إنشاء محور للدائرة
            const axis = new this.oc.gp_Ax2(center, new this.oc.gp_Dir(normal.X(), normal.Y(), normal.Z()));
            
            // إنشاء الدائرة
            const circle = new this.oc.GC_MakeCircle(axis, radius).Value();
            const edge = new this.oc.BRepBuilderAPI_MakeEdge(circle).Edge();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edge);
            
            this.logger.debug(`تم إنشاء دائرة - المركز: ${centerHandle}, نصف القطر: ${radius} - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشل إنشاء الدائرة:', error);
            throw error;
        }
    }

    /**
     * إنشاء صندوق (مكعب)
     */
    public createBox(width: number, height: number, depth: number): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            const box = new this.oc.BRepPrimAPI_MakeBox(width, height, depth).Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, box);
            
            this.logger.debug(`تم إنشاء صندوق: ${width}x${height}x${depth} - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشل إنشاء الصندوق:', error);
            throw error;
        }
    }

    /**
     * إجراء عملية اتحاد (Union) بين شكلين
     */
    public performUnion(shape1Handle: OCSolidHandle, shape2Handle: OCSolidHandle): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            const shape1 = this.getShape(shape1Handle);
            const shape2 = this.getShape(shape2Handle);
            
            const fuse = new this.oc.BRepAlgoAPI_Fuse(shape1, shape2);
            fuse.Build();
            const result = fuse.Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, result);
            
            this.logger.debug(`تم إجراء عملية اتحاد بين ${shape1Handle} و ${shape2Handle} - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشلت عملية الاتحاد:', error);
            throw error;
        }
    }

    /**
     * إجراء عملية طرح (Difference) بين شكلين
     */
    public performDifference(shape1Handle: OCSolidHandle, shape2Handle: OCSolidHandle): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            const shape1 = this.getShape(shape1Handle);
            const shape2 = this.getShape(shape2Handle);
            
            const cut = new this.oc.BRepAlgoAPI_Cut(shape1, shape2);
            cut.Build();
            const result = cut.Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, result);
            
            this.logger.debug(`تم إجراء عملية طرح ${shape2Handle} من ${shape1Handle} - Handle: ${handle}`);
            return handle;
        } catch (error) {
            this.logger.error('فشلت عملية الطرح:', error);
            throw error;
        }
    }

    /**
     * تحويل الشكل إلى شبكة مثلثية للعرض
     */
    public tessellateShape(shapeHandle: OCShapeHandle, params: TessellationParams): TessellationResult {
        this.ensureInitialized();
        
        try {
            const shape = this.getShape(shapeHandle);
            
            // إنشاء شبكة مثلثية
            new this.oc.BRepMesh_IncrementalMesh(shape, params.deflection, false, params.angleDeflection || 0.5);
            
            // استخراج المثلثات
            const vertices: number[] = [];
            const indices: number[] = [];
            const normals: number[] = [];
            
            // هنا سيتم إضافة كود استخراج المثلثات من OpenCASCADE
            // هذا يتطلب التعامل مع TopExp_Explorer و Poly_Triangulation
            
            return {
                vertices: new Float32Array(vertices),
                indices: new Uint32Array(indices),
                normals: new Float32Array(normals)
            };
        } catch (error) {
            this.logger.error('فشل تحويل الشكل إلى شبكة مثلثية:', error);
            throw error;
        }
    }

    /**
     * الحصول على حدود الشكل
     */
    public getShapeBounds(shapeHandle: OCShapeHandle): { min: Point3D, max: Point3D } {
        this.ensureInitialized();
        
        try {
            const shape = this.getShape(shapeHandle);
            const bbox = new this.oc.Bnd_Box();
            this.oc.BRepBndLib.Add(shape, bbox);
            
            const min = bbox.CornerMin();
            const max = bbox.CornerMax();
            
            return {
                min: { x: min.X(), y: min.Y(), z: min.Z() },
                max: { x: max.X(), y: max.Y(), z: max.Z() }
            };
        } catch (error) {
            this.logger.error('فشل الحصول على حدود الشكل:', error);
            throw error;
        }
    }

    /**
     * تنظيف الذاكرة - حذف شكل
     */
    public deleteShape(handle: OCShapeHandle): void {
        if (this.shapeCache.has(handle)) {
            const shape = this.shapeCache.get(handle);
            // OpenCASCADE.js يدير الذاكرة تلقائياً في معظم الحالات
            this.shapeCache.delete(handle);
            this.logger.debug(`تم حذف الشكل: ${handle}`);
        }
    }

    /**
     * دوال مساعدة خاصة
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('GeometryEngine غير مهيأ - استدع initialize() أولاً');
        }
    }

    private getShape(handle: OCHandle): any {
        const shape = this.shapeCache.get(handle);
        if (!shape) {
            throw new Error(`لم يتم العثور على الشكل بالمعرف: ${handle}`);
        }
        return shape;
    }

    private getNextHandle(): OCHandle {
        return this.nextHandle++;
    }

    /**
     * تنظيف جميع الموارد
     */
    public dispose(): void {
        this.shapeCache.clear();
        this.oc = null;
        this.initialized = false;
        this.logger.info('تم تنظيف GeometryEngine');
    }
}