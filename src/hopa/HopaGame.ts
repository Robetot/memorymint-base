// Memory Mint HOPA Adventure - Week 1 (Roman), Week 2 (Viking Raid), Week 3 (Pharaoh's Curse)
// Phaser 3 Implementation with Progressive Difficulty
// Features: Fog of war, decoys, combo multiplier, visual noise, leaderboard

import Phaser from 'phaser';

// ==========================================
// VIRTUAL RESOLUTION CONSTANTS
// ==========================================

let GAME_WIDTH = 1080;
let GAME_HEIGHT = 1920;

let SAFE_MARGIN_X = 80;
let SAFE_MARGIN_TOP = 160;
let SAFE_MARGIN_BOTTOM = 120;

let SAFE_LEFT = SAFE_MARGIN_X;
let SAFE_RIGHT = GAME_WIDTH - SAFE_MARGIN_X;
let SAFE_TOP = SAFE_MARGIN_TOP;
let SAFE_BOTTOM = GAME_HEIGHT - SAFE_MARGIN_BOTTOM;
let SAFE_WIDTH = SAFE_RIGHT - SAFE_LEFT;
let SAFE_HEIGHT = SAFE_BOTTOM - SAFE_TOP;
let SAFE_CENTER_X = GAME_WIDTH / 2;
let SAFE_CENTER_Y = GAME_HEIGHT / 2;

function computeLayout(isLandscape: boolean) {
    if (isLandscape) {
        GAME_WIDTH = 1920;
        GAME_HEIGHT = 1080;
        SAFE_MARGIN_X = 120;
        SAFE_MARGIN_TOP = 80;
        SAFE_MARGIN_BOTTOM = 80;
    } else {
        GAME_WIDTH = 1080;
        GAME_HEIGHT = 1920;
        SAFE_MARGIN_X = 80;
        SAFE_MARGIN_TOP = 160;
        SAFE_MARGIN_BOTTOM = 120;
    }
    SAFE_LEFT = SAFE_MARGIN_X;
    SAFE_RIGHT = GAME_WIDTH - SAFE_MARGIN_X;
    SAFE_TOP = SAFE_MARGIN_TOP;
    SAFE_BOTTOM = GAME_HEIGHT - SAFE_MARGIN_BOTTOM;
    SAFE_WIDTH = SAFE_RIGHT - SAFE_LEFT;
    SAFE_HEIGHT = SAFE_BOTTOM - SAFE_TOP;
    SAFE_CENTER_X = GAME_WIDTH / 2;
    SAFE_CENTER_Y = GAME_HEIGHT / 2;
}

// ==========================================
// LEADERBOARD MANAGER
// ==========================================

const LEADERBOARD_KEY = 'memorymint_hopa_leaderboard';
const MAX_LEADERBOARD = 5;

interface LeaderboardEntry {
    name: string;
    score: number;
    difficulty: string;
    week: number;
    date: string;
}

