import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@/hooks/use-socket';

interface Stage {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    progress: number;
    components: Component[];
}

interface Component {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    startTime?: number;
    endTime?: number;
    error?: string;
    weight: number;
}

interface ProgressUpdate {
    stageId: string;
    componentId?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'error';
    progress?: number;
    error?: string;
}

export function useGenerationProgress(project: string) {
    const [stages, setStages] = useState<Stage[]>([
        {
            id: 'blueprint',
            name: 'Blueprint Analysis',
            status: 'pending',
            progress: 0,
            components: [
                {
                    id: 'framework-detection',
                    name: 'Framework Detection',
                    status: 'pending',
                    weight: 1
                },
                {
                    id: 'database-analysis',
                    name: 'Database Analysis',
                    status: 'pending',
                    weight: 2
                },
                {
                    id: 'api-analysis',
                    name: 'API Analysis',
                    status: 'pending',
                    weight: 2
                },
                {
                    id: 'frontend-analysis',
                    name: 'Frontend Analysis',
                    status: 'pending',
                    weight: 2
                }
            ]
        },
        {
            id: 'frontend',
            name: 'Frontend Generation',
            status: 'pending',
            progress: 0,
            components: [
                {
                    id: 'components',
                    name: 'Components',
                    status: 'pending',
                    weight: 3
                },
                {
                    id: 'routes',
                    name: 'Routes',
                    status: 'pending',
                    weight: 2
                },
                {
                    id: 'store',
                    name: 'Store',
                    status: 'pending',
                    weight: 2
                }
            ]
        },
        {
            id: 'backend',
            name: 'Backend Generation',
            status: 'pending',
            progress: 0,
            components: [
                {
                    id: 'models',
                    name: 'Models',
                    status: 'pending',
                    weight: 2
                },
                {
                    id: 'controllers',
                    name: 'Controllers',
                    status: 'pending',
                    weight: 3
                },
                {
                    id: 'routes',
                    name: 'Routes',
                    status: 'pending',
                    weight: 2
                }
            ]
        },
        {
            id: 'database',
            name: 'Database Schema Creation',
            status: 'pending',
            progress: 0,
            components: [
                {
                    id: 'tables',
                    name: 'Tables',
                    status: 'pending',
                    weight: 2
                },
                {
                    id: 'migrations',
                    name: 'Migrations',
                    status: 'pending',
                    weight: 1
                }
            ]
        },
        {
            id: 'config',
            name: 'Configuration Generation',
            status: 'pending',
            progress: 0,
            components: [
                {
                    id: 'env',
                    name: 'Environment Variables',
                    status: 'pending',
                    weight: 1
                },
                {
                    id: 'dependencies',
                    name: 'Dependencies',
                    status: 'pending',
                    weight: 1
                },
                {
                    id: 'scripts',
                    name: 'Scripts',
                    status: 'pending',
                    weight: 1
                }
            ]
        }
    ]);

    const [isPaused, setIsPaused] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const socket = useSocket();

    // Update progress state
    const updateProgress = useCallback((update: ProgressUpdate) => {
        setStages(prevStages => {
            const newStages = [...prevStages];
            const stageIndex = newStages.findIndex(s => s.id === update.stageId);
            
            if (stageIndex === -1) return prevStages;
            
            const stage = { ...newStages[stageIndex] };
            
            if (update.componentId) {
                const componentIndex = stage.components.findIndex(c => c.id === update.componentId);
                if (componentIndex === -1) return prevStages;
                
                const component = { ...stage.components[componentIndex] };
                
                if (update.status) {
                    component.status = update.status;
                    if (update.status === 'in_progress') {
                        component.startTime = Date.now();
                    } else if (update.status === 'completed' || update.status === 'error') {
                        component.endTime = Date.now();
                    }
                }
                
                if (update.error) {
                    component.error = update.error;
                }
                
                stage.components[componentIndex] = component;
            }
            
            if (update.progress !== undefined) {
                stage.progress = update.progress;
            }
            
            // Update stage status based on components
            const allCompleted = stage.components.every(c => c.status === 'completed');
            const hasError = stage.components.some(c => c.status === 'error');
            const hasInProgress = stage.components.some(c => c.status === 'in_progress');
            
            if (allCompleted) {
                stage.status = 'completed';
            } else if (hasError) {
                stage.status = 'error';
            } else if (hasInProgress) {
                stage.status = 'in_progress';
            }
            
            newStages[stageIndex] = stage;
            return newStages;
        });
    }, []);

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        socket.on('generation:start', () => {
            setIsGenerating(true);
            setIsPaused(false);
        });

        socket.on('generation:progress', (update: ProgressUpdate) => {
            updateProgress(update);
        });

        socket.on('generation:complete', () => {
            setIsGenerating(false);
        });

        socket.on('generation:error', (error: { stageId: string; componentId: string; message: string }) => {
            updateProgress({
                stageId: error.stageId,
                componentId: error.componentId,
                status: 'error',
                error: error.message
            });
        });

        return () => {
            socket.off('generation:start');
            socket.off('generation:progress');
            socket.off('generation:complete');
            socket.off('generation:error');
        };
    }, [socket, updateProgress]);

    // Control functions
    const pause = useCallback(() => {
        if (!socket || !isGenerating) return;
        socket.emit('generation:pause', { project });
        setIsPaused(true);
    }, [socket, project, isGenerating]);

    const resume = useCallback(() => {
        if (!socket || !isGenerating) return;
        socket.emit('generation:resume', { project });
        setIsPaused(false);
    }, [socket, project, isGenerating]);

    const cancel = useCallback(() => {
        if (!socket || !isGenerating) return;
        socket.emit('generation:cancel', { project });
        setIsGenerating(false);
    }, [socket, project, isGenerating]);

    const retry = useCallback((stageId: string, componentId: string) => {
        if (!socket || !isGenerating) return;
        socket.emit('generation:retry', { project, stageId, componentId });
        updateProgress({
            stageId,
            componentId,
            status: 'pending'
        });
    }, [socket, project, isGenerating, updateProgress]);

    return {
        stages,
        isPaused,
        isGenerating,
        pause,
        resume,
        cancel,
        retry
    };
}