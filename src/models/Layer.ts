/**
 * Layer - Layer management for organizing geometric objects
 */

import { Color } from 'three';

export interface LayerProperties {
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
}

/**
 * Layer class - represents a drawing layer
 */
export class Layer {
    // Unique identifier
    public id: string;
    
    // Layer name
    public name: string;
    
    // Visibility state
    public visible: boolean = true;
    
    // Lock state
    public locked: boolean = false;
    
    // Layer order (z-index)
    public order: number = 0;
    
    // Visual properties
    public properties: LayerProperties;
    
    // Parent layer (for nested layers)
    public parentId?: string;
    
    // Child layers
    public childIds: string[] = [];
    
    // Metadata
    public metadata: {
        createdAt: Date;
        modifiedAt: Date;
        description?: string;
        [key: string]: any;
    };

    constructor(name?: string) {
        this.id = this.generateId();
        this.name = name || `Layer ${this.id}`;
        
        this.properties = {
            color: '#000000',
            lineWidth: 1,
            lineStyle: 'solid',
            opacity: 1
        };
        
        this.metadata = {
            createdAt: new Date(),
            modifiedAt: new Date()
        };
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update layer properties
     */
    public updateProperties(properties: Partial<LayerProperties>): void {
        Object.assign(this.properties, properties);
        this.metadata.modifiedAt = new Date();
    }

    /**
     * Add child layer
     */
    public addChild(childId: string): void {
        if (!this.childIds.includes(childId)) {
            this.childIds.push(childId);
            this.metadata.modifiedAt = new Date();
        }
    }

    /**
     * Remove child layer
     */
    public removeChild(childId: string): void {
        const index = this.childIds.indexOf(childId);
        if (index !== -1) {
            this.childIds.splice(index, 1);
            this.metadata.modifiedAt = new Date();
        }
    }

    /**
     * Clone layer
     */
    public clone(): Layer {
        const cloned = new Layer(this.name + ' (Copy)');
        cloned.visible = this.visible;
        cloned.locked = this.locked;
        cloned.order = this.order;
        cloned.properties = { ...this.properties };
        cloned.parentId = this.parentId;
        cloned.childIds = [...this.childIds];
        cloned.metadata = {
            ...this.metadata,
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        return cloned;
    }

    /**
     * Convert to JSON
     */
    public toJSON(): object {
        return {
            id: this.id,
            name: this.name,
            visible: this.visible,
            locked: this.locked,
            order: this.order,
            properties: { ...this.properties },
            parentId: this.parentId,
            childIds: [...this.childIds],
            metadata: {
                ...this.metadata,
                createdAt: this.metadata.createdAt.toISOString(),
                modifiedAt: this.metadata.modifiedAt.toISOString()
            }
        };
    }

    /**
     * Create from JSON
     */
    public static fromJSON(data: any): Layer {
        const layer = new Layer(data.name);
        layer.id = data.id;
        layer.visible = data.visible ?? true;
        layer.locked = data.locked ?? false;
        layer.order = data.order ?? 0;
        
        if (data.properties) {
            layer.properties = { ...data.properties };
        }
        
        layer.parentId = data.parentId;
        layer.childIds = data.childIds || [];
        
        if (data.metadata) {
            layer.metadata = {
                ...data.metadata,
                createdAt: new Date(data.metadata.createdAt),
                modifiedAt: new Date(data.metadata.modifiedAt)
            };
        }
        
        return layer;
    }
}

/**
 * Layer Manager - manages all layers in the project
 */
export class LayerManager {
    private layers: Map<string, Layer> = new Map();
    private activeLayerId: string = 'default';

    constructor() {
        // Create default layer
        const defaultLayer = new Layer('Default');
        defaultLayer.id = 'default';
        this.layers.set('default', defaultLayer);
    }

    /**
     * Add layer
     */
    public addLayer(layer: Layer): void {
        this.layers.set(layer.id, layer);
        
        // Update parent's children
        if (layer.parentId) {
            const parent = this.layers.get(layer.parentId);
            if (parent) {
                parent.addChild(layer.id);
            }
        }
    }

    /**
     * Remove layer
     */
    public removeLayer(layerId: string): boolean {
        if (layerId === 'default') {
            return false; // Cannot remove default layer
        }
        
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        // Remove from parent's children
        if (layer.parentId) {
            const parent = this.layers.get(layer.parentId);
            if (parent) {
                parent.removeChild(layerId);
            }
        }
        
        // Move children to parent or default
        layer.childIds.forEach(childId => {
            const child = this.layers.get(childId);
            if (child) {
                child.parentId = layer.parentId || 'default';
            }
        });
        
        this.layers.delete(layerId);
        
        // If active layer was removed, switch to default
        if (this.activeLayerId === layerId) {
            this.activeLayerId = 'default';
        }
        
        return true;
    }

    /**
     * Get layer
     */
    public getLayer(layerId: string): Layer | undefined {
        return this.layers.get(layerId);
    }

    /**
     * Get all layers
     */
    public getAllLayers(): Layer[] {
        return Array.from(this.layers.values());
    }

    /**
     * Get visible layers
     */
    public getVisibleLayers(): Layer[] {
        return this.getAllLayers().filter(layer => layer.visible);
    }

    /**
     * Set active layer
     */
    public setActiveLayer(layerId: string): boolean {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            return true;
        }
        return false;
    }

    /**
     * Get active layer
     */
    public getActiveLayer(): Layer | undefined {
        return this.layers.get(this.activeLayerId);
    }

    /**
     * Move layer order
     */
    public moveLayer(layerId: string, newOrder: number): void {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.order = newOrder;
            // Re-sort other layers if needed
            this.normalizeLayerOrder();
        }
    }

    /**
     * Normalize layer order
     */
    private normalizeLayerOrder(): void {
        const sortedLayers = this.getAllLayers().sort((a, b) => a.order - b.order);
        sortedLayers.forEach((layer, index) => {
            layer.order = index;
        });
    }

    /**
     * Get layers in order
     */
    public getLayersInOrder(): Layer[] {
        return this.getAllLayers().sort((a, b) => a.order - b.order);
    }

    /**
     * Convert to JSON
     */
    public toJSON(): object {
        return {
            layers: this.getAllLayers().map(layer => layer.toJSON()),
            activeLayerId: this.activeLayerId
        };
    }

    /**
     * Load from JSON
     */
    public fromJSON(data: any): void {
        this.layers.clear();
        
        if (data.layers && Array.isArray(data.layers)) {
            data.layers.forEach((layerData: any) => {
                const layer = Layer.fromJSON(layerData);
                this.layers.set(layer.id, layer);
            });
        }
        
        // Ensure default layer exists
        if (!this.layers.has('default')) {
            const defaultLayer = new Layer('Default');
            defaultLayer.id = 'default';
            this.layers.set('default', defaultLayer);
        }
        
        this.activeLayerId = data.activeLayerId || 'default';
        
        // Validate active layer
        if (!this.layers.has(this.activeLayerId)) {
            this.activeLayerId = 'default';
        }
    }
}