function getLeaderboard(): LeaderboardEntry[] {
    try {
        const stored = localStorage.getItem(LEADERBOARD_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function addToLeaderboard(entry: LeaderboardEntry): LeaderboardEntry[] {
    const lb = getLeaderboard();
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const trimmed = lb.slice(0, MAX_LEADERBOARD * 2); // keep more for cross-week
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
    return trimmed;
}

function getLeaderboardByWeek(week: number): LeaderboardEntry[] {
    return getLeaderboard().filter(e => e.week === week).sort((a, b) => b.score - a.score).slice(0, MAX_LEADERBOARD);
}

// ==========================================
// NARRATIVE CONTROLLER
// ==========================================

const NARRATIVE_STORAGE_KEY = 'memorymint_world_narratives';

type WorldNarrativeId = 
    | 'world_barracks_intro' | 'world_barracks_mid' | 'world_barracks_complete'
    | 'world_market_intro' | 'world_market_mid' | 'world_market_complete'
    | 'world_forum_intro' | 'world_forum_mid' | 'world_forum_complete';

const NARRATIVE_AUDIO_MAP: Record<WorldNarrativeId, string> = {
    'world_barracks_intro': 'VO_Scene_Start',
    'world_barracks_mid': 'VO_Mid_Scene',
    'world_barracks_complete': 'VO_Scene_Complete',
    'world_market_intro': 'VO_Scene_Start',
    'world_market_mid': 'VO_Mid_Scene',
    'world_market_complete': 'VO_Scene_Complete',
    'world_forum_intro': 'VO_Scene_Start',
    'world_forum_mid': 'VO_Mid_Scene',
    'world_forum_complete': 'VO_Scene_Complete',
};

class NarrativeController {
    private static instance: NarrativeController;
    private playedNarratives: Set<string>;
    private currentAudio: Phaser.Sound.BaseSound | null = null;
    private currentScene: Phaser.Scene | null = null;
    private _isPlaying: boolean = false;
    private indicator: Phaser.GameObjects.Container | null = null;
    
    private constructor() {
        this.playedNarratives = this.loadFromStorage();
    }
    
    static getInstance(): NarrativeController {
        if (!NarrativeController.instance) {
            NarrativeController.instance = new NarrativeController();
        }
        return NarrativeController.instance;
    }
    
    private loadFromStorage(): Set<string> {
        try {
            const stored = localStorage.getItem(NARRATIVE_STORAGE_KEY);
            if (stored) return new Set(JSON.parse(stored));
        } catch (e) { console.warn('Failed to load narrative state:', e); }
        return new Set();
    }
    
    private saveToStorage(): void {
        try {
            localStorage.setItem(NARRATIVE_STORAGE_KEY, JSON.stringify([...this.playedNarratives]));
        } catch (e) { console.warn('Failed to save narrative state:', e); }
    }
    
    hasPlayed(narrativeId: WorldNarrativeId): boolean {
        return this.playedNarratives.has(narrativeId);
    }
    
    get isPlaying(): boolean { return this._isPlaying; }
    
    play(narrativeId: WorldNarrativeId, scene: Phaser.Scene, onComplete?: () => void): void {
        if (this.hasPlayed(narrativeId)) { onComplete?.(); return; }
        this.stop();
        const soundEnabled = scene.registry.get('soundEnabled');
        if (!soundEnabled) { this.markAsPlayed(narrativeId); onComplete?.(); return; }
        const audioKey = NARRATIVE_AUDIO_MAP[narrativeId];
        if (!audioKey) { onComplete?.(); return; }
        
        this._isPlaying = true;
        this.currentScene = scene;
        this.showIndicator(scene);
        this.currentAudio = scene.sound.add(audioKey, { loop: false, volume: 1.0 });
        
        const handleComplete = () => {
            this.markAsPlayed(narrativeId);
            this._isPlaying = false;
            this.hideIndicator();
            this.currentAudio = null;
            this.currentScene = null;
            onComplete?.();
        };
        
        this.currentAudio.once('complete', handleComplete);
        this.currentAudio.play();
    }
    
    stop(): void {
        if (this.currentAudio) { this.currentAudio.stop(); this.currentAudio.destroy(); this.currentAudio = null; }
        this._isPlaying = false;
        this.hideIndicator();
        this.currentScene = null;
    }
    
    private markAsPlayed(narrativeId: WorldNarrativeId): void {
        this.playedNarratives.add(narrativeId);
        this.saveToStorage();
    }
    
    private showIndicator(scene: Phaser.Scene): void {
        if (this.indicator) return;
        this.indicator = scene.add.container(SAFE_CENTER_X, SAFE_BOTTOM - 100);
        const bg = scene.add.rectangle(0, 0, 200, 44, 0x000000, 0.7).setStrokeStyle(2, 0xffd700);
        const text = scene.add.text(0, 0, "🎙️ Narrating...", { font: "bold 20px Arial", color: "#ffd700" }).setOrigin(0.5);
        this.indicator.add([bg, text]);
        this.indicator.setDepth(1000);
        scene.tweens.add({ targets: this.indicator, alpha: 0.7, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    
    private hideIndicator(): void {
        if (this.indicator && this.currentScene) {
            this.currentScene.tweens.killTweensOf(this.indicator);
            this.indicator.destroy();
        }
        this.indicator = null;
    }
    
    resetAllProgress(): void { this.playedNarratives.clear(); this.saveToStorage(); }
    getProgress(): string[] { return [...this.playedNarratives]; }
}

// ==========================================
// BOOT SCENE
// ==========================================

class BootScene extends Phaser.Scene {
    constructor() { super("BootScene"); }

    preload() {
        const cx = SAFE_CENTER_X;
        const cy = SAFE_CENTER_Y;
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRoundedRect(cx - 200, cy - 30, 400, 60, 12);
        const progressBar = this.add.graphics();
        const percentText = this.add.text(cx, cy, "0%", { font: "24px Arial", color: "#ffffff" }).setOrigin(0.5);

        this.load.on("progress", (value: number) => {
            percentText.setText(Math.floor(value * 100) + "%");
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRoundedRect(cx - 190, cy - 20, 380 * value, 40, 8);
        });
        this.load.on("complete", () => { progressBox.destroy(); progressBar.destroy(); percentText.destroy(); });

        // Backgrounds - Week 1
        ["barracks", "market", "forum"].forEach(bg => {
            this.load.image(bg, "/assets/images/backgrounds/scene_" + bg + ".png");
        });
        // Background - Week 2
        this.load.image("longhouse", "/assets/images/backgrounds/scene_longhouse.png");
        // Background - Week 3
        this.load.image("tomb", "/assets/images/backgrounds/scene_tomb.png");

        // 1x1 objects - Week 1
        ["gold_coin", "roman_key", "laurel_crown", "oil_lamp", "gem_ring",
         "dice", "statue_hand", "coin_purse", "wax_tablet", "theatre_mask",
         "mosaic_tile"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/1x1/" + obj + ".png");
        });

        // 1x1 objects - Week 2 (Viking)
        ["viking_helmet", "runestone", "thors_hammer", "silver_armband",
         "mead_horn", "bone_comb", "iron_brooch"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/1x1/" + obj + ".png");
        });

        // 1x1 objects - Week 3 (Egyptian)
        ["scarab_amulet", "golden_ankh", "eye_of_horus",
         "canopic_jar", "golden_cobra", "lotus_amulet", "clay_lamp"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/1x1/" + obj + ".png");
        });

        // 2x3 objects
        ["ceramic_vase", "centurion_helmet", "torch", "aquila_standard", "perfume_bottle",
         "war_axe", "papyrus_scroll", "jeweled_dagger"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/2x3/" + obj + ".png");
        });

        // 3x2 objects
        ["open_scroll", "gladius_sword", "empire_map", "legionary_shield"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/3x2/" + obj + ".png");
        });

        // SFX
        ["SFX_Object_Found", "SFX_Wrong_Tap", "SFX_UI_Tap", "SFX_Hint_Used", "SFX_Scene_Load"].forEach(a => {
            this.load.audio(a, ["/assets/audio/sfx/" + a + ".mp3"]);
        });

        // Voice
        ["VO_Scene_Start", "VO_Mid_Scene", "VO_Scene_Complete"].forEach(a => {
            this.load.audio(a, ["/assets/audio/voice/" + a + ".mp3"]);
        });

        // Ambient
        ["AMB_Barracks", "AMB_Market", "AMB_Forum"].forEach(a => {
            this.load.audio(a, ["/weekly/roman/sounds/" + a + ".mp3"]);
        });
    }

    create() {
        this.registry.set("difficulty", "Medium");
        this.registry.set("soundEnabled", true);
        this.registry.set("totalScore", 0);
        this.registry.set("totalCombo", 0);
        this.registry.set("week", 1);
        this.scene.start("WeekSelectScene");
    }
}

// ==========================================
// WEEK SELECT SCENE
// ==========================================

class WeekSelectScene extends Phaser.Scene {
    constructor() { super("WeekSelectScene"); }

    create() {
        this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 80, "MEMORY MINT", {
            font: "bold 72px Arial", color: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 170, "Select Adventure", {
            font: "36px Arial", color: "#aaaaaa"
        }).setOrigin(0.5);

        // Week 1 card
        const w1y = SAFE_CENTER_Y - 80;
        const w1bg = this.add.rectangle(SAFE_CENTER_X, w1y, 520, 160, 0x000000, 0.5)
            .setStrokeStyle(3, 0xd4a574).setInteractive({ useHandCursor: true });
        this.add.text(SAFE_CENTER_X, w1y - 30, "⚔️  Week 1 — Roman Adventure", {
            font: "bold 30px Arial", color: "#d4a574"
        }).setOrigin(0.5);
        this.add.text(SAFE_CENTER_X, w1y + 20, "3 Scenes  •  Barracks → Market → Forum", {
            font: "20px Arial", color: "#999999"
        }).setOrigin(0.5);
        const w1best = getLeaderboardByWeek(1);
        if (w1best.length > 0) {
            this.add.text(SAFE_CENTER_X, w1y + 52, `Best: ${w1best[0].score} pts`, {
                font: "18px Arial", color: "#4ade80"
            }).setOrigin(0.5);
        }
        w1bg.on("pointerover", () => w1bg.setFillStyle(0xd4a574, 0.15));
        w1bg.on("pointerout", () => w1bg.setFillStyle(0x000000, 0.5));
        w1bg.on("pointerdown", () => {
            this.registry.set("week", 1);
            if (this.registry.get("soundEnabled")) this.sound.play("SFX_UI_Tap");
            this.scene.start("DifficultySelectScene");
        });

        // Week 2 card
        const w2y = SAFE_CENTER_Y + 120;
        const w2bg = this.add.rectangle(SAFE_CENTER_X, w2y, 520, 160, 0x000000, 0.5)
            .setStrokeStyle(3, 0x4488cc).setInteractive({ useHandCursor: true });
        this.add.text(SAFE_CENTER_X, w2y - 30, "🛡️  Week 2 — Viking Raid", {
            font: "bold 30px Arial", color: "#6699dd"
        }).setOrigin(0.5);
        this.add.text(SAFE_CENTER_X, w2y + 20, "1 Scene  •  Longhouse  •  Lightning Storms", {
            font: "20px Arial", color: "#999999"
        }).setOrigin(0.5);
        const w2best = getLeaderboardByWeek(2);
        if (w2best.length > 0) {
            this.add.text(SAFE_CENTER_X, w2y + 52, `Best: ${w2best[0].score} pts`, {
                font: "18px Arial", color: "#4ade80"
            }).setOrigin(0.5);
        }
        w2bg.on("pointerover", () => w2bg.setFillStyle(0x4488cc, 0.15));
        w2bg.on("pointerout", () => w2bg.setFillStyle(0x000000, 0.5));
        w2bg.on("pointerdown", () => {
            this.registry.set("week", 2);
            if (this.registry.get("soundEnabled")) this.sound.play("SFX_UI_Tap");
            this.scene.start("DifficultySelectScene");
        });
    }
}

// ==========================================
// DIFFICULTY SELECT SCENE
// ==========================================

class DifficultySelectScene extends Phaser.Scene {
    constructor() { super("DifficultySelectScene"); }

    create() {
        const week = this.registry.get("week") || 1;
        const isViking = week === 2;
        
        this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, isViking ? 0x0a1020 : 0x1a1a2e);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 100, "MEMORY MINT", {
            font: "bold 72px Arial", color: "#ffd700"
        }).setOrigin(0.5);

        const subtitle = isViking ? "Week 2 — Viking Raid" : "Week 1 — Roman Adventure";
        this.add.text(SAFE_CENTER_X, SAFE_TOP + 200, subtitle, {
            font: "40px Arial", color: isViking ? "#6699dd" : "#ffffff"
        }).setOrigin(0.5);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 280, "Select Difficulty", {
            font: "32px Arial", color: "#aaaaaa"
        }).setOrigin(0.5);

        const firstScene = isViking ? "VikingLonghouseScene" : "BarracksScene";

        const buttonY = SAFE_CENTER_Y - 50;
        
        if (isViking) {
            this.createButton(SAFE_CENTER_X, buttonY, "Easy", "5 objects | 2:30 | 2 hints | Fog", 0x4ade80, firstScene);
            this.createButton(SAFE_CENTER_X, buttonY + 140, "Medium", "5 objects | 2:00 | 1 hint | Fog + Lightning", 0xfbbf24, firstScene);
            this.createButton(SAFE_CENTER_X, buttonY + 280, "Hard", "5 objects | 1:30 | 0 hints | Fog + Lightning + 3 Decoys", 0xef4444, firstScene);
        } else {
            this.createButton(SAFE_CENTER_X, buttonY, "Easy", "5 objects | 3 min | 3 hints", 0x4ade80, firstScene);
            this.createButton(SAFE_CENTER_X, buttonY + 140, "Medium", "10 objects | 2.5 min | 2 hints | Fog", 0xfbbf24, firstScene);
            this.createButton(SAFE_CENTER_X, buttonY + 280, "Hard", "15 objects | 2 min | 1 hint | Fog + Decoys", 0xef4444, firstScene);
        }
        
        // Back button
        const backBtn = this.add.text(SAFE_LEFT + 20, SAFE_TOP + 40, "← Back", {
            font: "bold 24px Arial", color: "#888888"
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        backBtn.on("pointerdown", () => this.scene.start("WeekSelectScene"));

        this.add.text(SAFE_CENTER_X, SAFE_BOTTOM - 80, isViking ? "Beware the storm — lightning blinds you!" : "Find all hidden objects — beware of decoys!", {
            font: "24px Arial", color: "#666666"
        }).setOrigin(0.5);
    }

    createButton(x: number, y: number, label: string, desc: string, color: number, firstScene: string) {
        const bg = this.add.rectangle(x, y, 500, 100, 0x000000, 0.5).setStrokeStyle(3, color);
        this.add.text(x, y - 12, label, { font: "bold 36px Arial", color: "#ffffff" }).setOrigin(0.5);
        this.add.text(x, y + 26, desc, { font: "18px Arial", color: "#aaaaaa" }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(color, 0.3));
        bg.on("pointerout", () => bg.setFillStyle(0x000000, 0.5));
        bg.on("pointerdown", () => {
            this.registry.set("difficulty", label);
            this.registry.set("totalScore", 0);
            this.registry.set("totalCombo", 0);
            if (this.registry.get("soundEnabled")) this.sound.play("SFX_UI_Tap");
            this.scene.start(firstScene);
        });
    }
}

