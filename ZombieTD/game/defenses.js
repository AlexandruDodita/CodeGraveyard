// Base class for all defensive structures
class Defense {
    constructor(gridX, gridY) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.level = 1;
        this.upgradeCost = 50;
        this.width = 1; // Default size is 1x1
        this.height = 1;
        this.baseCost = 0; // Will be set by child classes
        this.totalSpent = 0; // Track total gold spent for selling
        
        // Health properties
        this.health = 100;
        this.maxHealth = 100;
        this.lastHealthChange = 0; // For animation
        this.healthBarOpacity = 0; // Only visible when damaged
        
        // Regeneration properties
        this.regenTimer = 0;
        this.regenRate = 5; // HP per interval
        this.regenInterval = 5000; // 5 seconds
        
        // Visual effects based on level
        this.levelColors = {
            base: ['#95a5a6', '#bdc3c7', '#ecf0f1'],
            accent: ['#7f8c8d', '#95a5a6', '#bdc3c7'],
            glow: [null, 'rgba(255, 255, 255, 0.3)', 'rgba(255, 215, 0, 0.4)']
        };
    }
    
    draw(ctx, tileSize) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Position in grid
        const x = this.gridX * tileSize;
        const y = this.gridY * tileSize;
        
        // Draw health bar if needed
        this.drawHealthBar(ctx, x, y, tileSize);
        
        // Restore context
        ctx.restore();
    }
    
    drawHealthBar(ctx, x, y, tileSize) {
        // Don't draw health bar for MainTower (handled by its own drawUIHealthBar)
        if (this.constructor.name === 'MainTower') {
            return;
        }
        
        // Calculate health percentage
        const healthPercentage = this.health / this.maxHealth;
        
        // Only show health bar if health is less than max
        if (healthPercentage < 1.0) {
            // Fade in the bar if not already shown
            if (this.healthBarOpacity < 1.0) {
                this.healthBarOpacity = Math.min(1.0, this.healthBarOpacity + 0.1);
            }
            
            // Bar dimensions
            const barWidth = tileSize * 1.2;
            const barHeight = 5;
            
            // Position bar centered above the defense
            const barX = x - barWidth / 2 + tileSize / 2;
            const barY = y - 15;
            
            // Background
            ctx.fillStyle = `rgba(60, 60, 60, ${this.healthBarOpacity})`;
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Health portion
            let healthColor;
            if (healthPercentage > 0.6) {
                healthColor = `rgba(0, 255, 0, ${this.healthBarOpacity})`;
            } else if (healthPercentage > 0.3) {
                healthColor = `rgba(255, 255, 0, ${this.healthBarOpacity})`;
            } else {
                healthColor = `rgba(255, 0, 0, ${this.healthBarOpacity})`;
            }
            
            ctx.fillStyle = healthColor;
            ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
        } else {
            // Fade out the bar if at full health
            if (this.healthBarOpacity > 0) {
                this.healthBarOpacity = Math.max(0, this.healthBarOpacity - 0.05);
            }
            
            // Only draw if still visible during fade-out
            if (this.healthBarOpacity > 0) {
                // Bar dimensions
                const barWidth = tileSize * 1.2;
                const barHeight = 5;
                
                // Position bar centered above the defense
                const barX = x - barWidth / 2 + tileSize / 2;
                const barY = y - 15;
                
                // Background
                ctx.fillStyle = `rgba(60, 60, 60, ${this.healthBarOpacity})`;
                ctx.fillRect(barX, barY, barWidth, barHeight);
                
                // Health portion (full)
                ctx.fillStyle = `rgba(0, 255, 0, ${this.healthBarOpacity})`;
                ctx.fillRect(barX, barY, barWidth, barHeight);
            }
        }
    }
    
    update(deltaTime) {
        // Handle regeneration for non-main towers
        if (!(this instanceof MainTower) && this.health < this.maxHealth) {
            this.regenTimer += deltaTime;
            
            if (this.regenTimer >= this.regenInterval) {
                this.health = Math.min(this.maxHealth, this.health + this.regenRate);
                this.regenTimer = 0;
            }
        }
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.lastHealthChange = Date.now();
        this.healthBarOpacity = 1;
        
        // Check if the defense is destroyed
        if (this.health <= 0 && !this.isDestroying) {
            this.isDestroying = true;
            this.destroyStartTime = Date.now();
            this.destroyDuration = 800; // 800ms animation
            
            // Play destroy sound if game reference exists
            if (this.game && this.game.audio) {
                this.game.audio.playSound('sell');
            }
            
            // Schedule removal after animation
            setTimeout(() => {
                // Free up the tiles
                if (this.game && this.game.tileMap) {
                    this.game.tileMap.setRectangleOccupied(
                        this.gridX, this.gridY, this.width, this.height, false
                    );
                }
                
                // Remove from appropriate array
                if (this.game) {
                    if (this.constructor.name === 'Wall') {
                        const index = this.game.walls.indexOf(this);
                        if (index !== -1) {
                            this.game.walls.splice(index, 1);
                        }
                    } else if (this.constructor.name !== 'MainTower') { // Don't remove MainTower
                        const index = this.game.towers.indexOf(this);
                        if (index !== -1) {
                            this.game.towers.splice(index, 1);
                        }
                    }
                }
            }, this.destroyDuration);
        }
        
        return this.health <= 0;
    }
    
    upgrade() {
        // Track total spent for sell value calculation
        this.totalSpent += this.upgradeCost;
        
        this.level++;
        this.upgradeCost = Math.floor(this.upgradeCost * 1.5);
        
        // Increase max health on upgrade
        this.maxHealth = Math.floor(this.maxHealth * 1.2);
        this.health = this.maxHealth; // Heal fully on upgrade
        
        // Play upgrade sound if game reference exists
        if (this.game && this.game.audio) {
            this.game.audio.playSound('upgrade');
        }
    }
    
    // Get total value of defense (for sell calculation)
    getTotalValue() {
        return this.baseCost + this.totalSpent;
    }
    
    // Get the tiles this defense occupies
    getOccupiedTiles() {
        const tiles = [];
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                tiles.push({
                    x: this.gridX + x,
                    y: this.gridY + y
                });
            }
        }
        
        return tiles;
    }
    
    // Get color for current level (0-indexed array)
    getColorForLevel(colorType) {
        // Enhanced color palettes for different levels
        const levelColors = {
            base: ['#555555', '#A0A0A0', '#FFD700'], // Gray, Silver, Gold
            accent: ['#777777', '#C0C0C0', '#FFA500'], // Darker gray, Brighter silver, Orange-gold
            highlight: ['#999999', '#E0E0E0', '#FFFF00'] // Light gray, White-silver, Yellow
        };
        
        // Return the color based on level (1-indexed, so subtract 1 for array indexing)
        return levelColors[colorType][Math.min(this.level - 1, 2)];
    }
    
    // Draw level-based glow effect
    drawLevelGlow(ctx, x, y, width, height) {
        if (this.level === 1) {
            return; // No glow for level 1
        }
        
        const tileSize = this.game.tileMap.tileSize;
        const centerX = x + (width * tileSize) / 2;
        const centerY = y + (height * tileSize) / 2;
        const radius = Math.max(width, height) * tileSize * 0.7;
        
        // Create gradient
        const gradient = ctx.createRadialGradient(
            centerX, centerY, radius * 0.2,
            centerX, centerY, radius
        );
        
        if (this.level === 2) {
            // Silver glow for level 2
            gradient.addColorStop(0, 'rgba(220, 220, 240, 0.3)');
            gradient.addColorStop(0.7, 'rgba(180, 180, 220, 0.1)');
            gradient.addColorStop(1, 'rgba(150, 150, 200, 0)');
        } else if (this.level === 3) {
            // Gold glow for level 3
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            gradient.addColorStop(0.7, 'rgba(255, 180, 0, 0.1)');
            gradient.addColorStop(1, 'rgba(230, 150, 0, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Base class for all tower types
class Tower extends Defense {
    constructor(gridX, gridY) {
        super(gridX, gridY);
        this.range = 3;
        this.damage = 10;
        this.fireRate = 1; // Shots per second
        this.fireTimer = 0;
        this.target = null;
        
        // Targeting and barrel rotation
        this.barrelAngle = 0; // in radians
        this.targetAngle = 0; // in radians
        this.rotationSpeed = Math.PI; // radians per second
        
        // Bullet system
        this.bullets = [];
        
        // Override with tower-specific level colors
        this.levelColors = {
            base: ['#95a5a6', '#bdc3c7', '#ecf0f1'],
            barrel: ['#7f8c8d', '#95a5a6', '#ecf0f1'],
            glow: [null, 'rgba(255, 255, 255, 0.3)', 'rgba(255, 215, 0, 0.4)']
        };
    }
    
    update(deltaTime, enemies) {
        // Call base class update for health regeneration
        super.update(deltaTime);
        
        // Update bullets
        this.updateBullets(deltaTime, enemies);
        
        // Find target and update barrel rotation
        this.findTarget(enemies);
        this.updateBarrelRotation(deltaTime);
        
        // Handle firing
        this.fireTimer -= deltaTime / 1000;
        
        if (this.fireTimer <= 0 && this.target) {
            this.fire();
            this.fireTimer = 1 / this.fireRate;
        }
    }
    
    updateBullets(deltaTime, enemies) {
        // Update existing bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime, enemies);
            
            // Remove inactive bullets
            if (!bullet.isActive) {
                this.bullets.splice(i, 1);
            }
        }
    }
    
    findTarget(enemies) {
        this.target = null;
        if (!enemies.length) return;
        
        // Calculate tower's center in game coordinates
        const towerCenterX = (this.gridX + this.width / 2) * this.game.tileMap.tileSize;
        const towerCenterY = (this.gridY + this.height / 2) * this.game.tileMap.tileSize;
        
        let closestDistance = Infinity;
        let closestEnemy = null;
        
        for (const enemy of enemies) {
            const dx = enemy.x - towerCenterX;
            const dy = enemy.y - towerCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Convert range from tiles to pixels
            const rangeInPixels = this.range * this.game.tileMap.tileSize;
            
            if (distance < closestDistance && distance <= rangeInPixels) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }
        
        if (closestEnemy) {
            this.target = closestEnemy;
            // Calculate angle to target
            const dx = this.target.x - towerCenterX;
            const dy = this.target.y - towerCenterY;
            this.targetAngle = Math.atan2(dy, dx);
        }
    }
    
    updateBarrelRotation(deltaTime) {
        if (!this.target) return;
        
        // Calculate shortest rotation direction
        let angleDiff = this.targetAngle - this.barrelAngle;
        
        // Normalize to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Calculate rotation step
        const rotationStep = this.rotationSpeed * (deltaTime / 1000);
        
        // Rotate towards target
        if (Math.abs(angleDiff) <= rotationStep) {
            this.barrelAngle = this.targetAngle;
        } else if (angleDiff > 0) {
            this.barrelAngle += rotationStep;
        } else {
            this.barrelAngle -= rotationStep;
        }
        
        // Normalize angle to [0, 2*PI]
        while (this.barrelAngle < 0) this.barrelAngle += Math.PI * 2;
        while (this.barrelAngle >= Math.PI * 2) this.barrelAngle -= Math.PI * 2;
    }
    
    fire() {
        if (!this.target) return;
        
        // Calculate center of tower in game coordinates
        const towerCenterX = (this.gridX + this.width / 2) * this.game.tileMap.tileSize;
        const towerCenterY = (this.gridY + this.height / 2) * this.game.tileMap.tileSize;
        
        // Create bullet and add to array
        const bullet = new MainTowerBullet(towerCenterX, towerCenterY, this.target, this.damage);
        this.bullets.push(bullet);
        
        // Play main tower shot sound
        if (this.game && this.game.audio) {
            this.game.audio.playSound('cannonShot');
        }
    }
    
    drawBase(ctx, x, y, tileSize, baseColor) {
        // Use level-based colors
        const color = baseColor || this.getColorForLevel('base');
        const width = tileSize * this.width;
        const height = tileSize * this.height;
        
        // Draw level-based glow first
        this.drawLevelGlow(ctx, x, y, width, height);
        
        // Create gradient for base
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this.shadeColor(color, -30)); // Darker version for 3D effect
        
        // Draw rounded rectangle for base
        const radius = width * 0.1; // Corner radius
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        
        // Add subtle 3D effect - top edge highlight
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();
        
        // Add subtle 3D effect - bottom shadow
        ctx.beginPath();
        ctx.moveTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.stroke();
        
        // Add mechanical details
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        // Corner bolts
        const boltRadius = width * 0.05;
        ctx.beginPath();
        ctx.arc(x + boltRadius * 3, y + boltRadius * 3, boltRadius, 0, Math.PI * 2);
        ctx.arc(x + width - boltRadius * 3, y + boltRadius * 3, boltRadius, 0, Math.PI * 2);
        ctx.arc(x + boltRadius * 3, y + height - boltRadius * 3, boltRadius, 0, Math.PI * 2);
        ctx.arc(x + width - boltRadius * 3, y + height - boltRadius * 3, boltRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Bolt centers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        const centerBoltRadius = boltRadius * 0.4;
        ctx.arc(x + boltRadius * 3, y + boltRadius * 3, centerBoltRadius, 0, Math.PI * 2);
        ctx.arc(x + width - boltRadius * 3, y + boltRadius * 3, centerBoltRadius, 0, Math.PI * 2);
        ctx.arc(x + boltRadius * 3, y + height - boltRadius * 3, centerBoltRadius, 0, Math.PI * 2);
        ctx.arc(x + width - boltRadius * 3, y + height - boltRadius * 3, centerBoltRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Level indicator based on level
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            this.level.toString(),
            x + width / 2,
            y + height / 2
        );
        
        // Add decorative star for level 3
        if (this.level === 3) {
            this.drawStar(ctx, x + width / 2, y + height / 2 + 15, 5, 5, 10);
        }
    }
    
    // Draw a star shape for level 3 towers
    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = 'gold';
        ctx.fill();
    }
    
    // Helper function to darken/lighten colors
    shadeColor(color, percent) {
        // Convert hex or name to RGB
        let r, g, b;
        if (color.startsWith('rgb')) {
            const rgbValues = color.match(/\d+/g);
            r = parseInt(rgbValues[0]);
            g = parseInt(rgbValues[1]);
            b = parseInt(rgbValues[2]);
        } else {
            // For simplicity, assuming it's a basic color name
            const tempCtx = document.createElement('canvas').getContext('2d');
            tempCtx.fillStyle = color;
            const rgb = tempCtx.fillStyle;
            
            r = parseInt(rgb.substr(1, 2), 16);
            g = parseInt(rgb.substr(3, 2), 16);
            b = parseInt(rgb.substr(5, 2), 16);
        }
        
        // Apply shade
        r = Math.max(0, Math.min(255, r + percent));
        g = Math.max(0, Math.min(255, g + percent));
        b = Math.max(0, Math.min(255, b + percent));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    drawBarrel(ctx, x, y, tileSize, barrelColor, length, width) {
        // Use level-based colors for barrel
        const color = barrelColor || this.getColorForLevel('barrel');
        
        // Calculate center of tower
        const centerX = x + tileSize * this.width / 2;
        const centerY = y + tileSize * this.height / 2;
        
        // Save context, translate to tower center
        ctx.save();
        ctx.translate(centerX, centerY);
        
        // Rotate to aim at target
        ctx.rotate(this.barrelAngle);
        
        // Create gradient for barrel
        const barrelGradient = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
        barrelGradient.addColorStop(0, color);
        barrelGradient.addColorStop(0.5, color);
        barrelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        
        // Draw barrel with rounded end
        ctx.fillStyle = barrelGradient;
        ctx.beginPath();
        // Starting point (barrel connection to tower)
        ctx.moveTo(0, -width / 2);
        // Top side
        ctx.lineTo(length - width / 2, -width / 2);
        // Rounded end
        ctx.arc(length - width / 2, 0, width / 2, -Math.PI / 2, Math.PI / 2);
        // Bottom side
        ctx.lineTo(0, width / 2);
        // Close shape
        ctx.closePath();
        ctx.fill();
        
        // Add barrel details
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        
        // Barrel reinforcement rings
        const ringCount = 3;
        const ringWidth = width / 6;
        const spaceBetween = (length - ringWidth * ringCount) / (ringCount + 1);
        
        for (let i = 0; i < ringCount; i++) {
            const ringPosition = spaceBetween * (i + 1) + ringWidth * i;
            ctx.fillRect(ringPosition, -width / 2, ringWidth, width);
        }
        
        // Add level-specific barrel enhancements
        if (this.level >= 2) {
            // Level 2-3: Add barrel highlight line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -width / 4);
            ctx.lineTo(length - width, -width / 4);
            ctx.stroke();
        }
        
        if (this.level === 3) {
            // Level 3: Add golden barrel tip
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.arc(length - width / 2, 0, width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = barrelGradient;
            ctx.beginPath();
            ctx.arc(length - width / 2, 0, width / 2 * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add muzzle flash when firing (if we have target and recent bullet)
        if (this.target && this.bullets.length > 0 && this.bullets[this.bullets.length - 1].lifeSpan > 2900) {
            // Draw muzzle flash
            const flashSize = width * 1.5;
            
            // Create flash gradient
            const flashGradient = ctx.createRadialGradient(
                length, 0, 0,
                length, 0, flashSize
            );
            flashGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            flashGradient.addColorStop(0.4, 'rgba(255, 255, 0, 0.8)');
            flashGradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.4)');
            flashGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            
            ctx.fillStyle = flashGradient;
            ctx.beginPath();
            ctx.arc(length, 0, flashSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawRangeCircle(ctx, x, y, tileSize, color) {
        // Center of tower
        const centerX = x + tileSize * this.width / 2;
        const centerY = y + tileSize * this.height / 2;
        
        // Draw range circle
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(
            centerX,
            centerY,
            this.range * tileSize,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }
    
    drawBullets(ctx, offsetX, offsetY) {
        for (const bullet of this.bullets) {
            bullet.draw(ctx, offsetX, offsetY);
        }
    }
    
    upgrade() {
        super.upgrade();
        this.damage = Math.floor(this.damage * 1.2);
        this.range += 0.5;
        this.fireRate *= 1.1;
    }
}

// Import bullet types
import { MainTowerBullet, CannonBullet, SniperBullet } from './bullets.js';

export class MainTower extends Tower {
    constructor(gridX, gridY) {
        super(gridX, gridY);
        
        // Set main tower properties
        this.range = 5;
        this.damage = 10;
        this.fireRate = 1;
        this.upgradeCost = 100;
        this.baseCost = 0; // Can't sell main tower
        
        // Set size to 2x2
        this.width = 2;
        this.height = 2;
        
        // Set much higher health
        this.health = 1000; 
        this.maxHealth = 1000;
        
        // Main tower level colors
        this.levelColors = {
            base: ['#3498db', '#2980b9', '#1c5a85'],
            barrel: ['#2ecc71', '#27ae60', '#16a085'],
            glow: [null, 'rgba(52, 152, 219, 0.3)', 'rgba(52, 152, 219, 0.5)']
        };
    }
    
    draw(ctx, tileSize) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Position in grid
        const x = this.gridX * tileSize;
        const y = this.gridY * tileSize;
        
        // Draw main tower with enhanced visuals
        const width = tileSize * this.width;
        const height = tileSize * this.height;
        
        // Base gradient
        const baseGradient = ctx.createLinearGradient(x, y, x + width, y + height);
        baseGradient.addColorStop(0, '#3498db');
        baseGradient.addColorStop(1, '#2980b9');
        
        // Draw base with rounded corners
        const radius = width * 0.1; // Corner radius
        ctx.fillStyle = baseGradient;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        
        // Add border highlight
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Add center platform gradient
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const platformRadius = tileSize * 0.4;
        
        const platformGradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, platformRadius
        );
        platformGradient.addColorStop(0, '#2980b9');
        platformGradient.addColorStop(1, '#1c6ea4');
        
        // Draw center platform
        ctx.fillStyle = platformGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, platformRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add metallic details - corners
        ctx.fillStyle = '#7fb3d5';
        
        // Corner decorations
        const cornerSize = tileSize * 0.15;
        // Top left
        this.drawCornerDetail(ctx, x + cornerSize, y + cornerSize, cornerSize);
        // Top right
        this.drawCornerDetail(ctx, x + width - cornerSize, y + cornerSize, cornerSize);
        // Bottom left
        this.drawCornerDetail(ctx, x + cornerSize, y + height - cornerSize, cornerSize);
        // Bottom right
        this.drawCornerDetail(ctx, x + width - cornerSize, y + height - cornerSize, cornerSize);
        
        // Draw multiple rotating barrels (4 barrels for main tower)
        for (let i = 0; i < 4; i++) {
            const angle = this.barrelAngle + (i * Math.PI / 2);
            const offsetDistance = tileSize * 0.2;
            
            // Calculate barrel origin based on rotation
            const barrelX = x + width / 2 + Math.cos(angle) * offsetDistance;
            const barrelY = y + height / 2 + Math.sin(angle) * offsetDistance;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            ctx.translate(-centerX, -centerY);
            
            this.drawBarrel(
                ctx,
                barrelX - offsetDistance * Math.cos(angle),
                barrelY - offsetDistance * Math.sin(angle),
                tileSize,
                '#2980b9',
                tileSize * 0.7,
                tileSize * 0.2
            );
            
            ctx.restore();
        }
        
        // Draw range circle - always show for main tower
        this.drawRangeCircle(ctx, x, y, tileSize, 'rgba(52, 152, 219, 0.3)');
        
        // Draw fixed UI health bar (needs canvasWidth/Height *without* offset)
        ctx.restore(); // Restore before drawing UI bar
        this.drawUIHealthBar(ctx, canvasWidth, canvasHeight);
        ctx.save(); // Save again before drawing bullets with offset
        ctx.translate(offsetX, offsetY);
        
        // Draw bullets
        this.drawBullets(ctx, offsetX, offsetY); // Pass offsets here, bullet draw expects them
        
        // Restore context
        ctx.restore();
    }
    
    drawUIHealthBar(ctx, canvasWidth, canvasHeight) {
        // Save the current transform to restore after drawing
        ctx.save();
        // Reset transform to draw in screen space
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Health bar dimensions
        const barWidth = 200;
        const barHeight = 15;
        const padding = 10;
        
        // Position in top right corner
        const barX = canvasWidth - barWidth - padding;
        const barY = padding;
        
        // Draw background and border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Calculate health percentage
        const healthPercent = this.health / this.maxHealth;
        
        // Health color based on percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = '#2ecc71'; // Green
        } else if (healthPercent > 0.3) {
            healthColor = '#f39c12'; // Orange
        } else {
            healthColor = '#e74c3c'; // Red
        }
        
        // Draw health
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        
        // Draw health text
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.floor(this.health)} / ${this.maxHealth}`,
            barX + barWidth / 2,
            barY + barHeight / 1.5
        );
        
        // Restore the original transform
        ctx.restore();
    }
    
    update(deltaTime, enemies) {
        // Main tower does not regenerate health, so don't call super.update()
        
        // Update bullets
        this.updateBullets(deltaTime, enemies);
        
        // Find target and update barrel rotation
        this.findTarget(enemies);
        this.updateBarrelRotation(deltaTime);
        
        // Handle firing
        this.fireTimer -= deltaTime / 1000;
        
        if (this.fireTimer <= 0 && this.target) {
            this.fire();
            this.fireTimer = 1 / this.fireRate;
        }
    }
    
    // Helper method to draw corner details
    drawCornerDetail(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class CannonTower extends Tower {
    constructor(gridX, gridY) {
        super(gridX, gridY);
        
        // Set cannon tower properties
        this.range = 4;
        this.damage = 20;
        this.fireRate = 0.8;
        this.upgradeCost = 40;
        this.baseCost = 50;
        
        // Set size to 2x2
        this.width = 2;
        this.height = 2;
        
        // Increased health by 2.5x (from 100)
        this.health = 250;
        this.maxHealth = 250;
        
        // Cannon tower level colors
        this.levelColors = {
            base: ['#e74c3c', '#c0392b', '#a83226'],
            barrel: ['#c0392b', '#962d22', '#7d261c'],
            glow: [null, 'rgba(231, 76, 60, 0.3)', 'rgba(231, 76, 60, 0.5)']
        };
    }
    
    draw(ctx, tileSize) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Position in grid
        const x = this.gridX * tileSize;
        const y = this.gridY * tileSize;
        
        // Draw base
        this.drawBase(ctx, x, y, tileSize, '#e74c3c');
        
        // Draw barrel
        this.drawBarrel(
            ctx,
            x,
            y,
            tileSize,
            '#c0392b',
            tileSize * 0.9,
            tileSize * 0.4
        );
        
        // Draw level indicator
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            this.level.toString(),
            x + tileSize * this.width / 2,
            y + tileSize * this.height / 2
        );
        
        // Always draw range circle
        this.drawRangeCircle(ctx, x, y, tileSize, 'rgba(231, 76, 60, 0.3)');
        
        // Draw health bar
        this.drawHealthBar(ctx, x, y, tileSize);
        
        // Draw bullets
        this.drawBullets(ctx, offsetX, offsetY);
        
        ctx.restore();
    }
    
    fire() {
        if (!this.target) return;
        
        // Calculate center of tower in game coordinates
        const towerCenterX = (this.gridX + this.width / 2) * this.game.tileMap.tileSize;
        const towerCenterY = (this.gridY + this.height / 2) * this.game.tileMap.tileSize;
        
        // Create bullet
        const bullet = new CannonBullet(towerCenterX, towerCenterY, this.target, this.damage);
        this.bullets.push(bullet);
        
        // Play cannon shot sound
        if (this.game && this.game.audio) {
            this.game.audio.playSound('cannonShot');
        }
    }
    
    upgrade() {
        super.upgrade();
        this.damage = Math.floor(this.damage * 1.3);
    }
}

export class SniperTower extends Tower {
    constructor(gridX, gridY) {
        super(gridX, gridY);
        
        // Set sniper tower properties
        this.range = 7;
        this.damage = 30;
        this.fireRate = 0.5;
        this.upgradeCost = 60;
        this.baseCost = 75;
        
        // Set size to 2x2
        this.width = 2;
        this.height = 2;
        
        // Increased health by 2.5x (from 80)
        this.health = 200;
        this.maxHealth = 200;
        
        // Sniper tower level colors
        this.levelColors = {
            base: ['#2ecc71', '#27ae60', '#229954'],
            barrel: ['#27ae60', '#229954', '#1e8449'],
            glow: [null, 'rgba(46, 204, 113, 0.3)', 'rgba(46, 204, 113, 0.5)']
        };
    }
    
    draw(ctx, tileSize) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Position in grid
        const x = this.gridX * tileSize;
        const y = this.gridY * tileSize;
        
        // Draw base
        this.drawBase(ctx, x, y, tileSize, '#2ecc71');
        
        // Draw barrel
        this.drawBarrel(
            ctx,
            x,
            y,
            tileSize,
            '#27ae60',
            tileSize * 1.2,
            tileSize * 0.15
        );
        
        // Draw level indicator
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            this.level.toString(),
            x + tileSize * this.width / 2,
            y + tileSize * this.height / 2
        );
        
        // Always draw range circle
        this.drawRangeCircle(ctx, x, y, tileSize, 'rgba(46, 204, 113, 0.3)');
        
        // Draw health bar
        this.drawHealthBar(ctx, x, y, tileSize);
        
        // Draw bullets
        this.drawBullets(ctx, offsetX, offsetY);
        
        ctx.restore();
    }
    
    fire() {
        if (!this.target) return;
        
        // Calculate center of tower in game coordinates
        const towerCenterX = (this.gridX + this.width / 2) * this.game.tileMap.tileSize;
        const towerCenterY = (this.gridY + this.height / 2) * this.game.tileMap.tileSize;
        
        // Create bullet
        const bullet = new SniperBullet(towerCenterX, towerCenterY, this.target, this.damage);
        this.bullets.push(bullet);
        
        // Play sniper shot sound
        if (this.game && this.game.audio) {
            this.game.audio.playSound('sniperShot');
        }
    }
    
    upgrade() {
        super.upgrade();
        this.damage = Math.floor(this.damage * 1.4);
        this.range += 0.8;
    }
}

export class Wall extends Defense {
    constructor(gridX, gridY) {
        super(gridX, gridY);
        
        // Set wall properties
        this.upgradeCost = 20;
        this.baseCost = 10;
        
        // Increased health by 2.5x (from 150)
        this.health = 375;
        this.maxHealth = 375;
        
        // Wall has different color scheme from towers
        this.levelColors = {
            base: ['#8395a7', '#c8d6e5', '#dfe4ea'],
            accent: ['#576574', '#8395a7', '#c8d6e5'],
            highlight: ['#dfe4ea', '#f5f6fa', '#ffffff']
        };
    }
    
    draw(ctx, tileSize) {
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Position in grid
        const x = this.gridX * tileSize;
        const y = this.gridY * tileSize;
        
        // Draw level-based glow first
        this.drawLevelGlow(ctx, x, y, tileSize, tileSize);
        
        // Get level-specific colors
        const baseColor = this.getColorForLevel('base');
        const accentColor = this.getColorForLevel('accent');
        
        // Draw wall base
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, tileSize, tileSize);
        
        // Draw wall details based on level
        if (this.level === 1) {
            // Level 1: Basic wall with cracks
            ctx.fillStyle = accentColor;
            ctx.fillRect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8);
            
            // Add cracks
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + tileSize * 0.3, y + tileSize * 0.3);
            ctx.lineTo(x + tileSize * 0.6, y + tileSize * 0.7);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + tileSize * 0.7, y + tileSize * 0.2);
            ctx.lineTo(x + tileSize * 0.5, y + tileSize * 0.5);
            ctx.stroke();
        } else if (this.level === 2) {
            // Level 2: Reinforced wall
            ctx.fillStyle = accentColor;
            ctx.fillRect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8);
            
            // Add reinforcement bars
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + tileSize * 0.2, y + tileSize * 0.2);
            ctx.lineTo(x + tileSize * 0.8, y + tileSize * 0.2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + tileSize * 0.2, y + tileSize * 0.5);
            ctx.lineTo(x + tileSize * 0.8, y + tileSize * 0.5);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + tileSize * 0.2, y + tileSize * 0.8);
            ctx.lineTo(x + tileSize * 0.8, y + tileSize * 0.8);
            ctx.stroke();
        } else {
            // Level 3: Metal wall with reflective surface
            ctx.fillStyle = baseColor;
            ctx.fillRect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8);
            
            // Add metal details - bolts
            ctx.fillStyle = accentColor;
            
            // Draw bolts in corners
            const boltPositions = [
                {x: 0.25, y: 0.25},
                {x: 0.75, y: 0.25},
                {x: 0.25, y: 0.75},
                {x: 0.75, y: 0.75}
            ];
            
            boltPositions.forEach(pos => {
                // Outer bolt
                ctx.beginPath();
                ctx.arc(
                    x + tileSize * pos.x,
                    y + tileSize * pos.y,
                    tileSize * 0.1,
                    0, Math.PI * 2
                );
                ctx.fill();
                
                // Inner bolt detail
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(
                    x + tileSize * pos.x,
                    y + tileSize * pos.y,
                    tileSize * 0.04,
                    0, Math.PI * 2
                );
                ctx.fill();
                
                ctx.fillStyle = accentColor;
            });
            
            // Add reflective highlight
            const gradient = ctx.createLinearGradient(
                x + tileSize * 0.1,
                y + tileSize * 0.1,
                x + tileSize * 0.9,
                y + tileSize * 0.9
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x + tileSize * 0.1, y + tileSize * 0.1, tileSize * 0.8, tileSize * 0.8);
        }
        
        // Draw health bar
        this.drawHealthBar(ctx, x, y, tileSize);
        
        // Restore context
        ctx.restore();
    }
    
    update(deltaTime) {
        // Call the parent update method for health regeneration
        super.update(deltaTime);
    }
    
    takeDamage(amount) {
        // Call the parent method
        super.takeDamage(amount);
    }
    
    upgrade() {
        super.upgrade();
        
        // Walls get significant health boost on upgrade
        this.maxHealth = Math.floor(this.maxHealth * 1.5);
        this.health = this.maxHealth;
    }
} 