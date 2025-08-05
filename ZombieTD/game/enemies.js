// Base class for all enemy types
class Enemy {
    constructor(gridX, gridY, game) {
        this.game = game; // Store game reference
        this.tileSize = this.game.tileMap.tileSize;
        
        // Position on the grid
        this.gridX = gridX;
        this.gridY = gridY;
        
        // Position in pixels (for smooth movement)
        this.x = gridX * this.tileSize + this.tileSize / 2; // Center of tile
        this.y = gridY * this.tileSize + this.tileSize / 2;
        
        // Enemy properties
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 50; // Pixels per second
        this.damage = 10; // Damage to base when reaching it
        this.goldValue = 10; // Gold rewarded when killed
        
        // Pathfinding
        this.targetX = null;
        this.targetY = null;
        this.path = [];
        this.pathIndex = 0;
        
        // Attack properties
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.attackRate = 0.66 * 1.33; // Attacks per second (approx 2 sec cooldown now)
        
        // Animation properties
        this.animationState = 'moving'; // 'moving', 'attacking', 'recoiling'
        this.animationTimer = 0;
        this.dashDistance = 5; // Pixels to dash forward during attack
        this.dashDuration = 150; // Milliseconds
        this.recoilDuration = 250; // Milliseconds
        
        // Store original position for animation
        this.baseX = this.x;
        this.baseY = this.y;
        // Direction for dash animation
        this.directionX = 0;
        this.directionY = 0;
    }
    
    update(deltaTime, mainTower, tileMap) {
        // Update animation state
        this.updateAnimation(deltaTime);
        
        // Find the nearest tower (including MainTower)
        const nearestTower = this.findNearestTower();
        
        // Check if the enemy has reached the target tower
        if (nearestTower && this.hasReachedTarget(nearestTower)) {
            // Enemy has reached the target
            if (!this.isAttacking) {
                this.isAttacking = true;
            }
            
            // Handle attack cooldown
            this.attackCooldown -= deltaTime;
            
            if (this.attackCooldown <= 0 && this.animationState === 'moving') {
                // Reset attack cooldown
                this.attackCooldown = this.attackRate;
                
                // Start attack animation
                this.startAttackAnimation(nearestTower);
                
                // Signal that damage should be dealt
                return true;
            }
        } else {
            // If the enemy was attacking, reset the state
            if (this.isAttacking) {
                this.isAttacking = false;
            }
        }
        
        // Don't move if in an attack animation
        if (this.animationState !== 'moving') {
            return false;
        }
        
        // Movement logic towards the nearest tower
        if (nearestTower) {
            // Set the target position to the tower's grid position
            this.targetX = nearestTower.gridX + Math.floor(nearestTower.width / 2);
            this.targetY = nearestTower.gridY + Math.floor(nearestTower.height / 2);
            
            // Calculate the next step towards the target (basic pathfinding)
            const diffX = this.targetX - this.gridX;
            const diffY = this.targetY - this.gridY;
            
            // Determine which direction to move in (prioritize the axis with the larger difference)
            let stepX = 0;
            let stepY = 0;
            
            if (Math.abs(diffX) > Math.abs(diffY)) {
                stepX = diffX > 0 ? 1 : -1;
            } else {
                stepY = diffY > 0 ? 1 : -1;
            }
            
            // Calculate the next position
            const nextX = this.gridX + stepX;
            const nextY = this.gridY + stepY;
            
            // Check if the next position is valid - use the tileMap parameter passed from game.js
            if (tileMap.isTileOccupied(nextX, nextY)) {
                // Try the alternate direction
                if (stepX !== 0) {
                    stepX = 0;
                    stepY = diffY > 0 ? 1 : -1;
                } else {
                    stepY = 0;
                    stepX = diffX > 0 ? 1 : -1;
                }
                
                // Recalculate next position
                const alternateX = this.gridX + stepX;
                const alternateY = this.gridY + stepY;
                
                // Check if the alternate position is valid
                if (tileMap.isTileOccupied(alternateX, alternateY)) {
                    // Both direct paths are blocked, try to find any valid move that gets closer
                    const possibleMoves = [
                        { x: this.gridX + 1, y: this.gridY },
                        { x: this.gridX - 1, y: this.gridY },
                        { x: this.gridX, y: this.gridY + 1 },
                        { x: this.gridX, y: this.gridY - 1 }
                    ];
                    
                    // Filter out invalid moves and sort by distance to target
                    const validMoves = possibleMoves
                        .filter(move => !tileMap.isTileOccupied(move.x, move.y))
                        .map(move => {
                            const dist = Math.sqrt(
                                Math.pow(move.x - this.targetX, 2) + 
                                Math.pow(move.y - this.targetY, 2)
                            );
                            return { ...move, distance: dist };
                        })
                        .sort((a, b) => a.distance - b.distance);
                    
                    // If there's a valid move, take it
                    if (validMoves.length > 0) {
                        stepX = validMoves[0].x - this.gridX;
                        stepY = validMoves[0].y - this.gridY;
                    } else {
                        // Completely stuck, don't move
                        return false;
                    }
                }
            }
            
            // Convert grid position to pixel position
            const targetPixelX = (this.gridX + stepX) * this.tileSize + this.tileSize / 2;
            const targetPixelY = (this.gridY + stepY) * this.tileSize + this.tileSize / 2;
            
            // Calculate direction vector
            const dx = targetPixelX - this.x;
            const dy = targetPixelY - this.y;
            
            // Calculate distance
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // Calculate movement based on speed and delta time - match the original time scaling
                const moveX = (dx / distance) * this.speed * (deltaTime / 1000);
                const moveY = (dy / distance) * this.speed * (deltaTime / 1000);
                
                // Check if we would overshoot the target
                if (Math.abs(moveX) > Math.abs(dx) && Math.abs(moveY) > Math.abs(dy)) {
                    // Snap to the target position
                    this.x = targetPixelX;
                    this.y = targetPixelY;
                    
                    // Update grid position
                    this.gridX = Math.floor(this.x / this.tileSize);
                    this.gridY = Math.floor(this.y / this.tileSize);
                } else {
                    // Move towards the target
                    this.x += moveX;
                    this.y += moveY;
                    
                    // Update grid position
                    this.gridX = Math.floor(this.x / this.tileSize);
                    this.gridY = Math.floor(this.y / this.tileSize);
                }
                
                // Update base position for animation
                this.baseX = this.x;
                this.baseY = this.y;
            }
        }
        
