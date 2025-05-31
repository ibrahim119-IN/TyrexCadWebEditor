// src/models/Solid.ts
import { GeometricObject, GeometricObjectType } from './GeometricObject';
export class Solid extends GeometricObject {
    constructor() { super(GeometricObjectType.SOLID); }
    protected createOCShape(): any { return null; }
    protected updateOCShape(): void {}
    public getBounds(): any { return null; }
    public clone(): Solid { return new Solid(); }
}