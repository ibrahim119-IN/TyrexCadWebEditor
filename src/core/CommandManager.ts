export interface Command {
    execute(): void;
    undo(): void;
}

export class CommandManager {
    private history: Command[] = [];
    private currentIndex: number = -1;
    private maxHistory: number = 50;

    execute(command: Command): void {
        // إزالة الأوامر بعد الفهرس الحالي
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // إضافة الأمر الجديد
        this.history.push(command);
        
        // تقليم التاريخ إذا تجاوز الحد
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
        
        command.execute();
    }

    undo(): boolean {
        if (this.canUndo()) {
            this.history[this.currentIndex].undo();
            this.currentIndex--;
            return true;
        }
        return false;
    }

    redo(): boolean {
        if (this.canRedo()) {
            this.currentIndex++;
            this.history[this.currentIndex].execute();
            return true;
        }
        return false;
    }

    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    clear(): void {
        this.history = [];
        this.currentIndex = -1;
    }
}