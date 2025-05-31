/**
 * GeometryEngine - المحرك الهندسي المحدث
 * 
 * محسن للعمل مع OpenCASCADE.js مع معالجة أفضل للأخطاء والتهيئة
 */

import { Logger } from './Logger';

export type OCHandle = number;
export type OCShapeHandle = OCHandle;
export type OCPointHandle = OCHandle;
export type OCLineHandle = OCHandle;
export type OCCircleHandle = OCHandle;
export type OCSolidHandle = OCHandle;

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface TessellationResult {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
}

export interface TessellationParams {
    deflection: number;
    angleDeflection?: number;
}

export class GeometryEngine {
    private static instance: GeometryEngine;
    private oc: any = null;
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;
    private logger: Logger;
    
    private shapeCache: Map<OCShapeHandle, any> = new Map();
    private nextHandle: number = 1;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): GeometryEngine {
        if (!GeometryEngine.instance) {
            GeometryEngine.instance = new GeometryEngine();
        }
        return GeometryEngine.instance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    private async _doInitialize(): Promise<void> {
        try {
            this.logger.info('بدء تهيئة OpenCASCADE.js...');
            
            // التحقق من وجود OpenCASCADE
            const OpenCascadeModule = (window as any).OpenCascadeModule;
            if (!OpenCascadeModule) {
                throw new Error('OpenCASCADE.js غير محمل - تأكد من تحميل الملفات');
            }

            // تهيئة الوحدة مع إعدادات محسنة
            this.oc = await OpenCascadeModule({
                locateFile: (path: string) => {
                    this.logger.debug(`طلب ملف: ${path}`);
                    if (path.endsWith('.wasm')) {
                        return '/assets/opencascade/opencascade.wasm';
                    }
                    return `/assets/opencascade/${path}`;
                },
                onRuntimeInitialized: () => {
                    this.logger.debug('تم تهيئة OpenCASCADE Runtime');
                }
            });

            // التحقق من تهيئة الوحدة بنجاح
            if (!this.oc) {
                throw new Error('فشل في تهيئة OpenCASCADE');
            }

            // اختبار إنشاء شكل بسيط للتأكد من عمل المحرك
            try {
                const testPoint = new this.oc.gp_Pnt(0, 0, 0);
                if (testPoint) {
                    this.logger.debug('اختبار إنشاء نقطة نجح');
                    testPoint.delete?.();
                }
            } catch (testError) {
                this.logger.warn('فشل اختبار OpenCASCADE:', testError);
            }

            this.initialized = true;
            this.logger.info('تم تهيئة OpenCASCADE.js بنجاح');
            
        } catch (error) {
            this.logger.error('فشلت تهيئة OpenCASCADE.js:', error);
            this.initialized = false;
            throw error;
        }
    }

    public isReady(): boolean {
        return this.initialized && this.oc !== null;
    }

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
            throw new Error(`فشل إنشاء النقطة: ${error}`);
        }
    }

    public createLine(p1Handle: OCPointHandle, p2Handle: OCPointHandle): OCLineHandle {
        this.ensureInitialized();
        
        try {
            const p1 = this.getShape(p1Handle);
            const p2 = this.getShape(p2Handle);
            
            if (!p1 || !p2) {
                throw new Error('نقاط غير صالحة للخط');
            }

            // التحقق من عدم تساوي النقطتين
            if (this.arePointsEqual(p1, p2)) {
                throw new Error('لا يمكن إنشاء خط من نقطتين متطابقتين');
            }
            
            const segment = new this.oc.GC_MakeSegment_1(p1, p2);
            if (!segment.IsDone()) {
                throw new Error('فشل في إنشاء مقطع الخط');
            }
            
            const curve = segment.Value();
            const edge = new this.oc.BRepBuilderAPI_MakeEdge_2(curve);
            
            if (!edge.IsDone()) {
                throw new Error('فشل في إنشاء حافة الخط');
            }
            
            const edgeShape = edge.Edge();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edgeShape);
            
            this.logger.debug(`تم إنشاء خط بين النقطتين ${p1Handle} و ${p2Handle} - Handle: ${handle}`);
            return handle;
            
        } catch (error) {
            this.logger.error('فشل إنشاء الخط:', error);
            throw new Error(`فشل إنشاء الخط: ${error}`);
        }
    }

    public createCircle(centerHandle: OCPointHandle, normalHandle: OCPointHandle, radius: number): OCCircleHandle {
        this.ensureInitialized();
        
        try {
            if (radius <= 0) {
                throw new Error('نصف القطر يجب أن يكون أكبر من صفر');
            }

            const center = this.getShape(centerHandle);
            const normal = this.getShape(normalHandle);
            
            if (!center || !normal) {
                throw new Error('نقاط غير صالحة للدائرة');
            }
            
            // إنشاء متجه الاتجاه
            const direction = new this.oc.gp_Dir_4(normal.X(), normal.Y(), normal.Z());
            
            // إنشاء محور للدائرة
            const axis = new this.oc.gp_Ax2_3(center, direction);
            
            // إنشاء الدائرة
            const circle = new this.oc.GC_MakeCircle_3(axis, radius);
            
            if (!circle.IsDone()) {
                throw new Error('فشل في إنشاء الدائرة');
            }
            
            const circleValue = circle.Value();
            const edge = new this.oc.BRepBuilderAPI_MakeEdge_2(circleValue);
            
            if (!edge.IsDone()) {
                throw new Error('فشل في إنشاء حافة الدائرة');
            }
            
            const edgeShape = edge.Edge();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edgeShape);
            
            this.logger.debug(`تم إنشاء دائرة - المركز: ${centerHandle}, نصف القطر: ${radius} - Handle: ${handle}`);
            return handle;
            
        } catch (error) {
            this.logger.error('فشل إنشاء الدائرة:', error);
            throw new Error(`فشل إنشاء الدائرة: ${error}`);
        }
    }

    public createBox(width: number, height: number, depth: number): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            if (width <= 0 || height <= 0 || depth <= 0) {
                throw new Error('أبعاد الصندوق يجب أن تكون أكبر من صفر');
            }

            const box = new this.oc.BRepPrimAPI_MakeBox_2(width, height, depth);
            
            if (!box.IsDone()) {
                throw new Error('فشل في إنشاء الصندوق');
            }
            
            const shape = box.Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, shape);
            
            this.logger.debug(`تم إنشاء صندوق: ${width}x${height}x${depth} - Handle: ${handle}`);
            return handle;
            
        } catch (error) {
            this.logger.error('فشل إنشاء الصندوق:', error);
            throw new Error(`فشل إنشاء الصندوق: ${error}`);
        }
    }

    public performUnion(shape1Handle: OCSolidHandle, shape2Handle: OCSolidHandle): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            const shape1 = this.getShape(shape1Handle);
            const shape2 = this.getShape(shape2Handle);
            
            if (!shape1 || !shape2) {
                throw new Error('أشكال غير صالحة للاتحاد');
            }
            
            const fuse = new this.oc.BRepAlgoAPI_Fuse_1(shape1, shape2);
            fuse.Build();
            
            if (!fuse.IsDone()) {
                throw new Error('فشل في عملية الاتحاد');
            }
            
            const result = fuse.Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, result);
            
            this.logger.debug(`تم إجراء عملية اتحاد بين ${shape1Handle} و ${shape2Handle} - Handle: ${handle}`);
            return handle;
            
        } catch (error) {
            this.logger.error('فشلت عملية الاتحاد:', error);
            throw new Error(`فشلت عملية الاتحاد: ${error}`);
        }
    }

    public performDifference(shape1Handle: OCSolidHandle, shape2Handle: OCSolidHandle): OCSolidHandle {
        this.ensureInitialized();
        
        try {
            const shape1 = this.getShape(shape1Handle);
            const shape2 = this.getShape(shape2Handle);
            
            if (!shape1 || !shape2) {
                throw new Error('أشكال غير صالحة للطرح');
            }
            
            const cut = new this.oc.BRepAlgoAPI_Cut_1(shape1, shape2);
            cut.Build();
            
            if (!cut.IsDone()) {
                throw new Error('فشل في عملية الطرح');
            }
            
            const result = cut.Shape();
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, result);
            
            this.logger.debug(`تم إجراء عملية طرح ${shape2Handle} من ${shape1Handle} - Handle: ${handle}`);
            return handle;
            
        } catch (error) {
            this.logger.error('فشلت عملية الطرح:', error);
            throw new Error(`فشلت عملية الطرح: ${error}`);
        }
    }

    public tessellateShape(shapeHandle: OCShapeHandle, params: TessellationParams): TessellationResult {
        this.ensureInitialized();
        
        try {
            const shape = this.getShape(shapeHandle);
            
            if (!shape) {
                throw new Error('شكل غير صالح للتحويل');
            }
            
            // تطبيق التشبيك
            new this.oc.BRepMesh_IncrementalMesh_2(shape, params.deflection, false, params.angleDeflection || 0.5, true);
            
            // مصفوفات النتائج
            const vertices: number[] = [];
            const indices: number[] = [];
            const normals: number[] = [];
            
            // استخراج البيانات من الشكل
            // هذا جزء مبسط - يحتاج تطوير أكثر لاستخراج البيانات الفعلية
            
            // إنشاء بيانات وهمية للاختبار
            const dummyVertices = [
                0, 0, 0,   // نقطة 1
                1, 0, 0,   // نقطة 2
                0.5, 1, 0  // نقطة 3
            ];
            
            const dummyIndices = [0, 1, 2];
            
            const dummyNormals = [
                0, 0, 1,   // عادي للنقطة 1
                0, 0, 1,   // عادي للنقطة 2
                0, 0, 1    // عادي للنقطة 3
            ];
            
            return {
                vertices: new Float32Array(dummyVertices),
                indices: new Uint32Array(dummyIndices),
                normals: new Float32Array(dummyNormals)
            };
            
        } catch (error) {
            this.logger.error('فشل تحويل الشكل إلى شبكة مثلثية:', error);
            throw new Error(`فشل التحويل: ${error}`);
        }
    }

    public getShapeBounds(shapeHandle: OCShapeHandle): { min: Point3D, max: Point3D } {
        this.ensureInitialized();
        
        try {
            const shape = this.getShape(shapeHandle);
            
            if (!shape) {
                throw new Error('شكل غير صالح للحدود');
            }
            
            const bbox = new this.oc.Bnd_Box_1();
            this.oc.BRepBndLib.Add(shape, bbox, false);
            
            if (bbox.IsVoid()) {
                throw new Error('صندوق الحدود فارغ');
            }
            
            const min = bbox.CornerMin();
            const max = bbox.CornerMax();
            
            const result = {
                min: { x: min.X(), y: min.Y(), z: min.Z() },
                max: { x: max.X(), y: max.Y(), z: max.Z() }
            };
            
            // تنظيف الكائنات المؤقتة
            bbox.delete?.();
            min.delete?.();
            max.delete?.();
            
            return result;
            
        } catch (error) {
            this.logger.error('فشل الحصول على حدود الشكل:', error);
            throw new Error(`فشل حساب الحدود: ${error}`);
        }
    }

    public deleteShape(handle: OCShapeHandle): void {
        if (this.shapeCache.has(handle)) {
            const shape = this.shapeCache.get(handle);
            
            // محاولة تنظيف الذاكرة
            try {
                if (shape && typeof shape.delete === 'function') {
                    shape.delete();
                }
            } catch (error) {
                this.logger.warn(`فشل حذف الشكل ${handle}:`, error);
            }
            
            this.shapeCache.delete(handle);
            this.logger.debug(`تم حذف الشكل: ${handle}`);
        }
    }

    // دوال مساعدة
    private ensureInitialized(): void {
        if (!this.initialized || !this.oc) {
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

    private arePointsEqual(p1: any, p2: any, tolerance: number = 1e-6): boolean {
        try {
            return Math.abs(p1.X() - p2.X()) < tolerance &&
                   Math.abs(p1.Y() - p2.Y()) < tolerance &&
                   Math.abs(p1.Z() - p2.Z()) < tolerance;
        } catch (error) {
            return false;
        }
    }

    public dispose(): void {
        try {
            // تنظيف جميع الأشكال المحفوظة
            this.shapeCache.forEach((shape, handle) => {
                try {
                    if (shape && typeof shape.delete === 'function') {
                        shape.delete();
                    }
                } catch (error) {
                    this.logger.warn(`فشل تنظيف الشكل ${handle}:`, error);
                }
            });
            
            this.shapeCache.clear();
            this.oc = null;
            this.initialized = false;
            this.initPromise = null;
            
            this.logger.info('تم تنظيف GeometryEngine');
        } catch (error) {
            this.logger.error('خطأ أثناء تنظيف GeometryEngine:', error);
        }
    }

    // دالة للحصول على معلومات المحرك
    public getEngineInfo(): {
        initialized: boolean;
        shapeCount: number;
        nextHandle: number;
    } {
        return {
            initialized: this.initialized,
            shapeCount: this.shapeCache.size,
            nextHandle: this.nextHandle
        };
    }
}