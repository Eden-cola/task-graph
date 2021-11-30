import EventEmmiter from 'events';
import { ITask, ITaskProcess, Task, TaskEvent, TaskState } from './Task';
import { ITaskQueue } from './TaskQueue';

class EmptyProcess implements ITaskProcess<void,void> {
  async run() {};
  paramBuilder(_dependencies: ITask<any, any>[]) {
    return;
  };
}

export interface ITaskGraph extends EventEmmiter {
  setQueue(queue: ITaskQueue): void;
  addTask(task: ITask<any, any>): void;
  empower(): void;
  start(): void;
}

export class TaskGraph extends EventEmmiter implements ITaskGraph {
  taskMap: {
    [name: string]: ITask<any, any>
  };
  taskQueue: ITaskQueue;
  mainTask: Task<void, void>;

  constructor() {
    super();
    this.taskMap = {};
    this.mainTask = new Task('main', new EmptyProcess());
    this.mainTask.on(TaskEvent.Ready, () => {
      this.emit('done');
    })
  }

  setQueue(queue: ITaskQueue) {
    this.taskQueue = queue;
  }

  addTask(task: ITask<any, any>) {
    if (this.taskMap[task.name]) {
      throw new Error("!panic: duplicate task name");
    }
    task.assertState(TaskState.Created, new Error(`!panic: task[${task.name}] has initialzed before add into graph`));
    this.taskMap[task.name] = task;
    this.mainTask.addDependency(task);
    return this;
  }

  empower() {
    for (const name in this.taskMap) {
      const task = this.taskMap[name];
      task.initialization(this);
      if (task.dependencies.some(task => this.taskMap[task.name] !== task)) {
        throw new Error(`!panic: task[${name}] has a dependency out of the graph`);
      }
    }
    this.mainTask.initialization(this);
    this.check(Object.values(this.taskMap), {});
    return this;
  }

  start() {
    for (const name in this.taskMap) {
      const task = this.taskMap[name];
      task.on(TaskEvent.Ready, () => {
        this.taskQueue.push(task);
      });
      task.checkDependencyStates();
    }
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
