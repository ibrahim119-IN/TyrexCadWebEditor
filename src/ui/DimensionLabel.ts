// مكون واجهة المستخدم لعرض قياسات الجدران
export class DimensionLabel {
    private element: HTMLDivElement;
    private container: HTMLElement;
    private isPreview: boolean;

    constructor(container: HTMLElement, isPreview: boolean = false) {
        this.container = container;
        this.isPreview = isPreview;
        
        // إنشاء عنصر HTML للتسمية
        this.element = document.createElement('div');
        this.element.className = isPreview ? 'dimension-label preview' : 'dimension-label';
        
        // إضافة العنصر للحاوي
        this.container.appendChild(this.element);
    }

    // تحديث نص التسمية
    setText(text: string): void {
        this.element.textContent = text;
    }

    // تحديث موضع التسمية
    setPosition(x: number, y: number): void {
        // التأكد من بقاء التسمية داخل حدود الشاشة
        const rect = this.element.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        // حساب الموضع مع الأخذ في الاعتبار حدود الشاشة
        let finalX = x;
        let finalY = y;
        
        // منع الخروج من الجانب الأيمن
        if (x + rect.width > containerRect.width) {
            finalX = containerRect.width - rect.width - 10;
        }
        
        // منع الخروج من الجانب الأيسر
        if (x < 10) {
            finalX = 10;
        }
        
        // منع الخروج من الأسفل
        if (y + rect.height > containerRect.height) {
            finalY = containerRect.height - rect.height - 10;
        }
        
        // منع الخروج من الأعلى
        if (y < 10) {
            finalY = 10;
        }
        
        // تطبيق الموضع
        this.element.style.left = `${finalX}px`;
        this.element.style.top = `${finalY}px`;
    }

    // تحديث زاوية التسمية
    setRotation(degrees: number): void {
        // تطبيع الزاوية لتكون أكثر قابلية للقراءة
        let rotation = degrees;
        
        // إذا كانت الزاوية تجعل النص مقلوباً، اقلبها 180 درجة
        if (degrees > 90 || degrees < -90) {
            rotation = degrees + 180;
        }
        
        // للحفاظ على قابلية القراءة، حدد الدوران بين -45 و 45 درجة
        if (rotation > 45) {
            rotation = 45;
        } else if (rotation < -45) {
            rotation = -45;
        }
        
        this.element.style.transform = `rotate(${rotation}deg)`;
    }

    // إظهار التسمية
    show(): void {
        this.element.style.display = 'block';
    }

    // إخفاء التسمية
    hide(): void {
        this.element.style.display = 'none';
    }

    // تحديث نمط التسمية
    setStyle(style: 'normal' | 'highlighted' | 'selected'): void {
        // إزالة جميع الأنماط السابقة
        this.element.classList.remove('highlighted', 'selected');
        
        // إضافة النمط الجديد
        if (style !== 'normal') {
            this.element.classList.add(style);
        }
    }

    // تحديث الشفافية
    setOpacity(opacity: number): void {
        this.element.style.opacity = opacity.toString();
    }

    // الحصول على حدود العنصر
    getBounds(): DOMRect {
        return this.element.getBoundingClientRect();
    }

    // إزالة التسمية من DOM
    remove(): void {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    // تحديث z-index للتحكم في ترتيب العرض
    setZIndex(zIndex: number): void {
        this.element.style.zIndex = zIndex.toString();
    }

    // إضافة أو إزالة تأثير الظل
    setShadow(enabled: boolean): void {
        if (enabled) {
            this.element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        } else {
            this.element.style.boxShadow = 'none';
        }
    }

    // تحديث لون الخلفية
    setBackgroundColor(color: string): void {
        this.element.style.backgroundColor = color;
    }

    // تحديث لون النص
    setTextColor(color: string): void {
        this.element.style.color = color;
    }

    // إضافة رسالة تلميح (tooltip)
    setTooltip(text: string): void {
        this.element.title = text;
    }

    // تحريك التسمية بسلاسة
    animateToPosition(x: number, y: number, duration: number = 300): void {
        this.element.style.transition = `all ${duration}ms ease-out`;
        this.setPosition(x, y);
        
        // إزالة التأثير الانتقالي بعد انتهاء الحركة
        setTimeout(() => {
            this.element.style.transition = '';
        }, duration);
    }
}