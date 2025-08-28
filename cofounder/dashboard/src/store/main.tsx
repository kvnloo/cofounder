import { configureStore, createSlice } from "@reduxjs/toolkit";
import { io } from "socket.io-client";
import { merge } from "lodash-es";

// Socket.io client setup
const socket = io("http://localhost:4200");

// Initial state for the store
const initialState = {
	project: "",
	streamEvents: {},
	projectData: {},
	nodesKeys: [] as string[],
	nodesKeysDict: {},
	loading: {
		isLoading: false,
		progress: 0,
		message: "",
		error: null
	},
};

// Create a slice for the store
const projectSlice = createSlice({
	name: "project",
	initialState,
	reducers: {
		setProject(state, action) {
			state.project = action.payload;
			console.log("store : project : ", state.project);
			// Subscribe to the stream when the project is set
			socket.emit("subscribe", state.project);
		},
		resetProject(state) {
			console.log("> debug : store : resetProject()");
			state = initialState;
			return initialState;
		},
		loadProjectState(state, action) {
			// action.payload : { state : { pm , db , ... } }
			state.projectData = action.payload.state;

			state.nodesKeys = [
				...new Set([...state.nodesKeys, ...Object.keys(state.projectData)]),
			];
			Object.keys(state.projectData).map((k) => {
				state.nodesKeysDict[k] = true;
			});
		},
		updateProjectState(state, message) {
			// action.payload : { data }
			const { key, data } = message.payload;
			console.log("> debug : store : updateProjectState ", { key, data });
			if (key && data) {
				state.projectData = merge(state.projectData, { [key]: data });
				state.nodesKeys = [
					...new Set([...state.nodesKeys, ...Object.keys(state.projectData)]),
				];
				Object.keys(state.projectData).map((k) => {
					state.nodesKeysDict[k] = true;
				});
			}
		},
		startStreamEvent(state, action) {
			const { key, meta } = action.payload;
			if (!state.streamEvents[key]) {
				state.streamEvents[key] = {
					is_running: true,
					meta,
					data: { key, data: "" },
				};
			}
			if (!state.nodesKeysDict[key]) {
				state.nodesKeys = [...new Set([...state.nodesKeys, key])];
				state.nodesKeysDict[key] = true;
			}
			if (!state.streamEvents[key].is_running) {
				state.streamEvents[key].is_running = true;
			}
		},
		updateStreamEvent(state, action) {
			// add new chunk
			const { key, data } = action.payload;
			if (state.streamEvents[key]?.data) {
				state.streamEvents[key].data.data += data.data;
			}
		},
		endStreamEvent(state, action) {
			const { key } = action.payload;
			if (state.streamEvents[key]) {
				state.streamEvents[key].is_running = false;
				state.streamEvents[key].data = false;
				delete state.streamEvents[key];
			}

			/* // messes up when shared keys that stream also in flow nodes
			if (state.nodesKeysDict[key]) {
				delete state.nodesKeysDict[key] ;
				state.nodesKeys = [...new Set([...state.nodesKeys, key])].filter(e=>e!=key);
			}
			*/
		},
		setLoadingStart(state, action) {
			state.loading.isLoading = true;
			state.loading.progress = 0;
			state.loading.message = action.payload.message || "Loading...";
			state.loading.error = null;
		},
		setLoadingProgress(state, action) {
			state.loading.progress = action.payload.progress || 0;
			state.loading.message = action.payload.message || state.loading.message;
		},
		setLoadingComplete(state, action) {
			state.loading.isLoading = false;
			state.loading.progress = 100;
			state.loading.message = action.payload.message || "Complete";
		},
		setLoadingError(state, action) {
			state.loading.isLoading = false;
			state.loading.error = action.payload.error;
			state.loading.message = "Error occurred";
		},
	},
});

// Configure the Redux store
const store = configureStore({
	reducer: {
		project: projectSlice.reducer,
	},
});

// Socket event listeners
socket.on("state$load", (data) => {
	// console.log('> received project state :', store.getState().project.project);
	// data : { state : { pm , db , ... } }
	store.dispatch(projectSlice.actions.loadProjectState(data));
});

socket.on("stream$start", (message) => {
	// console.log('> stream started for project:', store.getState().project.project);
	const { key, meta } = message; // Assuming the message contains a key
	store.dispatch(projectSlice.actions.startStreamEvent({ key, meta }));
});

socket.on("stream$data", (data) => {
	// console.log('> received stream data:', data);
	const { key } = data; // Destructure the data object
	store.dispatch(projectSlice.actions.updateStreamEvent({ key, data }));
});

socket.on("stream$end", (message) => {
	// console.log('> stream ended:', message);
	const { key } = message; // Assuming the message contains a key
	store.dispatch(projectSlice.actions.endStreamEvent({ key }));
});

socket.on("state$update", (message) => {
	// console.log('> received stream data:', message); // {key,data}
	store.dispatch(projectSlice.actions.updateProjectState(message));
});

// Loading event listeners
socket.on("loading$start", (data) => {
	console.log('> loading started:', data);
	store.dispatch(projectSlice.actions.setLoadingStart(data));
});

socket.on("loading$progress", (data) => {
	console.log('> loading progress:', data);
	store.dispatch(projectSlice.actions.setLoadingProgress(data));
});

socket.on("loading$complete", (data) => {
	console.log('> loading complete:', data);
	store.dispatch(projectSlice.actions.setLoadingComplete(data));
});

socket.on("loading$error", (data) => {
	console.log('> loading error:', data);
	store.dispatch(projectSlice.actions.setLoadingError(data));
});

// Export the store and actions
export const { setProject, resetProject } = projectSlice.actions;
export default store;
