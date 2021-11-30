import EventEmmiter from 'events';
import { TaskGraph } from './TaskGraph';

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

interface TaskProcessFunc<P, R> {
  (task: P): Promise<R>;
}

export interface ITaskProcess<P, R> {
  paramBuilder: (dependencies: Task<any, any>[]) => P,
  run: TaskProcessFunc<P, R>,
}

export class Task<P, R> extends EventEmmiter {
  name: string;
  state: TaskState;
  params: P
  process: ITaskProcess<P, R>;
  result: R;
  dependencies: Task<any, any>[];

  graph: TaskGraph;

  constructor (name: string, process: ITaskProcess<P, R>) {
    super();
    this.name = name;
    this.process = process;
    this.setState(TaskState.Created);
  }

  initialization(graph: TaskGraph) {
    this.assertState(TaskState.Created, new Error(`!panic: task[${name}] has initialzed before empower`));
    this.graph = graph;
    this.setState(TaskState.Initialized);
  }

  setState(state: TaskState, payload?: any) {
    this.emit(({
      [TaskState.Created]: TaskEvent.Created,
      [TaskState.Initialized]: TaskEvent.Initialized,
      [TaskState.Ready]: TaskEvent.Ready,
      [TaskState.Running]: TaskEvent.Running,
      [TaskState.Done]: TaskEvent.Done,
      [TaskState.Error]: TaskEvent.Error,
    })[state], payload);
    this.state = state;
  }

  async run() {
    if (this.isErrored()) return;
    this.assertState(TaskState.Initialized);
    this.setState(TaskState.Running);
    try {
      this.result = await this.process.run(this.params);
      this.setState(TaskState.Done);
    } catch (err) {
      this.setState(TaskState.Error, err);
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

  isErrored() {
    return this.state === TaskState.Error;
  }

  checkDependencyStates() {
    if (this.isErrored()) return;
    this.assertState(TaskState.Initialized);
    if (this.dependencies.every((task) => task.state === TaskState.Done)) {
      try {
        this.params = this.process.paramBuilder(this.dependencies);
        this.setState(TaskState.Ready);
      } catch (err) {
        this.setState(TaskState.Error, err);
      }
    }
  }

  addDependency(task: Task<any, any>) {
    task.assertState(TaskState.Created, new Error('!panic: try add an initialized dependency'));
    this.assertState(TaskState.Created, new Error('!panic: try add dependency after initial'));
    task.on(TaskEvent.Done, () => {
      this.checkDependencyStates();
    });
    task.on(TaskEvent.Error, (error) => {
      this.setState(TaskState.Error, error);
    });
    this.dependencies.push(task);
  }

}