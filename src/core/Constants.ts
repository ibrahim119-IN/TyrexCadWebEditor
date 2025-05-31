// ثوابت عامة للمشروع

export const Constants = {
    // إعدادات الشبكة
    GRID: {
        DEFAULT_SIZE: 1,        // حجم الشبكة الافتراضي بالمتر
        MIN_SIZE: 0.1,         // أصغر حجم للشبكة
        MAX_SIZE: 10,          // أكبر حجم للشبكة
        COLOR: 0x888888,       // لون الشبكة
        DIVISIONS: 100         // عدد التقسيمات
    },

    // إعدادات الجدران
    WALL: {
        DEFAULT_HEIGHT: 3,     // ارتفاع الجدار الافتراضي بالمتر
        DEFAULT_THICKNESS: 0.2, // سمك الجدار الافتراضي
        MIN_LENGTH: 0.1,       // أقل طول مسموح للجدار
        COLOR_2D: 0x808080,    // لون الجدار في العرض ثنائي الأبعاد
        COLOR_SELECTED: 0xff0000,   // لون الجدار المحدد
        COLOR_HIGHLIGHTED: 0x2196F3, // لون التمييز
        COLOR_PREVIEW: 0x2196F3     // لون المعاينة
    },

    // إعدادات الكاميرا
    CAMERA: {
        FRUSTUM_SIZE_2D: 50,   // حجم العرض للكاميرا ثنائية الأبعاد
        FOV_3D: 45,            // زاوية الرؤية للكاميرا ثلاثية الأبعاد
        NEAR: 0.1,
        FAR: 1000
    },

    // إعدادات التحكم
    CONTROLS: {
        PAN_SPEED: 2,
        ZOOM_SPEED: 1.2,
        DAMPING_FACTOR: 0.05
    },

    // إعدادات الانجذاب
    SNAP: {
        GRID_ENABLED_DEFAULT: true,
        ANGLE_SNAP_ENABLED: true,
        ANGLE_SNAP_DEGREES: [0, 45, 90, 135, 180, 225, 270, 315],
        ANGLE_TOLERANCE: 5,     // درجات التسامح للانجذاب الزاوي
        ENDPOINT_SNAP_DISTANCE: 0.5  // مسافة الانجذاب لنهايات الجدران
    },

    // إعدادات واجهة المستخدم
    UI: {
        DIMENSION_OFFSET: 20,    // المسافة بين الجدار وتسمية القياس بالبكسل
        DIMENSION_FONT_SIZE: 14, // حجم خط القياسات
        INFO_UPDATE_RATE: 100    // معدل تحديث شريط المعلومات بالميلي ثانية
    }
} as const;