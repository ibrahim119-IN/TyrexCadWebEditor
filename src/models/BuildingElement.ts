import { Vector3, Mesh, BoxGeometry, MeshStandardMaterial, Scene } from 'three';

export enum ElementType {
    DOOR = 'door',
    WINDOW = 'window'
}

export abstract class BuildingElement {
    protected _id: string;
    protected _position: Vector3;
    protected _width: number;
    protected _height: number;
    protected _rotation: number;
    protected _wallId: string;
    protected _type: ElementType;

    constructor(position: Vector3, width: number, height: number, wallId: string, type: ElementType) {
        this._id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this._position = position.clone();
        this._width = width;
        this._height = height;
        this._rotation = 0;
        this._wallId = wallId;
        this._type = type;
    }

    get id(): string { return this._id; }
    get position(): Vector3 { return this._position.clone(); }
    get width(): number { return this._width; }
    get height(): number { return this._height; }
    get wallId(): string { return this._wallId; }
    get type(): ElementType { return this._type; }

    abstract create2DMesh(): Mesh;
    abstract create3DMesh(): Mesh;

    toJSON(): object {
        return {
            id: this._id,
            type: this._type,
            position: { x: this._position.x, y: this._position.y, z: this._position.z },
            width: this._width,
            height: this._height,
            rotation: this._rotation,
            wallId: this._wallId
        };
    }
}

export class Door extends BuildingElement {
    constructor(position: Vector3, wallId: string, width: number = 1, height: number = 2.1) {
        super(position, width, height, wallId, ElementType.DOOR);
    }

    create2DMesh(): Mesh {
        const geometry = new BoxGeometry(this._width, 0.1, 0.02);
        const material = new MeshStandardMaterial({ 
            color: 0x8B4513,
            transparent: true,
            opacity: 0.8
        });
        const mesh = new Mesh(geometry, material);
        mesh.position.copy(this._position);
        mesh.position.z = 0.02;
        return mesh;
    }

    create3DMesh(): Mesh {
    const geometry = new BoxGeometry(this._width, this._height, 0.1);
    const material = new MeshStandardMaterial({ 
        color: 0x4B2F20, // بني داكن
        metalness: 0.2,
        roughness: 0.8
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = this._height / 2;
    return mesh;
}
}

export class Window extends BuildingElement {
    constructor(position: Vector3, wallId: string, width: number = 1.2, height: number = 1.2) {
        super(position, width, height, wallId, ElementType.WINDOW);
    }

    create2DMesh(): Mesh {
        const geometry = new BoxGeometry(this._width, 0.1, 0.02);
        const material = new MeshStandardMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.6
        });
        const mesh = new Mesh(geometry, material);
        mesh.position.copy(this._position);
        mesh.position.z = 0.02;
        return mesh;
    }

    create3DMesh(): Mesh {
    const geometry = new BoxGeometry(this._width, this._height, 0.1);
    const material = new MeshStandardMaterial({ 
        color: 0x4A90E2, // أزرق فاتح
        transparent: true,
        opacity: 0.8,
        metalness: 0.6,
        roughness: 0.2
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = this._height / 2 + 1;
    return mesh;
}
}