/**
 * BuildingElement - Base class for architectural building elements
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle } from '../core/GeometryEngine';

// Building element types
export enum BuildingElementType {
    WALL = 'wall',
    DOOR = 'door',
    WINDOW = 'window',
    COLUMN = 'column',
    BEAM = 'beam',
    SLAB = 'slab',
    ROOF = 'roof',
    STAIR = 'stair',
    RAMP = 'ramp',
    RAILING = 'railing',
    FURNITURE = 'furniture',
    EQUIPMENT = 'equipment'
}

// Element properties
export interface BuildingElementProperties {
    material?: string;
    fireRating?: string;
    acousticRating?: number;
    thermalResistance?: number;
    loadBearing?: boolean;
    structuralMaterial?: string;
    finishMaterial?: string;
    manufacturer?: string;
    model?: string;
    cost?: number;
    [key: string]: any;
}

/**
 * Abstract base class for building elements
 */
export abstract class BuildingElement extends GeometricObject {
    // Element type
    protected elementType: BuildingElementType;
    
    // Element properties
    protected elementProperties: BuildingElementProperties;
    
    // Related elements
    protected connectedElements: string[] = [];
    protected hostedElements: string[] = [];
    protected hostElement?: string;
    
    // Level/Floor association
    protected levelId?: string;
    protected elevation: number = 0;

    constructor(type: GeometricObjectType, elementType: BuildingElementType) {
        super(type);
        this.elementType = elementType;
        this.elementProperties = {};
    }

    /**
     * Get element type
     */
    public getElementType(): BuildingElementType {
        return this.elementType;
    }

    /**
     * Set element property
     */
    public setProperty(key: string, value: any): void {
        this.elementProperties[key] = value;
        this.updateModifiedTime();
    }

    /**
     * Get element property
     */
    public getProperty(key: string): any {
        return this.elementProperties[key];
    }

    /**
     * Get all properties
     */
    public getProperties(): BuildingElementProperties {
        return { ...this.elementProperties };
    }

    /**
     * Add connected element
     */
    public addConnectedElement(elementId: string): void {
        if (!this.connectedElements.includes(elementId)) {
            this.connectedElements.push(elementId);
            this.updateModifiedTime();
        }
    }

    /**
     * Remove connected element
     */
    public removeConnectedElement(elementId: string): void {
        const index = this.connectedElements.indexOf(elementId);
        if (index !== -1) {
            this.connectedElements.splice(index, 1);
            this.updateModifiedTime();
        }
    }

    /**
     * Add hosted element
     */
    public addHostedElement(elementId: string): void {
        if (!this.hostedElements.includes(elementId)) {
            this.hostedElements.push(elementId);
            this.updateModifiedTime();
        }
    }

    /**
     * Remove hosted element
     */
    public removeHostedElement(elementId: string): void {
        const index = this.hostedElements.indexOf(elementId);
        if (index !== -1) {
            this.hostedElements.splice(index, 1);
            this.updateModifiedTime();
        }
    }

    /**
     * Set host element
     */
    public setHostElement(elementId?: string): void {
        this.hostElement = elementId;
        this.updateModifiedTime();
    }

    /**
     * Set level association
     */
    public setLevel(levelId: string, elevation: number = 0): void {
        this.levelId = levelId;
        this.elevation = elevation;
        this.updateModifiedTime();
    }

    /**
     * Convert to JSON
     */
    public toJSON(): object {
        const baseJSON = super.toJSON();
        
        return {
            ...baseJSON,
            elementType: this.elementType,
            elementProperties: { ...this.elementProperties },
            connectedElements: [...this.connectedElements],
            hostedElements: [...this.hostedElements],
            hostElement: this.hostElement,
            levelId: this.levelId,
            elevation: this.elevation
        };
    }

    /**
     * Restore from JSON
     */
    public fromJSON(data: any): void {
        super.fromJSON(data);
        
        if (data.elementType) {
            this.elementType = data.elementType;
        }
        
        if (data.elementProperties) {
            this.elementProperties = { ...data.elementProperties };
        }
        
        if (data.connectedElements) {
            this.connectedElements = [...data.connectedElements];
        }
        
        if (data.hostedElements) {
            this.hostedElements = [...data.hostedElements];
        }
        
        this.hostElement = data.hostElement;
        this.levelId = data.levelId;
        this.elevation = data.elevation || 0;
    }
}

/**
 * Wall element
 */
export class WallElement extends BuildingElement {
    private startPoint: Point3D;
    private endPoint: Point3D;
    private height: number;
    private thickness: number;
    private baseOffset: number = 0;

    constructor(
        startPoint: Point3D,
        endPoint: Point3D,
        height: number = 3,
        thickness: number = 0.2
    ) {
        super(GeometricObjectType.SOLID, BuildingElementType.WALL);
        
        this.startPoint = { ...startPoint };
        this.endPoint = { ...endPoint };
        this.height = height;
        this.thickness = thickness;
        
        // Default wall properties
        this.elementProperties = {
            material: 'Concrete',
            loadBearing: true,
            fireRating: '2HR',
            acousticRating: 50
        };
    }

