import { TileMap } from './tilemap.js';
import { MainTower, CannonTower, SniperTower, Wall } from './defenses.js';
import { Zombie, Runner, Tank, Boss } from './enemies.js';
import { Spawner } from './spawner.js';
import { UIManager } from './ui.js';
import { AudioManager } from './audio.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;
        this.gameState = 'start'; // start, playing, game-over
        
        // Game state
        this.gold = 100;
        this.waveNumber = 1;
        this.score = 0;
        
        // Selection state
        this.selectedDefense = null;
        this.isPlacingDefense = false;
        this.defenseToPlace = null;
        
        // Game entities
        this.tileMap = null;
        this.towers = [];
        this.walls = [];
        this.enemies = [];
        this.mainTower = null;
        this.spawner = null;
        
        // Audio manager
        this.audio = new AudioManager();
        
        // UI Manager
        this.ui = new UIManager(this);
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.skipWaveTimer = this.skipWaveTimer.bind(this);
        
        // Event listeners
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        
        // Fix tower placement by adding this property to track grid coordinates consistently
        this.hoveredGridCoords = { x: 0, y: 0 };
        
        // Initialize game
        this.init();
    }
    
    init() {
        this.handleResize(); // Set initial canvas size
        
        // Create tile map (30x20 grid with 40px tiles)
        this.tileMap = new TileMap(70, 60, 30);
        
        // Show start menu
        this.ui.showScene('start');
        
        // Start game loop
        requestAnimationFrame(this.gameLoop);
    }
    
    setGameState(state) {
        this.gameState = state;
        
        if (state === 'playing') {
            this.reset();
            document.getElementById('game-ui').classList.remove('hidden');
        } else if (state === 'start' || state === 'game-over') {
            document.getElementById('game-ui').classList.add('hidden');
            if (state === 'game-over') {
                this.audio.playSound('gameOver');
            }
        }
        
        // Start background music when game starts or in main menu (if not muted)
        if (state === 'playing' || state === 'start') {
            this.audio.startMusic();
        }
    }
    
    reset() {
        // Reset game state
        this.gold = 100;
        this.waveNumber = 1;
        this.score = 0;
        this.selectedDefense = null;
        this.isPlacingDefense = false;
        this.defenseToPlace = null;
        
        // Clear entities (except tilemap)
        this.towers = [];
        this.walls = [];
        this.enemies = [];
        
        // Clear occupied state on tilemap
        for(let y = 0; y < this.tileMap.rows; y++) {
            for(let x = 0; x < this.tileMap.cols; x++) {
                this.tileMap.setTileOccupied(x, y, false);
            }
        }

        // Properly center the main tower in the map
        const centerX = Math.floor(this.tileMap.cols / 2) -1;
        const centerY = Math.floor(this.tileMap.rows / 2) -1;
        this.mainTower = new MainTower(centerX, centerY);
        this.mainTower.game = this; // Add reference to game
        this.tileMap.setRectangleOccupied(centerX, centerY, this.mainTower.width, this.mainTower.height, true);
        
        // If we have a spawner, reset it; otherwise create a new one
        if (this.spawner) {
            this.spawner.reset();
        } else {
            this.spawner = new Spawner(this.tileMap, this);
        }
        
        // Connect spawner to skipWaveTimer method
        this.spawner.setSkipTimerCallback(this.skipWaveTimer);
        
        // Hide any open UI dialogs
        document.getElementById('sell-upgrade-dialog').classList.add('hidden');
        
        // Update UI
        this.updateUI();
    }
    
    gameLoop(timestamp) {
        // Calculate delta time
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background (tileMap)
        this.tileMap.draw(this.ctx);
        
        // Skip updates if not in 'playing' state
        if (this.gameState !== 'playing') {
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        // Calculate offset for centering the map on the canvas
        const offsetX = (this.canvas.width - this.tileMap.cols * this.tileMap.tileSize) / 2;
        const offsetY = (this.canvas.height - this.tileMap.rows * this.tileMap.tileSize) / 2;
        
        // Update and draw defenses (mainTower, towers, walls)
        
        // Main tower
        if (this.mainTower) {
            this.mainTower.update(deltaTime, this.enemies);
            this.mainTower.draw(this.ctx, this.tileMap.tileSize);
        }
        
        // Towers
        for (let i = this.towers.length - 1; i >= 0; i--) {
            this.towers[i].update(deltaTime, this.enemies);
            this.towers[i].draw(this.ctx, this.tileMap.tileSize);
        }
        
        // Walls
        for (let i = this.walls.length - 1; i >= 0; i--) {
            this.walls[i].update(deltaTime);
            this.walls[i].draw(this.ctx, this.tileMap.tileSize);
        }
        
        // Update and draw enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Update enemy and check if it's dealing damage
            const isDealingDamage = enemy.update(deltaTime, this.mainTower, this.tileMap);
            
            // Draw the enemy
            enemy.draw(this.ctx, this.tileMap.tileSize);
            
            // Handle enemy death
            if (enemy.health <= 0) {
                // Grant gold and score based on enemy type
                this.gold += enemy.goldValue;
                this.score += enemy.goldValue;
                
                // Remove the enemy
                this.enemies.splice(i, 1);
                
                // Update UI
                this.updateUI();
                
                continue;
            }
            
            // Handle enemy dealing damage
            if (isDealingDamage) {
                // Find the defense being attacked
                const targetDefense = enemy.findNearestTower();
                
                if (targetDefense) {
                    // Apply damage to the target defense
                    const isDestroyed = targetDefense.takeDamage(enemy.damage);
                    
                    // Check if the defense was the main tower and it was destroyed
                    if (targetDefense === this.mainTower && isDestroyed) {
                        this.gameOver();
                        return;
                    }
                }
            }
        }
        
        // Update the spawner
        if (this.spawner) {
            this.spawner.update(deltaTime, this.waveNumber, this.enemies);
            
            // Check if spawner incremented the wave number
            if (this.spawner.waveNumber > this.waveNumber) {
                this.waveNumber = this.spawner.waveNumber;
                this.updateUI();
            }
        }
        
        // Draw defense placement preview
        if (this.isPlacingDefense && this.hoveredGridCoords) {
            const defenseSize = this.getDefenseSize(this.defenseToPlace);
            const isValidPlacement = this.tileMap.canPlaceDefense(
                this.hoveredGridCoords.x,
                this.hoveredGridCoords.y,
                defenseSize.width,
                defenseSize.height
            );
            
            // Draw placement preview rectangle
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = isValidPlacement ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.fillRect(
                offsetX + this.hoveredGridCoords.x * this.tileMap.tileSize,
                offsetY + this.hoveredGridCoords.y * this.tileMap.tileSize,
                defenseSize.width * this.tileMap.tileSize,
                defenseSize.height * this.tileMap.tileSize
            );
            this.ctx.globalAlpha = 1.0;
        }
        
        // Continue the game loop
        requestAnimationFrame(this.gameLoop);
    }
    
    handleResize() {
        // Get the canvas element
        const canvas = document.getElementById('game-canvas');
        
        // Update canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Update wave timer UI position if spawner exists
        if (this.spawner) {
            this.spawner.updateWaveTimerUIPosition();
        }
    }
    
    handleClick(event) {
        // If not playing, ignore clicks
        if (this.gameState !== 'playing') {
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Convert to grid coordinates
        const gridPos = this.tileMap.screenToGrid(clickX, clickY);
        const gridX = gridPos.x;
        const gridY = gridPos.y;
        
        // Check if coordinates are valid
        if (gridX < 0 || gridX >= this.tileMap.cols || gridY < 0 || gridY >= this.tileMap.rows) {
            return;
        }
        
        if (this.isPlacingDefense) {
            this.placeDefense(gridX, gridY);
        } else {
            // Select defense for upgrading/selling
            this.selectDefenseAt(gridX, gridY);
        }
    }
    
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Convert to grid coordinates
        const gridPos = this.tileMap.screenToGrid(mouseX, mouseY);
        const gridX = gridPos.x;
        const gridY = gridPos.y;
        
        // Check if coordinates are valid
        if (gridX >= 0 && gridX < this.tileMap.cols && gridY >= 0 && gridY < this.tileMap.rows) {
            this.hoveredGridCoords = { x: gridX, y: gridY };
        } else {
            this.hoveredGridCoords = null;
        }
    }
    
    placeDefense(x, y) {
        // Get defense dimensions
        let width = 1;
        let height = 1;
        let defense = null;
        let cost = 0;
        
        if (this.defenseToPlace === 'cannon') {
            width = 2;
            height = 2;
            cost = 50;
        } else if (this.defenseToPlace === 'sniper') {
            width = 2;
            height = 2;
            cost = 75;
        } else if (this.defenseToPlace === 'wall') {
            width = 1;
            height = 1;
            cost = 10;
        }
        
        // Check if placement is valid
        if (!this.tileMap.canPlaceDefense(x, y, width, height)) {
            console.log('Cannot place defense here');
            return;
        }
        
        // Check if enough gold
        if (this.gold < cost) {
            console.log('Not enough gold');
            return;
        }
        
        // Create defense based on type
        if (this.defenseToPlace === 'cannon') {
            defense = new CannonTower(x, y);
            defense.game = this; // Add reference to game
            this.towers.push(defense);
        } else if (this.defenseToPlace === 'sniper') {
            defense = new SniperTower(x, y);
            defense.game = this; // Add reference to game
            this.towers.push(defense);
        } else if (this.defenseToPlace === 'wall') {
            defense = new Wall(x, y);
            defense.game = this; // Add reference to game
            this.walls.push(defense);
        }
        
        if (defense) {
            // Update gold and mark tiles as occupied
            this.gold -= cost;
            this.tileMap.setRectangleOccupied(x, y, width, height, true);
            this.updateUI();
            
            // Reset placement mode
            this.isPlacingDefense = false;
            this.defenseToPlace = null;
        }
    }
    
    selectDefenseAt(x, y) {
        // Check main tower
        if (this.mainTower) {
            const mtX = this.mainTower.gridX;
            const mtY = this.mainTower.gridY;
            const mtWidth = this.mainTower.width;
            const mtHeight = this.mainTower.height;
            
            if (x >= mtX && x < mtX + mtWidth && y >= mtY && y < mtY + mtHeight) {
                this.ui.showSellUpgradeDialog(this.mainTower);
                return;
            }
        }
        
        // Check towers
        for (const tower of this.towers) {
            const tX = tower.gridX;
            const tY = tower.gridY;
            const tWidth = tower.width;
            const tHeight = tower.height;
            
            if (x >= tX && x < tX + tWidth && y >= tY && y < tY + tHeight) {
                this.ui.showSellUpgradeDialog(tower);
                return;
            }
        }
        
        // Check walls
        for (const wall of this.walls) {
            if (wall.gridX === x && wall.gridY === y) {
                this.ui.showSellUpgradeDialog(wall);
                return;
            }
        }
        
        // No defense selected
        this.selectedDefense = null;
    }
    
    removeDefense(defense) {
        // Check if it's the main tower (can't remove)
        if (defense === this.mainTower) {
            console.log("Can't remove main tower");
            return;
        }
        
        // Free up tiles
        this.tileMap.setRectangleOccupied(
            defense.gridX,
            defense.gridY,
            defense.width,
            defense.height,
            false
        );
        
        // Remove from appropriate array
        if (defense instanceof Wall) {
            const index = this.walls.indexOf(defense);
            if (index !== -1) {
                this.walls.splice(index, 1);
            }
        } else {
            const index = this.towers.indexOf(defense);
            if (index !== -1) {
                this.towers.splice(index, 1);
            }
        }
    }
    
    setDefenseToPlace(type) {
        this.isPlacingDefense = true;
        this.defenseToPlace = type;
        this.selectedDefense = null;
    }
    
    skipWaveTimer() {
        if (this.spawner) {
            this.spawner.skipTimer();
        }
    }
    
    updateUI() {
        document.getElementById('wave-counter').textContent = this.waveNumber;
        document.getElementById('gold-counter').textContent = this.gold;
    }
    
    gameOver() {
        this.gameState = 'game-over';
        
        // Just clear enemies but keep other game state
        // Do not destroy any objects as they'll be properly reset when restarting
        this.enemies = [];
        
        // Play game over sound
        this.audio.playSound('gameOver');
        
        // Update UI with final score
        this.ui.showGameOver(this.score);
    }
    
    // Add a helper method to get defense dimensions
    getDefenseSize(defenseType) {
        switch (defenseType) {
            case 'cannon':
            case 'sniper':
                return { width: 2, height: 2 };
            case 'wall':
            default:
                return { width: 1, height: 1 };
        }
    }
}

// Start the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
}); 