// ==========================================
// BASE HOPA SCENE (Enhanced with new mechanics)
// ==========================================

class HopaScene extends Phaser.Scene {
    protected bgKey: string;
    protected ambientKey: string;
    protected worldId: 'barracks' | 'market' | 'forum';
    protected objects: string[];
    protected difficulty!: string;
    protected soundEnabled!: boolean;
    protected timeLeft!: number;
    protected maxTime!: number;
    protected hints!: number;
    protected objectScale!: number;
    protected found!: number;
    protected sprites!: Phaser.GameObjects.Image[];
    protected decoySprites!: Phaser.GameObjects.Image[];
    protected counter!: Phaser.GameObjects.Text;
    protected timerText!: Phaser.GameObjects.Text;
    protected hintsText!: Phaser.GameObjects.Text;
    protected timerEvent?: Phaser.Time.TimerEvent;
    protected ambientMusic?: Phaser.Sound.BaseSound;
    protected isTransitioning: boolean = false;
    
    // New mechanics
    protected score: number = 0;
    protected combo: number = 0;
    protected maxCombo: number = 0;
    protected comboTimer?: Phaser.Time.TimerEvent;
    protected comboText!: Phaser.GameObjects.Text;
    protected scoreText!: Phaser.GameObjects.Text;
    protected fogEnabled: boolean = false;
    protected fogMask?: Phaser.GameObjects.Graphics;
    protected fogOverlay?: Phaser.GameObjects.Graphics;
    protected decoyCount: number = 0;
    protected ambientToggleBtn?: Phaser.GameObjects.Container;
    
    // Particle layers
    protected dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    protected lightFlares: Phaser.GameObjects.Image[] = [];
    
    protected get narrative(): NarrativeController {
        return NarrativeController.getInstance();
    }

    constructor(key: string, bgKey: string, ambientKey: string, worldId: 'barracks' | 'market' | 'forum', objects: string[]) {
        super(key);
        this.bgKey = bgKey;
        this.ambientKey = ambientKey;
        this.worldId = worldId;
        this.objects = objects;
    }
    
    protected getWorldIntroId(): WorldNarrativeId { return `world_${this.worldId}_intro` as WorldNarrativeId; }
    protected getWorldMidId(): WorldNarrativeId { return `world_${this.worldId}_mid` as WorldNarrativeId; }
    protected getWorldCompleteId(): WorldNarrativeId { return `world_${this.worldId}_complete` as WorldNarrativeId; }

    create() {
        this.isTransitioning = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.decoySprites = [];
        this.lightFlares = [];
        
        // Background
        const bg = this.add.image(SAFE_CENTER_X, SAFE_CENTER_Y, this.bgKey);
        const bgRatio = 1280 / 720;
        const gameRatio = GAME_WIDTH / GAME_HEIGHT;
        if (gameRatio < bgRatio) {
            bg.setScale(GAME_HEIGHT / 720);
        } else {
            bg.setScale(GAME_WIDTH / 1280);
        }
        
        bg.setInteractive({ useHandCursor: false });
        bg.on("pointerdown", () => this.handleWrongTap());

        this.difficulty = this.registry.get("difficulty");
        this.soundEnabled = this.registry.get("soundEnabled");

        if (this.soundEnabled) {
            this.sound.play("SFX_Scene_Load");
            this.time.delayedCall(500, () => {
                if (!this.isTransitioning) this.narrative.play(this.getWorldIntroId(), this);
            });
            this.ambientMusic = this.sound.add(this.ambientKey, { loop: true, volume: 0.4 });
            this.ambientMusic.play();
        }

        this.applyDifficulty();
        this.placeObjects();
        this.placeDecoys();
        this.addVisualNoise();
        this.createUI();
        this.startTimer();
        
        if (this.fogEnabled) {
            this.setupFogOfWar();
        }
    }

    handleWrongTap() {
        if (this.isTransitioning || this.narrative.isPlaying) return;
        
        if (this.soundEnabled) this.sound.play("SFX_Wrong_Tap");
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
        
        // Reset combo on wrong tap
        this.combo = 0;
        this.updateComboDisplay();
        
        // Time penalty for Medium and Hard
        if (this.difficulty !== "Easy" && this.timeLeft > 0) {
            const penalty = this.difficulty === "Hard" ? 5 : 3;
            this.timeLeft = Math.max(0, this.timeLeft - penalty);
            this.timerText.setText(this.formatTime(this.timeLeft));
            this.flashTimerRed();
            if (this.timeLeft <= 0) this.gameOver(false);
        }
    }

    stopAmbient() {
        if (this.ambientMusic) { this.ambientMusic.stop(); this.ambientMusic.destroy(); this.ambientMusic = undefined; }
    }

    cleanupAllAudio() {
        this.narrative.stop();
        this.stopAmbient();
    }

    applyDifficulty() {
        const isLandscape = GAME_WIDTH > GAME_HEIGHT;
        const scaleFactor = isLandscape ? 0.55 : 1.0;
        // Objects are 30-50% smaller than before (old: 0.18/0.15/0.12)
        if (this.difficulty === "Easy") {
            this.maxTime = 180;
            this.timeLeft = 180;
            this.hints = 3;
            this.objectScale = 0.12 * scaleFactor;  // was 0.18
            this.fogEnabled = false;
            this.decoyCount = 0;
        } else if (this.difficulty === "Medium") {
            this.maxTime = 150;
            this.timeLeft = 150;
            this.hints = 2;
            this.objectScale = 0.09 * scaleFactor;  // was 0.15
            this.fogEnabled = true;
            this.decoyCount = 2;
        } else {
            this.maxTime = 120;
            this.timeLeft = 120;
            this.hints = 1;
            this.objectScale = 0.07 * scaleFactor;  // was 0.12
            this.fogEnabled = true;
            this.decoyCount = 3;
        }
    }

    placeObjects() {
        this.found = 0;
        this.sprites = [];
        const placed: { x: number; y: number }[] = [];
        const minDist = 100;

        const placeTop = SAFE_TOP + 120;
        const placeBottom = SAFE_BOTTOM - 200;
        const placeLeft = SAFE_LEFT + 40;
        const placeRight = SAFE_RIGHT - 40;

        // Warm tint colors that blend with medieval backgrounds
        const blendTints = [0xd4a574, 0xc4956a, 0xb8860b, 0xa0785a, 0x8b7355, 0x9c8c6e];

        this.objects.forEach((key, idx) => {
            let x: number = 0, y: number = 0, valid = false, tries = 0;
            while (!valid && tries < 200) {
                x = Phaser.Math.Between(placeLeft, placeRight);
                y = Phaser.Math.Between(placeTop, placeBottom);
                valid = !placed.some(p => Phaser.Math.Distance.Between(p.x, p.y, x, y) < minDist);
                tries++;
            }
            placed.push({ x, y });

            const sprite = this.add.image(x, y, key)
                .setScale(this.objectScale)
                .setInteractive({ useHandCursor: true })
                .setDepth(5);

            // Tint objects to blend with background
            const tint = blendTints[idx % blendTints.length];
            sprite.setTint(tint);
            
            // Reduce alpha slightly so objects blend more
            sprite.setAlpha(0.75);

            // Random slight rotation for embedding feel
            sprite.setAngle(Phaser.Math.Between(-15, 15));

            sprite.on("pointerover", () => { sprite.setAlpha(0.9); });
            sprite.on("pointerout", () => { sprite.setAlpha(0.75); });
            sprite.on("pointerdown", () => this.pickObject(sprite));
            this.sprites.push(sprite);
        });
    }

