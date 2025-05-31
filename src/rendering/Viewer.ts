/**
 * Viewer - نظام العرض المتقدم ثلاثي الأبعاد
 * نظام عرض متكامل مع دعم كامل للتفاعل والتحكم المتقدم
 */

import {
    WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera,
    GridHelper, AxesHelper, AmbientLight, DirectionalLight, SpotLight,
    Vector3, Vector2, Raycaster, Color, Line as ThreeLine, BufferGeometry,
    MeshStandardMaterial, MeshPhongMaterial, MeshLambertMaterial, Mesh,
    TextureLoader, Object3D, Plane, Fog, Group, Box3, Sphere,
    BufferAttribute, LineBasicMaterial, LineDashedMaterial,
    EdgesGeometry, LineSegments, WireframeGeometry,
    PlaneGeometry, CylinderGeometry, SphereGeometry, BoxGeometry,
    Matrix4, Quaternion, Euler, Clock, AnimationMixer,
    PMREMGenerator, UnsignedByteType, FloatType,
    PCFSoftShadowMap, CineonToneMapping, sRGBEncoding
} from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeometryEngine, TessellationParams, Point3D, BooleanOperation } from '../core/GeometryEngine';
import { Logger } from '../core/Logger';
import { GeometricObject } from '../models/GeometricObject';
import { Line } from '../models/Line';
import { Circle } from '../models/Circle';
import { Wall } from '../models/Wall';
import { SnapSystem, SnapResult } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Constants } from '../core/Constants';
import { CommandManager } from '../core/CommandManager';
import { BuildingElement } from '../models/BuildingElement';

// أنواع العرض
export enum ViewMode {
    WIREFRAME = 'wireframe',
    SHADED = 'shaded',
    RENDERED = 'rendered',
    XRAY = 'xray'
}

export enum ProjectionMode {
    PERSPECTIVE = 'perspective',
    ORTHOGRAPHIC = 'orthographic'
}

export enum ViewOrientation {
    TOP = 'top',
    BOTTOM = 'bottom',
    FRONT = 'front',
    BACK = 'back',
    LEFT = 'left',
    RIGHT = 'right',
    ISOMETRIC = 'isometric',
    CUSTOM = 'custom'
}

// إعدادات العرض
export interface ViewSettings {
    showGrid: boolean;
    showAxes: boolean;
    showBoundingBoxes: boolean;
    showNormals: boolean;
    showWireframe: boolean;
    enableShadows: boolean;
    enableAntialiasing: boolean;
    backgroundColor: Color;
    ambientLightIntensity: number;
    directionalLightIntensity: number;
    gridSize: number;
    gridDivisions: number;
}

// إعدادات الإضاءة
export interface LightingSettings {
    ambient: {
        color: Color;
        intensity: number;
    };
    directional: {
        color: Color;
        intensity: number;
        position: Vector3;
        castShadow: boolean;
    };
    spot: {
        color: Color;
        intensity: number;
        position: Vector3;
        target: Vector3;
        angle: number;
        castShadow: boolean;
    };
}

// معلومات التفاعل
export interface InteractionInfo {
    mousePosition: Vector2;
    worldPosition: Vector3;
    hoveredObject: GeometricObject | null;
    selectedObjects: Set<GeometricObject>;
    isDragging: boolean;
    isMultiSelecting: boolean;
}

// نتيجة الاختيار
export interface SelectionResult {
    object: GeometricObject | null;
    point: Vector3;
    distance: number;
    normal?: Vector3;
}

// إحصائيات الأداء
export interface PerformanceStats {
    fps: number;
    renderTime: number;
    triangleCount: number;
    drawCalls: number;
    memoryUsage: number;
    objectCount: number;
}

// دالة استماع للأحداث
type ViewerEventListener = (data: any) => void;

