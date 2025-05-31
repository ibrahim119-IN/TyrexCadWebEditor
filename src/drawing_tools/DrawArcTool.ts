/**
 * DrawArcTool - Arc Drawing Tool
 * Tool for drawing arcs with multiple methods
 */

import { Vector3, BufferGeometry, LineBasicMaterial, Line as ThreeLine, EllipseCurve } from 'three';
import { AbstractDrawTool, DrawToolOptions, DrawResult, DrawMode } from './AbstractDrawTool';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { CommandManager, Command } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Arc } from '../models/Arc';
import { GeometricObject } from '../models/GeometricObject';

// Arc drawing modes
export enum ArcDrawMode {
    THREE_POINTS = 'three-points',          // Three points on arc
    CENTER_START_END = 'center-start-end',  // Center + start + end points
    CENTER_START_ANGLE = 'center-start-angle', // Center + start + angle
    START_END_RADIUS = 'start-end-radius',  // Start + end + radius
    TANGENT = 'tangent'                     // Tangent to existing curves
}

// Arc-specific options
export interface ArcToolOptions extends DrawToolOptions {
    drawMode?: ArcDrawMode;
    showRadius?: boolean;
    showAngle?: boolean;
    showArcLength?: boolean;
    showChordLength?: boolean;
    angleIncrement?: number;
    defaultAngle?: number;
    clockwise?: boolean;
}

// Arc information
export interface ArcInfo {
    center: Point3D;
    radius: number;
    startAngle: number;
    endAngle: number;
    sweepAngle: number;
    arcLength: number;
    chordLength: number;
    startPoint: Point3D;
    endPoint: Point3D;
    midPoint: Point3D;
}

// Add arc command
class AddArcCommand implements Command {
    private arc: Arc;
    private viewer: any;

    constructor(arc: Arc, viewer: any) {
        this.arc = arc;
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer?.addGeometricObject(this.arc);
    }

    undo(): void {
        this.viewer?.removeGeometricObject(this.arc.id);
    }

    getDescription(): string {
        return `Add arc: ${this.arc.id}`;
    }
}

/**
 * Arc Drawing Tool
 */
export class DrawArcTool extends AbstractDrawTool {
    private arcDrawMode: ArcDrawMode = ArcDrawMode.THREE_POINTS;
    private previewArc: ThreeLine | null = null;
    private currentArcInfo: ArcInfo | null = null;
    private viewer: any = null;

    // Arc-specific settings
    private arcOptions: ArcToolOptions;
    
