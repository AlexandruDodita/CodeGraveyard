export class TileMap {
    constructor(cols, rows, tileSize) {
        this.cols = cols;
        this.rows = rows;
        this.tileSize = tileSize;
        
        // Create a 2D grid to track occupied tiles
        this.grid = Array(rows).fill().map(() => Array(cols).fill(false));
        
        // Create tile patterns for visual variety
        this.tilePatterns = [];
        this.initializeTilePatterns();
        
        // Randomly assign patterns to each tile for visual variety
        this.tileVariations = Array(rows).fill().map(() => Array(cols).fill(0));
        this.randomizeTileVariations();
        
        // Create a static background canvas
        this.createStaticBackground();
    }
    
    initializeTilePatterns() {
        // Define base tile colors
        const baseColor = '#3d3d29'; // Dark soil
        
        // Create patterns for an abandoned battlefield
        this.tilePatterns = [
            { // Base soil with no features
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: false,
                hasDebris: false,
                hasCrater: false,
                hasBurnMark: false
            },
            { // Soil with sparse dead grass
                baseColor: baseColor,
                hasGrass: true,
                hasMoss: false,
                hasCracks: false,
                hasDebris: false,
                hasCrater: false,
                hasBurnMark: false
            },
            { // Soil with cracks
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: true,
                hasDebris: false,
                hasCrater: false,
                hasBurnMark: false
            },
            { // Soil with debris
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: false,
                hasDebris: true,
                hasCrater: false,
                hasBurnMark: false
            },
            { // Soil with small crater
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: false,
                hasDebris: false,
                hasCrater: true,
                hasBurnMark: false
            },
            { // Soil with burn mark
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: false,
                hasDebris: false,
                hasCrater: false,
                hasBurnMark: true
            },
            { // Soil with mixed features (cracks and debris)
                baseColor: baseColor,
                hasGrass: false,
                hasMoss: false,
                hasCracks: true,
                hasDebris: true,
                hasCrater: false,
                hasBurnMark: false
            }
        ];
    }
    
    randomizeTileVariations() {
        // Assign random pattern index to each tile
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // Weighted randomization to fit abandoned battlefield look
                const rand = Math.random();
                if (rand < 0.25) { // 25% chance of plain dirt
                    this.tileVariations[y][x] = 0;
                } else if (rand < 0.35) { // 10% chance of dead grass
                    this.tileVariations[y][x] = 1;
                } else if (rand < 0.55) { // 20% chance of cracks
                    this.tileVariations[y][x] = 2;
                } else if (rand < 0.75) { // 20% chance of debris
                    this.tileVariations[y][x] = 3;
                } else if (rand < 0.85) { // 10% chance of craters
                    this.tileVariations[y][x] = 4;
                } else if (rand < 0.95) { // 10% chance of burn marks
                    this.tileVariations[y][x] = 5;
                } else { // 5% chance of mixed features
                    this.tileVariations[y][x] = 6;
                }
            }
        }
    }
    
    // Create the static background once
    createStaticBackground() {
        // Create an offscreen canvas for the static background
        const mapWidth = this.cols * this.tileSize;
        const mapHeight = this.rows * this.tileSize;
        
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = mapWidth;
        this.backgroundCanvas.height = mapHeight;
        const bgCtx = this.backgroundCanvas.getContext('2d');
        
        // Draw background first (entire map area)
        bgCtx.fillStyle = '#2d2d1a'; // Darker overall background
        bgCtx.fillRect(0, 0, mapWidth, mapHeight);
        
        // Draw individual tiles with their patterns
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.drawTile(bgCtx, x, y);
            }
        }
        
        // Draw grid lines
        bgCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        bgCtx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= this.cols; x++) {
            bgCtx.beginPath();
            bgCtx.moveTo(x * this.tileSize, 0);
            bgCtx.lineTo(x * this.tileSize, this.rows * this.tileSize);
            bgCtx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.rows; y++) {
            bgCtx.beginPath();
            bgCtx.moveTo(0, y * this.tileSize);
            bgCtx.lineTo(this.cols * this.tileSize, y * this.tileSize);
            bgCtx.stroke();
        }
    }
    
    draw(ctx) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const mapWidth = this.cols * this.tileSize;
        const mapHeight = this.rows * this.tileSize;
        
        // Ensure offset is calculated correctly
        const offsetX = Math.floor((canvasWidth - mapWidth) / 2);
        const offsetY = Math.floor((canvasHeight - mapHeight) / 2);
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw the static background image
        ctx.drawImage(this.backgroundCanvas, 0, 0);
        
        // Draw occupied tiles with a light background (this needs to be dynamic)
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x]) {
                    ctx.fillRect(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }
        
        ctx.restore();
    }
    
    drawTile(ctx, x, y) {
        const tileX = x * this.tileSize;
        const tileY = y * this.tileSize;
        const pattern = this.tilePatterns[this.tileVariations[y][x]];
        
        // Draw base tile
        ctx.fillStyle = pattern.baseColor;
        ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
        
        // Add subtle texture variation
        ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + Math.random() * 0.05})`;
        ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
        
        // Dead/sparse grass tuft
        if (pattern.hasGrass) {
            const centerX = tileX + this.tileSize * 0.5;
            const bottomY = tileY + this.tileSize * 0.9;
            const bladeH = this.tileSize * 0.2;
            ctx.strokeStyle = '#5e5a3c'; // Yellowish-brown for dead grass
            ctx.lineWidth = 1;
            // Center blade
            ctx.beginPath();
            ctx.moveTo(centerX, bottomY);
            ctx.lineTo(centerX, bottomY - bladeH);
            ctx.stroke();
            // Left blade
            ctx.beginPath();
            ctx.moveTo(centerX - 3, bottomY);
            ctx.lineTo(centerX - 4, bottomY - bladeH * 0.7);
            ctx.stroke();
            // Right blade
            ctx.beginPath();
            ctx.moveTo(centerX + 3, bottomY);
            ctx.lineTo(centerX + 4, bottomY - bladeH * 0.7);
            ctx.stroke();
        }
        
        // Cracks in ground
        if (pattern.hasCracks) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            // Main crack
            ctx.beginPath();
            const startX = tileX + this.tileSize * (0.3 + Math.random() * 0.2);
            const startY = tileY + this.tileSize * (0.2 + Math.random() * 0.2);
            const endX = tileX + this.tileSize * (0.6 + Math.random() * 0.3);
            const endY = tileY + this.tileSize * (0.7 + Math.random() * 0.2);
            ctx.moveTo(startX, startY);
            
            // Add some branching
            const midX = (startX + endX) / 2 + (Math.random() * 4 - 2);
            const midY = (startY + endY) / 2 + (Math.random() * 4 - 2);
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Add branching crack
            if (Math.random() > 0.5) {
                ctx.beginPath();
                ctx.moveTo(midX, midY);
                ctx.lineTo(midX + (Math.random() * 10 - 5), midY + (Math.random() * 10 - 5));
                ctx.stroke();
            }
        }
        
        // Debris (small rocks and rubble)
        if (pattern.hasDebris) {
            // Draw 2-4 small pieces of debris
            const debrisCount = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < debrisCount; i++) {
                const debrisX = tileX + this.tileSize * Math.random();
                const debrisY = tileY + this.tileSize * Math.random();
                const debrisSize = this.tileSize * (0.03 + Math.random() * 0.08);
                
                // Random debris coloring
                const grayValue = 100 + Math.floor(Math.random() * 70);
                ctx.fillStyle = `rgb(${grayValue}, ${grayValue-10}, ${grayValue-20})`;
                
                // Draw irregular shapes for debris
                ctx.beginPath();
                if (Math.random() > 0.5) {
                    // Irregular circle
                    ctx.arc(debrisX, debrisY, debrisSize, 0, Math.PI * 2);
                } else {
                    // Irregular polygon
                    ctx.moveTo(debrisX, debrisY - debrisSize);
                    ctx.lineTo(debrisX + debrisSize, debrisY);
                    ctx.lineTo(debrisX, debrisY + debrisSize);
                    ctx.lineTo(debrisX - debrisSize, debrisY);
                }
                ctx.fill();
            }
        }
        
        // Crater
        if (pattern.hasCrater) {
            const craterX = tileX + this.tileSize / 2;
            const craterY = tileY + this.tileSize / 2;
            const craterSize = this.tileSize * 0.3;
            
            // Draw crater shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(craterX, craterY, craterSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw crater inner area (slightly lighter)
            ctx.fillStyle = 'rgba(50, 50, 45, 0.7)';
            ctx.beginPath();
            ctx.arc(craterX, craterY, craterSize * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Burn mark
        if (pattern.hasBurnMark) {
            const burnX = tileX + this.tileSize * (0.3 + Math.random() * 0.4);
            const burnY = tileY + this.tileSize * (0.3 + Math.random() * 0.4);
            const burnSize = this.tileSize * (0.2 + Math.random() * 0.1);
            
            // Create gradient for burn mark
            const gradient = ctx.createRadialGradient(
                burnX, burnY, 0,
                burnX, burnY, burnSize
            );
            gradient.addColorStop(0, 'rgba(20, 20, 20, 0.8)');
            gradient.addColorStop(0.7, 'rgba(40, 30, 20, 0.4)');
            gradient.addColorStop(1, 'rgba(50, 40, 30, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(burnX, burnY, burnSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Check if a tile is occupied
    isTileOccupied(x, y) {
        // Check bounds
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
            return true; // Consider out-of-bounds as occupied
        }
        
        return this.grid[y][x];
    }
    
    // Check if a rectangle of tiles is free for placement
    canPlaceDefense(x, y, width, height) {
        // Check all tiles in the rectangle
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (this.isTileOccupied(x + dx, y + dy)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Mark a tile as occupied or free
    setTileOccupied(x, y, isOccupied) {
        // Check bounds
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
            return;
        }
        
        this.grid[y][x] = isOccupied;
    }
    
    // Mark a rectangle of tiles as occupied or free
    setRectangleOccupied(x, y, width, height, isOccupied) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                this.setTileOccupied(x + dx, y + dy, isOccupied);
            }
        }
    }
    
    // Convert screen coordinates to grid coordinates
    screenToGrid(screenX, screenY) {
        // Calculate the center of the canvas
        const canvasWidth = document.getElementById('game-canvas').width;
        const canvasHeight = document.getElementById('game-canvas').height;
        const mapWidth = this.cols * this.tileSize;
        const mapHeight = this.rows * this.tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Adjust for the offset
        const adjustedX = screenX - offsetX;
        const adjustedY = screenY - offsetY;
        
        // Convert to grid coordinates
        const gridX = Math.floor(adjustedX / this.tileSize);
        const gridY = Math.floor(adjustedY / this.tileSize);
        
        return { x: gridX, y: gridY };
    }
    
    // Convert grid coordinates to screen coordinates (center of tile)
    gridToScreen(gridX, gridY) {
        // Calculate the center of the canvas
        const canvasWidth = document.getElementById('game-canvas').width;
        const canvasHeight = document.getElementById('game-canvas').height;
        const mapWidth = this.cols * this.tileSize;
        const mapHeight = this.rows * this.tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Convert to screen coordinates (center of tile)
        const screenX = offsetX + (gridX * this.tileSize) + (this.tileSize / 2);
        const screenY = offsetY + (gridY * this.tileSize) + (this.tileSize / 2);
        
        return { x: screenX, y: screenY };
    }
    
    // Find an unoccupied tile along the edge of the map
    findUnoccupiedEdgeTile() {
        const edgeTiles = [];
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);
        
        // Get map dimensions
        const mapWidth = this.cols;
        const mapHeight = this.rows;
        
        // Define corners of the map with a buffer zone
        const cornerBuffer = Math.min(5, Math.floor(Math.min(mapWidth, mapHeight) * 0.1));
        
        // Potentially spawn points - evenly distributed points along the perimeter
        // Skip corners and use strategic positions
        
        // Define how many spawn points to consider per edge
        const spawnPointsPerEdge = Math.max(3, Math.min(8, Math.floor(Math.max(mapWidth, mapHeight) * 0.1)));
        
        // Top edge (excluding corners)
        for (let i = 1; i <= spawnPointsPerEdge; i++) {
            const x = Math.floor(cornerBuffer + (mapWidth - 2 * cornerBuffer) * (i / (spawnPointsPerEdge + 1)));
            const y = 0;
            if (!this.isTileOccupied(x, y)) {
                // Calculate actual distance to center (not just geometric) for priority
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                edgeTiles.push({ x, y, distance });
            }
        }
        
        // Bottom edge (excluding corners)
        for (let i = 1; i <= spawnPointsPerEdge; i++) {
            const x = Math.floor(cornerBuffer + (mapWidth - 2 * cornerBuffer) * (i / (spawnPointsPerEdge + 1)));
            const y = mapHeight - 1;
            if (!this.isTileOccupied(x, y)) {
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                edgeTiles.push({ x, y, distance });
            }
        }
        
        // Left edge (excluding corners)
        for (let i = 1; i <= spawnPointsPerEdge; i++) {
            const x = 0;
            const y = Math.floor(cornerBuffer + (mapHeight - 2 * cornerBuffer) * (i / (spawnPointsPerEdge + 1)));
            if (!this.isTileOccupied(x, y)) {
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                edgeTiles.push({ x, y, distance });
            }
        }
        
        // Right edge (excluding corners)
        for (let i = 1; i <= spawnPointsPerEdge; i++) {
            const x = mapWidth - 1;
            const y = Math.floor(cornerBuffer + (mapHeight - 2 * cornerBuffer) * (i / (spawnPointsPerEdge + 1)));
            if (!this.isTileOccupied(x, y)) {
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                edgeTiles.push({ x, y, distance });
            }
        }
        
        // No spawn points found? Fall back to any open edge tile
        if (edgeTiles.length === 0) {
            // Check every edge tile as fallback
            for (let x = 0; x < this.cols; x++) {
                if (!this.isTileOccupied(x, 0)) {
                    edgeTiles.push({ x, y: 0, distance: 999 });
                }
                if (!this.isTileOccupied(x, this.rows - 1)) {
                    edgeTiles.push({ x, y: this.rows - 1, distance: 999 });
                }
            }
            
        for (let y = 1; y < this.rows - 1; y++) {
            if (!this.isTileOccupied(0, y)) {
                    edgeTiles.push({ x: 0, y, distance: 999 });
            }
            if (!this.isTileOccupied(this.cols - 1, y)) {
                    edgeTiles.push({ x: this.cols - 1, y, distance: 999 });
                }
            }
        }
        
        if (edgeTiles.length === 0) {
            return null;
        }
        
        // Sort by distance (ascending) to get closer spawn points more often
        edgeTiles.sort((a, b) => a.distance - b.distance);
        
        // Bias towards closer points but with some randomness
        // Take the closest 60% of positions and randomly select from those
        const cutoffIndex = Math.max(0, Math.floor(edgeTiles.length * 0.6) - 1);
        const closerEdgeTiles = edgeTiles.slice(0, cutoffIndex + 1);
        
        // Return a random tile from the closer ones
        return closerEdgeTiles[Math.floor(Math.random() * closerEdgeTiles.length)];
    }
} 