import { Vector3 } from 'three';
import { GeometricObject } from '../models/GeometricObject';
import { Logger } from '../core/Logger';
import { CommandManager } from '../core/CommandManager';

export class MoveTool {
    private logger: Logger;
    private commandManager: CommandManager;
    private selectedObjects: GeometricObject[] = [];
    private isMoving: boolean = false;
    private startPoint: Vector3 | null = null;

    constructor(commandManager: CommandManager) {
        this.logger = Logger.getInstance();
        this.commandManager = commandManager;
    }

    public selectObjects(objects: GeometricObject[]): void {
        this.selectedObjects = objects;
        this.logger.info(`تم تحديد ${objects.length} كائن للتحريك`);
    }

    public startMove(point: Vector3): void {
        if (this.selectedObjects.length === 0) {
            this.logger.warn('لم يتم تحديد كائنات للتحريك');
            return;
        }

        this.isMoving = true;
        this.startPoint = point.clone();
        this.logger.debug('بدء عملية التحريك');
    }

    public updateMove(currentPoint: Vector3): void {
        if (!this.isMoving || !this.startPoint) return;

        const delta = new Vector3().subVectors(currentPoint, this.startPoint);
        
        // تحديث معاينة الحركة
        this.selectedObjects.forEach(obj => {
            const currentTransform = obj.transform;
            obj.applyTransform({
                translation: {
                    x: delta.x,
                    y: delta.y,
                    z: delta.z
                }
            });
        });
    }

    public completeMove(endPoint: Vector3): void {
        if (!this.isMoving || !this.startPoint) return;

        const delta = new Vector3().subVectors(endPoint, this.startPoint);
        
        // إنشاء أمر التحريك
        // const moveCommand = new MoveObjectsCommand(this.selectedObjects, delta);
        // this.commandManager.execute(moveCommand);

        this.isMoving = false;
        this.startPoint = null;
        this.logger.info('تم إكمال عملية التحريك');
    }

    public cancelMove(): void {
        if (this.isMoving) {
            // إلغاء التغييرات المؤقتة
            this.isMoving = false;
            this.startPoint = null;
            this.logger.info('تم إلغاء عملية التحريك');
        }
    }
}