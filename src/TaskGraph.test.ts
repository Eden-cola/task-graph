import { EventEmitter } from 'events';
import { ITask, TaskEvent, TaskState } from './Task';
import { ITaskGraph, TaskGraph } from './TaskGraph';
import { ITaskQueue } from './TaskQueue';

class TestTask extends EventEmitter implements ITask<number, number> {
  name: string;
  dependencies: ITask<any, any>[];
  constructor(name) {
    super();
    this.dependencies = [];
    this.name = name;
    this.initialization = jest.fn();
    this.assertState = jest.fn();
    this.run = jest.fn().mockResolvedValue(undefined);
    this.getResult = jest.fn();
    this.checkDependencyStates = jest.fn();
    const isFailed = jest.fn();
    this.isFailed = isFailed;
    const isSucceed = jest.fn();
    this.isSucceed = isSucceed;
    this.on(TaskEvent.Done, () => isSucceed.mockReturnValue(true));
    this.on(TaskEvent.Error, () => isFailed.mockReturnValue(true));
  }
  followers: ITask<any, any>[];
  isReady(): boolean {
    return true;
  }
  addDependency(task: ITask<any, any>): void {
    return ;
  }
  addFollower(task: ITask<any, any>): void {
    return ;
  }
  initialization(graph: ITaskGraph): void {
    return;
  }
  assertState(state: TaskState, error?: Error): void {
    return;
  }
  async run(): Promise<void> {
    return;
  }
  getResult(): number {
    return 0;
  }
  checkDependencyStates(): void {
    return;
  }
  isFailed(): boolean {
    return false;
  }
  isSucceed(): boolean {
    return true;
  }
}

class TestTaskQueue extends EventEmitter implements ITaskQueue {
  constructor() {
    super();
    this.push = jest.fn();
  }
  push (task: ITask<any, any>) {
    task.run();
    return;
  }
}

describe('TaskGraph', () => {

  test('base', async() => {
    const task1 = new TestTask('test1');
    const task2 = new TestTask('test2');
    task2.dependencies = [task1];
    const graph = new TaskGraph();
    const graphListener = jest.fn();
    graph.on('done', graphListener);
    const queue = new TestTaskQueue();
    graph.setQueue(queue);
    graph.addTask(task1);
    graph.addTask(task2);
    expect(graph.mainTask.dependencies).toEqual([task1, task2]);
    graph.empower();
    expect(task1.initialization).lastCalledWith(graph);
    expect(task2.initialization).lastCalledWith(graph);
    graph.start();
    expect(task1.checkDependencyStates).toBeCalledTimes(1);
    expect(task2.checkDependencyStates).toBeCalledTimes(1);
    task1.emit(TaskEvent.Ready);
    expect(queue.push).lastCalledWith(task1);
    task1.emit(TaskEvent.Done);
    expect(graphListener).toBeCalledTimes(0);
    task2.emit(TaskEvent.Ready);
    expect(queue.push).lastCalledWith(task2);
    expect(graphListener).toBeCalledTimes(0);
    task2.emit(TaskEvent.Done);
    expect(graphListener).toBeCalledTimes(1);
  });
})
