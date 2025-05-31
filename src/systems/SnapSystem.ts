/**
 * SnapSystem - Advanced Geometric Snapping System
 * Provides precise snapping to geometric features
 */

import { Vector3 } from 'three';
import { GeometryEngine, Point3D } from '../core/GeometryEngine';
import { GeometricObject } from '../models/GeometricObject';
import { Line } from '../models/Line';
import { Circle } from '../models/Circle';
import { Arc } from '../models/Arc';
import { Polyline } from '../models/Polyline';
import { Constants } from '../core/Constants';
import { Logger } from '../core/Logger';

// Snap result
export interface SnapResult {
    point: Vector3;          // The snapped point
    snapped: boolean;        // Whether snapping occurred
    type?: SnapType;         // Type of snap
    target?: GeometricObject; // Target object snapped to
    feature?: string;        // Specific feature (e.g., "endpoint", "center")
    distance?: number;       // Distance from original point
}

// Snap types
export enum SnapType {
    GRID = 'grid',                   // Grid snap
    ENDPOINT = 'endpoint',           // Line/arc endpoints
    MIDPOINT = 'midpoint',           // Midpoints
    CENTER = 'center',               // Circle/arc centers
    INTERSECTION = 'intersection',   // Intersections
    PERPENDICULAR = 'perpendicular', // Perpendicular points
    TANGENT = 'tangent',             // Tangent points
    NEAREST = 'nearest',             // Nearest point on curve
    QUADRANT = 'quadrant',           // Circle quadrants
    NODE = 'node',                   // Polyline nodes
    EXTENSION = 'extension',         // Line extensions
    PARALLEL = 'parallel',           // Parallel lines
    ANGLE = 'angle'                  // Angle snap
}

// Snap settings
export interface SnapSettings {
    gridEnabled: boolean;
    gridSize: number;
    endpointEnabled: boolean;
    midpointEnabled: boolean;
    centerEnabled: boolean;
    intersectionEnabled: boolean;
    perpendicularEnabled: boolean;
    tangentEnabled: boolean;
    nearestEnabled: boolean;
    quadrantEnabled: boolean;
    nodeEnabled: boolean;
    extensionEnabled: boolean;
    angleEnabled: boolean;
    snapDistance: number;
    angleIncrement: number;
}

// Snap candidate
interface SnapCandidate {
    point: Vector3;
    type: SnapType;
    target?: GeometricObject;
    feature?: string;
    distance: number;
    priority: number;
}

/**
 * Advanced Snap System
 */
export class SnapSystem {
    private geometryEngine: GeometryEngine;
    private logger: Logger;
    
    // Settings
    private settings: SnapSettings;
    
    // Cache for performance
    private snapCache: Map<string, SnapCandidate[]> = new Map();
    private cacheTimeout: number = 100; // ms
    private lastCacheTime: number = 0;

    constructor() {
        this.geometryEngine = GeometryEngine.getInstance();
        this.logger = Logger.getInstance();
        
        // Default settings
        this.settings = {
            gridEnabled: true,
            gridSize: Constants.GRID.DEFAULT_SIZE,
            endpointEnabled: true,
            midpointEnabled: true,
            centerEnabled: true,
            intersectionEnabled: true,
            perpendicularEnabled: true,
            tangentEnabled: true,
            nearestEnabled: true,
            quadrantEnabled: true,
            nodeEnabled: true,
            extensionEnabled: false,
            angleEnabled: true,
            snapDistance: Constants.SNAP.ENDPOINT_SNAP_DISTANCE,
            angleIncrement: 15 // degrees
        };
    }