    placeDecoys() {
        if (this.decoyCount === 0) return;
        
        const allObjectKeys = ["gold_coin", "roman_key", "laurel_crown", "oil_lamp", "gem_ring",
            "dice", "statue_hand", "coin_purse", "wax_tablet", "theatre_mask", "mosaic_tile"];
        
        // Pick decoy keys not already in the scene objects
        const available = allObjectKeys.filter(k => !this.objects.includes(k));
        const decoyKeys = Phaser.Utils.Array.Shuffle(available).slice(0, this.decoyCount);

        const placeTop = SAFE_TOP + 120;
        const placeBottom = SAFE_BOTTOM - 200;
        const placeLeft = SAFE_LEFT + 40;
        const placeRight = SAFE_RIGHT - 40;

        decoyKeys.forEach(key => {
            const x = Phaser.Math.Between(placeLeft, placeRight);
            const y = Phaser.Math.Between(placeTop, placeBottom);

            const sprite = this.add.image(x, y, key)
                .setScale(this.objectScale * 0.9) // slightly smaller
                .setInteractive({ useHandCursor: true })
                .setDepth(5)
                .setAlpha(0.65)
                .setAngle(Phaser.Math.Between(-20, 20));
            
            // Slightly reddish tint for decoys (subtle, not obvious)
            sprite.setTint(0xc49070);

            sprite.on("pointerdown", () => this.hitDecoy(sprite));
            this.decoySprites.push(sprite);
        });
    }

    hitDecoy(sprite: Phaser.GameObjects.Image) {
        if (this.isTransitioning || this.narrative.isPlaying) return;
        
        sprite.disableInteractive();
        
        if (this.soundEnabled) this.sound.play("SFX_Wrong_Tap");
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        
        // Flash red and shake
        this.tweens.add({
            targets: sprite,
            tint: 0xff0000,
            scale: this.objectScale * 1.3,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                // X mark then fade
                const xMark = this.add.text(sprite.x, sprite.y, "✗", {
                    font: "bold 48px Arial", color: "#ff4444"
                }).setOrigin(0.5).setDepth(50);
                this.tweens.add({
                    targets: [sprite, xMark],
                    alpha: 0,
                    duration: 500,
                    onComplete: () => { sprite.destroy(); xMark.destroy(); }
                });
            }
        });
        
        // Penalty: lose time and score
        this.combo = 0;
        this.updateComboDisplay();
        
        if (this.timeLeft > 0) {
            const penalty = this.difficulty === "Hard" ? 10 : 5;
            this.timeLeft = Math.max(0, this.timeLeft - penalty);
            this.timerText.setText(this.formatTime(this.timeLeft));
            this.flashTimerRed();
            
            // Show penalty text
            const penaltyText = this.add.text(sprite.x, sprite.y - 60, `-${penalty}s DECOY!`, {
                font: "bold 28px Arial", color: "#ff4444"
            }).setOrigin(0.5).setDepth(50);
            this.tweens.add({
                targets: penaltyText, y: penaltyText.y - 80, alpha: 0, duration: 1200,
                onComplete: () => penaltyText.destroy()
            });
            
            if (this.timeLeft <= 0) this.gameOver(false);
        }
        
