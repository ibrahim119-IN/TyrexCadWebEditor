import {
    WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera,
    GridHelper, AxesHelper, AmbientLight, DirectionalLight,
    Vector3, Vector2, Raycaster, Color, Line, BufferGeometry,
    LineBasicMaterial, BoxGeometry, MeshStandardMaterial, Mesh,
    TextureLoader, Box3, Object3D, Plane, LineDashedMaterial, Fog
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Wall } from '../models/Wall';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Constants } from './Constants';
import { CommandManager } from './CommandManager';
import { AddWallCommand } from '../commands/AddWallCommand';
import { Door, Window, BuildingElement } from '../models/BuildingElement';
import { AreaCalculator } from '../systems/AreaCalculator';
import { ProjectManager } from './ProjectManager';

// نوع دالة الاستماع للأحداث
type EventListener = (data: any) => void;

// واجهة لنتيجة البحث عن أقرب جدار
interface WallIntersection {
    wall: Wall;
    point: Vector3;
    distance: number;
}

export class Viewer {
    private container: HTMLElement;
    private renderer: WebGLRenderer;
    private scene2D: Scene;
    private scene3D: Scene;
    private camera2D: OrthographicCamera;
    private camera3D: PerspectiveCamera;
    private controls2D: OrbitControls;
    private controls3D: OrbitControls;
    private is2D: boolean = true;
    
    // نظام إدارة الجدران
    private walls: Map<string, Wall> = new Map();
    private wallMeshes2D: Map<string, Object3D[]> = new Map();
    private wallMeshes3D: Map<string, Mesh> = new Map();
    
    // عناصر البناء (أبواب ونوافذ)
    private buildingElements: Map<string, BuildingElement> = new Map();
    private elementMeshes2D: Map<string, Mesh> = new Map();
    private elementMeshes3D: Map<string, Mesh> = new Map();
    
    // حالة الرسم
    private isDrawing: boolean = false;
    private currentStartPoint: Vector3 | null = null;
    private previewLine: Line | null = null;
    
    // أنظمة مساعدة
    private commandManager: CommandManager = new CommandManager();
    private currentTool: 'wall' | 'door' | 'window' = 'wall';
    private snapSystem: SnapSystem;
    private measurementSystem: MeasurementSystem;
    private raycaster: Raycaster = new Raycaster();
    private mouse: Vector2 = new Vector2();
    private intersectionPlane: Plane;
    
    // نظام الأحداث
    private eventListeners: Map<string, EventListener[]> = new Map();
    
    // محمل النسيج
    private textureLoader: TextureLoader = new TextureLoader();

    constructor(container: HTMLElement) {
        this.container = container;
        this.intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);
        
        // إنشاء المكونات الأساسية
        this.renderer = this.createRenderer();
        this.scene2D = this.createScene2D();
        this.scene3D = this.createScene3D();
        this.camera2D = this.createCamera2D();
        this.camera3D = this.createCamera3D();
        this.controls2D = this.createControls2D();
        this.controls3D = this.createControls3D();
        
        // إنشاء الأنظمة المساعدة
        this.snapSystem = new SnapSystem();
        this.measurementSystem = new MeasurementSystem(
            container,
            this.is2D ? this.camera2D : this.camera3D
        );
        
        // الإعداد الأولي
        this.setup();
        this.animate();
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
        
