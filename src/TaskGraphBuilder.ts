import { ITask, ITaskProcess, Task } from "./Task";
import { ITaskGraph } from "./TaskGraph";

export class TaskGraphBuilder {
  graph: ITaskGraph;
  dependencyMap: {
    [name: string]: string[],
  };

  constructor(graph: ITaskGraph) {
    this.dependencyMap = {};
    this.graph = graph
  }

  add({
    name, process, task, dependencies,
  }: {
    name?: string,
    process?: ITaskProcess<any, any>,
    task?: ITask<any, any>,
    dependencies?: string[],
  }) {
    let flag = false;
    if(name && process) {
      this.addTaskProcess(name, process);
      flag = true;
    }
    if (task) {
      this.addTask(task)
      flag = true;
    }
    if (dependencies) {
      if (task) {
        this.addDependencies(task.name, dependencies);
        flag = true;
      } else if (name) {
        this.addDependencies(name, dependencies);
        flag = true;
      }
    }
    if (!flag) {
      throw new Error('method "add" is called but nothing happened');
    }
  }

  addTaskProcess(name: string, process: ITaskProcess<any, any>, dependencies?: string[]) {
    return this.addTask(new Task(name, process), dependencies);
  }

  addTask(task: ITask<any, any>, dependencies?: string[]) {
    this.graph.addTask(task)
    if (dependencies) {
      this.addDependencies(task.name, dependencies);
    }
    return this;
  }

  addDependencies(name: string, dependencies: string[]) {
    if (this.dependencyMap[name]) {
      this.dependencyMap[name].push(...dependencies);
    } else {
      this.dependencyMap[name] = dependencies;
    }
    return this;
  }

  getTask(name: string) {
    const task = this.graph.getTask(name);
    if (!task) {
      throw new Error(`unregistered task: ${name}`);
    }
    return task;
  }

  toGraph(): ITaskGraph {
    for (const name in this.dependencyMap) {
      const task = this.getTask(name);
      this.dependencyMap[name]
      .map(dependencyName => {
        const dependency = this.getTask(dependencyName);
        task.addDependency(dependency);
      })
    }
    return this.graph;
  }
}