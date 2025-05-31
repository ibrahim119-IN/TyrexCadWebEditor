// src/models/Polyline.ts
import { GeometricObject, GeometricObjectType } from './GeometricObject';
export class Polyline extends GeometricObject {
    constructor() { super(GeometricObjectType.POLYLINE); }
    protected createOCShape(): any { return null; }
    protected updateOCShape(): void {}
    public getBounds(): any { return null; }
    public clone(): Polyline { return new Polyline(); }
}