        this.score = Math.max(0, this.score - 50);
        this.scoreText.setText("Score: " + this.score);
    }

    addVisualNoise() {
        // Shadow overlays - dark patches that make scanning harder
        const shadowCount = this.difficulty === "Hard" ? 6 : this.difficulty === "Medium" ? 4 : 2;
        for (let i = 0; i < shadowCount; i++) {
            const sx = Phaser.Math.Between(SAFE_LEFT, SAFE_RIGHT);
            const sy = Phaser.Math.Between(SAFE_TOP + 100, SAFE_BOTTOM - 150);
            const shadow = this.add.ellipse(sx, sy, 
                Phaser.Math.Between(150, 350), Phaser.Math.Between(100, 250), 
                0x000000, Phaser.Math.FloatBetween(0.15, 0.35)
            ).setDepth(3);
            
            // Slowly drift shadows
            this.tweens.add({
                targets: shadow, x: sx + Phaser.Math.Between(-30, 30), alpha: shadow.alpha * 0.7,
                duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1, ease: "Sine.easeInOut"
            });
        }

        // Light flares - bright spots that distract
        const flareCount = this.difficulty === "Hard" ? 4 : 2;
        for (let i = 0; i < flareCount; i++) {
            const fx = Phaser.Math.Between(SAFE_LEFT + 50, SAFE_RIGHT - 50);
            const fy = Phaser.Math.Between(SAFE_TOP + 150, SAFE_BOTTOM - 200);
            const flare = this.add.circle(fx, fy, Phaser.Math.Between(20, 50), 0xffd700, 0.15).setDepth(8);
            this.tweens.add({
                targets: flare, alpha: Phaser.Math.FloatBetween(0.05, 0.25), 
                scaleX: 1.3, scaleY: 1.3,
                duration: Phaser.Math.Between(2000, 4000), yoyo: true, repeat: -1, ease: "Sine.easeInOut"
            });
        }

        // Dust particles using graphics-based approach
        for (let i = 0; i < 15; i++) {
            const dx = Phaser.Math.Between(0, GAME_WIDTH);
            const dy = Phaser.Math.Between(SAFE_TOP, SAFE_BOTTOM);
            const size = Phaser.Math.Between(2, 5);
            const dust = this.add.circle(dx, dy, size, 0xffeedd, Phaser.Math.FloatBetween(0.1, 0.3)).setDepth(9);
            this.tweens.add({
                targets: dust,
                x: dx + Phaser.Math.Between(-100, 100),
                y: dy + Phaser.Math.Between(-200, -50),
                alpha: 0,
                duration: Phaser.Math.Between(4000, 8000),
                repeat: -1,
                onRepeat: () => {
                    dust.setPosition(Phaser.Math.Between(0, GAME_WIDTH), SAFE_BOTTOM + 50);
                    dust.setAlpha(Phaser.Math.FloatBetween(0.1, 0.3));
                }
            });
        }
    }

    setupFogOfWar() {
        // Create dark overlay
        this.fogOverlay = this.add.graphics().setDepth(10);
        this.fogOverlay.fillStyle(0x000000, 0.7);
        this.fogOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Use a mask to reveal area around pointer
        this.fogMask = this.add.graphics().setDepth(10);
        
        // Create a render texture for the fog
        const fogRT = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setDepth(10);
        
        // Clear the simple overlay, we'll use renderTexture approach
        this.fogOverlay.destroy();
        
        // Update fog each frame
        this.events.on('update', () => {
            fogRT.clear();
            fogRT.fill(0x000000, 0.65);
            
            // Get pointer position in game coords
            const pointer = this.input.activePointer;
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            
            // Clear a circle around the pointer (reveal area)
            const revealRadius = this.difficulty === "Hard" ? 120 : 160;
            fogRT.erase(this.createRevealCircle(revealRadius), worldPoint.x - revealRadius, worldPoint.y - revealRadius);
            
            // Also reveal found-object locations slightly
            this.sprites.forEach(s => {
                if (!s.visible) {
                    fogRT.erase(this.createRevealCircle(60), s.x - 60, s.y - 60);
                }
            });
        });
    }
    
    private revealCircleTexture?: Phaser.GameObjects.Graphics;
    
    createRevealCircle(radius: number): Phaser.GameObjects.Graphics {
        if (this.revealCircleTexture) this.revealCircleTexture.destroy();
        const g = this.add.graphics().setVisible(false);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(radius, radius, radius);
        // Soft edge
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(radius, radius, radius * 1.2);
        this.revealCircleTexture = g;
        return g;
    }

    createUI() {
        // Top UI bar
        this.add.rectangle(SAFE_CENTER_X, SAFE_TOP + 40, SAFE_WIDTH, 80, 0x000000, 0.8)
            .setStrokeStyle(2, 0x333333).setDepth(20);

        // Found counter (left)
        this.counter = this.add.text(SAFE_LEFT + 20, SAFE_TOP + 40, "Found: 0 / " + this.objects.length, {
            font: "bold 28px Arial", color: "#ffffff"
        }).setOrigin(0, 0.5).setDepth(20);

        // Timer (center)
        this.timerText = this.add.text(SAFE_CENTER_X, SAFE_TOP + 40, this.formatTime(this.timeLeft), {
            font: "bold 32px Arial", color: "#ffffff"
        }).setOrigin(0.5).setDepth(20);

        // Hints (right)
        this.hintsText = this.add.text(SAFE_RIGHT - 20, SAFE_TOP + 40, "💡 " + this.hints, {
            font: "bold 28px Arial", color: "#4ade80"
        }).setOrigin(1, 0.5).setDepth(20);

        // Score bar (second row)
        this.add.rectangle(SAFE_CENTER_X, SAFE_TOP + 100, SAFE_WIDTH, 50, 0x000000, 0.6)
            .setStrokeStyle(1, 0x444444).setDepth(20);
        
        this.scoreText = this.add.text(SAFE_LEFT + 20, SAFE_TOP + 100, "Score: 0", {
            font: "bold 24px Arial", color: "#ffd700"
        }).setOrigin(0, 0.5).setDepth(20);

        // Combo display (center of score bar)
        this.comboText = this.add.text(SAFE_CENTER_X, SAFE_TOP + 100, "", {
            font: "bold 28px Arial", color: "#ff6b35"
        }).setOrigin(0.5).setDepth(20);

        // Ambient toggle (top right corner)
        this.createAmbientToggle();

        // Bottom button bar
        this.add.rectangle(SAFE_CENTER_X, SAFE_BOTTOM - 50, SAFE_WIDTH, 100, 0x000000, 0.7)
            .setStrokeStyle(2, 0x333333).setDepth(20);

        // Hint button
        const hintBtn = this.add.rectangle(SAFE_RIGHT - 100, SAFE_BOTTOM - 50, 160, 60, 0x4ade80, 0.9)
            .setInteractive({ useHandCursor: true }).setDepth(20);
        this.add.text(SAFE_RIGHT - 100, SAFE_BOTTOM - 50, "Use Hint", {
            font: "bold 22px Arial", color: "#000000"
        }).setOrigin(0.5).setDepth(20);
        hintBtn.on("pointerdown", () => this.useHint());

        // Exit button
        const backBtn = this.add.rectangle(SAFE_LEFT + 100, SAFE_BOTTOM - 50, 160, 60, 0xef4444, 0.9)
            .setInteractive({ useHandCursor: true }).setDepth(20);
        this.add.text(SAFE_LEFT + 100, SAFE_BOTTOM - 50, "Exit", {
            font: "bold 22px Arial", color: "#ffffff"
        }).setOrigin(0.5).setDepth(20);
        backBtn.on("pointerdown", () => {
            if (this.timerEvent) this.timerEvent.destroy();
            this.cleanupAllAudio();
            this.scene.start("DifficultySelectScene");
        });
    }

    createAmbientToggle() {
        const x = SAFE_RIGHT - 30;
        const y = SAFE_TOP + 100;
        const btn = this.add.container(x, y).setDepth(25);
        
        const circle = this.add.circle(0, 0, 22, 0x000000, 0.6).setStrokeStyle(2, 0xaaaaaa);
        const icon = this.add.text(0, 0, this.soundEnabled ? "🔊" : "🔇", {
            font: "20px Arial"
        }).setOrigin(0.5);
        
        btn.add([circle, icon]);
        circle.setInteractive({ useHandCursor: true });
        
        circle.on("pointerdown", () => {
            this.soundEnabled = !this.soundEnabled;
            this.registry.set("soundEnabled", this.soundEnabled);
            icon.setText(this.soundEnabled ? "🔊" : "🔇");
            
            if (this.soundEnabled) {
                if (this.ambientMusic && !(this.ambientMusic as any).isPlaying) {
                    this.ambientMusic.play();
                }
            } else {
                this.sound.pauseAll();
            }
        });
        
        this.ambientToggleBtn = btn;
    }

    startTimer() {
        if (this.timeLeft <= 0) return;

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeLeft--;
                this.timerText.setText(this.formatTime(this.timeLeft));

                // Color transitions
                if (this.timeLeft <= 10) {
                    this.timerText.setColor("#ff0000");
                    this.timerText.setFontSize(38);
                    // Pulse effect
                    this.tweens.add({
                        targets: this.timerText, scale: 1.2, duration: 100, yoyo: true
                    });
                } else if (this.timeLeft <= 30) {
                    this.timerText.setColor("#ef4444");
                } else if (this.timeLeft <= 60) {
                    this.timerText.setColor("#fbbf24");
                }

                if (this.timeLeft <= 0) this.gameOver(false);
            },
            loop: true
        });
    }

    flashTimerRed() {
        this.tweens.add({
            targets: this.timerText, scale: 1.3, duration: 100, yoyo: true,
            onStart: () => this.timerText.setColor("#ff0000"),
            onComplete: () => {
                if (this.timeLeft <= 30) this.timerText.setColor("#ef4444");
                else this.timerText.setColor("#ffffff");
            }
        });
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    pickObject(sprite: Phaser.GameObjects.Image) {
        if (this.narrative.isPlaying || this.isTransitioning) return;
        if (navigator.vibrate) navigator.vibrate(10);
        
        sprite.disableInteractive();

        // Calculate score with combo
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        const comboMultiplier = Math.min(this.combo, 5); // Max 5x
        const basePoints = 100;
        const timeBonus = Math.floor(this.timeLeft / this.maxTime * 50);
        const points = (basePoints + timeBonus) * comboMultiplier;
        this.score += points;
        
        // Reset combo timer
        if (this.comboTimer) this.comboTimer.destroy();
        this.comboTimer = this.time.delayedCall(3000, () => {
            this.combo = 0;
            this.updateComboDisplay();
        });

        // Animate found object with sparkle effect
        this.tweens.add({
            targets: sprite, scale: this.objectScale * 1.5, alpha: 0, duration: 400, ease: "Power2",
            onComplete: () => sprite.setVisible(false)
        });

        // Score popup
        const popupText = this.add.text(sprite.x, sprite.y - 40, `+${points}`, {
            font: "bold 32px Arial", color: "#ffd700"
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({
            targets: popupText, y: popupText.y - 80, alpha: 0, duration: 1000,
            onComplete: () => popupText.destroy()
        });

        // Sparkle particles around found object
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const spark = this.add.circle(
                sprite.x + Math.cos(angle) * 20, sprite.y + Math.sin(angle) * 20,
                4, 0xffd700, 1
            ).setDepth(50);
            this.tweens.add({
                targets: spark,
                x: sprite.x + Math.cos(angle) * 80,
                y: sprite.y + Math.sin(angle) * 80,
                alpha: 0, scale: 0,
                duration: 600, ease: "Power2",
                onComplete: () => spark.destroy()
            });
        }

        if (this.soundEnabled) this.sound.play("SFX_Object_Found");

        this.found++;
        this.counter.setText("Found: " + this.found + " / " + this.objects.length);
        this.scoreText.setText("Score: " + this.score);
        this.updateComboDisplay();

        // Pulse the counter
        this.tweens.add({
            targets: this.counter, scale: 1.3, duration: 150, yoyo: true,
            onStart: () => this.counter.setColor("#4ade80"),
            onComplete: () => this.counter.setColor("#ffffff")
        });

        // Mid-scene narrative
        if (this.found === Math.floor(this.objects.length / 2) && this.soundEnabled) {
            this.narrative.play(this.getWorldMidId(), this);
        }

        if (this.found === this.objects.length) {
            if (this.timerEvent) this.timerEvent.destroy();
            this.stopAmbient();
            this.isTransitioning = true;
            
            // Store score
            const prevTotal = this.registry.get("totalScore") || 0;
            this.registry.set("totalScore", prevTotal + this.score);
            const prevCombo = this.registry.get("totalCombo") || 0;
            if (this.maxCombo > prevCombo) this.registry.set("totalCombo", this.maxCombo);
            
            // Dramatic completion animation
            this.playCompletionAnimation(() => {
                this.narrative.play(this.getWorldCompleteId(), this, () => this.nextScene());
                if (!this.soundEnabled) this.time.delayedCall(1000, () => this.nextScene());
            });
        }
    }

    playCompletionAnimation(onDone: () => void) {
        // Full-screen flash
        const flash = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0xffd700, 0).setDepth(100);
        
        // Flash in
        this.tweens.add({
            targets: flash, alpha: 0.6, duration: 300, yoyo: true, repeat: 1,
        });

        // Big "SCENE COMPLETE" text
        const completeText = this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y, "✨ SCENE COMPLETE ✨", {
            font: "bold 56px Arial", color: "#ffd700"
        }).setOrigin(0.5).setDepth(101).setScale(0);

        this.tweens.add({
            targets: completeText, scale: 1, duration: 500, ease: "Back.easeOut",
            delay: 300
        });

        // Score summary
        const scoreSummary = this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y + 80, `Score: ${this.score}  |  Max Combo: x${this.maxCombo}`, {
            font: "bold 28px Arial", color: "#ffffff"
        }).setOrigin(0.5).setDepth(101).setAlpha(0);

        this.tweens.add({
            targets: scoreSummary, alpha: 1, duration: 400, delay: 700
        });

        // Celebration particles
        for (let i = 0; i < 20; i++) {
            const px = Phaser.Math.Between(SAFE_LEFT, SAFE_RIGHT);
            const py = SAFE_BOTTOM;
            const colors = [0xffd700, 0xff6b35, 0x4ade80, 0x60a5fa, 0xff4444];
            const particle = this.add.circle(px, py, Phaser.Math.Between(4, 10), 
                colors[i % colors.length], 1).setDepth(102);
            this.tweens.add({
                targets: particle,
                y: Phaser.Math.Between(SAFE_TOP, SAFE_CENTER_Y),
                x: px + Phaser.Math.Between(-100, 100),
                alpha: 0,
                duration: Phaser.Math.Between(1000, 2000),
                delay: Phaser.Math.Between(0, 500),
                onComplete: () => particle.destroy()
            });
        }

        // Continue after animation
        this.time.delayedCall(2500, () => {
            completeText.destroy();
            scoreSummary.destroy();
            flash.destroy();
            onDone();
        });
    }

    updateComboDisplay() {
        if (this.combo >= 2) {
            const label = this.combo >= 5 ? "🔥 LEGENDARY x" + this.combo :
                          this.combo >= 4 ? "⚡ ON FIRE x" + this.combo :
                          this.combo >= 3 ? "🌟 COMBO x" + this.combo :
                          "✨ x" + this.combo;
            this.comboText.setText(label);
            this.tweens.add({
                targets: this.comboText, scale: 1.3, duration: 150, yoyo: true
            });
        } else {
            this.comboText.setText("");
        }
    }

    useHint() {
        if (this.narrative.isPlaying || this.isTransitioning) return;
        if (this.hints <= 0) return;

        const remaining = this.sprites.filter(s => s.visible);
        if (remaining.length === 0) return;

        this.hints--;
        this.hintsText.setText("💡 " + this.hints);

        // Hint costs 15 seconds
        if (this.timeLeft > 0) {
            this.timeLeft = Math.max(1, this.timeLeft - 15);
            this.timerText.setText(this.formatTime(this.timeLeft));
            
            const penaltyText = this.add.text(SAFE_CENTER_X, SAFE_TOP + 150, "-15s Hint Used!", {
                font: "bold 24px Arial", color: "#fbbf24"
            }).setOrigin(0.5).setDepth(50);
            this.tweens.add({
                targets: penaltyText, alpha: 0, y: penaltyText.y - 40, duration: 1500,
                onComplete: () => penaltyText.destroy()
            });
        }

        // Reset combo
        this.combo = 0;
        this.updateComboDisplay();

        if (this.soundEnabled) this.sound.play("SFX_Hint_Used");

        const target = Phaser.Utils.Array.GetRandom(remaining);
        
        // Temporarily remove tint and boost alpha to make visible
        const origTint = target.tintTopLeft;
        target.clearTint();
        target.setAlpha(1);
        
        this.tweens.add({
            targets: target, scale: this.objectScale * 1.5, yoyo: true, duration: 300, repeat: 3,
            ease: "Sine.easeInOut",
            onComplete: () => {
                target.setTint(origTint);
                target.setAlpha(0.75);
            }
        });

        const glow = this.add.circle(target.x, target.y, 80, 0xffd700, 0.5).setDepth(15);
        this.tweens.add({
            targets: glow, alpha: 0, scale: 1.5, duration: 1500,
            onComplete: () => glow.destroy()
        });
    }

    gameOver(won: boolean) {
        if (this.timerEvent) this.timerEvent.destroy();
        if (this.comboTimer) this.comboTimer.destroy();
        this.cleanupAllAudio();
        this.isTransitioning = true;
        
        if (navigator.vibrate) {
            navigator.vibrate(won ? [20, 10, 20, 10, 50] : [100, 50, 100]);
        }

        const overlay = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(200);
        
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y - 150, won ? "Scene Complete!" : "⏰ Time's Up!", {
            font: "bold 56px Arial", color: won ? "#4ade80" : "#ef4444"
        }).setOrigin(0.5).setDepth(201);

        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y - 70, `Score: ${this.score}  |  Found: ${this.found}/${this.objects.length}`, {
            font: "bold 28px Arial", color: "#ffffff"
        }).setOrigin(0.5).setDepth(201);

        const retryBtn = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y + 50, 280, 70, 0xfbbf24)
            .setInteractive({ useHandCursor: true }).setDepth(201);
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y + 50, "Try Again", {
            font: "bold 32px Arial", color: "#000000"
        }).setOrigin(0.5).setDepth(201);
        retryBtn.on("pointerdown", () => this.scene.restart());
    }

    nextScene() {
        // Override in subclasses
    }
}