    /**
     * Main snap function
     */
    public snap(
        point: Vector3,
        objects: GeometricObject[] = [],
        referencePoint?: Vector3,
        activeObject?: GeometricObject
    ): SnapResult {
        const candidates: SnapCandidate[] = [];
        
        // Clear cache if expired
        if (Date.now() - this.lastCacheTime > this.cacheTimeout) {
            this.snapCache.clear();
        }
        
        // Collect all snap candidates
        this.collectSnapCandidates(point, objects, referencePoint, activeObject, candidates);
        
        // Sort by priority and distance
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.distance - b.distance; // Closer distance first
        });
        
        // Return best candidate or grid snap
        if (candidates.length > 0 && candidates[0].distance < this.settings.snapDistance) {
            const best = candidates[0];
            return {
                point: best.point,
                snapped: true,
                type: best.type,
                target: best.target,
                feature: best.feature,
                distance: best.distance
            };
        }
        
        // Grid snap as fallback
        if (this.settings.gridEnabled) {
            return this.snapToGrid(point);
        }
        
        return {
            point: point.clone(),
            snapped: false
        };
    }

    /**
     * Collect all snap candidates
     */
    private collectSnapCandidates(
        point: Vector3,
        objects: GeometricObject[],
        referencePoint: Vector3 | undefined,
        activeObject: GeometricObject | undefined,
        candidates: SnapCandidate[]
    ): void {
        // Object snaps
        objects.forEach(object => {
            if (object === activeObject) return; // Skip active object
            
            // Get candidates for this object
            const objectCandidates = this.getObjectSnapCandidates(point, object);
            candidates.push(...objectCandidates);
        });
        
        // Angle snaps (if drawing from reference point)
        if (referencePoint && this.settings.angleEnabled) {
            const angleSnaps = this.getAngleSnapCandidates(point, referencePoint);
            candidates.push(...angleSnaps);
        }
        
        // Grid snap (lowest priority)
        if (this.settings.gridEnabled) {
            const gridSnap = this.getGridSnapCandidate(point);
            candidates.push(gridSnap);
        }
    }

    /**
     * Get snap candidates for a specific object
     */
    private getObjectSnapCandidates(point: Vector3, object: GeometricObject): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        
        if (object instanceof Line) {
            candidates.push(...this.getLineSnapCandidates(point, object));
        } else if (object instanceof Circle) {
            candidates.push(...this.getCircleSnapCandidates(point, object));
        } else if (object instanceof Arc) {
            candidates.push(...this.getArcSnapCandidates(point, object));
        } else if (object instanceof Polyline) {
            candidates.push(...this.getPolylineSnapCandidates(point, object));
        }
        
        return candidates;
    }

    /**
     * Get line snap candidates
     */
    private getLineSnapCandidates(point: Vector3, line: Line): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        
        // Endpoints
        if (this.settings.endpointEnabled) {
            const start = new Vector3(line.startPoint.x, line.startPoint.y, line.startPoint.z);
            const end = new Vector3(line.endPoint.x, line.endPoint.y, line.endPoint.z);
            
            candidates.push({
                point: start,
                type: SnapType.ENDPOINT,
                target: line,
                feature: 'start',
                distance: point.distanceTo(start),
                priority: 10
            });
            
            candidates.push({
                point: end,
                type: SnapType.ENDPOINT,
                target: line,
                feature: 'end',
                distance: point.distanceTo(end),
                priority: 10
            });
        }
        
        // Midpoint
        if (this.settings.midpointEnabled) {
            const mid = line.getMidPoint();
            const midVec = new Vector3(mid.x, mid.y, mid.z);
            
            candidates.push({
                point: midVec,
                type: SnapType.MIDPOINT,
                target: line,
                feature: 'midpoint',
                distance: point.distanceTo(midVec),
                priority: 8
            });
        }
        
        // Nearest point
        if (this.settings.nearestEnabled) {
            const nearest = line.getClosestPoint({
                x: point.x,
                y: point.y,
                z: point.z
            });
            const nearestVec = new Vector3(nearest.x, nearest.y, nearest.z);
            
            // Only add if not too close to endpoints or midpoint
            const minDistToOthers = 0.1;
            let tooClose = false;
            
            candidates.forEach(c => {
                if (nearestVec.distanceTo(c.point) < minDistToOthers) {
                    tooClose = true;
                }
            });
            
            if (!tooClose) {
                candidates.push({
                    point: nearestVec,
                    type: SnapType.NEAREST,
                    target: line,
                    feature: 'nearest',
                    distance: point.distanceTo(nearestVec),
                    priority: 5
                });
            }
        }
        
        // Extension (if enabled)
        if (this.settings.extensionEnabled) {
            const direction = line.getDirection();
            const start = new Vector3(line.startPoint.x, line.startPoint.y, line.startPoint.z);
            const end = new Vector3(line.endPoint.x, line.endPoint.y, line.endPoint.z);
            
            // Project point onto line extension
            const toPoint = point.clone().sub(start);
            const lineDir = new Vector3(direction.x, direction.y, direction.z);
            const t = toPoint.dot(lineDir);
            
            if (t < 0 || t > line.getLength()) {
                const extensionPoint = start.clone().add(lineDir.multiplyScalar(t));
                
                candidates.push({
                    point: extensionPoint,
                    type: SnapType.EXTENSION,
                    target: line,
                    feature: 'extension',
                    distance: point.distanceTo(extensionPoint),
                    priority: 3
                });
            }
        }
        
        return candidates;
    }

    /**
     * Get circle snap candidates
     */
    private getCircleSnapCandidates(point: Vector3, circle: Circle): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        const center = new Vector3(circle.center.x, circle.center.y, circle.center.z);
        
        // Center
        if (this.settings.centerEnabled) {
            candidates.push({
                point: center,
                type: SnapType.CENTER,
                target: circle,
                feature: 'center',
                distance: point.distanceTo(center),
                priority: 10
            });
        }
        
        // Quadrants
        if (this.settings.quadrantEnabled) {
            const quadrants = [
                { angle: 0, name: 'right' },
                { angle: Math.PI / 2, name: 'top' },
                { angle: Math.PI, name: 'left' },
                { angle: 3 * Math.PI / 2, name: 'bottom' }
            ];
            
            quadrants.forEach(q => {
                const qPoint = circle.getPointAtAngle(q.angle);
                const qVec = new Vector3(qPoint.x, qPoint.y, qPoint.z);
                
                candidates.push({
                    point: qVec,
                    type: SnapType.QUADRANT,
                    target: circle,
                    feature: q.name,
                    distance: point.distanceTo(qVec),
                    priority: 8
                });
            });
        }
        
        // Nearest point on circle
        if (this.settings.nearestEnabled) {
            const toCenter = point.clone().sub(center);
            if (toCenter.length() > 0) {
                const nearest = center.clone().add(
                    toCenter.normalize().multiplyScalar(circle.radius)
                );
                
                candidates.push({
                    point: nearest,
                    type: SnapType.NEAREST,
                    target: circle,
                    feature: 'circumference',
                    distance: point.distanceTo(nearest),
                    priority: 5
                });
            }
        }
        
        // Tangent (if drawing from external point)
        if (this.settings.tangentEnabled) {
            const distToCenter = point.distanceTo(center);
            if (distToCenter > circle.radius) {
                const tangents = this.calculateTangentPoints(point, center, circle.radius);
                
                tangents.forEach((t, index) => {
                    candidates.push({
                        point: t,
                        type: SnapType.TANGENT,
                        target: circle,
                        feature: `tangent${index + 1}`,
                        distance: point.distanceTo(t),
                        priority: 7
                    });
                });
            }
        }
        
        return candidates;
    }

    /**
     * Get arc snap candidates
     */
    private getArcSnapCandidates(point: Vector3, arc: Arc): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        const center = new Vector3(arc.center.x, arc.center.y, arc.center.z);
        
        // Center
        if (this.settings.centerEnabled) {
            candidates.push({
                point: center,
                type: SnapType.CENTER,
                target: arc,
                feature: 'center',
                distance: point.distanceTo(center),
                priority: 10
            });
        }
        
        // Endpoints
        if (this.settings.endpointEnabled) {
            const start = arc.getStartPoint();
            const end = arc.getEndPoint();
            
            candidates.push({
                point: new Vector3(start.x, start.y, start.z),
                type: SnapType.ENDPOINT,
                target: arc,
                feature: 'start',
                distance: point.distanceTo(new Vector3(start.x, start.y, start.z)),
                priority: 10
            });
            
            candidates.push({
                point: new Vector3(end.x, end.y, end.z),
                type: SnapType.ENDPOINT,
                target: arc,
                feature: 'end',
                distance: point.distanceTo(new Vector3(end.x, end.y, end.z)),
                priority: 10
            });
        }
        
        // Midpoint
        if (this.settings.midpointEnabled) {
            const mid = arc.getMidPoint();
            const midVec = new Vector3(mid.x, mid.y, mid.z);
            
            candidates.push({
                point: midVec,
                type: SnapType.MIDPOINT,
                target: arc,
                feature: 'midpoint',
                distance: point.distanceTo(midVec),
                priority: 8
            });
        }
        
        // Nearest point on arc
        if (this.settings.nearestEnabled) {
            const toCenter = point.clone().sub(center);
            const angle = Math.atan2(toCenter.y, toCenter.x);
            
            if (arc.containsAngle(angle)) {
                const nearest = center.clone().add(
                    toCenter.normalize().multiplyScalar(arc.radius)
                );
                
                candidates.push({
                    point: nearest,
                    type: SnapType.NEAREST,
                    target: arc,
                    feature: 'arc',
                    distance: point.distanceTo(nearest),
                    priority: 5
                });
            }
        }
        
        return candidates;
    }

    /**
     * Get polyline snap candidates
     */
    private getPolylineSnapCandidates(point: Vector3, polyline: Polyline): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        const vertices = polyline.vertices;
        
        // Vertices/Nodes
        if (this.settings.nodeEnabled) {
            vertices.forEach((vertex, index) => {
                const vertexVec = new Vector3(vertex.x, vertex.y, vertex.z);
                
                candidates.push({
                    point: vertexVec,
                    type: SnapType.NODE,
                    target: polyline,
                    feature: `vertex${index}`,
                    distance: point.distanceTo(vertexVec),
                    priority: 10
                });
            });
        }
        
        // Segment midpoints
        if (this.settings.midpointEnabled) {
            for (let i = 0; i < vertices.length - 1; i++) {
                const v1 = vertices[i];
                const v2 = vertices[i + 1];
                const mid = new Vector3(
                    (v1.x + v2.x) / 2,
                    (v1.y + v2.y) / 2,
                    (v1.z + v2.z) / 2
                );
                
                candidates.push({
                    point: mid,
                    type: SnapType.MIDPOINT,
                    target: polyline,
                    feature: `segment${i}`,
                    distance: point.distanceTo(mid),
                    priority: 8
                });
            }
            
            // Closing segment for closed polylines
            if (polyline.isClosed && vertices.length > 2) {
                const v1 = vertices[vertices.length - 1];
                const v2 = vertices[0];
                const mid = new Vector3(
                    (v1.x + v2.x) / 2,
                    (v1.y + v2.y) / 2,
                    (v1.z + v2.z) / 2
                );
                
                candidates.push({
                    point: mid,
                    type: SnapType.MIDPOINT,
                    target: polyline,
                    feature: 'closing',
                    distance: point.distanceTo(mid),
                    priority: 8
                });
            }
        }
        
        // Center (for closed polylines)
        if (this.settings.centerEnabled && polyline.isClosed) {
            const centroid = polyline.getCentroid();
            const centroidVec = new Vector3(centroid.x, centroid.y, centroid.z);
            
            candidates.push({
                point: centroidVec,
                type: SnapType.CENTER,
                target: polyline,
                feature: 'centroid',
                distance: point.distanceTo(centroidVec),
                priority: 7
            });
        }
        
        return candidates;
    }

    /**
     * Get angle snap candidates
     */
    private getAngleSnapCandidates(point: Vector3, referencePoint: Vector3): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];
        const vector = point.clone().sub(referencePoint);
        const distance = vector.length();
        
        if (distance < 0.001) return candidates;
        
        const currentAngle = Math.atan2(vector.y, vector.x);
        const currentAngleDeg = currentAngle * 180 / Math.PI;
        
        // Standard angles
        const snapAngles: number[] = [...Constants.SNAP.ANGLE_SNAP_DEGREES];
        const increment = this.settings.angleIncrement;
        
        // Add custom increment angles
        for (let angle = 0; angle < 360; angle += increment) {
            if (!snapAngles.includes(angle)) {
                snapAngles.push(angle);
            }
        }
        
        snapAngles.forEach(targetAngle => {
            const diff = this.normalizeAngle(currentAngleDeg - targetAngle);
            
            if (Math.abs(diff) < Constants.SNAP.ANGLE_TOLERANCE) {
                const targetAngleRad = targetAngle * Math.PI / 180;
                const snapPoint = referencePoint.clone().add(new Vector3(
                    Math.cos(targetAngleRad) * distance,
                    Math.sin(targetAngleRad) * distance,
                    point.z
                ));
                
                candidates.push({
                    point: snapPoint,
                    type: SnapType.ANGLE,
                    feature: `${targetAngle}°`,
                    distance: point.distanceTo(snapPoint),
                    priority: 6
                });
            }
        });
        
        return candidates;
    }

    /**
     * Get grid snap candidate
     */
    private getGridSnapCandidate(point: Vector3): SnapCandidate {
        const snapped = new Vector3(
            Math.round(point.x / this.settings.gridSize) * this.settings.gridSize,
            Math.round(point.y / this.settings.gridSize) * this.settings.gridSize,
            point.z
        );
        
        return {
            point: snapped,
            type: SnapType.GRID,
            feature: 'grid',
            distance: point.distanceTo(snapped),
            priority: 1
        };
    }

    /**
     * Snap to grid
     */
    private snapToGrid(point: Vector3): SnapResult {
        const candidate = this.getGridSnapCandidate(point);
        
        return {
            point: candidate.point,
            snapped: true,
            type: SnapType.GRID,
            distance: candidate.distance
        };
    }

    /**
     * Calculate tangent points from external point to circle
     */
    private calculateTangentPoints(external: Vector3, center: Vector3, radius: number): Vector3[] {
        const d = external.distanceTo(center);
        if (d <= radius) return [];
        
        const theta = Math.asin(radius / d);
        const baseAngle = Math.atan2(external.y - center.y, external.x - center.x);
        
        const angle1 = baseAngle + theta;
        const angle2 = baseAngle - theta;
        
        const tangentDist = Math.sqrt(d * d - radius * radius);
        
        return [
            new Vector3(
                center.x + radius * Math.cos(angle1 + Math.PI / 2),
                center.y + radius * Math.sin(angle1 + Math.PI / 2),
                center.z
            ),
            new Vector3(
                center.x + radius * Math.cos(angle2 - Math.PI / 2),
                center.y + radius * Math.sin(angle2 - Math.PI / 2),
                center.z
            )
        ];
    }

    /**
     * Normalize angle to [-180, 180]
     */
    private normalizeAngle(angle: number): number {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    // ==================== Public API ====================

    /**
     * Update settings
     */
    public updateSettings(settings: Partial<SnapSettings>): void {
        Object.assign(this.settings, settings);
    }

    /**
     * Get current settings
     */
    public getSettings(): SnapSettings {
        return { ...this.settings };
    }

    /**
     * Set grid size
     */
    public setGridSize(size: number): void {
        this.settings.gridSize = Math.max(
            Constants.GRID.MIN_SIZE,
            Math.min(Constants.GRID.MAX_SIZE, size)
        );
    }

    /**
     * Set grid enabled
     */
    public setGridEnabled(enabled: boolean): void {
        this.settings.gridEnabled = enabled;
    }

    /**
     * Toggle snap type
     */
    public toggleSnapType(type: SnapType, enabled?: boolean): void {
        const settingMap: Record<SnapType, keyof SnapSettings> = {
            [SnapType.GRID]: 'gridEnabled',
            [SnapType.ENDPOINT]: 'endpointEnabled',
            [SnapType.MIDPOINT]: 'midpointEnabled',
            [SnapType.CENTER]: 'centerEnabled',
            [SnapType.INTERSECTION]: 'intersectionEnabled',
            [SnapType.PERPENDICULAR]: 'perpendicularEnabled',
            [SnapType.TANGENT]: 'tangentEnabled',
            [SnapType.NEAREST]: 'nearestEnabled',
            [SnapType.QUADRANT]: 'quadrantEnabled',
            [SnapType.NODE]: 'nodeEnabled',
            [SnapType.EXTENSION]: 'extensionEnabled',
            [SnapType.ANGLE]: 'angleEnabled',
            [SnapType.PARALLEL]: 'angleEnabled'
        };
        
        const setting = settingMap[type];
        if (setting && typeof this.settings[setting] === 'boolean') {
            (this.settings as any)[setting] = enabled ?? !this.settings[setting];
        }
    }

    /**
     * Get snap info string
     */
    public getSnapInfo(snapResult: SnapResult): string {
        if (!snapResult.snapped) return '';
        
        const typeLabels: Record<SnapType, string> = {
            [SnapType.GRID]: `Grid (${this.settings.gridSize}m)`,
            [SnapType.ENDPOINT]: 'Endpoint',
            [SnapType.MIDPOINT]: 'Midpoint',
            [SnapType.CENTER]: 'Center',
            [SnapType.INTERSECTION]: 'Intersection',
            [SnapType.PERPENDICULAR]: 'Perpendicular',
            [SnapType.TANGENT]: 'Tangent',
            [SnapType.NEAREST]: 'Nearest',
            [SnapType.QUADRANT]: 'Quadrant',
            [SnapType.NODE]: 'Node',
            [SnapType.EXTENSION]: 'Extension',
            [SnapType.PARALLEL]: 'Parallel',
            [SnapType.ANGLE]: snapResult.feature || 'Angle'
        };
        
        return typeLabels[snapResult.type!] || 'Snapped';
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.snapCache.clear();
    }
}