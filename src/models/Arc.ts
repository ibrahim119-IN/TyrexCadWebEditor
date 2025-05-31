// src/models/Arc.ts
import { GeometricObject, GeometricObjectType } from './GeometricObject';
export class Arc extends GeometricObject {
    constructor() { super(GeometricObjectType.ARC); }
    protected createOCShape(): any { return null; }
    protected updateOCShape(): void {}
    public getBounds(): any { return null; }
    public clone(): Arc { return new Arc(); }
}