import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar from 'chokidar';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

class ProjectCache {
    constructor(projectPath, cacheDir = '.cofounder-cache') {
        this.projectPath = projectPath;
        this.cacheDir = path.join(projectPath, cacheDir);
        this.cacheFilePath = path.join(this.cacheDir, 'analysis-cache.json');
        this.metadataPath = path.join(this.cacheDir, 'metadata.json');
        
        // In-memory cache for fast access
        this.cache = new Map();
        this.metadata = {
            lastFullAnalysis: null,
            totalFiles: 0,
            projectHash: null,
            version: '1.0.0'
        };
        
        // File watcher for real-time updates
        this.watcher = null;
        this.watcherCallbacks = new Set();
        
        // Track changed files
        this.changedFiles = new Set();
        this.deletedFiles = new Set();
        
        this.initialize();
    }

    async initialize() {
        try {
            // Ensure cache directory exists
            await this.ensureCacheDir();
            
            // Load existing cache
            await this.loadCache();
            
            // Initialize file watcher
            await this.initializeWatcher();
            
            console.log('ProjectCache initialized successfully');
        } catch (error) {
            console.error('Error initializing ProjectCache:', error.message);
        }
    }

    async ensureCacheDir() {
        try {
            await statAsync(this.cacheDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await mkdirAsync(this.cacheDir, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    async loadCache() {
        try {
            // Load cache data
            if (await this.fileExists(this.cacheFilePath)) {
                const cacheData = JSON.parse(await readFileAsync(this.cacheFilePath, 'utf8'));
                for (const [filePath, data] of Object.entries(cacheData)) {
                    this.cache.set(filePath, data);
                }
                console.log(`Loaded cache with ${this.cache.size} files`);
            }

            // Load metadata
            if (await this.fileExists(this.metadataPath)) {
                const metadata = JSON.parse(await readFileAsync(this.metadataPath, 'utf8'));
                this.metadata = { ...this.metadata, ...metadata };
                console.log('Loaded cache metadata');
            }
        } catch (error) {
            console.error('Error loading cache:', error.message);
            // Reset cache on error
            this.cache.clear();
            this.metadata.lastFullAnalysis = null;
        }
    }

    async saveCache() {
        try {
            // Convert Map to Object for JSON serialization
            const cacheData = {};
            for (const [filePath, data] of this.cache) {
                cacheData[filePath] = data;
            }

            // Save cache data
            await writeFileAsync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
            
            // Update and save metadata
            this.metadata.lastFullAnalysis = Date.now();
            this.metadata.totalFiles = this.cache.size;
            this.metadata.projectHash = await this.calculateProjectHash();
            await writeFileAsync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
            
            console.log(`Cache saved with ${this.cache.size} files`);
        } catch (error) {
            console.error('Error saving cache:', error.message);
        }
    }

    async fileExists(filePath) {
        try {
            await statAsync(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    async calculateProjectHash() {
        // Create a hash based on project structure and key files
        const hash = crypto.createHash('sha256');
        const keyFiles = ['package.json', 'tsconfig.json', 'package-lock.json', 'yarn.lock'];
        
        for (const keyFile of keyFiles) {
            const keyFilePath = path.join(this.projectPath, keyFile);
            if (await this.fileExists(keyFilePath)) {
                const content = await readFileAsync(keyFilePath, 'utf8');
                hash.update(content);
            }
        }
        
        return hash.digest('hex');
    }

    async initializeWatcher() {
        if (this.watcher) {
            await this.watcher.close();
        }

        // Watch for file changes in the project
        this.watcher = chokidar.watch(this.projectPath, {
            ignored: [
                /node_modules/,
                /.git/,
                /\.cofounder-cache/,
                /dist/,
                /build/,
                /\.next/,
                /coverage/
            ],
            ignoreInitial: true,
            persistent: true
        });

        this.watcher
            .on('add', (filePath) => this.handleFileChange('add', filePath))
            .on('change', (filePath) => this.handleFileChange('change', filePath))
            .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
            .on('error', (error) => console.error('File watcher error:', error));

        console.log('File watcher initialized');
    }

    handleFileChange(event, filePath) {
        const relativePath = path.relative(this.projectPath, filePath);
        const ext = path.extname(filePath);
        
        // Only track JavaScript/TypeScript files
        if (!['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
            return;
        }

        console.log(`File ${event}: ${relativePath}`);

        switch (event) {
            case 'add':
            case 'change':
                this.changedFiles.add(relativePath);
                this.deletedFiles.delete(relativePath);
                break;
            case 'unlink':
                this.changedFiles.delete(relativePath);
                this.deletedFiles.add(relativePath);
                this.cache.delete(relativePath);
                break;
        }

        // Notify watchers
        for (const callback of this.watcherCallbacks) {
            callback(event, relativePath);
        }
    }

    onFileChange(callback) {
        this.watcherCallbacks.add(callback);
        return () => this.watcherCallbacks.delete(callback);
    }

    async getFileModTime(filePath) {
        try {
            const stats = await statAsync(filePath);
            return stats.mtime.getTime();
        } catch (error) {
            return 0;
        }
    }

    async isFileCached(relativePath) {
        if (!this.cache.has(relativePath)) {
            return false;
        }

        const cachedData = this.cache.get(relativePath);
        const absolutePath = path.join(this.projectPath, relativePath);
        const currentModTime = await this.getFileModTime(absolutePath);
        
        return cachedData.modTime >= currentModTime;
    }

    async cacheFileAnalysis(relativePath, analysisData) {
        const absolutePath = path.join(this.projectPath, relativePath);
        const modTime = await this.getFileModTime(absolutePath);
        
        const cacheEntry = {
            ...analysisData,
            modTime,
            cachedAt: Date.now()
        };
        
        this.cache.set(relativePath, cacheEntry);
        this.changedFiles.delete(relativePath);
    }

    getCachedAnalysis(relativePath) {
        return this.cache.get(relativePath);
    }

    async getFilesToAnalyze() {
        const filesToAnalyze = {
            new: [],
            changed: [],
            cached: []
        };

        // Get all JS/TS files in project
        const allFiles = await this.getAllProjectFiles();
        
        for (const filePath of allFiles) {
            const isChanged = this.changedFiles.has(filePath);
            const isCached = await this.isFileCached(filePath);
            
            if (isChanged || !isCached) {
                if (this.cache.has(filePath)) {
                    filesToAnalyze.changed.push(filePath);
                } else {
                    filesToAnalyze.new.push(filePath);
                }
            } else {
                filesToAnalyze.cached.push(filePath);
            }
        }

        return filesToAnalyze;
    }

    async getAllProjectFiles() {
        const files = [];
        
        const walkDir = async (dir) => {
            const entries = await fs.promises.readdir(dir);
            
            for (const entry of entries) {
                // Skip ignored directories
                if (['node_modules', '.git', '.cofounder-cache', 'dist', 'build', '.next', 'coverage'].includes(entry)) {
                    continue;
                }
                
                const fullPath = path.join(dir, entry);
                const stat = await statAsync(fullPath);
                
                if (stat.isDirectory()) {
                    await walkDir(fullPath);
                } else if (stat.isFile()) {
                    const ext = path.extname(entry);
                    if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
                        const relativePath = path.relative(this.projectPath, fullPath);
                        files.push(relativePath);
                    }
                }
            }
        };
        
        await walkDir(this.projectPath);
        return files;
    }

    async clearStaleEntries() {
        const existingFiles = await this.getAllProjectFiles();
        const existingSet = new Set(existingFiles);
        
        let removedCount = 0;
        for (const [filePath] of this.cache) {
            if (!existingSet.has(filePath)) {
                this.cache.delete(filePath);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} stale cache entries`);
        }
    }

    getStats() {
        return {
            totalCached: this.cache.size,
            changedFiles: this.changedFiles.size,
            deletedFiles: this.deletedFiles.size,
            lastFullAnalysis: this.metadata.lastFullAnalysis,
            projectHash: this.metadata.projectHash
        };
    }

    async needsFullAnalysis() {
        // Check if we need a full analysis
        const currentProjectHash = await this.calculateProjectHash();
        
        return (
            !this.metadata.lastFullAnalysis ||
            this.metadata.projectHash !== currentProjectHash ||
            this.cache.size === 0
        );
    }

    async close() {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
        this.watcherCallbacks.clear();
    }

    async reset() {
        await this.close();
        this.cache.clear();
        this.changedFiles.clear();
        this.deletedFiles.clear();
        this.metadata.lastFullAnalysis = null;
        
        // Remove cache files
        try {
            if (await this.fileExists(this.cacheFilePath)) {
                await fs.promises.unlink(this.cacheFilePath);
            }
            if (await this.fileExists(this.metadataPath)) {
                await fs.promises.unlink(this.metadataPath);
            }
            console.log('Cache reset successfully');
        } catch (error) {
            console.error('Error resetting cache:', error.message);
        }
    }
}

export { ProjectCache };