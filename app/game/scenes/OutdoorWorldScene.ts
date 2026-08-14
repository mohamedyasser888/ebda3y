import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }            from '../entities/Wizard';
import { PlayerController }  from '../systems/PlayerController';
import { EvilGuidanceSystem } from '../systems/EvilGuidanceSystem';
import { BUILDINGS } from '../data/buildings';
import { H2_BUILDING_DOOR } from '../data/buildings';
import {
  WORLD_W,
  WORLD_H,
  OUTDOOR_PLAYER_SPAWN,
  HOGWARTS_GROUND,
  HOGWARTS_PATHS,
  DUEL_BUILDING_POSITION,
  DUEL_BUILDING_DOOR,
  DUEL_BUILDING_LAYOUT,
  TILE_SIZE,
  groundColor,
  pathColor,
} from '../data/MapConfig';
import type { BuildingDef }  from '../../types/game.types';

type CollisionBlock = {
  x: number; y: number;
  w?: number; width?: number;
  h?: number; height?: number;
};

type DuelingBuildingLayout = {
  door?: { x: number; y: number; w: number; h: number };
  collision?: CollisionBlock[] | number[][];
};

export class OutdoorWorldScene extends Phaser.Scene {
  private wizard!:          Wizard;
  private controller!:      PlayerController;
  private staticGroup!:     Phaser.Physics.Arcade.StaticGroup;
  private nearBuilding:     BuildingDef | null = null;
  private isTransitioning   = false;

  private doorGlows:  Map<string, Phaser.GameObjects.Arc> = new Map();
  private doorLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private duellingDoorPrompt?:  Phaser.GameObjects.Text;
  private botanicalDoorPrompt?: Phaser.GameObjects.Text;
  private astronomyDoorPrompt?: Phaser.GameObjects.Text;
  private libraryDoorPrompt?:   Phaser.GameObjects.Text;
  private creaturesDoorPrompt?: Phaser.GameObjects.Text;
  private hospitalDoorPrompt?:  Phaser.GameObjects.Text;
  private evilGuidance?:        EvilGuidanceSystem;
  private h2DoorPrompt?:        Phaser.GameObjects.Text;

  constructor() { super({ key: 'OutdoorWorldScene' }); }

  preload() {
    this.load.image('duelingBuildingSprite',   '/assets/buildings/dueling/dueling-building.png');
    this.load.image('botanicalBuildingSprite', '/assets/buildings/botanical-classroom-exterior.png');
    this.load.image('astronomyTowerSprite',    '/assets/buildings/astronomy-tower-exterior.png');
    this.load.image('libraryBuildingSprite',   '/assets/buildings/hogwarts-library-exterior.png');
    this.load.image('creaturesClassSprite',    '/assets/buildings/creatures-class-exterior.png');
    this.load.image('magicalHospitalSprite',   '/assets/buildings/magical-hospital-exterior.png');
    this.load.image('h2BuildingSprite',        '/assets/buildings/h2-building-exterior.png');
    this.load.image('roadTexture',             '/assets/backgrounds/road-texture.png');
  }

  create(data?: { returnX?: number; returnY?: number }) {
    this.isTransitioning = false;
    this.nearBuilding    = null;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    this._drawGround();
    this._drawPaths();
    this._drawWater();
    this._drawDecoration();
    this._drawBuildings();
    this._createColliders();
    this._createDoorIndicators();
    this._spawnAmbientLife();

    // Duelling door prompt
    this.duellingDoorPrompt = this.add.text(DUEL_BUILDING_DOOR.x, DUEL_BUILDING_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Botanical door prompt
    const BOTANICAL_DOOR = {
      x: 110 * TILE_SIZE + 30 * TILE_SIZE + (4 * TILE_SIZE) / 2,
      y: 50  * TILE_SIZE + 28 * TILE_SIZE + (4 * TILE_SIZE) / 2,
    };
    this.botanicalDoorPrompt = this.add.text(BOTANICAL_DOOR.x, BOTANICAL_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Astronomy door prompt (door at 50% of 1000px width, 83% of 640px height)
    const ASTRONOMY_DOOR = {
      x: 25 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.50),
      y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
    };
    this.astronomyDoorPrompt = this.add.text(ASTRONOMY_DOOR.x, ASTRONOMY_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Library door prompt (central arch at 48% of 1100px width, 82% of 640px height)
    const LIBRARY_DOOR = {
      x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
      y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.82),
    };
    this.libraryDoorPrompt = this.add.text(LIBRARY_DOOR.x, LIBRARY_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Creatures Class door prompt
    const CREATURES_DOOR = {
      x: 50 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.48),
      y: 150 * TILE_SIZE + Math.round(28 * TILE_SIZE * 0.84),
    };
    this.creaturesDoorPrompt = this.add.text(CREATURES_DOOR.x, CREATURES_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Magical Hospital door prompt — tile(110,8), door at 48%×83% of 1100×640
    const HOSPITAL_DOOR = {
      x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
      y: 8   * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
    };
    this.hospitalDoorPrompt = this.add.text(HOSPITAL_DOOR.x, HOSPITAL_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // H2 Building door prompt
    this.h2DoorPrompt = this.add.text(H2_BUILDING_DOOR.x, H2_BUILDING_DOOR.y - 58, 'E  ENTER', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#e8d0ff', stroke: '#150820', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#2a0a44',
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Spawn Wizard
    const store  = this._getStore();
    // ── Spawn position ────────────────────────────────────────────────────
    // Evil-path players: spawn at map centre (1900, 1820) — the town square.
    // Good-path / returning players: use saved position or default spawn.
    const isEvilFirstSpawn = store?.playerPath === 'evil' &&
      (!data?.returnX) && (store?.evilQuestState === 'inactive' || !store?.evilQuestState);

    const defaultX = isEvilFirstSpawn ? 1900 : OUTDOOR_PLAYER_SPAWN.x;
    const defaultY = isEvilFirstSpawn ? 1820 : OUTDOOR_PLAYER_SPAWN.y;

    const requestedSpawnX = data?.returnX ?? (store ? store.outdoorX : defaultX);
    const requestedSpawnY = data?.returnY ?? (store ? store.outdoorY : defaultY);
    const spawnX = this._isInsideDuellingBuilding(requestedSpawnX, requestedSpawnY)
      ? DUEL_BUILDING_DOOR.x : requestedSpawnX;
    const spawnY = this._isInsideDuellingBuilding(requestedSpawnX, requestedSpawnY)
      ? DUEL_BUILDING_DOOR.y + 125 : requestedSpawnY;

    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr   = this.wizard.getSprite();
    spr.setDepth(20);

    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const feetW = Math.min(32, Math.max(16, Math.round(spr.width * 0.5)));
      const feetH = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(feetW, feetH);
      body.setOffset(Math.round((spr.width - feetW) / 2), spr.height - feetH);
      // Re-enforce world bounds after resizing (resize clears the flag)
      body.setCollideWorldBounds(true);
    }

    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => {
      if (this.nearBuilding && !this.isTransitioning) {
        this._enterBuilding(this.nearBuilding);
      }
    });

    const { width, height } = this.cameras.main;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(spr, true, 0.16, 0.16);

    const setZoomFunc = (w: number, h: number) => {
      const zoom = Math.min(w / 1440, h / 810) * 0.72;
      this.cameras.main.setZoom(zoom);
    };
    setZoomFunc(width, height);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      setZoomFunc(gameSize.width, gameSize.height);
    });

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(700, 0, 0, 0);
    eventBus.emit('SCENE_READY', { scene: 'OutdoorWorldScene' });

    // Evil Path guided quest arrow — activate after player spawned
    // (EvilGuidanceSystem checks playerPath internally; Good Path unaffected)
    this.evilGuidance = new EvilGuidanceSystem(this);
    this.evilGuidance.activate();
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    this.controller.update(delta);

    const spr = this.wizard.getSprite();
    const isDashing = (this.controller as PlayerController & { isDashing?: () => boolean }).isDashing?.() ?? false;
    this._savePosition(spr.x, spr.y);

    // Evil Path guidance arrow update
    if (this.evilGuidance) {
      this.evilGuidance.update(spr.x, spr.y, delta);
    }

    let found: BuildingDef | null = null;
    for (const b of BUILDINGS) {
      if (b.id === 'duellingRoom') {
        if (this._isFacingDuellingDoor()) found = b;
        continue;
      }
      if (b.id === 'botanicalClassroom') {
        if (this._isFacingBotanicalDoor()) found = b;
        continue;
      }
      if (b.id === 'astronomyTower') {
        if (this._isFacingAstronomyDoor()) found = b;
        continue;
      }
      if (b.id === 'hogwartsLibrary') {
        if (this._isFacingLibraryDoor()) found = b;
        continue;
      }
      if (b.id === 'creaturesClass') {
        if (this._isFacingCreaturesDoor()) found = b;
        continue;
      }
      if (b.id === 'magicalHospital') {
        if (this._isFacingHospitalDoor()) found = b;
        continue;
      }
      if (b.id === 'h2Building') {
        if (this._isFacingH2Door()) found = b;
        continue;
      }
      if (isDashing) {
        const dashDist = Phaser.Math.Distance.Between(spr.x, spr.y, b.doorX, b.doorY);
        if (dashDist < Math.max(b.doorRadius, 48)) { found = b; break; }
      }
      const dist = Phaser.Math.Distance.Between(spr.x, spr.y, b.doorX, b.doorY);
      if (dist < b.doorRadius) { found = b; break; }
    }

    if (found?.id !== this.nearBuilding?.id) {
      this.nearBuilding = found;
      eventBus.emit('PLAYER_NEAR_DOOR', { near: !!found, target: found?.id ?? '' });
    }
    this.duellingDoorPrompt?.setVisible(found?.id === 'duellingRoom');
    this.botanicalDoorPrompt?.setVisible(found?.id === 'botanicalClassroom');
    this.astronomyDoorPrompt?.setVisible(found?.id === 'astronomyTower');
    this.libraryDoorPrompt?.setVisible(found?.id === 'hogwartsLibrary');
    this.creaturesDoorPrompt?.setVisible(found?.id === 'creaturesClass');
    this.hospitalDoorPrompt?.setVisible(found?.id === 'magicalHospital');
    this.h2DoorPrompt?.setVisible(found?.id === 'h2Building');
  }

