import {
    WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera,
    GridHelper, AxesHelper, AmbientLight, DirectionalLight,
    Vector3, Vector2, Raycaster, Color, Line as ThreeLine, BufferGeometry,
    MeshStandardMaterial, Mesh,
    TextureLoader, Object3D, Plane, Fog,
    BufferAttribute, LineBasicMaterial, Clock
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// الواردات من النظام الجديد
import { GeometryEngine, TessellationParams } from '../core/GeometryEngine';
import { Logger } from '../core/Logger';
import { GeometricObject } from '../models/GeometricObject';
import { Line } from '../models/Line';
import { Wall } from '../models/Wall';
import { Circle } from '../models/Circle';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Constants } from '../core/Constants';
import { CommandManager } from '../core/CommandManager';
import { BuildingElement } from '../models/BuildingElement';

// نوع دالة الاستماع للأحداث
type EventListener = (data: any) => void;

// واجهة لنتيجة البحث عن أقرب جدار
interface WallIntersection {
    wall: Wall;
    point: Vector3;
    distance: number;
}

export enum ViewMode {
    WIREFRAME = 'wireframe',
    SHADED = 'shaded',
    RENDERED = 'rendered',
    XRAY = 'xray'
}

export enum ViewOrientation {
    TOP = 'top',
    BOTTOM = 'bottom',
    FRONT = 'front',
    BACK = 'back',
    LEFT = 'left',
    RIGHT = 'right',
    ISOMETRIC = 'isometric'
}

// واجهة إعدادات العرض
export interface ViewSettings {
    showGrid: boolean;
    showAxes: boolean;
    showBoundingBoxes?: boolean;
    showNormals?: boolean;
    showWireframe?: boolean;
    enableShadows?: boolean;
    enableAntialiasing?: boolean;
    backgroundColor?: Color;
    ambientLightIntensity?: number;
    directionalLightIntensity?: number;
    gridSize?: number;
    gridDivisions?: number;
}

// واجهة إحصائيات الأداء
export interface PerformanceStats {
    fps: number;
    renderTime: number;
    triangleCount: number;
    drawCalls: number;
    memoryUsage: number;
    objectCount: number;
}

/**
 * Viewer - المكون الرئيسي لعرض وإدارة المشهد ثلاثي الأبعاد
 * 
 * هذا المكون مسؤول عن:
 * - عرض الكيانات الهندسية في مشهد Three.js
 * - إدارة التفاعل مع المستخدم (الماوس، لوحة المفاتيح)
 * - التكامل مع GeometryEngine لإنشاء الأشكال
 * - إدارة الكاميرات والإضاءة والمواد
 */
export class Viewer {
    private container: HTMLElement;
    private renderer!: WebGLRenderer;
    private scene2D!: Scene;
    private scene3D!: Scene;
    private camera2D!: OrthographicCamera;
    private camera3D!: PerspectiveCamera;
    private controls2D!: OrbitControls;
    private controls3D!: OrbitControls;
    private is2D: boolean = true;
    
    // المحرك الهندسي ونظام التسجيل
    private geometryEngine: GeometryEngine;
    private logger: Logger;
    
    // نظام إدارة الكائنات الهندسية
    private geometricObjects: Map<string, GeometricObject> = new Map();
    // نستخدم Mesh بدلاً من Object3D لأننا نتعامل مع خصائص geometry و material
    private objectMeshes2D: Map<string, Mesh[]> = new Map();
    private objectMeshes3D: Map<string, Mesh> = new Map();
    
    // عناصر البناء (أبواب ونوافذ)
    private buildingElements: Map<string, BuildingElement> = new Map();
    private elementMeshes2D: Map<string, Mesh> = new Map();
    private elementMeshes3D: Map<string, Mesh> = new Map();
    
    // حالة الرسم
    private isDrawing: boolean = false;
    private currentStartPoint: Vector3 | null = null;
    private previewLine: ThreeLine | null = null;
    
    // أنظمة مساعدة
    private commandManager: CommandManager = new CommandManager();
    private currentTool: 'line' | 'wall' | 'door' | 'window' = 'line';
    private snapSystem: SnapSystem | undefined;
    private measurementSystem!: MeasurementSystem;
    private raycaster: Raycaster = new Raycaster();
    private mouse: Vector2 = new Vector2();
    private intersectionPlane: Plane;
    
