import EventEmmiter from 'events';
import { ITask } from './Task';

type IAnyTask = ITask<any, any>;

export interface ITaskQueue extends EventEmmiter {
  push(task: IAnyTask):void;
  start():void;
}

enum TaskQueueState {
  Initialized = 1,
  Running = 2,
}

export class TaskQueue extends EventEmmiter implements ITaskQueue {
  queue: IAnyTask[];
  concurrency: number;
  // running: number
  startTaskCount: number;
  endTaskCount: number;
  workers: {
    [id: number]: Promise<void>;
  }
  state: TaskQueueState
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
    this.state = TaskQueueState.Initialized;
  }

  push(task: IAnyTask) {
    this.queue.push(task);
    this.load();
  }

  start() {
    this.state = TaskQueueState.Running;
    this.load();
  }

  running() {
    return this.startTaskCount - this.endTaskCount;
  }

  take(): null | IAnyTask {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift();
  }

  load() {
    if (this.state === TaskQueueState.Initialized) {
      return;
    }
    if (this.running() < this.concurrency) {
      const task = this.take();
      if (task === null) return;
      this.startTaskCount += 1;
      const id = this.startTaskCount;
      this.workers[id] = task.run()
      .catch((err) => {
        this.emit('task-error', err);
      })
      .then(() => {
        delete this.workers[id];
        this.endTaskCount += 1;
        this.load();
      });
    }
  }
}

class PriorityTaskQueue extends TaskQueue {
  take() {
    if (this.queue.length === 0) {
      return null;
    }
    let targetIndex = 0;
    let targetPriority = 0;
    //循环排队任务池, 找到优先级最高的任务取出
    //不对queue进行排序的原因是，任务的优先级会随着执行而变化
    for (let index = 0; index < this.queue.length; index++) {
      const priority = this.getPriority(this.queue[index]);
      if (index === 0 || priority > targetPriority) {
        targetIndex = index;
        targetPriority = priority;
      }
    }
    return this.queue.splice(targetIndex, 1)[0];
  }

  getPriority(task: ITask<any, any>) {
    return 1;
  }
}

/**
 * 优先释放内存队列
 * 每个任务执行完成后，留下的内存很可能要等待后续任务完成才能释放
 * 因为要所有后续任务执行完成后才能释放内存
 * 所以每个后续任务的对于释放当前任务占用内存的**价值**可以算为
 * 执行完成后可以释放当前任务内存的概率，具体算法为：
 * (100% / 当前任务的未结束后续任务总数)
 * 因为权重仅用于排序，不关心具体数字，所以为了优化计算，将100%替换为常数27720:
 * （27720 / 当前任务的未结束后续任务总数）
 * 每个任务的权重为，该任务对所有依赖任务的**价值之和**
 */
export class ReleaseMemoryPriorityTaskQueue extends PriorityTaskQueue {
  getPriority(task: ITask<any, any>) {
    if (task.isFailed() || task.isSucceed()) {
      return 0;
    }
    return task.dependencies.reduce((sum, dTask) => {
      const processing = dTask.followers
      .filter(fTask => fTask.isFailed() && fTask.isSucceed())
      .length;
      //27720常数用于优化processing<=12的场景，可以使权重尽量准确
      if (processing <= 12) {
        return sum + (27720 / processing);
      } else {
        return sum + Math.floor(27720 / processing);
      }
    }, 0);
  }
}

/**
 * 优先解锁后续任务队列
 * 假如存在任务组(A,B,C,D), 依赖关系为:
 * A
 * B
 * C >> D
 * 那么在两并发队列上，假设所有任务执行时间相等，其执行顺序可能是：
 * [A,B] -> [C] -> [D]
 * 如果先执行C，则可以做到：
 * [A,C] -> [B,D]
 * 所以为了尽量并行处理任务，我们可以优先执行后续任务(各级follower之和)较多的任务
 * 优先解锁任务模式会以后代任务总数作为权重，确保待执行任务池尽可能充盈
 */
export class UnlockFollowerPriorityTaskQueue extends PriorityTaskQueue {
  getPriority(task: ITask<any, any>) {
    if (task.isFailed() || task.isSucceed()) {
      return 0;
    }
    let weight = 1; //每个任务自己的权重为1，先写入自己的权重
    for (const follower of task.followers) {
      weight += this.getPriority(follower); //递归累加所有后续未失败任务的权重
    }
    return weight;
  }
}
