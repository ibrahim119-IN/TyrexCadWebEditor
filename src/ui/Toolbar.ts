/**
 * Toolbar - Advanced UI Toolbar System
 * Manages drawing tools and UI controls
 */

import { DrawLineTool, LineDrawMode } from '../drawing_tools/DrawLineTool';
import { DrawCircleTool, CircleDrawMode } from '../drawing_tools/DrawCircleTool';
import { DrawArcTool, ArcDrawMode } from '../drawing_tools/DrawArcTool';
import { DrawPolylineTool, PolylineDrawMode } from '../drawing_tools/DrawPolylineTool';
import { AbstractDrawTool } from '../drawing_tools/AbstractDrawTool';
import { Logger } from '../core/Logger';

// Tool definition interface
export interface ToolDefinition {
    id: string;
    name: string;
    icon: string;
    category: 'draw' | 'edit' | 'measure' | 'view';
    shortcut?: string;
    description: string;
    subTools?: ToolDefinition[];
}

// Toolbar button interface
export interface ToolbarButton {
    element: HTMLElement;
    tool: ToolDefinition;
    isActive: boolean;
}

// Event listener type
type ToolbarEventListener = (event: ToolbarEvent) => void;

// Toolbar event
export interface ToolbarEvent {
    type: string;
    toolId: string;
    previousToolId?: string;
    data?: any;
}

/**
 * Toolbar class - manages UI toolbar and tool selection
 */
export class Toolbar {
    private container: HTMLElement;
    private logger: Logger;
    
    // Tool definitions
    private tools: Map<string, ToolDefinition> = new Map();
    private toolButtons: Map<string, ToolbarButton> = new Map();
    
    // Current state
    private activeToolId: string = 'select';
    private previousToolId: string = 'select';
    
    // Event management
    private eventListeners: Map<string, ToolbarEventListener[]> = new Map();
    
