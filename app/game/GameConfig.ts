// ============================================================
// GameConfig — Phaser Game Configuration
// ============================================================
import Phaser from 'phaser';
import { BootScene }                from './scenes/BootScene';
import { OutdoorWorldScene }        from './scenes/OutdoorWorldScene';
import { CommonRoomScene }          from './scenes/CommonRoomScene';
import { PotionLabScene }           from './scenes/PotionLabScene';
import { DuellingRoomScene }        from './scenes/DuellingRoomScene';
import { BotanicalClassroomScene }  from './scenes/BotanicalClassroomScene';
import { AstronomyTowerScene }      from './scenes/AstronomyTowerScene';
import { HogwartsLibraryScene }     from './scenes/HogwartsLibraryScene';
import { CreaturesClassScene }      from './scenes/CreaturesClassScene';
import { MagicalHospitalScene }     from './scenes/MagicalHospitalScene';
import { RarePlantQuestScene }      from './scenes/RarePlantQuestScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  type:            Phaser.AUTO,
  parent:          'game-container',
  backgroundColor: '#2d6a1f',   // grass green — matches ground so PNG transparency blends in
  pixelArt:        false,
  antialias:       true,
  roundPixels:     false,
  width:           1440,
  height:          810,
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade:  {
      debug:   false,
      gravity: { x: 0, y: 0 },
    },
  },
  input: {
    keyboard: {},
  },
  // Scene order matters — BootScene must be first
  scene: [BootScene, OutdoorWorldScene, CommonRoomScene, PotionLabScene, DuellingRoomScene, BotanicalClassroomScene, AstronomyTowerScene, HogwartsLibraryScene, CreaturesClassScene, MagicalHospitalScene, RarePlantQuestScene],
};
