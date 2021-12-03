import {
  TaskGraph,
  TaskGraphBuilder,
  TaskQueue,
} from "../lib/index";

const ACCESS_TOKEN = 'hey jude';

const graph = new TaskGraphBuilder(new TaskGraph())
//register no dependency task
.addTaskProcess('takeAccessToken', {
  async run() {
    console.log('run take access token success');
    //get some token or do anything
    return ACCESS_TOKEN;
  }
})
//register task and set dependency
.addTaskProcess('getParam1', {
  paramBuilder({ takeAccessToken }) {
    return takeAccessToken.getResult();
  },
  async run(accessToken) {
    if (accessToken === ACCESS_TOKEN) {
      console.log('run get param 1 success');
      return 'param1_result';
    }
  },
}, ['takeAccessToken'])
//register task but not set dependency 
.addTaskProcess('getParam2', {
  paramBuilder({ takeAccessToken }) {
    return takeAccessToken.getResult();
  },
  async run(accessToken) {
    if (accessToken === ACCESS_TOKEN) {
      console.log('run get param 2 success');
      return 'param2_result';
    }
  },
})
//set dependency after register task
.addDependencies('getParam2', ['takeAccessToken'])
//register multi dependencies task
.addTaskProcess('callSomeService', {
  paramBuilder({ takeAccessToken, getParam1, getParam2 }) {
    return {
      token: takeAccessToken.getResult(),
      requestBody: {
        param1: getParam1.getResult(),
        param2: getParam2.getResult(),
      }
    };
  },
  async run({ token, requestBody }) {
    //call origin service
    if (token !== ACCESS_TOKEN) {
      throw new Error('invalid token');
    }
    console.log('run call some service success');
    console.log(`params: ${JSON.stringify(requestBody)}`);
    // => { param1: "param1_result", param2: "param2_result"}
 }
})
//add dependency
.addDependencies('callSomeService', ['getParam1', 'getParam2'])
//append dependency
.addDependencies('callSomeService', ['takeAccessToken'])
.toGraph();// graph like:

//   +-----------------------------------------+
//   |                                         v
// +-----------------+     +-----------+     +-----------------+
// | takeAccessToken | --> | getParam1 | --> | callSomeService |
// +-----------------+     +-----------+     +-----------------+
//   |                                         ^
//   |                                         |
//   v                                         |
// +-----------------+                         |
// |    getParam2    | ------------------------+
// +-----------------+

graph
.on('done', () => {
  console.log('all task success');
})
.setQueue(new TaskQueue(2)) //use 2 concurrency queue
.empower()
.start();
// start task graph, the output should like
// => run take access token success
// => run get param 1 success
// => run get param 2 success
// => run call some service success
// => params: { param1: "param1_result", param2: "param2_result"}
// => all task success

// or:
// => run take access token success
// => run get param 2 success
// => run get param 1 success
// => run call some service success
// => params: { param1: "param1_result", param2: "param2_result"}
// => all task success