    // Tool groups
    private toolGroups: Map<string, HTMLElement> = new Map();

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Toolbar container not found: ${containerId}`);
        }
        
        this.container = container;
        this.logger = Logger.getInstance();
        
        this.initializeTools();
        this.createToolbarUI();
        this.setupEventHandlers();
    }

    /**
     * Initialize tool definitions
     */
    private initializeTools(): void {
        // Drawing tools
        const drawingTools: ToolDefinition[] = [
            {
                id: 'select',
                name: 'Select',
                icon: 'cursor',
                category: 'edit',
                shortcut: 'S',
                description: 'Select and manipulate objects'
            },
            {
                id: 'line',
                name: 'Line',
                icon: 'line',
                category: 'draw',
                shortcut: 'L',
                description: 'Draw straight lines',
                subTools: [
                    {
                        id: 'line-single',
                        name: 'Single Line',
                        icon: 'line',
                        category: 'draw',
                        description: 'Draw a single line'
                    },
                    {
                        id: 'line-continuous',
                        name: 'Continuous Lines',
                        icon: 'polyline',
                        category: 'draw',
                        description: 'Draw continuous lines'
                    },
                    {
                        id: 'line-construction',
                        name: 'Construction Line',
                        icon: 'construction',
                        category: 'draw',
                        description: 'Draw construction lines'
                    }
                ]
            },
            {
                id: 'circle',
                name: 'Circle',
                icon: 'circle',
                category: 'draw',
                shortcut: 'C',
                description: 'Draw circles',
                subTools: [
                    {
                        id: 'circle-center-radius',
                        name: 'Center, Radius',
                        icon: 'circle-center',
                        category: 'draw',
                        description: 'Draw circle from center and radius'
                    },
                    {
                        id: 'circle-two-points',
                        name: 'Two Points',
                        icon: 'circle-diameter',
                        category: 'draw',
                        description: 'Draw circle from two points on diameter'
                    },
                    {
                        id: 'circle-three-points',
                        name: 'Three Points',
                        icon: 'circle-3p',
                        category: 'draw',
                        description: 'Draw circle through three points'
                    }
                ]
            },
            {
                id: 'arc',
                name: 'Arc',
                icon: 'arc',
                category: 'draw',
                shortcut: 'A',
                description: 'Draw arcs',
                subTools: [
                    {
                        id: 'arc-three-points',
                        name: 'Three Points',
                        icon: 'arc-3p',
                        category: 'draw',
                        description: 'Draw arc through three points'
                    },
                    {
                        id: 'arc-center-start-end',
                        name: 'Center, Start, End',
                        icon: 'arc-center',
                        category: 'draw',
                        description: 'Draw arc from center, start and end'
                    }
                ]
            },
            {
                id: 'polyline',
                name: 'Polyline',
                icon: 'polyline',
                category: 'draw',
                shortcut: 'P',
                description: 'Draw polylines',
                subTools: [
                    {
                        id: 'polyline-open',
                        name: 'Open Polyline',
                        icon: 'polyline-open',
                        category: 'draw',
                        description: 'Draw open polyline'
                    },
                    {
                        id: 'polyline-closed',
                        name: 'Closed Polyline',
                        icon: 'polygon',
                        category: 'draw',
                        description: 'Draw closed polyline (polygon)'
                    },
                    {
                        id: 'polyline-rectangle',
                        name: 'Rectangle',
                        icon: 'rectangle',
                        category: 'draw',
                        shortcut: 'R',
                        description: 'Draw rectangle'
                    },
                    {
                        id: 'polyline-polygon',
                        name: 'Regular Polygon',
                        icon: 'hexagon',
                        category: 'draw',
                        description: 'Draw regular polygon'
                    }
                ]
            }
        ];

        // Register all tools
        drawingTools.forEach(tool => {
            this.registerTool(tool);
            if (tool.subTools) {
                tool.subTools.forEach(subTool => {
                    this.registerTool(subTool);
                });
            }
        });
    }

    /**
     * Register a tool
     */
    private registerTool(tool: ToolDefinition): void {
        this.tools.set(tool.id, tool);
    }

    /**
     * Create toolbar UI
     */
    private createToolbarUI(): void {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create tool groups
        const categories = ['draw', 'edit', 'measure', 'view'];
        
        categories.forEach(category => {
            const group = this.createToolGroup(category);
            this.toolGroups.set(category, group);
            this.container.appendChild(group);
        });
        
        // Add tools to groups
        this.tools.forEach(tool => {
            if (!tool.id.includes('-')) { // Main tools only
                const button = this.createToolButton(tool);
                const group = this.toolGroups.get(tool.category);
                if (group) {
                    group.appendChild(button);
                }
            }
        });
        
        // Add separators and special controls
        this.addSpecialControls();
    }

    /**
     * Create tool group
     */
    private createToolGroup(category: string): HTMLElement {
        const group = document.createElement('div');
        group.className = 'toolbar-group';
        group.dataset.category = category;
        
        // Add group label
        const label = document.createElement('div');
        label.className = 'toolbar-group-label';
        label.textContent = this.getCategoryLabel(category);
        group.appendChild(label);
        
        return group;
    }

    /**
     * Create tool button
     */
    private createToolButton(tool: ToolDefinition): HTMLElement {
        const button = document.createElement('button');
        button.className = 'toolbar-btn';
        button.id = `tool-${tool.id}`;
        button.title = `${tool.description}${tool.shortcut ? ` (${tool.shortcut})` : ''}`;
        
        // Add icon
        const icon = this.createToolIcon(tool.icon);
        button.appendChild(icon);
        
        // Add label
        const label = document.createElement('span');
        label.className = 'toolbar-btn-label';
        label.textContent = tool.name;
        button.appendChild(label);
        
        // Add dropdown arrow if has sub-tools
        if (tool.subTools && tool.subTools.length > 0) {
            const arrow = document.createElement('span');
            arrow.className = 'toolbar-btn-arrow';
            arrow.innerHTML = '▼';
            button.appendChild(arrow);
            
            // Create dropdown menu
            const dropdown = this.createDropdownMenu(tool.subTools);
            button.appendChild(dropdown);
        }
        
        // Store button reference
        this.toolButtons.set(tool.id, {
            element: button,
            tool: tool,
            isActive: false
        });
        
        // Add click handler
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleToolClick(tool.id);
        });
        
        // Add right-click handler for sub-tools
        if (tool.subTools) {
            button.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showDropdownMenu(button);
            });
        }
        
        return button;
    }

    /**
     * Create tool icon
     */
    private createToolIcon(iconName: string): HTMLElement {
        const icon = document.createElement('i');
        icon.className = `toolbar-icon icon-${iconName}`;
        
        // Use SVG icons based on name
        switch (iconName) {
            case 'cursor':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4l7 7-7 7z"/></svg>';
                break;
            case 'line':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="19" x2="19" y2="5"/></svg>';
                break;
            case 'circle':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
                break;
            case 'arc':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2 A 10 10 0 0 0 2 12"/></svg>';
                break;
            case 'polyline':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 14 15 20 9"/></svg>';
                break;
            case 'rectangle':
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18"/></svg>';
                break;
            default:
                icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/></svg>';
        }
        
        return icon;
    }

    /**
     * Create dropdown menu for sub-tools
     */
    private createDropdownMenu(subTools: ToolDefinition[]): HTMLElement {
        const dropdown = document.createElement('div');
        dropdown.className = 'toolbar-dropdown';
        
        subTools.forEach(subTool => {
            const item = document.createElement('div');
            item.className = 'toolbar-dropdown-item';
            item.dataset.toolId = subTool.id;
            
            const icon = this.createToolIcon(subTool.icon);
            item.appendChild(icon);
            
            const label = document.createElement('span');
            label.textContent = subTool.name;
            item.appendChild(label);
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleToolClick(subTool.id);
                this.hideAllDropdowns();
            });
            
            dropdown.appendChild(item);
        });
        
        return dropdown;
    }

    /**
     * Add special controls (separators, etc.)
     */
    private addSpecialControls(): void {
        // Add separators between groups
        const groups = Array.from(this.toolGroups.values());
        for (let i = 1; i < groups.length; i++) {
            const separator = document.createElement('div');
            separator.className = 'toolbar-separator';
            this.container.insertBefore(separator, groups[i]);
        }
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            // Check for tool shortcuts
            this.tools.forEach(tool => {
                if (tool.shortcut && e.key.toUpperCase() === tool.shortcut) {
                    e.preventDefault();
                    this.setActiveTool(tool.id);
                }
            });
        });
        
        // Click outside to close dropdowns
        document.addEventListener('click', () => {
            this.hideAllDropdowns();
        });
    }

    /**
     * Handle tool button click
     */
    private handleToolClick(toolId: string): void {
        const button = this.toolButtons.get(toolId);
        if (!button) return;
        
        // If has sub-tools, show dropdown
        if (button.tool.subTools && button.tool.subTools.length > 0) {
            this.toggleDropdown(button.element);
        } else {
            this.setActiveTool(toolId);
        }
    }

    /**
     * Show dropdown menu
     */
    private showDropdownMenu(button: HTMLElement): void {
        this.hideAllDropdowns();
        button.classList.add('show-dropdown');
    }

    /**
     * Toggle dropdown menu
     */
    private toggleDropdown(button: HTMLElement): void {
        if (button.classList.contains('show-dropdown')) {
            button.classList.remove('show-dropdown');
        } else {
            this.hideAllDropdowns();
            button.classList.add('show-dropdown');
        }
    }

    /**
     * Hide all dropdown menus
     */
    private hideAllDropdowns(): void {
        this.toolButtons.forEach(button => {
            button.element.classList.remove('show-dropdown');
        });
    }

    /**
     * Set active tool
     */
    public setActiveTool(toolId: string): void {
        if (toolId === this.activeToolId) return;
        
        const tool = this.tools.get(toolId);
        if (!tool) {
            this.logger.warn(`Tool not found: ${toolId}`);
            return;
        }
        
        // Store previous tool
        this.previousToolId = this.activeToolId;
        
        // Update UI
        this.updateToolButtons(toolId);
        
        // Update active tool
        this.activeToolId = toolId;
        
        // Emit event
        this.emit({
            type: 'toolChanged',
            toolId: toolId,
            previousToolId: this.previousToolId,
            data: { tool }
        });
        
        this.logger.info(`Active tool changed to: ${tool.name}`);
    }

    /**
     * Update tool button states
     */
    private updateToolButtons(activeToolId: string): void {
        this.toolButtons.forEach((button, toolId) => {
            const isActive = toolId === activeToolId || 
                           (button.tool.subTools?.some(st => st.id === activeToolId) ?? false);
            
            button.element.classList.toggle('active', isActive);
            button.isActive = isActive;
        });
    }

    /**
     * Get category label
     */
    private getCategoryLabel(category: string): string {
        const labels: Record<string, string> = {
            'draw': 'Drawing',
            'edit': 'Editing',
            'measure': 'Measure',
            'view': 'View'
        };
        
        return labels[category] || category;
    }

    // ==================== Public API ====================

    /**
     * Get active tool ID
     */
    public getActiveTool(): string {
        return this.activeToolId;
    }

    /**
     * Get tool definition
     */
    public getTool(toolId: string): ToolDefinition | undefined {
        return this.tools.get(toolId);
    }

    /**
     * Enable/disable tool
     */
    public setToolEnabled(toolId: string, enabled: boolean): void {
        const button = this.toolButtons.get(toolId);
        if (button) {
            (button.element as HTMLButtonElement).disabled = !enabled;
            button.element.classList.toggle('disabled', !enabled);
        }
    }

    /**
     * Add custom tool
     */
    public addTool(tool: ToolDefinition, groupId?: string): void {
        this.registerTool(tool);
        
        const button = this.createToolButton(tool);
        const group = groupId ? this.toolGroups.get(groupId) : this.toolGroups.get(tool.category);
        
        if (group) {
            group.appendChild(button);
        }
    }

    /**
     * Remove tool
     */
    public removeTool(toolId: string): void {
        const button = this.toolButtons.get(toolId);
        if (button) {
            button.element.remove();
            this.toolButtons.delete(toolId);
            this.tools.delete(toolId);
        }
    }

    // ==================== Event System ====================

    /**
     * Add event listener
     */
    public on(event: string, listener: ToolbarEventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    /**
     * Remove event listener
     */
    public off(event: string, listener: ToolbarEventListener): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     */
    private emit(event: ToolbarEvent): void {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    this.logger.error(`Error in toolbar event listener:`, error);
                }
            });
        }
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.eventListeners.clear();
        this.toolButtons.clear();
        this.tools.clear();
        this.toolGroups.clear();
        this.container.innerHTML = '';
    }
}