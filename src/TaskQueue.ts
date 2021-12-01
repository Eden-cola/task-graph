import EventEmmiter from 'events';

interface IRunnable {
  run(): Promise<void>;
}

export interface ITaskQueue extends EventEmmiter {
  push(task: IRunnable):void;
}

export class TaskQueue extends EventEmmiter implements ITaskQueue {
  queue: IRunnable[];
  concurrency: number;
  // running: number
  startTaskCount: number;
  endTaskCount: number;
  workers: {
    [id: number]: Promise<void>;
  }
  constructor(concurrency: number) {
    super();
    if (concurrency <= 1) {
      throw new Error("WTF concurency?");
    }
    this.concurrency = concurrency;
    this.startTaskCount = 0;
    this.endTaskCount = 0;
    this.queue = [];
    this.workers = {};
  }

  push(task: IRunnable) {
    this.queue.push(task);
    this.load();
  }

  running() {
    return this.startTaskCount - this.endTaskCount;
  }

  load() {
    if (this.running() < this.concurrency) {
      const task = this.queue.shift();
      this.startTaskCount += 1;
      const id = this.startTaskCount;
      this.workers[id] = task.run()
      .catch((err) => {
        this.emit('task-error', err);
      })
      .finally(() => {
        delete this.workers[id];
        this.endTaskCount += 1;
        this.load();
      });
    }
  }
}