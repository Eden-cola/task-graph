import EventEmmiter from 'events';
import { ITask, ITaskProcess, Task, TaskEvent, TaskState } from './Task';
import { ITaskQueue } from './TaskQueue';

class EmptyProcess implements ITaskProcess<void,void> {
  async run() {};
  paramBuilder(map: {}) {
    return;
  };
}

export interface ITaskGraph extends EventEmmiter {
  setQueue(queue: ITaskQueue): this;
  addTask(task: ITask<any, any>): this;
  getTask(name: string): ITask<any, any>;
  empower(): this;
  start(): this;
}

export class TaskGraph extends EventEmmiter implements ITaskGraph {
  taskMap: {
    [name: string]: ITask<any, any>
  };
  taskQueue: ITaskQueue;
  doneCount: number;
  errorCount: number;

  constructor() {
    super();
    this.taskMap = {};
    this.doneCount = 0;
    this.errorCount = 0;
  }

  setQueue(queue: ITaskQueue) {
    this.taskQueue = queue;
    return this;
  }

  addTask(task: ITask<any, any>) {
    if (this.taskMap[task.name]) {
      throw new Error(`!panic: duplicate task name${task.name}`);
    }
    task.assertState(TaskState.Created, new Error(`!panic: task[${task.name}] has initialzed before add into graph`));
    this.taskMap[task.name] = task;
    this.bindTask(task);
    return this;
  }

  bindTask(task: ITask<any, any>) {
    task.on(TaskEvent.Ready, () => {
      this.taskQueue.push(task);
    });
    task.on(TaskEvent.Done, () => {
      this.doneCount += 1;
      this.emitIfAllTaskOver();
    });
    task.on(TaskEvent.Error, () => {
      this.errorCount += 1;
      this.emitIfAllTaskOver();
    });
  }

  emitIfAllTaskOver() {
    if (this.doneCount + this.errorCount === Object.keys(this.taskMap).length) {
      this.emit('done');
    }
  };

  getTask(name: string) {
    return this.taskMap[name];
  }

  empower() {
    for (const name in this.taskMap) {
      const task = this.taskMap[name];
      task.initialization(this);
      if (task.dependencies.some(task => this.taskMap[task.name] !== task)) {
        throw new Error(`!panic: task[${name}] has a dependency out of the graph`);
      }
    }
    this.check(Object.values(this.taskMap), {});
    return this;
  }

  start() {
    for (const name in this.taskMap) {
      const task = this.taskMap[name];
      if (task.dependencies.length === 0) {
        task.checkDependencyStates();
      }
    }
    this.taskQueue.start();
    return this;
  }
  
  check(tasks: ITask<any, any>[], states: {
    [name: string]: 1|2, //1: 检查中，2：未发现环
  }) {
    for (const task of tasks) {
      if (states[task.name] === 2) {
        continue;
      } else if (states[task.name] === 1) {
        throw new Error(`!panic: invalid DAG: cycle of dependency`)
      } else {
        states[task.name] = 1;
        this.check(task.dependencies, states);
        states[task.name] = 2;
      }
    }
  }
}
