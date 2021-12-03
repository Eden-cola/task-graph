import EventEmmiter from 'events';
import { ITaskGraph } from './TaskGraph';

export enum TaskState {
  Created = 0,
  Initialized = 1,
  Ready = 2,
  Running = 3,
  Done = 4,
  Error = 5,
}

export enum TaskEvent {
  Created = 'create',
  Initialized = 'initialized',
  Ready = 'ready',
  Running = 'running',
  Done = 'done',
  Error = 'error',
}

export interface TaskProcessFunc<P, R> {
  (params?: P): Promise<R>;
}

export interface ITaskProcess<P, R> {
  paramBuilder?: (dependencyMap: { [name:string]: ITask<any, any> }) => P,
  run: TaskProcessFunc<P, R>,
}

export interface ITask<P, R> extends EventEmmiter {
  name: string;
  // state: TaskState;
  // params: P
  // process: ITaskProcess<P, R>;
  // result: R;
  dependencies: ITask<any, any>[];
  followers: ITask<any, any>[];
  initialization(graph: ITaskGraph): void;
  // setState(state: TaskState): void;
  assertState(state: TaskState, error?: Error): void;
  run(): Promise<void>;
  getResult(): R;
  checkDependencyStates(): void;
  isFailed(): boolean;
  isSucceed(): boolean;
  isReady(): boolean;
  addDependency(task: ITask<any, any>): void;
  addFollower(task: ITask<any, any>): void;
}

export class Task<P, R> extends EventEmmiter implements ITask<P, R> {
  name: string;
  state: TaskState;
  params: P
  process: ITaskProcess<P, R>;
  result: R;
  dependencies: ITask<any, any>[];
  followers: ITask<any, any>[];
  error: Error;

  graph: ITaskGraph;

  constructor (name: string, process: ITaskProcess<P, R>) {
    super();
    this.name = name;
    this.process = process;
    this.dependencies = [];
    this.followers = [];
    this.setState(TaskState.Created);
  }

  initialization(graph: ITaskGraph) {
    this.assertState(TaskState.Created, new Error(`!panic: task[${this.name}] has initialzed before empower`));
    this.graph = graph;
    this.setState(TaskState.Initialized);
  }

  setError(err) {
    this.setState(TaskState.Error, err);
    delete this.params;
    delete this.result;
    this.error = err;
  }

  setState(state: TaskState, payload?: any) {
    this.state = state;
    this.emit(({
      [TaskState.Created]: TaskEvent.Created,
      [TaskState.Initialized]: TaskEvent.Initialized,
      [TaskState.Ready]: TaskEvent.Ready,
      [TaskState.Running]: TaskEvent.Running,
      [TaskState.Done]: TaskEvent.Done,
      [TaskState.Error]: TaskEvent.Error,
    })[state], payload);
  }

  async run() {
    if (this.isFailed()) return;
    this.assertState(TaskState.Ready);
    this.setState(TaskState.Running);
    try {
      if (this.params) {
        this.result = await this.process.run(this.params);
      } else {
        this.result = await this.process.run();
      }
      this.setState(TaskState.Done);
    } catch (err) {
      this.setError(err);
    }
  }

  getResult () {
    this.assertState(TaskState.Done);
    return this.result;
  }

  assertState(state: TaskState, err?: Error) {
    if (this.state !== state) {
      if (err) {
        throw err;
      }
      throw new Error(`!panic expect state[${state}] got state[${this.state}]`);
    }
  }

  isFailed() {
    return this.state === TaskState.Error;
  }

  isSucceed() {
    return this.state === TaskState.Done;
  }

  isReady() {
    return this.state === TaskState.Ready;
  }

  checkDependencyStates() {
    if (this.isFailed()) return;
    this.assertState(TaskState.Initialized);
    if (this.dependencies.every((task) => task.isSucceed())) {
      try {
        if (this.process.paramBuilder) {
          const map = {};
          this.dependencies.forEach(task => map[task.name] = task);
          this.params = this.process.paramBuilder(map);
        }
        this.setState(TaskState.Ready);
      } catch (err) {
        this.setError(err);
      }
    }
  }

  addDependency(task: ITask<any, any>) {
    task.assertState(TaskState.Created, new Error('!panic: try add an initialized dependency'));
    this.assertState(TaskState.Created, new Error('!panic: try add dependency after initial'));
    task.on(TaskEvent.Done, () => {
      this.checkDependencyStates();
    });
    task.on(TaskEvent.Error, (error) => {
      this.setError(error);
    });
    this.dependencies.push(task);
    task.addFollower(this);
  }

  checkFollowerStates() {
    this.assertState(TaskState.Done);
    if (this.followers.every((task) => task.isReady())) {
      delete this.result;
    }
  }

  addFollower(task: ITask<any, any>) {
    task.on(TaskEvent.Ready, () => {
      this.checkFollowerStates();
    });
    this.followers.push(task);
  }
}