// ==========================================
// SHARED VICTORY SCREEN
// ==========================================

function showVictoryScreen(scene: Phaser.Scene, weekNum: number) {
    const totalScore = (scene.registry.get("totalScore") || 0);
    const maxCombo = scene.registry.get("totalCombo") || 0;
    const difficulty = scene.registry.get("difficulty");

    scene.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92).setDepth(200);
    
    const weekLabel = weekNum === 2 ? "🛡️ VIKING RAID COMPLETE!" : "🏆 ADVENTURE COMPLETE!";
    scene.add.text(SAFE_CENTER_X, SAFE_TOP + 80, weekLabel, {
        font: "bold 52px Arial", color: "#ffd700"
    }).setOrigin(0.5).setDepth(201);

    scene.add.text(SAFE_CENTER_X, SAFE_TOP + 160, `Final Score: ${totalScore}  |  Best Combo: x${maxCombo}`, {
        font: "bold 28px Arial", color: "#ffffff"
    }).setOrigin(0.5).setDepth(201);

    const playerName = "Explorer";
    
    addToLeaderboard({
        name: playerName, score: totalScore, difficulty, week: weekNum,
        date: new Date().toISOString()
    });

    // Current week leaderboard
    const thisWeekLb = getLeaderboardByWeek(weekNum);
    scene.add.text(SAFE_CENTER_X, SAFE_TOP + 240, `📊 WEEK ${weekNum} — TOP 5`, {
        font: "bold 32px Arial", color: "#ffd700"
    }).setOrigin(0.5).setDepth(201);

    const lbStartY = SAFE_TOP + 300;
    thisWeekLb.forEach((entry, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
        const isCurrentRun = entry.score === totalScore && entry.difficulty === difficulty;
        const color = isCurrentRun ? "#ffd700" : "#cccccc";
        scene.add.text(SAFE_CENTER_X, lbStartY + idx * 45, 
            `${medal}  ${entry.name} — ${entry.score} pts (${entry.difficulty})`, {
            font: `${isCurrentRun ? 'bold ' : ''}24px Arial`, color
        }).setOrigin(0.5).setDepth(201);
    });

    // Cross-week comparison
    const otherWeek = weekNum === 1 ? 2 : 1;
    const otherLb = getLeaderboardByWeek(otherWeek);
    if (otherLb.length > 0) {
        const compY = lbStartY + thisWeekLb.length * 45 + 30;
        scene.add.text(SAFE_CENTER_X, compY, `Week ${otherWeek} Best: ${otherLb[0].score} pts`, {
            font: "22px Arial", color: "#888888"
        }).setOrigin(0.5).setDepth(201);
    }

    // Buttons
    const btnY = SAFE_BOTTOM - 100;
    const menuBtn = scene.add.rectangle(SAFE_CENTER_X - 100, btnY, 180, 70, 0x4ade80)
        .setInteractive({ useHandCursor: true }).setDepth(201);
    scene.add.text(SAFE_CENTER_X - 100, btnY, "Play Again", {
        font: "bold 26px Arial", color: "#000000"
    }).setOrigin(0.5).setDepth(201);
    menuBtn.on("pointerdown", () => scene.scene.start("DifficultySelectScene"));

    const weekBtn = scene.add.rectangle(SAFE_CENTER_X + 100, btnY, 180, 70, 0x4488cc)
        .setInteractive({ useHandCursor: true }).setDepth(201);
    scene.add.text(SAFE_CENTER_X + 100, btnY, "Weeks", {
        font: "bold 26px Arial", color: "#ffffff"
    }).setOrigin(0.5).setDepth(201);
    weekBtn.on("pointerdown", () => scene.scene.start("WeekSelectScene"));
}

// ==========================================
// WEEK 1 — ROMAN WORLD SCENES
// ==========================================

class BarracksScene extends HopaScene {
    constructor() {
        super("BarracksScene", "barracks", "AMB_Barracks", "barracks",
            ["gold_coin", "roman_key", "laurel_crown", "oil_lamp", "gem_ring"]);
    }
    nextScene() { this.scene.start("MarketScene"); }
}

