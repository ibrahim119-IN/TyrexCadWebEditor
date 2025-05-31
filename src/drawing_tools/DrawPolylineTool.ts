/**
 * DrawPolylineTool - Polyline Drawing Tool
 * Tool for drawing multi-segment lines (polylines)
 */

import { Vector3, BufferGeometry, LineBasicMaterial, Line as ThreeLine } from 'three';
import { AbstractDrawTool, DrawToolOptions, DrawResult, DrawMode } from './AbstractDrawTool';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { CommandManager, Command } from '../core/CommandManager';
import { SnapSystem } from '../systems/SnapSystem';
import { MeasurementSystem } from '../systems/MeasurementSystem';
import { Polyline } from '../models/Polyline';
import { GeometricObject } from '../models/GeometricObject';

// Polyline drawing modes
export enum PolylineDrawMode {
    OPEN = 'open',                   // Open polyline
    CLOSED = 'closed',               // Closed polyline (polygon)
    RECTANGLE = 'rectangle',         // Rectangle mode
    REGULAR_POLYGON = 'regular-polygon', // Regular polygon
    FREEHAND = 'freehand'           // Freehand drawing
}

// Polyline-specific options
export interface PolylineToolOptions extends Omit<DrawToolOptions, 'drawMode'> {
    polylineMode?: PolylineDrawMode;
    showLength?: boolean;
    showSegmentLengths?: boolean;
    showArea?: boolean;
    showAngles?: boolean;
    autoClose?: boolean;
    closeThreshold?: number;
    minSegmentLength?: number;
    smoothing?: boolean;
    polygonSides?: number;
}

// Polyline information
export interface PolylineInfo {
    vertices: Point3D[];
    totalLength: number;
    segmentLengths: number[];
    isClosed: boolean;
    area?: number;
    perimeter?: number;
    boundingBox: { min: Point3D; max: Point3D };
    centroid?: Point3D;
}

// Add polyline command
class AddPolylineCommand implements Command {
    private polyline: Polyline;
    private viewer: any;

    constructor(polyline: Polyline, viewer: any) {
        this.polyline = polyline;
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer?.addGeometricObject(this.polyline);
    }

    undo(): void {
        this.viewer?.removeGeometricObject(this.polyline.id);
    }

    getDescription(): string {
        return `Add polyline: ${this.polyline.id}`;
    }
}

/**
 * Polyline Drawing Tool
 */
export class DrawPolylineTool extends AbstractDrawTool {
    private polylineDrawMode: PolylineDrawMode = PolylineDrawMode.OPEN;
    private previewPolyline: ThreeLine | null = null;
    private currentPolylineInfo: PolylineInfo | null = null;
    private viewer: any = null;

    // Polyline-specific settings
    private polylineOptions: PolylineToolOptions;
    
    // Helper elements
    private vertexMarkers: ThreeLine[] = [];
    private segmentLabels: any[] = [];

    constructor(
        geometryEngine: GeometryEngine,
        commandManager: CommandManager,
        snapSystem: SnapSystem,
        measurementSystem: MeasurementSystem,
        options: PolylineToolOptions = {},
        mode: PolylineDrawMode = PolylineDrawMode.OPEN
    ) {
        super(
            'draw-polyline',
            'Draw Polyline',
            geometryEngine,
            commandManager,
            snapSystem,
            measurementSystem,
            {
                snapEnabled: true,
                measurementEnabled: true,
                previewEnabled: true,
                autoComplete: false,
                undoEnabled: true,
                constraintsEnabled: true,
                precision: 0.001,
                tolerance: 0.1,
                maxPoints: 1000,
                minPoints: 2,
                drawMode: DrawMode.CONTINUOUS,
                ...options
            }
        );

        this.polylineDrawMode = mode;
        this.polylineOptions = {
            ...this.options,
            showLength: true,
            showSegmentLengths: false,
            showArea: false,
            showAngles: false,
            autoClose: false,
            closeThreshold: 0.5,
            minSegmentLength: 0.1,
            smoothing: false,
            polygonSides: 6,
            ...options
        } as PolylineToolOptions;
    }

