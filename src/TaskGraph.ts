import EventEmmiter from 'events';
import { ITaskProcess, Task, TaskEvent, TaskState } from './Task';
import { TaskQueue } from './TaskQueue';

class EmptyProcess implements ITaskProcess<void,void> {
  async run() {};
  paramBuilder(_dependencies: Task<any, any>[]) {
    return;
  };
}

export class TaskGraph extends EventEmmiter {
  taskMap: {
    [name: string]: Task<any, any>
  };
  taskQueue: TaskQueue;
  mainTask: Task<void, void>;

  constructor(queue: TaskQueue) {
    super();
    this.taskMap = {};
    this.taskQueue = queue;
    this.mainTask = new Task('main', new EmptyProcess());
    this.mainTask.on(TaskEvent.Ready, () => {
      this.emit('done');
    })
  }
  addTask(task: Task<any, any>) {
    if (this.taskMap[task.name]) {
      throw new Error("!panic: duplicate task name");
    }
    if (task.state !== TaskState.Created) {
      throw new Error(`!panic: task[${task.name}] has initialzed before add into graph`);
    }
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
      task.checkDependencyStates();
    }
  }
  
  check(tasks: Task<any, any>[], states: {
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
