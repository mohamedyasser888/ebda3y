import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }            from '../entities/Wizard';
import { PlayerController }  from '../systems/PlayerController';
import { BUILDINGS } from '../data/buildings';
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

  constructor() { super({ key: 'OutdoorWorldScene' }); }

  preload() {
    this.load.image('duelingBuildingSprite',   '/assets/buildings/dueling/dueling-building.png');
    this.load.image('botanicalBuildingSprite', '/assets/buildings/botanical-classroom-exterior.png');
    this.load.image('astronomyTowerSprite',    '/assets/buildings/astronomy-tower-exterior.png');
    this.load.image('libraryBuildingSprite',   '/assets/buildings/hogwarts-library-exterior.png');
    this.load.image('creaturesClassSprite',    '/assets/buildings/creatures-class-exterior.png');
    this.load.image('magicalHospitalSprite',   '/assets/buildings/magical-hospital-exterior.png');
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

    // Spawn Wizard
    const store  = this._getStore();
    const requestedSpawnX = data?.returnX ?? (store ? store.outdoorX : OUTDOOR_PLAYER_SPAWN.x);
    const requestedSpawnY = data?.returnY ?? (store ? store.outdoorY : OUTDOOR_PLAYER_SPAWN.y);
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
    }

    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => {
      if (this.nearBuilding && !this.isTransitioning) {
        this._enterBuilding(this.nearBuilding);
      }
    });

    const { width, height } = this.cameras.main;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(spr, true, 0.08, 0.08);

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
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    this.controller.update(delta);

    const spr = this.wizard.getSprite();
    const isDashing = (this.controller as PlayerController & { isDashing?: () => boolean }).isDashing?.() ?? false;
    this._savePosition(spr.x, spr.y);

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
  }

  private _isFacingDuellingDoor() {
    const sprite = this.wizard.getSprite();
    const direction = this.controller.getDirection();
    const horizontalDistance = Math.abs(sprite.x - DUEL_BUILDING_DOOR.x);
    const verticalDistance = sprite.y - DUEL_BUILDING_DOOR.y;
    // f6 door arch is ~5 tiles (100px) wide — widen horizontal tolerance
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

    // Tower base — split by arch opening
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
    // tile(50,150) → world(1000,3000), scaled 50x28 tiles = 1000x560px
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
    // tile(110,8) → world(2200,160), scaled 55×32 tiles (1100×640px)
    // H1 exterior: stone building, central arch door at ~48% BW, ~83% BH
    // Top (roof + battlements): 0–60% BH
    // Front wall eave: 60% BH
    // Front wall bottom: 83% BH — door opens here
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

  private _addLibraryBuildingCollision() {    // Building origin: tile(110,110) → world(2200,2200), scaled 55x32 tiles (1100x640 px)
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

    // 1. Full top band (roof to eave) — covers left wing + centre + right tower
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
    this.isTransitioning = true;
    this.controller.setBlocked(true);
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    this._playDoorSound();
    this.cameras.main.fadeOut(520, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(b.sceneKey, { buildingId: b.id, spawnX: b.spawnX, spawnY: b.spawnY });
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
    const g = this.add.graphics().setDepth(1);
    for (const path of HOGWARTS_PATHS) {
      g.fillStyle(pathColor(path.type));
      for (let i = 0; i < path.points.length - 1; i++) {
        const [x1, y1] = path.points[i];
        const [x2, y2] = path.points[i + 1];
        const wx = x1 * TILE_SIZE, wy = y1 * TILE_SIZE;
        const nx = x2 * TILE_SIZE, ny = y2 * TILE_SIZE;
        g.fillRect(Math.min(wx, nx), Math.min(wy, ny),
          Math.max(12, Math.abs(nx - wx) + TILE_SIZE),
          Math.max(12, Math.abs(ny - wy) + TILE_SIZE));
      }
    }
  }

  private _drawWater() { /* grounds remain dry */ }

  private _drawDecoration() {
    const g = this.add.graphics().setDepth(5);
    for (const [rx, ry] of [[200, 500], [1850, 700], [2150, 1200], [800, 1500]] as [number,number][]) {
      g.fillStyle(0x555555); g.fillEllipse(rx, ry, 30, 20);
      g.fillStyle(0x777777); g.fillEllipse(rx - 4, ry - 4, 16, 12);
    }
  }

  private _drawBuildings() {
    // 1. Dueling Building — size now 70×42 tiles (1400×840px) from game.json
    const duelBx = DUEL_BUILDING_POSITION.x, duelBy = DUEL_BUILDING_POSITION.y;
    const duelBw = DUEL_BUILDING_POSITION.width, duelBh = DUEL_BUILDING_POSITION.height;
    const duelPad = this.add.graphics().setDepth(6);
    duelPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    duelPad.fillRect(duelBx, duelBy, duelBw, duelBh);
    const duelSprite = this.add.image(duelBx, duelBy, 'duelingBuildingSprite').setOrigin(0,0).setDepth(7);
    if (duelSprite.width > 0) duelSprite.setScale(duelBw / duelSprite.width, duelBh / duelSprite.height);
    this.textures.get('duelingBuildingSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 2. Botanical Classroom — grass pad depth 6, sprite depth 8
    const botBx = 110 * TILE_SIZE, botBy = 50 * TILE_SIZE;
    const botBw = 60  * TILE_SIZE, botBh = 35 * TILE_SIZE;
    const botPad = this.add.graphics().setDepth(6);
    botPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    botPad.fillRect(botBx, botBy, botBw, botBh);
    const botSprite = this.add.image(botBx, botBy, 'botanicalBuildingSprite').setOrigin(0,0).setDepth(8);
    if (botSprite.width > 0) botSprite.setScale(botBw / botSprite.width, botBh / botSprite.height);
    this.textures.get('botanicalBuildingSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 3. Astronomy Tower — grass pad depth 6, sprite depth 8, scaled 50x32 tiles (1000x640px)
    const astBx = 25  * TILE_SIZE, astBy = 110 * TILE_SIZE;
    const astBw = 50  * TILE_SIZE, astBh = 32  * TILE_SIZE;
    const astPad = this.add.graphics().setDepth(6);
    astPad.fillStyle(groundColor(HOGWARTS_GROUND.tile));
    astPad.fillRect(astBx, astBy, astBw, astBh);
    const astSprite = this.add.image(astBx, astBy, 'astronomyTowerSprite').setOrigin(0,0).setDepth(8);
    if (astSprite.width > 0) astSprite.setScale(astBw / astSprite.width, astBh / astSprite.height);
    this.textures.get('astronomyTowerSprite')?.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // 4. Hogwarts Library — tile(110,110) → world px (2200, 2200), scaled 55×32 tiles (1100×640 px)
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

    // 5. Creatures Class — tile(50,150) → world(1000,3000), scaled 50×28 tiles (1000×560px)
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
  }

  private _createDoorIndicators() {
    // Dueling Club bubble — crossed-swords icon above the entrance arch
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

    // Hogwarts Library bubble — golden book icon above the entrance arch
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

    // Creatures Class bubble — orange paw print icon
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

    // Generic indicators for any other buildings
    for (const b of BUILDINGS) {
      if (b.id === 'duellingRoom') continue;
      if (b.id === 'botanicalClassroom') continue;
      if (b.id === 'astronomyTower') continue;
      if (b.id === 'hogwartsLibrary') continue;
      if (b.id === 'creaturesClass') continue;
      if (b.id === 'magicalHospital') continue;
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
