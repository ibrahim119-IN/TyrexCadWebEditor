/**
 * GeometryEngine - المحرك الهندسي المتقدم
 * محرك متكامل للعمليات الهندسية ثلاثية الأبعاد مع دعم OpenCASCADE
 */

import { Logger } from './Logger';

export type OCHandle = number;
export type OCShapeHandle = OCHandle;
export type OCPointHandle = OCHandle;
export type OCLineHandle = OCHandle;
export type OCCircleHandle = OCHandle;
export type OCSolidHandle = OCHandle;
export type OCFaceHandle = OCHandle;
export type OCEdgeHandle = OCHandle;
export type OCVertexHandle = OCHandle;

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface Transform3D {
    translation: Vector3D;
    rotation: Vector3D;
    scale: Vector3D;
}

export interface BoundingBox {
    min: Point3D;
    max: Point3D;
    center: Point3D;
    dimensions: Vector3D;
}

export interface TessellationResult {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
    colors?: Float32Array;
}

export interface TessellationParams {
    deflection: number;
    angleDeflection?: number;
    relative?: boolean;
    inParallel?: boolean;
    minSize?: number;
    internalVerticesMode?: boolean;
}

export interface GeometryInfo {
    volume?: number;
    surfaceArea?: number;
    centroid?: Point3D;
    boundingBox: BoundingBox;
    topology: {
        vertices: number;
        edges: number;
        faces: number;
        shells: number;
        solids: number;
    };
}

export enum GeometryType {
    VERTEX = 'vertex',
    EDGE = 'edge',
    WIRE = 'wire',
    FACE = 'face',
    SHELL = 'shell',
    SOLID = 'solid',
    COMPOUND = 'compound'
}

export enum BooleanOperation {
    UNION = 'union',
    INTERSECTION = 'intersection',
    DIFFERENCE = 'difference',
    SYMMETRIC_DIFFERENCE = 'symmetric_difference'
}

export class GeometryEngine {
    private static instance: GeometryEngine;
    private oc: any = null;
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;
    private logger: Logger;
    
    private shapeCache: Map<OCShapeHandle, any> = new Map();
    private shapeMetadata: Map<OCShapeHandle, any> = new Map();
    private nextHandle: number = 1;
    private memoryUsage: number = 0;
    private maxMemoryUsage: number = 500 * 1024 * 1024; // 500MB
    
    // إحصائيات الأداء
    private stats = {
        operationsCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        memoryAllocations: 0,
        memoryDeallocations: 0,
        averageOperationTime: 0
    };
    useMockOpenCASCADE: any;

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
        this.logger.info('تهيئة GeometryEngine...');
        
        const factory = (window as any).globalOpenCascadeFactory;
        if (!factory) {
            throw new Error('OpenCASCADE factory غير متاح');
        }
        
        this.oc = await factory();
        
        if (!this.oc) {
            throw new Error('فشل تحميل OpenCASCADE');
        }
        
        // تحقق من وجود الدوال الأساسية
        if (!this.oc.gp_Pnt_1) {
            throw new Error('OpenCASCADE غير مكتمل');
        }
        
