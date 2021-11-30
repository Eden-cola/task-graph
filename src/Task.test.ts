import { ITask, ITaskProcess, Task, TaskEvent, TaskProcessFunc, TaskState } from './Task';
import { TaskGraph } from './TaskGraph';

class TestTaskProcess implements ITaskProcess<number, number> {
  paramBuilder: (dependencies: ITask<any, any>[]) => number;
  run: TaskProcessFunc<number, number>;
  constructor({ builder, run }) {
    this.paramBuilder = builder;
    this.run = run;
  }
}

const testGraph = new TaskGraph();

describe('Task', () => {

  test('base state migrate', async() => {
    const randNumber = Date.now();
    const randResult = randNumber % 2022;
    const process = new TestTaskProcess({
      builder: jest.fn().mockReturnValue(randNumber),
      run: jest.fn().mockReturnValue(randResult),
    });
    const task = new Task('test task', process);
    const errorListener = jest.fn();
    task.on(TaskEvent.Error, errorListener);
    const doneListener = jest.fn();
    task.on(TaskEvent.Done, doneListener);
    task.assertState(TaskState.Created);
    task.initialization(testGraph);
    task.assertState(TaskState.Initialized);
    task.checkDependencyStates();
    task.assertState(TaskState.Ready);
    expect(process.paramBuilder).lastCalledWith([]);
    expect(task.params).toEqual(randNumber);
    await task.run();
    expect(process.run).lastCalledWith(randNumber);
    task.assertState(TaskState.Done);
    expect(task.getResult()).toEqual(randResult);
    expect(process.run).toHaveBeenCalledTimes(1);
    expect(doneListener).toHaveBeenCalledTimes(1);
    expect(errorListener).toHaveBeenCalledTimes(0);
  });

  test('wrong builder', async() => {
    const randNumber = Date.now();
    const randError = new Error('target');
    const process = new TestTaskProcess({
      builder: jest.fn(() => { throw randError; }),
      run: jest.fn(),
    });
    const task = new Task('test task', process);
    const errorListener = jest.fn();
    task.on(TaskEvent.Error, errorListener);
    const doneListener = jest.fn();
    task.on(TaskEvent.Done, doneListener);
    task.initialization(testGraph);
    task.checkDependencyStates();
    task.assertState(TaskState.Error);
    expect(errorListener).lastCalledWith(randError);
    await task.run();
    task.assertState(TaskState.Error);
    expect(process.run).toHaveBeenCalledTimes(0);
    expect(doneListener).toHaveBeenCalledTimes(0);
  });

  test('wrong run function', async() => {
    const randNumber = Date.now();
    const randError = new Error('target');
    const process = new TestTaskProcess({
      builder: jest.fn().mockReturnValue(randNumber),
      run: jest.fn().mockRejectedValue(randError),
    });
    const task = new Task('test task', process);
    const errorListener = jest.fn();
    task.on(TaskEvent.Error, errorListener);
    const doneListener = jest.fn();
    task.on(TaskEvent.Done, doneListener);
    task.initialization(testGraph);
    task.checkDependencyStates();
    task.assertState(TaskState.Ready);
    expect(errorListener).toHaveBeenCalledTimes(0);
    expect(task.params).toEqual(randNumber);
    await task.run();
    task.assertState(TaskState.Error);
    expect(errorListener).lastCalledWith(randError);
    expect(doneListener).toHaveBeenCalledTimes(0);
  });
})
