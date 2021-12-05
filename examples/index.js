import G6 from '@antv/g6';
import { graph } from './example'

const g6Graph = new G6.Graph({
	container: 'graph',
	width: 800, // Number，必须，图的宽度
	height: 500, // Number，必须，图的高度
	layout: {
		type: 'dagre',
		preventOverlap: true
	}
});

function getNodesAndEdges() {
	const nodes = [];
	const edges = [];

	const taskMap = graph.taskMap;
	for (const key in taskMap) {
		const task = taskMap[key]
		nodes.push({
			id: task.name,
			label: task.name,
		})

		for (const dep of task.dependencies) {
			edges.push({
				source: dep.name,
				target: task.name,
				type: 'line'
			})
		}
	}

	return { nodes, edges };
}

function loopForTaskState() {
	const taskMap = graph.taskMap;
	for (const key in taskMap) {
		const task = taskMap[key]
		g6Graph.updateItem(task.name, {
			style: {
				fill: (['grey', 'gray', 'cyan', 'green', 'grey', 'red'])[task.state]
			}
		})
	}

	requestAnimationFrame(loopForTaskState);
}

function main() {
	const { nodes, edges } = getNodesAndEdges();
	g6Graph.data({ nodes, edges });
	g6Graph.render();

	loopForTaskState();
}

main()