    // ==================== Required Abstract Functions ====================

    protected getRequiredPointCount(): number {
        switch (this.polylineDrawMode) {
            case PolylineDrawMode.RECTANGLE:
                return 2; // Two corners
            case PolylineDrawMode.REGULAR_POLYGON:
                return 2; // Center and radius point
            case PolylineDrawMode.FREEHAND:
                return 1; // Start point
            default:
                return 2; // Minimum for open/closed polylines
        }
    }

    protected validatePoints(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        // Check for minimum segment length
        if (this.polylineOptions.minSegmentLength) {
            for (let i = 1; i < this.inputPoints.length; i++) {
                const dist = this.inputPoints[i-1].position.distanceTo(this.inputPoints[i].position);
                if (dist < this.polylineOptions.minSegmentLength) {
                    this.logger.warn('Segment too short');
                    return false;
                }
            }
        }

        return true;
    }

    protected createGeometry(): GeometricObject | null {
        if (!this.validatePoints()) {
            return null;
        }

        try {
            switch (this.polylineDrawMode) {
                case PolylineDrawMode.OPEN:
                    return this.createOpenPolyline();
                case PolylineDrawMode.CLOSED:
                    return this.createClosedPolyline();
                case PolylineDrawMode.RECTANGLE:
                    return this.createRectangle();
                case PolylineDrawMode.REGULAR_POLYGON:
                    return this.createRegularPolygon();
                case PolylineDrawMode.FREEHAND:
                    return this.createFreehandPolyline();
                default:
                    return null;
            }
        } catch (error) {
            this.logger.error('Failed to create polyline:', error);
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
                this.calculateCurrentPolylineInfo();
                
                if (this.currentPolylineInfo) {
                    this.createPolylinePreview();
                    this.showVertexMarkers();
                    this.updateMeasurementDisplay();
                }
            }
        } catch (error) {
            this.logger.error('Failed to update polyline preview:', error);
        }
    }

    protected getDisplayName(): string {
        const modeNames = {
            [PolylineDrawMode.OPEN]: 'Polyline (Open)',
            [PolylineDrawMode.CLOSED]: 'Polyline (Closed)',
            [PolylineDrawMode.RECTANGLE]: 'Rectangle',
            [PolylineDrawMode.REGULAR_POLYGON]: 'Regular Polygon',
            [PolylineDrawMode.FREEHAND]: 'Freehand Polyline'
        };
        
        return modeNames[this.polylineDrawMode] || 'Draw Polyline';
    }

    protected canComplete(): boolean {
        if (this.inputPoints.length < this.getRequiredPointCount()) {
            return false;
        }

        // Special completion for different modes
        switch (this.polylineDrawMode) {
            case PolylineDrawMode.RECTANGLE:
            case PolylineDrawMode.REGULAR_POLYGON:
                return this.inputPoints.length >= this.getRequiredPointCount();
            default:
                return this.inputPoints.length >= 2;
        }
    }

    protected createAddCommand(object: GeometricObject): Command {
        return new AddPolylineCommand(object as Polyline, this.viewer);
    }

    // ==================== Polyline Creation Methods ====================

    private createOpenPolyline(): Polyline {
        const vertices = this.inputPoints.map(ip => ({
            x: ip.position.x,
            y: ip.position.y,
            z: ip.position.z
        }));
        
        const polyline = new Polyline(vertices, false);
        
        this.logger.info(`Created open polyline: ${polyline.id}`);
        return polyline;
    }

    private createClosedPolyline(): Polyline {
        const vertices = this.inputPoints.map(ip => ({
            x: ip.position.x,
            y: ip.position.y,
            z: ip.position.z
        }));
        
        const polyline = new Polyline(vertices, true);
        
        this.logger.info(`Created closed polyline: ${polyline.id}`);
        return polyline;
    }

    private createRectangle(): Polyline {
        if (this.inputPoints.length < 2) return this.createOpenPolyline();
        
        const p1 = this.inputPoints[0].position;
        const p2 = this.inputPoints[1].position;
        
        const vertices: Point3D[] = [
            { x: p1.x, y: p1.y, z: p1.z },
            { x: p2.x, y: p1.y, z: p1.z },
            { x: p2.x, y: p2.y, z: p1.z },
            { x: p1.x, y: p2.y, z: p1.z }
        ];
        
        const polyline = new Polyline(vertices, true);
        polyline.setMetadata('isRectangle', true);
        
        this.logger.info(`Created rectangle: ${polyline.id}`);
        return polyline;
    }

    private createRegularPolygon(): Polyline {
        if (this.inputPoints.length < 2) return this.createOpenPolyline();
        
        const center = this.inputPoints[0].position;
        const radiusPoint = this.inputPoints[1].position;
        const radius = center.distanceTo(radiusPoint);
        const sides = this.polylineOptions.polygonSides || 6;
        
        const vertices: Point3D[] = [];
        const angleStep = (2 * Math.PI) / sides;
        const startAngle = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x);
        
        for (let i = 0; i < sides; i++) {
            const angle = startAngle + i * angleStep;
            vertices.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
                z: center.z
            });
        }
        
        const polyline = new Polyline(vertices, true);
        polyline.setMetadata('isRegularPolygon', true);
        polyline.setMetadata('sides', sides);
        polyline.setMetadata('center', { x: center.x, y: center.y, z: center.z });
        polyline.setMetadata('radius', radius);
        
        this.logger.info(`Created regular polygon (${sides} sides): ${polyline.id}`);
        return polyline;
    }

    private createFreehandPolyline(): Polyline {
        // For freehand, we might want to smooth the points
        let vertices = this.inputPoints.map(ip => ({
            x: ip.position.x,
            y: ip.position.y,
            z: ip.position.z
        }));
        
        if (this.polylineOptions.smoothing) {
            vertices = this.smoothVertices(vertices);
        }
        
        const polyline = new Polyline(vertices, false);
        polyline.setMetadata('isFreehand', true);
        
        this.logger.info(`Created freehand polyline: ${polyline.id}`);
        return polyline;
    }

    // ==================== Polyline Calculations ====================

    private calculateCurrentPolylineInfo(): void {
        this.currentPolylineInfo = null;
        
        try {
            let vertices: Point3D[] = [];
            
            // Build vertex list based on mode
            switch (this.polylineDrawMode) {
                case PolylineDrawMode.RECTANGLE:
                    if (this.inputPoints.length >= 1 && this.currentPoint) {
                        const p1 = this.inputPoints[0].position;
                        vertices = [
                            { x: p1.x, y: p1.y, z: p1.z },
                            { x: this.currentPoint.x, y: p1.y, z: p1.z },
                            { x: this.currentPoint.x, y: this.currentPoint.y, z: p1.z },
                            { x: p1.x, y: this.currentPoint.y, z: p1.z }
                        ];
                    }
                    break;
                    
                case PolylineDrawMode.REGULAR_POLYGON:
                    if (this.inputPoints.length >= 1 && this.currentPoint) {
                        const center = this.inputPoints[0].position;
                        const radius = center.distanceTo(this.currentPoint);
                        const sides = this.polylineOptions.polygonSides || 6;
                        const angleStep = (2 * Math.PI) / sides;
                        const startAngle = Math.atan2(
                            this.currentPoint.y - center.y,
                            this.currentPoint.x - center.x
                        );
                        
                        vertices = [];
                        for (let i = 0; i < sides; i++) {
                            const angle = startAngle + i * angleStep;
                            vertices.push({
                                x: center.x + radius * Math.cos(angle),
                                y: center.y + radius * Math.sin(angle),
                                z: center.z
                            });
                        }
                    }
                    break;
                    
                default:
                    vertices = this.inputPoints.map(ip => ({
                        x: ip.position.x,
                        y: ip.position.y,
                        z: ip.position.z
                    }));
                    
                    if (this.currentPoint) {
                        vertices.push({
                            x: this.currentPoint.x,
                            y: this.currentPoint.y,
                            z: this.currentPoint.z
                        });
                    }
            }
            
            if (vertices.length < 2) return;
            
            // Calculate properties
            const segmentLengths: number[] = [];
            let totalLength = 0;
            
            for (let i = 1; i < vertices.length; i++) {
                const length = this.calculateDistance(vertices[i-1], vertices[i]);
                segmentLengths.push(length);
                totalLength += length;
            }
            
            const isClosed = this.shouldBeClosed(vertices);
            if (isClosed && vertices.length > 2) {
                const closingLength = this.calculateDistance(
                    vertices[vertices.length - 1],
                    vertices[0]
                );
                segmentLengths.push(closingLength);
                totalLength += closingLength;
            }
            
            // Calculate bounds
            const xs = vertices.map(v => v.x);
            const ys = vertices.map(v => v.y);
            const zs = vertices.map(v => v.z);
            
            const boundingBox = {
                min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
                max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) }
            };
            
            // Calculate area and centroid for closed polylines
            let area: number | undefined;
            let centroid: Point3D | undefined;
            
            if (isClosed && vertices.length > 2) {
                area = this.calculatePolygonArea(vertices);
                centroid = this.calculateCentroid(vertices);
            }
            
            this.currentPolylineInfo = {
                vertices,
                totalLength,
                segmentLengths,
                isClosed,
                area,
                perimeter: isClosed ? totalLength : undefined,
                boundingBox,
                centroid
            };

            this.emit('polylineInfoUpdated', this.currentPolylineInfo);

        } catch (error) {
            this.logger.error('Failed to calculate polyline info:', error);
        }
    }

    private shouldBeClosed(vertices: Point3D[]): boolean {
        if (this.polylineDrawMode === PolylineDrawMode.CLOSED ||
            this.polylineDrawMode === PolylineDrawMode.RECTANGLE ||
            this.polylineDrawMode === PolylineDrawMode.REGULAR_POLYGON) {
            return true;
        }
        
        // Auto-close if near first point
        if (this.polylineOptions.autoClose && vertices.length > 2) {
            const dist = this.calculateDistance(
                vertices[vertices.length - 1],
                vertices[0]
            );
            return dist < (this.polylineOptions.closeThreshold || 0.5);
        }
        
        return false;
    }

    private calculateDistance(p1: Point3D, p2: Point3D): number {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }

    private calculatePolygonArea(vertices: Point3D[]): number {
        let area = 0;
        const n = vertices.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    private calculateCentroid(vertices: Point3D[]): Point3D {
        let cx = 0, cy = 0;
        const n = vertices.length;
        
        for (let i = 0; i < n; i++) {
            cx += vertices[i].x;
            cy += vertices[i].y;
        }
        
        return {
            x: cx / n,
            y: cy / n,
            z: vertices[0].z
        };
    }

    private smoothVertices(vertices: Point3D[]): Point3D[] {
        if (vertices.length < 3) return vertices;
        
        const smoothed: Point3D[] = [vertices[0]];
        
        for (let i = 1; i < vertices.length - 1; i++) {
            smoothed.push({
                x: (vertices[i-1].x + vertices[i].x + vertices[i+1].x) / 3,
                y: (vertices[i-1].y + vertices[i].y + vertices[i+1].y) / 3,
                z: (vertices[i-1].z + vertices[i].z + vertices[i+1].z) / 3
            });
        }
        
        smoothed.push(vertices[vertices.length - 1]);
        return smoothed;
    }

    // ==================== Preview Methods ====================

    private createPolylinePreview(): void {
        if (!this.currentPolylineInfo) return;

        const { vertices, isClosed } = this.currentPolylineInfo;
        
        const points = vertices.map(v => new Vector3(v.x, v.y, v.z));
        
        if (isClosed && points.length > 2) {
            points.push(points[0].clone());
        }
        
        const geometry = new BufferGeometry().setFromPoints(points);
        
        const material = new LineBasicMaterial({
            color: this.polylineOptions.previewColor || '#2196F3',
            linewidth: 2
        });
        
        this.previewPolyline = new ThreeLine(geometry, material);
        this.previewObjects.push(this.previewPolyline);
        this.emit('previewObjectCreated', this.previewPolyline);
    }

    private showVertexMarkers(): void {
        if (!this.currentPolylineInfo) return;
        
        const { vertices } = this.currentPolylineInfo;
        
        vertices.forEach((vertex, index) => {
            const size = 0.1;
            const points = [
                new Vector3(vertex.x - size, vertex.y, vertex.z),
                new Vector3(vertex.x + size, vertex.y, vertex.z),
                new Vector3(vertex.x, vertex.y - size, vertex.z),
                new Vector3(vertex.x, vertex.y + size, vertex.z)
            ];
            
            const geometry = new BufferGeometry().setFromPoints(points);
            const material = new LineBasicMaterial({
                color: index === 0 ? '#4CAF50' : '#FF9800',
                opacity: 0.8,
                transparent: true
            });
            
            const marker = new ThreeLine(geometry, material);
            this.vertexMarkers.push(marker);
            this.previewObjects.push(marker);
            this.emit('previewObjectCreated', marker);
        });
    }

    private updateMeasurementDisplay(): void {
        if (!this.currentPolylineInfo) return;
        
        const { totalLength, area, perimeter, centroid } = this.currentPolylineInfo;
        
        // Show total length
        if (this.polylineOptions.showLength) {
            this.emit('measurementUpdate', {
                type: 'length',
                value: `Length: ${this.formatLength(totalLength)}`,
                position: centroid || this.currentPolylineInfo.vertices[0]
            });
        }
        
        // Show area for closed polylines
        if (this.polylineOptions.showArea && area !== undefined) {
            this.emit('measurementUpdate', {
                type: 'area',
                value: `Area: ${this.formatArea(area)}`,
                position: centroid
            });
        }
    }

    // ==================== Event Handlers ====================

    public onMouseClick(point: Vector3, existingObjects: any[] = []): DrawResult {
        const result = super.onMouseClick(point, existingObjects);
        
        // Handle auto-close
        if (result.success && this.polylineOptions.autoClose && 
            this.inputPoints.length > 2) {
            const firstPoint = this.inputPoints[0].position;
            const distance = point.distanceTo(firstPoint);
            
            if (distance < (this.polylineOptions.closeThreshold || 0.5)) {
                return this.completeDraw();
            }
        }
        
        return result;
    }

    public onDoubleClick(event: MouseEvent): void {
        // Complete polyline on double-click
        if (this.canComplete()) {
            this.completeDraw();
        }
    }

    // ==================== Helper Methods ====================

    private formatLength(length: number): string {
        if (length < 0.01) return '0.00m';
        if (length < 1) return `${(length * 100).toFixed(0)}cm`;
        if (length < 1000) return `${length.toFixed(2)}m`;
        return `${(length / 1000).toFixed(3)}km`;
    }

    private formatArea(area: number): string {
        if (area < 1) return `${(area * 10000).toFixed(0)}cm²`;
        if (area < 10000) return `${area.toFixed(2)}m²`;
        return `${(area / 10000).toFixed(3)}hectares`;
    }

    // ==================== Public Interface ====================

    public setPolylineDrawMode(mode: PolylineDrawMode): void {
        if (this.state === 'drawing') {
            this.logger.warn('Cannot change drawing mode while drawing');
            return;
        }
        
        this.polylineDrawMode = mode;
        this.resetTool();
        
        this.emit('drawModeChanged', { mode, toolId: this.toolId });
        this.logger.info(`Changed polyline drawing mode to: ${mode}`);
    }

    public setPolygonSides(sides: number): void {
        this.polylineOptions.polygonSides = Math.max(3, Math.min(20, sides));
        this.updatePreview();
    }

    public setViewer(viewer: any): void {
        this.viewer = viewer;
    }

    public undoLastVertex(): void {
        if (this.inputPoints.length > 1) {
            this.inputPoints.pop();
            this.updatePreview();
            this.emit('vertexRemoved', { count: this.inputPoints.length });
        }
    }

    protected clearPreview(): void {
        super.clearPreview();
        
        this.vertexMarkers.forEach(marker => {
            this.emit('previewObjectRemoved', marker);
        });
        this.vertexMarkers = [];
        
        if (this.previewPolyline) {
            this.emit('previewObjectRemoved', this.previewPolyline);
            this.previewPolyline = null;
        }
    }
}