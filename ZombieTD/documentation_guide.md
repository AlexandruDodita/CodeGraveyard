# Tower Defense Game - Documentation Guide

This document provides a detailed breakdown of each file and class within the `game/` directory.

---

## `game/game.js`

This file contains the main `Game` class, which acts as the central orchestrator for the entire game.

### Class `Game` - General Scope
Manages the overall game state (start, playing, game-over), initializes game components, handles the main game loop, processes user input (clicks, mouse movement), manages game entities (towers, enemies, walls, bullets), and updates the UI.

*   **`Game.constructor()` - Scope:**
    *   Initializes the game by getting references to the canvas and its 2D context.
    *   Sets up initial game state variables (`gold`, `waveNumber`, `score`, `gameState`, etc.).
    *   Initializes arrays to hold game entities (`towers`, `walls`, `enemies`).
    *   Creates instances of core managers: `UIManager`, `AudioManager` and `TileMap` (indirectly via `init`).
    *   Binds necessary methods (`gameLoop`, `handleResize`, etc.) to the class instance.
    *   Attaches event listeners for window resize, canvas clicks, and mouse movement.
    *   Calls `init()` to perform further setup.
*   **`Game.init()` - Scope:**
    *   Sets the initial canvas size by calling `handleResize()`.
    *   Creates the `TileMap` instance with specified dimensions and tile size.
    *   Shows the initial start menu using the `UIManager` (`ui.showScene('start')`).
    *   Starts the main game loop (`requestAnimationFrame(this.gameLoop)`).
*   **`Game.setGameState(state)` - Scope:**
    *   Updates the internal `gameState` property.
    *   Manages the visibility of core UI elements based on the new state (e.g., hides game UI in 'start' or 'game-over', shows it in 'playing').
    *   Starts background music when the state changes to 'playing'.
    *   Plays the game over sound when the state changes to 'game-over'.
    *   Crucially, calls `this.reset()` when the state changes to 'playing' to ensure a clean start or restart.
*   **`Game.reset()` - Scope:**
    *   Resets all core game state variables (`gold`, `waveNumber`, `score`, selection states) to their initial values.
    *   Clears entity arrays (`towers`, `walls`, `enemies`).
    *   Resets the `TileMap` occupation grid completely (no previous state is maintained).
    *   Re-creates the `MainTower` instance at the calculated center position and marks its tiles as occupied.
    *   Resets the `Spawner` instance by calling `spawner.reset()` or creates a new one if it doesn't exist.
    *   Re-connects the spawner's skip timer callback.
    *   Hides any open UI dialogs to ensure a clean UI state.
    *   Updates the game UI elements via `updateUI()`.
*   **`Game.gameLoop(timestamp)` - Scope:**
    *   The heart of the game's execution, called repeatedly via `requestAnimationFrame`.
    *   Calculates `deltaTime` (time elapsed since the last frame) for smooth animations and physics.
    *   Clears the canvas for fresh drawing.
    *   Draws the background and the `TileMap` grid.
    *   If the `gameState` is not 'playing', it skips game logic updates and continues the loop.
    *   Calculates canvas offsets (`offsetX`, `offsetY`) to center the game map on the screen.
    *   Updates and draws all active defenses (`MainTower`, `towers`, `walls`).
        *   Tied to `Defense.update()`, `Defense.draw()`, `Tower.update()`, `Tower.draw()`, etc.
    *   Updates and draws all active `enemies`:
        *   Iterates backwards through the `enemies` array (safe for removal).
        *   Calls `enemy.update()` which handles movement, pathfinding, and attack logic. Captures `isDealingDamage` boolean.
        *   Calls `enemy.draw()`.
        *   Checks if `enemy.health <= 0`. If so, grants gold/score, removes the enemy (`enemies.splice`), updates UI, and continues.
        *   If `isDealingDamage` is true, applies damage to the `MainTower` via `mainTower.takeDamage()`.
        *   Checks if `mainTower.health <= 0`. If so, calls `gameOver()`.
        *   Tied to `Enemy.update()`, `Enemy.draw()`, `Enemy.takeDamage()`.
    *   Updates the `Spawner` by calling `spawner.update()`, passing the *current* game `waveNumber` (which `spawner` now ignores internally but needs for context) and the `enemies` array.
    *   Checks if the `spawner` internally incremented its wave number and updates the game's `waveNumber` and UI accordingly.
        *   Tied to `Spawner.update()`.
    *   Draws the defense placement preview if `isPlacingDefense` is true, using `hoveredGridCoords` and checking placement validity with `tileMap.canPlaceDefense()`.
    *   Requests the next frame of the loop.
*   **`Game.handleResize()` - Scope:**
    *   Attached to the window's 'resize' event.
    *   Resizes the game canvas to match the new window dimensions (`innerWidth`, `innerHeight`).
*   **`Game.handleClick(event)` - Scope:**
    *   Attached to the canvas's 'click' event.
    *   Ignores clicks if `gameState` is not 'playing'.
    *   Calculates the click position relative to the canvas.
    *   Converts screen coordinates to grid coordinates using `tileMap.screenToGrid()`.
    *   If `isPlacingDefense` is true, calls `placeDefense()` with the grid coordinates.
    *   Otherwise, calls `selectDefenseAt()` to potentially open the upgrade/sell dialog.
        *   Tied to `TileMap.screenToGrid()`, `Game.placeDefense()`, `Game.selectDefenseAt()`.
*   **`Game.handleMouseMove(event)` - Scope:**
    *   Attached to the canvas's 'mousemove' event.
    *   Calculates the mouse position relative to the canvas.
    *   Converts screen coordinates to grid coordinates using `tileMap.screenToGrid()`.
    *   Updates `hoveredGridCoords` used for drawing the placement preview.
        *   Tied to `TileMap.screenToGrid()`.
*   **`Game.placeDefense(x, y)` - Scope:**
    *   Called when clicking while `isPlacingDefense` is true.
    *   Determines the type, size, and cost of the defense being placed (`defenseToPlace`).
    *   Checks placement validity using `tileMap.canPlaceDefense()`.
    *   Checks if the player has enough `gold`.
    *   If valid and affordable, creates the appropriate defense instance (`CannonTower`, `SniperTower`, `Wall`), assigns `game` reference to it.
    *   Adds the new defense to the corresponding array (`towers` or `walls`).
    *   Deducts the `gold` cost.
    *   Marks the tiles as occupied using `tileMap.setRectangleOccupied()`.
    *   Updates the UI via `updateUI()`.
    *   Resets the placement state (`isPlacingDefense = false`, `defenseToPlace = null`).
        *   Tied to `TileMap.canPlaceDefense()`, `TileMap.setRectangleOccupied()`, `CannonTower`, `SniperTower`, `Wall` constructors.
*   **`Game.selectDefenseAt(x, y)` - Scope:**
    *   Called when clicking while *not* placing a defense.
    *   Checks if the clicked grid coordinates `(x, y)` fall within the bounds of the `MainTower`.
    *   If not the main tower, iterates through `towers` and `walls` to see if the click falls within their bounds.
    *   If a defense is found at the clicked location, calls `ui.showSellUpgradeDialog()` with the found defense object.
    *   If no defense is found, sets `selectedDefense` to null.
        *   Tied to `UIManager.showSellUpgradeDialog()`.
