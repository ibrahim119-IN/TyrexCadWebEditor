/**
 * DrawCircleTool - Advanced Circle and Arc Drawing Tool
 * Comprehensive tool for drawing circles and arcs with advanced features
 */

import { Vector3, BufferGeometry, LineBasicMaterial, Line as ThreeLine, RingGeometry, MeshBasicMaterial, Mesh, EllipseCurve, BufferAttribute } from 'three';
import { AbstractDrawTool, DrawToolOptions, DrawResult, DrawMode, InputType } from './AbstractDrawTool';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { CommandManager, Command } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Circle } from '../models/Circle';
import { GeometricObject } from '../models/GeometricObject';

// Circle drawing modes
export enum CircleDrawMode {
    CENTER_RADIUS = 'center-radius',        // Center + point on circumference
    TWO_POINTS = 'two-points',              // Two points on diameter
    THREE_POINTS = 'three-points',          // Three points on circumference
    TANGENT_TANGENT_RADIUS = 'tangent-tangent-radius', // Two tangents and radius
    CONCENTRIC = 'concentric',              // Concentric circles
    ARC_THREE_POINTS = 'arc-three-points',  // Arc with three points
    ARC_CENTER = 'arc-center'               // Arc from center
}

// Circle-specific settings
export interface CircleToolOptions extends DrawToolOptions {
    drawMode?: CircleDrawMode;
    showRadius?: boolean;
    showDiameter?: boolean;
    showCenter?: boolean;
    showQuadrants?: boolean;
    showCircumference?: boolean;
    showArea?: boolean;
    createAsArc?: boolean;
    defaultRadius?: number;
    radiusIncrement?: number;
    angleIncrement?: number;
    concentricStep?: number;
}

// Circle information
export interface CircleInfo {
    center: Point3D;
    radius: number;
    diameter: number;
    circumference: number;
    area: number;
    normal: Point3D;
    startAngle?: number;    // For arcs
    endAngle?: number;      // For arcs
    arcLength?: number;     // For arcs
    isArc: boolean;
    quadrantPoints?: Point3D[]; // Quadrant points
}

// Preview information
export interface CirclePreviewInfo {
    geometry?: BufferGeometry;
    centerPoint?: Vector3;
    radiusLine?: ThreeLine;
    quadrantLines?: ThreeLine[];
    dimensionLabels?: any[];
}

// Add circle command
class AddCircleCommand implements Command {
    private circle: Circle;
    private viewer: any;

    constructor(circle: Circle, viewer: any) {
        this.circle = circle;
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer?.addGeometricObject(this.circle);
    }

    undo(): void {
        this.viewer?.removeGeometricObject(this.circle.id);
    }

    getDescription(): string {
        return `Add circle: ${this.circle.id}`;
    }
}

/**
 * Advanced Circle Drawing Tool
 */
export class DrawCircleTool extends AbstractDrawTool {
    private circleDrawMode: CircleDrawMode = CircleDrawMode.CENTER_RADIUS;
    private previewCircle: Mesh | null = null;
    private previewInfo: CirclePreviewInfo = {};
    private currentCircleInfo: CircleInfo | null = null;
    private viewer: any = null;

    // Special settings
    private circleOptions: CircleToolOptions;
    
    // Reference circles for snapping
    private referenceCircles: Circle[] = [];
    