    // نظام الأحداث
    private eventListeners: Map<string, EventListener[]> = new Map();
    
    // محمل النسيج
    private textureLoader: TextureLoader = new TextureLoader();
    
    // حالة التهيئة
    private initialized: boolean = false;

    // إعدادات العرض
    private viewSettings: ViewSettings = {
        showGrid: true,
        showAxes: true,
        showBoundingBoxes: false,
        showNormals: false,
        showWireframe: false,
        enableShadows: true,
        enableAntialiasing: true,
        backgroundColor: new Color(0xf5f5f5),
        ambientLightIntensity: 0.6,
        directionalLightIntensity: 0.4,
        gridSize: 50,
        gridDivisions: 50
    };

    // إضاءة
    private lights: {
        ambient?: AmbientLight;
        directional?: DirectionalLight;
    } = {};

    // ساعة وإحصائيات الأداء
    private clock: Clock = new Clock();
    private performanceStats: PerformanceStats = {
        fps: 0,
        renderTime: 0,
        triangleCount: 0,
        drawCalls: 0,
        memoryUsage: 0,
        objectCount: 0
    };
    private frameCount: number = 0;
    private lastTime: number = 0;

    constructor(container: HTMLElement) {
        console.log('CORE VIEWER: Constructor called.');
        this.container = container;
        this.intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);
        
        // الحصول على المثيلات
        this.geometryEngine = GeometryEngine.getInstance();
        this.logger = Logger.getInstance();
        
        console.log('CORE VIEWER: Instance partially created, \'this\' is:', this);
        
