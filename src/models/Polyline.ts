/**
 * Polyline - Polyline entity class
 * Represents a multi-segment line in 2D/3D space
 */

import { GeometricObject, GeometricObjectType, Point3D } from './GeometricObject';
import { OCShapeHandle } from '../core/GeometryEngine';

/**
 * Polyline class - represents a polyline
 */
export class Polyline extends GeometricObject {
    // Vertices
    private _vertices: Point3D[];
    
    // Is closed
    private _isClosed: boolean;

    /**
     * Constructor - creates a polyline
     */
    constructor(vertices: Point3D[], isClosed: boolean = false) {
        super(GeometricObjectType.POLYLINE);
        
        if (vertices.length < 2) {
            throw new Error('Polyline must have at least 2 vertices');
        }
        
        this._vertices = vertices.map(v => ({ ...v }));
        this._isClosed = isClosed;
        
        this.logger.info(`Created polyline with ${vertices.length} vertices`);
    }

    /**
     * Create geometric shape in OpenCASCADE
     */
    protected createOCShape(): OCShapeHandle {
        try {
            // Create individual line segments
            const segments: OCShapeHandle[] = [];
            
            for (let i = 0; i < this._vertices.length - 1; i++) {
                const handle = this.geometryEngine.createLine(
                    this._vertices[i],
                    this._vertices[i + 1]
                );
                segments.push(handle);
            }
            
            // If closed, add closing segment
            if (this._isClosed && this._vertices.length > 2) {
                const handle = this.geometryEngine.createLine(
                    this._vertices[this._vertices.length - 1],
                    this._vertices[0]
                );
                segments.push(handle);
            }
            
            // TODO: Combine segments into a wire
            // For now, return first segment as placeholder
            
            this.logger.debug(`Created polyline in OpenCASCADE with ${segments.length} segments`);
            return segments[0];
            
        } catch (error) {
            this.logger.error(`Failed to create polyline in OpenCASCADE`, error);
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
        
        this.logger.debug(`Updated polyline ${this._id}`);
    }

    /**
     * Calculate bounding box
     */
    public getBounds(): { min: Point3D; max: Point3D } {
        const xs = this._vertices.map(v => v.x);
        const ys = this._vertices.map(v => v.y);
        const zs = this._vertices.map(v => v.z);
        
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
     * Clone the polyline
     */
    public clone(): Polyline {
        const cloned = new Polyline(this._vertices, this._isClosed);
        
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
     * Get total length
     */
    public getTotalLength(): number {
        let length = 0;
        
        for (let i = 1; i < this._vertices.length; i++) {
            length += this.getSegmentLength(i - 1);
        }
        
        if (this._isClosed && this._vertices.length > 2) {
            length += this.getClosingSegmentLength();
        }
        
        return length;
    }

    /**
     * Get segment length
     */
    public getSegmentLength(index: number): number {
        if (index < 0 || index >= this._vertices.length - 1) {
            throw new Error('Invalid segment index');
        }
        
        const p1 = this._vertices[index];
        const p2 = this._vertices[index + 1];
        
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }

    /**
     * Get closing segment length
     */
    public getClosingSegmentLength(): number {
        if (!this._isClosed || this._vertices.length < 3) {
            return 0;
        }
        
        const p1 = this._vertices[this._vertices.length - 1];
        const p2 = this._vertices[0];
        
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }

    /**
     * Get area (for closed polylines)
     */
    public getArea(): number {
        if (!this._isClosed || this._vertices.length < 3) {
            return 0;
        }
        
        let area = 0;
        const n = this._vertices.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this._vertices[i].x * this._vertices[j].y;
            area -= this._vertices[j].x * this._vertices[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    /**
     * Get centroid
     */
    public getCentroid(): Point3D {
        let cx = 0, cy = 0, cz = 0;
        const n = this._vertices.length;
        
        for (const vertex of this._vertices) {
            cx += vertex.x;
            cy += vertex.y;
            cz += vertex.z;
        }
        
        return {
            x: cx / n,
            y: cy / n,
            z: cz / n
        };
    }

    /**
     * Add vertex
     */
    public addVertex(vertex: Point3D, index?: number): void {
        if (index === undefined) {
            this._vertices.push({ ...vertex });
        } else {
            if (index < 0 || index > this._vertices.length) {
                throw new Error('Invalid vertex index');
            }
            this._vertices.splice(index, 0, { ...vertex });
        }
        
        this.updateOCShape();
        this.updateModifiedTime();
    }

    /**
     * Remove vertex
     */
    public removeVertex(index: number): void {
        if (index < 0 || index >= this._vertices.length) {
            throw new Error('Invalid vertex index');
        }
        
        if (this._vertices.length <= 2) {
            throw new Error('Cannot remove vertex - polyline must have at least 2 vertices');
        }
        
        this._vertices.splice(index, 1);
        this.updateOCShape();
        this.updateModifiedTime();
    }

    /**
     * Update vertex
     */
    public updateVertex(index: number, vertex: Point3D): void {
        if (index < 0 || index >= this._vertices.length) {
            throw new Error('Invalid vertex index');
        }
        
        this._vertices[index] = { ...vertex };
        this.updateOCShape();
        this.updateModifiedTime();
    }

    /**
     * Get point at parameter t (0 to 1)
     */
    public getPointAtParameter(t: number): Point3D {
        const totalLength = this.getTotalLength();
        const targetLength = t * totalLength;
        
        let accumulatedLength = 0;
        
        // Find segment containing target point
        for (let i = 0; i < this._vertices.length - 1; i++) {
            const segmentLength = this.getSegmentLength(i);
            
            if (accumulatedLength + segmentLength >= targetLength) {
                // Point is on this segment
                const segmentT = (targetLength - accumulatedLength) / segmentLength;
                const p1 = this._vertices[i];
                const p2 = this._vertices[i + 1];
                
                return {
                    x: p1.x + (p2.x - p1.x) * segmentT,
                    y: p1.y + (p2.y - p1.y) * segmentT,
                    z: p1.z + (p2.z - p1.z) * segmentT
                };
            }
            
            accumulatedLength += segmentLength;
        }
        
        // Check closing segment
        if (this._isClosed && this._vertices.length > 2) {
            const closingLength = this.getClosingSegmentLength();
            const segmentT = (targetLength - accumulatedLength) / closingLength;
            const p1 = this._vertices[this._vertices.length - 1];
            const p2 = this._vertices[0];
            
            return {
                x: p1.x + (p2.x - p1.x) * segmentT,
                y: p1.y + (p2.y - p1.y) * segmentT,
                z: p1.z + (p2.z - p1.z) * segmentT
            };
        }
        
        // Return last vertex if t = 1
        return { ...this._vertices[this._vertices.length - 1] };
    }

    /**
     * Convert to JSON
     */
    public toJSON(): object {
        const baseJSON = super.toJSON();
        
        return {
            ...baseJSON,
            vertices: this._vertices.map(v => ({ ...v })),
            isClosed: this._isClosed,
            vertexCount: this._vertices.length,
            totalLength: this.getTotalLength(),
            area: this.getArea()
        };
    }

    /**
     * Restore from JSON
     */
    public fromJSON(data: any): void {
        super.fromJSON(data);
        
        if (data.vertices && Array.isArray(data.vertices)) {
            this._vertices = data.vertices.map((v: any) => ({
                x: v.x || 0,
                y: v.y || 0,
                z: v.z || 0
            }));
        }
        
        if (data.isClosed !== undefined) {
            this._isClosed = data.isClosed;
        }
        
        this._ocHandle = null;
    }

    /**
     * Create polyline from JSON
     */
    public static fromJSON(data: any): Polyline {
        const vertices = data.vertices || [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 }
        ];
        
        const polyline = new Polyline(vertices, data.isClosed || false);
        polyline.fromJSON(data);
        return polyline;
    }

    // Getters and Setters
    
    public get vertices(): Point3D[] { 
        return this._vertices.map(v => ({ ...v })); 
    }
    
    public set vertices(value: Point3D[]) {
        if (value.length < 2) {
            throw new Error('Polyline must have at least 2 vertices');
        }
        this._vertices = value.map(v => ({ ...v }));
        this.updateOCShape();
        this.updateModifiedTime();
    }
    
    public get vertexCount(): number {
        return this._vertices.length;
    }
    
    public get isClosed(): boolean { 
        return this._isClosed; 
    }
    
    public set isClosed(value: boolean) {
        this._isClosed = value;
        this.updateOCShape();
        this.updateModifiedTime();
    }
}