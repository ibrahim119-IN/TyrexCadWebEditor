/**
 * MeasurementSystem - Dynamic measurement and dimension display system
 */

import { Vector3, Camera, Scene, Group, Line as ThreeLine, BufferGeometry, LineBasicMaterial, Sprite, SpriteMaterial, CanvasTexture } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Logger } from '../core/Logger';

// Dimension types
export enum DimensionType {
    LINEAR = 'linear',
    ANGULAR = 'angular',
    RADIAL = 'radial',
    DIAMETER = 'diameter',
    AREA = 'area',
    VOLUME = 'volume'
}

// Dimension style
export interface DimensionStyle {
    color: string;
    fontSize: number;
    fontFamily: string;
    lineWidth: number;
    arrowSize: number;
    textOffset: number;
    precision: number;
    unit: 'mm' | 'cm' | 'm' | 'ft' | 'in';
    showUnit: boolean;
}

// Dimension data
export interface DimensionData {
    id: string;
    type: DimensionType;
    points: Vector3[];
    value: number;
    text: string;
    visible: boolean;
    temporary: boolean;
    style?: Partial<DimensionStyle>;
}

/**
 * Measurement System class
 */
export class MeasurementSystem {
    private container: HTMLElement;
    private camera: Camera;
    private scene: Scene;
    private dimensionGroup: Group;
    private css2DRenderer!: CSS2DRenderer;
    private logger: Logger;
    
    // Dimensions
    private dimensions: Map<string, DimensionData> = new Map();
    private dimensionObjects: Map<string, Group> = new Map();
    
    // Preview dimension
    private previewDimension: DimensionData | null = null;
    private previewObject: Group | null = null;
    
    // Default style
    private defaultStyle: DimensionStyle = {
        color: '#000000',
        fontSize: 14,
        fontFamily: 'Arial',
        lineWidth: 1,
        arrowSize: 10,
        textOffset: 20,
        precision: 2,
        unit: 'm',
        showUnit: true
    };

    constructor(container: HTMLElement, camera: Camera) {
        this.container = container;
        this.camera = camera;
        this.scene = new Scene();
        this.dimensionGroup = new Group();
        this.dimensionGroup.name = 'dimensions';
        this.logger = Logger.getInstance();
        
        this.setupCSS2DRenderer();
    }

    /**
     * Setup CSS2D renderer for labels
     */
    private setupCSS2DRenderer(): void {
        this.css2DRenderer = new CSS2DRenderer();
        this.css2DRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.css2DRenderer.domElement.style.position = 'absolute';
        this.css2DRenderer.domElement.style.top = '0';
        this.css2DRenderer.domElement.style.pointerEvents = 'none';
        this.container.appendChild(this.css2DRenderer.domElement);
    }

    /**
     * Update camera
     */
    public updateCamera(camera: Camera): void {
        this.camera = camera;
    }

    /**
     * Add linear dimension
     */
    public addLinearDimension(
        point1: Vector3,
        point2: Vector3,
        offset: number = 20,
        style?: Partial<DimensionStyle>
    ): string {
        const id = this.generateId();
        const distance = point1.distanceTo(point2);
        
        const dimension: DimensionData = {
            id,
            type: DimensionType.LINEAR,
            points: [point1.clone(), point2.clone()],
            value: distance,
            text: this.formatLength(distance, style),
            visible: true,
            temporary: false,
            style
        };
        
        this.dimensions.set(id, dimension);
        this.createDimensionObject(dimension);
        
        return id;
    }

    /**
     * Add angular dimension
     */
    public addAngularDimension(
        center: Vector3,
        start: Vector3,
        end: Vector3,
        radius: number = 50,
        style?: Partial<DimensionStyle>
    ): string {
        const id = this.generateId();
        
        // Calculate angle
        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
        const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
        let angle = endAngle - startAngle;
        if (angle < 0) angle += 2 * Math.PI;
        
        const angleDegrees = angle * 180 / Math.PI;
        
        const dimension: DimensionData = {
            id,
            type: DimensionType.ANGULAR,
            points: [center.clone(), start.clone(), end.clone()],
            value: angleDegrees,
            text: `${angleDegrees.toFixed(1)}°`,
            visible: true,
            temporary: false,
            style
        };
        
        this.dimensions.set(id, dimension);
        this.createDimensionObject(dimension);
        
        return id;
    }

    /**
     * Show preview dimension
     */
    public showPreviewDimension(point1: Vector3, point2: Vector3): void {
        this.hidePreviewDimension();
        
        const distance = point1.distanceTo(point2);
        
        this.previewDimension = {
            id: 'preview',
            type: DimensionType.LINEAR,
            points: [point1.clone(), point2.clone()],
            value: distance,
            text: this.formatLength(distance),
            visible: true,
            temporary: true
        };
        
        this.previewObject = this.createLinearDimensionObject(this.previewDimension);
        this.dimensionGroup.add(this.previewObject);
    }

    /**
     * Hide preview dimension
     */
    public hidePreviewDimension(): void {
        if (this.previewObject) {
            this.dimensionGroup.remove(this.previewObject);
            this.disposeGroup(this.previewObject);
            this.previewObject = null;
            this.previewDimension = null;
        }
    }