class MarketScene extends HopaScene {
    constructor() {
        super("MarketScene", "market", "AMB_Market", "market",
            ["dice", "statue_hand", "coin_purse", "wax_tablet", "theatre_mask",
             "mosaic_tile", "ceramic_vase", "centurion_helmet", "torch", "aquila_standard"]);
    }
    nextScene() { this.scene.start("ForumScene"); }
}

class ForumScene extends HopaScene {
    constructor() {
        super("ForumScene", "forum", "AMB_Forum", "forum",
            ["perfume_bottle", "open_scroll", "gladius_sword", "empire_map", "legionary_shield"]);
    }

    nextScene() {
        // totalScore already accumulated by parent pickObject
        showVictoryScreen(this, 1);
    }
}

// ==========================================
// WEEK 2 — VIKING RAID SCENE
// ==========================================

class VikingLonghouseScene extends HopaScene {
    private lightningTimer?: Phaser.Time.TimerEvent;
    private vikingAmbientNodes: { gainNode?: GainNode; sources: AudioBufferSourceNode[] } = { sources: [] };
    
    constructor() {
        // Use a dummy ambient key — we'll handle ambient ourselves
        super("VikingLonghouseScene", "longhouse", "AMB_Barracks", "barracks",
            ["viking_helmet", "runestone", "thors_hammer", "silver_armband", "war_axe"]);
    }

    applyDifficulty() {
        const isLandscape = GAME_WIDTH > GAME_HEIGHT;
        const scaleFactor = isLandscape ? 0.55 : 1.0;
        const week2Reduction = 0.6;
        
        if (this.difficulty === "Easy") {
            this.maxTime = 150;
            this.timeLeft = 150;
            this.hints = 2;
            this.objectScale = 0.12 * scaleFactor * week2Reduction;
            this.fogEnabled = true;
            this.decoyCount = 0;
        } else if (this.difficulty === "Medium") {
            this.maxTime = 120;
            this.timeLeft = 120;
            this.hints = 1;
            this.objectScale = 0.09 * scaleFactor * week2Reduction;
            this.fogEnabled = true;
            this.decoyCount = 2;
        } else {
            this.maxTime = 90;
            this.timeLeft = 90;
            this.hints = 0;
            this.objectScale = 0.07 * scaleFactor * week2Reduction;
            this.fogEnabled = true;
            this.decoyCount = 3;
        }
    }

    create() {
        super.create();
        this.startLightningStorms();
        // Replace default ambient with procedural Viking ambient
        this.stopAmbient();
        if (this.soundEnabled) {
            this.startVikingAmbient();
        }
    }

