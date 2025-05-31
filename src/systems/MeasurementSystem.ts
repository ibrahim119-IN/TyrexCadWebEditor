import { Vector3, Camera , PerspectiveCamera } from 'three';
import { Wall } from '../models/Wall';
import { DimensionLabel } from '../ui/DimensionLabel';
import { Constants } from '../core/Constants';


// نظام إدارة القياسات والأبعاد المعروضة
export class MeasurementSystem {
    private container: HTMLElement;
    private dimensionLabels: Map<string, DimensionLabel> = new Map();
    private previewLabel: DimensionLabel | null = null;
    private camera: Camera;

    constructor(container: HTMLElement, camera: Camera) {
        this.container = container;
        this.camera = camera;
    }

    // تحديث الكاميرا (عند التبديل بين 2D و 3D)
    updateCamera(camera: Camera): void {
        this.camera = camera;
        this.updateAllDimensions();
    }

    // إضافة قياس لجدار
    addWallDimension(wall: Wall): void {
        // إزالة القياس القديم إن وجد
        this.removeWallDimension(wall.id);

        // إنشاء تسمية قياس جديدة
        const label = new DimensionLabel(this.container);
        
        // تحديث النص والموضع
        this.updateWallDimension(wall, label);
        
        // حفظ التسمية
        this.dimensionLabels.set(wall.id, label);
    }

    // إزالة قياس جدار
    removeWallDimension(wallId: string): void {
        const label = this.dimensionLabels.get(wallId);
        if (label) {
            label.remove();
            this.dimensionLabels.delete(wallId);
        }
    }

    // تحديث قياس جدار محدد
    updateWallDimension(wall: Wall, label?: DimensionLabel): void {
        const dimensionLabel = label || this.dimensionLabels.get(wall.id);
        if (!dimensionLabel) return;

        // حساب موضع التسمية
        const midPoint = wall.midPoint;
        const normal = wall.normal;
        
        // إزاحة التسمية عن الجدار
        const offset = Constants.UI.DIMENSION_OFFSET / 100; // تحويل من بكسل إلى وحدات العالم
        const labelPosition = new Vector3()
            .copy(midPoint)
            .add(normal.multiplyScalar(offset));

        // تحديث النص
        const lengthText = this.formatLength(wall.length);
        const angleText = this.formatAngle(wall.angleDegrees);
        dimensionLabel.setText(`${lengthText}`);

        // تحديث الموضع على الشاشة
        this.updateLabelScreenPosition(dimensionLabel, labelPosition);

        // تحديث التدوير ليكون موازياً للجدار
        const rotation = wall.angle * (180 / Math.PI);
        dimensionLabel.setRotation(rotation);
    }

    // عرض قياس مؤقت أثناء الرسم
    showPreviewDimension(start: Vector3, end: Vector3): void {
        // إنشاء تسمية معاينة إذا لم تكن موجودة
        if (!this.previewLabel) {
            this.previewLabel = new DimensionLabel(this.container, true);
        }

        // حساب القياسات
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const angleDegrees = (angle * 180) / Math.PI;

        // حساب موضع التسمية
        const midPoint = new Vector3()
            .addVectors(start, end)
            .multiplyScalar(0.5);
        
        const normal = new Vector3(
            -(end.y - start.y),
            end.x - start.x,
            0
        ).normalize();
        
        const offset = Constants.UI.DIMENSION_OFFSET / 100;
        const labelPosition = new Vector3()
            .copy(midPoint)
            .add(normal.multiplyScalar(offset));

        // تحديث النص
        const lengthText = this.formatLength(length);
        const angleText = this.formatAngle(angleDegrees);
        
        // عرض معلومات إضافية في المعاينة
        let text = lengthText;
        
        // إضافة معلومات الزاوية للزوايا الخاصة
        const specialAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        const normalizedAngle = this.normalizeAngle(angleDegrees);
        for (const specialAngle of specialAngles) {
            if (Math.abs(normalizedAngle - specialAngle) < 1) {
                text += ` • ${specialAngle}°`;
                break;
            }
        }
        
        this.previewLabel.setText(text);

        // تحديث الموضع والتدوير
        this.updateLabelScreenPosition(this.previewLabel, labelPosition);
        this.previewLabel.setRotation(angle * (180 / Math.PI));
    }

    // إخفاء قياس المعاينة
    hidePreviewDimension(): void {
        if (this.previewLabel) {
            this.previewLabel.remove();
            this.previewLabel = null;
        }
    }

    // تحديث جميع القياسات (عند تحريك الكاميرا)
    updateAllDimensions(): void {
        this.dimensionLabels.forEach((label, wallId) => {
            // هنا يمكنك تحديث موضع التسميات بناءً على الكاميرا الجديدة
            // سيتم تنفيذه من الـ Viewer عند الحاجة
        });
    }

    // إزالة جميع القياسات
    clearAllDimensions(): void {
        this.dimensionLabels.forEach(label => label.remove());
        this.dimensionLabels.clear();
        this.hidePreviewDimension();
    }

    // تحديث موضع التسمية على الشاشة
    private updateLabelScreenPosition(label: DimensionLabel, worldPosition: Vector3): void {
    const screenPosition = worldPosition.clone().project(this.camera);
    
    // للعرض 3D، نحتاج رفع الموضع قليلاً
    if (this.camera instanceof PerspectiveCamera) {
        screenPosition.y -= 0.1;
    }
    
    const x = (screenPosition.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-screenPosition.y * 0.5 + 0.5) * this.container.clientHeight;
    
    label.setPosition(x, y);
}

    // تنسيق الطول للعرض
    private formatLength(length: number): string {
        if (length < 0.01) return '0.00m';
        
        // عرض بدقة مناسبة حسب الطول
        if (length < 1) {
            return `${(length * 100).toFixed(0)}cm`;
        } else if (length < 10) {
            return `${length.toFixed(2)}m`;
        } else {
            return `${length.toFixed(1)}m`;
        }
    }

    // تنسيق الزاوية للعرض
    private formatAngle(degrees: number): string {
        const normalized = this.normalizeAngle(degrees);
        return `${normalized.toFixed(1)}°`;
    }

    // تطبيع الزاوية لتكون بين 0 و 360
    private normalizeAngle(degrees: number): number {
        let angle = degrees % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    // الحصول على معلومات القياس كنص
    getMeasurementInfo(start: Vector3, end: Vector3): string {
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const angleDegrees = (angle * 180) / Math.PI;
        
        return `Length: ${this.formatLength(length)}, Angle: ${this.formatAngle(angleDegrees)}`;
    }
}