    // Helper lines
    private helperLines: ThreeLine[] = [];

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: ArcToolOptions = {},
        mode: ArcDrawMode = ArcDrawMode.THREE_POINTS
    ) {
        super(
            'draw-arc',
            'Draw Arc',
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
                maxPoints: 3,
                minPoints: 3,
                drawMode: DrawMode.SINGLE,
                ...options
            }
        );

        this.arcDrawMode = mode;
        this.arcOptions = {
            ...this.options,
            showRadius: true,
            showAngle: true,
            showArcLength: true,
            showChordLength: false,
            angleIncrement: 15,
            defaultAngle: 90,
            clockwise: false,
            ...options
        } as ArcToolOptions;
    }

    // ==================== Required Abstract Functions ====================

    protected getRequiredPointCount(): number {
        switch (this.arcDrawMode) {
            case ArcDrawMode.THREE_POINTS:
                return 3;
            case ArcDrawMode.CENTER_START_END:
                return 3;
            case ArcDrawMode.CENTER_START_ANGLE:
                return 2; // Center + start (angle via mouse)
            case ArcDrawMode.START_END_RADIUS:
                return 3; // Start + end + radius point
            case ArcDrawMode.TANGENT:
                return 3;
            default:
                return 3;
        }
    }

    protected validatePoints(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        switch (this.arcDrawMode) {
            case ArcDrawMode.THREE_POINTS:
                return this.validateThreePoints();
            case ArcDrawMode.CENTER_START_END:
                return this.validateCenterStartEnd();
            case ArcDrawMode.CENTER_START_ANGLE:
                return this.validateCenterStartAngle();
            case ArcDrawMode.START_END_RADIUS:
                return this.validateStartEndRadius();
            default:
                return false;
        }
    }

    protected createGeometry(): GeometricObject | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            switch (this.arcDrawMode) {
                case ArcDrawMode.THREE_POINTS:
                    return this.createThreePointsArc();
                case ArcDrawMode.CENTER_START_END:
                    return this.createCenterStartEndArc();
                case ArcDrawMode.CENTER_START_ANGLE:
                    return this.createCenterStartAngleArc();
                case ArcDrawMode.START_END_RADIUS:
                    return this.createStartEndRadiusArc();
                default:
                    return null;
            }
        } catch (error) {
            this.logger.error('Failed to create arc:', error);
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
                this.calculateCurrentArcInfo();
                
                if (this.currentArcInfo) {
                    this.createArcPreview();
                    this.showHelperLines();
                    this.updateMeasurementDisplay();
                }
            }
        } catch (error) {
            this.logger.error('Failed to update arc preview:', error);
        }
    }

    protected getDisplayName(): string {
        const modeNames = {
            [ArcDrawMode.THREE_POINTS]: 'Arc (Three Points)',
            [ArcDrawMode.CENTER_START_END]: 'Arc (Center, Start, End)',
            [ArcDrawMode.CENTER_START_ANGLE]: 'Arc (Center, Start, Angle)',
            [ArcDrawMode.START_END_RADIUS]: 'Arc (Start, End, Radius)',
            [ArcDrawMode.TANGENT]: 'Arc (Tangent)'
        };
        
        return modeNames[this.arcDrawMode] || 'Draw Arc';
    }

    protected canComplete(): boolean {
        return this.inputPoints.length >= this.getRequiredPointCount() && 
               this.validatePoints() && 
               this.currentArcInfo !== null;
    }

    protected createAddCommand(object: GeometricObject): Command {
        return new AddArcCommand(object as Arc, this.viewer);
    }

    // ==================== Validation Methods ====================

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

    private validateCenterStartEnd(): boolean {
        if (this.inputPoints.length < 3) return false;
        
        const center = this.inputPoints[0].position;
        const start = this.inputPoints[1].position;
        const end = this.inputPoints[2].position;
        
        const radius1 = center.distanceTo(start);
        const radius2 = center.distanceTo(end);
        
        // Check if points are equidistant from center
        if (Math.abs(radius1 - radius2) > this.options.tolerance!) {
            this.logger.warn('Start and end points must be equidistant from center');
            return false;
        }

        return radius1 > this.options.tolerance!;
    }

    private validateCenterStartAngle(): boolean {
        if (this.inputPoints.length < 2) return false;
        
        const center = this.inputPoints[0].position;
        const start = this.inputPoints[1].position;
        const radius = center.distanceTo(start);
        
        return radius > this.options.tolerance!;
    }

    private validateStartEndRadius(): boolean {
        if (this.inputPoints.length < 3) return false;
        
        const start = this.inputPoints[0].position;
        const end = this.inputPoints[1].position;
        const distance = start.distanceTo(end);
        
        return distance > this.options.tolerance!;
    }

    // ==================== Arc Creation Methods ====================

    private createThreePointsArc(): Arc {
        const [p1, p2, p3] = this.inputPoints.map(ip => ip.position);
        
        const circleInfo = this.calculateCircleFromThreePoints(p1, p2, p3);
        if (!circleInfo) {
            throw new Error('Failed to calculate arc from three points');
        }
        
        const center = circleInfo.center;
        const radius = circleInfo.radius;
        
        const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
        const endAngle = Math.atan2(p3.y - center.y, p3.x - center.x);
        
        const arc = new Arc(
            { x: center.x, y: center.y, z: center.z },
            radius,
            startAngle,
            endAngle
        );
        
        this.logger.info(`Created three-point arc: ${arc.id}`);
        return arc;
    }

    private createCenterStartEndArc(): Arc {
        const center = this.inputPoints[0].position;
        const startPoint = this.inputPoints[1].position;
        const endPoint = this.inputPoints[2].position;
        
        const radius = center.distanceTo(startPoint);
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        
        const arc = new Arc(
            { x: center.x, y: center.y, z: center.z },
            radius,
            startAngle,
            endAngle
        );
        
        this.logger.info(`Created center-start-end arc: ${arc.id}`);
        return arc;
    }

    private createCenterStartAngleArc(): Arc {
        // This method would need angle input from current mouse position
        const center = this.inputPoints[0].position;
        const startPoint = this.inputPoints[1].position;
        
        const radius = center.distanceTo(startPoint);
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        
        // Calculate end angle based on current arc info
        if (!this.currentArcInfo) {
            throw new Error('No arc info available');
        }
        
        const arc = new Arc(
            { x: center.x, y: center.y, z: center.z },
            radius,
            startAngle,
            this.currentArcInfo.endAngle
        );
        
        this.logger.info(`Created center-start-angle arc: ${arc.id}`);
        return arc;
    }

    private createStartEndRadiusArc(): Arc {
        const start = this.inputPoints[0].position;
        const end = this.inputPoints[1].position;
        const radiusPoint = this.inputPoints[2].position;
        
        // Calculate center and radius from three constraints
        const centerInfo = this.calculateCenterFromStartEndRadius(start, end, radiusPoint);
        if (!centerInfo) {
            throw new Error('Failed to calculate arc center');
        }
        
        const startAngle = Math.atan2(start.y - centerInfo.center.y, start.x - centerInfo.center.x);
        const endAngle = Math.atan2(end.y - centerInfo.center.y, end.x - centerInfo.center.x);
        
        const arc = new Arc(
            { x: centerInfo.center.x, y: centerInfo.center.y, z: centerInfo.center.z },
            centerInfo.radius,
            startAngle,
            endAngle
        );
        
        this.logger.info(`Created start-end-radius arc: ${arc.id}`);
        return arc;
    }

    // ==================== Arc Calculations ====================

    private calculateCurrentArcInfo(): void {
        this.currentArcInfo = null;
        
        try {
            let center: Vector3;
            let radius: number;
            let startAngle: number;
            let endAngle: number;

            switch (this.arcDrawMode) {
                case ArcDrawMode.THREE_POINTS:
                    if (this.inputPoints.length >= 2 && this.currentPoint) {
                        const p1 = this.inputPoints[0].position;
                        const p2 = this.inputPoints[1].position;
                        const circleInfo = this.calculateCircleFromThreePoints(p1, p2, this.currentPoint);
                        if (!circleInfo) return;
                        
                        center = circleInfo.center;
                        radius = circleInfo.radius;
                        startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
                        endAngle = Math.atan2(this.currentPoint.y - center.y, this.currentPoint.x - center.x);
                    } else {
                        return;
                    }
                    break;

                case ArcDrawMode.CENTER_START_END:
                    if (this.inputPoints.length >= 2 && this.currentPoint) {
                        center = this.inputPoints[0].position;
                        const startPoint = this.inputPoints[1].position;
                        radius = center.distanceTo(startPoint);
                        startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
                        endAngle = Math.atan2(this.currentPoint.y - center.y, this.currentPoint.x - center.x);
                    } else if (this.inputPoints.length >= 1 && this.currentPoint) {
                        center = this.inputPoints[0].position;
                        radius = center.distanceTo(this.currentPoint);
                        startAngle = 0;
                        endAngle = Math.PI / 2;
                    } else {
                        return;
                    }
                    break;

                case ArcDrawMode.CENTER_START_ANGLE:
                    if (this.inputPoints.length >= 1 && this.currentPoint) {
                        center = this.inputPoints[0].position;
                        radius = center.distanceTo(this.currentPoint);
                        startAngle = Math.atan2(this.currentPoint.y - center.y, this.currentPoint.x - center.x);
                        
                        if (this.inputPoints.length >= 2) {
                            const startPoint = this.inputPoints[1].position;
                            radius = center.distanceTo(startPoint);
                            startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
                            endAngle = Math.atan2(this.currentPoint.y - center.y, this.currentPoint.x - center.x);
                        } else {
                            endAngle = startAngle + (this.arcOptions.defaultAngle || 90) * Math.PI / 180;
                        }
                    } else {
                        return;
                    }
                    break;

                default:
                    return;
            }

            const sweepAngle = this.calculateSweepAngle(startAngle, endAngle);
            const arcLength = radius * Math.abs(sweepAngle);
            
            const startPoint = new Vector3(
                center.x + radius * Math.cos(startAngle),
                center.y + radius * Math.sin(startAngle),
                center.z
            );
            
            const endPoint = new Vector3(
                center.x + radius * Math.cos(endAngle),
                center.y + radius * Math.sin(endAngle),
                center.z
            );
            
            const midAngle = startAngle + sweepAngle / 2;
            const midPoint = new Vector3(
                center.x + radius * Math.cos(midAngle),
                center.y + radius * Math.sin(midAngle),
                center.z
            );
            
            const chordLength = startPoint.distanceTo(endPoint);

            this.currentArcInfo = {
                center: { x: center.x, y: center.y, z: center.z },
                radius,
                startAngle,
                endAngle,
                sweepAngle,
                arcLength,
                chordLength,
                startPoint: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
                endPoint: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
                midPoint: { x: midPoint.x, y: midPoint.y, z: midPoint.z }
            };

            this.emit('arcInfoUpdated', this.currentArcInfo);

        } catch (error) {
            this.logger.error('Failed to calculate arc info:', error);
        }
    }

    private calculateSweepAngle(startAngle: number, endAngle: number): number {
        let sweep = endAngle - startAngle;
        
        if (this.arcOptions.clockwise) {
            if (sweep > 0) sweep -= 2 * Math.PI;
        } else {
            if (sweep < 0) sweep += 2 * Math.PI;
        }
        
        return sweep;
    }

    private calculateCircleFromThreePoints(p1: Vector3, p2: Vector3, p3: Vector3): { center: Vector3; radius: number } | null {
        const ax = p1.x, ay = p1.y;
        const bx = p2.x, by = p2.y;
        const cx = p3.x, cy = p3.y;

        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        
        if (Math.abs(d) < this.options.tolerance!) {
            return null;
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

    private calculateCenterFromStartEndRadius(start: Vector3, end: Vector3, radiusPoint: Vector3): { center: Vector3; radius: number } | null {
        // Calculate midpoint
        const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        // Calculate chord length
        const chordLength = start.distanceTo(end);
        
        // Calculate perpendicular direction
        const chordDir = new Vector3().subVectors(end, start).normalize();
        const perpDir = new Vector3(-chordDir.y, chordDir.x, 0);
        
        // Estimate radius from mouse position
        const estimatedRadius = mid.distanceTo(radiusPoint);
        
        // Calculate center offset
        const halfChord = chordLength / 2;
        if (estimatedRadius < halfChord) return null;
        
        const offset = Math.sqrt(estimatedRadius * estimatedRadius - halfChord * halfChord);
        
        // Determine which side of chord
        const toPoint = new Vector3().subVectors(radiusPoint, mid);
        const side = toPoint.dot(perpDir) > 0 ? 1 : -1;
        
        const center = mid.clone().add(perpDir.multiplyScalar(offset * side));
        
        return { center, radius: estimatedRadius };
    }

    private calculateTriangleArea(p1: Vector3, p2: Vector3, p3: Vector3): number {
        return 0.5 * Math.abs(
            (p2.x - p1.x) * (p3.y - p1.y) - 
            (p3.x - p1.x) * (p2.y - p1.y)
        );
    }

    // ==================== Preview Methods ====================

    private createArcPreview(): void {
        if (!this.currentArcInfo) return;

        const { center, radius, startAngle, endAngle } = this.currentArcInfo;
        
        // Create arc curve
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
            color: this.arcOptions.previewColor || '#2196F3',
            linewidth: 2
        });
        
        this.previewArc = new ThreeLine(geometry, material);
        this.previewArc.position.z = center.z;
        
        this.previewObjects.push(this.previewArc);
        this.emit('previewObjectCreated', this.previewArc);
    }

    private showHelperLines(): void {
        if (!this.currentArcInfo) return;
        
        const { center, radius, startPoint, endPoint } = this.currentArcInfo;
        const centerVec = new Vector3(center.x, center.y, center.z);
        
        // Create radius lines
        if (this.arcOptions.showRadius) {
            const startVec = new Vector3(startPoint.x, startPoint.y, startPoint.z);
            const endVec = new Vector3(endPoint.x, endPoint.y, endPoint.z);
            
            [startVec, endVec].forEach(point => {
                const geometry = new BufferGeometry().setFromPoints([centerVec, point]);
                const material = new LineBasicMaterial({
                    color: '#FF9800',
                    opacity: 0.6,
                    transparent: true
                });
                
                const radiusLine = new ThreeLine(geometry, material);
                this.helperLines.push(radiusLine);
                this.previewObjects.push(radiusLine);
                this.emit('previewObjectCreated', radiusLine);
            });
        }
    }

    private updateMeasurementDisplay(): void {
        if (!this.currentArcInfo) return;
        
        const { center, radius, sweepAngle, arcLength, chordLength } = this.currentArcInfo;
        
        // Show radius
        if (this.arcOptions.showRadius) {
            this.emit('measurementUpdate', {
                type: 'radius',
                value: `R: ${this.formatLength(radius)}`,
                position: center
            });
        }
        
        // Show angle
        if (this.arcOptions.showAngle) {
            const angleDegrees = Math.abs(sweepAngle) * 180 / Math.PI;
            this.emit('measurementUpdate', {
                type: 'angle',
                value: `${angleDegrees.toFixed(1)}°`,
                position: center
            });
        }
        
        // Show arc length
        if (this.arcOptions.showArcLength) {
            this.emit('measurementUpdate', {
                type: 'arcLength',
                value: `Arc: ${this.formatLength(arcLength)}`,
                position: this.currentArcInfo.midPoint
            });
        }
        
        // Show chord length
        if (this.arcOptions.showChordLength) {
            this.emit('measurementUpdate', {
                type: 'chordLength',
                value: `Chord: ${this.formatLength(chordLength)}`,
                position: this.currentArcInfo.midPoint
            });
        }
    }

    // ==================== Helper Methods ====================

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

    // ==================== Public Interface ====================

    public setArcDrawMode(mode: ArcDrawMode): void {
        if (this.state === 'drawing') {
            this.logger.warn('Cannot change drawing mode while drawing');
            return;
        }
        
        this.arcDrawMode = mode;
        this.resetTool();
        
        this.emit('drawModeChanged', { mode, toolId: this.toolId });
        this.logger.info(`Changed arc drawing mode to: ${mode}`);
    }

    public setViewer(viewer: any): void {
        this.viewer = viewer;
    }

    protected clearPreview(): void {
        super.clearPreview();
        
        this.helperLines.forEach(line => {
            this.emit('previewObjectRemoved', line);
        });
        this.helperLines = [];
        
        if (this.previewArc) {
            this.emit('previewObjectRemoved', this.previewArc);
            this.previewArc = null;
        }
    }
}