import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    Loader2,
    ChevronRight,
    ChevronDown,
    XCircle,
    Pause,
    Play,
    X,
    Maximize2,
    Minimize2,
    RotateCcw,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

// Types
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

interface ProgressPanelProps {
    stages: Stage[];
    onRetry: (stageId: string, componentId: string) => void;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    isPaused: boolean;
    isGenerating: boolean;
}

const statusIcons = {
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    in_progress: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    error: <AlertTriangle className="w-4 h-4 text-red-500" />
};

const statusColors = {
    pending: 'bg-gray-200',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    error: 'bg-red-500'
};

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
    stages,
    onRetry,
    onPause,
    onResume,
    onCancel,
    isPaused,
    isGenerating
}) => {
    const [isCollapsed, setIsCollapsed] = useLocalStorage('progress-panel-collapsed', false);
    const [expandedStages, setExpandedStages] = useLocalStorage<string[]>('expanded-stages', []);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [position, setPosition] = useLocalStorage('progress-panel-position', 'right');
    const [width, setWidth] = useLocalStorage('progress-panel-width', 300);
    const [isResizing, setIsResizing] = useState(false);

    // Calculate overall progress
    const calculateOverallProgress = useCallback(() => {
        const totalWeight = stages.reduce((acc, stage) => 
            acc + stage.components.reduce((sum, comp) => sum + comp.weight, 0), 0);
        
        const completedWeight = stages.reduce((acc, stage) => 
            acc + stage.components.reduce((sum, comp) => 
                comp.status === 'completed' ? sum + comp.weight : sum, 0), 0);
        
        return Math.round((completedWeight / totalWeight) * 100);
    }, [stages]);

    // Calculate estimated time remaining
    const calculateTimeRemaining = useCallback(() => {
        const completedComponents = stages.flatMap(s => s.components)
            .filter(c => c.status === 'completed' && c.startTime && c.endTime);
        
        if (completedComponents.length === 0) return null;

        const avgTimePerWeight = completedComponents.reduce((acc, comp) => 
            acc + ((comp.endTime! - comp.startTime!) / comp.weight), 0) / completedComponents.length;

        const remainingWeight = stages.reduce((acc, stage) => 
            acc + stage.components.reduce((sum, comp) => 
                comp.status !== 'completed' ? sum + comp.weight : sum, 0), 0);

        return Math.round(avgTimePerWeight * remainingWeight / 1000); // Convert to seconds
    }, [stages]);

    // Handle stage toggle
    const toggleStage = (stageId: string) => {
        setExpandedStages(prev => 
            prev.includes(stageId) 
                ? prev.filter(id => id !== stageId)
                : [...prev, stageId]
        );
    };

    // Handle panel resize
    const handleResize = useCallback((e: MouseEvent) => {
        if (!isResizing) return;
        
        const newWidth = position === 'right' 
            ? window.innerWidth - e.clientX 
            : e.clientX;
        
        setWidth(Math.max(250, Math.min(600, newWidth)));
    }, [isResizing, position, setWidth]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResize);
            window.addEventListener('mouseup', () => setIsResizing(false));
        }
        return () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', () => setIsResizing(false));
        };
    }, [isResizing, handleResize]);

    // Save progress history
    useEffect(() => {
        if (!isGenerating) return;

        const history = JSON.parse(localStorage.getItem('generation-history') || '[]');
        const currentSession = {
            timestamp: Date.now(),
            stages: stages.map(stage => ({
                id: stage.id,
                name: stage.name,
                components: stage.components.map(comp => ({
                    id: comp.id,
                    name: comp.name,
                    startTime: comp.startTime,
                    endTime: comp.endTime,
                    status: comp.status,
                    error: comp.error
                }))
            }))
        };

        localStorage.setItem('generation-history', 
            JSON.stringify([currentSession, ...history.slice(0, 4)]));
    }, [stages, isGenerating]);

    return (
        <>
            <motion.div
                className={cn(
                    'fixed top-0 bottom-0 bg-white dark:bg-gray-900 border-l dark:border-gray-800 shadow-lg',
                    'flex flex-col z-50 transition-all duration-200',
                    position === 'right' ? 'right-0' : 'left-0',
                    isCollapsed ? 'w-12' : `w-[${width}px]`
                )}
                initial={false}
                animate={{ 
                    width: isCollapsed ? 48 : width,
                    x: 0 
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
                    {!isCollapsed && (
                        <h2 className="text-lg font-semibold">Generation Progress</h2>
                    )}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPosition(p => p === 'right' ? 'left' : 'right')}
                        >
                            {position === 'right' ? '⇄' : '⇄'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsCollapsed(c => !c)}
                        >
                            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
                        </Button>
                    </div>
                </div>

                {!isCollapsed && (
                    <>
                        {/* Overall Progress */}
                        <div className="p-4 border-b dark:border-gray-800">
                            <div className="mb-2 flex justify-between items-center">
                                <span className="text-sm font-medium">
                                    Overall Progress
                                </span>
                                <span className="text-sm text-gray-500">
                                    {calculateOverallProgress()}%
                                </span>
                            </div>
                            <Progress value={calculateOverallProgress()} className="h-2" />
                            {calculateTimeRemaining() !== null && (
                                <div className="mt-2 text-sm text-gray-500">
                                    Estimated time remaining: {calculateTimeRemaining()}s
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="p-4 border-b dark:border-gray-800 flex justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={isPaused ? onResume : onPause}
                                disabled={!isGenerating}
                            >
                                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setShowCancelDialog(true)}
                                disabled={!isGenerating}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Stages */}
                        <div className="flex-1 overflow-y-auto">
                            {stages.map(stage => (
                                <div key={stage.id} className="border-b dark:border-gray-800">
                                    <button
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
                                        onClick={() => toggleStage(stage.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {statusIcons[stage.status]}
                                            <span>{stage.name}</span>
                                        </div>
                                        <ChevronRight 
                                            className={cn(
                                                'w-4 h-4 transition-transform',
                                                expandedStages.includes(stage.id) && 'rotate-90'
                                            )} 
                                        />
                                    </button>
                                    
                                    <AnimatePresence>
                                        {expandedStages.includes(stage.id) && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: 'auto' }}
                                                exit={{ height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 bg-gray-50 dark:bg-gray-800">
                                                    {stage.components.map(component => (
                                                        <div 
                                                            key={component.id}
                                                            className="flex items-center justify-between py-2"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {statusIcons[component.status]}
                                                                <span className="text-sm">
                                                                    {component.name}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {component.status === 'error' && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => onRetry(stage.id, component.id)}
                                                                                >
                                                                                    <RotateCcw className="w-4 h-4" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{component.error}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                                {component.endTime && (
                                                                    <span className="text-xs text-gray-500">
                                                                        {((component.endTime - component.startTime!) / 1000).toFixed(1)}s
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Resize Handle */}
                <div
                    className={cn(
                        'absolute top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50',
                        position === 'right' ? 'left-0' : 'right-0'
                    )}
                    onMouseDown={() => setIsResizing(true)}
                />
            </motion.div>

            {/* Cancel Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Generation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel the generation process? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                            Continue Generating
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => {
                                onCancel();
                                setShowCancelDialog(false);
                            }}
                        >
                            Cancel Generation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};