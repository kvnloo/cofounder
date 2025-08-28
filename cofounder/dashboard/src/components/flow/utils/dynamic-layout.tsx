interface CanvasSize {
    width: number;
    height: number;
}

interface DynamicMetrics {
    PADDING_X: number;
    PADDING_Y: number;
    DIST_X: number;
    DIST_Y: number;
}

interface LayoutOptions {
    canvasSize: CanvasSize;
    nodeCount: number;
    depthLevel: number;
    maxDepth: number;
}

export class DynamicLayoutCalculator {
    private canvasSize: CanvasSize;
    private nodeCount: number;
    private depthLevel: number;
    private maxDepth: number;

    constructor(options: LayoutOptions) {
        this.canvasSize = options.canvasSize;
        this.nodeCount = options.nodeCount;
        this.depthLevel = options.depthLevel;
        this.maxDepth = options.maxDepth;
    }

    calculateDynamicMetrics(): DynamicMetrics {
        // Base spacing that adapts to canvas size and node count
        const baseSpacing = this.calculateBaseSpacing();
        
        // Depth multiplier - show fewer levels when there are many nodes
        const depthMultiplier = this.calculateDepthMultiplier();
        
        // Calculate responsive padding
        const PADDING_X = Math.max(20, baseSpacing.x * depthMultiplier);
        const PADDING_Y = Math.max(15, baseSpacing.y * depthMultiplier);
        
        // Distance is padding * factor
        const DIST_X = PADDING_X * 2;
        const DIST_Y = PADDING_Y * 2.5;

        return {
            PADDING_X,
            PADDING_Y,
            DIST_X,
            DIST_Y
        };
    }

    private calculateBaseSpacing(): { x: number; y: number } {
        // Estimate optimal grid size based on node count
        const nodesPerRow = Math.ceil(Math.sqrt(this.nodeCount));
        const nodesPerCol = Math.ceil(this.nodeCount / nodesPerRow);
        
        // Calculate spacing to fit nodes in canvas with some margin
        const margin = 0.1; // 10% margin on each side
        const usableWidth = this.canvasSize.width * (1 - 2 * margin);
        const usableHeight = this.canvasSize.height * (1 - 2 * margin);
        
        // Base spacing assuming equal distribution
        const baseX = Math.max(50, usableWidth / nodesPerRow);
        const baseY = Math.max(40, usableHeight / nodesPerCol);
        
        return { x: baseX, y: baseY };
    }

    private calculateDepthMultiplier(): number {
        // Less spacing when showing more depth levels or more nodes
        const depthFactor = Math.max(0.3, (this.maxDepth - this.depthLevel + 1) / this.maxDepth);
        const nodeFactor = Math.max(0.4, 1 - Math.log10(this.nodeCount) / 3);
        
        return depthFactor * nodeFactor;
    }

    // Calculate position for individual nodes
    calculateNodePosition(index: number, gridOptions?: { columns?: number }): { x: number; y: number } {
        const metrics = this.calculateDynamicMetrics();
        const columns = gridOptions?.columns || Math.ceil(Math.sqrt(this.nodeCount));
        
        const row = Math.floor(index / columns);
        const col = index % columns;
        
        return {
            x: col * metrics.DIST_X,
            y: row * metrics.DIST_Y
        };
    }

    // Get filtered nodes by depth level
    static filterNodesByDepth(nodes: any[], maxDepth: number): any[] {
        return nodes.filter(node => {
            // Extract depth from node data if available
            const depth = node.data?.meta?.depth || 
                         (node.id.startsWith('file.') ? 4 : 1); // Files are deeper by default
            return depth <= maxDepth;
        });
    }

    // Analyze node depths for slider configuration
    static analyzeNodeDepths(nodes: any[]): { maxDepth: number; depthCounts: Record<number, number> } {
        const depthCounts: Record<number, number> = {};
        let maxDepth = 0;

        nodes.forEach(node => {
            let depth = 1; // Default depth
            
            // Determine depth based on node type and ID
            if (node.id.startsWith('pm.details') || node.id.includes('README')) {
                depth = 0; // High-level specs
            } else if (node.id.startsWith('pm.') || node.id === 'server.js' || node.id === 'package.json') {
                depth = 1; // Core files
            } else if (node.id.includes('components') || node.id.includes('routes') || node.id.includes('models')) {
                depth = 2; // Feature modules  
            } else if (node.id.includes('utils') || node.id.includes('helpers')) {
                depth = 3; // Utilities
            } else if (node.id.startsWith('file.')) {
                depth = 4; // Individual files
            }
            
            depthCounts[depth] = (depthCounts[depth] || 0) + 1;
            maxDepth = Math.max(maxDepth, depth);
        });

        return { maxDepth, depthCounts };
    }
}

export default DynamicLayoutCalculator;