        return false; // Not dealing damage this frame
    }
    
    updateAnimation(deltaTime) {
        if (this.animationState === 'attacking') {
            this.animationTimer += deltaTime;
            
            if (this.animationTimer < this.dashDuration) {
                // Calculate dash progress (0 to 1)
                const progress = this.animationTimer / this.dashDuration;
                // Ease out function: progress * (2 - progress)
                const easeOut = progress * (2 - progress);
                
                // Apply dash forward effect
                this.x = this.baseX + this.directionX * this.dashDistance * easeOut;
                this.y = this.baseY + this.directionY * this.dashDistance * easeOut;
            } else {
                // Transition to recoil phase
                this.animationState = 'recoiling';
                this.animationTimer = 0;
            }
        } else if (this.animationState === 'recoiling') {
            this.animationTimer += deltaTime;
            
            if (this.animationTimer < this.recoilDuration) {
                // Calculate recoil progress (0 to 1)
                const progress = this.animationTimer / this.recoilDuration;
                // Ease in function: progress * progress
                const easeIn = progress * progress;
                
                // Apply recoil effect (from dash position back to base)
                this.x = this.baseX + this.directionX * this.dashDistance * (1 - easeIn);
                this.y = this.baseY + this.directionY * this.dashDistance * (1 - easeIn);
            } else {
                // Animation complete, return to base position
                this.x = this.baseX;
                this.y = this.baseY;
                this.animationState = 'moving';
            }
        }
    }
    
    startAttackAnimation(target) {
        // Calculate direction to target
        const towerCenterX = (target.gridX + target.width / 2) * this.tileSize;
        const towerCenterY = (target.gridY + target.height / 2) * this.tileSize;
        
        const dx = towerCenterX - this.x;
        const dy = towerCenterY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.directionX = dx / distance;
            this.directionY = dy / distance;
        } else {
            this.directionX = 0;
            this.directionY = 0;
        }
        
        // Set animation state
        this.animationState = 'attacking';
        this.animationTimer = 0;
    }
    
    calculatePath() {
        // Simplified direct path for now
        // In a more complex implementation, this would use A* or similar pathfinding
        this.path = [];
        
        const dx = this.targetX - this.gridX;
        const dy = this.targetY - this.gridY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 0; i <= steps; i++) {
            const progress = steps === 0 ? 0 : i / steps;
            const x = Math.round(this.gridX + dx * progress);
            const y = Math.round(this.gridY + dy * progress);
            
            this.path.push({ x, y });
        }
    }
    
    moveAlongPath(deltaTime) {
        if (this.pathIndex >= this.path.length) {
            return;
        }
        
        // Get current target point
        const currentTarget = this.path[this.pathIndex];
        const targetPixelX = currentTarget.x * this.tileSize + this.tileSize / 2;
        const targetPixelY = currentTarget.y * this.tileSize + this.tileSize / 2;
        
        // Calculate direction to target
        const dx = targetPixelX - this.x;
        const dy = targetPixelY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) {
            // Reached current path point, move to next
            this.pathIndex++;
            return;
        }
        
        // Move towards target
        const directionX = dx / distance;
        const directionY = dy / distance;
        
        this.x += directionX * this.speed * (deltaTime / 1000);
        this.y += directionY * this.speed * (deltaTime / 1000);
        
        // Update grid position based on pixel position
        this.gridX = Math.floor(this.x / this.tileSize);
        this.gridY = Math.floor(this.y / this.tileSize);
    }
    
    draw(ctx, tileSize) {
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw health bar
        const healthBarWidth = tileSize - 10;
        const currentHealthWidth = healthBarWidth * (this.health / this.maxHealth);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(
            this.x - healthBarWidth / 2,
            this.y - tileSize / 2 - 10,
            healthBarWidth,
            5
        );
        
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(
            this.x - healthBarWidth / 2,
            this.y - tileSize / 2 - 10,
            currentHealthWidth,
            5
        );
        
        // Draw attack status indicator if attacking
        if (this.isAttacking) {
            // Draw attack cooldown indicator
            const attackProgress = 1 - (this.attackCooldown * this.attackRate);
            
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, tileSize / 3 + 5, 0, Math.PI * 2 * attackProgress);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
    
    hasReachedTarget(target) {
        // Calculate center positions
        const targetCenterX = (target.gridX + target.width / 2) * this.tileSize;
        const targetCenterY = (target.gridY + target.height / 2) * this.tileSize;
        
        // Calculate distance between centers
        const dx = this.x - targetCenterX;
        const dy = this.y - targetCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate reach threshold based on enemy and target sizes
        const enemyRadius = this.tileSize / 2;
        const targetRadius = (Math.max(target.width, target.height) * this.tileSize) / 2;
        const reachThreshold = enemyRadius + targetRadius + 10; // Extra padding
        
        return distance < reachThreshold || this.isAdjacentToDefense(target);
    }
    
    isAdjacentToDefense(defense) {
        // Check if we're adjacent to any part of the defense
        for (let dx = 0; dx < defense.width; dx++) {
            for (let dy = 0; dy < defense.height; dy++) {
                const towerTileX = defense.gridX + dx;
                const towerTileY = defense.gridY + dy;
                
                // Check all 8 neighboring positions
                for (let nx = -1; nx <= 1; nx++) {
                    for (let ny = -1; ny <= 1; ny++) {
                        if (nx === 0 && ny === 0) continue; // Skip the cell itself
                        
                        if (this.gridX === towerTileX + nx && this.gridY === towerTileY + ny) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    findNearestTower() {
        let nearestTower = null;
        let shortestDistance = Infinity;
        
        // Check MainTower first
        const mainTower = this.game.mainTower;
        if (mainTower && mainTower.health > 0) {
            const mainTowerCenterX = (mainTower.gridX + mainTower.width / 2) * this.tileSize;
            const mainTowerCenterY = (mainTower.gridY + mainTower.height / 2) * this.tileSize;
            
            const distToMain = Math.sqrt(
                Math.pow(this.x - mainTowerCenterX, 2) + 
                Math.pow(this.y - mainTowerCenterY, 2)
            );
            
            nearestTower = mainTower;
            shortestDistance = distToMain;
        }
        
        // Check all other towers
        if (this.game.towers) {
            for (const tower of this.game.towers) {
                if (tower.health <= 0 || tower.isDestroying) continue;
                
                const towerCenterX = (tower.gridX + tower.width / 2) * this.tileSize;
                const towerCenterY = (tower.gridY + tower.height / 2) * this.tileSize;
                
                const distance = Math.sqrt(
                    Math.pow(this.x - towerCenterX, 2) + 
                    Math.pow(this.y - towerCenterY, 2)
                );
                
                if (distance < shortestDistance) {
                    nearestTower = tower;
                    shortestDistance = distance;
                }
            }
        }
        
        // Check walls also
        if (this.game.walls) {
            for (const wall of this.game.walls) {
                if (wall.health <= 0 || wall.isDestroying) continue;
                
                const wallCenterX = (wall.gridX + wall.width / 2) * this.tileSize;
                const wallCenterY = (wall.gridY + wall.height / 2) * this.tileSize;
                
                const distance = Math.sqrt(
                    Math.pow(this.x - wallCenterX, 2) + 
                    Math.pow(this.y - wallCenterY, 2)
                );
                
                if (distance < shortestDistance) {
                    nearestTower = wall;
                    shortestDistance = distance;
                }
            }
        }
        
        return nearestTower;
    }
}

export class Zombie extends Enemy {
    constructor(gridX, gridY, game) {
        super(gridX, gridY, game);
        this.health = 75;
        this.maxHealth = 75;
        this.speed = 40;
        this.damage = 7.5;
        this.goldValue = 10;
        
        // Slow down attack rate for Zombie (apply the 1.33x multiplier)
        this.attackRate *= 1.33;
    }
    
    draw(ctx, tileSize) {
        super.draw(ctx, tileSize);
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw zombie with improved appearance
        const radius = tileSize / 2.5;
        
        // Body with gradient
        const gradient = ctx.createRadialGradient(
            this.x, this.y, radius * 0.2,
            this.x, this.y, radius
        );
        gradient.addColorStop(0, '#4cd137');
        gradient.addColorStop(1, '#009432');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add texture/detail to zombie
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(this.x - radius/3, this.y - radius/3, radius/4, 0, Math.PI * 2);
        ctx.arc(this.x + radius/2, this.y - radius/4, radius/5, 0, Math.PI * 2);
        ctx.arc(this.x - radius/2, this.y + radius/3, radius/6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = '#dfe4ea';
        ctx.beginPath();
        ctx.arc(this.x - radius/2, this.y - radius/4, radius/4, 0, Math.PI * 2);
        ctx.arc(this.x + radius/2, this.y - radius/4, radius/4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pupils - follow movement direction
        const dirX = Math.sign(this.target ? this.target.x - this.x : 0);
        const dirY = Math.sign(this.target ? this.target.y - this.y : 0);
        
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.arc(
            this.x - radius/2 + dirX * radius/8, 
            this.y - radius/4 + dirY * radius/8, 
            radius/8, 0, Math.PI * 2
        );
        ctx.arc(
            this.x + radius/2 + dirX * radius/8, 
            this.y - radius/4 + dirY * radius/8, 
            radius/8, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Draw mouth
        ctx.strokeStyle = '#2f3542';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y + radius/4, radius/3, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        
        ctx.restore();
    }
}

export class Runner extends Enemy {
    constructor(gridX, gridY, game) {
        super(gridX, gridY, game);
        this.health = 60;
        this.maxHealth = 60;
        this.speed = 80;
        this.damage = 5;
        this.goldValue = 15;
        
        // Slow down attack rate for Runner (apply the 1.33x multiplier)
        this.attackRate *= 1.33;
    }
    
    draw(ctx, tileSize) {
        super.draw(ctx, tileSize);
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw runner with improved appearance
        const size = tileSize / 2;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(
            this.x - size, this.y - size,
            this.x + size, this.y + size
        );
        gradient.addColorStop(0, '#fbc531');
        gradient.addColorStop(1, '#e1b12c');
        
        // Draw body
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - size);
        ctx.lineTo(this.x + size, this.y);
        ctx.lineTo(this.x, this.y + size);
        ctx.lineTo(this.x - size, this.y);
        ctx.closePath();
        ctx.fill();
        
        // Add shadow/highlight
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + size);
        ctx.lineTo(this.x - size, this.y);
        ctx.closePath();
        ctx.fill();
        
        // Add decoration/details
        ctx.strokeStyle = '#2f3542';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Draw lightning bolt pattern
        ctx.moveTo(this.x - size/2, this.y - size/3);
        ctx.lineTo(this.x, this.y - size/6);
        ctx.lineTo(this.x - size/3, this.y + size/3);
        ctx.lineTo(this.x + size/2, this.y);
        ctx.stroke();
        
        // Draw eyes
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        // Position eyes based on the direction of movement
        const dirX = Math.sign(this.target ? this.target.x - this.x : 0);
        const dirY = Math.sign(this.target ? this.target.y - this.y : 0);
        
        const eyeOffsetX = size / 4;
        const eyeOffsetY = size / 4;
        
        // Draw two elliptical eyes that follow movement direction
        ctx.save();
        ctx.translate(this.x - eyeOffsetX, this.y - eyeOffsetY);
        ctx.rotate(Math.atan2(dirY, dirX));
        ctx.scale(1.5, 1);
        ctx.arc(0, 0, size/6, 0, Math.PI * 2);
        ctx.restore();
        
        ctx.save();
        ctx.translate(this.x + eyeOffsetX, this.y - eyeOffsetY);
        ctx.rotate(Math.atan2(dirY, dirX));
        ctx.scale(1.5, 1);
        ctx.arc(0, 0, size/6, 0, Math.PI * 2);
        ctx.restore();
        
        ctx.fill();
        
        ctx.restore();
    }
}

export class Tank extends Enemy {
    constructor(gridX, gridY, game) {
        super(gridX, gridY, game);
        this.health = 200;
        this.maxHealth = 200;
        this.speed = 30;
        this.damage = 20;
        this.goldValue = 25;
        
        // Slow down attack rate for Tank (apply the 1.33x multiplier)
        this.attackRate *= 1.33;
    }
    
    draw(ctx, tileSize) {
        super.draw(ctx, tileSize);
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw tank with improved appearance
        const size = tileSize / 2;
        
        // Create tank body with gradient
        const gradient = ctx.createLinearGradient(
            this.x - size, this.y - size,
            this.x + size, this.y + size
        );
        gradient.addColorStop(0, '#8e44ad');
        gradient.addColorStop(1, '#5f27cd');
        
        // Main tank body (rounded rectangle)
        ctx.fillStyle = gradient;
        const radius = size / 4;
        ctx.beginPath();
        ctx.moveTo(this.x - size + radius, this.y - size);
        ctx.arcTo(this.x + size, this.y - size, this.x + size, this.y - size + radius, radius);
        ctx.arcTo(this.x + size, this.y + size, this.x + size - radius, this.y + size, radius);
        ctx.arcTo(this.x - size, this.y + size, this.x - size, this.y + size - radius, radius);
        ctx.arcTo(this.x - size, this.y - size, this.x - size + radius, this.y - size, radius);
        ctx.closePath();
        ctx.fill();
        
        // Add tank treads
        ctx.fillStyle = '#2f3542';
        // Left tread
        ctx.fillRect(this.x - size - 2, this.y - size, 4, size * 2);
        // Right tread
        ctx.fillRect(this.x + size - 2, this.y - size, 4, size * 2);
        
        // Add tread details
        ctx.strokeStyle = '#dfe4ea';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            // Left tread details
            ctx.beginPath();
            ctx.moveTo(this.x - size - 2, this.y - size + i * size/2);
            ctx.lineTo(this.x - size + 2, this.y - size + i * size/2);
            ctx.stroke();
            
            // Right tread details
            ctx.beginPath();
            ctx.moveTo(this.x + size - 2, this.y - size + i * size/2);
            ctx.lineTo(this.x + size + 2, this.y - size + i * size/2);
            ctx.stroke();
        }
        
        // Add tank turret
        ctx.fillStyle = '#6c5ce7';
        ctx.beginPath();
        ctx.arc(this.x, this.y, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add tank cannon
        ctx.save();
        // Point cannon toward target
        const dirX = this.target ? this.target.x - this.x : 0;
        const dirY = this.target ? this.target.y - this.y : 0;
        const angle = Math.atan2(dirY, dirX);
        
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#353b48';
        ctx.fillRect(0, -size/6, size, size/3);
        ctx.restore();
        
        ctx.restore();
    }
}

export class Boss extends Enemy {
    constructor(gridX, gridY, game) {
        super(gridX, gridY, game);
        this.health = 500;
        this.maxHealth = 500;
        this.speed = 25;
        this.damage = 50;
        this.goldValue = 100;
        
        // Slow down attack rate for Boss (apply the 1.33x multiplier)
        this.attackRate *= 1.33;
    }
    
    draw(ctx, tileSize) {
        super.draw(ctx, tileSize);
        
        // Get map dimensions dynamically from the tileMap
        const mapWidth = this.game.tileMap.cols * tileSize;
        const mapHeight = this.game.tileMap.rows * tileSize;
        
        // Calculate the center of the canvas
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const offsetX = (canvasWidth - mapWidth) / 2;
        const offsetY = (canvasHeight - mapHeight) / 2;
        
        // Apply offset for centering
        ctx.save();
        ctx.translate(offsetX, offsetY);
        
        // Draw boss with improved appearance
        const size = tileSize * 0.75; // Larger size for boss
        
        // Draw boss body (hexagon with gradient)
        const sides = 6;
        
        // Create a gradient for the boss body
        const gradient = ctx.createRadialGradient(
            this.x, this.y, size * 0.3,
            this.x, this.y, size
        );
        gradient.addColorStop(0, '#e84118');
        gradient.addColorStop(0.7, '#c23616');
        gradient.addColorStop(1, '#8B0000');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        // Draw hexagon
        for (let i = 0; i <= sides; i++) {
            const angle = i * 2 * Math.PI / sides + Math.PI / 6; // Rotate to point up
            const x = this.x + size * Math.cos(angle);
            const y = this.y + size * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Add details and patterns
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke(); // Outline the hexagon
        
        // Add inner hexagon pattern
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
            const angle = i * 2 * Math.PI / sides + Math.PI / 6;
            const x = this.x + size * 0.6 * Math.cos(angle);
            const y = this.y + size * 0.6 * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
        
        // Draw crown
        ctx.fillStyle = '#fbc531';
        ctx.beginPath();
        ctx.moveTo(this.x - size * 0.5, this.y - size * 0.7);
        ctx.lineTo(this.x - size * 0.6, this.y - size * 0.4);
        ctx.lineTo(this.x - size * 0.3, this.y - size * 0.5);
        ctx.lineTo(this.x, this.y - size * 0.3);
        ctx.lineTo(this.x + size * 0.3, this.y - size * 0.5);
        ctx.lineTo(this.x + size * 0.6, this.y - size * 0.4);
        ctx.lineTo(this.x + size * 0.5, this.y - size * 0.7);
        ctx.closePath();
        ctx.fill();
        
        // Add jewels to crown
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(this.x, this.y - size * 0.5, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(this.x - size * 0.3, this.y - size * 0.5, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(this.x + size * 0.3, this.y - size * 0.5, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes (menacing)
        ctx.fillStyle = '#dfe4ea';
        ctx.beginPath();
        ctx.arc(this.x - size * 0.25, this.y - size * 0.1, size * 0.15, 0, Math.PI * 2);
        ctx.arc(this.x + size * 0.25, this.y - size * 0.1, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pupils - follow movement direction
        const dirX = Math.sign(this.target ? this.target.x - this.x : 0);
        const dirY = Math.sign(this.target ? this.target.y - this.y : 0);
        
        ctx.fillStyle = '#EA2027';
        ctx.beginPath();
        ctx.arc(
            this.x - size * 0.25 + dirX * size * 0.05, 
            this.y - size * 0.1 + dirY * size * 0.05, 
            size * 0.07, 0, Math.PI * 2
        );
        ctx.arc(
            this.x + size * 0.25 + dirX * size * 0.05, 
            this.y - size * 0.1 + dirY * size * 0.05, 
            size * 0.07, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Draw mouth (evil grin)
        ctx.strokeStyle = '#2f3542';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y + size * 0.2, size * 0.3, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        
        // Draw teeth
        ctx.fillStyle = '#dfe4ea';
        for (let i = -3; i <= 3; i += 2) {
            ctx.beginPath();
            ctx.moveTo(this.x + i * size * 0.08, this.y + size * 0.2);
            ctx.lineTo(this.x + (i + 1) * size * 0.08, this.y + size * 0.2);
            ctx.lineTo(this.x + (i + 0.5) * size * 0.08, this.y + size * 0.35);
            ctx.fill();
        }
        
        ctx.restore();
    }
} 