*   **`Game.removeDefense(defense)` - Scope:**
    *   Called by `UIManager.sellDefense()`.
    *   Prevents removing the `MainTower`.
    *   Marks the tiles occupied by the defense as free using `tileMap.setRectangleOccupied()`.
    *   Removes the defense object from the appropriate array (`walls` or `towers`) using `indexOf` and `splice`.
        *   Tied to `TileMap.setRectangleOccupied()`.
*   **`Game.setDefenseToPlace(type)` - Scope:**
    *   Called by `UIManager.selectTower()` when a tower button in the UI is clicked.
    *   Sets `isPlacingDefense` to true.
    *   Sets `defenseToPlace` to the selected `type` (e.g., 'cannon', 'sniper').
    *   Clears any currently selected defense (`selectedDefense = null`).
*   **`Game.skipWaveTimer()` - Scope:**
    *   Called by the `Spawner`'s skip button callback (which is set up in `Game.reset`).
    *   Calls `spawner.skipTimer()` if the spawner exists.
        *   Tied to `Spawner.skipTimer()`.
*   **`Game.updateUI()` - Scope:**
    *   Updates the text content of the wave counter and gold counter UI elements in the HTML.
    *   (The health counter update was removed as health is shown via the main tower's UI bar).
*   **`Game.gameOver()` - Scope:**
    *   Sets `gameState` to 'game-over'.
    *   Clears only the enemies array but keeps other game state intact, as `reset()` will handle proper reinitialization when restarting.
    *   Plays the game over sound effect using the `AudioManager`.
    *   Calls `ui.showGameOver()` to display the game over screen with the final `score`.
        *   Tied to `UIManager.showGameOver()`, `AudioManager.playSound()`.

---

## `game/spawner.js`

Contains the `Spawner` class, responsible for managing enemy wave progression and spawning individual enemies.

### Class `Spawner` - General Scope
Handles the timing between waves, the timing between individual enemy spawns within a wave, determining which enemies to spawn based on the wave number, creating enemy instances, and managing the wave timer UI (display and skip button). Implements a progressive difficulty curve with appropriate pacing.

*   **`Spawner.constructor(tileMap, game)` - Scope:**
    *   Stores references to the `tileMap` and the main `game` object.
    *   Initializes spawning state variables (`isSpawning`, `waveTimer`, `spawnTimer`, `enemiesLeftToSpawn`).
    *   Sets the initial `waveNumber` to 0 (so the first call to `startWave` makes it wave 1).
    *   Sets `waveEnded` to true and `waveTimer` to 0 to trigger the first wave immediately upon game start/reset.
    *   Initializes `spawnedEnemies` (reference passed from `Game`).
    *   Calculates wave settings via `calculateWaveSettings()`.
    *   Calls `createWaveTimerUI()` to set up the HTML elements for the timer and skip button.
*   **`Spawner.calculateWaveSettings()` - Scope:**
    *   Determines timing settings based on current wave number.
    *   Sets longer breaks between early waves (15 seconds for waves 1-5, gradually decreasing to 8 seconds for waves 16+).
    *   Sets slower spawn rates for early waves (1.5 seconds between spawns for waves 1-5, gradually decreasing to 1 second for waves 11+).
    *   Provides more breathing room for players in early waves to build defenses.
*   **`Spawner.createWaveTimerUI()` - Scope:**
    *   Checks if the timer UI container already exists. If not:
    *   Creates the necessary HTML `div` and `button` elements for the timer display and skip button.
    *   Creates a wave number display showing which wave was just completed.
    *   Assigns IDs and styles the elements (positioning, appearance, background, borders, shadows).
    *   Adds event listeners for the skip button (hover effects and click).
    *   The click listener calls an `onSkipTimer` callback function (which is set by `Game` using `setSkipTimerCallback`).
    *   Appends the created elements to the document body.
    *   Initially hides the timer UI using `hideWaveTimerUI()`.
*   **`Spawner.showWaveTimerUI()` - Scope:**
    *   Makes the wave timer container visible by setting its `display` style to 'block'.
    *   Updates the wave number text to show which wave was just completed.
    *   Shows a special message ("Prepare for Wave 1!") before the first wave.
*   **`Spawner.hideWaveTimerUI()` - Scope:**
    *   Hides the wave timer container by setting its `display` style to 'none'.
*   **`Spawner.updateWaveTimerUI(seconds)` - Scope:**
    *   Updates the text content of the wave timer display element with the remaining `seconds`.
*   **`Spawner.update(deltaTime, waveNumber, currentEnemies)` - Scope:**
    *   Receives `deltaTime`, the *game's* `waveNumber` (which it ignores for its internal logic), and the `currentEnemies` array reference from the `Game` loop.
    *   Updates its `spawnedEnemies` reference.
    *   **If `isSpawning` is true:**
        *   Hides the wave timer UI.
        *   Decrements the `spawnTimer`.
        *   If `spawnTimer` reaches zero and enemies are left to spawn, calls `spawnEnemy()`, resets `spawnTimer`, decrements `enemiesLeftToSpawn`.
        *   If `enemiesLeftToSpawn` reaches zero, sets `isSpawning` to false, `waveEnded` to true, recalculates wave settings using `calculateWaveSettings()` and resets the `waveTimer` for the countdown to the *next* wave.
    *   **If `isSpawning` is false:**
        *   Checks if the `waveEnded` is true (meaning the spawning phase is done) AND if `currentEnemies.length === 0` (all enemies are defeated).
        *   If both conditions are met, it means the countdown between waves should be active:
            *   Shows the wave timer UI.
            *   Decrements the `waveTimer`.
            *   Updates the UI text via `updateWaveTimerUI()`.
            *   If `waveTimer` reaches zero, calls `startWave()` to begin the next spawning phase, sets `waveEnded` to false, and plays the wave start sound.
*   **`Spawner.startWave()` - Scope:**
    *   Called automatically when the `waveTimer` countdown finishes or manually via the skip button logic.
    *   Hides the wave timer UI.
    *   Sets `isSpawning` to true.
    *   Resets `waveTimer` (for the *next* inter-wave countdown, although it's not used immediately).
    *   Resets `spawnTimer` to 0 for the first spawn.
    *   **Increments its internal `this.waveNumber`.**
    *   Calculates `enemiesLeftToSpawn` based on the new `this.waveNumber` (increases difficulty with more controlled progression).
    *   Logs the start of the wave.
    *   Recalculates wave settings for spawn timing.
*   **`Spawner.skipTimer()` - Scope:**
    *   Called by the `onSkipTimer` callback (triggered by the skip button click in the UI).
    *   If the spawner is *not* currently spawning (`!isSpawning`) and the wave *has* ended (`waveEnded`), it sets the `waveTimer` to 0, causing `update()` to immediately trigger `startWave()` on the next frame.
    *   Plays the wave start sound when skipping.
*   **`Spawner.setSkipTimerCallback(callback)` - Scope:**
    *   Allows the `Game` class to provide the function (`Game.skipWaveTimer`) that should be executed when the skip button is clicked.
*   **`Spawner.spawnEnemy()` - Scope:**
    *   Finds an available spawn location on the edge of the map using `tileMap.findUnoccupiedEdgeTile()`.
    *   Determines the type of enemy to create based on `this.waveNumber` (introduces tougher enemies and bosses on specific waves).
    *   Creates a new instance of the chosen enemy class (`Zombie`, `Runner`, `Tank`, `Boss`), passing the spawn coordinates and the `game` reference.
    *   Scales the enemy's health based on the `waveNumber` (doesn't scale wave 1).
    *   Pushes the newly created `enemy` object into the `spawnedEnemies` array (which is the same array as `Game.enemies`).
        *   Tied to `TileMap.findUnoccupiedEdgeTile()`, `Zombie`, `Runner`, `Tank`, `Boss` constructors.
*   **`Spawner.reset()` - Scope:**
    *   Called by `Game.reset()`.
    *   Resets all internal state variables (`isSpawning`, `waveTimer`, `spawnTimer`, `enemiesLeftToSpawn`, `waveNumber`, `waveEnded`) to their initial constructor values, ensuring a clean state for game restarts.
    *   Recalculates timings for wave 1.
    *   Hides the wave timer UI.

---

## `game/enemies.js`

Defines the base `Enemy` class and its various subclasses (`Zombie`, `Runner`, `Tank`, `Boss`), handling their behavior, movement, attacking, and drawing.

### Class `Enemy` - General Scope
Base class for all enemy types. Manages common properties like health, speed, damage, gold value, position (grid and pixel), pathfinding (simplified), attack state, and animation state. Provides core `update` and `draw` logic, damage handling, and target checking.

*   **`Enemy.constructor(gridX, gridY, game)` - Scope:**
    *   Stores the `game` reference and the `tileSize` from the `game.tileMap`.
    *   Sets initial grid position (`gridX`, `gridY`).
    *   Calculates initial pixel position (`x`, `y`) based on grid position and `tileSize`, centering the enemy in the tile.
    *   Initializes default properties (`health`, `maxHealth`, `speed`, `damage`, `goldValue`). Subclasses override these.
    *   Initializes pathfinding variables (`targetX/Y`, `path`, `pathIndex`).
    *   Initializes attack properties (`isAttacking`, `attackCooldown`, `attackRate`).
    *   Initializes animation properties (`animationState`, `animationTimer`, `dashDistance`, `dashDuration`, `recoilDuration`).
    *   Stores the initial pixel position (`baseX`, `baseY`) for animation reference.
    *   Initializes `directionX/Y` for attack animation.
*   **`Enemy.update(deltaTime, mainTower, tileMap)` - Scope:**
    *   Calls `updateAnimation()` to handle attack animations.
    *   Checks if the enemy has reached the `mainTower` using `hasReachedTarget()`.
        *   **If reached:** Sets `isAttacking` true (if not already), handles `attackCooldown`. If cooldown is ready and the enemy is not mid-animation (`animationState === 'moving'`), it starts the attack animation via `startAttackAnimation()`, resets the cooldown, and returns `true` (signaling damage should be dealt this frame in `Game.gameLoop`).
        *   **If not reached:** If the enemy *was* attacking (`isAttacking` is true), sets `isAttacking` back to false.
    *   If the enemy is currently in an attack animation (`animationState !== 'moving'`), returns `false` (no movement or damage dealing).
    *   **Movement Logic:**
        *   Sets the `targetX`, `targetY` to the `mainTower`'s grid position.
        *   Calculates the next step (`stepX`, `stepY`) towards the target tile, prioritizing the axis with the larger difference.
        *   Checks if the `nextX`, `nextY` tile is occupied using `tileMap.isTileOccupied()`.
        *   If occupied, attempts to move along the alternate axis. If that's also blocked, tries to find *any* unoccupied neighboring tile that is closer to the target (basic obstacle avoidance).
        *   If stuck, returns `false`.
        *   Converts the valid `nextX`, `nextY` grid position to target pixel coordinates (`targetPixelX`, `targetPixelY`), centered in the tile, using `this.tileSize`.
        *   Calculates the vector and distance to the `targetPixelX`, `targetPixelY`.
        *   Moves the enemy's pixel position (`this.x`, `this.y`) towards the target based on `this.speed` and `deltaTime`.
        *   If the movement distance would overshoot the target pixel, snaps the enemy to the target pixel center and updates `this.gridX`, `this.gridY`.
        *   Otherwise, updates `this.x`, `this.y` and recalculates `this.gridX`, `this.gridY` based on the new pixel position.
        *   Updates `baseX`, `baseY` for animations.
    *   Returns `false` if not dealing damage this frame.
        *   Tied to `Enemy.updateAnimation()`, `Enemy.hasReachedTarget()`, `Enemy.startAttackAnimation()`, `TileMap.isTileOccupied()`.
*   **`Enemy.updateAnimation(deltaTime)` - Scope:**
    *   Handles the 'attacking' (dash forward) and 'recoiling' phases of the attack animation.
    *   Increments `animationTimer`.
    *   Calculates animation progress (0 to 1).
    *   Uses easing functions (`easeOut` for dash, `easeIn` for recoil) to smoothly interpolate the enemy's `x`, `y` position between `baseX/Y` and the dashed position based on `dashDistance` and `directionX/Y`.
    *   Transitions between 'attacking', 'recoiling', and 'moving' states based on timer durations (`dashDuration`, `recoilDuration`).
    *   Resets `x`, `y` to `baseX`, `baseY` when the animation completes.
*   **`Enemy.startAttackAnimation(target)` - Scope:**
    *   Calculates the direction vector (`directionX`, `directionY`) from the enemy's current position to the center of the `target` (Main Tower) using `this.tileSize`.
    *   Sets `animationState` to 'attacking'.
    *   Resets `animationTimer` to 0.
*   **`Enemy.calculatePath()` - Scope:** (Currently unused due to simplified direct movement)
    *   Intended for more complex pathfinding (like A*).
    *   Calculates a simple straight-line path for demonstration.
*   **`Enemy.moveAlongPath(deltaTime)` - Scope:** (Currently unused)
    *   Logic to move the enemy along the pre-calculated `path` array.
*   **`Enemy.draw(ctx, tileSize)` - Scope:**
    *   This is the base draw method, primarily responsible for drawing the health bar and attack indicator, common to all enemies.
    *   Calculates canvas offset similar to `Defense.draw` using `this.game.tileMap` dimensions.
    *   Applies the offset translation.
    *   Draws the background and foreground of the health bar above the enemy's position (`this.x`, `this.y`), scaled by `this.health / this.maxHealth`.
    *   If `isAttacking`, draws a circular indicator showing attack cooldown progress.
    *   Restores canvas context.
    *   **Note:** Subclasses (`Zombie`, `Runner`, etc.) call `super.draw(ctx, tileSize)` first, then draw their specific shapes.
*   **`Enemy.takeDamage(amount)` - Scope:**
    *   Decreases `this.health` by the specified `amount`.
    *   Returns `true` if health drops to 0 or below, `false` otherwise. (Used in `Game.gameLoop` to check for death).
*   **`Enemy.hasReachedTarget(mainTower)` - Scope:**
    *   Calculates the pixel distance between the enemy's center (`this.x`, `this.y`) and the `mainTower`'s center (calculated using `mainTower` grid position, dimensions, and `this.tileSize`).
    *   Defines a `reachThreshold` (e.g., 1.5 times `tileSize`).
    *   Returns `true` if the distance is less than the threshold OR if `isAdjacentToTower()` returns true.
*   **`Enemy.isAdjacentToTower(tower)` - Scope:**
    *   Checks if the enemy's current grid position (`this.gridX`, `this.gridY`) is directly adjacent (including diagonals) to any of the tiles occupied by the `tower`.
    *   Iterates through the tower's tiles and their 8 neighbors.

### Class `Zombie` extends `Enemy` - General Scope
Standard, slow-moving enemy type.

*   **`Zombie.constructor(gridX, gridY, game)` - Scope:**
    *   Calls the parent `Enemy` constructor.
    *   Overrides default properties: lower `speed`, specific `health`, `damage`, `goldValue`.
*   **`Zombie.draw(ctx, tileSize)` - Scope:**
    *   Calls `super.draw()` to draw the health bar.
    *   Calculates canvas offset.
    *   Draws the Zombie's visual representation (a green circle with eyes) at `this.x`, `this.y`.

### Class `Runner` extends `Enemy` - General Scope
Fast-moving, lower health enemy.

*   **`Runner.constructor(gridX, gridY, game)` - Scope:**
    *   Calls the parent `Enemy` constructor.
    *   Overrides default properties: higher `speed`, lower `health`, lower `damage`, higher `goldValue`.
*   **`Runner.draw(ctx, tileSize)` - Scope:**
    *   Calls `super.draw()`.
    *   Calculates canvas offset.
    *   Draws the Runner's visual representation (a yellow diamond) at `this.x`, `this.y`.

### Class `Tank` extends `Enemy` - General Scope
Slow-moving, high health, high damage enemy.

*   **`Tank.constructor(gridX, gridY, game)` - Scope:**
    *   Calls the parent `Enemy` constructor.
    *   Overrides default properties: lower `speed`, higher `health`, higher `damage`, higher `goldValue`.
*   **`Tank.draw(ctx, tileSize)` - Scope:**
    *   Calls `super.draw()`.
    *   Calculates canvas offset.
    *   Draws the Tank's visual representation (a purple square) at `this.x`, `this.y`.

### Class `Boss` extends `Enemy` - General Scope
Very slow, extremely high health, high damage enemy, typically appearing on specific waves.

*   **`Boss.constructor(gridX, gridY, game)` - Scope:**
    *   Calls the parent `Enemy` constructor.
    *   Overrides default properties: lowest `speed`, highest `health`, highest `damage`, highest `goldValue`.
*   **`Boss.draw(ctx, tileSize)` - Scope:**
    *   Calls `super.draw()`.
    *   Calculates canvas offset.
    *   Draws the Boss's visual representation (a large red hexagon with a yellow crown) at `this.x`, `this.y`.

---

## `game/defenses.js`

Defines the base `Defense` class, the intermediate `Tower` class, and specific defense types (`MainTower`, `CannonTower`, `SniperTower`, `Wall`).

### Class `Defense` - General Scope
Abstract base class for all placeable defensive structures (Towers and Walls). Manages common properties like grid position, level, upgrade cost, size, health, regeneration, and provides base methods for drawing, updating health, taking damage, and upgrading.

*   **`Defense.constructor(gridX, gridY)` - Scope:**
    *   Sets initial grid position (`gridX`, `gridY`).
    *   Initializes `level`, `upgradeCost`, default `width`/`height`, `baseCost`, `totalSpent` (for sell value).
    *   Initializes health properties (`health`, `maxHealth`, `lastHealthChange`, `healthBarOpacity`).
    *   Initializes regeneration properties (`regenTimer`, `regenRate`, `regenInterval`).
    *   Sets up level-based visual effects with color palettes for different levels.
    *   **Note:** Does *not* store `game` reference directly; subclasses rely on `this.game` being set by the `Game` class after instantiation.
*   **`Defense.draw(ctx, tileSize)` - Scope:**
    *   Calculates canvas center and map dimensions dynamically using `this.game.tileMap.cols`/`rows`.
    *   Calculates and applies the canvas offset (`offsetX`, `offsetY`) for centering.
    *   Gets the base pixel position (`x`, `y`) for the defense based on `gridX`, `gridY`, `tileSize`.
    *   Calls `drawHealthBar()` to potentially draw the health bar (visibility handled within that method).
    *   Restores canvas context.
*   **`Defense.drawHealthBar(ctx, x, y, tileSize)` - Scope:**
    *   Checks if the instance is the `MainTower`. The main tower's health bar is handled by its own `drawUIHealthBar`.
    *   Calculates health percentage.
    *   For non-main towers, fades out (`healthBarOpacity`) if health is full, otherwise sets opacity to 1.
    *   Calculates bar dimensions and position (above the defense).
    *   Draws the gray background and the colored health portion (color changes based on health percentage).
*   **`Defense.getColorForLevel(colorType)` - Scope:**
    *   Returns the appropriate color from the `levelColors` array for the defense's current level.
    *   Used to style the defense visually based on its upgrade level.
*   **`Defense.drawLevelGlow(ctx, x, y, width, height)` - Scope:**
    *   Draws a radial gradient glow effect around the defense based on its level.
    *   Level 1 defenses have no glow, level 2 have a white glow, level 3 have a golden glow.
    *   Creates a visual indicator of the defense's power level.
*   **`Defense.update(deltaTime)` - Scope:**
    *   Handles health regeneration logic.
    *   If the instance is *not* a `MainTower` and `health < maxHealth`, increments `regenTimer`.
    *   If `regenTimer` exceeds `regenInterval`, adds `regenRate` to `health` (clamped to `maxHealth`) and resets the timer.
*   **`Defense.takeDamage(amount)` - Scope:**
    *   Decreases `health` by `amount`, clamped at 0.
    *   Records the time of damage (`lastHealthChange`) - currently unused but could be for effects.
    *   Sets `healthBarOpacity` to 1 to ensure the health bar is visible.
*   **`Defense.upgrade()` - Scope:**
    *   Tracks the amount spent on upgrades in `totalSpent`.
    *   Increments `level`, increases `upgradeCost` by 50%.
    *   Increases `maxHealth` by 20% and heals the defense to full.
    *   Plays upgrade sound effect via the audio manager.

### Class `Tower` extends `Defense` - General Scope
Abstract base class specifically for *attacking* towers. Inherits from `Defense` and adds properties and methods related to targeting, firing, range, damage, fire rate, and bullet management.

*   **`Tower.constructor(gridX, gridY)` - Scope:**
    *   Calls `super()` (the `Defense` constructor).
    *   Initializes tower-specific properties: `range`, `damage`, `fireRate`, `fireTimer`, `target` (initially null).
    *   Initializes barrel rotation properties: `barrelAngle`, `targetAngle`, `rotationSpeed`.
    *   Initializes `bullets` array.
    *   Sets tower-specific level color schemes.
*   **`Tower.update(deltaTime, enemies)` - Scope:**
    *   Calls `super.update(deltaTime)` to handle health regeneration (from `Defense`).
    *   Calls `updateBullets()` to update and remove inactive bullets.
    *   Calls `findTarget()` to identify the closest enemy within range.
    *   Calls `updateBarrelRotation()` to smoothly rotate the barrel towards the target.
    *   Decrements `fireTimer`.
    *   If `fireTimer` <= 0 and a `target` exists, calls `fire()` and resets `fireTimer` based on `fireRate`.
        *   Tied to `Tower.updateBullets()`, `Tower.findTarget()`, `Tower.updateBarrelRotation()`, `Tower.fire()`.
*   **`Tower.updateBullets(deltaTime, enemies)` - Scope:**
    *   Iterates backwards through the `this.bullets` array.
    *   Calls `bullet.update()` for each bullet.
    *   If `bullet.isActive` becomes false, removes the bullet from the array using `splice`.
        *   Tied to `Bullet.update()`.
*   **`Tower.findTarget(enemies)` - Scope:**
    *   Resets `this.target` to null.
    *   Calculates the tower's center pixel coordinates using `gridX`, `width`, `height`, and the tile size from `this.game.tileMap.tileSize`.
    *   Iterates through the `enemies` array provided by `Game`.
    *   Calculates the distance from the tower center to each enemy's center (`enemy.x`, `enemy.y`).
    *   If an enemy is closer than the current `closestDistance` and within `this.range` (converted to pixels using hardcoded 40), it becomes the new `target`.
    *   Updates `this.targetAngle` (the angle towards the new target).
*   **`Tower.updateBarrelRotation(deltaTime)` - Scope:**
    *   If no `target`, does nothing.
    *   Calculates the shortest angle difference (`angleDiff`) between `barrelAngle` and `targetAngle` (handles wrapping around PI).
    *   Calculates the maximum rotation step based on `rotationSpeed` and `deltaTime`.
    *   Rotates `barrelAngle` towards `targetAngle` by the calculated step, ensuring it doesn't overshoot.
    *   Normalizes `barrelAngle` to be within [0, 2*PI].
*   **`Tower.fire()` - Scope:**
    *   **Base implementation (used by `MainTower` implicitly if not overridden):** Calculates tower center pixel coordinates (using hardcoded 40), creates a `MainTowerBullet`, and pushes it to `this.bullets`.
    *   Plays the appropriate shooting sound based on the tower type using the audio manager.
    *   **Note:** Specific tower subclasses (`CannonTower`, `SniperTower`) override this to create their specific bullet types.
*   **`Tower.drawBase(ctx, x, y, tileSize, color)` - Scope:**
    *   Helper method to draw a tower base with level-specific styling.
    *   Uses the tower's level colors or a provided override color.
    *   Draws the level-based glow effect for levels 2-3.
    *   Creates a gradient fill with 3D shading effects.
    *   Adds corner bolts and mechanical details.
    *   Draws the tower's level number in the center.
    *   Adds a decorative star for level 3 towers.
*   **`Tower.drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius)` - Scope:**
    *   Helper method to draw a golden star shape for level 3 towers.
    *   Creates a polygonal star using mathematical calculations.
*   **`Tower.drawBarrel(ctx, x, y, tileSize, color, length, width)` - Scope:**
    *   Helper method to draw the tower's barrel.
    *   Uses level-specific barrel colors or a provided override color.
    *   Calculates the tower's center pixel coordinates.
    *   Saves canvas context, translates to the center, rotates by `this.barrelAngle`.
    *   Draws the rectangular barrel shape with gradient and highlights.
    *   Adds level-specific barrel enhancements (highlight line for levels 2-3, golden tip for level 3).
    *   Draws a muzzle flash effect when firing.
    *   Restores canvas context.
*   **`Tower.drawRangeCircle(ctx, x, y, tileSize, color)` - Scope:**
    *   Helper method to draw the tower's range indicator.
    *   Calculates the tower's center pixel coordinates.
    *   Draws a circle with radius `this.range * tileSize` centered on the tower.
*   **`Tower.drawBullets(ctx, offsetX, offsetY)` - Scope:**
    *   Iterates through `this.bullets`.
    *   Calls `bullet.draw()` for each active bullet, passing the canvas offsets.
        *   Tied to `Bullet.draw()`.
*   **`Tower.upgrade()` - Scope:**
    *   Base upgrade logic for towers.
    *   Calls `super.upgrade()` (from `Defense`) to handle level, cost, health increase, and healing.
    *   Increases tower-specific stats: `damage`, `range`, `fireRate`.
    *   **Note:** Subclasses can override this to provide different stat scaling.

### Class `MainTower` extends `Tower` - General Scope
The central tower that players must defend. Acts as both a stronghold and an offensive tower.

*   **`MainTower.constructor(gridX, gridY)` - Scope:**
    *   Calls `super()` (the `Tower` constructor).
    *   Sets tower-specific properties: `range`, `damage`, `fireRate`, `upgradeCost`, `baseCost`.
    *   Sets `width` and `height` to 2 (2x2 tiles).
    *   Sets higher initial `health` and `maxHealth` (1000).
*   **`MainTower.draw(ctx, tileSize)` - Scope:**
    *   Calculates offsets for canvas centering.
    *   Creates an enhanced visual representation with:
        *   A rounded gradient base with border highlights
        *   A central platform with radial gradient
        *   Metallic corner details with highlights
        *   Four rotating barrels that move independently
        *   A range circle showing attack radius
    *   Draws the UI health bar at the top of the screen.
    *   Renders active bullets.
*   **`MainTower.drawCornerDetail(ctx, x, y, size)` - Scope:**
    *   Helper method that draws decorative corner elements with highlights.
*   **`MainTower.drawUIHealthBar(ctx, canvasWidth, canvasHeight)` - Scope:**
    *   Draws a fixed-position health bar at the top of the screen.
    *   Shows current health as a colored bar that changes from green to orange to red based on health percentage.
    *   Displays health as text (current/max).
*   **`MainTower.update(deltaTime, enemies)` - Scope:**
    *   Overrides `Tower.update()`.
    *   Does not use health regeneration.
    *   Updates bullets, finds targets, updates barrel rotation, handles firing.
*   **`MainTower.fire()` - Scope:**
    *   Creates a `MainTowerBullet` at the tower's center, targeting the current enemy.
    *   Adds the bullet to the `bullets` array.

### Class `CannonTower` extends `Tower` - General Scope
A 2x2 tower firing splash damage bullets.

*   **`CannonTower.constructor(gridX, gridY)` - Scope:**
    *   Calls `super()`.
    *   Sets specific stats: `range`, `damage`, `fireRate`, `upgradeCost`, `baseCost`.
    *   Sets `width` and `height` to 2.
    *   Sets initial `health` and `maxHealth`.
*   **`CannonTower.draw(ctx, tileSize)` - Scope:**
    *   Calculates canvas offset using dynamic map dimensions.
    *   Applies offset.
    *   Draws base using `drawBase()`, barrel using `drawBarrel()`, level indicator text, and range circle using `drawRangeCircle()`.
    *   Draws health bar using `drawHealthBar()`.
    *   Draws bullets using `drawBullets()`.
    *   Restores context.
*   **`CannonTower.fire()` - Scope:**
    *   Calculates tower center pixel coordinates (using hardcoded 40 - FIX NEEDED).
    *   Creates a `CannonBullet` instance.
    *   Pushes the bullet to `this.bullets`.
        *   Tied to `CannonBullet` constructor.
*   **`CannonTower.upgrade()` - Scope:**
    *   Calls `super.upgrade()` to get base tower upgrades (range, fire rate, health).
    *   Provides additional `damage` increase specific to cannons.

### Class `SniperTower` extends `Tower` - General Scope
A 2x2 tower firing long-range, high-damage, penetrating bullets.

*   **`SniperTower.constructor(gridX, gridY)` - Scope:**
    *   Calls `super()`.
    *   Sets specific stats: longer `range`, higher `damage`, slower `fireRate`, `upgradeCost`, `baseCost`.
    *   Sets `width` and `height` to 2.
    *   Sets initial `health` and `maxHealth`.
*   **`SniperTower.draw(ctx, tileSize)` - Scope:**
    *   Calculates canvas offset using dynamic map dimensions.
    *   Applies offset.
    *   Draws base, barrel (long/thin), level indicator, and range circle.
    *   Draws health bar.
    *   Draws bullets.
    *   Restores context.
*   **`SniperTower.fire()` - Scope:**
    *   Calculates tower center pixel coordinates (using hardcoded 40 - FIX NEEDED).
    *   Creates a `SniperBullet` instance.
    *   Pushes the bullet to `this.bullets`.
        *   Tied to `SniperBullet` constructor.
*   **`SniperTower.upgrade()` - Scope:**
    *   Calls `super.upgrade()`.
    *   Provides additional `damage` and `range` increases specific to snipers.

### Class `Wall` extends `Defense` - General Scope
A simple 1x1 defensive structure that blocks enemies but does not attack. Has health and can be upgraded.

*   **`Wall.constructor(gridX, gridY)` - Scope:**
    *   Calls `super()` (the `Defense` constructor).
    *   Sets specific `upgradeCost`, `baseCost`.
    *   Sets initial `health` and `maxHealth`.
    *   Sets wall-specific level color schemes for visual styling.
*   **`Wall.draw(ctx, tileSize)` - Scope:**
    *   Calculates canvas offset using dynamic map dimensions.
    *   Applies offset.
    *   Calls `drawLevelGlow()` to add level-specific glow effects.
    *   Retrieves level-specific colors for the base and accent elements.
    *   Draws the wall's visual representation with details changing based on level:
        *   Level 1: Simple wall with cracks
        *   Level 2: Reinforced wall with horizontal metal bars
        *   Level 3: Advanced metal wall with bolts and reflective surface
    *   Draws health bar using `drawHealthBar()`.
    *   Restores context.
*   **`Wall.update(deltaTime)` - Scope:**
    *   Calls `super.update(deltaTime)` to handle health regeneration.
*   **`Wall.takeDamage(amount)` - Scope:**
    *   Calls `super.takeDamage(amount)` to reduce health and show health bar.
*   **`Wall.upgrade()` - Scope:**
    *   Calls `super.upgrade()` (handles level, cost, base health increase).
    *   Provides a *significant* additional `maxHealth` boost specific to walls.

---

## `game/bullets.js`

Defines the base `Bullet` class and specific bullet types (`CannonBullet`, `SniperBullet`, `MainTowerBullet`).

### Class `Bullet` - General Scope
Represents a projectile fired by a tower. Handles its movement towards a target, collision detection, applying damage (including splash and penetration), and visual representation.

*   **`Bullet.constructor(x, y, targetEnemy, config = {})` - Scope:**
    *   Sets initial pixel position (`x`, `y`) based on the tower's calculated center.
    *   Stores the initial `targetEnemy`.
    *   Stores initial position (`initialX`, `initialY`) for debugging.
    *   Uses the `config` object to set properties, with defaults: `damage`, `penetration`, `splashRadius`, `splashMultiplier`, `speed`, `size`, `color`, `shape`, `width`, `height`, `lifeSpan`.
    *   Initializes `hitEnemies` (a Set to track enemies already hit by this bullet for penetration/splash logic).
    *   Sets `isActive` to true.
*   **`Bullet.update(deltaTime, enemies)` - Scope:**
    *   Decrements `lifeSpan`. If <= 0, sets `isActive` to false and returns.
    *   Checks if the `target` is invalid (null or health <= 0).
        *   If invalid and other `enemies` exist, finds the new closest enemy *not* already in `hitEnemies` and sets it as the new `target`.
        *   If no valid new target found, sets `isActive` to false.
        *   If no enemies left, sets `isActive` to false.
    *   Calculates vector and distance to the current `target`'s center (`target.x`, `target.y`).
    *   **Collision Check:** If the distance is less than or equal to half the bullet's `size` plus an approximate enemy radius (15px), calls `handleCollision()` and returns.
    *   **Movement:** Moves the bullet's `x`, `y` position towards the target based on `speed` and `deltaTime`.
*   **`Bullet.handleCollision(enemies)` - Scope:**
    *   Called when the bullet reaches its target.
    *   Checks if the `target` is valid and hasn't already been hit by this bullet.
    *   Applies `this.damage` to the `target` using `target.takeDamage()`.
    *   Adds the `target` to the `hitEnemies` set.
    *   **Splash Damage:** If `splashRadius > 0`:
        *   Iterates through all `enemies`.
        *   Skips the primary target or enemies already hit.
        *   Calculates distance from the *primary target's* location to the other enemy.
        *   If within `splashRadius`, applies splash damage (`this.damage * this.splashMultiplier`) to the secondary enemy using `takeDamage()` and adds it to `hitEnemies`.
    *   **Penetration Check:** If the number of enemies hit (`hitEnemies.size`) reaches or exceeds `this.penetration`, sets `isActive` to false.
        *   Tied to `Enemy.takeDamage()`.
*   **`Bullet.draw(ctx, offsetX, offsetY)` - Scope:**
    *   Does nothing if `isActive` is false.
    *   Saves context state with `ctx.save()`.
    *   **Note: Does not apply offsetX/offsetY translation as these are already handled by the tower's coordinate system.**
    *   If `shape` is 'rectangle':
        *   Calculates angle towards the `target`.
        *   Translates to the bullet's `x`, `y`, rotates by the angle.
        *   Draws a rectangle with glow effects and highlights.
    *   If `shape` is 'circle' (or default):
        *   Draws an enhanced circular bullet with glowing effects using radial gradients.
        *   Adds highlights and reflections for a more realistic appearance.
    *   Adds particle trails behind the bullet, creating a motion blur effect.
    *   Restores context with `ctx.restore()`.

### Class `CannonBullet` extends `Bullet` - General Scope
A bullet with splash damage.

*   **`CannonBullet.constructor(x, y, targetEnemy, damage)` - Scope:**
    *   Calls `super()` (the `Bullet` constructor), passing specific config values: high `splashRadius`, moderate `splashMultiplier`, slow `speed`, large `size`, specific `color`, 'circle' `shape`.

### Class `SniperBullet` extends `Bullet` - General Scope
A fast, penetrating, rectangular bullet.

*   **`SniperBullet.constructor(x, y, targetEnemy, damage)` - Scope:**
    *   Calls `super()`, passing specific config values: high `penetration`, no `splashRadius`, high `speed`, small `size` but specific `width`/`height` for a long thin shape, specific `color`, 'rectangle' `shape`.

### Class `MainTowerBullet` extends `Bullet` - General Scope
The default bullet type for the main tower.

*   **`MainTowerBullet.constructor(x, y, targetEnemy, damage)` - Scope:**
    *   Calls `super()`, passing specific config values: standard `penetration`, no `splashRadius`, moderate `speed`, moderate `size`, specific `color`, 'circle' `shape`.

---

## `game/ui.js`

Contains the `UIManager` class, responsible for managing UI interactions, scene transitions, and dialogs.

### Class `UIManager` - General Scope
Hides and shows different UI scenes (start menu, game over menu, main game UI), handles button clicks for starting/restarting the game, toggling the sidebar, selecting towers for placement, and managing the upgrade/sell dialog for defenses. Also provides audio control through a mute button.

*   **`UIManager.constructor(game)` - Scope:**
    *   Stores a reference to the main `game` object.
    *   Sets the initial `currentScene` to 'start'.
    *   Gets references to key HTML elements (menus, sidebar, buttons, dialogs).
    *   Removes the old 'start-wave' button (now handled by automatic timer).
    *   Hides the static 'health-counter' element's parent (health shown via main tower bar).
    *   Creates a mute button for audio control.
    *   Binds necessary methods to the class instance.
    *   Calls `initEventListeners()`.
    *   Enhances the upgrade/sell dialog styling.
*   **`UIManager.createMuteButton()` - Scope:**
    *   Creates a mute button element if it doesn't exist.
    *   Styles the button with proper positioning, appearance, and hover effects.
    *   Adds a click event listener that toggles the game's audio mute state.
    *   Appends the button to the document body.
*   **`UIManager.toggleMute()` - Scope:**
    *   Calls `game.audio.toggleMute()` to toggle the audio mute state.
    *   Updates the mute button icon to reflect the current state.
*   **`UIManager.enhanceUpgradeDialog()` - Scope:**
    *   Styles the upgrade/sell dialog with improved visuals.
    *   Sets border radius, shadow, background colors, and padding.
    *   Styles the title, stats section, and buttons for better appearance.
    *   Differentiates button colors based on their function (sell, upgrade, close).
*   **`UIManager.initEventListeners()` - Scope:**
    *   Attaches click listeners to various UI elements:
        *   Sidebar toggle button -> `toggleSidebar`
        *   Start game button -> `startGame`
        *   Restart game button -> `restartGame`
        *   Tower purchase buttons -> `selectTower` (passes tower type)
        *   Sell/Upgrade dialog buttons (Sell, Upgrade, Close) -> `sellDefense`, `upgradeDefense`, close action.
*   **`UIManager.toggleSidebar()` - Scope:**
    *   Toggles the 'collapsed' CSS class on the sidebar element.
*   **`UIManager.showScene(sceneName)` - Scope:**
    *   Updates `currentScene`.
    *   Hides all major UI containers (start menu, game over menu, sidebar, sidebar toggle).
    *   Shows the specific container for the requested `sceneName`.
    *   Calls `game.setGameState(sceneName)` to synchronize the main game logic with the UI change.
        *   Tied to `Game.setGameState()`.
*   **`UIManager.startGame()` - Scope:**
    *   Called by the start game button.
    *   Calls `showScene('playing')` to transition to the main game view.
*   **`UIManager.restartGame()` - Scope:**
    *   Called by the restart game button (on the game over screen).
    *   Calls `showScene('playing')`. This triggers `game.setGameState('playing')`, which handles calling `game.reset()`.
*   **`UIManager.selectTower(towerType)` - Scope:**
    *   Called by the tower purchase buttons.
    *   Calls `game.setDefenseToPlace(towerType)` to put the game into placement mode.
        *   Tied to `Game.setDefenseToPlace()`.
*   **`UIManager.showSellUpgradeDialog(defense)` - Scope:**
    *   Called by `Game.selectDefenseAt()` when a placed defense is clicked.
    *   Stores the passed `defense` object in `this.selectedDefense`.
    *   Gets references to dialog elements (title, stats display, buttons).
    *   Displays the defense name and level in the title.
    *   Creates a formatted grid display of defense stats (health, damage, range, fire rate).
    *   Configures the Upgrade button: disables if max level (>=3) or not enough gold, sets text to show cost, styling based on state.
    *   Configures the Sell button: calculates sell value (50% of `defense.getTotalValue()`) and sets button text.
    *   Makes the dialog visible with enhanced styling.
        *   Tied to `Defense.getTotalValue()`.
*   **`UIManager.sellDefense()` - Scope:**
    *   Called by the Sell button in the dialog.
    *   Checks if `this.selectedDefense` is valid.
    *   Calculates sell value.
    *   Adds sell value to `game.gold`.
    *   Plays the sell sound effect.
    *   Calls `game.removeDefense()` to remove the defense from the game logic and map.
    *   Hides the dialog and clears `this.selectedDefense`.
    *   Updates the main UI (`game.updateUI()`).
        *   Tied to `Defense.getTotalValue()`, `Game.removeDefense()`, `Game.updateUI()`, `AudioManager.playSound()`.
*   **`UIManager.upgradeDefense()` - Scope:**
    *   Called by the Upgrade button in the dialog.
    *   Checks if `this.selectedDefense` is valid and if the player has enough gold.
    *   Subtracts `defense.upgradeCost` from `game.gold`.
    *   Calls `this.selectedDefense.upgrade()` to apply the upgrade logic to the defense object.
    *   Plays the upgrade sound effect.
    *   Hides and immediately re-shows the dialog using `showSellUpgradeDialog()` to reflect the updated stats and potentially disable the button if max level is reached.
    *   Updates the main UI (`game.updateUI()`).
        *   Tied to `Defense.upgrade()`, `Game.updateUI()`, `AudioManager.playSound()`.
*   **`UIManager.showGameOver(finalScore)` - Scope:**
    *   Called by `Game.gameOver()`.
    *   Updates the text content of the final score element on the game over screen.
    *   Calls `showScene('game-over')` to display the game over menu.

---

## `game/tilemap.js`

Defines the `TileMap` class, responsible for managing the game grid, occupied tiles, and coordinate conversions.

### Class `TileMap` - General Scope
Represents the playable game area as a grid. Tracks which tiles are occupied by defenses, provides methods for drawing the grid, checking tile occupancy, marking tiles, converting between screen and grid coordinates, and finding spawn locations. Features visually varied tiles that create an abandoned battlefield appearance.

*   **`TileMap.constructor(cols, rows, tileSize)` - Scope:**
    *   Stores the grid dimensions (`cols`, `rows`) and the size of each tile (`tileSize`).
    *   Creates a 2D array (`this.grid`) initialized to `false`, representing the occupancy state of each tile.
    *   Initializes tile patterns for visual variety by calling `initializeTilePatterns()`.
    *   Creates a 2D array (`this.tileVariations`) to store which pattern is used for each tile.
    *   Calls `randomizeTileVariations()` to assign patterns to tiles.
*   **`TileMap.initializeTilePatterns()` - Scope:**
    *   Creates an array of tile pattern objects that describe visual variations.
    *   Each pattern specifies features like base color, presence of grass tufts, moss patches, and/or cracks.
    *   These patterns are used to create visual variety across the map.
*   **`TileMap.randomizeTileVariations()` - Scope:**
    *   Assigns a random pattern to each tile in the grid.
    *   Uses weighted randomization to ensure patterns are distributed naturally (e.g., plain dirt is most common).
    *   Ensures the map has varied appearance while maintaining visual coherence.
*   **`TileMap.draw(ctx)` - Scope:**
    *   Calculates canvas center and map pixel dimensions based on `cols`, `rows`, `tileSize`.
    *   Calculates and applies canvas offset for centering.
    *   Draws a dark background for the entire map area.
    *   Iterates through the grid, calling `drawTile()` for each tile to create visual variety.
    *   Draws the vertical and horizontal grid lines.
    *   Draws a semi-transparent fill on tiles marked as occupied (`this.grid[y][x] === true`).
    *   Restores canvas context.
*   **`TileMap.drawTile(ctx, x, y)` - Scope:**
    *   Draws a single tile at grid position (x, y) using its assigned pattern.
    *   Applies the base color for the tile.
    *   Adds random darkening for soil texture variation.
    *   Conditionally adds grass tufts, moss patches, or cracks based on the tile's assigned pattern.
    *   Creates visual variety that gives the map an abandoned battlefield appearance.
*   **`TileMap.isTileOccupied(x, y)` - Scope:**
    *   Checks if the given grid coordinates (`x`, `y`) are within the map boundaries.
    *   Returns `true` if out of bounds or if `this.grid[y][x]` is true, `false` otherwise.
*   **`TileMap.canPlaceDefense(x, y, width, height)` - Scope:**
    *   Checks if a rectangular area defined by `x`, `y`, `width`, `height` is completely free.
    *   Iterates through all tiles within the rectangle and calls `isTileOccupied()` for each.
    *   Returns `false` immediately if any tile is occupied, `true` if all are free.
        *   Tied to `TileMap.isTileOccupied()`.
*   **`TileMap.setTileOccupied(x, y, isOccupied)` - Scope:**
    *   Checks if the grid coordinates (`x`, `y`) are within bounds.
    *   Sets the value of `this.grid[y][x]` to the boolean `isOccupied`.
*   **`TileMap.setRectangleOccupied(x, y, width, height, isOccupied)` - Scope:**
    *   Marks a rectangular area as occupied or free.
    *   Iterates through all tiles within the rectangle and calls `setTileOccupied()` for each.
        *   Tied to `TileMap.setTileOccupied()`.
*   **`TileMap.screenToGrid(screenX, screenY)` - Scope:**
    *   Converts pixel coordinates from the canvas (`screenX`, `screenY`) to grid coordinates.
    *   Calculates canvas offset.
    *   Adjusts the screen coordinates by subtracting the offset.
    *   Divides the adjusted coordinates by `tileSize` and uses `Math.floor` to get the grid indices.
    *   Returns an object `{ x: gridX, y: gridY }`.
*   **`TileMap.gridToScreen(gridX, gridY)` - Scope:**
    *   Converts grid coordinates (`gridX`, `gridY`) to the pixel coordinates of the *center* of that tile on the screen.
    *   Calculates canvas offset.
    *   Calculates the top-left pixel coordinate of the tile (`offsetX + gridX * tileSize`, `offsetY + gridY * tileSize`).
    *   Adds half the `tileSize` to both coordinates to get the center.
    *   Returns an object `{ x: screenX, y: screenY }`.
*   **`TileMap.findUnoccupiedEdgeTile()` - Scope:**
    *   Used by the `Spawner` to find a place to spawn enemies.
    *   Creates a list of all tiles along the four edges of the map.
    *   Filters this list to include only tiles where `isTileOccupied()` returns `false`.
    *   If no unoccupied edge tiles are found, returns `null`.
    *   Otherwise, returns a randomly selected tile object `{ x, y }` from the list of unoccupied edge tiles.
        *   Tied to `TileMap.isTileOccupied()`.

## `game/audio.js`

Contains the `AudioManager` class, responsible for managing sound effects and background music throughout the game.

### Class `AudioManager` - General Scope
Handles the loading, playing, and management of all game audio, including sound effects for different tower types, UI interactions, and background music. Includes functionality for volume control and muting.

*   **`AudioManager.constructor()` - Scope:**
    *   Initializes containers for sound effects (`this.sounds`) and background music (`this.music`).
    *   Sets initial audio state: `isMuted`, `soundVolume`, and `musicVolume`.
    *   Calls `init()` to set up all audio resources.
*   **`AudioManager.init()` - Scope:**
    *   Creates and initializes different sound effect categories:
        *   Bullet sounds (cannonShot, sniperShot, mainTowerShot) using different audio files for each tower type.
        *   UI sounds (upgrade, sell) for interface interactions.
        *   Game state sounds (waveStart, gameOver) for major game events.
    *   Sets up background music with looping enabled.
*   **`AudioManager.createAudio(src, volume)` - Scope:**
    *   Helper method that creates a new Audio element with the specified source URL and volume.
    *   Returns the created audio element.
*   **`AudioManager.playSound(soundName)` - Scope:**
    *   Plays the specified sound effect if the game is not muted.
    *   Clones the audio element to allow multiple overlapping instances of the same sound.
    *   Sets appropriate volume and handles cleanup after playback.
*   **`AudioManager.startMusic()` - Scope:**
    *   Starts playing the background music if the game is not muted.
    *   Catches and logs any errors that occur during playback.
*   **`AudioManager.stopMusic()` - Scope:**
    *   Pauses the background music and resets its playback position.
*   **`AudioManager.toggleMute()` - Scope:**
    *   Toggles the muted state of all game audio.
    *   If muting, stops the background music; if unmuting, restarts it.
    *   Returns the new mute state.
*   **`AudioManager.setVolume(volume)` - Scope:**
    *   Sets the volume for all sound effects.
    *   Updates the volume property of all sound instances.
*   **`AudioManager.setMusicVolume(volume)` - Scope:**
    *   Sets the volume specifically for background music.
*   **`AudioManager.cleanUp()` - Scope:**
    *   Stops all audio playback.
    *   Should be called when the game is inactive to prevent audio resource issues.

## Recent Gameplay Changes

The following changes have been made to balance gameplay and improve player experience:

### Defense Adjustments
- The cost of Walls has been reduced from 25 to 10, making them more accessible for early-game defense.
- Health values of towers have been significantly increased:
  - Main Tower health increased to 1000 (previously 500)
  - All other defensive structures' health increased by 2.5x, improving their durability

### Enemy Adjustments
- Enemy attack rates have been slowed by a factor of 0.75, giving players more time to react during enemy encounters.

### Audio System Updates
- The audio system now supports continuous background music that plays in both the main menu and during gameplay, creating a more seamless experience.