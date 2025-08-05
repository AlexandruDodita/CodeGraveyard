export class AudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.isMuted = false;
        this.soundVolume = 0.5;
        this.musicVolume = 0.3;
        
        // Initialize audio
        this.init();
    }
    
    init() {
        // Create sound effects using local files
        this.sounds = {
            // Only use the two weapon sounds from assets/music
            cannonShot: this.createAudio('assets/music/pistol.wav', this.soundVolume),
            sniperShot: this.createAudio('assets/music/sniper.wav', this.soundVolume),
        };
        
        // Create background music using local file
        this.music = this.createAudio('assets/music/background.mp3', this.musicVolume);
        this.music.loop = true;
    }
    
    createAudio(src, volume) {
        const audio = new Audio(src);
        audio.volume = volume;
        return audio;
    }
    
    playSound(soundName) {
        // Gracefully handle missing sounds for backward compatibility
        if (this.isMuted || !this.sounds[soundName]) return;
        
        // Clone the audio to allow overlapping sounds
        const sound = this.sounds[soundName].cloneNode();
        sound.volume = this.soundVolume;
        sound.play().catch(e => console.log("Audio play failed:", e));
        
        // Automatically clean up the cloned audio element
        sound.onended = () => sound.remove();
    }
    
    startMusic() {
        if (this.isMuted || !this.music) return;
        this.music.play().catch(e => console.log("Music play failed:", e));
    }
    
    stopMusic() {
        if (!this.music) return;
        this.music.pause();
        this.music.currentTime = 0;
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        
        return this.isMuted;
    }
    
    setVolume(volume) {
        this.soundVolume = volume;
        
        // Update all sound volumes
        Object.values(this.sounds).forEach(sound => {
            sound.volume = volume;
        });
    }
    
    setMusicVolume(volume) {
        this.musicVolume = volume;
        if (this.music) {
            this.music.volume = volume;
        }
    }
    
    // Call this method when the game is inactive to prevent audio issues
    cleanUp() {
        this.stopMusic();
    }
} 