    /**
     * Create dimension object
     */
    private createDimensionObject(dimension: DimensionData): void {
        let object: Group;
        
        switch (dimension.type) {
            case DimensionType.LINEAR:
                object = this.createLinearDimensionObject(dimension);
                break;
            case DimensionType.ANGULAR:
                object = this.createAngularDimensionObject(dimension);
                break;
            default:
                return;
        }
        
        this.dimensionObjects.set(dimension.id, object);
        this.dimensionGroup.add(object);
    }

    /**
     * Create linear dimension object
     */
    private createLinearDimensionObject(dimension: DimensionData): Group {
        const group = new Group();
        const style = { ...this.defaultStyle, ...dimension.style };
        
        const [p1, p2] = dimension.points;
        const direction = new Vector3().subVectors(p2, p1).normalize();
        const perpendicular = new Vector3(-direction.y, direction.x, 0).normalize();
        const offset = style.textOffset;
        
        // Offset points
        const offsetP1 = p1.clone().add(perpendicular.clone().multiplyScalar(offset));
        const offsetP2 = p2.clone().add(perpendicular.clone().multiplyScalar(offset));
        
        // Extension lines
        const ext1Geometry = new BufferGeometry().setFromPoints([p1, offsetP1]);
        const ext2Geometry = new BufferGeometry().setFromPoints([p2, offsetP2]);
        
        const lineMaterial = new LineBasicMaterial({
            color: style.color,
            linewidth: style.lineWidth
        });
        
        const ext1 = new ThreeLine(ext1Geometry, lineMaterial);
        const ext2 = new ThreeLine(ext2Geometry, lineMaterial);
        
        group.add(ext1, ext2);
        
        // Dimension line
        const dimGeometry = new BufferGeometry().setFromPoints([offsetP1, offsetP2]);
        const dimLine = new ThreeLine(dimGeometry, lineMaterial);
        group.add(dimLine);
        
        // Arrows
        this.addArrows(group, offsetP1, offsetP2, direction, style);
        
        // Text label
        const midPoint = new Vector3().addVectors(offsetP1, offsetP2).multiplyScalar(0.5);
        this.addTextLabel(group, dimension.text, midPoint, style);
        
        return group;
    }

    /**
     * Create angular dimension object
     */
    private createAngularDimensionObject(dimension: DimensionData): Group {
        const group = new Group();
        const style = { ...this.defaultStyle, ...dimension.style };
        
        const [center, start, end] = dimension.points;
        const radius = style.textOffset * 2;
        
        // Calculate angles
        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
        const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
        
        // Create arc
        const arcPoints: Vector3[] = [];
        const segments = 32;
        let angle = startAngle;
        const angleStep = (endAngle - startAngle) / segments;
        
        for (let i = 0; i <= segments; i++) {
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            arcPoints.push(new Vector3(x, y, center.z));
            angle += angleStep;
        }
        
        const arcGeometry = new BufferGeometry().setFromPoints(arcPoints);
        const arcMaterial = new LineBasicMaterial({
            color: style.color,
            linewidth: style.lineWidth
        });
        
        const arc = new ThreeLine(arcGeometry, arcMaterial);
        group.add(arc);
        
        // Extension lines
        const ext1Start = center.clone();
        const ext1End = new Vector3(
            center.x + radius * Math.cos(startAngle),
            center.y + radius * Math.sin(startAngle),
            center.z
        );
        
        const ext2Start = center.clone();
        const ext2End = new Vector3(
            center.x + radius * Math.cos(endAngle),
            center.y + radius * Math.sin(endAngle),
            center.z
        );
        
        const ext1Geometry = new BufferGeometry().setFromPoints([ext1Start, ext1End]);
        const ext2Geometry = new BufferGeometry().setFromPoints([ext2Start, ext2End]);
        
        const ext1 = new ThreeLine(ext1Geometry, arcMaterial);
        const ext2 = new ThreeLine(ext2Geometry, arcMaterial);
        
        group.add(ext1, ext2);
        
        // Text label
        const midAngle = (startAngle + endAngle) / 2;
        const textPosition = new Vector3(
            center.x + radius * Math.cos(midAngle),
            center.y + radius * Math.sin(midAngle),
            center.z
        );
        
        this.addTextLabel(group, dimension.text, textPosition, style);
        
        return group;
    }

