// ============================================================
// EventBus — Phaser ↔ React communication bridge
// Uses a simple custom event emitter to avoid Phaser imports
// on the React side.
// ============================================================

type EventHandler = (...args: unknown[]) => void;

class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      this.listeners.set(event, handlers.filter((h) => h !== handler));
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }

  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// Singleton instance shared between Phaser and React
export const eventBus = new EventBus();
