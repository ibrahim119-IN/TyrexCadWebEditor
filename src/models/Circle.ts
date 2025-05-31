/**
 * Circle - Circle entity class
 * Represents a circle in 2D/3D space
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle } from '../core/GeometryEngine';

/**
 * Circle class - represents a circle
 */
export class Circle extends GeometricObject {
    // Center point
    private _center: Point3D;
    
    // Radius
    private _radius: number;
    
    // Normal vector (for 3D orientation)
    private _normal: Point3D;

    /**
     * Constructor - creates a circle
     */
    constructor(center: Point3D, radius: number, normal: Point3D = { x: 0, y: 0, z: 1 }) {
        super(GeometricObjectType.CIRCLE);
        
        this._center = { ...center };
        this._radius = radius;
        this._normal = { ...normal };
        
        this.logger.info(`Created circle at (${center.x}, ${center.y}, ${center.z}) with radius ${radius}`);
    }

    /**
     * Create geometric shape in OpenCASCADE
     */
    protected createOCShape(): OCShapeHandle {
        try {
            const circleHandle = this.geometryEngine.createCircle(
                this._center,
                this._normal,
                this._radius
            );
            
            this.logger.debug(`Created circle in OpenCASCADE - Handle: ${circleHandle}`);
            return circleHandle;
            
        } catch (error) {
            this.logger.error(`Failed to create circle in OpenCASCADE`, error);
            throw error;
        }
    }

    /**
     * Update geometric shape when properties change
     */
    protected updateOCShape(): void {
        // Delete old shape
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
        
        // New shape will be created on next access
        this.logger.debug(`Updated circle ${this._id}`);
    }

    /**
     * Calculate bounding box
     */
    public getBounds(): { min: Point3D; max: Point3D } {
        return {
            min: {
                x: this._center.x - this._radius,
                y: this._center.y - this._radius,
                z: this._center.z
            },
            max: {
                x: this._center.x + this._radius,
                y: this._center.y + this._radius,
                z: this._center.z
            }
        };
    }

    /**
     * Clone the circle
     */
    public clone(): Circle {
        const cloned = new Circle(this._center, this._radius, this._normal);
        
        // Copy properties from original
        cloned._layerId = this._layerId;
        cloned._visible = this._visible;
        cloned._locked = this._locked;
        cloned._visualProperties = { ...this._visualProperties };
        cloned._transform = {
            translation: { ...this._transform.translation },
            rotation: { ...this._transform.rotation },
            scale: { ...this._transform.scale }
        };
        
        return cloned;
    }

    /**
     * Calculate circumference
     */
    public getCircumference(): number {
        return 2 * Math.PI * this._radius;
    }

    /**
     * Calculate area
     */
    public getArea(): number {
        return Math.PI * Math.pow(this._radius, 2);
    }

    /**
     * Get point on circle at given angle
     */
    public getPointAtAngle(angle: number): Point3D {
        // For now, assume circle is in XY plane
        return {
            x: this._center.x + this._radius * Math.cos(angle),
            y: this._center.y + this._radius * Math.sin(angle),
            z: this._center.z
        };
    }

    /**
     * Check if point is on circle
     */
    public isPointOnCircle(point: Point3D, tolerance: number = 0.001): boolean {
        const distance = Math.sqrt(
            Math.pow(point.x - this._center.x, 2) +
            Math.pow(point.y - this._center.y, 2) +
            Math.pow(point.z - this._center.z, 2)
        );
        
        return Math.abs(distance - this._radius) < tolerance;
    }

    /**
     * Convert to JSON
     */
    public toJSON(): object {
        const baseJSON = super.toJSON();
        
        return {
            ...baseJSON,
            center: { ...this._center },
            radius: this._radius,
            normal: { ...this._normal },
            circumference: this.getCircumference(),
            area: this.getArea()
        };
    }

    /**
     * Restore from JSON
     */
    public fromJSON(data: any): void {
        super.fromJSON(data);
        
        if (data.center) {
            this._center = { ...data.center };
        }
        
        if (data.radius !== undefined) {
            this._radius = data.radius;
        }
        
        if (data.normal) {
            this._normal = { ...data.normal };
        }
        
        this._ocHandle = null;
    }

    /**
     * Create circle from JSON
     */
    public static fromJSON(data: any): Circle {
        const circle = new Circle(
            data.center || { x: 0, y: 0, z: 0 },
            data.radius || 1,
            data.normal || { x: 0, y: 0, z: 1 }
        );
        
        circle.fromJSON(data);
        return circle;
    }

    // Getters and Setters
    
    public get center(): Point3D { 
        return { ...this._center }; 
    }
    
    public set center(value: Point3D) {
        this._center = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get radius(): number { 
        return this._radius; 
    }
    
    public set radius(value: number) {
        if (value <= 0) {
            throw new Error('Radius must be positive');
        }
        this._radius = value;
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get normal(): Point3D { 
        return { ...this._normal }; 
    }
    
    public set normal(value: Point3D) {
        this._normal = { ...value };
        this.updateOCShape();
        this.updateModifiedTime();
    }
}