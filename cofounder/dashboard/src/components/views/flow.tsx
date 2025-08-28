import React, { useCallback, useState, useEffect } from "react";
import "@/components/styles/flow.css";

import {
	ReactFlow,
	MiniMap,
	Controls,
	Background,
	useNodesState,
	useEdgesState,
	addEdge,
	ColorMode,
	MarkerType,
} from "@xyflow/react";

import FloatingEdge from "@/components/flow/helpers/FloatingEdge";
import FloatingConnectionLine from "@/components/flow/helpers/FloatingConnectionLine";
import { createNodesAndEdges } from "@/components/flow/helpers/utils";
import "@/components/flow/helpers/floating.css";

import { useDispatch, useSelector } from "react-redux";
import { setProject } from "@/store/main";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

import template from "@/components/flow/template.tsx";
import keymap from "@/components/flow/keymap.tsx";
// import DynamicLayoutCalculator from "@/components/flow/utils/dynamic-layout.tsx";
// import DepthSlider from "@/components/flow/controls/depth-slider.tsx";

import CofounderNode from "@/components/flow/nodes/cofounder-node.tsx";
import "@/components/flow/nodes/cofounder-node.css";

// register new components types
const nodeTypes = {
	cofounder_node: CofounderNode,
};
const edgeTypes = {
	floating: FloatingEdge,
};

const proOptions = {
	// hideAttribution: true
};

/*
const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];
*/

const initialNodes = [];
const initialEdges = [];

