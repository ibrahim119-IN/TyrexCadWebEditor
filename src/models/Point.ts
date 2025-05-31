// src/models/Point.ts
import { GeometricObject, GeometricObjectType } from './GeometricObject';
export class Point extends GeometricObject {
    constructor() { super(GeometricObjectType.POINT); }
    protected createOCShape(): any { return null; }
    protected updateOCShape(): void {}
    public getBounds(): any { return null; }
    public clone(): Point { return new Point(); }
}