        this.initialized = true;
        this.logger.info('GeometryEngine جاهز');
        
    } catch (error) {
        this.logger.error('فشل GeometryEngine:', error);
        this.useMockOpenCASCADE();
        this.initialized = true;
    }
}
    private async runInitializationTests(): Promise<void> {
        try {
            // اختبار إنشاء نقطة
            const testPoint = new this.oc.gp_Pnt_1(0, 0, 0);
            if (!testPoint) throw new Error('فشل إنشاء نقطة اختبار');
            testPoint.delete();
            
            // اختبار إنشاء صندوق
            const testBox = new this.oc.BRepPrimAPI_MakeBox_2(1, 1, 1);
            if (!testBox.IsDone()) throw new Error('فشل إنشاء صندوق اختبار');
            const shape = testBox.Shape();
            if (!shape) throw new Error('فشل الحصول على شكل الصندوق');
            
            this.logger.debug('نجحت اختبارات التهيئة');
        } catch (error) {
            this.logger.error('فشلت اختبارات التهيئة:', error);
            throw error;
        }
    }

    // ==================== إنشاء الأشكال الأساسية ====================

    public createPoint(x: number, y: number, z: number = 0): OCPointHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createPoint', () => {
            const point = new this.oc.gp_Pnt_1(x, y, z);
            const vertex = new this.oc.BRepBuilderAPI_MakeVertex(point);
            
            if (!vertex.IsDone()) {
                throw new Error('فشل إنشاء الرأس');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, vertex.Vertex());
            this.shapeMetadata.set(handle, {
                type: GeometryType.VERTEX,
                created: Date.now(),
                coordinates: { x, y, z }
            });
            
            this.logger.debug(`تم إنشاء نقطة: (${x}, ${y}, ${z}) - Handle: ${handle}`);
            return handle;
        });
    }

    public createLine(startPoint: Point3D, endPoint: Point3D): OCLineHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createLine', () => {
            const p1 = new this.oc.gp_Pnt_1(startPoint.x, startPoint.y, startPoint.z);
            const p2 = new this.oc.gp_Pnt_1(endPoint.x, endPoint.y, endPoint.z);
            
            // التحقق من عدم تساوي النقطتين
            if (this.arePointsEqual(p1, p2)) {
                p1.delete(); p2.delete();
                throw new Error('لا يمكن إنشاء خط من نقطتين متطابقتين');
            }
            
            const line = new this.oc.GC_MakeSegment_1(p1, p2);
            if (!line.IsDone()) {
                p1.delete(); p2.delete();
                throw new Error('فشل في إنشاء مقطع الخط');
            }
            
            const edge = new this.oc.BRepBuilderAPI_MakeEdge_2(line.Value());
            if (!edge.IsDone()) {
                p1.delete(); p2.delete();
                throw new Error('فشل في إنشاء حافة الخط');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edge.Edge());
            this.shapeMetadata.set(handle, {
                type: GeometryType.EDGE,
                created: Date.now(),
                startPoint,
                endPoint,
                length: this.calculateDistance(startPoint, endPoint)
            });
            
            // تنظيف الذاكرة المؤقتة
            p1.delete(); p2.delete();
            
            this.logger.debug(`تم إنشاء خط - Handle: ${handle}`);
            return handle;
        });
    }

    public createCircle(center: Point3D, normal: Vector3D, radius: number): OCCircleHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createCircle', () => {
            if (radius <= 0) {
                throw new Error('نصف القطر يجب أن يكون أكبر من صفر');
            }

            const centerPnt = new this.oc.gp_Pnt_1(center.x, center.y, center.z);
            const normalVec = new this.oc.gp_Dir_1(normal.x, normal.y, normal.z);
            const axis = new this.oc.gp_Ax2_2(centerPnt, normalVec);
            
            const circle = new this.oc.GC_MakeCircle_2(axis, radius);
            if (!circle.IsDone()) {
                centerPnt.delete(); normalVec.delete(); axis.delete();
                throw new Error('فشل في إنشاء الدائرة');
            }
            
            const edge = new this.oc.BRepBuilderAPI_MakeEdge_2(circle.Value());
            if (!edge.IsDone()) {
                centerPnt.delete(); normalVec.delete(); axis.delete();
                throw new Error('فشل في إنشاء حافة الدائرة');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, edge.Edge());
            this.shapeMetadata.set(handle, {
                type: GeometryType.EDGE,
                created: Date.now(),
                center,
                normal,
                radius,
                circumference: 2 * Math.PI * radius,
                area: Math.PI * radius * radius
            });
            
            centerPnt.delete(); normalVec.delete(); axis.delete();
            
            this.logger.debug(`تم إنشاء دائرة - نصف القطر: ${radius} - Handle: ${handle}`);
            return handle;
        });
    }

    public createRectangle(corner1: Point3D, corner2: Point3D, _height: number = 0): OCFaceHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createRectangle', () => {
            const p1 = new this.oc.gp_Pnt_1(corner1.x, corner1.y, corner1.z);
            const p2 = new this.oc.gp_Pnt_1(corner2.x, corner1.y, corner1.z);
            const p3 = new this.oc.gp_Pnt_1(corner2.x, corner2.y, corner1.z);
            const p4 = new this.oc.gp_Pnt_1(corner1.x, corner2.y, corner1.z);
            
            // إنشاء الحواف
            const edge1 = new this.oc.BRepBuilderAPI_MakeEdge_1(p1, p2);
            const edge2 = new this.oc.BRepBuilderAPI_MakeEdge_1(p2, p3);
            const edge3 = new this.oc.BRepBuilderAPI_MakeEdge_1(p3, p4);
            const edge4 = new this.oc.BRepBuilderAPI_MakeEdge_1(p4, p1);
            
            // إنشاء السلك
            const wireBuilder = new this.oc.BRepBuilderAPI_MakeWire_1();
            wireBuilder.Add_1(edge1.Edge());
            wireBuilder.Add_1(edge2.Edge());
            wireBuilder.Add_1(edge3.Edge());
            wireBuilder.Add_1(edge4.Edge());
            
            if (!wireBuilder.IsDone()) {
                throw new Error('فشل في إنشاء سلك المستطيل');
            }
            
            // إنشاء الوجه
            const face = new this.oc.BRepBuilderAPI_MakeFace_2(wireBuilder.Wire());
            if (!face.IsDone()) {
                throw new Error('فشل في إنشاء وجه المستطيل');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, face.Face());
            this.shapeMetadata.set(handle, {
                type: GeometryType.FACE,
                created: Date.now(),
                corner1,
                corner2,
                width: Math.abs(corner2.x - corner1.x),
                height: Math.abs(corner2.y - corner1.y),
                area: Math.abs(corner2.x - corner1.x) * Math.abs(corner2.y - corner1.y)
            });
            
            // تنظيف الذاكرة
            [p1, p2, p3, p4].forEach(p => p.delete());
            
            this.logger.debug(`تم إنشاء مستطيل - Handle: ${handle}`);
            return handle;
        });
    }

    public createBox(width: number, height: number, depth: number, corner?: Point3D): OCSolidHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createBox', () => {
            if (width <= 0 || height <= 0 || depth <= 0) {
                throw new Error('أبعاد الصندوق يجب أن تكون أكبر من صفر');
            }

            let box;
            if (corner) {
                const cornerPnt = new this.oc.gp_Pnt_1(corner.x, corner.y, corner.z);
                box = new this.oc.BRepPrimAPI_MakeBox_3(cornerPnt, width, height, depth);
                cornerPnt.delete();
            } else {
                box = new this.oc.BRepPrimAPI_MakeBox_2(width, height, depth);
            }
            
            if (!box.IsDone()) {
                throw new Error('فشل في إنشاء الصندوق');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, box.Shape());
            this.shapeMetadata.set(handle, {
                type: GeometryType.SOLID,
                created: Date.now(),
                dimensions: { width, height, depth },
                volume: width * height * depth,
                corner: corner || { x: 0, y: 0, z: 0 }
            });
            
            this.logger.debug(`تم إنشاء صندوق: ${width}x${height}x${depth} - Handle: ${handle}`);
            return handle;
        });
    }

    public createSphere(center: Point3D, radius: number): OCSolidHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createSphere', () => {
            if (radius <= 0) {
                throw new Error('نصف القطر يجب أن يكون أكبر من صفر');
            }

            const centerPnt = new this.oc.gp_Pnt_1(center.x, center.y, center.z);
            const sphere = new this.oc.BRepPrimAPI_MakeSphere_2(centerPnt, radius);
            
            if (!sphere.IsDone()) {
                centerPnt.delete();
                throw new Error('فشل في إنشاء الكرة');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, sphere.Shape());
            this.shapeMetadata.set(handle, {
                type: GeometryType.SOLID,
                created: Date.now(),
                center,
                radius,
                volume: (4/3) * Math.PI * Math.pow(radius, 3),
                surfaceArea: 4 * Math.PI * Math.pow(radius, 2)
            });
            
            centerPnt.delete();
            
            this.logger.debug(`تم إنشاء كرة - نصف القطر: ${radius} - Handle: ${handle}`);
            return handle;
        });
    }

    public createCylinder(baseCenter: Point3D, axis: Vector3D, radius: number, height: number): OCSolidHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('createCylinder', () => {
            if (radius <= 0 || height <= 0) {
                throw new Error('نصف القطر والارتفاع يجب أن يكونا أكبر من صفر');
            }

            const basePnt = new this.oc.gp_Pnt_1(baseCenter.x, baseCenter.y, baseCenter.z);
            const axisDir = new this.oc.gp_Dir_1(axis.x, axis.y, axis.z);
            const axisObj = new this.oc.gp_Ax2_2(basePnt, axisDir);
            
            const cylinder = new this.oc.BRepPrimAPI_MakeCylinder_2(axisObj, radius, height);
            
            if (!cylinder.IsDone()) {
                basePnt.delete(); axisDir.delete(); axisObj.delete();
                throw new Error('فشل في إنشاء الأسطوانة');
            }
            
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, cylinder.Shape());
            this.shapeMetadata.set(handle, {
                type: GeometryType.SOLID,
                created: Date.now(),
                baseCenter,
                axis,
                radius,
                height,
                volume: Math.PI * Math.pow(radius, 2) * height,
                surfaceArea: 2 * Math.PI * radius * (radius + height)
            });
            
            basePnt.delete(); axisDir.delete(); axisObj.delete();
            
            this.logger.debug(`تم إنشاء أسطوانة - Handle: ${handle}`);
            return handle;
        });
    }

    // ==================== العمليات المنطقية ====================

    public performBooleanOperation(
        shape1Handle: OCShapeHandle, 
        shape2Handle: OCShapeHandle, 
        operation: BooleanOperation
    ): OCShapeHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('booleanOperation', () => {
            const shape1 = this.getShape(shape1Handle);
            const shape2 = this.getShape(shape2Handle);
            
            if (!shape1 || !shape2) {
                throw new Error('أشكال غير صالحة للعملية المنطقية');
            }
            
            let result;
            
            switch (operation) {
                case BooleanOperation.UNION:
                    result = new this.oc.BRepAlgoAPI_Fuse_1(shape1, shape2);
                    break;
                case BooleanOperation.DIFFERENCE:
                    result = new this.oc.BRepAlgoAPI_Cut_1(shape1, shape2);
                    break;
                case BooleanOperation.INTERSECTION:
                    result = new this.oc.BRepAlgoAPI_Common_1(shape1, shape2);
                    break;
                case BooleanOperation.SYMMETRIC_DIFFERENCE:
                    // تنفيذ الفرق المتماثل عبر (A∪B) - (A∩B)
                    const unionOp = new this.oc.BRepAlgoAPI_Fuse_1(shape1, shape2);
                    unionOp.Build();
                    const intersectionOp = new this.oc.BRepAlgoAPI_Common_1(shape1, shape2);
                    intersectionOp.Build();
                    result = new this.oc.BRepAlgoAPI_Cut_1(unionOp.Shape(), intersectionOp.Shape());
                    break;
                default:
                    throw new Error(`عملية منطقية غير مدعومة: ${operation}`);
            }
            
            result.Build();
            
            if (!result.IsDone()) {
                throw new Error(`فشلت العملية المنطقية: ${operation}`);
            }
            
            const resultShape = result.Shape();
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, resultShape);
            this.shapeMetadata.set(handle, {
                type: GeometryType.SOLID,
                created: Date.now(),
                operation,
                operands: [shape1Handle, shape2Handle]
            });
            
            this.logger.debug(`تم إجراء عملية ${operation} - Handle: ${handle}`);
            return handle;
        });
    }

    // ==================== التحويلات الهندسية ====================

    public translateShape(shapeHandle: OCShapeHandle, translation: Vector3D): OCShapeHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('translate', () => {
            const shape = this.getShape(shapeHandle);
            
            const translationVec = new this.oc.gp_Vec_1(translation.x, translation.y, translation.z);
            const transform = new this.oc.gp_Trsf_1();
            transform.SetTranslation_1(translationVec);
            
            const transformOp = new this.oc.BRepBuilderAPI_Transform_2(shape, transform);
            transformOp.Build();
            
            if (!transformOp.IsDone()) {
                translationVec.delete(); transform.delete();
                throw new Error('فشل في تحريك الشكل');
            }
            
            const resultShape = transformOp.Shape();
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, resultShape);
            this.shapeMetadata.set(handle, {
                ...this.shapeMetadata.get(shapeHandle),
                created: Date.now(),
                transformation: 'translation',
                translationVector: translation
            });
            
            translationVec.delete(); transform.delete();
            
            this.logger.debug(`تم تحريك الشكل - Handle: ${handle}`);
            return handle;
        });
    }

    public rotateShape(shapeHandle: OCShapeHandle, axis: Point3D, direction: Vector3D, angle: number): OCShapeHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('rotate', () => {
            const shape = this.getShape(shapeHandle);
            
            const axisPnt = new this.oc.gp_Pnt_1(axis.x, axis.y, axis.z);
            const axisDir = new this.oc.gp_Dir_1(direction.x, direction.y, direction.z);
            const rotationAxis = new this.oc.gp_Ax1_2(axisPnt, axisDir);
            
            const transform = new this.oc.gp_Trsf_1();
            transform.SetRotation_1(rotationAxis, angle);
            
            const transformOp = new this.oc.BRepBuilderAPI_Transform_2(shape, transform);
            transformOp.Build();
            
            if (!transformOp.IsDone()) {
                axisPnt.delete(); axisDir.delete(); rotationAxis.delete(); transform.delete();
                throw new Error('فشل في دوران الشكل');
            }
            
            const resultShape = transformOp.Shape();
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, resultShape);
            this.shapeMetadata.set(handle, {
                ...this.shapeMetadata.get(shapeHandle),
                created: Date.now(),
                transformation: 'rotation',
                rotationAxis: axis,
                rotationDirection: direction,
                rotationAngle: angle
            });
            
            axisPnt.delete(); axisDir.delete(); rotationAxis.delete(); transform.delete();
            
            this.logger.debug(`تم دوران الشكل - زاوية: ${angle} راديان - Handle: ${handle}`);
            return handle;
        });
    }

    public scaleShape(shapeHandle: OCShapeHandle, center: Point3D, scaleFactor: number): OCShapeHandle {
        this.ensureInitialized();
        return this.executeWithProfiling('scale', () => {
            if (scaleFactor <= 0) {
                throw new Error('معامل التكبير يجب أن يكون أكبر من صفر');
            }
            
            const shape = this.getShape(shapeHandle);
            
            const centerPnt = new this.oc.gp_Pnt_1(center.x, center.y, center.z);
            const transform = new this.oc.gp_Trsf_1();
            transform.SetScale_1(centerPnt, scaleFactor);
            
            const transformOp = new this.oc.BRepBuilderAPI_Transform_2(shape, transform);
            transformOp.Build();
            
            if (!transformOp.IsDone()) {
                centerPnt.delete(); transform.delete();
                throw new Error('فشل في تكبير الشكل');
            }
            
            const resultShape = transformOp.Shape();
            const handle = this.getNextHandle();
            this.shapeCache.set(handle, resultShape);
            this.shapeMetadata.set(handle, {
                ...this.shapeMetadata.get(shapeHandle),
                created: Date.now(),
                transformation: 'scale',
                scaleCenter: center,
                scaleFactor
            });
            
            centerPnt.delete(); transform.delete();
            
            this.logger.debug(`تم تكبير الشكل - معامل: ${scaleFactor} - Handle: ${handle}`);
            return handle;
        });
    }

    // ==================== التشبيك والتصدير ====================

    public tessellateShape(shapeHandle: OCShapeHandle, params: TessellationParams): TessellationResult {
        this.ensureInitialized();
        return this.executeWithProfiling('tessellate', () => {
            const shape = this.getShape(shapeHandle);
            
            if (!shape) {
                throw new Error('شكل غير صالح للتحويل');
            }
            
            // تطبيق التشبيك
            const mesh = new this.oc.BRepMesh_IncrementalMesh_2(
                shape, 
                params.deflection, 
                params.relative || false, 
                params.angleDeflection || 0.5, 
                params.inParallel || true
            );
            
            // استخراج البيانات
            const vertices: number[] = [];
            const indices: number[] = [];
            const normals: number[] = [];
            
            // التكرار عبر الوجوه واستخراج البيانات
            const explorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE);
            let vertexIndex = 0;
            
            while (explorer.More()) {
                const face = this.oc.TopoDS.Face_1(explorer.Current());
                const location = new this.oc.TopLoc_Location_1();
                const triangulation = this.oc.BRep_Tool.Triangulation(face, location);
                
                if (!triangulation.IsNull()) {
                    const transform = location.Transformation();
                    const nodeCount = triangulation.NbNodes();
                    const triangleCount = triangulation.NbTriangles();
                    
                    // استخراج الرؤوس
                    for (let i = 1; i <= nodeCount; i++) {
                        const node = triangulation.Node(i);
                        const transformedNode = node.Transformed(transform);
                        
                        vertices.push(transformedNode.X(), transformedNode.Y(), transformedNode.Z());
                        
                        // حساب العادي (مبسط)
                        normals.push(0, 0, 1);
                    }
                    
                    // استخراج المثلثات
                    for (let i = 1; i <= triangleCount; i++) {
                        const triangle = triangulation.Triangle(i);
                        const [n1, n2, n3] = [triangle.Value(1), triangle.Value(2), triangle.Value(3)];
                        
                        indices.push(
                            vertexIndex + n1 - 1,
                            vertexIndex + n2 - 1,
                            vertexIndex + n3 - 1
                        );
                    }
                    
                    vertexIndex += nodeCount;
                }
                
                explorer.Next();
            }
            
            this.logger.debug(`تم تحويل الشكل إلى شبكة: ${vertices.length/3} رؤوس، ${indices.length/3} مثلثات`);
            
            return {
                vertices: new Float32Array(vertices),
                indices: new Uint32Array(indices),
                normals: new Float32Array(normals)
            };
        });
    }

    // ==================== حساب الخصائص ====================

    public getShapeInfo(shapeHandle: OCShapeHandle): GeometryInfo {
        this.ensureInitialized();
        return this.executeWithProfiling('getShapeInfo', () => {
            const shape = this.getShape(shapeHandle);
            const metadata = this.shapeMetadata.get(shapeHandle);
            
            // حساب الحدود
            const bbox = new this.oc.Bnd_Box_1();
            this.oc.BRepBndLib.Add(shape, bbox, false);
            
            let boundingBox: BoundingBox;
            if (!bbox.IsVoid()) {
                const min = bbox.CornerMin();
                const max = bbox.CornerMax();
                
                boundingBox = {
                    min: { x: min.X(), y: min.Y(), z: min.Z() },
                    max: { x: max.X(), y: max.Y(), z: max.Z() },
                    center: {
                        x: (min.X() + max.X()) / 2,
                        y: (min.Y() + max.Y()) / 2,
                        z: (min.Z() + max.Z()) / 2
                    },
                    dimensions: {
                        x: max.X() - min.X(),
                        y: max.Y() - min.Y(),
                        z: max.Z() - min.Z()
                    }
                };
                
                min.delete(); max.delete();
            } else {
                boundingBox = {
                    min: { x: 0, y: 0, z: 0 },
                    max: { x: 0, y: 0, z: 0 },
                    center: { x: 0, y: 0, z: 0 },
                    dimensions: { x: 0, y: 0, z: 0 }
                };
            }
            
            bbox.delete();
            
            // حساب الطوبولوجيا
            const topology = this.calculateTopology(shape);
            
            // حساب الخصائص الفيزيائية
            let volume: number | undefined;
            let surfaceArea: number | undefined;
            let centroid: Point3D | undefined;
            
            try {
                // حساب الحجم (للأجسام الصلبة)
                if (metadata?.type === GeometryType.SOLID) {
                    const gprops = new this.oc.GProp_GProps_1();
                    this.oc.BRepGProp.VolumeProperties_1(shape, gprops);
                    volume = gprops.Mass();
                    
                    const centerOfMass = gprops.CentreOfMass();
                    centroid = {
                        x: centerOfMass.X(),
                        y: centerOfMass.Y(),
                        z: centerOfMass.Z()
                    };
                    
                    gprops.delete();
                    centerOfMass.delete();
                }
                
                // حساب المساحة السطحية
                const surfaceProps = new this.oc.GProp_GProps_1();
                this.oc.BRepGProp.SurfaceProperties_1(shape, surfaceProps);
                surfaceArea = surfaceProps.Mass();
                surfaceProps.delete();
                
            } catch (error) {
                this.logger.warn('فشل حساب الخصائص الفيزيائية:', error);
            }
            
            return {
                volume,
                surfaceArea,
                centroid,
                boundingBox,
                topology
            };
        });
    }

    private calculateTopology(shape: any): { vertices: number; edges: number; faces: number; shells: number; solids: number } {
        const topology = { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 };
        
        try {
            // عد الرؤوس
            const vertexExplorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX);
            while (vertexExplorer.More()) {
                topology.vertices++;
                vertexExplorer.Next();
            }
            
            // عد الحواف
            const edgeExplorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_EDGE);
            while (edgeExplorer.More()) {
                topology.edges++;
                edgeExplorer.Next();
            }
            
            // عد الوجوه
            const faceExplorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_FACE);
            while (faceExplorer.More()) {
                topology.faces++;
                faceExplorer.Next();
            }
            
            // عد الأصداف
            const shellExplorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_SHELL);
            while (shellExplorer.More()) {
                topology.shells++;
                shellExplorer.Next();
            }
            
            // عد الأجسام الصلبة
            const solidExplorer = new this.oc.TopExp_Explorer_2(shape, this.oc.TopAbs_ShapeEnum.TopAbs_SOLID);
            while (solidExplorer.More()) {
                topology.solids++;
                solidExplorer.Next();
            }
            
        } catch (error) {
            this.logger.warn('فشل حساب الطوبولوجيا:', error);
        }
        
        return topology;
    }

    // ==================== إدارة الذاكرة والأداء ====================

    public deleteShape(handle: OCShapeHandle): void {
        if (this.shapeCache.has(handle)) {
            const shape = this.shapeCache.get(handle);
            
            try {
                if (shape && typeof shape.delete === 'function') {
                    shape.delete();
                    this.stats.memoryDeallocations++;
                }
            } catch (error) {
                this.logger.warn(`فشل حذف الشكل ${handle}:`, error);
            }
            
            this.shapeCache.delete(handle);
            this.shapeMetadata.delete(handle);
            this.logger.debug(`تم حذف الشكل: ${handle}`);
        }
    }

    public clearCache(): void {
        this.shapeCache.forEach((_shape, handle) => {
            this.deleteShape(handle);
        });
        
        this.shapeCache.clear();
        this.shapeMetadata.clear();
        this.logger.info('تم مسح ذاكرة التخزين المؤقت');
    }

    public getStats(): typeof this.stats {
        return { ...this.stats };
    }

    public getMemoryUsage(): { current: number; max: number; cacheSize: number } {
        return {
            current: this.memoryUsage,
            max: this.maxMemoryUsage,
            cacheSize: this.shapeCache.size
        };
    }

    // ==================== دوال مساعدة ====================

    private ensureInitialized(): void {
        if (!this.initialized || !this.oc) {
            throw new Error('GeometryEngine غير مهيأ - استدع initialize() أولاً');
        }
    }

    private getShape(handle: OCHandle): any {
        const shape = this.shapeCache.get(handle);
        if (!shape) {
            this.stats.cacheMisses++;
            throw new Error(`لم يتم العثور على الشكل بالمعرف: ${handle}`);
        }
        this.stats.cacheHits++;
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

    private calculateDistance(p1: Point3D, p2: Point3D): number {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }

    private executeWithProfiling<T>(operationName: string, operation: () => T): T {
        const startTime = performance.now();
        
        try {
            this.stats.operationsCount++;
            this.stats.memoryAllocations++;
            
            const result = operation();
            
            const endTime = performance.now();
            const operationTime = endTime - startTime;
            
            // تحديث متوسط وقت العمليات
            this.stats.averageOperationTime = 
                (this.stats.averageOperationTime * (this.stats.operationsCount - 1) + operationTime) / 
                this.stats.operationsCount;
            
            if (operationTime > 100) { // تحذير للعمليات البطيئة
                this.logger.warn(`عملية بطيئة: ${operationName} استغرقت ${operationTime.toFixed(2)}ms`);
            }
            
            return result;
            
        } catch (error) {
            const endTime = performance.now();
            this.logger.error(`فشلت العملية ${operationName} بعد ${(endTime - startTime).toFixed(2)}ms:`, error);
            throw error;
        }
    }

    public isReady(): boolean {
        return this.initialized && this.oc !== null;
    }

    public dispose(): void {
        try {
            this.clearCache();
            this.oc = null;
            this.initialized = false;
            this.initPromise = null;
            
            this.logger.info('تم تنظيف GeometryEngine');
        } catch (error) {
            this.logger.error('خطأ أثناء تنظيف GeometryEngine:', error);
        }
    }

    public getEngineInfo(): {
        initialized: boolean;
        shapeCount: number;
        nextHandle: number;
        stats: {
            operationsCount: number;
            cacheHits: number;
            cacheMisses: number;
            memoryAllocations: number;
            memoryDeallocations: number;
            averageOperationTime: number;
        };
        memoryUsage: { current: number; max: number; cacheSize: number };
    } {
        return {
            initialized: this.initialized,
            shapeCount: this.shapeCache.size,
            nextHandle: this.nextHandle,
            stats: this.getStats(),
            memoryUsage: this.getMemoryUsage()
        };
    }
}