    /**
     * Add arrows to dimension line
     */
    private addArrows(
        group: Group,
        start: Vector3,
        end: Vector3,
        direction: Vector3,
        style: DimensionStyle
    ): void {
        const arrowSize = style.arrowSize;
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        // Start arrow
        const arrow1Dir1 = direction.clone().applyAxisAngle(new Vector3(0, 0, 1), arrowAngle);
        const arrow1Dir2 = direction.clone().applyAxisAngle(new Vector3(0, 0, 1), -arrowAngle);
        
        const arrow1Points = [
            start.clone().add(arrow1Dir1.clone().multiplyScalar(arrowSize)),
            start,
            start.clone().add(arrow1Dir2.clone().multiplyScalar(arrowSize))
        ];
        
        // End arrow
        const arrow2Dir1 = direction.clone().negate().applyAxisAngle(new Vector3(0, 0, 1), arrowAngle);
        const arrow2Dir2 = direction.clone().negate().applyAxisAngle(new Vector3(0, 0, 1), -arrowAngle);
        
        const arrow2Points = [
            end.clone().add(arrow2Dir1.clone().multiplyScalar(arrowSize)),
            end,
            end.clone().add(arrow2Dir2.clone().multiplyScalar(arrowSize))
        ];
        
        const material = new LineBasicMaterial({
            color: style.color,
            linewidth: style.lineWidth
        });
        
        const arrow1Geometry = new BufferGeometry().setFromPoints(arrow1Points);
        const arrow2Geometry = new BufferGeometry().setFromPoints(arrow2Points);
        
        const arrow1 = new ThreeLine(arrow1Geometry, material);
        const arrow2 = new ThreeLine(arrow2Geometry, material);
        
        group.add(arrow1, arrow2);
    }

    /**
     * Add text label
     */
    private addTextLabel(
        group: Group,
        text: string,
        position: Vector3,
        style: DimensionStyle
    ): void {
        // Create HTML element
        const labelDiv = document.createElement('div');
        labelDiv.className = 'dimension-label';
        labelDiv.textContent = text;
        labelDiv.style.color = style.color;
        labelDiv.style.fontSize = `${style.fontSize}px`;
        labelDiv.style.fontFamily = style.fontFamily;
        labelDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        labelDiv.style.padding = '2px 4px';
        labelDiv.style.borderRadius = '2px';
        labelDiv.style.whiteSpace = 'nowrap';
        
        const label = new CSS2DObject(labelDiv);
        label.position.copy(position);
        group.add(label);
    }

    /**
     * Format length
     */
    private formatLength(length: number, style?: Partial<DimensionStyle>): string {
        const s = { ...this.defaultStyle, ...style };
        let value: number;
        let unit: string = '';
        
        switch (s.unit) {
            case 'mm':
                value = length * 1000;
                unit = 'mm';
                break;
            case 'cm':
                value = length * 100;
                unit = 'cm';
                break;
            case 'm':
                value = length;
                unit = 'm';
                break;
            case 'ft':
                value = length * 3.28084;
                unit = 'ft';
                break;
            case 'in':
                value = length * 39.3701;
                unit = 'in';
                break;
            default:
                value = length;
                unit = 'm';
        }
        
        const formatted = value.toFixed(s.precision);
        return s.showUnit ? `${formatted} ${unit}` : formatted;
    }

    /**
     * Update all dimensions
     */
    public updateAllDimensions(): void {
        // Update visibility based on camera
        // Could implement LOD or occlusion here
    }

    /**
     * Remove dimension
     */
    public removeDimension(id: string): void {
        const dimension = this.dimensions.get(id);
        const object = this.dimensionObjects.get(id);
        
        if (dimension && object) {
            this.dimensions.delete(id);
            this.dimensionObjects.delete(id);
            this.dimensionGroup.remove(object);
            this.disposeGroup(object);
        }
    }

    /**
     * Clear all dimensions
     */
    public clearAllDimensions(): void {
        this.dimensions.forEach((dimension, id) => {
            this.removeDimension(id);
        });
    }

    /**
     * Set dimension visibility
     */
    public setDimensionVisibility(id: string, visible: boolean): void {
        const dimension = this.dimensions.get(id);
        const object = this.dimensionObjects.get(id);
        
        if (dimension && object) {
            dimension.visible = visible;
            object.visible = visible;
        }
    }

    /**
     * Update style
     */
    public updateDefaultStyle(style: Partial<DimensionStyle>): void {
        Object.assign(this.defaultStyle, style);
    }

    /**
     * Render dimensions
     */
    public render(): void {
        if (this.css2DRenderer && this.camera) {
            this.css2DRenderer.render(this.dimensionGroup, this.camera);
        }
    }

    /**
     * Resize handler
     */
    public onResize(width: number, height: number): void {
        if (this.css2DRenderer) {
            this.css2DRenderer.setSize(width, height);
        }
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `dim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Dispose group and its children
     */
    private disposeGroup(group: Group): void {
        group.traverse((child) => {
            if (child instanceof ThreeLine) {
                child.geometry.dispose();
                if (child.material instanceof LineBasicMaterial) {
                    child.material.dispose();
                }
            }
        });
        
        // Remove CSS2D objects
        const css2DObjects: CSS2DObject[] = [];
        group.traverse((child) => {
            if (child instanceof CSS2DObject) {
                css2DObjects.push(child);
            }
        });
        
        css2DObjects.forEach(obj => {
            group.remove(obj);
            obj.element.remove();
        });
    }

    /**
     * Get dimension group for adding to scene
     */
    public getDimensionGroup(): Group {
        return this.dimensionGroup;
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.clearAllDimensions();
        this.hidePreviewDimension();
        
        if (this.css2DRenderer) {
            this.css2DRenderer.domElement.remove();
        }
    }
}