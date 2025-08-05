// UI Manager
export class UIManager {
    constructor(game) {
        this.game = game;
        this.currentScene = 'start'; // start, playing, game-over
        
        // Elements
        this.startMenu = document.getElementById('start-menu');
        this.gameOverMenu = document.getElementById('game-over-menu');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.towerButtons = document.getElementsByClassName('tower-button');
        this.sellUpgradeDialog = document.getElementById('sell-upgrade-dialog');
        
        // Remove the "Start Wave" button if it exists (replaced by auto timer)
        const startWaveBtn = document.getElementById('start-wave');
        if (startWaveBtn) {
            startWaveBtn.remove();
        }
        
        // Hide the health counter text as we're using the health bar
        const healthCounter = document.getElementById('health-counter');
        if (healthCounter && healthCounter.parentElement) {
            healthCounter.parentElement.style.display = 'none';
        }
        
        // Bind methods for UI and audio control
        this.toggleSidebar = this.toggleSidebar.bind(this);
        this.startGame = this.startGame.bind(this);
        this.restartGame = this.restartGame.bind(this);
        this.showScene = this.showScene.bind(this);
        this.selectTower = this.selectTower.bind(this);
        this.showSellUpgradeDialog = this.showSellUpgradeDialog.bind(this);
        this.sellDefense = this.sellDefense.bind(this);
        this.upgradeDefense = this.upgradeDefense.bind(this);
        this.toggleMute = this.toggleMute.bind(this);
        
        // Create mute button after binding
        this.createMuteButton();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Enhance the upgrade/sell dialog
        this.enhanceUpgradeDialog();
    }
    
    createMuteButton() {
        // Create mute button if it doesn't exist
        if (!document.getElementById('mute-button')) {
            const muteButton = document.createElement('button');
            muteButton.id = 'mute-button';
            muteButton.className = 'mute-button';
            muteButton.innerHTML = '🔊';
            muteButton.title = 'Toggle Sound';
            
            // Style the button
            muteButton.style.position = 'absolute';
            muteButton.style.top = '10px';
            muteButton.style.right = '10px';
            muteButton.style.width = '40px';
            muteButton.style.height = '40px';
            muteButton.style.borderRadius = '50%';
            muteButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            muteButton.style.color = 'white';
            muteButton.style.border = 'none';
            muteButton.style.fontSize = '20px';
            muteButton.style.cursor = 'pointer';
            muteButton.style.zIndex = '1000';
            muteButton.style.display = 'flex';
            muteButton.style.justifyContent = 'center';
            muteButton.style.alignItems = 'center';
            
            // Add hover effect
            muteButton.addEventListener('mouseover', () => {
                muteButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            });
            muteButton.addEventListener('mouseout', () => {
                muteButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            });
            
            // Add click event
            muteButton.addEventListener('click', this.toggleMute);
            
            // Add to document
            document.body.appendChild(muteButton);
        }
    }
    
    toggleMute() {
        const muteButton = document.getElementById('mute-button');
        if (!muteButton) return;
        
        const isMuted = this.game.audio.toggleMute();
        
        // Update button icon
        muteButton.innerHTML = isMuted ? '🔇' : '🔊';
    }
    
