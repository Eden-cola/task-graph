import EventEmmiter from 'events';
import { ITask } from './Task';

export interface ITaskQueue extends EventEmmiter {
  push(task: ITask<any, any>):void;
}

export class TaskQueue extends EventEmmiter implements ITaskQueue {
  queue: ITask<any, any>[];
  concurrency: number;
  running: number
  workers: {
    [name: string]: Promise<void>;
  }
  constructor(concurrency: number) {
    super();
    if (concurrency <= 1) {
      throw new Error("WTF concurency?");
    }
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.workers = {};
  }

  push(task: ITask<any, any>) {
    this.queue.push(task);
    this.load();
  }

  load() {
    if (this.running < this.concurrency) {
      const task = this.queue.shift();
      this.running += 1;
      this.workers[task.name] = task.run()
      .catch((err) => {
        this.emit('task-error', err);
      })
      .finally(() => {
        delete this.workers[task.name];
        this.running -= 1;
        this.load();
      });
    }
  }
}