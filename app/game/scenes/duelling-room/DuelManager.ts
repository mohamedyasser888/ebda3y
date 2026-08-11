import Phaser from 'phaser';
import { eventBus } from '../../EventBus';
import { Wizard } from '../../entities/Wizard';
import { PlayerController } from '../../systems/PlayerController';
import { PLAYER1_SPAWN, PLAYER2_SPAWN, DOOR_POSITION, DUEL_PLATFORM, isWithinCircle } from './DuelArenaConfig';

export class DuelManager {
  private scene: Phaser.Scene;
  private playerWizard: Wizard;
  private controller: PlayerController;
  private opponentWizard?: Wizard;
  private countdownText?: Phaser.GameObjects.Text;
  private duelActive = false;

  constructor(scene: Phaser.Scene, playerWizard: Wizard, controller: PlayerController) {
    this.scene = scene;
    this.playerWizard = playerWizard;
    this.controller = controller;
  }

  init() {
    eventBus.on('CLOSE_DUEL', () => this.endDuel());
    eventBus.on('DUEL_WON', () => this.endDuel());
    eventBus.on('DUEL_LOST', () => this.endDuel());
  }

  destroy() {
    this.countdownText?.destroy();
  }

  attemptStartDuel(playerX: number, playerY: number) {
    if (this.duelActive) return;
    if (!isWithinCircle({ x: playerX, y: playerY }, DUEL_PLATFORM)) return;
    this.startDuel();
  }

  startDuel() {
    this.duelActive = true;
    this.controller.setBlocked(true);
    this.teleportPlayers();
    this.spawnOpponentWizard();
    eventBus.emit('OPEN_DUEL');
  }

  private teleportPlayers() {
    const sprite = this.playerWizard.getSprite();
    sprite.setPosition(PLAYER1_SPAWN.x, PLAYER1_SPAWN.y);
    sprite.setVelocity(0, 0);
    sprite.body?.stop();
    this.playerWizard.updateShadow();
  }

  private spawnOpponentWizard() {
    if (!this.opponentWizard) {
      this.opponentWizard = new Wizard(this.scene, PLAYER2_SPAWN.x, PLAYER2_SPAWN.y);
      this.opponentWizard.getSprite().setDepth(10);
      this.opponentWizard.getSprite().setCollideWorldBounds(true);
    } else {
      this.opponentWizard.getSprite().setPosition(PLAYER2_SPAWN.x, PLAYER2_SPAWN.y);
    }
  }

  private startCountdown() {
    this.countdownText = this.scene.add.text(this.scene.cameras.main.centerX, 120, '', {
      fontSize: '64px', color: '#f8d672', fontFamily: 'Georgia', stroke: '#1b1f33', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(30);

    const steps = ['3', '2', '1', 'DUEL!'];
    let index = 0;

    const nextStep = () => {
      if (!this.countdownText) return;
      this.countdownText.setText(steps[index]);
      this.countdownText.setScale(0.8);
      this.scene.tweens.add({
        targets: this.countdownText,
        scale: 1.1,
        duration: 360,
        ease: 'Back.easeOut',
      });
      index += 1;
      if (index < steps.length) {
        this.scene.time.delayedCall(900, nextStep, [], this);
      } else {
        this.scene.time.delayedCall(900, () => {
          this.countdownText?.destroy();
          this.countdownText = undefined;
          this.controller.setBlocked(false);
          eventBus.emit('OPEN_DUEL');
        }, [], this);
      }
    };

    nextStep();
  }

  updateDepths() {
    if (!this.opponentWizard) return;
    const playerSprite = this.playerWizard.getSprite();
    const opponentSprite = this.opponentWizard.getSprite();
    playerSprite.setDepth(playerSprite.y + 10);
    opponentSprite.setDepth(opponentSprite.y + 10);
  }

  endDuel() {
    if (!this.duelActive) return;
    this.duelActive = false;
    this.controller.setBlocked(false);
    this.countdownText?.destroy();
    this.countdownText = undefined;
  }
}
