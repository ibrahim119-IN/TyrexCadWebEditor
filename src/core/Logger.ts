/**
 * Logger - Advanced logging system for debugging and monitoring
 */

// Log levels
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}

// Log entry interface
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    category?: string;
    data?: any;
    stack?: string;
}

// Logger configuration
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableStorage: boolean;
    maxStoredLogs: number;
    enableTimestamp: boolean;
    enableColors: boolean;
    categories?: string[];
}

/**
 * Logger class - Singleton pattern
 */
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private logs: LogEntry[] = [];
    private listeners: ((entry: LogEntry) => void)[] = [];

    // Console colors
    private colors = {
        [LogLevel.DEBUG]: 'color: #888',
        [LogLevel.INFO]: 'color: #2196F3',
        [LogLevel.WARN]: 'color: #FF9800',
        [LogLevel.ERROR]: 'color: #F44336',
        [LogLevel.FATAL]: 'color: #B71C1C; font-weight: bold'
    };

    // Level names
    private levelNames = {
        [LogLevel.DEBUG]: 'DEBUG',
        [LogLevel.INFO]: 'INFO',
        [LogLevel.WARN]: 'WARN',
        [LogLevel.ERROR]: 'ERROR',
        [LogLevel.FATAL]: 'FATAL'
    };

    private constructor() {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableStorage: true,
            maxStoredLogs: 1000,
            enableTimestamp: true,
            enableColors: true,
            categories: []
        };
    }

    /**
     * Get logger instance
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Configure logger
     */
    public configure(config: Partial<LoggerConfig>): void {
        Object.assign(this.config, config);
        
        // Trim logs if needed
        if (this.logs.length > this.config.maxStoredLogs) {
            this.logs = this.logs.slice(-this.config.maxStoredLogs);
        }
    }

    /**
     * Set log level
     */
    public setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Debug log
     */
    public debug(message: string, data?: any, category?: string): void {
        this.log(LogLevel.DEBUG, message, data, category);
    }

    /**
     * Info log
     */
    public info(message: string, data?: any, category?: string): void {
        this.log(LogLevel.INFO, message, data, category);
    }

    /**
     * Warning log
     */
    public warn(message: string, data?: any, category?: string): void {
        this.log(LogLevel.WARN, message, data, category);
    }

    /**
     * Error log
     */
    public error(message: string, error?: any, category?: string): void {
        let data = error;
        let stack: string | undefined;
        
        if (error instanceof Error) {
            data = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
            stack = error.stack;
        }
        
        this.log(LogLevel.ERROR, message, data, category, stack);
    }

    /**
     * Fatal log
     */
    public fatal(message: string, error?: any, category?: string): void {
        let data = error;
        let stack: string | undefined;
        
        if (error instanceof Error) {
            data = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
            stack = error.stack;
        }
        
        this.log(LogLevel.FATAL, message, data, category, stack);
    }

    /**
     * Log with specific level
     */
    private log(
        level: LogLevel,
        message: string,
        data?: any,
        category?: string,
        stack?: string
    ): void {
        // Check if should log
        if (level < this.config.level) {
            return;
        }
        
        // Check category filter
        if (category && this.config.categories && this.config.categories.length > 0) {
            if (!this.config.categories.includes(category)) {
                return;
            }
        }
        
        // Create log entry
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            category,
            data,
            stack
        };
        
        // Store log
        if (this.config.enableStorage) {
            this.logs.push(entry);
            
            // Trim if needed
            if (this.logs.length > this.config.maxStoredLogs) {
                this.logs.shift();
            }
        }
        
        // Console output
        if (this.config.enableConsole) {
            this.consoleOutput(entry);
        }
        
        // Notify listeners
        this.notifyListeners(entry);
    }

    /**
     * Console output
     */
    private consoleOutput(entry: LogEntry): void {
        const parts: string[] = [];
        const styles: string[] = [];
        
        // Timestamp
        if (this.config.enableTimestamp) {
            parts.push(`[${this.formatTimestamp(entry.timestamp)}]`);
            styles.push('color: #666');
        }
        
        // Level
        parts.push(`[${this.levelNames[entry.level]}]`);
        styles.push(this.config.enableColors ? this.colors[entry.level] : '');
        
        // Category
        if (entry.category) {
            parts.push(`[${entry.category}]`);
            styles.push('color: #9C27B0');
        }
        
        // Message
        parts.push(entry.message);
        styles.push(this.config.enableColors ? this.colors[entry.level] : '');
        
        // Format for console
        const format = parts.map(() => '%c%s').join(' ');
        const args: any[] = [format];
        
        parts.forEach((part, index) => {
            args.push(styles[index]);
            args.push(part);
        });
        
        // Output based on level
        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(...args);
                break;
            case LogLevel.INFO:
                console.info(...args);
                break;
            case LogLevel.WARN:
                console.warn(...args);
                break;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(...args);
                break;
        }
        
        // Log data if present
        if (entry.data !== undefined) {
            console.log('Data:', entry.data);
        }
        
        // Log stack if present
        if (entry.stack) {
            console.error('Stack trace:', entry.stack);
        }
    }

    /**
     * Format timestamp
     */
    private formatTimestamp(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }

    /**
     * Add log listener
     */
    public addListener(listener: (entry: LogEntry) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Remove log listener
     */
    public removeListener(listener: (entry: LogEntry) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notify listeners
     */
    private notifyListeners(entry: LogEntry): void {
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch (error) {
                console.error('Error in log listener:', error);
            }
        });
    }

    /**
     * Get logs
     */
    public getLogs(level?: LogLevel, category?: string, limit?: number): LogEntry[] {
        let filtered = this.logs;
        
        // Filter by level
        if (level !== undefined) {
            filtered = filtered.filter(log => log.level >= level);
        }
        
        // Filter by category
        if (category) {
            filtered = filtered.filter(log => log.category === category);
        }
        
        // Apply limit
        if (limit && limit > 0) {
            filtered = filtered.slice(-limit);
        }
        
        return filtered;
    }

    /**
     * Clear logs
     */
    public clearLogs(): void {
        this.logs = [];
    }

    /**
     * Export logs
     */
    public exportLogs(format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        } else {
            // CSV format
            const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Data'];
            const rows = [headers];
            
            this.logs.forEach(log => {
                rows.push([
                    log.timestamp.toISOString(),
                    this.levelNames[log.level],
                    log.category || '',
                    log.message,
                    log.data ? JSON.stringify(log.data) : ''
                ]);
            });
            
            return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        }
    }

    /**
     * Create performance logger
     */
    public startTimer(label: string): () => void {
        const start = performance.now();
        
        return () => {
            const duration = performance.now() - start;
            this.debug(`${label}: ${duration.toFixed(2)}ms`, { duration }, 'performance');
        };
    }

    /**
     * Log group (for better organization)
     */
    public group(label: string): void {
        if (this.config.enableConsole) {
            console.group(label);
        }
    }

    /**
     * End log group
     */
    public groupEnd(): void {
        if (this.config.enableConsole) {
            console.groupEnd();
        }
    }

    /**
     * Assert (log if condition is false)
     */
    public assert(condition: boolean, message: string, data?: any): void {
        if (!condition) {
            this.error(`Assertion failed: ${message}`, data, 'assertion');
        }
    }

    /**
     * Count occurrences
     */
    private counts: Map<string, number> = new Map();
    
    public count(label: string): void {
        const count = (this.counts.get(label) || 0) + 1;
        this.counts.set(label, count);
        this.debug(`${label}: ${count}`, { count }, 'counter');
    }

    /**
     * Reset count
     */
    public countReset(label: string): void {
        this.counts.delete(label);
    }

    /**
     * Table output (for structured data)
     */
    public table(data: any[], columns?: string[]): void {
        if (this.config.enableConsole && console.table) {
            console.table(data, columns);
        } else {
            this.info('Table data:', data);
        }
    }
}