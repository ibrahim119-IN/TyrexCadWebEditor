/**
 * Arc - Arc entity class
 * Represents an arc in 2D/3D space
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle } from '../core/GeometryEngine';

/**
 * Arc class - represents an arc
 */
export class Arc extends GeometricObject {
    // Center point
    private _center: Point3D;
    
    // Radius
    private _radius: number;
    
    // Start angle (radians)
    private _startAngle: number;
    
    // End angle (radians)
    private _endAngle: number;
    
    // Normal vector (for 3D orientation)
    private _normal: Point3D;

    /**
     * Constructor - creates an arc
     */
    constructor(
        center: Point3D, 
        radius: number, 
        startAngle: number, 
        endAngle: number,
        normal: Point3D = { x: 0, y: 0, z: 1 }
    ) {
        super(GeometricObjectType.ARC);
        
        this._center = { ...center };
        this._radius = radius;
        this._startAngle = this.normalizeAngle(startAngle);
        this._endAngle = this.normalizeAngle(endAngle);
        this._normal = { ...normal };
        
        this.logger.info(`Created arc at (${center.x}, ${center.y}, ${center.z}) with radius ${radius}`);
    }

    /**
     * Create geometric shape in OpenCASCADE
     */
    protected createOCShape(): OCShapeHandle {
        try {
            // For now, create as a full circle - actual arc creation would need 
            // proper OpenCASCADE arc API
            const circleHandle = this.geometryEngine.createCircle(
                this._center,
                this._normal,
                this._radius
            );
            
            // TODO: Trim circle to arc using start/end angles
            
            this.logger.debug(`Created arc in OpenCASCADE - Handle: ${circleHandle}`);
            return circleHandle;
            
        } catch (error) {
            this.logger.error(`Failed to create arc in OpenCASCADE`, error);
            throw error;
        }
    }

    /**
     * Update geometric shape when properties change
     */
    protected updateOCShape(): void {
        if (this._ocHandle) {
            this.geometryEngine.deleteShape(this._ocHandle);
            this._ocHandle = null;
        }
        
        this.logger.debug(`Updated arc ${this._id}`);
    }

    /**
     * Calculate bounding box
     */
    public getBounds(): { min: Point3D; max: Point3D } {
        // Calculate bounds considering all possible arc positions
        const points: Point3D[] = [];
        
        // Add start and end points
        points.push(this.getStartPoint());
        points.push(this.getEndPoint());
        
        // Check if arc crosses any axis
        const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
        angles.forEach(angle => {
            if (this.containsAngle(angle)) {
                points.push({
                    x: this._center.x + this._radius * Math.cos(angle),
                    y: this._center.y + this._radius * Math.sin(angle),
                    z: this._center.z
                });
            }
        });
        
        // Find min and max from all points
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const zs = points.map(p => p.z);
        
        return {
            min: {
                x: Math.min(...xs),
                y: Math.min(...ys),
                z: Math.min(...zs)
            },
            max: {
                x: Math.max(...xs),
                y: Math.max(...ys),
                z: Math.max(...zs)
            }
        };
    }

    /**
     * Clone the arc
     */
    public clone(): Arc {
        const cloned = new Arc(
            this._center, 
            this._radius, 
            this._startAngle, 
            this._endAngle, 
            this._normal
        );
        
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
     * Get start point
     */
    public getStartPoint(): Point3D {
        return {
            x: this._center.x + this._radius * Math.cos(this._startAngle),
            y: this._center.y + this._radius * Math.sin(this._startAngle),
            z: this._center.z
        };
    }

    /**
     * Get end point
     */
    public getEndPoint(): Point3D {
        return {
            x: this._center.x + this._radius * Math.cos(this._endAngle),
            y: this._center.y + this._radius * Math.sin(this._endAngle),
            z: this._center.z
        };
    }

    /**
     * Get mid point
     */
    public getMidPoint(): Point3D {
        const midAngle = this._startAngle + this.getSweepAngle() / 2;
        return {
            x: this._center.x + this._radius * Math.cos(midAngle),
            y: this._center.y + this._radius * Math.sin(midAngle),
            z: this._center.z
        };
    }

    /**
     * Get sweep angle
     */
    public getSweepAngle(): number {
        let sweep = this._endAngle - this._startAngle;
        if (sweep < 0) sweep += 2 * Math.PI;
        return sweep;
    }

    /**
     * Get arc length
     */
    public getArcLength(): number {
        return this._radius * this.getSweepAngle();
    }

    /**
     * Get chord length
     */
    public getChordLength(): number {
        const start = this.getStartPoint();
        const end = this.getEndPoint();
        return Math.sqrt(
            Math.pow(end.x - start.x, 2) +
            Math.pow(end.y - start.y, 2) +
            Math.pow(end.z - start.z, 2)
        );
    }

    /**
     * Get point on arc at parameter t (0 to 1)
     */
    public getPointAtParameter(t: number): Point3D {
        const angle = this._startAngle + t * this.getSweepAngle();
        return {
            x: this._center.x + this._radius * Math.cos(angle),
            y: this._center.y + this._radius * Math.sin(angle),
            z: this._center.z
        };
    }

    /**
     * Check if angle is contained in arc
     */
    public containsAngle(angle: number): boolean {
        angle = this.normalizeAngle(angle);
        const start = this._startAngle;
        const end = this._endAngle;
        
        if (start <= end) {
            return angle >= start && angle <= end;
        } else {
            return angle >= start || angle <= end;
        }
    }

    /**
     * Normalize angle to [0, 2π)
     */
    private normalizeAngle(angle: number): number {
        angle = angle % (2 * Math.PI);
        if (angle < 0) angle += 2 * Math.PI;
        return angle;
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
            startAngle: this._startAngle,
            endAngle: this._endAngle,
            normal: { ...this._normal },
            sweepAngle: this.getSweepAngle(),
            arcLength: this.getArcLength(),
            chordLength: this.getChordLength()
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
        
        if (data.startAngle !== undefined) {
            this._startAngle = data.startAngle;
        }
        
        if (data.endAngle !== undefined) {
            this._endAngle = data.endAngle;
        }
        
        if (data.normal) {
            this._normal = { ...data.normal };
        }
        
        this._ocHandle = null;
    }

    /**
     * Create arc from JSON
     */
    public static fromJSON(data: any): Arc {
        const arc = new Arc(
            data.center || { x: 0, y: 0, z: 0 },
            data.radius || 1,
            data.startAngle || 0,
            data.endAngle || Math.PI,
            data.normal || { x: 0, y: 0, z: 1 }
        );
        
        arc.fromJSON(data);
        return arc;
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
    
    public get startAngle(): number { 
        return this._startAngle; 
    }
    
    public set startAngle(value: number) {
        this._startAngle = this.normalizeAngle(value);
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get endAngle(): number { 
        return this._endAngle; 
    }
    
    public set endAngle(value: number) {
        this._endAngle = this.normalizeAngle(value);
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