  private _isFacingDuellingDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const horizontalDistance = Math.abs(sprite.x - DUEL_BUILDING_DOOR.x);
    const verticalDistance = sprite.y - DUEL_BUILDING_DOOR.y;
    // f6 door arch is ~5 tiles (100px) wide â€” widen horizontal tolerance
    return direction === 'up' && horizontalDistance <= 90 && verticalDistance >= 10 && verticalDistance <= 180;
  }

  private _isFacingBotanicalDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const DOOR = {
      x: 110 * TILE_SIZE + 30 * TILE_SIZE + (4 * TILE_SIZE) / 2,
      y: 50  * TILE_SIZE + 28 * TILE_SIZE + (4 * TILE_SIZE) / 2,
    };
    const hDist = Math.abs(sprite.x - DOOR.x);
    const vDist = sprite.y - DOOR.y;
    return direction === 'up' && hDist <= 80 && vDist >= 10 && vDist <= 160;
  }

  private _isFacingAstronomyDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const DOOR = {
      x: 25 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.50),
      y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
    };
    const hDist = Math.abs(sprite.x - DOOR.x);
    const vDist = sprite.y - DOOR.y;
    return direction === 'up' && hDist <= 90 && vDist >= 10 && vDist <= 180;
  }

  private _isFacingLibraryDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const DOOR = {
      x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
      y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.82),
    };
    const hDist = Math.abs(sprite.x - DOOR.x);
    const vDist = sprite.y - DOOR.y;
    return direction === 'up' && hDist <= 90 && vDist >= 10 && vDist <= 180;
  }

  private _isFacingCreaturesDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const DOOR = {
      x: 50 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.48),
      y: 150 * TILE_SIZE + Math.round(28 * TILE_SIZE * 0.84),
    };
    const hDist = Math.abs(sprite.x - DOOR.x);
    const vDist = sprite.y - DOOR.y;
    return direction === 'up' && hDist <= 90 && vDist >= 10 && vDist <= 180;
  }

  private _isFacingHospitalDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const DOOR = {
      x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
      y: 8   * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
    };
    const hDist = Math.abs(sprite.x - DOOR.x);
    const vDist = sprite.y - DOOR.y;
    return direction === 'up' && hDist <= 90 && vDist >= 10 && vDist <= 180;
  }

  private _isFacingH2Door() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const hDist = Math.abs(sprite.x - H2_BUILDING_DOOR.x);
    const vDist = sprite.y - H2_BUILDING_DOOR.y;
    return direction === 'up' && hDist <= 100 && vDist >= 10 && vDist <= 200;
  }

  private _addBotanicalBuildingCollision() {
    const bx = 110 * TILE_SIZE;
    const by = 50  * TILE_SIZE;
    const BW = 60  * TILE_SIZE;
    const BH = 35  * TILE_SIZE;
    const buildingTop = by + Math.round(BH * 0.10);
    const eaveY  = by + Math.round(BH * 0.48);
    const doorCX = bx + Math.round(BW * 0.58);
    const doorHW = Math.round(BW * 0.07);
    const frontWallBottom = by + Math.round(BH * 0.82);
    const frontWallH = frontWallBottom - eaveY;

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };
    add(bx, buildingTop, BW, eaveY - buildingTop);
    add(bx, eaveY, doorCX - doorHW - bx, frontWallH);
    const rightEdge = doorCX + doorHW;
    add(rightEdge, eaveY, bx + BW - rightEdge, frontWallH);
  }

  private _addAstronomyBuildingCollision() {
    const bx = 25  * TILE_SIZE;
    const by = 110 * TILE_SIZE;
    const BW = 50  * TILE_SIZE;
    const BH = 32  * TILE_SIZE;

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };

    // Large round tower right half (solid top 72%)
    const towerLeft  = bx + Math.round(BW * 0.47);
    const towerRight = bx + BW;
    const towerW     = towerRight - towerLeft;
    const towerTopH  = Math.round(BH * 0.72);
    add(towerLeft, by, towerW, towerTopH);

    // Tower base â€” split by arch opening
    const archCX = bx + Math.round(BW * 0.60);
    const archHW = Math.round(BW * 0.07);
    const towerBaseTop = by + towerTopH;
    const towerBaseH   = Math.round(BH * 0.16);
    add(towerLeft, towerBaseTop, archCX - archHW - towerLeft, towerBaseH);
    const archRight = archCX + archHW;
    add(archRight, towerBaseTop, towerRight - archRight, towerBaseH);

    // Small house left section (roof + walls)
    const houseLeft   = bx + Math.round(BW * 0.08);
    const houseRight  = bx + Math.round(BW * 0.52);
    const houseTop    = by + Math.round(BH * 0.38);
    const eaveY       = by + Math.round(BH * 0.65);
    add(houseLeft, houseTop, houseRight - houseLeft, eaveY - houseTop);

    // House front wall split by door
    const houseDoorCX = bx + Math.round(BW * 0.35);
    const houseDoorHW = Math.round(BW * 0.07);
    const frontH      = by + Math.round(BH * 0.88) - eaveY;
    add(houseLeft, eaveY, houseDoorCX - houseDoorHW - houseLeft, frontH);
    const houseDoorRight = houseDoorCX + houseDoorHW;
    add(houseDoorRight, eaveY, houseRight - houseDoorRight, frontH);

    // Low fence far left
    add(bx, by + Math.round(BH * 0.72), Math.round(BW * 0.10), Math.round(BH * 0.18));

    // Spiral staircase bottom right
    add(bx + Math.round(BW * 0.66), by + Math.round(BH * 0.70), Math.round(BW * 0.34), Math.round(BH * 0.30));
  }

  private _addCreaturesBuildingCollision() {
    // tile(50,150) â†’ world(1000,3000), scaled 50x28 tiles = 1000x560px
    const bx = 50  * TILE_SIZE;  // 1000
    const by = 150 * TILE_SIZE;  // 3000
    const BW = 50  * TILE_SIZE;  // 1000
    const BH = 28  * TILE_SIZE;  // 560
    // S1 analysis: glass enclosure left ~0-38% BW, main building ~38-100%
    // Building actual top: ~8% BH from by
    // Eave (front wall top): ~52% BH
    // Front wall bottom: ~84% BH
    // Door centre X: ~48% BW (central arch)
    // Door half-width: ~8% BW

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };

    const buildingTop  = by + Math.round(BH * 0.08);
    const eaveY        = by + Math.round(BH * 0.52);
    const doorCX       = bx + Math.round(BW * 0.48);
    const doorHW       = Math.round(BW * 0.08);
    const frontBottom  = by + Math.round(BH * 0.84);
    const frontH       = frontBottom - eaveY;

    // Full top band (roof to eave)
    add(bx, buildingTop, BW, eaveY - buildingTop);
    // Front wall left of door
    add(bx, eaveY, doorCX - doorHW - bx, frontH);
    // Front wall right of door
    const rEdge = doorCX + doorHW;
    add(rEdge, eaveY, bx + BW - rEdge, frontH);
  }

  private _addHospitalBuildingCollision() {
    // tile(110,8) â†’ world(2200,160), scaled 55Ã—32 tiles (1100Ã—640px)
    // H1 exterior: stone building, central arch door at ~48% BW, ~83% BH
    // Top (roof + battlements): 0â€“60% BH
    // Front wall eave: 60% BH
    // Front wall bottom: 83% BH â€” door opens here
    const bx = 110 * TILE_SIZE;  // 2200
    const by = 8   * TILE_SIZE;  // 160
    const BW = 55  * TILE_SIZE;  // 1100
    const BH = 32  * TILE_SIZE;  // 640

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };

    const buildingTop = by + Math.round(BH * 0.05);
    const eaveY       = by + Math.round(BH * 0.60);
    const doorCX      = bx + Math.round(BW * 0.48);
    const doorHW      = Math.round(BW * 0.08);
    const frontBottom = by + Math.round(BH * 0.83);
    const frontH      = frontBottom - eaveY;

    // Full top band (roof + battlements + tower to eave)
    add(bx, buildingTop, BW, eaveY - buildingTop);
    // Front wall left of door arch
    add(bx, eaveY, doorCX - doorHW - bx, frontH);
    // Front wall right of door arch
    const rEdge = doorCX + doorHW;
    add(rEdge, eaveY, bx + BW - rEdge, frontH);
  }

  private _addH2BuildingCollision() {
    const bx = 0;
    const by = 50 * TILE_SIZE; // 1000
    const BW = 40 * TILE_SIZE; // 800
    const BH = 24 * TILE_SIZE; // 480

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };

    const buildingTop = by + Math.round(BH * 0.05);
    const eaveY       = by + Math.round(BH * 0.60);
    const doorCX      = H2_BUILDING_DOOR.x;
    const doorHW      = Math.round(BW * 0.08);
    const frontBottom = by + Math.round(BH * 0.83);
    const frontH      = frontBottom - eaveY;

    // Full top band (roof)
    add(bx, buildingTop, BW, eaveY - buildingTop);
    // Front wall left of door arch
    add(bx, eaveY, doorCX - doorHW - bx, frontH);
    // Front wall right of door arch
    const rEdge = doorCX + doorHW;
    add(rEdge, eaveY, bx + BW - rEdge, frontH);
  }

  private _addLibraryBuildingCollision() {    // Building origin: tile(110,110) â†’ world(2200,2200), scaled 55x32 tiles (1100x640 px)
    const bx = 110 * TILE_SIZE;  // 2200
    const by = 110 * TILE_SIZE;  // 2200
    const BW = 55  * TILE_SIZE;  // 1100
    const BH = 32  * TILE_SIZE;  // 640

    // MM1 analysis (white-bg):
    //   Building actual top: ~8% BH from by (skip white space above)
    //   Eave (front wall top): ~55% BH
    //   Front wall bottom: ~82% BH
    //   Door centre X: ~48% BW
    //   Door half-width: ~8% BW
    //   Round tower right: ~74-98% BW, full height

    const add = (wx: number, wy: number, ww: number, wh: number) => {
      if (ww <= 0 || wh <= 0) return;
      const rect = this.add.rectangle(wx + ww / 2, wy + wh / 2, ww, wh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    };

    const buildingTop = by + Math.round(BH * 0.08);
    const eaveY       = by + Math.round(BH * 0.55);
    const doorCX      = bx + Math.round(BW * 0.48);
    const doorHW      = Math.round(BW * 0.08);
    const frontBottom = by + Math.round(BH * 0.82);
    const frontH      = frontBottom - eaveY;

    // 1. Full top band (roof to eave) â€” covers left wing + centre + right tower
    add(bx, buildingTop, BW, eaveY - buildingTop);

    // 2. Front wall left of door
    add(bx, eaveY, doorCX - doorHW - bx, frontH);

    // 3. Front wall right of door
    const rightEdge = doorCX + doorHW;
    add(rightEdge, eaveY, bx + BW - rightEdge, frontH);
  }

  private _isInsideDuellingBuilding(x: number, y: number) {
    const left   = DUEL_BUILDING_POSITION.x + 2  * TILE_SIZE;
    const right  = DUEL_BUILDING_POSITION.x + 53 * TILE_SIZE;
    const top    = DUEL_BUILDING_POSITION.y;
    const bottom = DUEL_BUILDING_POSITION.y + 29 * TILE_SIZE;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  private _enterBuilding(b: BuildingDef) {
    // ── Evil-path sequential quest gate ───────────────────────────────────
    // Evil players must complete each quest in order before the next building unlocks.
    // Uses evilQuestState (completion-based, source of truth):
    //   'nav_f7' / 'duel_active'     = only F7 accessible
    //   'nav_building23' / 'plant_active' = F7 done → B23 accessible
    //   'nav_h1' / 'book_active' / 'complete' = B23 done → H1 accessible
    const store = this._getStore();
    if (store?.playerPath === 'evil') {
      const qs = store.evilQuestState;
      // "duel won" = state progressed past duel_active
      const duelWon = qs === 'nav_building23' || qs === 'plant_active' ||
                      qs === 'nav_h1' || qs === 'book_active' || qs === 'complete';
      // "plant quest done" = state progressed past plant_active
      const plantDone = qs === 'nav_h1' || qs === 'book_active' || qs === 'complete';

      if (b.id === 'botanicalClassroom' && !duelWon) {
        this._showLockedMessage('🔒  Win the duel at F7 first');
        this.isTransitioning = false;
        this.controller.setBlocked(false);
        return;
      }
      if (b.id === 'hogwartsLibrary' && !plantDone) {
        this._showLockedMessage('🔒  Find the Rare Plant first');
        this.isTransitioning = false;
        this.controller.setBlocked(false);
        return;
      }
    }

    this.isTransitioning = true;
    this.controller.setBlocked(true);
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    this._playDoorSound();

    // Notify evil guidance system BEFORE transitioning
    if (b.id === 'duellingRoom')        this.evilGuidance?.onEnterDueling();
    if (b.id === 'botanicalClassroom')  this.evilGuidance?.onEnterBotanical();
    if (b.id === 'hogwartsLibrary')     this.evilGuidance?.onEnterLibrary();
    if (b.id === 'h2Building')          this.evilGuidance?.onEnterH1();

    this.cameras.main.fadeOut(520, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(b.sceneKey, { buildingId: b.id, spawnX: b.spawnX, spawnY: b.spawnY });
    });
  }

  private _showLockedMessage(msg: string) {
    const cam  = this.cameras.main;
    const zoom = cam.zoom || 1;
    const cx   = cam.scrollX + cam.width  / zoom / 2;
    const cy   = cam.scrollY + cam.height / zoom / 2;
    const txt  = this.add.text(cx, cy - 60, msg, {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ff8888', stroke: '#1a0000', strokeThickness: 4,
      padding: { x: 12, y: 6 }, backgroundColor: '#2a0000',
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: txt, alpha: 0, y: cy - 110,
      duration: 1800, ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  private _getStore() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useGameStore } = require('../../stores/gameStore') as typeof import('../../stores/gameStore');
      return useGameStore.getState();
    } catch { return null; }
  }

  private _savePosition(x: number, y: number) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useGameStore } = require('../../stores/gameStore') as typeof import('../../stores/gameStore');
      useGameStore.getState().setOutdoorPosition(x, y);
    } catch { /* ignore */ }
  }

  private _drawGround() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    if (Array.isArray(HOGWARTS_GROUND.variation)) {
      const rng = this._seededRand(42);
      for (let i = 0; i < 140; i++) {
        const variant = HOGWARTS_GROUND.variation[i % HOGWARTS_GROUND.variation.length];
        g.fillStyle(groundColor(variant), 0.35);
        g.fillEllipse(rng() * WORLD_W, rng() * WORLD_H, 28 + rng() * 44, 18 + rng() * 34);
      }
    }
  }

  private _drawPaths() {
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STONE ROAD NETWORK â€” one connected grid, door to door
    //
    // Strategy: two main roads form a cross at the town centre,
    // then short spurs reach each building door.
    //
    // MAIN HORIZONTAL ROAD: y=1900, x=1000 â†’ x=2840
    //   connects: Dueling(x=1270) â†â†’ centre â†â†’ Botanical(x=2840)
    //
    // MAIN VERTICAL ROAD: x=1900, y=800 â†’ y=3470
    //   connects: Hospital(y=800) â†“ centre â†“ Creatures(y=3470)
    //
    // CROSS POINT (town square): (1900, 1900) â€” 300Ã—300px plaza
    //
    // SECONDARY HORIZONTAL: y=2840, x=1000 â†’ x=2728
    //   connects: Astronomy(x=1000) â†â†’ Library(x=2728)
    //   joined to main vertical spine at x=1900
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const g = this.add.graphics().setDepth(2);

    // Stone colours
    const MORTAR      = 0x5c5c52;
    const STONE_LIGHT = 0x9e9e8e;
    const STONE_MID   = 0x858578;
    const STONE_DARK  = 0x6e6e62;

    const SW = 20; const SH = 14; // stone block size

    const stoneRect = (rx: number, ry: number, rw: number, rh: number) => {
      if (rw <= 0 || rh <= 0) return;
      g.fillStyle(MORTAR); g.fillRect(rx, ry, rw, rh);
      let row = 0;
      for (let sy = ry; sy < ry + rh; sy += SH + 1) {
        const xOff = (row % 2 === 0) ? 0 : 10;
        for (let sx = rx - xOff; sx < rx + rw; sx += SW + 1) {
          const x1 = Math.max(rx, sx), x2 = Math.min(rx + rw, sx + SW);
          const y1 = sy,              y2 = Math.min(ry + rh, sy + SH);
          if (x2 - x1 < 2 || y2 - y1 < 2) { row++; continue; }
          const idx = Math.floor((sx - rx) / (SW + 1)) + row;
          const shade = idx % 3 === 0 ? STONE_LIGHT : idx % 3 === 1 ? STONE_MID : STONE_DARK;
          g.fillStyle(shade); g.fillRect(x1, y1, x2 - x1, y2 - y1);
          g.fillStyle(0xb0b0a0, 0.2); g.fillRect(x1, y1, x2 - x1, 2);
          g.fillStyle(0x303030, 0.25); g.fillRect(x1, y2 - 2, x2 - x1, 2);
        }
        row++;
      }
    };

    // â”€â”€ Road constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const RW   = 70;   // road half-width
    const CX   = 1900; // central vertical spine X
    const SQSZ = 160;  // town square half-size (320Ã—320)

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 1. MAIN VERTICAL SPINE  x=CX  y=800â†’3470
    //    Runs from Hospital door bottom (y=800) to Creatures door (y=3470)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(CX - RW, 800, RW * 2, 3470 - 800);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 2. MAIN HORIZONTAL ROAD  y=1900  x=1270â†’2840
    //    Runs from Dueling door (x=1270) to Botanical door (x=2840)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(1270 - RW, 1900 - RW, (2840 + RW) - (1270 - RW), RW * 2);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 3. SECONDARY HORIZONTAL  y=2840  x=1000â†’2728
    //    Runs from Astronomy (x=1000) to Library (x=2728)
    //    Connects to vertical spine at x=1900
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(1000 - RW, 2840 - RW, (2728 + RW) - (1000 - RW), RW * 2);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 4. TOWN SQUARE at intersection (CX=1900, y=1900)  320Ã—320
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(CX - SQSZ, 1900 - SQSZ, SQSZ * 2, SQSZ * 2);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 5. DUELING SPUR â€” from door y=1420 straight down to horizontal road
    //    doorX=1270, doorY=1420, horizontal road at y=1900Â±RW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(1270 - RW, 1420, RW * 2, (1900 + RW) - 1420);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 6. BOTANICAL SPUR â€” from door y=1600 straight down to horizontal road
    //    doorX=2840, doorY=1600, horizontal road is at y=1900Â±RW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(2840 - RW, 1600, RW * 2, (1900 + RW) - 1600);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 7. HOSPITAL SPUR â€” vertical from footprint bottom to spine top
    //    Hospital footBottom=800  â†’ spine already starts at y=800 âœ“
    //    Just need a small step-down from door y=691 to footBottom 800
    //    doorX=2728 â†’ horizontal spur east from spine to hospital
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Short vertical at hospital door x=2728 from y=691 down to spine y=800
    stoneRect(2728 - RW, 691, RW * 2, 800 - 691 + RW);
    // Horizontal: spine (x=1900+RW) â†’ hospital door (x=2728+RW) at y=800
    stoneRect(CX + RW, 800 - RW, (2728 + RW) - (CX + RW), RW * 2);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 8. ASTRONOMY SPUR â€” vertical from footprint bottom to secondary horiz
    //    Astronomy footBottom=2840 â€” secondary horiz already at y=2840 âœ“
    //    doorX=1000 â†’ already on secondary horizontal âœ“
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 8. ASTRONOMY SPUR â€” from door y=2731 down to secondary horiz y=2840
    //    doorX=1000, doorY=2731, secondary horizontal at y=2840Â±RW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(1000 - RW, 2731, RW * 2, (2840 + RW) - 2731);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 9. LIBRARY SPUR â€” from door y=2725 down to secondary horiz y=2840
    //    doorX=2728, doorY=2725, secondary horizontal at y=2840Â±RW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    stoneRect(2728 - RW, 2725, RW * 2, (2840 + RW) - 2725);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 10. CREATURES SPUR â€” horizontal branch LEFT from spine to door
    //     Player stands on vertical spine at x=1900
    //     Door is at x=1480, y=3470 â€” go LEFT along y=3470
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Horizontal: from door x=1480 east to spine x=1900 at door level y=3470
    stoneRect(1480 - RW, 3470 - RW, (1900 + RW) - (1480 - RW), RW * 2);
  }

  private _drawWater() { /* grounds remain dry */ }

  private _drawDecoration() {
    const g = this.add.graphics().setDepth(4);
    const rng = this._seededRand(321);

    // â”€â”€ SPRITE SCALE CONSTANTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Player â‰ˆ 32px tall. Trees â‰ˆ 96-140px. Bushes â‰ˆ 48-64px.
    // All drawing uses explicit pixel sizes for professional results.

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DRAWING HELPERS â€” hand-crafted pixel-art objects
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // â”€â”€ GRAND OAK (large, detailed, ~130px tall) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const grandOak = (x: number, y: number, flip = false) => {
      const f = flip ? -1 : 1;
      // Ground shadow
      g.fillStyle(0x000000, 0.16); g.fillEllipse(x + f*6, y + 14, 120, 30);
      // Trunk â€” thick, detailed bark
      g.fillStyle(0x3d2206); g.fillRect(x - 10, y - 28, 20, 42);
      g.fillStyle(0x5c3510); g.fillRect(x - 10, y - 28, 10, 42);
      g.fillStyle(0x2a1604); g.fillRect(x,      y - 28, 10, 42);
      // Bark lines
      g.fillStyle(0x2a1604, 0.5);
      g.fillRect(x - 6, y - 24, 3, 30); g.fillRect(x + 3, y - 20, 2, 26);
      // Roots
      g.fillStyle(0x3d2206); g.fillRect(x - 16, y + 8, 8, 8);
      g.fillStyle(0x3d2206); g.fillRect(x + 8,  y + 8, 8, 8);
      // Main canopy â€” 7 overlapping ellipses for rich silhouette
      g.fillStyle(0x0c3c00); g.fillEllipse(x, y - 72, 110, 80);
      g.fillStyle(0x145200); g.fillEllipse(x - 28, y - 82, 70, 60);
      g.fillStyle(0x145200); g.fillEllipse(x + 28, y - 78, 68, 58);
      g.fillStyle(0x1c6e00); g.fillEllipse(x - 16, y - 96, 62, 52);
      g.fillStyle(0x1c6e00); g.fillEllipse(x + 14, y - 92, 58, 50);
      g.fillStyle(0x258c00); g.fillEllipse(x - 8,  y - 108, 52, 44);
      g.fillStyle(0x258c00); g.fillEllipse(x + 10, y - 104, 46, 40);
      // Bright highlights
      g.fillStyle(0x38c000); g.fillEllipse(x - 12, y - 116, 34, 28);
      g.fillStyle(0x38c000); g.fillEllipse(x + 16, y - 110, 30, 26);
      g.fillStyle(0x5ae000, 0.7); g.fillEllipse(x - 4, y - 122, 22, 18);
      // Under-canopy shadow
      g.fillStyle(0x061e00, 0.3); g.fillEllipse(x + f*4, y - 60, 90, 28);
    };

    // â”€â”€ MEDIUM OAK (~90px tall) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const medOak = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.13); g.fillEllipse(x + 4, y + 10, 86, 22);
      g.fillStyle(0x3d2206); g.fillRect(x - 7, y - 18, 14, 30);
      g.fillStyle(0x5c3510); g.fillRect(x - 7, y - 18, 7, 30);
      g.fillStyle(0x2a1604); g.fillRect(x,     y - 18, 7, 30);
      g.fillStyle(0x3d2206); g.fillRect(x - 12, y + 6, 6, 6);
      g.fillStyle(0x3d2206); g.fillRect(x + 6,  y + 6, 6, 6);
      g.fillStyle(0x0c3c00); g.fillEllipse(x, y - 52, 80, 58);
      g.fillStyle(0x145200); g.fillEllipse(x - 20, y - 60, 52, 44);
      g.fillStyle(0x145200); g.fillEllipse(x + 18, y - 56, 48, 42);
      g.fillStyle(0x1c6e00); g.fillEllipse(x - 10, y - 70, 44, 38);
      g.fillStyle(0x1c6e00); g.fillEllipse(x + 10, y - 66, 40, 36);
      g.fillStyle(0x258c00); g.fillEllipse(x - 4,  y - 78, 36, 30);
      g.fillStyle(0x38c000); g.fillEllipse(x + 6,  y - 82, 26, 22);
      g.fillStyle(0x5ae000, 0.65); g.fillEllipse(x, y - 88, 16, 14);
      g.fillStyle(0x061e00, 0.28); g.fillEllipse(x + 2, y - 44, 62, 20);
    };

    // â”€â”€ FLOWERING TREE (~100px tall, pink/white) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const flowerTree = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.12); g.fillEllipse(x + 4, y + 10, 80, 22);
      g.fillStyle(0x3d2206); g.fillRect(x - 7, y - 20, 14, 32);
      g.fillStyle(0x5c3510); g.fillRect(x - 7, y - 20, 7, 32);
      g.fillStyle(0x0c3c00); g.fillEllipse(x, y - 58, 84, 60);
      g.fillStyle(0x8c0040); g.fillEllipse(x - 22, y - 66, 54, 46);
      g.fillStyle(0x8c0040); g.fillEllipse(x + 20, y - 62, 50, 44);
      g.fillStyle(0xe0406a); g.fillEllipse(x - 12, y - 74, 46, 40);
      g.fillStyle(0xe0406a); g.fillEllipse(x + 12, y - 70, 42, 38);
      g.fillStyle(0xf078a0); g.fillEllipse(x - 6,  y - 84, 38, 32);
      g.fillStyle(0xf8b0cc); g.fillEllipse(x + 8,  y - 88, 30, 26);
      g.fillStyle(0xffe0ee, 0.8); g.fillEllipse(x, y - 96, 20, 16);
    };

    // â”€â”€ MAGIC TREE (~110px tall, purple) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const magicTree = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.15); g.fillEllipse(x + 4, y + 12, 88, 24);
      g.fillStyle(0x2a1040); g.fillRect(x - 8, y - 22, 16, 36);
      g.fillStyle(0x3e1a60); g.fillRect(x - 8, y - 22, 8, 36);
      // bark glow
      g.fillStyle(0x8833ee, 0.18); g.fillRect(x - 8, y - 22, 16, 36);
      g.fillStyle(0x220066); g.fillEllipse(x, y - 60, 90, 64);
      g.fillStyle(0x3d0099); g.fillEllipse(x - 24, y - 70, 58, 50);
      g.fillStyle(0x3d0099); g.fillEllipse(x + 22, y - 66, 54, 48);
      g.fillStyle(0x6600bb); g.fillEllipse(x - 14, y - 80, 50, 44);
      g.fillStyle(0x6600bb); g.fillEllipse(x + 12, y - 76, 46, 42);
      g.fillStyle(0x9933ee); g.fillEllipse(x - 6,  y - 90, 40, 34);
      g.fillStyle(0xbb66ff); g.fillEllipse(x + 8,  y - 96, 30, 26);
      g.fillStyle(0xddaaff, 0.7); g.fillEllipse(x,  y - 104, 20, 16);
      // sparkles
      for (let i = 0; i < 8; i++) {
        const sx = x + (rng()-0.5)*80, sy = y - 50 + (rng()-0.5)*54;
        g.fillStyle(0xdd99ff, 0.55 + rng()*0.45);
        g.fillRect(Math.round(sx)-2, Math.round(sy)-2, 4, 4);
        g.fillStyle(0xffffff, 0.5); g.fillRect(Math.round(sx)-1, Math.round(sy)-1, 2, 2);
      }
    };

    // â”€â”€ TALL PINE (~120px tall) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tallPine = (x: number, y: number, s = 1.0) => {
      const B = Math.round(11 * s);
      g.fillStyle(0x000000, 0.12); g.fillEllipse(x, y + B*1.5, B*5, B*2);
      g.fillStyle(0x3a2008); g.fillRect(x - B*0.6, y - B*0.5, Math.round(B*1.2), B*4);
      g.fillStyle(0x5c3010); g.fillRect(x - B*0.6, y - B*0.5, Math.round(B*0.6), B*4);
      const cols = [0x082e00,0x0c4200,0x105800,0x156600,0x1a7400];
      const ws   = [B*5.5,   B*4.8,   B*4,     B*3.2,   B*2.4];
      let ty = y - B*0.4;
      for (let i = 0; i < 5; i++) {
        const tw = ws[i], th = Math.round(B*2.4);
        g.fillStyle(cols[i]);
        g.fillTriangle(x, ty-th, Math.round(x-tw/2), ty, Math.round(x+tw/2), ty);
        g.fillStyle(0x22aa00, 0.22);
        g.fillTriangle(x, ty-th, Math.round(x-tw/2), ty, x, ty);
        ty -= Math.round(th * 0.62);
      }
      g.fillStyle(cols[4]);
      g.fillTriangle(x, ty-Math.round(B*1.8), Math.round(x-B*0.9), ty, Math.round(x+B*0.9), ty);
    };

    // â”€â”€ LARGE DENSE BUSH (~56px wide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const bigBush = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.10); g.fillEllipse(x + 4, y + 10, 80, 24);
      g.fillStyle(0x082e00); g.fillEllipse(x,      y,      76, 48);
      g.fillStyle(0x0f4a00); g.fillEllipse(x - 18, y - 8,  50, 40);
      g.fillStyle(0x0f4a00); g.fillEllipse(x + 18, y - 6,  46, 38);
      g.fillStyle(0x186600); g.fillEllipse(x - 8,  y - 16, 44, 36);
      g.fillStyle(0x186600); g.fillEllipse(x + 12, y - 14, 40, 34);
      g.fillStyle(0x259100); g.fillEllipse(x - 4,  y - 22, 34, 28);
      g.fillStyle(0x30b800); g.fillEllipse(x + 6,  y - 26, 26, 22);
      g.fillStyle(0x42d400, 0.65); g.fillEllipse(x - 2, y - 30, 18, 14);
    };

    // â”€â”€ MEDIUM BUSH (~40px wide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const medBush = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.09); g.fillEllipse(x + 3, y + 8, 58, 18);
      g.fillStyle(0x082e00); g.fillEllipse(x,      y,      56, 36);
      g.fillStyle(0x0f4a00); g.fillEllipse(x - 14, y - 6,  36, 28);
      g.fillStyle(0x0f4a00); g.fillEllipse(x + 14, y - 4,  32, 26);
      g.fillStyle(0x186600); g.fillEllipse(x - 4,  y - 12, 32, 26);
      g.fillStyle(0x259100); g.fillEllipse(x + 6,  y - 16, 24, 20);
      g.fillStyle(0x38b800); g.fillEllipse(x,      y - 20, 18, 14);
    };

    // â”€â”€ FLOWER BED (~60-80px cluster) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const flowerBed = (x: number, y: number, cols: number[], n = 10) => {
      // Ground patch
      g.fillStyle(0x1e5200, 0.3); g.fillEllipse(x, y + 8, n * 8, 20);
      for (let i = 0; i < n; i++) {
        const fx = x + (rng()-0.5)*n*7, fy = y + (rng()-0.5)*22;
        // stem
        g.fillStyle(0x2d7a00); g.fillRect(Math.round(fx)-2, Math.round(fy), 4, 18);
        // side leaves
        g.fillStyle(0x3a9400); g.fillRect(Math.round(fx)+2, Math.round(fy)+6, 8, 5);
        g.fillStyle(0x3a9400); g.fillRect(Math.round(fx)-10,Math.round(fy)+11, 8, 5);
        // 4 petals
        const c = cols[Math.floor(rng() * cols.length)];
        for (const [px,py] of [[-8,-10],[4,-10],[-2,-18],[-2,-2]] as [number,number][]) {
          g.fillStyle(c); g.fillRect(Math.round(fx)+px, Math.round(fy)+py, 8, 8);
        }
        g.fillStyle(0xf5e020); g.fillRect(Math.round(fx)-3, Math.round(fy)-10, 6, 6);
      }
    };

    // â”€â”€ STREET LAMP (elegant, ~80px tall) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const lamp = (x: number, y: number) => {
      g.fillStyle(0x2a1c08); g.fillRect(x-6, y-6, 12, 10);  // base
      g.fillStyle(0x3d2810); g.fillRect(x-6, y-6, 6, 10);
      g.fillStyle(0x3d2810); g.fillRect(x-4, y-80, 8, 80);  // post
      g.fillStyle(0x5a3c18); g.fillRect(x-4, y-80, 4, 80);
      g.fillStyle(0x3d2810); g.fillRect(x,   y-78, 16, 5);  // arm
      g.fillStyle(0x3d2810); g.fillRect(x+10,y-88, 5, 16);
      g.fillStyle(0x1a1a1a); g.fillRect(x+5, y-100,20, 22);  // lantern body
      g.fillStyle(0xffe060); g.fillRect(x+7, y-98, 16, 18);   // glow fill
      g.fillStyle(0xffff99, 0.7); g.fillRect(x+9, y-96, 10, 12);
      g.fillStyle(0x1a1a1a); g.fillRect(x+5, y-92, 20, 3);   // divider
      g.fillStyle(0xffee88, 0.18); g.fillEllipse(x+15, y-89, 72, 72);
      g.fillStyle(0xffee88, 0.09); g.fillEllipse(x+15, y-89, 110, 110);
      g.lineStyle(1.5, 0x111111); g.strokeRect(x+5, y-100, 20, 22);
    };

    // â”€â”€ BENCH (wide, clear) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const bench = (x: number, y: number) => {
      g.fillStyle(0x7a5010); g.fillRect(x-26, y-8, 52, 10);  // seat
      g.fillStyle(0x9a6618); g.fillRect(x-26, y-8, 52, 4);
      g.fillStyle(0x5c3c0c); g.fillRect(x-26, y-20, 52, 7);  // back
      g.fillStyle(0x7a5010); g.fillRect(x-26, y-20, 26, 4);
      g.fillStyle(0x3a2408); g.fillRect(x-24, y+2, 9, 14);   // legs
      g.fillStyle(0x3a2408); g.fillRect(x+15, y+2, 9, 14);
      g.lineStyle(1, 0x2a1800); g.strokeRect(x-26, y-20, 52, 36);
    };

    // â”€â”€ DECORATIVE ROCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const rock = (x: number, y: number, s = 1.0) => {
      const B = Math.round(20*s);
      g.fillStyle(0x000000, 0.12); g.fillEllipse(x+5, y+B*0.7, B*4, B*1.4);
      g.fillStyle(0x58584e); g.fillEllipse(x,     y,     B*3.2, B*2.2);
      g.fillStyle(0x757570); g.fillEllipse(x-B*.4,y-B*.3,B*2.2,B*1.6);
      g.fillStyle(0x8a8a84, 0.7); g.fillEllipse(x-B*.8,y-B*.6,B*1.2,B*.9);
      g.fillStyle(0x3a3a34, 0.5); g.fillEllipse(x+B*.6,y+B*.3,B*1.8,B*1.0);
    };

    // â”€â”€ CRYSTAL CLUSTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const crystalCluster = (x: number, y: number, col: number) => {
      g.fillStyle(0x000000, 0.14); g.fillEllipse(x+4, y+6, 52, 14);
      const dark = (col & 0xfefefe) >> 1;
      for (const [dx,h,w] of [[-16,28,10],[0,36,12],[14,24,9],[-8,20,8],[10,16,7]] as [number,number,number][]) {
        g.fillStyle(dark);   g.fillRect(x+dx-Math.round(w/2), y-h,   w, Math.round(h*0.35));
        g.fillStyle(col);    g.fillRect(x+dx-Math.round(w/2), y-Math.round(h*0.65), w, Math.round(h*0.65));
        g.fillStyle(0xeeccff,0.55); g.fillRect(x+dx-Math.round(w*.3), y-h+2, Math.round(w*.4), Math.round(h*.28));
      }
    };

    // â”€â”€ GRASS CLUSTER (natural, varied) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const grassCluster = (x: number, y: number, n = 14) => {
      for (let i = 0; i < n; i++) {
        const bx = x+(rng()-.5)*76, by = y+(rng()-.5)*36;
        const h  = 12 + rng()*18;
        const c  = rng()>.55 ? 0x3db300 : rng()>.5 ? 0x4dc800 : 0x2e9600;
        g.fillStyle(c);
        g.fillRect(Math.round(bx)-2, Math.round(by)-h, 4, h);
        g.fillRect(Math.round(bx)-4, Math.round(by)-Math.round(h*.7), 3, Math.round(h*.7));
        g.fillRect(Math.round(bx)+1, Math.round(by)-Math.round(h*.8), 3, Math.round(h*.8));
      }
    };

    // â”€â”€ MUSHROOM CLUSTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const mushCluster = (x: number, y: number) => {
      for (const [dx,dy,s] of [[0,0,1.1],[22,-8,.8],[-16,-5,.9]] as [number,number,number][]) {
        const mx=x+dx, my=y+dy, B=Math.round(10*s);
        g.fillStyle(0xe8e0d0); g.fillRect(mx-B/2, my, B, Math.round(B*1.4));
        g.fillStyle(0xd0c8b8); g.fillRect(mx,     my, B/2, Math.round(B*1.4));
        g.fillStyle(0xcc1a10); g.fillRect(mx-B, my-B, B*2, B);
        g.fillStyle(0xff3030); g.fillRect(mx-B, my-B, B, B*.6);
        g.fillStyle(0xffffff); g.fillRect(mx-Math.round(B*.6), my-Math.round(B*.9), Math.round(B*.5), Math.round(B*.5));
        g.fillStyle(0xffffff); g.fillRect(mx+Math.round(B*.2), my-Math.round(B*.7), Math.round(B*.4), Math.round(B*.4));
        g.lineStyle(1, 0x880000); g.strokeRect(mx-B, my-B, B*2, B);
      }
    };

    // â”€â”€ FENCE SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fence = (x: number, y: number, w: number) => {
      g.fillStyle(0x9b7a20); g.fillRect(x, y-12, w, 5);
      g.fillStyle(0xb09030); g.fillRect(x, y-12, w, 2);
      g.fillStyle(0x9b7a20); g.fillRect(x, y+2,  w, 5);
      for (let px = x; px <= x+w; px += 30) {
        g.fillStyle(0x7a5c18); g.fillRect(px-5, y-18, 10, 32);
        g.fillStyle(0x9a7422); g.fillRect(px-5, y-18, 5, 32);
      }
    };

    // â”€â”€ WILDFLOWER TALL (~30px) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const wildFlower = (x: number, y: number, col: number) => {
      g.fillStyle(0x2d7a00); g.fillRect(x-2, y-32, 4, 32);
      g.fillStyle(0x3a9400); g.fillRect(x+2, y-18, 10, 5);
      g.fillStyle(0x3a9400); g.fillRect(x-12,y-10, 10, 5);
      for (const [px,py] of [[-10,-42],[4,-42],[-10,-28],[4,-28],[-3,-50],[3,-36]] as [number,number][]) {
        g.fillStyle(col); g.fillRect(x+px, y+py, 9, 9);
      }
      g.fillStyle(0xf5e020); g.fillRect(x-3, y-40, 7, 7);
    };

    // â”€â”€ FOUNTAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fountain = (x: number, y: number) => {
      g.fillStyle(0x5a7890); g.fillEllipse(x, y, 80, 56);
      g.fillStyle(0x7aaac8); g.fillEllipse(x, y, 66, 44);
      g.fillStyle(0x9ac4de, 0.55); g.fillEllipse(x-14, y-10, 22, 16);
      g.fillStyle(0x7a7a6a); g.fillEllipse(x, y, 20, 14);
      g.fillStyle(0x9aaabb); g.fillEllipse(x, y, 20, 14);
      g.fillStyle(0xbbddee, 0.9); g.fillEllipse(x, y-18, 12, 24);
      g.fillStyle(0xddeeff, 0.85); g.fillEllipse(x, y-24, 8, 14);
      g.lineStyle(2.5, 0x456070); g.strokeEllipse(x, y, 80, 56);
    };

    // â”€â”€ MAGIC RUNE STONE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const runeStone = (x: number, y: number) => {
      g.fillStyle(0x000000, 0.13); g.fillEllipse(x+4, y+10, 50, 16);
      g.fillStyle(0x444438); g.fillRect(x-14, y-28, 28, 38);
      g.fillStyle(0x5a5a4a); g.fillRect(x-14, y-28, 14, 38);
      g.fillStyle(0x333328); g.fillRect(x,    y-28, 14, 38);
      g.fillStyle(0x8866ee, 0.55); g.fillRect(x-8, y-22, 16, 24);
      g.fillStyle(0xaa88ff, 0.45); g.fillRect(x-4, y-20, 8, 6);
      g.fillStyle(0xaa88ff, 0.45); g.fillRect(x-4, y-10, 8, 6);
      g.fillStyle(0xccaaff, 0.35); g.fillRect(x-2, y-4,  4, 10);
      g.fillStyle(0x8866ee, 0.2); g.fillEllipse(x, y-14, 40, 40);
    };

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // MAP SAFE ZONES (nothing placed inside):
    //  Road spine    x 1830â€“1970
    //  Road horiz    y 1830â€“1970  (x 1200â€“2920)
    //  Road sec      y 2770â€“2910  (x 940â€“2800)
    //  Town square   x 1740â€“2060, y 1740â€“2060
    //  Dueling       x 500â€“1900,  y 700â€“1540   doorX=1270
    //  Botanical     x 2200â€“3400, y 1000â€“1700  doorX=2840
    //  Hospital      x 2200â€“3300, y 160â€“800    doorX=2728
    //  Astronomy     x 500â€“1500,  y 2200â€“2840  doorX=1000
    //  Library       x 2200â€“3300, y 2200â€“2840  doorX=2728
    //  Creatures     x 1000â€“2000, y 3000â€“3560  doorX=1480
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // â”€â”€ 1. LEFT FOREST EDGE (x 20-450) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const LF: [number,number,boolean][] = [
      [100,280,false],[240,470,true],[110,680,false],[260,860,true],
      [90, 1080,false],[230,1260,true],[100,1450,false],[250,1620,true],
      [90, 1820,false],[220,2020,true],[110,2220,false],
      [90, 2500,true], [220,2700,false],[110,2900,true],[260,3100,false],
      [90, 3300,true], [220,3520,false],[110,3730,true],[260,3940,false],
    ];
    for (const [x,y,fl] of LF) grandOak(x,y,fl);
    for (const [x,y] of [[180,510],[90,1190],[230,1900],[170,2610],[90,3200]] as [number,number][]) tallPine(x,y,1.1);
    for (const [x,y] of [[330,480],[370,940],[330,1360],[370,1800],[330,2200],[370,2660],[330,3080],[370,3560],[330,3840]] as [number,number][]) bigBush(x,y);
    for (const y of [640,1020,1460,1880,2280,2680,3080,3480,3900]) flowerBed(190,y,[0xe83030,0xf060b0,0xffffff],7);
    for (const [x,y] of [[200,760],[400,1420],[210,2740],[390,3560]] as [number,number][]) mushCluster(x,y);
    for (const y of [380,900,1540,2100,2720,3300,3860]) grassCluster(280,y,10);

    // â”€â”€ 2. RIGHT FOREST EDGE (x 3360-3990) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const RF: [number,number,boolean][] = [
      [3520,260,true],[3740,450,false],[3600,660,true],[3860,840,false],
      [3520,1060,true],[3740,1280,false],[3600,1520,true],[3860,1740,false],
      [3520,1980,true],[3740,2200,false],[3600,2480,true],[3860,2700,false],
      [3520,2900,true],[3740,3100,false],[3600,3320,true],[3860,3540,false],
      [3520,3760,true],[3740,3980,false],
    ];
    for (const [x,y,fl] of RF) grandOak(x,y,fl);
    for (const [x,y] of [[3660,520],[3540,1220],[3780,1960],[3660,2620],[3540,3240],[3780,3920]] as [number,number][]) tallPine(x,y,1.1);
    for (const [x,y] of [[3460,700],[3700,1140],[3460,1600],[3700,2160],[3460,2620],[3700,3100],[3460,3620]] as [number,number][]) bigBush(x,y);
    for (const y of [660,1080,1560,1980,2380,2820,3200,3620]) flowerBed(3640,y,[0xaa44ee,0xf5d020,0xf060b0],7);
    for (const [x,y] of [[3580,940],[3780,1820],[3500,2600],[3700,3420]] as [number,number][]) mushCluster(x,y);
    for (const [x,y] of [[3480,800],[3780,1480],[3500,2200],[3760,3040],[3480,3680]] as [number,number][]) rock(x,y,1.0);

    // â”€â”€ 3. TOP BORDER (y 20â€“150) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const [x,y] of [[170,80],[430,60],[710,85],[990,68],[1270,82],[1560,64],[1750,82]] as [number,number][]) medOak(x,y);
    for (const [x,y] of [[300,78],[860,72],[1420,80]] as [number,number][]) tallPine(x,y,0.9);
    for (const [x,y] of [[90,118],[400,108],[680,122],[960,110],[1230,118],[1500,108],[1700,114]] as [number,number][]) medBush(x,y);
    for (const x of [200,500,800,1100,1400]) grassCluster(x,110,8);

    // â”€â”€ 4. BOTTOM BORDER (y 3650â€“4180) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const [x,y] of [
      [180,3740],[480,3720],[780,3750],[1080,3730],[1380,3745],
      [1680,3722],[1980,3748],[2280,3730],[2580,3745],[2880,3724],
      [3180,3748],[3480,3730],[3780,3745],
    ] as [number,number][]) medOak(x,y);
    for (const [x,y] of [[330,3800],[930,3780],[1530,3810],[2130,3790],[2730,3812],[3330,3790]] as [number,number][]) tallPine(x,y,1.0);
    for (const x of [450,900,1400,1800,2300,2700,3200,3650]) flowerBed(x,3860,[0xe83030,0xf060b0,0xaa44ee,0xffffff],8);

    // â”€â”€ 5. TOWN SQUARE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fountain(1900, 1900);
    lamp(1696,1752); lamp(2104,1752); lamp(1696,2016); lamp(2104,2016);
    bench(1770,1848); bench(1990,1848); bench(1770,1952); bench(1990,1952);
    crystalCluster(1706,1726,0x9933ff); crystalCluster(2086,1726,0x9933ff);
    crystalCluster(1706,2060,0x6633ff); crystalCluster(2086,2060,0x6633ff);
    flowerBed(1678,1800,[0xff80b0,0xffffff,0xee88ff],8);
    flowerBed(2120,1800,[0xf5e040,0xffffff,0xff80b0],8);
    flowerBed(1678,1980,[0xaa44ee,0xffffff,0xee88ff],8);
    flowerBed(2120,1980,[0xe83030,0xffffff,0xf5e040],8);
    medBush(1706,1900); medBush(2094,1900);
    runeStone(1708,1794); runeStone(2092,1794);
    runeStone(1708,1986); runeStone(2092,1986);

    // â”€â”€ 6. ROAD-SIDE DECORATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Both sides of vertical spine (xâ‰ˆ1830-1970)
    for (const y of [900,1200,1480,2100,2380,2660,2940,3220]) {
      lamp(1688,y); lamp(2112,y);
      medBush(1650,y+90); medBush(2150,y+90);
      wildFlower(1630,y+160,[0xf5d020,0xe83030,0xf060b0,0xaa44ee][Math.floor(rng()*4)]);
      wildFlower(2170,y+160,[0xf5d020,0xe83030,0xf060b0,0xaa44ee][Math.floor(rng()*4)]);
    }
    // Above/below main horiz (yâ‰ˆ1830-1970)
    for (const x of [1320,1480,2100,2360,2620,2800]) {
      lamp(x,1696); lamp(x,1988);
      medBush(x+44,1656); medBush(x+44,2036);
      flowerBed(x+80,1632,[0xe83030,0xf060b0,0xaa44ee],5);
      flowerBed(x+80,2058,[0xf5d020,0xffffff,0xf060b0],5);
    }
    // Above secondary horiz (yâ‰ˆ2770-2910)
    for (const x of [1040,1280,1560,2100,2400,2680]) {
      lamp(x,2658); medBush(x+34,2630);
      flowerBed(x+62,2616,[0xaa44ee,0xf5d020,0xffffff],5);
    }

    // â”€â”€ 7. PARKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PARK A: x=1960-2160, y=740-1700 (gap between Dueling & Botanical)
    grandOak(2060,1060); medOak(2100,1360);
    flowerTree(2060,1560);
    bigBush(2030,1200); medBush(2100,1450);
    flowerBed(2050,1640,[0xaa44ee,0xf5d020,0xf060b0],9);
    bench(2078,1590); lamp(2062,1090);
    crystalCluster(2052,1078,0x7744ff);
    grassCluster(2080,1280,12); grassCluster(2050,1490,10);
    rock(2110,1330,0.9); mushCluster(2070,1440);
    runeStone(2055,1210);

    // PARK B: x=50-460, y=2220-2820 (left of Astronomy)
    grandOak(240,2440); medOak(360,2700);
    tallPine(155,2560,1.0);
    bigBush(200,2780); medBush(390,2500);
    flowerBed(235,2820,[0xe83030,0xf060b0,0xffffff],10);
    flowerBed(330,2780,[0xf5d020,0xffffff,0xaa44ee],8);
    bench(278,2750); lamp(330,2400);
    crystalCluster(165,2460,0x9933ff);
    mushCluster(410,2680); rock(350,2540,1.0);
    grassCluster(200,2640,12); grassCluster(380,2740,10);
    runeStone(195,2600);

    // PARK C: x=3340-3970, y=2220-2820 (right of Library)
    grandOak(3460,2400,true); grandOak(3700,2620); grandOak(3880,2460,true);
    flowerTree(3780,2400); tallPine(3560,2540,1.0);
    bigBush(3470,2760); medBush(3750,2500); medBush(3920,2700);
    flowerBed(3530,2800,[0xf5d020,0xe83030,0xf060b0],10);
    flowerBed(3740,2680,[0xf060b0,0xaa44ee,0xffffff],9);
    flowerBed(3870,2800,[0xf5d020,0xffffff,0xe83030],8);
    bench(3550,2740); bench(3820,2760);
    lamp(3460,2450); lamp(3760,2450);
    crystalCluster(3620,2500,0x9933ff); crystalCluster(3880,2600,0x7744ff);
    fountain(3680,2620);
    grassCluster(3500,2580,11); grassCluster(3790,2720,10);
    rock(3920,2540,1.0); mushCluster(3460,2760);
    runeStone(3510,2460); runeStone(3820,2460);

    // PARK D: x=2060-2960, y=3020-3540 (right of Creatures)
    grandOak(2260,3160); grandOak(2580,3320,true); grandOak(2900,3200);
    grandOak(2220,3480,true); grandOak(2780,3500);
    magicTree(2860,3380); flowerTree(2600,3160);
    tallPine(2420,3240,1.0); tallPine(2720,3460,0.95);
    bigBush(2160,3380); bigBush(2520,3540); bigBush(2900,3380); bigBush(2660,3260);
    flowerBed(2300,3420,[0xaa44ee,0xf5d020,0xe83030],10);
    flowerBed(2680,3240,[0xf5d020,0xf060b0,0xaa44ee],10);
    flowerBed(2960,3420,[0xf060b0,0xe83030,0xffffff],9);
    flowerBed(2460,3500,[0xe83030,0xffffff,0xf5d020],8);
    bench(2380,3360); bench(2790,3360);
    lamp(2260,3160); lamp(2790,3160);
    crystalCluster(2560,3260,0x9933ff); crystalCluster(2200,3520,0x6633ff);
    mushCluster(2460,3400); mushCluster(2700,3240);
    rock(2920,3500,1.0); rock(2200,3270,0.9);
    grassCluster(2360,3460,12); grassCluster(2740,3460,11); grassCluster(2120,3330,10);
    runeStone(2560,3150); runeStone(2880,3460);

    // â”€â”€ 8. BUILDING SURROUNDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // DUELING â€” left side + fence + trees
    for (const y of [780,940,1100,1260,1420,1510]) {
      bigBush(462,y); wildFlower(432,y+72,[0xf060b0,0xe83030,0xaa44ee,0xf5d020][Math.floor(rng()*4)]);
    }
    lamp(488,820); lamp(488,1510);
    grandOak(472,920,true); grandOak(472,1300,false);
    fence(520,695,340);
    for (const x of [600,760,920,1080,1240,1400,1560,1720]) grassCluster(x,690,7);
    flowerBed(640,686,[0xf060b0,0xffffff,0xf5d020],8);
    flowerBed(1280,686,[0xf5d020,0xf060b0,0xe83030],8);
    rock(446,1170,0.9);

    // BOTANICAL â€” left + right + top
    for (const y of [1060,1220,1380,1540,1660]) {
      bigBush(2158,y); wildFlower(2118,y+62,[0xe83030,0xf5d020,0xf060b0][Math.floor(rng()*3)]);
    }
    lamp(2180,1060); lamp(2180,1680);
    grandOak(2164,1130,false); grandOak(2164,1480,true);
    fence(2220,996,400);
    for (const x of [2340,2540,2740,2940,3140,3320]) grassCluster(x,990,7);
    flowerBed(2500,988,[0xf060b0,0xffffff,0xaa44ee],8);
    flowerBed(3100,988,[0xaa44ee,0xffffff,0xe83030],8);
    for (const y of [1060,1270,1490,1670]) bigBush(3428,y);
    lamp(3438,1080); lamp(3438,1670);

    // HOSPITAL â€” sides + top pines
    for (const y of [200,370,540,700]) {
      bigBush(2162,y); bigBush(3328,y);
      wildFlower(2120,y+52,0xaa44ee); wildFlower(3368,y+52,0xf5d020);
    }
    lamp(2180,220); lamp(3328,220);
    for (const x of [2360,2560,2760,2960,3160]) tallPine(x,102,0.8);
    flowerBed(2480,100,[0xf060b0,0xffffff,0xaa44ee],6);
    flowerBed(3020,100,[0xaa44ee,0xffffff,0xf5d020],6);
    fence(2220,155,260); fence(2990,155,210);

    // ASTRONOMY â€” left + top
    for (const y of [2280,2460,2620,2760]) {
      bigBush(462,y); wildFlower(430,y+62,[0xf5d020,0xaa44ee,0xe83030][Math.floor(rng()*3)]);
    }
    lamp(486,2280); lamp(486,2800);
    grandOak(470,2380,false); grandOak(470,2700,true);
    fence(520,2190,380);
    for (const x of [620,840,1240,1460]) grassCluster(x,2192,7);
    flowerBed(700,2190,[0xe83030,0xffffff,0xf060b0],8);
    flowerBed(1330,2190,[0xf060b0,0xffffff,0xaa44ee],8);
    runeStone(1490,2290);

    // LIBRARY â€” both sides + top
    for (const y of [2280,2460,2620,2760]) {
      bigBush(2160,y); bigBush(3330,y);
      wildFlower(2120,y+62,0xaa44ee); wildFlower(3370,y+62,0xf060b0);
    }
    lamp(2180,2280); lamp(2180,2800); lamp(3328,2280); lamp(3328,2800);
    grandOak(3378,2380,true); grandOak(3378,2700,false);
    fence(2220,2192,460); fence(2860,2192,360);
    for (const x of [2460,2680,2900,3120,3300]) grassCluster(x,2192,7);
    flowerBed(2620,2192,[0xf5d020,0xffffff,0xe83030],8);
    flowerBed(3180,2192,[0xe83030,0xffffff,0xf060b0],8);
    rock(3360,2580,0.95); runeStone(3358,2440);

    // CREATURES â€” left + top
    for (const y of [3060,3240,3400,3540]) {
      bigBush(962,y); wildFlower(928,y+62,[0xf5d020,0xf060b0,0xe83030][Math.floor(rng()*3)]);
    }
    lamp(986,3060); lamp(986,3540);
    grandOak(970,3160,false); grandOak(970,3460,true);
    fence(1040,2990,420);
    for (const x of [1140,1360,1800,1960]) grassCluster(x,2992,7);
    flowerBed(1220,2992,[0xf060b0,0xffffff,0xf5d020],8);
    flowerBed(1780,2992,[0xaa44ee,0xffffff,0xe83030],8);
    rock(1970,3140,0.9);

    // â”€â”€ 9. SCATTERED ATMOSPHERE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const [x,y] of [
      [185,740],[405,1390],[215,2780],[415,3580],
      [3565,940],[3775,1800],[3505,2620],[3715,3400],
    ] as [number,number][]) mushCluster(x,y);

    for (const [x,y,s] of [
      [135,340,1.1],[415,1480,1.0],[175,2600,1.1],[335,3800,1.0],
      [3745,560,1.1],[3940,1700,1.0],[3800,2780,1.1],[3880,3880,1.0],
    ] as [number,number,number][]) rock(x,y,s);

    // Scattered grass clusters in safe open areas
    const safeGrass = (x: number, y: number) => {
      if (x>1760&&x<2010) return;
      if (y>1760&&y<2010&&x>1140&&x<2970) return;
      if (y>2700&&y<2980&&x>880&&x<2860) return;
      if (x>460&&x<1940&&y>660&&y<1580) return;
      if (x>2160&&x<3440&&y>960&&y<1740) return;
      if (x>2160&&x<3340&&y>120&&y<840) return;
      if (x>460&&x<1540&&y>2160&&y<2880) return;
      if (x>2160&&x<3340&&y>2160&&y<2880) return;
      if (x>960&&x<2040&&y>2960&&y<3600) return;
      grassCluster(x, y, 6 + Math.round(rng()*8));
    };
    for (let i = 0; i < 180; i++) {
      safeGrass(60 + Math.round(rng()*3880), 60 + Math.round(rng()*4080));
    }
  }
  private _drawBuildings() {
    // 1. Dueling Building â€” size now 70Ã—42 tiles (1400Ã—840px) from game.json
    const duelBx = DUEL_BUILDING_POSITION.x, duelBy = DUEL_BUILDING_POSITION.y;
    const duelBw = DUEL_BUILDING_POSITION.width, duelBh = DUEL_BUILDING_POSITION.height;
    const duelPad = this.add.graphics().setDepth(6);
    duelPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    duelPad.fillRect(duelBx, duelBy, duelBw, duelBh);
    const duelSprite = this.add.image(duelBx, duelBy, 'duelingBuildingSprite').setOrigin(0,0).setDepth(7);
    if (duelSprite.width > 0) duelSprite.setScale(duelBw / duelSprite.width, duelBh / duelSprite.height);
    this.textures.get('duelingBuildingSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 2. Botanical Classroom â€” grass pad depth 6, sprite depth 8
    const botBx = 110 * TILE_SIZE, botBy = 50 * TILE_SIZE;
    const botBw = 60  * TILE_SIZE, botBh = 35 * TILE_SIZE;
    const botPad = this.add.graphics().setDepth(6);
    botPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    botPad.fillRect(botBx, botBy, botBw, botBh);
    const botSprite = this.add.image(botBx, botBy, 'botanicalBuildingSprite').setOrigin(0,0).setDepth(8);
    if (botSprite.width > 0) botSprite.setScale(botBw / botSprite.width, botBh / botSprite.height);
    this.textures.get('botanicalBuildingSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 3. Astronomy Tower â€” grass pad depth 6, sprite depth 8, scaled 50x32 tiles (1000x640px)
    const astBx = 25  * TILE_SIZE, astBy = 110 * TILE_SIZE;
    const astBw = 50  * TILE_SIZE, astBh = 32  * TILE_SIZE;
    const astPad = this.add.graphics().setDepth(6);
    astPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    astPad.fillRect(astBx, astBy, astBw, astBh);
    const astSprite = this.add.image(astBx, astBy, 'astronomyTowerSprite').setOrigin(0,0).setDepth(8);
    if (astSprite.width > 0) astSprite.setScale(astBw / astSprite.width, astBh / astSprite.height);
    this.textures.get('astronomyTowerSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 4. Hogwarts Library â€” tile(110,110) â†’ world px (2200, 2200), scaled 55Ã—32 tiles (1100Ã—640 px)
    const libBx = 110 * TILE_SIZE;  // 2200
    const libBy = 110 * TILE_SIZE;  // 2200
    const libBw = 55  * TILE_SIZE;  // 1100
    const libBh = 32  * TILE_SIZE;  // 640
    const libPad = this.add.graphics().setDepth(6);
    libPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    libPad.fillRect(libBx, libBy, libBw, libBh);
    const libSprite = this.add.image(libBx, libBy, 'libraryBuildingSprite').setOrigin(0,0).setDepth(8);
    if (libSprite.width > 0) libSprite.setScale(libBw / libSprite.width, libBh / libSprite.height);
    this.textures.get('libraryBuildingSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 5. Creatures Class â€” tile(50,150) â†’ world(1000,3000), scaled 50Ã—28 tiles (1000Ã—560px)
    const crBx = 50  * TILE_SIZE;  // 1000
    const crBy = 150 * TILE_SIZE;  // 3000
    const crBw = 50  * TILE_SIZE;  // 1000
    const crBh = 28  * TILE_SIZE;  // 560
    const crPad = this.add.graphics().setDepth(6);
    crPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    crPad.fillRect(crBx, crBy, crBw, crBh);
    const crSprite = this.add.image(crBx, crBy, 'creaturesClassSprite').setOrigin(0,0).setDepth(8);
    if (crSprite.width > 0) crSprite.setScale(crBw / crSprite.width, crBh / crSprite.height);
    this.textures.get('creaturesClassSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 6. Magical Hospital — tile(110,8) → world(2200,160), scaled 55×32 tiles (1100×640px)
    const hospBx = 110 * TILE_SIZE;  // 2200
    const hospBy = 8   * TILE_SIZE;  // 160
    const hospBw = 55  * TILE_SIZE;  // 1100
    const hospBh = 32  * TILE_SIZE;  // 640
    const hospPad = this.add.graphics().setDepth(6);
    hospPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    hospPad.fillRect(hospBx, hospBy, hospBw, hospBh);
    const hospSprite = this.add.image(hospBx, hospBy, 'magicalHospitalSprite').setOrigin(0,0).setDepth(8);
    if (hospSprite.width > 0) hospSprite.setScale(hospBw / hospSprite.width, hospBh / hospSprite.height);
    this.textures.get('magicalHospitalSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);


  }

  private _createColliders() {
    this.staticGroup = this.physics.add.staticGroup();

    // World boundaries
    for (const [x, y, w, h] of [
      [0,           0,            WORLD_W, 60],
      [0,           WORLD_H - 60, WORLD_W, 60],
      [0,           0,            60,      WORLD_H],
      [WORLD_W - 60, 0,           60,      WORLD_H],
    ] as [number,number,number,number][]) {
      const rect = this.add.rectangle(x + w/2, y + h/2, w, h, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.staticGroup.add(rect);
    }

    // Dueling building collision (from game.json layout)
    const layout = DUEL_BUILDING_LAYOUT as DuelingBuildingLayout;
    const collisionData = layout.collision ?? [];
    let added = false;
    if (Array.isArray(collisionData) && collisionData.length > 0) {
      const first = collisionData[0];
      if (first && typeof first === 'object' && ('x' in first || 'y' in first)) {
        for (const block of collisionData as CollisionBlock[]) {
          if (!block || typeof block !== 'object') continue;
          const bx = DUEL_BUILDING_POSITION.x + (Number(block.x) || 0) * TILE_SIZE;
          const by = DUEL_BUILDING_POSITION.y + (Number(block.y) || 0) * TILE_SIZE;
          const bw = ((Number(block.width) || Number(block.w) || 0) || 1) * TILE_SIZE;
          const bh = ((Number(block.height) || Number(block.h) || 0) || 1) * TILE_SIZE;
          if (bw <= 0 || bh <= 0) continue;
          const rect = this.add.rectangle(bx + bw/2, by + bh/2, bw, bh, 0x000000, 0);
          this.physics.add.existing(rect, true);
          this.staticGroup.add(rect);
          added = true;
        }
      }
    }
    if (!added) {
      const bx = DUEL_BUILDING_POSITION.x, by = DUEL_BUILDING_POSITION.y;
      const bw = DUEL_BUILDING_POSITION.width, bh = DUEL_BUILDING_POSITION.height;
      const doorW = (layout.door?.w ?? 6) * TILE_SIZE;
      const doorCX = DUEL_BUILDING_DOOR.x;
      const T = TILE_SIZE;
      const aw = (x: number, y: number, w: number, h: number) => {
        const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
        this.physics.add.existing(r, true); this.staticGroup.add(r);
      };
      aw(bx + bw/2, by + T/2, bw, T);
      const le = doorCX - doorW/2, re = doorCX + doorW/2;
      const lw = Math.max(0, le - bx), rw = Math.max(0, bx + bw - re);
      if (lw > 0) aw(bx + lw/2, by + bh - T/2, lw, T);
      if (rw > 0) aw(bx + bw - rw/2, by + bh - T/2, rw, T);
      aw(bx + T/2, by + bh/2, T, bh);
      aw(bx + bw - T/2, by + bh/2, T, bh);
    }

    this._addBotanicalBuildingCollision();
    this._addAstronomyBuildingCollision();
    this._addLibraryBuildingCollision();
    this._addCreaturesBuildingCollision();
    this._addHospitalBuildingCollision();
    this._addH2BuildingCollision();
  }

  private _createDoorIndicators() {
    // Dueling Club bubble â€” crossed-swords icon above the entrance arch
    {
      const DOOR = { x: DUEL_BUILDING_DOOR.x, y: DUEL_BUILDING_DOOR.y };
      const duelGlow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0xcc4422, 0.18).setDepth(18);
      this.tweens.add({ targets: duelGlow, fillAlpha: { from: 0.10, to: 0.38 }, scaleX: { from: 0.88, to: 1.18 }, scaleY: { from: 0.88, to: 1.18 }, duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const duelBubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x1a0600, 0.92).setDepth(19);
      duelBubble.setStrokeStyle(2.5, 0xff6633, 1);
      const duelIcon = this.add.text(DOOR.x, DOOR.y - 80, '\u2694', { fontSize: '20px', color: '#ffaa44' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [duelBubble, duelIcon, duelGlow], y: '-=8', duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Botanical classroom bubble
    {
      const DOOR = {
        x: 110 * TILE_SIZE + 30 * TILE_SIZE + (4 * TILE_SIZE) / 2,
        y: 50  * TILE_SIZE + 28 * TILE_SIZE + (4 * TILE_SIZE) / 2,
      };
      const glow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0x55cc44, 0.18).setDepth(18);
      this.tweens.add({ targets: glow, fillAlpha: { from: 0.10, to: 0.35 }, scaleX: { from: 0.9, to: 1.15 }, scaleY: { from: 0.9, to: 1.15 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const bubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x2d6a1f, 0.88).setDepth(19);
      bubble.setStrokeStyle(2.5, 0xaaee66, 1);
      const icon = this.add.text(DOOR.x, DOOR.y - 80, '\u{1F33F}', { fontSize: '22px' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [bubble, icon, glow], y: '-=8', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Astronomy tower bubble
    {
      const DOOR = {
        x: 25 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.50),
        y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
      };
      const glow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0xaaddff, 0.18).setDepth(18);
      this.tweens.add({ targets: glow, fillAlpha: { from: 0.10, to: 0.35 }, scaleX: { from: 0.9, to: 1.15 }, scaleY: { from: 0.9, to: 1.15 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const bubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x0a0a1a, 0.90).setDepth(19);
      bubble.setStrokeStyle(2.5, 0x88bbff, 1);
      const icon = this.add.text(DOOR.x, DOOR.y - 80, '\u{1F52D}', { fontSize: '22px' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [bubble, icon, glow], y: '-=8', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Hogwarts Library bubble â€” golden book icon above the entrance arch
    {
      const DOOR = {
        x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
        y: 110 * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.82),
      };
      const astGlow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0xffdd88, 0.18).setDepth(18);
      this.tweens.add({ targets: astGlow, fillAlpha: { from: 0.10, to: 0.35 }, scaleX: { from: 0.9, to: 1.15 }, scaleY: { from: 0.9, to: 1.15 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const astBubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x1a0a02, 0.90).setDepth(19);
      astBubble.setStrokeStyle(2.5, 0xffdd88, 1);
      const astIcon = this.add.text(DOOR.x, DOOR.y - 80, '\u{1F4DA}', { fontSize: '22px' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [astBubble, astIcon, astGlow], y: '-=8', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Creatures Class bubble â€” orange paw print icon
    {
      const DOOR = {
        x: 50 * TILE_SIZE + Math.round(50 * TILE_SIZE * 0.48),
        y: 150 * TILE_SIZE + Math.round(28 * TILE_SIZE * 0.84),
      };
      const crGlow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0xff9922, 0.18).setDepth(18);
      this.tweens.add({ targets: crGlow, fillAlpha: { from: 0.10, to: 0.35 }, scaleX: { from: 0.9, to: 1.15 }, scaleY: { from: 0.9, to: 1.15 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const crBubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x1a0a02, 0.90).setDepth(19);
      crBubble.setStrokeStyle(2.5, 0xff9922, 1);
      const crIcon = this.add.text(DOOR.x, DOOR.y - 80, '\u{1F43E}', { fontSize: '22px' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [crBubble, crIcon, crGlow], y: '-=8', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Magical Hospital bubble — red cross / healing icon
    {
      const DOOR = {
        x: 110 * TILE_SIZE + Math.round(55 * TILE_SIZE * 0.48),
        y: 8   * TILE_SIZE + Math.round(32 * TILE_SIZE * 0.83),
      };
      const hospGlow = this.add.circle(DOOR.x, DOOR.y - 80, 34, 0xff4444, 0.18).setDepth(18);
      this.tweens.add({ targets: hospGlow, fillAlpha: { from: 0.10, to: 0.35 }, scaleX: { from: 0.9, to: 1.15 }, scaleY: { from: 0.9, to: 1.15 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const hospBubble = this.add.circle(DOOR.x, DOOR.y - 80, 28, 0x1a0002, 0.90).setDepth(19);
      hospBubble.setStrokeStyle(2.5, 0xff6666, 1);
      const hospIcon = this.add.text(DOOR.x, DOOR.y - 80, '\u2764', { fontSize: '22px', color: '#ff4444' }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: [hospBubble, hospIcon, hospGlow], y: '-=8', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Building H2 bubble removed (duplicate of bottom bar prompt)

    // Generic indicators for any other buildings
    for (const b of BUILDINGS) {
      if (b.id === 'duellingRoom') continue;
      if (b.id === 'botanicalClassroom') continue;
      if (b.id === 'astronomyTower') continue;
      if (b.id === 'hogwartsLibrary') continue;
      if (b.id === 'creaturesClass') continue;
      if (b.id === 'magicalHospital') continue;
      if (b.id === 'h2Building') continue;
      const glow = this.add.circle(b.doorX, b.doorY, 30, 0xc9a227, 0.0);
      glow.setBlendMode(Phaser.BlendModes.ADD).setDepth(15);
      this.tweens.add({ targets: glow, fillAlpha: 0.25, radius: 44, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.doorGlows.set(b.id, glow);
      const label = this.add.text(b.doorX, b.doorY - 52, b.label, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#f0cd60', stroke: '#1a0533', strokeThickness: 3, align: 'center' }).setOrigin(0.5).setDepth(17);
      this.tweens.add({ targets: label, y: b.doorY - 58, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.doorLabels.set(b.id, label);
    }
  }

  private _spawnAmbientLife() {
    for (let i = 0; i < 20; i++) {
      const px = 200 + Math.random() * (WORLD_W - 400);
      const py = 300 + Math.random() * (WORLD_H - 400);
      const colors = [0xc9a227, 0xa855f7, 0x22c55e, 0x60a5fa];
      const dot = this.add.circle(px, py, 2 + Math.random() * 2, colors[Math.floor(Math.random()*colors.length)], 0.7).setDepth(18);
      this.tweens.add({ targets: dot, x: px+(Math.random()-0.5)*100, y: py-50-Math.random()*50, alpha: 0, duration: 2500+Math.random()*2000, repeat: -1,
        onRepeat: () => { dot.setPosition(px, py); dot.setAlpha(0.7); }
      });
    }
  }

  private _seededRand(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private _playDoorSound() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(); osc.stop(ctx.currentTime + 0.7);
      osc.onended = () => ctx.close();
    } catch { /* silence */ }
  }
}