const Flow: React.FC<{ project: string }> = ({ project }) => {
	const dispatch = useDispatch();
	const nodesKeys = useSelector((state: any) => state.project.nodesKeys);
	const loading = useSelector((state: any) => state.project.loading);

	useEffect(() => {
		// Set the project in the store when the component loads
		dispatch(setProject(project));
	}, [dispatch, project]);

	// Temporary fallback - just use nodesKeys directly (no filtering for now)
	// useEffect(() => {
	// 	if (nodesKeys && nodesKeys.length) {
	// 		setFilteredNodeKeys(nodesKeys);
	// 	}
	// }, [nodesKeys]);

	// Helper function to determine node depth
	const getNodeDepth = (nodeKey: string): number => {
		if (nodeKey.includes('README') || nodeKey.startsWith('pm.details')) return 0;
		if (nodeKey.startsWith('pm.') || nodeKey.includes('server.js') || nodeKey.includes('package.json')) return 1;
		if (nodeKey.includes('components') || nodeKey.includes('routes') || nodeKey.includes('models')) return 2;
		if (nodeKey.includes('utils') || nodeKey.includes('helpers')) return 3;
		if (nodeKey.startsWith('file.')) return 4;
		return 2; // Default to feature module level
	};

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
	const [colorMode, setColorMode] = useState<ColorMode>("dark");

	const [loaded, setLoaded] = useState(false);
	const [streamSimulate, setStreamSimulate] = useState<NodeJS.Timeout | null>(
		null,
	);
	const [refresh, setRefresh] = useState(Date.now());
	
	// Dynamic layout state - temporarily disabled
	// const [currentDepth, setCurrentDepth] = useState(2); // Start with feature modules
	// const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
	// const [depthAnalysis, setDepthAnalysis] = useState({ maxDepth: 4, depthCounts: {} });
	// const [allNodes, setAllNodes] = useState<any[]>([]);
	// const [filteredNodeKeys, setFilteredNodeKeys] = useState<string[]>([]);

	useEffect(() => {
		if (nodesKeys && nodesKeys.length) {
			// Create dynamic layout calculator
			// const layoutCalculator = new DynamicLayoutCalculator({
			// 	canvasSize,
			// 	nodeCount: filteredNodeKeys.length,
			// 	depthLevel: currentDepth,
			// 	maxDepth: depthAnalysis.maxDepth
			// });
			// const dynamicMetrics = layoutCalculator.calculateDynamicMetrics();
			const dynamicMetrics = template.metrics; // Fallback to original metrics

			let _multiple_views = {};
			let _multiple_views_edges = [];

			// Handle webapp views with dynamic positioning
			let _webapp_views = nodesKeys.filter((node_key) =>
				node_key.startsWith("webapp.react.views."),
			);
			if (_webapp_views.length) {
				const columns = Math.ceil(Math.sqrt(_webapp_views.length));
				
				_webapp_views.map((key, idx) => {
					const vertical_scroll = Math.floor(idx / columns);
					const horizontal_index = idx % columns;
					_multiple_views[key] = {
						position: {
							x: (dynamicMetrics.DIST_X * 2 + dynamicMetrics.PADDING_X * 0.5) * horizontal_index,
							y: (template.nodes["webapp.react.views"]?.position?.y || 0) +
								dynamicMetrics.DIST_Y * 2.5 * vertical_scroll -
								horizontal_index * dynamicMetrics.PADDING_Y * 2,
						},
					};
					_multiple_views_edges.push({
						id: `${"uxsitemap.structure"}-${key}`,
						source: "uxsitemap.structure",
						target: key,
					});
				});
			}

			// Handle individual file nodes with dynamic grid layout
			// const individualFiles = filteredNodeKeys.filter(key => key.startsWith('file.'));
			// const gridColumns = Math.ceil(Math.sqrt(individualFiles.length));
			
			// individualFiles.forEach((key, idx) => {
			// 	if (!_multiple_views[key]) {
			// 		const position = layoutCalculator.calculateNodePosition(idx, { columns: gridColumns });
			// 		// Offset individual files to create separate areas
			// 		_multiple_views[key] = {
			// 			position: {
			// 				x: position.x + dynamicMetrics.DIST_X * 15,
			// 				y: position.y + dynamicMetrics.DIST_Y * 10
			// 			}
			// 		};
			// 	}
			// });
			setNodes((prev) => {
				const previous_ids = {};
				prev.map((n) => {
					previous_ids[n.id] = { position: n.position };
				});
				return (
					nodesKeys
						.filter((node_key) =>
							Object.keys(template.nodes).some((key) => node_key.startsWith(key)) ||
							node_key.startsWith('file.') // Include individual files
						)
						.map((node_key, idx) => {
							let _key = `${node_key}`;
							let _webapp_case = false;
							let _webapp_view_case = false;
							if (node_key.startsWith("webapp")) {
								_key = node_key.split(".").slice(0, 3).join(".");
								_webapp_case = true;
								if (node_key.includes("webapp.react.views")) {
									_webapp_view_case = true;
								}
							}

							const meta = keymap.meta[_key];
							const pos = previous_ids[node_key]
								? previous_ids[node_key]
								: !_webapp_case
									? template.nodes[_key]
									: !_webapp_view_case
										? template.nodes[_key]
										: _multiple_views[node_key];

							return {
								type: "cofounder_node",
								id: node_key,
								data: {
									key: node_key,
									meta: {
										...meta,
										content_type: keymap.types[meta.type],
									},
								},
								...pos,
							};
						})
						.filter((e) => e)
				);
			});

			setEdges([
				...template.edges,
				..._multiple_views_edges.map((item) => {
					return {
						animated: true,
						style: { stroke: "#999" },
						type: "floating",
						markerEnd: {
							type: MarkerType.ArrowClosed,
							width: 30,
							height: 30,
						},
						...item,
					};
				}),
			]);
			// setRefresh(Date.now())
		}
	}, [nodesKeys]);

	const onConnect = useCallback(
		(params) =>
			setEdges((eds) =>
				addEdge(
					{
						...params,
						type: "floating",
						markerEnd: {
							type: MarkerType.Arrow,
						},
					},
					eds,
				),
			),
		[setEdges],
	);

	return (
		<div style={{ width: "100vw", height: "100vh" }} className="relative">
			<pre className="m-4 p-4 bg-black text-white text-sm hidden">
				{JSON.stringify(nodes)}
			</pre>
			<ReactFlow
				key={refresh}
				colorMode={colorMode}
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				fitView
				minZoom={0.1}
				edgeTypes={edgeTypes}
				connectionLineComponent={FloatingConnectionLine}
				nodeTypes={nodeTypes}
				proOptions={proOptions}
			>
				<Controls />
				<MiniMap />
				<Background variant="dots" gap={48} size={2} />
			</ReactFlow>
			
			{/* Loading Overlay */}
			{loading.isLoading && (
				<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
						<div className="flex items-center gap-3 mb-4">
							<Loader2 className="h-6 w-6 animate-spin text-blue-500" />
							<h3 className="text-lg font-semibold">Analyzing Project</h3>
						</div>
						<p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
							{loading.message}
						</p>
						<Progress value={loading.progress} className="h-2" />
						<div className="flex justify-between items-center mt-2">
							<span className="text-xs text-gray-500">
								{loading.progress}% complete
							</span>
							<span className="text-xs text-gray-500">
								{loading.error ? 'Error occurred' : 'Please wait...'}
							</span>
						</div>
						{loading.error && (
							<div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
								<p className="text-sm text-red-600 dark:text-red-400">
									{loading.error}
								</p>
							</div>
						)}
					</div>
				</div>
			)}
			
			{/* Depth Control Slider */}
			{/* {!loading.isLoading && (
				<DepthSlider
					currentDepth={currentDepth}
					maxDepth={depthAnalysis.maxDepth}
					depthCounts={depthAnalysis.depthCounts}
					visibleNodeCount={filteredNodeKeys.length}
					totalNodeCount={nodesKeys?.length || 0}
					onDepthChange={setCurrentDepth}
				/>
			)} */}
		</div>
	);
};

export default Flow;