    enhanceUpgradeDialog() {
        const dialog = this.sellUpgradeDialog;
        if (!dialog) return;
        
        // Style the dialog
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        dialog.style.backgroundColor = 'rgba(44, 62, 80, 0.95)';
        dialog.style.border = '1px solid #34495e';
        dialog.style.color = '#ecf0f1';
        
        // Style the title
        const dialogTitle = document.getElementById('dialog-title');
        if (dialogTitle) {
            dialogTitle.style.padding = '10px 15px';
            dialogTitle.style.borderBottom = '1px solid #34495e';
            dialogTitle.style.backgroundColor = 'rgba(52, 73, 94, 0.8)';
            dialogTitle.style.borderTopLeftRadius = '8px';
            dialogTitle.style.borderTopRightRadius = '8px';
            dialogTitle.style.marginTop = '0';
        }
        
        // Style the stats
        const dialogStats = document.getElementById('dialog-stats');
        if (dialogStats) {
            dialogStats.style.padding = '15px';
            dialogStats.style.marginBottom = '10px';
            dialogStats.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        }
        
        // Style buttons
        const buttons = dialog.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.padding = '8px 15px';
            button.style.margin = '0 5px 10px';
            button.style.border = 'none';
            button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
            button.style.fontWeight = 'bold';
            button.style.transition = 'background-color 0.2s ease';
            
            // Close button styling
            if (button.id === 'close-dialog-btn') {
                button.style.backgroundColor = '#7f8c8d';
            }
            // Sell button styling
            else if (button.id === 'sell-btn') {
                button.style.backgroundColor = '#e74c3c';
            }
            // Upgrade button styling
            else if (button.id === 'upgrade-btn') {
                button.style.backgroundColor = '#2ecc71';
                button.style.opacity = button.disabled ? '0.5' : '1';
            }
        });
    }
    
    initEventListeners() {
        // Sidebar toggle
        this.sidebarToggle.addEventListener('click', this.toggleSidebar);
        
        // Start game button
        document.getElementById('start-game-btn').addEventListener('click', this.startGame);
        
        // Restart game button
        document.getElementById('restart-game-btn').addEventListener('click', this.restartGame);
        
        // Tower buttons
        for (const button of this.towerButtons) {
            button.addEventListener('click', () => this.selectTower(button.dataset.towerType));
        }
        
        // Sell button
        document.getElementById('sell-btn').addEventListener('click', this.sellDefense);
        
        // Upgrade button
        document.getElementById('upgrade-btn').addEventListener('click', this.upgradeDefense);
        
        // Close dialog button
        document.getElementById('close-dialog-btn').addEventListener('click', () => this.sellUpgradeDialog.classList.add('hidden'));
    }
    
    toggleSidebar() {
        this.sidebar.classList.toggle('collapsed');
    }
    
    showScene(sceneName) {
        this.currentScene = sceneName;
        
        // Hide all scenes/UI elements first
        this.startMenu.classList.add('hidden');
        this.gameOverMenu.classList.add('hidden');
        this.sidebar.classList.add('collapsed'); // Ensure sidebar starts collapsed
        this.sidebarToggle.classList.add('hidden'); // Hide toggle button by default
        
        // Show requested scene
        if (sceneName === 'start') {
            this.startMenu.classList.remove('hidden');
        } else if (sceneName === 'playing') {
            this.sidebarToggle.classList.remove('hidden');
        } else if (sceneName === 'game-over') {
            this.gameOverMenu.classList.remove('hidden');
        }
        
        // Update game state
        this.game.setGameState(sceneName);
    }
    
    startGame() {
        this.showScene('playing');
    }
    
    restartGame() {
        // Simply set the game state to 'playing'. 
        // The setGameState method in game.js already handles calling the reset method.
        this.showScene('playing');
    }
    
    selectTower(towerType) {
        this.game.setDefenseToPlace(towerType);
    }
    
    showSellUpgradeDialog(defense) {
        // Update dialog content based on selected defense
        const dialogTitle = document.getElementById('dialog-title');
        const dialogStats = document.getElementById('dialog-stats');
        const upgradeBtn = document.getElementById('upgrade-btn');
        
        // Set dialog title with defense type and level
        const defenseType = defense.constructor.name.replace('Tower', ' Tower');
        dialogTitle.textContent = `${defenseType} (Level ${defense.level})`;
        
        // Set stats with appropriate formatting
        let statsHtml = `<div class="stat-grid">`;
        
        // Health stat
        statsHtml += `
            <div class="stat-label">Health:</div>
            <div class="stat-value">${Math.floor(defense.health)} / ${defense.maxHealth}</div>
        `;
        
        // Damage stat (only for towers, not walls)
        if (defense.damage) {
            statsHtml += `
                <div class="stat-label">Damage:</div>
                <div class="stat-value">${defense.damage}</div>
            `;
        }
        
        // Range stat (only for towers, not walls)
        if (defense.range) {
            statsHtml += `
                <div class="stat-label">Range:</div>
                <div class="stat-value">${defense.range} tiles</div>
            `;
        }
        
        // Fire rate stat (only for towers, not walls)
        if (defense.fireRate) {
            statsHtml += `
                <div class="stat-label">Fire Rate:</div>
                <div class="stat-value">${defense.fireRate.toFixed(1)} shots/sec</div>
            `;
        }
        
        statsHtml += `</div>`;
        
        // Add CSS for the stat grid
        statsHtml += `
            <style>
                .stat-grid {
                    display: grid;
                    grid-template-columns: auto auto;
                    gap: 5px 10px;
                }
                .stat-label {
                    text-align: right;
                    font-weight: bold;
                    color: #bdc3c7;
                }
                .stat-value {
                    text-align: left;
                    color: #ecf0f1;
                }
            </style>
        `;
        
        dialogStats.innerHTML = statsHtml;
        
        // Disable upgrade button if max level
        if (defense.level >= 3) {
            upgradeBtn.disabled = true;
            upgradeBtn.textContent = 'Max Level';
            upgradeBtn.style.backgroundColor = '#7f8c8d';
            upgradeBtn.style.opacity = '0.5';
            upgradeBtn.style.cursor = 'not-allowed';
        } else {
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = `Upgrade (${defense.upgradeCost}g)`;
            upgradeBtn.style.backgroundColor = '#2ecc71';
            upgradeBtn.style.opacity = '1';
            upgradeBtn.style.cursor = 'pointer';
            
            // Disable if not enough gold
            if (this.game.gold < defense.upgradeCost) {
                upgradeBtn.disabled = true;
                upgradeBtn.style.backgroundColor = '#7f8c8d';
                upgradeBtn.style.opacity = '0.5';
                upgradeBtn.style.cursor = 'not-allowed';
            }
        }
        
        // Set sell value
        const sellBtn = document.getElementById('sell-btn');
        const sellValue = Math.floor(defense.getTotalValue() * 0.5);
        sellBtn.textContent = `Sell (${sellValue}g)`;
        
        // Show dialog
        this.sellUpgradeDialog.classList.remove('hidden');
        
        // Store reference to selected defense
        this.selectedDefense = defense;
    }
    
    sellDefense() {
        if (!this.selectedDefense) return;
        
        // Calculate sell value (50% of total spent)
        const sellValue = Math.floor(this.selectedDefense.getTotalValue() * 0.5);
        
        // Add gold
        this.game.gold += sellValue;
        
        // Play sell sound
        if (this.game.audio) {
            this.game.audio.playSound('sell');
        }
        
        // Remove from game
        this.game.removeDefense(this.selectedDefense);
        
        // Hide dialog
        this.sellUpgradeDialog.classList.add('hidden');
        this.selectedDefense = null;
        
        // Update UI
        this.game.updateUI();
    }
    
    upgradeDefense() {
        if (!this.selectedDefense) return;
        
        // Check if enough gold
        if (this.game.gold < this.selectedDefense.upgradeCost) {
            return;
        }
        
        // Subtract gold
        this.game.gold -= this.selectedDefense.upgradeCost;
        
        // Upgrade defense
        this.selectedDefense.upgrade();
        
        // Play upgrade sound
        if (this.game.audio) {
            this.game.audio.playSound('upgrade');
        }
        
        // Hide dialog and show updated dialog
        this.sellUpgradeDialog.classList.add('hidden');
        this.showSellUpgradeDialog(this.selectedDefense);
        
        // Update UI
        this.game.updateUI();
    }
    
    showGameOver(finalScore) {
        // Update final score
        document.getElementById('final-score').textContent = finalScore;
        
        // Show game over scene
        this.showScene('game-over');
    }
} 