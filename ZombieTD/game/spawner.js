import { Zombie, Runner, Tank, Boss } from './enemies.js';

export class Spawner {
    constructor(tileMap, game) {
        this.tileMap = tileMap;
        this.game = game; // Store game reference
        this.isSpawning = false;
        this.waveTimer = 0; // Start the first wave immediately
        this.spawnTimer = 0;
        this.enemiesLeftToSpawn = 0;
        this.waveNumber = 0; // Start at 0 so first wave will be 1
        this.spawnedEnemies = [];
        this.waveEnded = true; // Set to true to trigger first wave immediately
        
        // Improved wave settings with slower progression
        this.calculateWaveSettings();
        
        // UI for wave timer
        this.createWaveTimerUI();
        
        // Add window resize event listener
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    calculateWaveSettings() {
        // Base times between waves (longer early on, shorter later)
        if (this.waveNumber < 5) {
            this.timeBetweenWaves = 15000; // 15 seconds for waves 1-5
        } else if (this.waveNumber < 10) {
            this.timeBetweenWaves = 12000; // 12 seconds for waves 6-10
        } else if (this.waveNumber < 15) {
            this.timeBetweenWaves = 10000; // 10 seconds for waves 11-15
        } else {
            this.timeBetweenWaves = 8000; // 8 seconds for waves 16+
        }
        
        // Base times between enemy spawns (slower early on)
        if (this.waveNumber < 5) {
            this.timeBetweenSpawns = 1500; // 1.5 seconds for waves 1-5
        } else if (this.waveNumber < 10) {
            this.timeBetweenSpawns = 1200; // 1.2 seconds for waves 6-10
        } else {
            this.timeBetweenSpawns = 1000; // 1 second for waves 11+
        }
    }
    
    createWaveTimerUI() {
        // Check if the UI already exists
        const existingContainer = document.getElementById('wave-timer-container');
        if (existingContainer) {
            // Container exists, just make sure it has the right styles for bottom-center
            this.updateWaveTimerUIPosition();
            return;
        }
        
        // Create container for the wave timer
        const container = document.createElement('div');
        container.id = 'wave-timer-container';
        Object.assign(container.style, {
            position: 'absolute',
            display: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            textAlign: 'center',
            zIndex: '1000',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease-in-out'
        });
        
        // Create wave number text
        const waveNumberText = document.createElement('div');
        waveNumberText.id = 'wave-number-text';
        waveNumberText.style.marginBottom = '5px';
        waveNumberText.style.fontSize = '20px';
        waveNumberText.style.fontWeight = 'bold';
        waveNumberText.textContent = 'Wave 1 Completed!';
        container.appendChild(waveNumberText);
        
        // Create timer element
        const timerElement = document.createElement('div');
        timerElement.id = 'wave-timer';
        timerElement.style.marginBottom = '10px';
        timerElement.textContent = 'Next Wave: 10s';
        container.appendChild(timerElement);
        
        // Create skip button
        const skipButton = document.createElement('button');
        skipButton.id = 'skip-timer-button';
        Object.assign(skipButton.style, {
            padding: '5px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'background-color 0.2s'
        });
        skipButton.textContent = 'Skip Timer';
        
        // Add hover effect
        skipButton.addEventListener('mouseover', () => {
            skipButton.style.backgroundColor = '#45a049';
        });
        skipButton.addEventListener('mouseout', () => {
            skipButton.style.backgroundColor = '#4CAF50';
        });
        
        // Add click event
        skipButton.addEventListener('click', () => {
            if (this.onSkipTimer) {
                this.onSkipTimer();
            }
        });
        
        container.appendChild(skipButton);
        
        // Add to document
        document.body.appendChild(container);
        
        // Position at bottom center
        this.updateWaveTimerUIPosition();
        
        // Initially hide the timer
        this.hideWaveTimerUI();
    }
    
    updateWaveTimerUIPosition() {
        const container = document.getElementById('wave-timer-container');
        if (!container) return;
        
        // Get canvas dimensions
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        
        // Position at bottom center of canvas
        Object.assign(container.style, {
            left: `${canvasRect.left + (canvasRect.width / 2) - (container.offsetWidth / 2)}px`,
            bottom: `${window.innerHeight - canvasRect.bottom + 20}px`, // 20px up from bottom
        });
    }
    
    showWaveTimerUI() {
        const container = document.getElementById('wave-timer-container');
        if (container) {
            // Update position before showing
            this.updateWaveTimerUIPosition();
            
            container.style.display = 'block';
            container.style.opacity = '1'; // Ensure full opacity
            
            // Update wave number text
            const waveNumberText = document.getElementById('wave-number-text');
            if (waveNumberText) {
                waveNumberText.textContent = `Wave ${this.waveNumber} Completed!`;
                
                // If wave 1 is about to start, show different text
                if (this.waveNumber === 0) {
                    waveNumberText.textContent = 'Prepare for Wave 1!';
                }
            }
        }
    }
    
    hideWaveTimerUI() {
        const container = document.getElementById('wave-timer-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    updateWaveTimerUI(seconds) {
        const timerElement = document.getElementById('wave-timer');
        if (timerElement) {
            timerElement.textContent = `Next Wave: ${seconds}s`;
        }
    }
    
    update(deltaTime, waveNumber, currentEnemies) {
        // Reference to current enemies for adding new spawns
        this.spawnedEnemies = currentEnemies;
        
        if (this.isSpawning) {
            // Hide the wave timer UI during spawning
            this.hideWaveTimerUI();
            
            // Update spawn timer
            this.spawnTimer -= deltaTime;
            
            if (this.spawnTimer <= 0 && this.enemiesLeftToSpawn > 0) {
                this.spawnEnemy();
                this.spawnTimer = this.timeBetweenSpawns;
                this.enemiesLeftToSpawn--;
                
                if (this.enemiesLeftToSpawn <= 0) {
                    this.isSpawning = false;
                    this.waveEnded = true;
                    
                    // Recalculate wave settings for next wave's timing
                    this.calculateWaveSettings();
                    
                    // Set timer for next wave
                    this.waveTimer = this.timeBetweenWaves;
                }
            }
        } else {
            // Check if all enemies are cleared and wave has ended
            if (this.waveEnded && currentEnemies.length === 0) {
                // Show the wave timer UI and update it
                this.showWaveTimerUI();
                
                // Update wave timer
                this.waveTimer -= deltaTime;
                
                // Update the UI display
                const secondsLeft = Math.ceil(this.waveTimer / 1000);
                this.updateWaveTimerUI(secondsLeft);
                
                if (this.waveTimer <= 0) {
                    this.startWave();
                    this.waveEnded = false;
                    
                    // Play wave start sound if game reference exists
                    if (this.game && this.game.audio) {
                        this.game.audio.playSound('waveStart');
                    }
                }
            }
        }
    }
    
    startWave() {
        // Hide the wave timer UI
        this.hideWaveTimerUI();
        
        // Reset timers
        this.isSpawning = true;
        this.waveTimer = this.timeBetweenWaves;
        this.spawnTimer = 0;
        
        // Increment the wave number in the spawner
        this.waveNumber++;
        
        // Calculate number of enemies based on wave
        // More controlled progression with slightly fewer enemies early on
        this.enemiesLeftToSpawn = Math.min(3 + Math.floor(this.waveNumber * 1.2), 30);
        
        console.log(`Starting wave ${this.waveNumber} with ${this.enemiesLeftToSpawn} enemies`);
        
        // Recalculate wave settings for spawn timing
        this.calculateWaveSettings();
    }
    
    skipTimer() {
        if (!this.isSpawning && this.waveEnded) {
            this.waveTimer = 0;
            
            // Play wave start sound if game reference exists
            if (this.game && this.game.audio) {
                this.game.audio.playSound('waveStart');
            }
        }
    }
    
    // Set a callback function to handle skip button clicks
    setSkipTimerCallback(callback) {
        this.onSkipTimer = callback;
    }
    
    spawnEnemy() {
        // Find an unoccupied edge tile
        const spawnTile = this.tileMap.findUnoccupiedEdgeTile();
        if (!spawnTile) {
            console.log('No available spawn tiles');
            return;
        }
        
        // Create appropriate enemy based on wave number, passing the game reference
        let enemy;
        
        // Check if it's a boss wave (every 10 waves)
        if (this.waveNumber % 10 === 0) {
            enemy = new Boss(spawnTile.x, spawnTile.y, this.game); // Pass game reference
        } else {
            // Random enemy type with weights based on wave number
            const rand = Math.random();
            
            if (this.waveNumber < 3) {
                // Early waves: mostly zombies
                enemy = new Zombie(spawnTile.x, spawnTile.y, this.game);
            } else if (this.waveNumber < 5) {
                // Mid waves: zombies and runners
                if (rand < 0.7) {
                    enemy = new Zombie(spawnTile.x, spawnTile.y, this.game);
                } else {
                    enemy = new Runner(spawnTile.x, spawnTile.y, this.game);
                }
            } else if (this.waveNumber < 8) {
                // Later waves: zombies, runners, and a few tanks
                if (rand < 0.5) {
                    enemy = new Zombie(spawnTile.x, spawnTile.y, this.game);
                } else if (rand < 0.8) {
                    enemy = new Runner(spawnTile.x, spawnTile.y, this.game);
                } else {
                    enemy = new Tank(spawnTile.x, spawnTile.y, this.game);
                }
            } else {
                // End waves: mix of all types
                if (rand < 0.4) {
                    enemy = new Zombie(spawnTile.x, spawnTile.y, this.game);
                } else if (rand < 0.7) {
                    enemy = new Runner(spawnTile.x, spawnTile.y, this.game);
                } else {
                    enemy = new Tank(spawnTile.x, spawnTile.y, this.game);
                }
            }
        }
        
        // Scale enemy health based on wave number
        if (this.waveNumber > 1) {
            const healthMultiplier = 1 + (this.waveNumber - 1) * 0.1;
            enemy.health *= healthMultiplier;
            enemy.maxHealth *= healthMultiplier;
        }
        
        // Add enemy to game
        this.spawnedEnemies.push(enemy);
    }
    
    // Add reset method for game restart
    reset() {
        this.isSpawning = false;
        this.waveTimer = 0; // Start the first wave immediately 
        this.spawnTimer = 0;
        this.enemiesLeftToSpawn = 0;
        this.waveNumber = 0; // Start at 0 so first wave will be 1
        this.waveEnded = true; // Set to true to trigger first wave immediately
        
        // Recalculate timings for wave 1
        this.calculateWaveSettings();
        
        // Hide any UI elements
        this.hideWaveTimerUI();
    }
    
    // Add resize handler
    handleResize() {
        // Update timer position when window resizes
        this.updateWaveTimerUIPosition();
    }
} 