import { Game } from './game/Game';
import { Hud } from './ui/hud';

const app = document.getElementById('app');
if (!app) {
  throw new Error('找不到 #app 容器');
}

const hud = new Hud();
const game = new Game(app, hud);
game.start();