    // Temporary calculation cache
    private calculationCache: Map<string, any> = new Map();

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: CircleToolOptions = {},
        mode: CircleDrawMode = CircleDrawMode.CENTER_RADIUS
    ) {
        super(
            'draw-circle',
            'Draw Circle',
            geometryEngine,
            commandManager,
            snapSystem,
            measurementSystem,
            {
                snapEnabled: true,
                measurementEnabled: true,
                previewEnabled: true,
                autoComplete: true,
                undoEnabled: true,
                constraintsEnabled: true,
                precision: 0.001,
                tolerance: 0.1,
                maxPoints: 10,
                minPoints: 1,
                drawMode: DrawMode.SINGLE,
                ...options
            }
        );

        this.circleDrawMode = mode;
        this.circleOptions = {
            ...this.options,
            showRadius: true,
            showDiameter: false,
            showCenter: true,
            showQuadrants: false,
            showCircumference: true,
            showArea: false,
            createAsArc: false,
            defaultRadius: 1,
            radiusIncrement: 0.5,
            angleIncrement: 15,
            concentricStep: 0.5,
            ...options
        } as CircleToolOptions;

        this.setupCircleSpecificOptions();
    }

    // ==================== Required Abstract Functions ====================

    protected getRequiredPointCount(): number {
        switch (this.circleDrawMode) {
            case CircleDrawMode.CENTER_RADIUS:
                return 2;
            case CircleDrawMode.TWO_POINTS:
                return 2;
            case CircleDrawMode.THREE_POINTS:
            case CircleDrawMode.ARC_THREE_POINTS:
                return 3;
            case CircleDrawMode.TANGENT_TANGENT_RADIUS:
                return 3; // Two points for tangents + point for radius
            case CircleDrawMode.CONCENTRIC:
                return 2; // Reference circle center + radius point
            case CircleDrawMode.ARC_CENTER:
                return 3; // Center + start point + end point
            default:
                return 2;
        }
    }

    protected validatePoints(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        switch (this.circleDrawMode) {
            case CircleDrawMode.CENTER_RADIUS:
                return this.validateCenterRadius();
            case CircleDrawMode.TWO_POINTS:
                return this.validateTwoPoints();
            case CircleDrawMode.THREE_POINTS:
            case CircleDrawMode.ARC_THREE_POINTS:
                return this.validateThreePoints();
            case CircleDrawMode.TANGENT_TANGENT_RADIUS:
                return this.validateTangentTangentRadius();
            case CircleDrawMode.CONCENTRIC:
                return this.validateConcentric();
            case CircleDrawMode.ARC_CENTER:
                return this.validateArcCenter();
            default:
                return false;
        }
    }

    protected createGeometry(): GeometricObject | GeometricObject[] | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            switch (this.circleDrawMode) {
                case CircleDrawMode.CENTER_RADIUS:
                    return this.createCenterRadiusCircle();
                
                case CircleDrawMode.TWO_POINTS:
                    return this.createTwoPointsCircle();
                
                case CircleDrawMode.THREE_POINTS:
                    return this.createThreePointsCircle();
                
                case CircleDrawMode.TANGENT_TANGENT_RADIUS:
                    return this.createTangentTangentRadiusCircle();
                
                case CircleDrawMode.CONCENTRIC:
                    return this.createConcentricCircle();
                
                case CircleDrawMode.ARC_THREE_POINTS:
                    return this.createThreePointsArc();
                
                case CircleDrawMode.ARC_CENTER:
                    return this.createCenterArc();
                
                default:
                    return this.createCenterRadiusCircle();
            }
        } catch (error) {
            this.logger.error('Failed to create circle:', error);
            return null;
        }
    }

    protected updatePreview(): void {
        if (!this.shouldShowPreview()) {
            this.clearPreview();
            return;
        }

        try {
            this.clearPreview();
            
            if (this.inputPoints.length > 0 && this.currentPoint) {
                this.calculateCurrentCircleInfo();
                
                if (this.currentCircleInfo) {
                    this.createCirclePreview();
                    this.showCircleHelpers();
                    this.updateMeasurementDisplay();
                }
            }
        } catch (error) {
            this.logger.error('Failed to update circle preview:', error);
        }
    }

    protected getDisplayName(): string {
        const modeNames = {
            [CircleDrawMode.CENTER_RADIUS]: 'Circle (Center + Radius)',
            [CircleDrawMode.TWO_POINTS]: 'Circle (Two Points)',
            [CircleDrawMode.THREE_POINTS]: 'Circle (Three Points)',
            [CircleDrawMode.TANGENT_TANGENT_RADIUS]: 'Circle (Tangents + Radius)',
            [CircleDrawMode.CONCENTRIC]: 'Concentric Circle',
            [CircleDrawMode.ARC_THREE_POINTS]: 'Arc (Three Points)',
            [CircleDrawMode.ARC_CENTER]: 'Arc (From Center)'
        };
        
        return modeNames[this.circleDrawMode] || 'Draw Circle';
    }

    protected canComplete(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        // Additional validation
        return this.validatePoints() && this.currentCircleInfo !== null;
    }

    protected createAddCommand(object: GeometricObject): Command {
        return new AddCircleCommand(object as Circle, this.viewer);
    }

    // ==================== Point Validation ====================

    private validateCenterRadius(): boolean {
        if (this.inputPoints.length < 2) return false;
        
        const center = this.inputPoints[0].position;
        const radiusPoint = this.inputPoints[1].position;
        const radius = center.distanceTo(radiusPoint);
        
        if (radius < this.options.tolerance!) {
            this.logger.warn('Circle radius too small');
            return false;
        }

        return true;
    }

    private validateTwoPoints(): boolean {
        if (this.inputPoints.length < 2) return false;
        
        const p1 = this.inputPoints[0].position;
        const p2 = this.inputPoints[1].position;
        const diameter = p1.distanceTo(p2);
        
        if (diameter < 2 * this.options.tolerance!) {
            this.logger.warn('Circle diameter too small');
            return false;
        }

        return true;
    }

    private validateThreePoints(): boolean {
        if (this.inputPoints.length < 3) return false;
        
        const [p1, p2, p3] = this.inputPoints.map(ip => ip.position);
        
        // Check if points are collinear
        const area = this.calculateTriangleArea(p1, p2, p3);
        if (Math.abs(area) < this.options.tolerance!) {
            this.logger.warn('Three points are collinear');
            return false;
        }

        return true;
    }

    private validateTangentTangentRadius(): boolean {
        // TODO: Implement tangent validation
        return this.inputPoints.length >= 3;
    }

    private validateConcentric(): boolean {
        if (this.inputPoints.length < 2) return false;
        
        // Check for reference circle
        if (this.referenceCircles.length === 0) {
            this.logger.warn('No reference circle for concentric circles');
            return false;
        }

        return true;
    }

    private validateArcCenter(): boolean {
        if (this.inputPoints.length < 3) return false;
        
        const center = this.inputPoints[0].position;
        const start = this.inputPoints[1].position;
        const end = this.inputPoints[2].position;
        
        const radius1 = center.distanceTo(start);
        const radius2 = center.distanceTo(end);
        
        // Check if points are equidistant from center
        if (Math.abs(radius1 - radius2) > this.options.tolerance!) {
            this.logger.warn('Points are not equidistant from center');
            return false;
        }

        return true;
    }

    // ==================== Circle Creation ====================

    private createCenterRadiusCircle(): Circle {
        const center = this.inputPoints[0].position;
        const radiusPoint = this.inputPoints[1].position;
        const radius = center.distanceTo(radiusPoint);
        
        const circle = new Circle(
            { x: center.x, y: center.y, z: center.z },
            radius
        );
        
        this.applyCircleProperties(circle);
        
        this.logger.info(`Created center-radius circle: ${circle.id}`);
        return circle;
    }

    private createTwoPointsCircle(): Circle {
        const p1 = this.inputPoints[0].position;
        const p2 = this.inputPoints[1].position;
        
        const center = new Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const radius = p1.distanceTo(p2) / 2;
        
        const circle = new Circle(
            { x: center.x, y: center.y, z: center.z },
            radius
        );
        
        this.applyCircleProperties(circle);
        
        this.logger.info(`Created two-point circle: ${circle.id}`);
        return circle;
    }

    private createThreePointsCircle(): Circle {
        const [p1, p2, p3] = this.inputPoints.map(ip => ip.position);
        
        const circleInfo = this.calculateCircleFromThreePoints(p1, p2, p3);
        if (!circleInfo) {
            throw new Error('Failed to calculate circle from three points');
        }
        
        const circle = new Circle(
            { x: circleInfo.center.x, y: circleInfo.center.y, z: circleInfo.center.z },
            circleInfo.radius
        );
        
        this.applyCircleProperties(circle);
        
        this.logger.info(`Created three-point circle: ${circle.id}`);
        return circle;
    }

    private createTangentTangentRadiusCircle(): Circle {
        // TODO: Implement tangent circle creation
        return this.createCenterRadiusCircle();
    }

    private createConcentricCircle(): Circle {
        const referenceCircle = this.referenceCircles[0];
        const newRadiusPoint = this.inputPoints[1].position;
        const newRadius = new Vector3(
            referenceCircle.center.x,
            referenceCircle.center.y,
            referenceCircle.center.z
        ).distanceTo(newRadiusPoint);
        
        const circle = new Circle(referenceCircle.center, newRadius);
        
        circle.setMetadata('isConcentric', true);
        circle.setMetadata('referenceCircle', referenceCircle.id);
        
        this.applyCircleProperties(circle);
        
        this.logger.info(`Created concentric circle: ${circle.id}`);
        return circle;
    }

    private createThreePointsArc(): Circle {
        // Create arc from three points
        const arc = this.createThreePointsCircle();
        
        // Calculate start and end angles
        const [p1, p2, p3] = this.inputPoints.map(ip => ip.position);
        const center = new Vector3(arc.center.x, arc.center.y, arc.center.z);
        
        const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
        const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);
        
        arc.setMetadata('isArc', true);
        arc.setMetadata('startAngle', startAngle);
        arc.setMetadata('endAngle', endAngle);
        arc.setMetadata('middlePoint', { x: p2.x, y: p2.y, z: p2.z });
        
        this.logger.info(`Created three-point arc: ${arc.id}`);
        return arc;
    }

    private createCenterArc(): Circle {
        const center = this.inputPoints[0].position;
        const startPoint = this.inputPoints[1].position;
        const endPoint = this.inputPoints[2].position;
        
        const radius = center.distanceTo(startPoint);
        
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        
        const arc = new Circle(
            { x: center.x, y: center.y, z: center.z },
            radius
        );
        
        arc.setMetadata('isArc', true);
        arc.setMetadata('startAngle', startAngle);
        arc.setMetadata('endAngle', endAngle);
        
        this.applyCircleProperties(arc);
        
        this.logger.info(`Created center arc: ${arc.id}`);
        return arc;
    }

    // ==================== Circle Information Calculation ====================

    private calculateCurrentCircleInfo(): void {
        this.currentCircleInfo = null;
        
        try {
            let center: Vector3;
            let radius: number;
            let isArc = false;
            let startAngle: number | undefined;
            let endAngle: number | undefined;

            switch (this.circleDrawMode) {
                case CircleDrawMode.CENTER_RADIUS:
                    if (this.inputPoints.length >= 1 && this.currentPoint) {
                        center = this.inputPoints[0].position;
                        radius = center.distanceTo(this.currentPoint);
                    } else {
                        return;
                    }
                    break;

                case CircleDrawMode.TWO_POINTS:
                    if (this.inputPoints.length >= 1 && this.currentPoint) {
                        const p1 = this.inputPoints[0].position;
                        center = new Vector3().addVectors(p1, this.currentPoint).multiplyScalar(0.5);
                        radius = p1.distanceTo(this.currentPoint) / 2;
                    } else {
                        return;
                    }
                    break;

                case CircleDrawMode.THREE_POINTS:
                    if (this.inputPoints.length >= 2 && this.currentPoint) {
                        const p1 = this.inputPoints[0].position;
                        const p2 = this.inputPoints[1].position;
                        const circleInfo = this.calculateCircleFromThreePoints(p1, p2, this.currentPoint);
                        if (!circleInfo) return;
                        center = circleInfo.center;
                        radius = circleInfo.radius;
                    } else {
                        return;
                    }
                    break;

                case CircleDrawMode.ARC_CENTER:
                    if (this.inputPoints.length >= 2 && this.currentPoint) {
                        center = this.inputPoints[0].position;
                        const startPoint = this.inputPoints[1].position;
                        radius = center.distanceTo(startPoint);
                        isArc = true;
                        startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
                        endAngle = Math.atan2(this.currentPoint.y - center.y, this.currentPoint.x - center.x);
                    } else {
                        return;
                    }
                    break;

                default:
                    return;
            }

            // Create circle info
            this.currentCircleInfo = {
                center: { x: center.x, y: center.y, z: center.z },
                radius,
                diameter: radius * 2,
                circumference: 2 * Math.PI * radius,
                area: Math.PI * radius * radius,
                normal: { x: 0, y: 0, z: 1 },
                isArc,
                startAngle,
                endAngle,
                arcLength: isArc && startAngle !== undefined && endAngle !== undefined 
                    ? this.calculateArcLength(radius, startAngle, endAngle) 
                    : undefined,
                quadrantPoints: this.calculateQuadrantPoints(center, radius)
            };

            this.emit('circleInfoUpdated', this.currentCircleInfo);

        } catch (error) {
            this.logger.error('Failed to calculate circle info:', error);
        }
    }

    private calculateCircleFromThreePoints(p1: Vector3, p2: Vector3, p3: Vector3): { center: Vector3; radius: number } | null {
        // Calculate center and radius of circle passing through three points
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        
        if (Math.abs(d) < this.options.tolerance!) {
            return null; // Points are collinear
        }

        const ux = ((ax * ax + ay * ay) * (by - cy) + 
                    (bx * bx + by * by) * (cy - ay) + 
                    (cx * cx + cy * cy) * (ay - by)) / d;
        
        const uy = ((ax * ax + ay * ay) * (cx - bx) + 
                    (bx * bx + by * by) * (ax - cx) + 
                    (cx * cx + cy * cy) * (bx - ax)) / d;

        const center = new Vector3(ux, uy, p1.z);
        const radius = center.distanceTo(p1);

        return { center, radius };
    }

    private calculateTriangleArea(p1: Vector3, p2: Vector3, p3: Vector3): number {
        return 0.5 * Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - 
            (p3.x - p1.x) * (p2.y - p1.y)
        );
    }

    private calculateArcLength(radius: number, startAngle: number, endAngle: number): number {
        let angleDiff = endAngle - startAngle;
        if (angleDiff < 0) angleDiff += 2 * Math.PI;
        return radius * angleDiff;
    }

    private calculateQuadrantPoints(center: Vector3, radius: number): Point3D[] {
        return [
            { x: center.x + radius, y: center.y, z: center.z },      // 0°
            { x: center.x, y: center.y + radius, z: center.z },      // 90°
            { x: center.x - radius, y: center.y, z: center.z },      // 180°
            { x: center.x, y: center.y - radius, z: center.z }       // 270°
        ];
    }

    // ==================== Preview and Display ====================

    private createCirclePreview(): void {
        if (!this.currentCircleInfo) return;

        const { center, radius, isArc, startAngle, endAngle } = this.currentCircleInfo;

        if (isArc && startAngle !== undefined && endAngle !== undefined) {
            this.createArcPreview(center, radius, startAngle, endAngle);
        } else {
            this.createFullCirclePreview(center, radius);
        }
    }

    private createFullCirclePreview(center: Point3D, radius: number): void {
        // Create circle geometry
        const geometry = new RingGeometry(radius * 0.98, radius * 1.02, 64);
        
        // Create preview material
        const material = new MeshBasicMaterial({
            color: this.circleOptions.previewColor || '#2196F3',
            opacity: this.circleOptions.previewOpacity || 0.3,
            transparent: true,
            side: 2 // DoubleSide
        });
        
        this.previewCircle = new Mesh(geometry, material);
        this.previewCircle.position.set(center.x, center.y, center.z);
        
        this.previewObjects.push(this.previewCircle);
        this.emit('previewObjectCreated', this.previewCircle);
        
        // Create circle outline
        this.createCircleOutline(center, radius);
    }

    private createArcPreview(center: Point3D, radius: number, startAngle: number, endAngle: number): void {
        // Create arc geometry
        const curve = new EllipseCurve(
            center.x, center.y,
            radius, radius,
            startAngle, endAngle,
            false,
            0
        );
        
        const points = curve.getPoints(64);
        const geometry = new BufferGeometry().setFromPoints(points);
        
        const material = new LineBasicMaterial({
            color: this.circleOptions.previewColor || '#2196F3',
            linewidth: 2
        });
        
        const arcLine = new ThreeLine(geometry, material);
        arcLine.position.z = center.z;
        
        this.previewObjects.push(arcLine);
        this.emit('previewObjectCreated', arcLine);
        
        // Add radius lines for arc
        this.createRadiusLines(center, radius, startAngle, endAngle);
    }

    private createCircleOutline(center: Point3D, radius: number): void {
        const segments = 64;
        const points: Vector3[] = [];
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            points.push(new Vector3(x, y, center.z));
        }
        
        const geometry = new BufferGeometry().setFromPoints(points);
        const material = new LineBasicMaterial({
            color: this.circleOptions.previewColor || '#2196F3',
            opacity: 0.8,
            transparent: true
        });
        
        const outline = new ThreeLine(geometry, material);
        this.previewObjects.push(outline);
        this.emit('previewObjectCreated', outline);
    }

    private createRadiusLines(center: Point3D, radius: number, startAngle: number, endAngle: number): void {
        const centerVec = new Vector3(center.x, center.y, center.z);
        
        // Start radius line
        const startPoint = new Vector3(
            center.x + Math.cos(startAngle) * radius,
            center.y + Math.sin(startAngle) * radius,
            center.z
        );
        
        // End radius line
        const endPoint = new Vector3(
            center.x + Math.cos(endAngle) * radius,
            center.y + Math.sin(endAngle) * radius,
            center.z
        );
        
        // Create lines
        [startPoint, endPoint].forEach(point => {
            const geometry = new BufferGeometry().setFromPoints([centerVec, point]);
            const material = new LineBasicMaterial({
                color: '#FF9800',
                opacity: 0.6,
                transparent: true
            });
            
            const radiusLine = new ThreeLine(geometry, material);
            this.previewObjects.push(radiusLine);
            this.emit('previewObjectCreated', radiusLine);
        });
    }

    private showCircleHelpers(): void {
        if (!this.currentCircleInfo) return;
        
        const { center, radius } = this.currentCircleInfo;
        
        // Show center point
        if (this.circleOptions.showCenter) {
            this.createCenterPoint(center);
        }
        
        // Show quadrant lines
        if (this.circleOptions.showQuadrants) {
            this.createQuadrantLines(center, radius);
        }
        
        // Show radius line
        if (this.circleOptions.showRadius && this.inputPoints.length > 0) {
            this.createRadiusLine(center, this.currentPoint!);
        }
    }

    private createCenterPoint(center: Point3D): void {
        const geometry = new BufferGeometry();
        const vertices = new Float32Array([center.x, center.y, center.z]);
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        
        const material = new LineBasicMaterial({
            color: '#FF0000',
            opacity: 0.8,
            transparent: true
        });
        
        // Create small cross for center
        const size = this.currentCircleInfo!.radius * 0.05;
        const crossPoints = [
            new Vector3(center.x - size, center.y, center.z),
            new Vector3(center.x + size, center.y, center.z),
            new Vector3(center.x, center.y - size, center.z),
            new Vector3(center.x, center.y + size, center.z)
        ];
        
        const crossGeometry = new BufferGeometry().setFromPoints(crossPoints);
        const centerCross = new ThreeLine(crossGeometry, material);
        
        this.previewObjects.push(centerCross);
        this.emit('previewObjectCreated', centerCross);
    }

    private createQuadrantLines(center: Point3D, radius: number): void {
        const quadrantPoints = this.calculateQuadrantPoints(new Vector3(center.x, center.y, center.z), radius);
        const centerVec = new Vector3(center.x, center.y, center.z);
        
        quadrantPoints.forEach(point => {
            const geometry = new BufferGeometry().setFromPoints([
                centerVec,
                new Vector3(point.x, point.y, point.z)
            ]);
            
            const material = new LineBasicMaterial({
                color: '#888888',
                opacity: 0.4,
                transparent: true
            });
            
            const quadrantLine = new ThreeLine(geometry, material);
            this.previewObjects.push(quadrantLine);
            this.emit('previewObjectCreated', quadrantLine);
        });
    }

    private createRadiusLine(center: Point3D, endPoint: Vector3): void {
        const geometry = new BufferGeometry().setFromPoints([
            new Vector3(center.x, center.y, center.z),
            endPoint
        ]);
        
        const material = new LineBasicMaterial({
            color: '#4CAF50',
            opacity: 0.7,
            transparent: true,
            linewidth: 2
        });
        
        const radiusLine = new ThreeLine(geometry, material);
        this.previewObjects.push(radiusLine);
        this.emit('previewObjectCreated', radiusLine);
    }

    private updateMeasurementDisplay(): void {
        if (!this.currentCircleInfo) return;
        
        const { center, radius, diameter, circumference, area, arcLength, isArc } = this.currentCircleInfo;
        
        // Show radius
        if (this.circleOptions.showRadius) {
            this.emit('measurementUpdate', {
                type: 'radius',
                value: this.formatLength(radius),
                position: center
            });
        }
        
        // Show diameter
        if (this.circleOptions.showDiameter) {
            this.emit('measurementUpdate', {
                type: 'diameter',
                value: this.formatLength(diameter),
                position: center
            });
        }
        
        // Show circumference or arc length
        if (this.circleOptions.showCircumference) {
            const length = isArc && arcLength ? arcLength : circumference;
            const label = isArc ? 'Arc Length' : 'Circumference';
            
            this.emit('measurementUpdate', {
                type: 'circumference',
                value: `${label}: ${this.formatLength(length)}`,
                position: { x: center.x + radius, y: center.y, z: center.z }
            });
        }
        
        // Show area
        if (this.circleOptions.showArea && !isArc) {
            this.emit('measurementUpdate', {
                type: 'area',
                value: this.formatArea(area),
                position: center
            });
        }
    }

    // ==================== Advanced Snapping ====================

    public onMouseMove(point: Vector3, existingObjects: any[] = []): void {
        let enhancedPoint = point.clone();
        
        // Radius snapping
        if (this.inputPoints.length > 0 && this.circleOptions.radiusIncrement) {
            enhancedPoint = this.applyRadiusSnap(enhancedPoint);
        }
        
        // Angle snapping for arcs
        if (this.isArcMode() && this.inputPoints.length > 1 && this.circleOptions.angleIncrement) {
            enhancedPoint = this.applyAngleSnap(enhancedPoint);
        }
        
        // Circle snapping
        enhancedPoint = this.applyCircleSnap(enhancedPoint, existingObjects);
        
        super.onMouseMove(enhancedPoint, existingObjects);
    }

    private applyRadiusSnap(point: Vector3): Vector3 {
        if (this.inputPoints.length === 0) return point;
        
        const center = this.inputPoints[0].position;
        const direction = point.clone().sub(center);
        const radius = direction.length();
        
        if (radius < 0.001) return point;
        
        // Radius snapping
        const increment = this.circleOptions.radiusIncrement || 0.5;
        const snappedRadius = Math.round(radius / increment) * increment;
        
        return center.clone().add(direction.normalize().multiplyScalar(snappedRadius));
    }

    private applyAngleSnap(point: Vector3): Vector3 {
        if (this.inputPoints.length < 2) return point;
        
        const center = this.inputPoints[0].position;
        const direction = point.clone().sub(center);
        const angle = Math.atan2(direction.y, direction.x);
        const radius = direction.length();
        
        // Angle snapping
        const increment = (this.circleOptions.angleIncrement || 15) * (Math.PI / 180);
        const snappedAngle = Math.round(angle / increment) * increment;
        
        return center.clone().add(new Vector3(
            Math.cos(snappedAngle) * radius,
            Math.sin(snappedAngle) * radius,
            0
        ));
    }

    private applyCircleSnap(point: Vector3, existingObjects: any[]): Vector3 {
        // Snap to centers and circumferences of existing circles
        // TODO: Implement advanced circle snapping
        return point;
    }

    // ==================== Helper Functions ====================

    private setupCircleSpecificOptions(): void {
        if (this.isArcMode()) {
            this.circleOptions.createAsArc = true;
        }
    }

    private isArcMode(): boolean {
        return this.circleDrawMode === CircleDrawMode.ARC_THREE_POINTS ||
               this.circleDrawMode === CircleDrawMode.ARC_CENTER;
    }

    private applyCircleProperties(circle: Circle): void {
        // Apply special properties
        if (this.circleOptions.createAsArc || this.isArcMode()) {
            circle.setMetadata('isArc', true);
        }
        
        circle.setMetadata('drawMode', this.circleDrawMode);
        circle.setMetadata('toolVersion', this.toolVersion);
        
        if (this.currentCircleInfo) {
            circle.setMetadata('circleInfo', this.currentCircleInfo);
        }
    }

    private formatLength(length: number): string {
        if (length < 0.01) return '0.00m';
        
        if (length < 1) {
            return `${(length * 100).toFixed(0)}cm`;
        } else if (length < 1000) {
            return `${length.toFixed(2)}m`;
        } else {
            return `${(length / 1000).toFixed(3)}km`;
        }
    }

    private formatArea(area: number): string {
        if (area < 1) {
            return `${(area * 10000).toFixed(0)}cm²`;
        } else if (area < 10000) {
            return `${area.toFixed(2)}m²`;
        } else {
            return `${(area / 10000).toFixed(3)}hectares`;
        }
    }

    // ==================== Public Interface ====================

    /**
     * Change circle drawing mode
     */
    public setCircleDrawMode(mode: CircleDrawMode): void {
        if (this.state === 'drawing') {
            this.logger.warn('Cannot change drawing mode while drawing');
            return;
        }
        
        this.circleDrawMode = mode;
        this.setupCircleSpecificOptions();
        this.resetTool();
        
        this.emit('drawModeChanged', { mode, toolId: this.toolId });
        this.logger.info(`Changed circle drawing mode to: ${mode}`);
    }

    /**
     * Get current drawing mode
     */
    public getCircleDrawMode(): CircleDrawMode {
        return this.circleDrawMode;
    }

    /**
     * Get current circle info
     */
    public getCurrentCircleInfo(): CircleInfo | null {
        return this.currentCircleInfo ? { ...this.currentCircleInfo } : null;
    }

    /**
     * Set reference circles for snapping
     */
    public setReferenceCircles(circles: Circle[]): void {
        this.referenceCircles = [...circles];
    }

    /**
     * Set viewer reference
     */
    public setViewer(viewer: any): void {
        this.viewer = viewer;
    }

    /**
     * Get detailed statistics
     */
    public getDetailedStats(): any {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            circleDrawMode: this.circleDrawMode,
            totalCirclesDrawn: baseStats.completionCount,
            averageRadius: this.calculateAverageRadius(),
            arcsDrawn: this.countArcs(),
            concentricCircles: this.countConcentricCircles()
        };
    }

    private calculateAverageRadius(): number {
        // TODO: Calculate average radius
        return 0;
    }

    private countArcs(): number {
        // TODO: Count drawn arcs
        return 0;
    }

    private countConcentricCircles(): number {
        // TODO: Count concentric circles
        return 0;
    }

    /**
     * Enhanced cleanup
     */
    public dispose(): void {
        this.clearPreview();
        this.calculationCache.clear();
        
        // Clear references
        this.previewCircle = null;
        this.currentCircleInfo = null;
        this.viewer = null;
        this.referenceCircles = [];
        
        super.dispose();
    }

    /**
     * Enhanced preview clearing
     */
    protected clearPreview(): void {
        super.clearPreview();
        
        if (this.previewCircle) {
            this.emit('previewObjectRemoved', this.previewCircle);
            this.previewCircle = null;
        }
        
        this.previewInfo = {};
    }
}