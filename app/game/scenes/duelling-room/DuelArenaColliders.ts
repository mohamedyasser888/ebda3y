import Phaser from 'phaser';
import { COLLIDER_RECTS, SPECTATOR_STAND_RECTS, WORLD_W, WORLD_H } from './DuelArenaConfig';

export function createArenaColliders(scene: Phaser.Scene) {
  scene.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

  const staticGroup = scene.physics.add.staticGroup();
  for (const [x, y, w, h] of COLLIDER_RECTS) {
    const rect = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    scene.physics.add.existing(rect, true);
    staticGroup.add(rect);
  }

  for (const [x, y, w, h] of SPECTATOR_STAND_RECTS) {
    const rect = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    scene.physics.add.existing(rect, true);
    staticGroup.add(rect);
  }

  return staticGroup;
}
