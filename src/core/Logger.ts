/**
 * نظام تسجيل الأحداث المركزي
 * يوفر مستويات مختلفة من التسجيل مع إمكانية التحكم في المخرجات
 */

// مستويات التسجيل
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

// واجهة لرسالة السجل
interface LogMessage {
    level: LogLevel;
    timestamp: Date;
    message: string;
    data?: any;
    source?: string;
}

// واجهة لمعالج السجلات
interface LogHandler {
    handle(message: LogMessage): void;
}

/**
 * معالج السجلات للطرفية (Console)
 */
class ConsoleLogHandler implements LogHandler {
    handle(message: LogMessage): void {
        const timestamp = message.timestamp.toLocaleTimeString();
        const prefix = `[${timestamp}] [${LogLevel[message.level]}]`;
        const fullMessage = message.source 
            ? `${prefix} [${message.source}] ${message.message}`
            : `${prefix} ${message.message}`;

        switch (message.level) {
            case LogLevel.DEBUG:
                console.debug(fullMessage, message.data || '');
                break;
            case LogLevel.INFO:
                console.info(fullMessage, message.data || '');
                break;
            case LogLevel.WARN:
                console.warn(fullMessage, message.data || '');
                break;
            case LogLevel.ERROR:
                console.error(fullMessage, message.data || '');
                break;
        }
    }
}

/**
 * معالج السجلات للتخزين المحلي
 * يحتفظ بآخر N رسالة في الذاكرة
 */
class MemoryLogHandler implements LogHandler {
    private messages: LogMessage[] = [];
    private maxMessages: number = 1000;

    handle(message: LogMessage): void {
        this.messages.push(message);
        
        // إزالة الرسائل القديمة إذا تجاوزنا الحد الأقصى
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
    }

    getMessages(): LogMessage[] {
        return [...this.messages];
    }

    clear(): void {
        this.messages = [];
    }
}

/**
 * فئة Logger الرئيسية
 * تستخدم نمط Singleton لضمان وجود مثيل واحد فقط
 */
export class Logger {
    private static instance: Logger;
    private handlers: LogHandler[] = [];
    private currentLevel: LogLevel = LogLevel.INFO;
    private memoryHandler: MemoryLogHandler;

    private constructor() {
        // إضافة معالجات افتراضية
        this.handlers.push(new ConsoleLogHandler());
        
        this.memoryHandler = new MemoryLogHandler();
        this.handlers.push(this.memoryHandler);
    }

    /**
     * الحصول على المثيل الوحيد
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * تعيين مستوى التسجيل
     * الرسائل ذات المستوى الأقل من هذا لن يتم تسجيلها
     */
    public setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    /**
     * إضافة معالج جديد للسجلات
     */
    public addHandler(handler: LogHandler): void {
        this.handlers.push(handler);
    }

    /**
     * إزالة جميع المعالجات
     */
    public clearHandlers(): void {
        this.handlers = [];
    }

    /**
     * تسجيل رسالة
     */
    private log(level: LogLevel, message: string, data?: any, source?: string): void {
        if (level < this.currentLevel) {
            return;
        }

        const logMessage: LogMessage = {
            level,
            timestamp: new Date(),
            message,
            data,
            source
        };

        this.handlers.forEach(handler => handler.handle(logMessage));
    }

    /**
     * دوال التسجيل المختلفة
     */
    public debug(message: string, data?: any, source?: string): void {
        this.log(LogLevel.DEBUG, message, data, source);
    }

    public info(message: string, data?: any, source?: string): void {
        this.log(LogLevel.INFO, message, data, source);
    }

    public warn(message: string, data?: any, source?: string): void {
        this.log(LogLevel.WARN, message, data, source);
    }

    public error(message: string, error?: any, source?: string): void {
        // معالجة خاصة للأخطاء
        let errorData = error;
        if (error instanceof Error) {
            errorData = {
                message: error.message,
                stack: error.stack,
                name: error.name
            };
        }
        
        this.log(LogLevel.ERROR, message, errorData, source);
    }

    /**
     * قياس الأداء - بداية
     */
    public startTimer(label: string): void {
        if (this.currentLevel <= LogLevel.DEBUG) {
            console.time(label);
        }
    }

    /**
     * قياس الأداء - نهاية
     */
    public endTimer(label: string): void {
        if (this.currentLevel <= LogLevel.DEBUG) {
            console.timeEnd(label);
        }
    }

    /**
     * الحصول على السجلات المخزنة في الذاكرة
     */
    public getStoredLogs(): LogMessage[] {
        return this.memoryHandler.getMessages();
    }

    /**
     * مسح السجلات المخزنة
     */
    public clearStoredLogs(): void {
        this.memoryHandler.clear();
    }

    /**
     * تصدير السجلات كنص
     */
    public exportLogs(): string {
        const logs = this.getStoredLogs();
        return logs.map(log => {
            const timestamp = log.timestamp.toISOString();
            const level = LogLevel[log.level].padEnd(5);
            const source = log.source ? `[${log.source}] ` : '';
            const data = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : '';
            return `${timestamp} ${level} ${source}${log.message}${data}`;
        }).join('\n');
    }
}

// تصدير مثيل مباشر للاستخدام السريع
export const logger = Logger.getInstance();