    // Procedural ambient: wind/storm noise + crackling fire using Web Audio
    startVikingAmbient() {
        try {
            const ctx = (this.sound as any).context as AudioContext;
            if (!ctx) return;
            
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.15;
            masterGain.connect(ctx.destination);
            this.vikingAmbientNodes.gainNode = masterGain;

            // Storm wind: filtered white noise
            const windDuration = 10;
            const windBuffer = ctx.createBuffer(1, ctx.sampleRate * windDuration, ctx.sampleRate);
            const windData = windBuffer.getChannelData(0);
            for (let i = 0; i < windData.length; i++) {
                windData[i] = (Math.random() * 2 - 1) * 0.5;
            }
            const windSource = ctx.createBufferSource();
            windSource.buffer = windBuffer;
            windSource.loop = true;
            const windFilter = ctx.createBiquadFilter();
            windFilter.type = 'lowpass';
            windFilter.frequency.value = 400;
            windFilter.Q.value = 1;
            // Modulate filter for gusting effect
            const windLFO = ctx.createOscillator();
            const windLFOGain = ctx.createGain();
            windLFO.frequency.value = 0.15;
            windLFOGain.gain.value = 200;
            windLFO.connect(windLFOGain);
            windLFOGain.connect(windFilter.frequency);
            windLFO.start();
            
            const windGain = ctx.createGain();
            windGain.gain.value = 0.6;
            windSource.connect(windFilter);
            windFilter.connect(windGain);
            windGain.connect(masterGain);
            windSource.start();
            this.vikingAmbientNodes.sources.push(windSource);

            // Fire crackle: short bursts of filtered noise
            const crackDuration = 8;
            const crackBuffer = ctx.createBuffer(1, ctx.sampleRate * crackDuration, ctx.sampleRate);
            const crackData = crackBuffer.getChannelData(0);
            for (let i = 0; i < crackData.length; i++) {
                // Random pops and crackles
                crackData[i] = Math.random() > 0.97 ? (Math.random() * 2 - 1) * 0.8 : 
                               Math.random() > 0.85 ? (Math.random() * 2 - 1) * 0.2 : 0;
            }
            const crackSource = ctx.createBufferSource();
            crackSource.buffer = crackBuffer;
            crackSource.loop = true;
            const crackFilter = ctx.createBiquadFilter();
            crackFilter.type = 'highpass';
            crackFilter.frequency.value = 800;
            const crackGain = ctx.createGain();
            crackGain.gain.value = 0.4;
            crackSource.connect(crackFilter);
            crackFilter.connect(crackGain);
            crackGain.connect(masterGain);
            crackSource.start();
            this.vikingAmbientNodes.sources.push(crackSource);

            // Rain: filtered pink-ish noise
            const rainDuration = 6;
            const rainBuffer = ctx.createBuffer(1, ctx.sampleRate * rainDuration, ctx.sampleRate);
            const rainData = rainBuffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < rainData.length; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                rainData[i] = (b0 + b1 + b2 + white * 0.1848) * 0.06;
            }
            const rainSource = ctx.createBufferSource();
            rainSource.buffer = rainBuffer;
            rainSource.loop = true;
            const rainFilter = ctx.createBiquadFilter();
            rainFilter.type = 'bandpass';
            rainFilter.frequency.value = 3000;
            rainFilter.Q.value = 0.5;
            const rainGain = ctx.createGain();
            rainGain.gain.value = 0.3;
            rainSource.connect(rainFilter);
            rainFilter.connect(rainGain);
            rainGain.connect(masterGain);
            rainSource.start();
            this.vikingAmbientNodes.sources.push(rainSource);
        } catch (e) {
            console.warn('Viking ambient audio failed:', e);
        }
    }

    stopVikingAmbient() {
        this.vikingAmbientNodes.sources.forEach(s => { try { s.stop(); } catch {} });
        this.vikingAmbientNodes.sources = [];
        if (this.vikingAmbientNodes.gainNode) {
            try { this.vikingAmbientNodes.gainNode.disconnect(); } catch {}
        }
    }

    cleanupAllAudio() {
        super.cleanupAllAudio();
        this.stopVikingAmbient();
    }

    // Override fog to be darker with smaller radius
    setupFogOfWar() {
        const fogRT = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setDepth(10);
        
        this.events.on('update', () => {
            fogRT.clear();
            fogRT.fill(0x000000, 0.80); // Much darker than Week 1 (0.65)
            
            const pointer = this.input.activePointer;
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            
            // Smaller reveal radius than Week 1
            const revealRadius = this.difficulty === "Hard" ? 80 : this.difficulty === "Medium" ? 100 : 130;
            fogRT.erase(this.createRevealCircle(revealRadius), worldPoint.x - revealRadius, worldPoint.y - revealRadius);
            
            this.sprites.forEach(s => {
                if (!s.visible) {
                    fogRT.erase(this.createRevealCircle(40), s.x - 40, s.y - 40);
                }
            });
        });
    }

    // Override placeObjects with Viking-specific tints (blues, grays, dark wood)
    placeObjects() {
        this.found = 0;
        this.sprites = [];
        const placed: { x: number; y: number }[] = [];
        const minDist = 100;

        const placeTop = SAFE_TOP + 120;
        const placeBottom = SAFE_BOTTOM - 200;
        const placeLeft = SAFE_LEFT + 40;
        const placeRight = SAFE_RIGHT - 40;

        // Dark blue/gray/wood tints for Viking scene
        const blendTints = [0x4a5568, 0x5a4a3a, 0x6b7280, 0x8b6914, 0x374151, 0x5c4033];

        this.objects.forEach((key, idx) => {
            let x: number = 0, y: number = 0, valid = false, tries = 0;
            while (!valid && tries < 200) {
                x = Phaser.Math.Between(placeLeft, placeRight);
                y = Phaser.Math.Between(placeTop, placeBottom);
                valid = !placed.some(p => Phaser.Math.Distance.Between(p.x, p.y, x, y) < minDist);
                tries++;
            }
            placed.push({ x, y });

            const sprite = this.add.image(x, y, key)
                .setScale(this.objectScale)
                .setInteractive({ useHandCursor: true })
                .setDepth(5);

            sprite.setTint(blendTints[idx % blendTints.length]);
            sprite.setAlpha(0.65); // More hidden than Week 1
            sprite.setAngle(Phaser.Math.Between(-20, 20));

            sprite.on("pointerover", () => { sprite.setAlpha(0.8); });
            sprite.on("pointerout", () => { sprite.setAlpha(0.65); });
            sprite.on("pointerdown", () => this.pickObject(sprite));
            this.sprites.push(sprite);
        });
    }

    // Override placeDecoys — Viking decoys with 20s penalty
    placeDecoys() {
        if (this.decoyCount === 0) return;
        
        const decoyKeys = ["mead_horn", "bone_comb", "iron_brooch"].slice(0, this.decoyCount);

        const placeTop = SAFE_TOP + 120;
        const placeBottom = SAFE_BOTTOM - 200;
        const placeLeft = SAFE_LEFT + 40;
        const placeRight = SAFE_RIGHT - 40;

        decoyKeys.forEach(key => {
            const x = Phaser.Math.Between(placeLeft, placeRight);
            const y = Phaser.Math.Between(placeTop, placeBottom);

            const sprite = this.add.image(x, y, key)
                .setScale(this.objectScale * 0.85)
                .setInteractive({ useHandCursor: true })
                .setDepth(5)
                .setAlpha(0.55)
                .setAngle(Phaser.Math.Between(-25, 25));
            
            sprite.setTint(0x5c4033);

            sprite.on("pointerdown", () => this.hitVikingDecoy(sprite));
            this.decoySprites.push(sprite);
        });
    }

    hitVikingDecoy(sprite: Phaser.GameObjects.Image) {
        if (this.isTransitioning || this.narrative.isPlaying) return;
        
        sprite.disableInteractive();
        if (this.soundEnabled) this.sound.play("SFX_Wrong_Tap");
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        
        this.tweens.add({
            targets: sprite, tint: 0xff0000, scale: this.objectScale * 1.3, duration: 200, yoyo: true,
            onComplete: () => {
                const xMark = this.add.text(sprite.x, sprite.y, "✗", {
                    font: "bold 48px Arial", color: "#ff4444"
                }).setOrigin(0.5).setDepth(50);
                this.tweens.add({
                    targets: [sprite, xMark], alpha: 0, duration: 500,
                    onComplete: () => { sprite.destroy(); xMark.destroy(); }
                });
            }
        });
        
        this.combo = 0;
        this.updateComboDisplay();
        
        // 20 second penalty for Viking decoys
        if (this.timeLeft > 0) {
            const penalty = 20;
            this.timeLeft = Math.max(0, this.timeLeft - penalty);
            this.timerText.setText(this.formatTime(this.timeLeft));
            this.flashTimerRed();
            
            const penaltyText = this.add.text(sprite.x, sprite.y - 60, `-${penalty}s DECOY!`, {
                font: "bold 32px Arial", color: "#ff4444"
            }).setOrigin(0.5).setDepth(50);
            this.tweens.add({
                targets: penaltyText, y: penaltyText.y - 80, alpha: 0, duration: 1200,
                onComplete: () => penaltyText.destroy()
            });
            
            if (this.timeLeft <= 0) this.gameOver(false);
        }
        
        this.score = Math.max(0, this.score - 100);
        this.scoreText.setText("Score: " + this.score);
    }

    // Override addVisualNoise with fire/storm effects
    addVisualNoise() {
        // Smoke rising from fire
        for (let i = 0; i < 12; i++) {
            const sx = SAFE_CENTER_X + Phaser.Math.Between(-100, 100);
            const sy = SAFE_BOTTOM - 100;
            const smoke = this.add.circle(sx, sy, Phaser.Math.Between(8, 20), 0x333333, 0.2).setDepth(3);
            this.tweens.add({
                targets: smoke,
                x: sx + Phaser.Math.Between(-60, 60),
                y: SAFE_TOP + Phaser.Math.Between(50, 200),
                alpha: 0, scale: 2,
                duration: Phaser.Math.Between(5000, 10000),
                repeat: -1,
                onRepeat: () => {
                    smoke.setPosition(SAFE_CENTER_X + Phaser.Math.Between(-100, 100), SAFE_BOTTOM - 100);
                    smoke.setAlpha(0.2); smoke.setScale(1);
                }
            });
        }

        // Firelight glow — flickering orange
        const fireGlow = this.add.circle(SAFE_CENTER_X, SAFE_CENTER_Y + 100, 200, 0xff6600, 0.08).setDepth(2);
        this.tweens.add({
            targets: fireGlow, alpha: 0.15, scaleX: 1.2, scaleY: 1.2,
            duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
        });

        // Rain streaks through doorway area
        for (let i = 0; i < 20; i++) {
            const rx = Phaser.Math.Between(SAFE_LEFT, SAFE_RIGHT);
            const ry = Phaser.Math.Between(SAFE_TOP, SAFE_BOTTOM);
            const rain = this.add.rectangle(rx, ry, 2, Phaser.Math.Between(15, 40), 0x6699cc, 0.15).setDepth(9);
            this.tweens.add({
                targets: rain, y: ry + 200, alpha: 0,
                duration: Phaser.Math.Between(500, 1200),
                repeat: -1,
                onRepeat: () => {
                    rain.setPosition(Phaser.Math.Between(SAFE_LEFT, SAFE_RIGHT), SAFE_TOP);
                    rain.setAlpha(0.15);
                }
            });
        }
        
        // Dark shadow patches
        for (let i = 0; i < 5; i++) {
            const sx = Phaser.Math.Between(SAFE_LEFT, SAFE_RIGHT);
            const sy = Phaser.Math.Between(SAFE_TOP + 100, SAFE_BOTTOM - 150);
            const shadow = this.add.ellipse(sx, sy, 
                Phaser.Math.Between(180, 400), Phaser.Math.Between(120, 280), 
                0x000000, Phaser.Math.FloatBetween(0.2, 0.4)
            ).setDepth(3);
            this.tweens.add({
                targets: shadow, x: sx + Phaser.Math.Between(-20, 20), alpha: shadow.alpha * 0.6,
                duration: Phaser.Math.Between(4000, 7000), yoyo: true, repeat: -1, ease: "Sine.easeInOut"
            });
        }
    }

    // Lightning storms every 20-30 seconds
    startLightningStorms() {
        const scheduleFlash = () => {
            const delay = Phaser.Math.Between(20000, 30000);
            this.lightningTimer = this.time.delayedCall(delay, () => {
                if (this.isTransitioning) return;
                this.doLightningFlash();
                scheduleFlash();
            });
        };
        scheduleFlash();
    }

    doLightningFlash() {
        // Brief white flash that blinds for 1 second
        const flash = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
            .setDepth(500);
        
        // Quick flash in
        this.tweens.add({
            targets: flash, alpha: 0.9, duration: 80,
            onComplete: () => {
                // Hold for ~800ms then fade
                this.tweens.add({
                    targets: flash, alpha: 0, duration: 200, delay: 800,
                    onComplete: () => flash.destroy()
                });
            }
        });

        // Camera shake
        this.cameras.main.shake(300, 0.008);

        // Thunder rumble (vibrate)
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    }

    nextScene() {
        // totalScore already accumulated by parent pickObject
        if (this.lightningTimer) this.lightningTimer.destroy();
        showVictoryScreen(this, 2);
    }
}

// ==========================================
// GAME FACTORY
// ==========================================

export function createHopaGame(parent: HTMLElement): Phaser.Game {
    const parentWidth = parent.clientWidth || window.innerWidth;
    const parentHeight = parent.clientHeight || window.innerHeight;
    const isLandscape = parentWidth > parentHeight;
    computeLayout(isLandscape);

    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parent,
        backgroundColor: "#1a1a2e",
        scene: [BootScene, WeekSelectScene, DifficultySelectScene, BarracksScene, MarketScene, ForumScene, VikingLonghouseScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: GAME_WIDTH,
            height: GAME_HEIGHT
        },
        input: { activePointers: 3, touch: true },
        fps: { target: 60, smoothStep: true },
        render: { antialias: true, roundPixels: true, powerPreference: 'low-power' }
    };

    const game = new Phaser.Game(config);
    
    game.events.on('blur', () => {
        game.scene.scenes.forEach(scene => {
            if (scene.scene.isActive()) { scene.scene.pause(); scene.sound?.pauseAll(); }
        });
    });
    
    game.events.on('focus', () => {
        game.scene.scenes.forEach(scene => {
            if (scene.scene.isPaused()) { scene.scene.resume(); scene.sound?.resumeAll(); }
        });
    });
    
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobileDevice && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(() => {});
    }
    
    return game;
}

export { NarrativeController };
