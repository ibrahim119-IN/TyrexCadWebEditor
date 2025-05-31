import { Wall } from '../models/Wall';
import { BuildingElement } from '../models/BuildingElement';
import { Vector3 } from 'three';

export interface ProjectData {
    version: string;
    name: string;
    createdAt: string;
    modifiedAt: string;
    walls: any[];
    elements: any[];
}

export class ProjectManager {
    private static readonly VERSION = '1.0.0';

    // حفظ المشروع
    static saveProject(walls: Wall[], elements: BuildingElement[], projectName: string = 'Untitled Project'): string {
        const projectData: ProjectData = {
            version: this.VERSION,
            name: projectName,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            walls: walls.map(wall => wall.toJSON()),
            elements: elements.map(element => element.toJSON())
        };

        return JSON.stringify(projectData, null, 2);
    }

    // تحميل المشروع
    static loadProject(jsonData: string): { walls: Wall[], elements: BuildingElement[] } {
        try {
            const data: ProjectData = JSON.parse(jsonData);
            
            // التحقق من الإصدار
            if (!this.isVersionCompatible(data.version)) {
                throw new Error(`Incompatible project version: ${data.version}`);
            }

            // تحميل الجدران
            const walls = data.walls.map(wallData => Wall.fromJSON(wallData));

            // تحميل العناصر (سيتم تنفيذه لاحقاً)
            const elements: BuildingElement[] = [];

            return { walls, elements };
        } catch (error) {
            throw new Error(`Failed to load project: ${error}`);
        }
    }

    // تصدير كملف
    static exportToFile(projectData: string, filename: string = 'project.json'): void {
        const blob = new Blob([projectData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    // استيراد من ملف
    static importFromFile(): Promise<string> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    resolve(content);
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            };

            input.click();
        });
    }

    // التحقق من توافق الإصدار
    private static isVersionCompatible(version: string): boolean {
        const [major] = version.split('.');
        const [currentMajor] = this.VERSION.split('.');
        return major === currentMajor;
    }
}