        // تهيئة المكونات
        this.initializeAsync();
    }

    /**
     * التهيئة غير المتزامنة
     * ننتظر تهيئة GeometryEngine قبل إنشاء باقي المكونات
     */
    private async initializeAsync(): Promise<void> {
        try {
            console.log('CORE VIEWER: initializeAsync - START');
            this.logger.info('بدء تهيئة Viewer...');
            
            // تهيئة المحرك الهندسي
            await this.geometryEngine.initialize();
            console.log('CORE VIEWER: initializeAsync - GeometryEngine initialized.');
            
            // إنشاء المكونات الأساسية
            this.renderer = this.createRenderer();
            console.log('CORE VIEWER: initializeAsync - Renderer created.');
            
            this.scene2D = this.createScene2D();
            this.scene3D = this.createScene3D();
            console.log('CORE VIEWER: initializeAsync - Scenes created.');
            
            this.camera2D = this.createCamera2D();
            this.camera3D = this.createCamera3D();
            console.log('CORE VIEWER: initializeAsync - Cameras created. camera2D:', this.camera2D, 'camera3D:', this.camera3D);
            
            this.controls2D = this.createControls2D();
            this.controls3D = this.createControls3D();
            console.log('CORE VIEWER: initializeAsync - Controls created.');
            console.log('CORE VIEWER: initializeAsync - Lighting created.');
            
            // إنشاء الأنظمة المساعدة
            this.snapSystem = new SnapSystem();
            this.measurementSystem = new MeasurementSystem(
                this.container,
                this.is2D ? this.camera2D : this.camera3D
            );
            
            console.log('CORE VIEWER: initializeAsync - Internal systems created.');
            
            // الإعداد الأولي
            this.setup();
            this.animate();
            
            console.log('CORE VIEWER: initializeAsync - Setup methods called.');
            
            this.initialized = true;
            console.log('CORE VIEWER: initializeAsync - COMPLETING. \'initialized\' flag set to true. Instance \'this\':', this);
            console.log('CORE VIEWER: initializeAsync - typeof this.getCurrentCamera:', typeof this.getCurrentCamera);
            this.logger.info('تم تهيئة Viewer بنجاح');
            
            // إضافة بعض الأشكال للاختبار
            this.addTestShapes();
            
            console.log('CORE VIEWER: initializeAsync completed successfully.');
            
        } catch (error) {
            this.logger.error('فشلت تهيئة Viewer:', error);
            throw error;
        }
    }

    // إعداد المشاهد
    private setup(): void {
        // إضافة المحرك للحاوي
        this.container.appendChild(this.renderer.domElement);
        
        // إعداد أحداث الماوس
        this.setupMouseEvents();
        
        // إعداد أحداث لوحة المفاتيح
        this.setupKeyboardEvents();
        
        // إضافة عناصر المشهد
        this.setupScenes();
        
        // معالج تغيير حجم النافذة
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    // إنشاء المحرك
    private createRenderer(): WebGLRenderer {
        const renderer = new WebGLRenderer({ antialias: true });
        renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        return renderer;
    }

    // إنشاء مشهد 2D
    private createScene2D(): Scene {
        const scene = new Scene();
        scene.background = new Color(0xf5f5f5);
        return scene;
    }

    // إنشاء مشهد 3D
    private createScene3D(): Scene {
        const scene = new Scene();
        scene.background = new Color(0x222222);
        scene.fog = new Fog(0x222222, 50, 200);
        return scene;
    }

    // إنشاء كاميرا 2D
    private createCamera2D(): OrthographicCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = Constants.CAMERA.FRUSTUM_SIZE_2D;
        const camera = new OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            Constants.CAMERA.NEAR,
            Constants.CAMERA.FAR
        );
        camera.position.set(0, 0, 10);
        return camera;
    }

    // إنشاء كاميرا 3D
    private createCamera3D(): PerspectiveCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const camera = new PerspectiveCamera(
            Constants.CAMERA.FOV_3D,
            aspect,
            Constants.CAMERA.NEAR,
            Constants.CAMERA.FAR
        );
        camera.position.set(30, 30, 30);
        camera.lookAt(0, 0, 0);
        return camera;
    }

    // إنشاء أدوات التحكم 2D
    private createControls2D(): OrbitControls {
        const controls = new OrbitControls(this.camera2D, this.renderer.domElement);
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.panSpeed = Constants.CONTROLS.PAN_SPEED;
        controls.zoomSpeed = Constants.CONTROLS.ZOOM_SPEED;
        controls.update();
        return controls;
    }

    // إنشاء أدوات التحكم 3D
    private createControls3D(): OrbitControls {
        const controls = new OrbitControls(this.camera3D, this.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = Constants.CONTROLS.DAMPING_FACTOR;
        controls.panSpeed = Constants.CONTROLS.PAN_SPEED;
        controls.zoomSpeed = Constants.CONTROLS.ZOOM_SPEED;
        controls.update();
        return controls;
    }

    // إعداد المشاهد
    private setupScenes(): void {
        // إضافة الشبكة والمحاور لكلا المشهدين
        [this.scene2D, this.scene3D].forEach(scene => {
            // شبكة
            const grid = new GridHelper(
                this.viewSettings.gridSize! * this.viewSettings.gridDivisions!,
                this.viewSettings.gridDivisions!,
                Constants.GRID.COLOR,
                Constants.GRID.COLOR
            );
            grid.name = 'gridHelper';
            
            if (scene === this.scene2D) {
                grid.rotation.x = Math.PI / 2;
            }
            
            scene.add(grid);
            
            // محاور
            const axes = new AxesHelper(5);
            axes.name = 'axesHelper';
            scene.add(axes);
            
            // إضاءة
            this.lights.ambient = new AmbientLight(0xffffff, this.viewSettings.ambientLightIntensity);
            scene.add(this.lights.ambient);
            
            this.lights.directional = new DirectionalLight(0xffffff, this.viewSettings.directionalLightIntensity);
            this.lights.directional.position.set(10, 10, 10);
            this.lights.directional.castShadow = true;
            scene.add(this.lights.directional);
        });
    }

    /**
     * إضافة كائن هندسي للمشهد
     * هذه الدالة تتعامل مع التكامل بين GeometricObject و Three.js
     */
    private async addGeometricObject(object: GeometricObject): Promise<void> {
        try {
            // حفظ الكائن
            this.geometricObjects.set(object.id, object);
            
            // الحصول على الشكل من OpenCASCADE
            const ocHandle = object.getOCShape();
            
            // تحويل إلى شبكة مثلثية
            const tessellationParams: TessellationParams = {
                deflection: 0.1,
                angleDeflection: 0.5
            };
            
            const meshData = this.geometryEngine.tessellateShape(ocHandle, tessellationParams);
            
            // إنشاء هندسة Three.js
            const geometry = new BufferGeometry();
            geometry.setAttribute('position', new BufferAttribute(meshData.vertices, 3));
            geometry.setIndex(Array.from(meshData.indices));
            
            if (meshData.normals) {
                geometry.setAttribute('normal', new BufferAttribute(meshData.normals, 3));
            } else {
                geometry.computeVertexNormals();
            }
            
            // إنشاء المادة بناءً على خصائص الكائن
            const visualProps = object.visualProperties;
            const material = new MeshStandardMaterial({
                color: visualProps.color,
                opacity: visualProps.opacity,
                transparent: visualProps.opacity < 1
            });
            
            // إنشاء الشبكة
            const mesh = new Mesh(geometry, material);
            mesh.userData.objectId = object.id;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // تطبيق التحويلات
            const transform = object.transform;
            mesh.position.set(
                transform.translation.x,
                transform.translation.y,
                transform.translation.z
            );
            
            // إضافة للمشهد المناسب
            if (this.is2D) {
                this.scene2D.add(mesh);
                this.objectMeshes2D.set(object.id, [mesh]);
            } else {
                this.scene3D.add(mesh);
                this.objectMeshes3D.set(object.id, mesh);
            }
            
            this.logger.debug(`تم إضافة كائن هندسي للمشهد: ${object.id}`);
            
            // إرسال حدث
            this.emit('objectAdded', object);
            
        } catch (error) {
            this.logger.error(`فشل إضافة الكائن الهندسي: ${object.id}`, error);
            throw error;
        }
    }

    /**
     * إضافة أشكال اختبارية
     * هذه الدالة توضح كيفية استخدام النظام الجديد
     */
    private async addTestShapes(): Promise<void> {
        try {
            // إنشاء خطوط اختبارية
            const line1 = new Line(
                { x: -10, y: -10, z: 0 },
                { x: 10, y: -10, z: 0 }
            );
            
            const line2 = new Line(
                { x: 10, y: -10, z: 0 },
                { x: 10, y: 10, z: 0 }
            );
            
            const line3 = new Line(
                { x: 10, y: 10, z: 0 },
                { x: -10, y: 10, z: 0 }
            );
            
            const line4 = new Line(
                { x: -10, y: 10, z: 0 },
                { x: -10, y: -10, z: 0 }
            );
            
            // إضافة الخطوط للمشهد
            await this.addGeometricObject(line1);
            await this.addGeometricObject(line2);
            await this.addGeometricObject(line3);
            await this.addGeometricObject(line4);
            
            this.logger.info('تم إضافة الأشكال الاختبارية');
            
        } catch (error) {
            this.logger.error('فشل إضافة الأشكال الاختبارية:', error);
        }
    }

    // باقي الدوال المساعدة...
    
    private setupMouseEvents(): void {
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    private setupKeyboardEvents(): void {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDrawing) {
                this.cancelDrawing();
            }
            
            if (e.key === 'Delete') {
                this.deleteSelectedObjects();
            }
        });
    }

    private onMouseMove(e: MouseEvent): void {
        this.updateMousePosition(e);
        // تحديث المعاينة والتمييز...
    }

    private onMouseDown(e: MouseEvent): void {
        if (e.button === 0 && this.is2D) {
            this.handleLeftClick();
        } else if (e.button === 2) {
            if (this.isDrawing) {
                this.cancelDrawing();
            } else {
                this.handleRightClick();
            }
        }
    }

    private onMouseUp(_e: MouseEvent): void {
        // معالج رفع الماوس
    }

    private handleLeftClick(): void {
        // معالج النقر الأيسر
    }

    private handleRightClick(): void {
        // معالج النقر الأيمن
    }

    private cancelDrawing(): void {
        this.isDrawing = false;
        this.currentStartPoint = null;
        
        if (this.previewLine) {
            this.scene2D.remove(this.previewLine);
            this.previewLine = null;
        }
    }

    private deleteSelectedObjects(): void {
        this.geometricObjects.forEach(obj => {
            if (obj.selected) {
                this.removeGeometricObject(obj.id);
            }
        });
    }

    private removeGeometricObject(objectId: string): void {
        const object = this.geometricObjects.get(objectId);
        if (!object) return;
        
        // إزالة من القائمة
        this.geometricObjects.delete(objectId);
        
        // إزالة التمثيل المرئي
        const meshes2D = this.objectMeshes2D.get(objectId);
        if (meshes2D) {
            meshes2D.forEach(mesh => {
                this.scene2D.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            });
            this.objectMeshes2D.delete(objectId);
        }
        
        const mesh3D = this.objectMeshes3D.get(objectId);
        if (mesh3D) {
            this.scene3D.remove(mesh3D);
            mesh3D.geometry.dispose();
            if (Array.isArray(mesh3D.material)) {
                mesh3D.material.forEach(m => m.dispose());
            } else {
                mesh3D.material.dispose();
            }
            this.objectMeshes3D.delete(objectId);
        }
        
        // تنظيف الكائن
        object.dispose();
        
        this.emit('objectRemoved', object);
    }

    private updateMousePosition(e: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        
        // تحديث الإحصائيات
        this.updatePerformanceStats();
        
        if (this.is2D) {
            this.controls2D.update();
        } else {
            this.controls3D.update();
        }
        
        this.render();
    }

    private render(): void {
        if (this.is2D) {
            this.renderer.render(this.scene2D, this.camera2D);
        } else {
            this.renderer.render(this.scene3D, this.camera3D);
        }
    }

    private onWindowResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        
        this.renderer.setSize(width, height);
        
        // تحديث الكاميرا 2D
        const frustumSize = Constants.CAMERA.FRUSTUM_SIZE_2D;
        this.camera2D.left = -frustumSize * aspect / 2;
        this.camera2D.right = frustumSize * aspect / 2;
        this.camera2D.top = frustumSize / 2;
        this.camera2D.bottom = -frustumSize / 2;
        this.camera2D.updateProjectionMatrix();
        
        // تحديث الكاميرا 3D
        this.camera3D.aspect = aspect;
        this.camera3D.updateProjectionMatrix();
        
        this.render();
    }

    // تحديث إحصائيات الأداء
    private updatePerformanceStats(): void {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= this.lastTime + 1000) { // كل ثانية
            this.performanceStats.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            // تحديث باقي الإحصائيات
            this.performanceStats.renderTime = this.clock.getDelta() * 1000;
            this.performanceStats.objectCount = this.geometricObjects.size;
            
            if (this.renderer.info) {
                this.performanceStats.triangleCount = this.renderer.info.render.triangles;
                this.performanceStats.drawCalls = this.renderer.info.render.calls;
            }
            
            // حساب استخدام الذاكرة (تقريبي)
            if ((performance as any).memory) {
                this.performanceStats.memoryUsage = (performance as any).memory.usedJSHeapSize;
            }
        }
    }

    // نظام الأحداث
    public on(event: string, listener: EventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    public off(event: string, listener: EventListener): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emit(event: string, data: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => listener(data));
        }
    }

    // دوال عامة
    public setView(is2D: boolean): void {
        this.is2D = is2D;
        this.measurementSystem.updateCamera(is2D ? this.camera2D : this.camera3D);
        this.emit('viewChanged', is2D);
    }

    public setCurrentTool(tool: 'line' | 'wall' | 'door' | 'window'): void {
        this.currentTool = tool;
        this.cancelDrawing();
    }

    /**
     * تعيين اتجاه العرض للكاميرا
     */
    public setViewOrientation(orientation: ViewOrientation): void {
        const distance = 50;
        let position: Vector3;
        let up = new Vector3(0, 1, 0);

        switch (orientation) {
            case ViewOrientation.TOP:
                position = new Vector3(0, distance, 0);
                up = new Vector3(0, 0, -1);
                break;
            case ViewOrientation.BOTTOM:
                position = new Vector3(0, -distance, 0);
                up = new Vector3(0, 0, 1);
                break;
            case ViewOrientation.FRONT:
                position = new Vector3(0, 0, distance);
                break;
            case ViewOrientation.BACK:
                position = new Vector3(0, 0, -distance);
                break;
            case ViewOrientation.LEFT:
                position = new Vector3(-distance, 0, 0);
                break;
            case ViewOrientation.RIGHT:
                position = new Vector3(distance, 0, 0);
                break;
            case ViewOrientation.ISOMETRIC:
                position = new Vector3(distance, distance, distance);
                break;
        }

        if (this.is2D && this.camera2D) {
            this.camera2D.position.copy(position);
            this.camera2D.up.copy(up);
            this.camera2D.lookAt(0, 0, 0);
            this.camera2D.updateProjectionMatrix();
            this.controls2D.update();
        } else if (!this.is2D && this.camera3D) {
            this.camera3D.position.copy(position);
            this.camera3D.up.copy(up);
            this.camera3D.lookAt(0, 0, 0);
            this.camera3D.updateProjectionMatrix();
            this.controls3D.update();
        }

        this.render();
        this.emit('viewOrientationChanged', orientation);
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * الحصول على الكاميرا الحالية
     */
    public getCurrentCamera(): PerspectiveCamera | OrthographicCamera {
        return this.is2D ? this.camera2D : this.camera3D;
    }

    /**
     * الحصول على إحصائيات الأداء
     */
    public getPerformanceStats(): PerformanceStats {
        return { ...this.performanceStats };
    }

    /**
     * تحديث إعدادات العرض
     */
    public updateViewSettings(settings: Partial<ViewSettings>): void {
        Object.assign(this.viewSettings, settings);
        this.applyViewSettings();
    }

    /**
     * تطبيق إعدادات العرض
     */
    private applyViewSettings(): void {
        // تطبيق لون الخلفية
        if (this.viewSettings.backgroundColor) {
           this.scene2D.background = this.viewSettings.backgroundColor;
           this.scene3D.background = this.viewSettings.backgroundColor;
        }
        
        // تطبيق شدة الإضاءة
        if (this.viewSettings.ambientLightIntensity !== undefined && this.lights.ambient) {
           this.lights.ambient.intensity = this.viewSettings.ambientLightIntensity;
        }
        
        if (this.viewSettings.directionalLightIntensity !== undefined && this.lights.directional) {
           this.lights.directional.intensity = this.viewSettings.directionalLightIntensity;
        }
        
        // تفعيل/تعطيل الظلال
        if (this.viewSettings.enableShadows !== undefined) {
           this.renderer.shadowMap.enabled = this.viewSettings.enableShadows;
        }

        // تحديث الشبكة والمحاور
        [this.scene2D, this.scene3D].forEach(scene => {
            const gridHelper = scene.getObjectByName('gridHelper');
            if (gridHelper && this.viewSettings.showGrid !== undefined) {
                gridHelper.visible = this.viewSettings.showGrid;
            }

            const axesHelper = scene.getObjectByName('axesHelper');
            if (axesHelper && this.viewSettings.showAxes !== undefined) {
                axesHelper.visible = this.viewSettings.showAxes;
            }
        });
        
        this.logger.debug('تم تطبيق إعدادات العرض ضمن وحدة Viewer.');
    }

    /**
     * إزالة كائن هندسي (واجهة عامة)
     */
    public removeObject(objectId: string): void {
        this.removeGeometricObject(objectId);
    }

    /**
     * تحديث رؤية كائن
     */
    public setObjectVisibility(objectId: string, visible: boolean): void {
        const meshes2D = this.objectMeshes2D.get(objectId);
        if (meshes2D) {
            meshes2D.forEach(mesh => {
                mesh.visible = visible;
            });
        }

        const mesh3D = this.objectMeshes3D.get(objectId);
        if (mesh3D) {
            mesh3D.visible = visible;
        }
    }

    /**
     * تحديث لون كائن
     */
    public updateObjectColor(objectId: string, color: string): void {
        const meshes2D = this.objectMeshes2D.get(objectId);
        if (meshes2D) {
            meshes2D.forEach(mesh => {
                if (mesh.material instanceof MeshStandardMaterial) {
                    mesh.material.color.set(color);
                }
            });
        }

        const mesh3D = this.objectMeshes3D.get(objectId);
        if (mesh3D && mesh3D.material instanceof MeshStandardMaterial) {
            mesh3D.material.color.set(color);
        }
    }

    /**
     * تحديث شفافية كائن
     */
    public updateObjectOpacity(objectId: string, opacity: number): void {
        const meshes2D = this.objectMeshes2D.get(objectId);
        if (meshes2D) {
            meshes2D.forEach(mesh => {
                if (mesh.material instanceof MeshStandardMaterial) {
                    mesh.material.opacity = opacity;
                    mesh.material.transparent = opacity < 1;
                }
            });
        }

        const mesh3D = this.objectMeshes3D.get(objectId);
        if (mesh3D && mesh3D.material instanceof MeshStandardMaterial) {
            mesh3D.material.opacity = opacity;
            mesh3D.material.transparent = opacity < 1;
        }
    }
}