    protected createOCShape(): OCShapeHandle {
        // Create wall geometry using GeometryEngine
        // This would create a box or swept profile
        const length = this.getLength();
        const wallBox = this.geometryEngine.createBox(
            length,
            this.thickness,
            this.height,
            this.startPoint
        );
        
        return wallBox;
    }

    protected updateOCShape(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
    }

    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: Math.min(this.startPoint.x, this.endPoint.x) - this.thickness / 2,
                y: Math.min(this.startPoint.y, this.endPoint.y) - this.thickness / 2,
                z: Math.min(this.startPoint.z, this.endPoint.z)
            },
            max: {
                x: Math.max(this.startPoint.x, this.endPoint.x) + this.thickness / 2,
                y: Math.max(this.startPoint.y, this.endPoint.y) + this.thickness / 2,
                z: Math.max(this.startPoint.z, this.endPoint.z) + this.height
            }
        };
    }

    public clone(): WallElement {
        const cloned = new WallElement(
            this.startPoint,
            this.endPoint,
            this.height,
            this.thickness
        );
        
        // Copy base properties
        cloned._layerId = this._layerId;
        cloned._visible = this._visible;
        cloned._locked = this._locked;
        cloned._visualProperties = { ...this._visualProperties };
        cloned.elementProperties = { ...this.elementProperties };
        
        return cloned;
    }

    public getLength(): number {
        return Math.sqrt(
            Math.pow(this.endPoint.x - this.startPoint.x, 2) +
            Math.pow(this.endPoint.y - this.startPoint.y, 2) +
            Math.pow(this.endPoint.z - this.startPoint.z, 2)
        );
    }

    public getArea(): number {
        return this.getLength() * this.height;
    }

    public getVolume(): number {
        return this.getArea() * this.thickness;
    }
}

/**
 * Door element
 */
export class DoorElement extends BuildingElement {
    private position: Point3D;
    private width: number;
    private height: number;
    private thickness: number;
    private swingDirection: 'left' | 'right' | 'double';
    private openingAngle: number = 90;

    constructor(
        position: Point3D,
        width: number = 0.9,
        height: number = 2.1,
        thickness: number = 0.05
    ) {
        super(GeometricObjectType.SOLID, BuildingElementType.DOOR);
        
        this.position = { ...position };
        this.width = width;
        this.height = height;
        this.thickness = thickness;
        this.swingDirection = 'left';
        
        // Default door properties
        this.elementProperties = {
            material: 'Wood',
            fireRating: '1HR',
            manufacturer: 'Generic',
            model: 'Standard Door'
        };
    }

    protected createOCShape(): OCShapeHandle {
        // Create door geometry
        return this.geometryEngine.createBox(
            this.width,
            this.thickness,
            this.height,
            this.position
        );
    }

    protected updateOCShape(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
    }

    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            },
            max: {
                x: this.position.x + this.width,
                y: this.position.y + this.thickness,
                z: this.position.z + this.height
            }
        };
    }

    public clone(): DoorElement {
        const cloned = new DoorElement(
            this.position,
            this.width,
            this.height,
            this.thickness
        );
        
        cloned._layerId = this._layerId;
        cloned._visible = this._visible;
        cloned._locked = this._locked;
        cloned._visualProperties = { ...this._visualProperties };
        cloned.elementProperties = { ...this.elementProperties };
        cloned.swingDirection = this.swingDirection;
        cloned.openingAngle = this.openingAngle;
        
        return cloned;
    }
}

/**
 * Window element
 */
export class WindowElement extends BuildingElement {
    private position: Point3D;
    private width: number;
    private height: number;
    private sillHeight: number;
    
    constructor(
        position: Point3D,
        width: number = 1.2,
        height: number = 1.5,
        sillHeight: number = 0.9
    ) {
        super(GeometricObjectType.SOLID, BuildingElementType.WINDOW);
        
        this.position = { ...position };
        this.width = width;
        this.height = height;
        this.sillHeight = sillHeight;
        
        // Default window properties
        this.elementProperties = {
            material: 'Aluminum',
            glazing: 'Double',
            uValue: 1.4,
            manufacturer: 'Generic',
            model: 'Standard Window'
        };
    }

    protected createOCShape(): OCShapeHandle {
        // Create window geometry
        const windowPosition = {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z + this.sillHeight
        };
        
        return this.geometryEngine.createBox(
            this.width,
            0.1, // Thin depth
            this.height,
            windowPosition
        );
    }

    protected updateOCShape(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
    }

    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z + this.sillHeight
            },
            max: {
                x: this.position.x + this.width,
                y: this.position.y + 0.1,
                z: this.position.z + this.sillHeight + this.height
            }
        };
    }

    public clone(): WindowElement {
        const cloned = new WindowElement(
            this.position,
            this.width,
            this.height,
            this.sillHeight
        );
        
        cloned._layerId = this._layerId;
        cloned._visible = this._visible;
        cloned._locked = this._locked;
        cloned._visualProperties = { ...this._visualProperties };
        cloned.elementProperties = { ...this.elementProperties };
        
        return cloned;
    }
}