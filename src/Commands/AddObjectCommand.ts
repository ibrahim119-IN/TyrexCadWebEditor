import { GeometricObject } from '../models/GeometricObject';
import { Command } from '../core/CommandManager';

export class AddObjectCommand implements Command {
    private object: GeometricObject;
    private viewer: any; // سيتم تحديد النوع لاحقاً

    constructor(object: GeometricObject, viewer: any) {
        this.object = object;
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer.addGeometricObject(this.object);
    }

    undo(): void {
        this.viewer.removeGeometricObject(this.object.id);
    }

    getDescription(): string {
        return `إضافة ${this.object.type}: ${this.object.id}`;
    }
}