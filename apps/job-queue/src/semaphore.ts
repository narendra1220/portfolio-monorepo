export class Semaphore {
  private available: number;
  private waiters: Array<() => void> = [];

  constructor(public readonly capacity: number) {
    if (capacity < 1) throw new Error("capacity must be >= 1");
    this.available = capacity;
  }

  get free(): number {
    return this.available;
  }

  get inUse(): number {
    return this.capacity - this.available;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.available--;
  }

  release(): void {
    this.available++;
    const next = this.waiters.shift();
    if (next) next();
  }

  async drain(): Promise<void> {
    while (this.inUse > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
  }
}
