import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCode, FolderOpen, Settings, Package } from 'lucide-react';

interface DepthSliderProps {
    currentDepth: number;
    maxDepth: number;
    depthCounts: Record<number, number>;
    visibleNodeCount: number;
    totalNodeCount: number;
    onDepthChange: (depth: number) => void;
}

const DepthSlider: React.FC<DepthSliderProps> = ({
    currentDepth,
    maxDepth,
    depthCounts,
    visibleNodeCount,
    totalNodeCount,
    onDepthChange
}) => {
    const depthLabels = [
        { icon: Settings, label: "Specs & Docs", color: "bg-purple-500" },
        { icon: Package, label: "Core Files", color: "bg-blue-500" },
        { icon: FolderOpen, label: "Feature Modules", color: "bg-green-500" },
        { icon: FileCode, label: "Utilities", color: "bg-yellow-500" },
        { icon: FileCode, label: "Implementation", color: "bg-gray-500" }
    ];

    const handleSliderChange = (value: number[]) => {
        onDepthChange(value[0]);
    };

    const getDepthDescription = (depth: number): string => {
        const descriptions = [
            "High-level specifications and documentation",
            "Core entry points and main files", 
            "Feature modules, components, and routes",
            "Utility functions and helper modules",
            "Deep implementation details and individual files"
        ];
        return descriptions[Math.min(depth, descriptions.length - 1)];
    };

    return (
        <Card className="absolute top-4 right-4 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg z-40">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Tree Depth Control
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Depth Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>Level 0</span>
                        <span>Level {maxDepth}</span>
                    </div>
                    <Slider
                        value={[currentDepth]}
                        min={0}
                        max={maxDepth}
                        step={1}
                        onValueChange={handleSliderChange}
                        className="w-full"
                    />
                </div>

                {/* Current Level Info */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {React.createElement(depthLabels[Math.min(currentDepth, depthLabels.length - 1)]?.icon || FileCode, {
                            className: "h-4 w-4"
                        })}
                        <span className="font-medium text-sm">
                            {depthLabels[Math.min(currentDepth, depthLabels.length - 1)]?.label || "Deep Files"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                            Level {currentDepth}
                        </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        {getDepthDescription(currentDepth)}
                    </p>
                </div>

                {/* Node Count Stats */}
                <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Showing</span>
                        <span className="font-medium">
                            {visibleNodeCount} of {totalNodeCount} files
                        </span>
                    </div>
                    
                    {/* Depth Distribution */}
                    <div className="mt-2 space-y-1">
                        {Object.entries(depthCounts)
                            .filter(([depth]) => parseInt(depth) <= currentDepth)
                            .map(([depth, count]) => {
                                const depthNum = parseInt(depth);
                                const IconComponent = depthLabels[Math.min(depthNum, depthLabels.length - 1)]?.icon || FileCode;
                                const color = depthLabels[Math.min(depthNum, depthLabels.length - 1)]?.color || "bg-gray-500";
                                
                                return (
                                    <div key={depth} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${color}`} />
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Level {depth}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {count}
                                        </Badge>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Performance Hint */}
                {totalNodeCount > 100 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                        💡 Use lower levels for better performance with large projects
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DepthSlider;