# Tower Defense Game

A browser-based tower defense game built with vanilla JavaScript, HTML Canvas, and CSS. The game features dynamic enemy spawning, strategic tower placement, resource management, and progressive difficulty.

## Game Overview

Defend your main tower from waves of enemies by strategically placing defensive structures on a dynamically generated battlefield. Enemies spawn from the edges of the map and navigate toward your main tower at the center. Build and upgrade your defenses to survive as long as possible against increasingly difficult waves.

## Core Features

### Defensive Structures
- **Main Tower**: Your primary structure to defend, featuring 360° rotation and automatic firing
- **Cannon Tower**: Medium-range tower with splash damage capabilities
- **Sniper Tower**: Long-range tower with high damage and penetration
- **Walls**: Low-cost defensive barriers that block enemy movement

### Enemy Types
- **Zombies**: Standard enemies with balanced stats
- **Runners**: Fast, low-health enemies that can quickly overwhelm your defenses
- **Tanks**: Slow but high-health enemies that can absorb significant damage
- **Bosses**: Special enemies with extremely high health that appear on milestone waves

### Gameplay Mechanics
- **Resource System**: Earn gold by defeating enemies; spend it on new defenses or upgrades
- **Wave Progression**: Face increasingly difficult waves with more numerous and stronger enemies
- **Tower Upgrades**: All defensive structures can be upgraded to level 3, enhancing their abilities
- **Health Regeneration**: Structures slowly regenerate health between enemy attacks
- **Interactive UI**: Intuitive interface for building, upgrading, and selling defenses

## Technical Implementation

The game features a modular architecture with clean separation of concerns:
- **Tile-based Map System**: Grid-based game world with visual variety
- **Enemy Pathfinding**: Adaptive movement AI that navigates around obstacles
- **Bullet Physics**: Different projectile types with varied behaviors (splash, penetration)
- **Animation System**: Smooth visual effects for attacks, movements, and interactions
- **Audio Manager**: Comprehensive sound system with dynamic effects and background music

## Play Instructions

1. Start the game and build initial defenses with your starting gold
2. Place defensive structures strategically to create choke points
3. Balance between offensive towers and defensive walls
4. Manage your gold efficiently - upgrade existing defenses or build new ones
5. Prepare for wave announcements that indicate when enemies will spawn
6. Adjust your strategy based on the types of enemies appearing

## Development Setup

### Prerequisites
- Node.js and npm

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm start`

### Project Structure
```
├── game/           # Core game logic files
│   ├── game.js     # Main game loop and coordination
│   ├── tilemap.js  # Map generation and management
│   ├── enemies.js  # Enemy classes and behavior
│   ├── defenses.js # Tower and wall implementation
│   ├── bullets.js  # Projectile physics and effects
│   ├── spawner.js  # Wave management and enemy spawning
│   ├── ui.js       # User interface management
│   └── audio.js    # Sound effects and music
├── index.html      # Game entry point
├── styles.css      # Game styling
└── assets/         # Game resources (audio, etc.)
```

## License

MIT License 