        // إضافة جدران للاختبار
        if (this.is2D) {
            this.addSampleWalls();
        }
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
                Constants.GRID.DIVISIONS,
                Constants.GRID.DIVISIONS,
                Constants.GRID.COLOR,
                Constants.GRID.COLOR
            );
            
            if (scene === this.scene2D) {
                grid.rotation.x = Math.PI / 2;
            }
            
            scene.add(grid);
            
            // محاور
            const axes = new AxesHelper(5);
            scene.add(axes);
            
            // إضاءة
            const ambientLight = new AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const directionalLight = new DirectionalLight(0xffffff, 0.4);
            directionalLight.position.set(10, 10, 10);
            directionalLight.castShadow = true;
            scene.add(directionalLight);
        });
    }

    // إعداد أحداث الماوس
    private setupMouseEvents(): void {
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // إعداد أحداث لوحة المفاتيح
    private setupKeyboardEvents(): void {
        window.addEventListener('keydown', (e) => {
            // ESC لإلغاء الرسم
            if (e.key === 'Escape' && this.isDrawing) {
                this.cancelDrawing();
            }
            
            // Delete لحذف الجدار المحدد
            if (e.key === 'Delete') {
                this.deleteSelectedWalls();
            }
        });
    }

    // معالج حركة الماوس
    private onMouseMove(e: MouseEvent): void {
        this.updateMousePosition(e);
        
        if (this.is2D && this.isDrawing && this.currentStartPoint && this.currentTool === 'wall') {
            // الحصول على نقطة العالم مع الانجذاب
            const worldPoint = this.getWorldPoint();
            if (worldPoint) {
                const snapResult = this.snapSystem.snap(
                    worldPoint,
                    Array.from(this.walls.values()),
                    this.currentStartPoint
                );
                
                // تحديث خط المعاينة
                this.updatePreviewLine(this.currentStartPoint, snapResult.point);
                
                // تحديث قياس المعاينة
                this.measurementSystem.showPreviewDimension(
                    this.currentStartPoint,
                    snapResult.point
                );
                
                // إرسال حدث الرسم
                this.emit('wallDrawing', {
                    length: this.currentStartPoint.distanceTo(snapResult.point),
                    angle: Math.atan2(
                        snapResult.point.y - this.currentStartPoint.y,
                        snapResult.point.x - this.currentStartPoint.x
                    ) * 180 / Math.PI
                });
            }
        } else if (this.is2D) {
            // تحديث تمييز الجدران عند المرور فوقها
            this.updateWallHighlight();
        }
    }

    // معالج ضغط الماوس
    private onMouseDown(e: MouseEvent): void {
        if (e.button === 0 && this.is2D) {
            // زر الماوس الأيسر - رسم
            this.handleLeftClick();
        } else if (e.button === 2) {
            // زر الماوس الأيمن - تحديد/إلغاء
            if (this.isDrawing) {
                this.cancelDrawing();
            } else {
                this.handleRightClick();
            }
        }
    }

    // معالج رفع الماوس
    private onMouseUp(e: MouseEvent): void {
        // يمكن إضافة منطق إضافي هنا إذا لزم الأمر
    }

    // معالج النقر الأيسر
    private handleLeftClick(): void {
        const worldPoint = this.getWorldPoint();
        if (!worldPoint) return;
        
        // تطبيق الانجذاب
        const snapResult = this.snapSystem.snap(
            worldPoint,
            Array.from(this.walls.values()),
            this.currentStartPoint || undefined
        );
        
        if (this.currentTool === 'wall') {
            if (!this.isDrawing) {
                // بدء رسم جدار جديد
                this.startDrawing(snapResult.point);
            } else if (this.currentStartPoint) {
                // إنهاء رسم الجدار
                const length = this.currentStartPoint.distanceTo(snapResult.point);
                
                if (length >= Constants.WALL.MIN_LENGTH) {
                    this.finishDrawing(snapResult.point);
                }
            }
        } else if (this.currentTool === 'door' || this.currentTool === 'window') {
            // وضع باب أو نافذة على الجدار
            const wallIntersection = this.getClosestWallToPoint(snapResult.point);
            if (wallIntersection) {
                this.placeElementOnWall(wallIntersection.wall, wallIntersection.point, this.currentTool);
            }
        }
    }

    // البحث عن أقرب جدار لنقطة
    private getClosestWallToPoint(point: Vector3): WallIntersection | null {
        let closestWall: Wall | null = null;
        let closestPoint: Vector3 | null = null;
        let minDistance = Infinity;

        this.walls.forEach(wall => {
            const wallPoint = wall.getClosestPoint(point);
            const distance = point.distanceTo(wallPoint);
            
            if (distance < minDistance && distance < 1) { // ضمن مسافة 1 متر
                minDistance = distance;
                closestWall = wall;
                closestPoint = wallPoint;
            }
        });

        if (closestWall && closestPoint) {
            return { wall: closestWall, point: closestPoint, distance: minDistance };
        }

        return null;
    }

    // وضع عنصر على الجدار
    private placeElementOnWall(wall: Wall, position: Vector3, type: 'door' | 'window'): void {
    let element: BuildingElement;

    if (type === 'door') {
        element = new Door(position, wall.id);
    } else {
        element = new Window(position, wall.id);
    }

    this.buildingElements.set(element.id, element);
    this.createElementMeshes(element, wall);
    
    // قطع الجدار في 3D
    this.cutWallForElement(wall, element);
    
    this.emit('elementAdded', element);
}
    // إنشاء تمثيل مرئي للعنصر
    private createElementMeshes(element: BuildingElement, wall: Wall): void {
    // 2D mesh
    const mesh2D = element.create2DMesh();
    mesh2D.rotation.z = wall.angle;
    mesh2D.userData.elementId = element.id;
    this.scene2D.add(mesh2D);
    this.elementMeshes2D.set(element.id, mesh2D);

    // 3D mesh
    const geometry = new BoxGeometry(
        element.width,
        element.type === 'door' ? 2.1 : 1.2, // ارتفاع الباب أو النافذة
        0.3 // سمك أكبر ليكون واضح
    );
    
    const material = new MeshStandardMaterial({
        color: element.type === 'door' ? 0x654321 : 0x87CEEB,
        transparent: element.type === 'window',
        opacity: element.type === 'window' ? 0.7 : 1
    });
    
    const mesh3D = new Mesh(geometry, material);
    
    // الموضع الصحيح
    mesh3D.position.x = element.position.x;
    mesh3D.position.y = element.type === 'door' ? 1.05 : 1.6; // ارتفاع مناسب
    mesh3D.position.z = element.position.y; // تحويل Y إلى Z
    mesh3D.rotation.y = -wall.angle;
    
    this.scene3D.add(mesh3D);
    this.elementMeshes3D.set(element.id, mesh3D);
    console.log('Element added at:', element.position);
}

    // إزالة عنصر
    private removeElement(elementId: string): void {
        const element = this.buildingElements.get(elementId);
        if (!element) return;

        // إزالة من القائمة
        this.buildingElements.delete(elementId);

        // إزالة mesh 2D
        const mesh2D = this.elementMeshes2D.get(elementId);
        if (mesh2D) {
            this.scene2D.remove(mesh2D);
            mesh2D.geometry.dispose();
            if (Array.isArray(mesh2D.material)) {
                mesh2D.material.forEach(m => m.dispose());
            } else {
                mesh2D.material.dispose();
            }
            this.elementMeshes2D.delete(elementId);
        }

        // إزالة mesh 3D
        const mesh3D = this.elementMeshes3D.get(elementId);
        if (mesh3D) {
            this.scene3D.remove(mesh3D);
            mesh3D.geometry.dispose();
            if (Array.isArray(mesh3D.material)) {
                mesh3D.material.forEach(m => m.dispose());
            } else {
                mesh3D.material.dispose();
            }
            this.elementMeshes3D.delete(elementId);
        }

        this.emit('elementRemoved', element);
    }

    // معالج النقر الأيمن
    private handleRightClick(): void {
        const intersects = this.getWallIntersections();
        
        if (intersects.length > 0) {
            const wallId = intersects[0].object.userData.wallId;
            this.selectWall(wallId);
        } else {
            this.clearSelection();
        }
    }

    // بدء رسم جدار
    private startDrawing(point: Vector3): void {
        this.isDrawing = true;
        this.currentStartPoint = point.clone();
        
        // إضافة المؤشر إلى وضع الرسم
        this.renderer.domElement.classList.add('drawing-mode');
        
        // إنشاء خط المعاينة
        this.createPreviewLine(point);
    }

    // إنهاء رسم الجدار
    private finishDrawing(endPoint: Vector3): void {
        if (!this.currentStartPoint) return;
        
        if (this.currentTool === 'wall') {
            const command = new AddWallCommand(
                this.currentStartPoint,
                endPoint,
                this
            );
            this.commandManager.execute(command);
        }
        
        this.resetDrawingState();
    }

    // إلغاء الرسم
    private cancelDrawing(): void {
        this.resetDrawingState();
        this.emit('drawingCancelled', null);
    }

    // إعادة تعيين حالة الرسم
    private resetDrawingState(): void {
        this.isDrawing = false;
        this.currentStartPoint = null;
        
        // إزالة خط المعاينة
        if (this.previewLine) {
            this.scene2D.remove(this.previewLine);
            this.previewLine = null;
        }
        
        // إخفاء قياس المعاينة
        this.measurementSystem.hidePreviewDimension();
        
        // إزالة مؤشر الرسم
        this.renderer.domElement.classList.remove('drawing-mode');
        
        // مسح معلومات الرسم
        this.emit('wallDrawing', { length: 0, angle: 0 });
    }

    // إضافة جدار
    private addWall(wall: Wall): void {
        // حفظ الجدار
        this.walls.set(wall.id, wall);
        
        // إنشاء التمثيل المرئي للوضعين دائماً
        this.createWallMesh2D(wall);
        this.createWallMesh3D(wall);
        
        // إضافة القياس
        this.measurementSystem.addWallDimension(wall);
        
        // تحديث معلومات المساحة
        this.updateAreaInfo();
        
        // إرسال حدث
        this.emit('wallAdded', wall);
    }

    // إنشاء تمثيل الجدار في 2D
    private createWallMesh2D(wall: Wall): void {
        const objects: Object3D[] = [];
        
        // 1. الخط الأساسي للجدار
        const lineMaterial = new LineBasicMaterial({
            color: Constants.WALL.COLOR_2D,
            linewidth: 2
        });
        
        const lineGeometry = new BufferGeometry().setFromPoints([
            wall.start,
            wall.end
        ]);
        
        const line = new Line(lineGeometry, lineMaterial);
        line.userData.wallId = wall.id;
        
        // 2. المستطيل الذي يمثل سمك الجدار
        const thickness = wall.thickness;
        const length = wall.length;
        
        const wallGeometry = new BoxGeometry(length, thickness, 0.01);
        const wallMaterial = new MeshStandardMaterial({
            color: Constants.WALL.COLOR_2D,
            opacity: 0.8,
            transparent: true
        });
        
        const wallMesh = new Mesh(wallGeometry, wallMaterial);
        wallMesh.position.copy(wall.midPoint);
        wallMesh.position.z = 0.01;
        wallMesh.rotation.z = wall.angle;
        wallMesh.userData.wallId = wall.id;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        
        // إضافة للمشهد
        this.scene2D.add(line);
        this.scene2D.add(wallMesh);
        
        objects.push(line, wallMesh);
        this.wallMeshes2D.set(wall.id, objects);
    }

    // إنشاء تمثيل الجدار في 3D
    private createWallMesh3D(wall: Wall): void {
        const geometry = new BoxGeometry(
            wall.length,
            wall.height,
            wall.thickness
        );
        
        const material = new MeshStandardMaterial({
         color: 0x808080, // رمادي بدلاً من بني
            roughness: 0.8,
             metalness: 0.1
            });
        
        const mesh = new Mesh(geometry, material);
        
        const midPoint = wall.midPoint;
        mesh.position.set(midPoint.x, wall.height / 2, midPoint.y);
        mesh.rotation.y = -wall.angle;
        mesh.userData.wallId = wall.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene3D.add(mesh);
        this.wallMeshes3D.set(wall.id, mesh);
    }

    // إنشاء خط المعاينة
    private createPreviewLine(start: Vector3): void {
        const material = new LineDashedMaterial({
            color: Constants.WALL.COLOR_PREVIEW,
            dashSize: 0.5,
            gapSize: 0.25,
            linewidth: 2
        });
        
        const geometry = new BufferGeometry().setFromPoints([start, start]);
        this.previewLine = new Line(geometry, material);
        this.previewLine.computeLineDistances();
        
        this.scene2D.add(this.previewLine);
    }

    // تحديث خط المعاينة
    private updatePreviewLine(start: Vector3, end: Vector3): void {
        if (!this.previewLine) return;
        
        const positions = this.previewLine.geometry.attributes.position;
        positions.setXYZ(0, start.x, start.y, start.z);
        positions.setXYZ(1, end.x, end.y, end.z);
        positions.needsUpdate = true;
        
        this.previewLine.geometry.computeBoundingBox();
        this.previewLine.geometry.computeBoundingSphere();
        this.previewLine.computeLineDistances();
    }

    // الحصول على نقطة في العالم من موضع الماوس
    private getWorldPoint(): Vector3 | null {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        const intersectPoint = new Vector3();
        
        if (this.raycaster.ray.intersectPlane(this.intersectionPlane, intersectPoint)) {
            return intersectPoint;
        }
        
        return null;
    }

    // الحصول على موضع العالم من إحداثيات الشاشة
    public getWorldPosition(clientX: number, clientY: number): Vector3 | null {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(new Vector2(x, y), this.is2D ? this.camera2D : this.camera3D);
        const intersectPoint = new Vector3();
        
        if (this.raycaster.ray.intersectPlane(this.intersectionPlane, intersectPoint)) {
            return intersectPoint;
        }
        
        return null;
    }

    // تحديث موضع الماوس
    private updateMousePosition(e: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // الحصول على تقاطعات الجدران
    private getWallIntersections(): THREE.Intersection[] {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        
        const objects: Object3D[] = [];
        if (this.is2D) {
            this.wallMeshes2D.forEach(wallObjects => {
                objects.push(...wallObjects);
            });
        } else {
            this.wallMeshes3D.forEach(mesh => {
                objects.push(mesh);
            });
        }
        
        return this.raycaster.intersectObjects(objects);
    }

    // تحديث تمييز الجدران
    private updateWallHighlight(): void {
        // إزالة التمييز السابق
        this.walls.forEach(wall => {
            if (!wall.selected) {
                wall.highlighted = false;
                this.updateWallAppearance(wall);
            }
        });
        
        // إضافة تمييز جديد
        const intersects = this.getWallIntersections();
        if (intersects.length > 0) {
            const wallId = intersects[0].object.userData.wallId;
            const wall = this.walls.get(wallId);
            if (wall && !wall.selected) {
                wall.highlighted = true;
                this.updateWallAppearance(wall);
            }
        }
    }

    // تحديد جدار
    private selectWall(wallId: string): void {
        // إلغاء التحديد السابق
        this.clearSelection();
        
        // تحديد الجدار الجديد
        const wall = this.walls.get(wallId);
        if (wall) {
            wall.selected = true;
            this.updateWallAppearance(wall);
            this.emit('wallSelected', wall);
        }
    }

    // إلغاء التحديد
    private clearSelection(): void {
        this.walls.forEach(wall => {
            if (wall.selected) {
                wall.selected = false;
                this.updateWallAppearance(wall);
            }
        });
        this.emit('wallSelected', null);
    }

    // حذف الجدران المحددة
    private deleteSelectedWalls(): void {
        const wallsToDelete: string[] = [];
        
        this.walls.forEach(wall => {
            if (wall.selected) {
                wallsToDelete.push(wall.id);
            }
        });
        
        wallsToDelete.forEach(wallId => {
            this.removeWall(wallId);
        });
    }

    // إزالة جدار
    private removeWall(wallId: string): void {
        const wall = this.walls.get(wallId);
        if (!wall) return;
        
        // إزالة من الخريطة
        this.walls.delete(wallId);
        
        // إزالة التمثيل المرئي 2D
        const objects2D = this.wallMeshes2D.get(wallId);
        if (objects2D) {
            objects2D.forEach(obj => {
                this.scene2D.remove(obj);
                if (obj instanceof Line || obj instanceof Mesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach((m: any) => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                }
            });
            this.wallMeshes2D.delete(wallId);
        }
        
        // إزالة التمثيل المرئي 3D
        const mesh3D = this.wallMeshes3D.get(wallId);
        if (mesh3D) {
            this.scene3D.remove(mesh3D);
            if (mesh3D.geometry) mesh3D.geometry.dispose();
            if (mesh3D.material) {
                if (Array.isArray(mesh3D.material)) {
                    mesh3D.material.forEach(m => m.dispose());
                } else {
                    mesh3D.material.dispose();
                }
            }
            this.wallMeshes3D.delete(wallId);
        }
        
        // إزالة القياس
        this.measurementSystem.removeWallDimension(wallId);
        
        // تحديث معلومات المساحة
        this.updateAreaInfo();
        
        // إرسال حدث
        this.emit('wallRemoved', wall);
    }

    // تحديث مظهر الجدار
    private updateWallAppearance(wall: Wall): void {
        // تحديد اللون
        let color: number = Constants.WALL.COLOR_2D;
        if (wall.selected) {
            color = Constants.WALL.COLOR_SELECTED;
        } else if (wall.highlighted) {
            color = Constants.WALL.COLOR_HIGHLIGHTED;
        }
        
        // تحديث 2D
        const objects2D = this.wallMeshes2D.get(wall.id);
        if (objects2D) {
            objects2D.forEach(obj => {
                if (obj instanceof Line) {
                    (obj.material as LineBasicMaterial).color.setHex(color);
                } else if (obj instanceof Mesh) {
                    (obj.material as MeshStandardMaterial).color.setHex(color);
                }
            });
        }
        
        // تحديث 3D
        const mesh3D = this.wallMeshes3D.get(wall.id);
        if (mesh3D) {
            // في 3D نستخدم emissive للتمييز بدلاً من تغيير اللون
            const material = mesh3D.material as MeshStandardMaterial;
            if (wall.selected) {
                material.emissive = new Color(0x333333);
                material.emissiveIntensity = 0.3;
            } else if (wall.highlighted) {
                material.emissive = new Color(0x333333);
                material.emissiveIntensity = 0.2;
            } else {
                material.emissive = new Color(0x000000);
                material.emissiveIntensity = 0;
            }
        }
    }

    // حلقة الرسم
    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        
        // تحديث أدوات التحكم
        if (this.is2D) {
            this.controls2D.update();
            // تحديث القياسات فقط في 2D
            this.walls.forEach(wall => {
                this.measurementSystem.updateWallDimension(wall);
            });
        } else {
            this.controls3D.update();
        }
        
        this.render();
    }

    // رسم المشهد
    private render(): void {
        if (this.is2D) {
            this.renderer.render(this.scene2D, this.camera2D);
        } else {
            this.renderer.render(this.scene3D, this.camera3D);
        }
    }

    // معالج تغيير حجم النافذة
    private onWindowResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        
        // تحديث المحرك
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
        
        // تحديث القياسات
        this.walls.forEach(wall => {
            this.measurementSystem.updateWallDimension(wall);
        });
        
        this.render();
    }

    // تبديل العرض
    public setView(is2D: boolean): void {
        this.is2D = is2D;
        
        // إخفاء/إظهار القياسات حسب العرض
        if (is2D) {
            this.measurementSystem.updateCamera(this.camera2D);
            this.walls.forEach(wall => {
                this.measurementSystem.addWallDimension(wall);
            });
        } else {
            this.measurementSystem.clearAllDimensions();
            this.measurementSystem.updateCamera(this.camera3D);
        }
        
        // إلغاء الرسم الحالي
        if (this.isDrawing) {
            this.cancelDrawing();
        }
        
        this.emit('viewChanged', is2D);
    }

    // ملائمة الزوم
    public zoomExtend(): void {
        if (this.walls.size === 0) return;
        
        // حساب الحدود
        const box = new Box3();
        
        if (this.is2D) {
            this.wallMeshes2D.forEach(objects => {
                objects.forEach(obj => {
                    box.expandByObject(obj);
                });
            });
            
            if (!box.isEmpty()) {
                const center = box.getCenter(new Vector3());
                const size = box.getSize(new Vector3());
                const maxDim = Math.max(size.x, size.y) * 1.2;
                
                // تحديث الكاميرا
                this.camera2D.position.x = center.x;
                this.camera2D.position.y = center.y;
                this.camera2D.zoom = Math.min(
                    this.container.clientWidth / maxDim,
                    this.container.clientHeight / maxDim
                );
                this.camera2D.updateProjectionMatrix();
                
                // تحديث أدوات التحكم
                this.controls2D.target.set(center.x, center.y, 0);
                this.controls2D.update();
            }
        } else {
            this.wallMeshes3D.forEach(mesh => {
                box.expandByObject(mesh);
            });
            
            if (!box.isEmpty()) {
                const center = box.getCenter(new Vector3());
                const size = box.getSize(new Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const distance = maxDim * 2.5;
                
                // تحديث الكاميرا
                this.camera3D.position.set(
                    center.x + distance / 2,
                    center.y + distance,
                    center.z + distance / 2
                );
                this.camera3D.lookAt(center);
                
                // تحديث أدوات التحكم
                this.controls3D.target.copy(center);
                this.controls3D.update();
            }
        }
    }

    // تعيين حالة الانجذاب للشبكة
    public setSnapToGrid(enabled: boolean): void {
        this.snapSystem.setGridEnabled(enabled);
    }

    // تعيين حجم الشبكة
    public setGridSize(size: number): void {
        this.snapSystem.setGridSize(size);
    }

    // إضافة جدران عينة للاختبار
    private addSampleWalls(): void {
        // مربع بسيط للاختبار
        const walls = [
            new Wall(new Vector3(-10, -10, 0), new Vector3(10, -10, 0)),
            new Wall(new Vector3(10, -10, 0), new Vector3(10, 10, 0)),
            new Wall(new Vector3(10, 10, 0), new Vector3(-10, 10, 0)),
            new Wall(new Vector3(-10, 10, 0), new Vector3(-10, -10, 0))
        ];
        
        walls.forEach(wall => this.addWall(wall));
        
        // ملائمة الزوم لعرض الجدران
        setTimeout(() => this.zoomExtend(), 100);
    }

    // تغيير الأداة الحالية
    public setCurrentTool(tool: 'wall' | 'door' | 'window'): void {
        this.currentTool = tool;
        this.cancelDrawing();
    }

    // دوال Undo/Redo
    public undo(): void {
        if (this.commandManager.undo()) {
            this.updateAreaInfo();
        }
    }

    public redo(): void {
        if (this.commandManager.redo()) {
            this.updateAreaInfo();
        }
    }

    // دوال مباشرة لإضافة/حذف (للأوامر)
    public addWallDirect(wall: Wall): void {
        this.addWall(wall);
    }

    public removeWallDirect(wallId: string): void {
        this.removeWall(wallId);
    }

    // حساب وعرض معلومات المساحة
    private updateAreaInfo(): void {
        const wallsArray = Array.from(this.walls.values());
        const areaInfo = AreaCalculator.calculateAreaInfo(wallsArray);
        
        const areaElement = document.getElementById('area-info');
        if (areaElement) {
            if (areaInfo.isEnclosed) {
                areaElement.innerHTML = `Area: ${AreaCalculator.formatArea(areaInfo.area)} | Perimeter: ${AreaCalculator.formatPerimeter(areaInfo.perimeter)}`;
                areaElement.style.color = '#4CAF50';
            } else {
                areaElement.innerHTML = `Open Shape | Total Length: ${AreaCalculator.formatPerimeter(areaInfo.perimeter)}`;
                areaElement.style.color = '#FF9800';
            }
        }
    }

    // حفظ المشروع
    public saveProject(): void {
        const elements = Array.from(this.buildingElements.values());
        const projectData = ProjectManager.saveProject(
            Array.from(this.walls.values()),
            elements,
            'My CAD Project'
        );
        ProjectManager.exportToFile(projectData, 'project.json');
    }

    // تحميل المشروع
    public async loadProject(): Promise<void> {
        try {
            const jsonData = await ProjectManager.importFromFile();
            const { walls } = ProjectManager.loadProject(jsonData);
            
            // مسح المشروع الحالي
            this.clearAll();
            
            // إضافة الجدران المحملة
            walls.forEach(wall => this.addWall(wall));
            
            this.zoomExtend();
        } catch (error) {
            console.error('Failed to load project:', error);
        }
    }

    // مسح كل شيء
    private clearAll(): void {
        // مسح كل شيء
        Array.from(this.walls.keys()).forEach(id => this.removeWall(id));
        Array.from(this.buildingElements.keys()).forEach(id => this.removeElement(id));
        
        // مسح التاريخ
        this.commandManager.clear();
        this.updateAreaInfo();
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

    private cutWallForElement(wall: Wall, element: BuildingElement): void {
    // إزالة الجدار الأصلي من العرض 3D فقط
    const mesh3D = this.wallMeshes3D.get(wall.id);
    if (mesh3D) {
        this.scene3D.remove(mesh3D);
        mesh3D.geometry.dispose();
        if (Array.isArray(mesh3D.material)) {
            mesh3D.material.forEach(m => m.dispose());
        } else {
            mesh3D.material.dispose();
        }
    }

    // إنشاء جدار بفتحة
    const wallLength = wall.length;
    const elementWidth = element.width;
    const elementPos = element.position;
    
    // حساب المسافة من بداية الجدار
    const distanceFromStart = wall.start.distanceTo(elementPos);
    
    // إنشاء geometry مخصص للجدار مع الفتحة
    const geometry = new BoxGeometry(wallLength, wall.height, wall.thickness);
    const material = new MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.1
    });
    
    // إنشاء geometry للفتحة
    const holeGeometry = new BoxGeometry(
        elementWidth,
        element.type === 'door' ? element.height : element.height,
        wall.thickness + 0.1
    );
    
    // إنشاء mesh جديد
    const newMesh = new Mesh(geometry, material);
    const midPoint = wall.midPoint;
    newMesh.position.set(midPoint.x, wall.height / 2, midPoint.y);
    newMesh.rotation.y = -wall.angle;
    newMesh.userData.wallId = wall.id;
    newMesh.userData.hasCutout = true;
    
    this.scene3D.add(newMesh);
    this.wallMeshes3D.set(wall.id, newMesh);
}
}