/**
 * فئة Viewer المتقدمة
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
    
    // حالة العرض
    private is2D: boolean = true;
    private currentProjection: ProjectionMode = ProjectionMode.ORTHOGRAPHIC;
    private currentViewMode: ViewMode = ViewMode.SHADED;
    private currentOrientation: ViewOrientation = ViewOrientation.TOP;
    
    // الأنظمة الأساسية
    private geometryEngine: GeometryEngine;
    private logger: Logger;
    private commandManager: CommandManager;
    
    // إدارة الكائنات
    private geometricObjects: Map<string, GeometricObject> = new Map();
    private objectMeshes2D: Map<string, Mesh[]> = new Map();
    private objectMeshes3D: Map<string, Mesh[]> = new Map();
    private objectGroups: Map<string, Group> = new Map();
    
    // عناصر البناء
    private buildingElements: Map<string, BuildingElement> = new Map();
    private elementMeshes2D: Map<string, Mesh> = new Map();
    private elementMeshes3D: Map<string, Mesh> = new Map();
    
    // حالة التفاعل
    private interactionInfo: InteractionInfo = {
        mousePosition: new Vector2(),
        worldPosition: new Vector3(),
        hoveredObject: null,
        selectedObjects: new Set(),
        isDragging: false,
        isMultiSelecting: false
    };
    
    // أدوات الرسم والتفاعل
    private snapSystem: SnapSystem;
    private measurementSystem: MeasurementSystem;
    private raycaster: Raycaster = new Raycaster();
    private intersectionPlane: Plane;
    
    // إدارة الطبقات والمجموعات
    private layerGroups: Map<string, Group> = new Map();
    private selectionGroup: Group = new Group();
    private previewGroup: Group = new Group();
    private annotationGroup: Group = new Group();
    
    // الإضاءة والمواد
    private lights: {
        ambient?: AmbientLight;
        directional?: DirectionalLight;
        spot?: SpotLight;
    } = {};
    
    private materials: {
        default: MeshStandardMaterial;
        selected: MeshStandardMaterial;
        highlighted: MeshStandardMaterial;
        wireframe: MeshStandardMaterial;
        transparent: MeshStandardMaterial;
    };
    
    // إعدادات العرض
    private viewSettings: ViewSettings;
    private lightingSettings: LightingSettings;
    
    // محمل النسيج والموارد
    private textureLoader: TextureLoader = new TextureLoader();
    private pmremGenerator: PMREMGenerator;
    
    // قياس الأداء
    private clock: Clock = new Clock();
    private performanceStats: PerformanceStats = {
        fps: 0,
        renderTime: 0,
        triangleCount: 0,
        drawCalls: 0,
        memoryUsage: 0,
        objectCount: 0
    };
    
    // إدارة الأحداث
    private eventListeners: Map<string, ViewerEventListener[]> = new Map();
    
    // حالة التهيئة
    private initialized: boolean = false;
    private animationFrameId: number = 0;

    constructor(container: HTMLElement) {
        this.container = container;
        this.intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);
        
        // الحصول على المثيلات
        this.geometryEngine = GeometryEngine.getInstance();
        this.logger = Logger.getInstance();
        this.commandManager = new CommandManager();
        
        // تهيئة الإعدادات الافتراضية
        this.initializeDefaultSettings();
        
        // تهيئة المكونات
        this.initializeAsync();
    }

    /**
     * تهيئة الإعدادات الافتراضية
     */
    private initializeDefaultSettings(): void {
        this.viewSettings = {
            showGrid: true,
            showAxes: true,
            showBoundingBoxes: false,
            showNormals: false,
            showWireframe: false,
            enableShadows: true,
            enableAntialiasing: true,
            backgroundColor: new Color(0xf5f5f5),
            ambientLightIntensity: 0.4,
            directionalLightIntensity: 0.8,
            gridSize: 1,
            gridDivisions: 50
        };

        this.lightingSettings = {
            ambient: {
                color: new Color(0xffffff),
                intensity: 0.4
            },
            directional: {
                color: new Color(0xffffff),
                intensity: 0.8,
                position: new Vector3(10, 10, 10),
                castShadow: true
            },
            spot: {
                color: new Color(0xffffff),
                intensity: 0.6,
                position: new Vector3(0, 20, 0),
                target: new Vector3(0, 0, 0),
                angle: Math.PI / 4,
                castShadow: true
            }
        };

        // إنشاء المواد الأساسية
        this.materials = {
            default: new MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.2,
                roughness: 0.8
            }),
            selected: new MeshStandardMaterial({
                color: 0xff0000,
                metalness: 0.1,
                roughness: 0.9,
                emissive: 0x220000
            }),
            highlighted: new MeshStandardMaterial({
                color: 0x2196F3,
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x001122
            }),
            wireframe: new MeshStandardMaterial({
                color: 0x000000,
                wireframe: true
            }),
            transparent: new MeshStandardMaterial({
                color: 0x808080,
                transparent: true,
                opacity: 0.5
            })
        };
    }

    /**
     * التهيئة غير المتزامنة
     */
    private async initializeAsync(): Promise<void> {
        try {
            this.logger.info('بدء تهيئة Viewer المتقدم...');
            
            // انتظار تهيئة GeometryEngine
            await this.geometryEngine.initialize();
            
            // إنشاء المكونات الأساسية
            this.createRenderer();
            this.createScenes();
            this.createCameras();
            this.createControls();
            this.createLighting();
            
            // إنشاء الأنظمة المساعدة
            this.snapSystem = new SnapSystem();
            this.measurementSystem = new MeasurementSystem(
                this.container,
                this.is2D ? this.camera2D : this.camera3D
            );
            
            // الإعداد النهائي
            this.setupContainer();
            this.setupEventHandlers();
            this.setupPostProcessing();
            this.setupSceneElements();
            
            // بدء حلقة الرسم
            this.startRenderLoop();
            
            this.initialized = true;
            this.logger.info('تم تهيئة Viewer بنجاح');
            
            // إضافة محتوى اختباري
            this.addTestContent();
            
        } catch (error) {
            this.logger.error('فشلت تهيئة Viewer:', error);
            throw error;
        }
    }

    /**
     * إنشاء المحرك
     */
    private createRenderer(): void {
        this.renderer = new WebGLRenderer({ 
            antialias: this.viewSettings.enableAntialiasing,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // إعدادات الجودة المتقدمة
        this.renderer.shadowMap.enabled = this.viewSettings.enableShadows;
        this.renderer.shadowMap.type = PCFSoftShadowMap;
        this.renderer.toneMapping = CineonToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.outputEncoding = sRGBEncoding;
        
        // تحسينات الأداء
        this.renderer.info.autoReset = false;
        
        this.pmremGenerator = new PMREMGenerator(this.renderer);
    }

    /**
     * إنشاء المشاهد
     */
    private createScenes(): void {
        // مشهد 2D
        this.scene2D = new Scene();
        this.scene2D.background = this.viewSettings.backgroundColor;
        
        // مشهد 3D
        this.scene3D = new Scene();
        this.scene3D.background = this.viewSettings.backgroundColor;
        this.scene3D.fog = new Fog(this.viewSettings.backgroundColor.getHex(), 50, 200);
        
        // إضافة المجموعات المنظمة
        [this.scene2D, this.scene3D].forEach(scene => {
            scene.add(this.selectionGroup);
            scene.add(this.previewGroup);
            scene.add(this.annotationGroup);
        });
    }

    /**
     * إنشاء الكاميرات
     */
    private createCameras(): void {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        // كاميرا 2D
        const frustumSize = Constants.CAMERA.FRUSTUM_SIZE_2D;
        this.camera2D = new OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            Constants.CAMERA.NEAR,
            Constants.CAMERA.FAR
        );
        this.camera2D.position.set(0, 0, 10);
        this.camera2D.up.set(0, 1, 0);
        
        // كاميرا 3D
        this.camera3D = new PerspectiveCamera(
            Constants.CAMERA.FOV_3D,
            aspect,
            Constants.CAMERA.NEAR,
            Constants.CAMERA.FAR
        );
        this.camera3D.position.set(30, 30, 30);
        this.camera3D.lookAt(0, 0, 0);
        this.camera3D.up.set(0, 0, 1);
    }

    /**
     * إنشاء أدوات التحكم
     */
    private createControls(): void {
        // تحكم 2D
        this.controls2D = new OrbitControls(this.camera2D, this.renderer.domElement);
        this.controls2D.enableRotate = false;
        this.controls2D.enablePan = true;
        this.controls2D.panSpeed = Constants.CONTROLS.PAN_SPEED;
        this.controls2D.zoomSpeed = Constants.CONTROLS.ZOOM_SPEED;
        this.controls2D.minZoom = 0.1;
        this.controls2D.maxZoom = 100;
        
        // تحكم 3D
        this.controls3D = new OrbitControls(this.camera3D, this.renderer.domElement);
        this.controls3D.enableDamping = true;
        this.controls3D.dampingFactor = Constants.CONTROLS.DAMPING_FACTOR;
        this.controls3D.panSpeed = Constants.CONTROLS.PAN_SPEED;
        this.controls3D.zoomSpeed = Constants.CONTROLS.ZOOM_SPEED;
        this.controls3D.minDistance = 1;
        this.controls3D.maxDistance = 1000;
        this.controls3D.maxPolarAngle = Math.PI * 0.9;
        
        // أحداث التحكم
        [this.controls2D, this.controls3D].forEach(control => {
            control.addEventListener('change', () => {
                this.emit('cameraChanged', {
                    position: this.getCurrentCamera().position,
                    target: control.target
                });
            });
        });
    }

    /**
     * إنشاء الإضاءة
     */
    private createLighting(): void {
        // إضاءة محيطة
        this.lights.ambient = new AmbientLight(
            this.lightingSettings.ambient.color,
            this.lightingSettings.ambient.intensity
        );
        
        // إضاءة اتجاهية
        this.lights.directional = new DirectionalLight(
            this.lightingSettings.directional.color,
            this.lightingSettings.directional.intensity
        );
        this.lights.directional.position.copy(this.lightingSettings.directional.position);
        this.lights.directional.castShadow = this.lightingSettings.directional.castShadow;
        
        // إعدادات الظلال
        if (this.lights.directional.shadow) {
            this.lights.directional.shadow.mapSize.width = 2048;
            this.lights.directional.shadow.mapSize.height = 2048;
            this.lights.directional.shadow.camera.near = 0.5;
            this.lights.directional.shadow.camera.far = 500;
            this.lights.directional.shadow.camera.left = -50;
            this.lights.directional.shadow.camera.right = 50;
            this.lights.directional.shadow.camera.top = 50;
            this.lights.directional.shadow.camera.bottom = -50;
        }
        
        // إضاءة موضعية
        this.lights.spot = new SpotLight(
            this.lightingSettings.spot.color,
            this.lightingSettings.spot.intensity,
            100,
            this.lightingSettings.spot.angle,
            0.5,
            2
        );
        this.lights.spot.position.copy(this.lightingSettings.spot.position);
        this.lights.spot.target.position.copy(this.lightingSettings.spot.target);
        this.lights.spot.castShadow = this.lightingSettings.spot.castShadow;
        
        // إضافة الإضاءة للمشاهد
        [this.scene2D, this.scene3D].forEach(scene => {
            if (this.lights.ambient) scene.add(this.lights.ambient);
            if (this.lights.directional) scene.add(this.lights.directional);
            if (this.lights.spot) scene.add(this.lights.spot);
        });
    }

    /**
     * إعداد عناصر المشهد
     */
    private setupSceneElements(): void {
        [this.scene2D, this.scene3D].forEach(scene => {
            // الشبكة
            if (this.viewSettings.showGrid) {
                const grid = new GridHelper(
                    this.viewSettings.gridSize * this.viewSettings.gridDivisions,
                    this.viewSettings.gridDivisions,
                    0x888888,
                    0xcccccc
                );
                
                if (scene === this.scene2D) {
                    grid.rotation.x = Math.PI / 2;
                }
                
                scene.add(grid);
            }
            
            // المحاور
            if (this.viewSettings.showAxes) {
                const axes = new AxesHelper(10);
                scene.add(axes);
            }
        });
    }

    /**
     * إعداد الحاوي
     */
    private setupContainer(): void {
        this.container.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.outline = 'none';
    }

    /**
     * إعداد معالجي الأحداث
     */
    private setupEventHandlers(): void {
        // أحداث الماوس
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
        this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));
        this.renderer.domElement.addEventListener('wheel', this.onWheel.bind(this));
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // أحداث لوحة المفاتيح
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // أحداث النافذة
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // أحداث التفاعل
        this.renderer.domElement.addEventListener('dragstart', (e) => e.preventDefault());
        this.renderer.domElement.addEventListener('selectstart', (e) => e.preventDefault());
    }

    /**
     * إعداد المعالجة اللاحقة
     */
    private setupPostProcessing(): void {
        // يمكن إضافة تأثيرات ما بعد المعالجة هنا
        // مثل SSAO، Bloom، إلخ
    }

    /**
     * إضافة محتوى اختباري
     */
    private async addTestContent(): Promise<void> {
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
            
            // إنشاء دائرة اختبارية
            const circle = new Circle(
                { x: 0, y: 0, z: 0 },
                5
            );
            
            // إضافة الأشكال
            await this.addGeometricObject(line1);
            await this.addGeometricObject(line2);
            await this.addGeometricObject(line3);
            await this.addGeometricObject(line4);
            await this.addGeometricObject(circle);
            
            this.logger.info('تم إضافة المحتوى الاختباري');
            
        } catch (error) {
            this.logger.error('فشل إضافة المحتوى الاختباري:', error);
        }
    }

    /**
     * إضافة كائن هندسي
     */
    public async addGeometricObject(object: GeometricObject): Promise<void> {
        try {
            // حفظ الكائن
            this.geometricObjects.set(object.id, object);
            
            // إنشاء التمثيل المرئي
            await this.createVisualRepresentation(object);
            
            this.logger.debug(`تم إضافة كائن هندسي: ${object.id}`);
            this.emit('objectAdded', object);
            
        } catch (error) {
            this.logger.error(`فشل إضافة الكائن: ${object.id}`, error);
            throw error;
        }
    }

    /**
     * إنشاء التمثيل المرئي للكائن
     */
    private async createVisualRepresentation(object: GeometricObject): Promise<void> {
        try {
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
            
            // إنشاء المادة
            const material = this.createMaterialForObject(object);
            
            // إنشاء الشبكة
            const mesh = new Mesh(geometry, material);
            mesh.userData.objectId = object.id;
            mesh.userData.geometricObject = object;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // تطبيق التحويلات
            this.applyTransformToMesh(mesh, object);
            
            // إضافة للمشاهد
            const group2D = new Group();
            const group3D = new Group();
            
            group2D.add(mesh.clone());
            group3D.add(mesh);
            
            this.scene2D.add(group2D);
            this.scene3D.add(group3D);
            
            // حفظ المراجع
            this.objectMeshes2D.set(object.id, [group2D.children[0] as Mesh]);
            this.objectMeshes3D.set(object.id, [group3D.children[0] as Mesh]);
            this.objectGroups.set(object.id, group3D);
            
            // إضافة wireframe للعرض ثنائي الأبعاد
            if (this.is2D) {
                this.addWireframeRepresentation(object, group2D);
            }
            
        } catch (error) {
            this.logger.error(`فشل إنشاء التمثيل المرئي للكائن: ${object.id}`, error);
            throw error;
        }
    }

    /**
     * إنشاء مادة للكائن
     */
    private createMaterialForObject(object: GeometricObject): MeshStandardMaterial {
        const visualProps = object.visualProperties;
        
        return new MeshStandardMaterial({
            color: new Color(visualProps.color),
            opacity: visualProps.opacity,
            transparent: visualProps.opacity < 1,
            metalness: 0.2,
            roughness: 0.8,
            side: 2 // DoubleSide
        });
    }

    /**
     * تطبيق التحويلات على الشبكة
     */
    private applyTransformToMesh(mesh: Mesh, object: GeometricObject): void {
        const transform = object.transform;
        
        mesh.position.set(
            transform.translation.x,
            transform.translation.y,
            transform.translation.z
        );
        
        mesh.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z
        );
        
        mesh.scale.set(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z
        );
    }

    /**
     * إضافة تمثيل wireframe
     */
    private addWireframeRepresentation(object: GeometricObject, group: Group): void {
        const mesh = group.children[0] as Mesh;
        const wireframeGeometry = new EdgesGeometry(mesh.geometry);
        const wireframeMaterial = new LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 1
        });
        const wireframe = new LineSegments(wireframeGeometry, wireframeMaterial);
        
        group.add(wireframe);
    }

    // ==================== معالجة الأحداث ====================

    private onMouseMove(event: MouseEvent): void {
        this.updateMousePosition(event);
        this.updateWorldPosition();
        this.updateHoverState();
        this.emit('mouseMove', {
            mouse: this.interactionInfo.mousePosition,
            world: this.interactionInfo.worldPosition
        });
    }

    private onMouseDown(event: MouseEvent): void {
        if (event.button === 0) { // زر أيسر
            this.handleLeftMouseDown(event);
        } else if (event.button === 2) { // زر أيمن
            this.handleRightMouseDown(event);
        }
    }

    private onMouseUp(event: MouseEvent): void {
        this.interactionInfo.isDragging = false;
        this.emit('mouseUp', { button: event.button });
    }

    private onClick(event: MouseEvent): void {
        if (event.button === 0) {
            this.handleSelection(event);
        }
    }

    private onDoubleClick(event: MouseEvent): void {
        this.handleDoubleClick(event);
    }

    private onWheel(event: WheelEvent): void {
        // التحكم في التكبير
        this.emit('wheel', { delta: event.deltaY });
    }

    private onKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'Delete':
                this.deleteSelectedObjects();
                break;
            case 'Escape':
                this.clearSelection();
                break;
            case 'a':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.selectAll();
                }
                break;
        }
        
        this.emit('keyDown', { key: event.key, ctrlKey: event.ctrlKey });
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.emit('keyUp', { key: event.key });
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
        
        this.emit('resize', { width, height });
    }

    // ==================== التفاعل والاختيار ====================

    private updateMousePosition(event: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.interactionInfo.mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.interactionInfo.mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private updateWorldPosition(): void {
        this.raycaster.setFromCamera(
            this.interactionInfo.mousePosition, 
            this.getCurrentCamera()
        );
        
        const intersection = this.raycaster.ray.intersectPlane(this.intersectionPlane, new Vector3());
        if (intersection) {
            this.interactionInfo.worldPosition.copy(intersection);
        }
    }

    private updateHoverState(): void {
        const selection = this.performRaycast();
        
        // إزالة التمييز السابق
        if (this.interactionInfo.hoveredObject) {
            this.setObjectHighlight(this.interactionInfo.hoveredObject, false);
        }
        
        // تطبيق التمييز الجديد
        this.interactionInfo.hoveredObject = selection.object;
        if (selection.object) {
            this.setObjectHighlight(selection.object, true);
        }
    }

    private performRaycast(): SelectionResult {
        this.raycaster.setFromCamera(
            this.interactionInfo.mousePosition,
            this.getCurrentCamera()
        );
        
        const scene = this.getCurrentScene();
        const intersects = this.raycaster.intersectObjects(scene.children, true);
        
        for (const intersect of intersects) {
            const object = this.findGeometricObjectFromMesh(intersect.object as Mesh);
            if (object) {
                return {
                    object,
                    point: intersect.point,
                    distance: intersect.distance,
                    normal: intersect.face?.normal
                };
            }
        }
        
        return {
            object: null,
            point: new Vector3(),
            distance: Infinity
        };
    }

    private findGeometricObjectFromMesh(mesh: Mesh): GeometricObject | null {
        if (mesh.userData.geometricObject) {
            return mesh.userData.geometricObject;
        }
        
        const objectId = mesh.userData.objectId;
        if (objectId) {
            return this.geometricObjects.get(objectId) || null;
        }
        
        return null;
    }

    private handleLeftMouseDown(event: MouseEvent): void {
        this.interactionInfo.isDragging = true;
        this.emit('leftMouseDown', { 
            mouse: this.interactionInfo.mousePosition,
            world: this.interactionInfo.worldPosition
        });
    }

    private handleRightMouseDown(event: MouseEvent): void {
        this.emit('rightMouseDown', {
            mouse: this.interactionInfo.mousePosition,
            world: this.interactionInfo.worldPosition
        });
    }

    private handleSelection(event: MouseEvent): void {
        const selection = this.performRaycast();
        
        if (selection.object) {
            if (event.ctrlKey || event.metaKey) {
                // تعدد الاختيار
                this.toggleObjectSelection(selection.object);
            } else {
                // اختيار واحد
                this.clearSelection();
                this.selectObject(selection.object);
            }
        } else if (!event.ctrlKey && !event.metaKey) {
            this.clearSelection();
        }
    }

    private handleDoubleClick(event: MouseEvent): void {
        const selection = this.performRaycast();
        if (selection.object) {
            this.emit('objectDoubleClick', selection.object);
        }
    }

    // ==================== إدارة الاختيار ====================

    public selectObject(object: GeometricObject): void {
        this.interactionInfo.selectedObjects.add(object);
        this.setObjectSelection(object, true);
        this.emit('objectSelected', object);
    }

    public deselectObject(object: GeometricObject): void {
        this.interactionInfo.selectedObjects.delete(object);
        this.setObjectSelection(object, false);
        this.emit('objectDeselected', object);
    }

    public toggleObjectSelection(object: GeometricObject): void {
        if (this.interactionInfo.selectedObjects.has(object)) {
            this.deselectObject(object);
        } else {
            this.selectObject(object);
        }
    }

    public clearSelection(): void {
        this.interactionInfo.selectedObjects.forEach(object => {
            this.setObjectSelection(object, false);
        });
        this.interactionInfo.selectedObjects.clear();
        this.emit('selectionCleared');
    }

    public selectAll(): void {
        this.geometricObjects.forEach(object => {
            this.selectObject(object);
        });
    }

    private setObjectSelection(object: GeometricObject, selected: boolean): void {
        const meshes2D = this.objectMeshes2D.get(object.id);
        const meshes3D = this.objectMeshes3D.get(object.id);
        
        const meshes = this.is2D ? meshes2D : meshes3D;
        if (meshes) {
            meshes.forEach(mesh => {
                mesh.material = selected ? this.materials.selected : this.materials.default;
            });
        }
        
        object.selected = selected;
    }

    private setObjectHighlight(object: GeometricObject, highlighted: boolean): void {
        if (object.selected) return; // لا نمييز الكائنات المختارة
        
        const meshes2D = this.objectMeshes2D.get(object.id);
        const meshes3D = this.objectMeshes3D.get(object.id);
        
        const meshes = this.is2D ? meshes2D : meshes3D;
        if (meshes) {
            meshes.forEach(mesh => {
                mesh.material = highlighted ? this.materials.highlighted : this.materials.default;
            });
        }
    }

    public deleteSelectedObjects(): void {
        const objectsToDelete = Array.from(this.interactionInfo.selectedObjects);
        objectsToDelete.forEach(object => {
            this.removeGeometricObject(object.id);
        });
        this.clearSelection();
    }

    public removeGeometricObject(objectId: string): void {
        const object = this.geometricObjects.get(objectId);
        if (!object) return;
        
        // إزالة من القوائم
        this.geometricObjects.delete(objectId);
        this.interactionInfo.selectedObjects.delete(object);
        
        // إزالة التمثيل المرئي
        this.removeVisualRepresentation(objectId);
        
        // تنظيف الكائن
        object.dispose();
        
        this.emit('objectRemoved', object);
    }

    private removeVisualRepresentation(objectId: string): void {
        // إزالة من المشهد 2D
        const meshes2D = this.objectMeshes2D.get(objectId);
        if (meshes2D) {
            meshes2D.forEach(mesh => {
                this.scene2D.remove(mesh);
                this.disposeMesh(mesh);
            });
            this.objectMeshes2D.delete(objectId);
        }
        
        // إزالة من المشهد 3D
        const meshes3D = this.objectMeshes3D.get(objectId);
        if (meshes3D) {
            meshes3D.forEach(mesh => {
                this.scene3D.remove(mesh);
                this.disposeMesh(mesh);
            });
            this.objectMeshes3D.delete(objectId);
        }
        
        // إزالة المجموعة
        const group = this.objectGroups.get(objectId);
        if (group) {
            group.parent?.remove(group);
            this.objectGroups.delete(objectId);
        }
    }

    private disposeMesh(mesh: Mesh): void {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }

    // ==================== التحكم في العرض ====================

    public setView(is2D: boolean): void {
        this.is2D = is2D;
        this.measurementSystem.updateCamera(is2D ? this.camera2D : this.camera3D);
        this.emit('viewChanged', is2D);
    }

    public setViewMode(mode: ViewMode): void {
        this.currentViewMode = mode;
        this.updateSceneDisplay();
        this.emit('viewModeChanged', mode);
    }

    public setViewOrientation(orientation: ViewOrientation): void {
        this.currentOrientation = orientation;
        this.applyViewOrientation(orientation);
        this.emit('orientationChanged', orientation);
    }

    private applyViewOrientation(orientation: ViewOrientation): void {
        const camera = this.getCurrentCamera();
        const controls = this.getCurrentControls();
        
        switch (orientation) {
            case ViewOrientation.TOP:
                camera.position.set(0, 0, 50);
                camera.up.set(0, 1, 0);
                break;
            case ViewOrientation.FRONT:
                camera.position.set(0, -50, 0);
                camera.up.set(0, 0, 1);
                break;
            case ViewOrientation.RIGHT:
                camera.position.set(50, 0, 0);
                camera.up.set(0, 0, 1);
                break;
            case ViewOrientation.ISOMETRIC:
                camera.position.set(30, 30, 30);
                camera.up.set(0, 0, 1);
                break;
        }
        
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }

    private updateSceneDisplay(): void {
        // تحديث عرض الكائنات حسب نمط العرض
        this.geometricObjects.forEach(object => {
            const meshes = this.is2D ? 
                this.objectMeshes2D.get(object.id) : 
                this.objectMeshes3D.get(object.id);
            
            if (meshes) {
                meshes.forEach(mesh => {
                    switch (this.currentViewMode) {
                        case ViewMode.WIREFRAME:
                            mesh.material = this.materials.wireframe;
                            break;
                        case ViewMode.SHADED:
                            mesh.material = this.materials.default;
                            break;
                        case ViewMode.XRAY:
                            mesh.material = this.materials.transparent;
                            break;
                    }
                });
            }
        });
    }

    // ==================== حلقة الرسم والأداء ====================

    private startRenderLoop(): void {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            this.updatePerformanceStats();
            this.update();
            this.render();
        };
        animate();
    }

    private update(): void {
        const deltaTime = this.clock.getDelta();
        
        // تحديث أدوات التحكم
        if (this.is2D) {
            this.controls2D.update();
        } else {
            this.controls3D.update();
        }
        
        // تحديث الأنظمة
        this.measurementSystem.updateAllDimensions();
        
        this.emit('update', { deltaTime });
    }

    private render(): void {
        this.renderer.info.reset();
        
        if (this.is2D) {
            this.renderer.render(this.scene2D, this.camera2D);
        } else {
            this.renderer.render(this.scene3D, this.camera3D);
        }
    }

    private updatePerformanceStats(): void {
        this.performanceStats.renderTime = this.clock.getDelta() * 1000;
        this.performanceStats.triangleCount = this.renderer.info.render.triangles;
        this.performanceStats.drawCalls = this.renderer.info.render.calls;
        this.performanceStats.objectCount = this.geometricObjects.size;
        
        // حساب FPS
        this.performanceStats.fps = 1 / this.clock.getDelta();
    }

    // ==================== دوال مساعدة ====================

    private getCurrentCamera(): PerspectiveCamera | OrthographicCamera {
        return this.is2D ? this.camera2D : this.camera3D;
    }

    private getCurrentScene(): Scene {
        return this.is2D ? this.scene2D : this.scene3D;
    }

    private getCurrentControls(): OrbitControls {
        return this.is2D ? this.controls2D : this.controls3D;
    }

    // ==================== نظام الأحداث ====================

    public on(event: string, listener: ViewerEventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    public off(event: string, listener: ViewerEventListener): void {
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
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    this.logger.error(`خطأ في معالج الحدث ${event}:`, error);
                }
            });
        }
    }

    // ==================== دوال عامة ====================

    public isInitialized(): boolean {
        return this.initialized;
    }

    public getPerformanceStats(): PerformanceStats {
        return { ...this.performanceStats };
    }

    public getViewSettings(): ViewSettings {
        return { ...this.viewSettings };
    }

    public updateViewSettings(settings: Partial<ViewSettings>): void {
        Object.assign(this.viewSettings, settings);
        this.applyViewSettings();
    }

    private applyViewSettings(): void {
        // تطبيق إعدادات العرض
        this.scene2D.background = this.viewSettings.backgroundColor;
        this.scene3D.background = this.viewSettings.backgroundColor;
        
        if (this.lights.ambient) {
            this.lights.ambient.intensity = this.viewSettings.ambientLightIntensity;
        }
        
        if (this.lights.directional) {
            this.lights.directional.intensity = this.viewSettings.directionalLightIntensity;
        }
        
        this.renderer.shadowMap.enabled = this.viewSettings.enableShadows;
    }

    public dispose(): void {
        try {
            // إيقاف حلقة الرسم
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            
            // تنظيف الكائنات
            this.geometricObjects.forEach(object => {
                this.removeGeometricObject(object.id);
            });
            
            // تنظيف المواد
            Object.values(this.materials).forEach(material => {
                material.dispose();
            });
            
            // تنظيف المحرك
            this.renderer.dispose();
            
            this.logger.info('تم تنظيف Viewer');
            
        } catch (error) {
            this.logger.error('خطأ أثناء تنظيف Viewer:', error);
        }
    }
}