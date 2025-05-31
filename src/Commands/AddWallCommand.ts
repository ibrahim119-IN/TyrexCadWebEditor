import { Vector3 } from 'three';
import { Wall } from '../models/Wall';
import { Command } from '../core/CommandManager';


export class AddWallCommand implements Command {
    private wall: Wall;
    private viewer: any; // سيتم استبداله بنوع Viewer

    constructor(start: Vector3, end: Vector3, viewer: any) {
        this.wall = new Wall(start, end);
        this.viewer = viewer;
    }

    execute(): void {
        this.viewer.addWallDirect(this.wall);
    }

    undo(): void {
        this.viewer.removeWallDirect(this.wall.id);
    }
}