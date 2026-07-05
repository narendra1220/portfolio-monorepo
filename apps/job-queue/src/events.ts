import { EventEmitter } from "node:events";
import type { QueueEvent } from "./types.js";

export class QueueEvents extends EventEmitter {
  emitEvent(ev: QueueEvent): void {
    this.emit(ev.type, ev);
    this.emit("*", ev);
  }
}
