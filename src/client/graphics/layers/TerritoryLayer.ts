import { PriorityQueue } from "@datastructures-js/priority-queue";
import { Colord } from "colord";
import { Theme } from "../../../core/configuration/Config";
import { EventBus } from "../../../core/EventBus";
import { Cell, PlayerType, UnitType } from "../../../core/game/Game";
import { euclDistFN, TileRef } from "../../../core/game/GameMap";
import { GameUpdateType, PlayerUpdate } from "../../../core/game/GameUpdates";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { PseudoRandom } from "../../../core/PseudoRandom";
import { AlternateViewEvent, DragEvent } from "../../InputHandler";
import { Layer } from "./Layer";

export class TerritoryLayer implements Layer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private imageData: ImageData;

  private tileToRenderQueue: PriorityQueue<{
    tile: TileRef;
    lastUpdate: number;
  }> = new PriorityQueue((a, b) => {
    return a.lastUpdate - b.lastUpdate;
  });
  private random = new PseudoRandom(123);
  private theme: Theme;

  // Used for spawn highlighting
  private highlightCanvas: HTMLCanvasElement;
  private highlightContext: CanvasRenderingContext2D;

  private alternativeView = false;
  private lastDragTime = 0;
  private nodrawDragDuration = 200;

  private refreshRate = 10;
  private lastRefresh = 0;

  private lastFocusedPlayer: PlayerView | null = null;
  private playerTilesMap: Map<number, number> = new Map();
  private captureTiles: { low: number; mid: number; high: number } = {
    low: 200,
    mid: 400,
    high: 800,
  };

  constructor(
    private game: GameView,
    private eventBus: EventBus,
  ) {
    this.theme = game.config().theme();
  }

  shouldTransform(): boolean {
    return true;
  }

  paintPlayerBorder(player: PlayerView) {
    player.borderTiles().then((playerBorderTiles) => {
      playerBorderTiles.borderTiles.forEach((tile: TileRef) => {
        this.paintTerritory(tile, true); // Immediately paint the tile instead of enqueueing
      });
    });
  }

  tick() {
    this.game.recentlyUpdatedTiles().forEach((t) => this.enqueueTile(t));
    const updates = this.game.updatesSinceLastTick();
    const unitUpdates = updates !== null ? updates[GameUpdateType.Unit] : [];
    unitUpdates.forEach((update) => {
      if (update.unitType === UnitType.DefensePost) {
        const tile = update.pos;
        this.game
          .bfs(tile, euclDistFN(tile, this.game.config().defensePostRange()))
          .forEach((t) => {
            if (
              this.game.isBorder(t) &&
              (this.game.ownerID(t) === update.ownerID ||
                this.game.ownerID(t) === update.lastOwnerID)
            ) {
              this.enqueueTile(t);
            }
          });
      }
    });
    this.game.updatesSinceLastTick()![GameUpdateType.Player].forEach((u) => {
      const update = u as PlayerUpdate;
      const playerId = update.smallID;
      const currTiles = update.tilesOwned;
      const prevTiles = this.playerTilesMap.get(playerId) || 0;
      this.playerTilesMap.set(playerId, currTiles);

      if (
        (currTiles - this.captureTiles.low) *
          (prevTiles - this.captureTiles.low) <=
          0 ||
        (currTiles - this.captureTiles.mid) *
          (prevTiles - this.captureTiles.mid) <=
          0 ||
        (currTiles - this.captureTiles.high) *
          (prevTiles - this.captureTiles.high) <=
          0
      ) {
        const player = this.game.playerBySmallID(playerId) as PlayerView;
        player.tiles().then((playerTiles) => {
          playerTiles.tiles.forEach((tile: TileRef) => {
            this.enqueueTile(tile);
          });
        });
      }
    });

    const focusedPlayer = this.game.focusedPlayer();
    if (focusedPlayer !== this.lastFocusedPlayer) {
      if (this.lastFocusedPlayer) {
        this.paintPlayerBorder(this.lastFocusedPlayer);
      }
      if (focusedPlayer) {
        this.paintPlayerBorder(focusedPlayer);
      }
      this.lastFocusedPlayer = focusedPlayer;
    }

    if (!this.game.inSpawnPhase()) {
      return;
    }
    if (this.game.ticks() % 5 === 0) {
      return;
    }

    this.highlightContext.clearRect(
      0,
      0,
      this.game.width(),
      this.game.height(),
    );
    const humans = this.game
      .playerViews()
      .filter((p) => p.type() === PlayerType.Human);

    for (const human of humans) {
      const center = human.nameLocation();
      if (!center) {
        continue;
      }
      const centerTile = this.game.ref(center.x, center.y);
      if (!centerTile) {
        continue;
      }
      let color = this.theme.spawnHighlightColor();
      const myPlayer = this.game.myPlayer();
      if (
        myPlayer !== null &&
        myPlayer !== human &&
        myPlayer.isFriendly(human)
      ) {
        color = this.theme.selfColor();
      }
      for (const tile of this.game.bfs(
        centerTile,
        euclDistFN(centerTile, 9, true),
      )) {
        if (!this.game.hasOwner(tile)) {
          this.paintHighlightCell(
            new Cell(this.game.x(tile), this.game.y(tile)),
            color,
            255,
          );
        }
      }
    }
  }

  init() {
    this.eventBus.on(AlternateViewEvent, (e) => {
      this.alternativeView = e.alternateView;
    });
    this.eventBus.on(DragEvent, (e) => {
      // TODO: consider re-enabling this on mobile or low end devices for smoother dragging.
      // this.lastDragTime = Date.now();
    });
    this.redraw();
  }

  redraw() {
    console.log("redrew territory layer");
    this.canvas = document.createElement("canvas");
    const context = this.canvas.getContext("2d");
    if (context === null) throw new Error("2d context not supported");
    this.context = context;

    this.imageData = this.context.getImageData(
      0,
      0,
      this.game.width(),
      this.game.height(),
    );
    this.initImageData();
    this.canvas.width = this.game.width();
    this.canvas.height = this.game.height();
    this.context.putImageData(this.imageData, 0, 0);

    // Add a second canvas for highlights
    this.highlightCanvas = document.createElement("canvas");
    const highlightContext = this.highlightCanvas.getContext("2d", {
      alpha: true,
    });
    if (highlightContext === null) throw new Error("2d context not supported");
    this.highlightContext = highlightContext;
    this.highlightCanvas.width = this.game.width();
    this.highlightCanvas.height = this.game.height();

    this.game.forEachTile((t) => {
      this.paintTerritory(t);
    });
  }

  initImageData() {
    this.game.forEachTile((tile) => {
      const cell = new Cell(this.game.x(tile), this.game.y(tile));
      const index = cell.y * this.game.width() + cell.x;
      const offset = index * 4;
      this.imageData.data[offset + 3] = 0;
    });
  }

  renderLayer(context: CanvasRenderingContext2D) {
    const now = Date.now();
    if (
      now > this.lastDragTime + this.nodrawDragDuration &&
      now > this.lastRefresh + this.refreshRate
    ) {
      this.lastRefresh = now;
      this.renderTerritory();
      this.context.putImageData(this.imageData, 0, 0);
    }
    if (this.alternativeView) {
      return;
    }

    context.drawImage(
      this.canvas,
      -this.game.width() / 2,
      -this.game.height() / 2,
      this.game.width(),
      this.game.height(),
    );
    if (this.game.inSpawnPhase()) {
      context.drawImage(
        this.highlightCanvas,
        -this.game.width() / 2,
        -this.game.height() / 2,
        this.game.width(),
        this.game.height(),
      );
    }
  }

  renderTerritory() {
    let numToRender = Math.floor(this.tileToRenderQueue.size() / 10);
    if (numToRender === 0 || this.game.inSpawnPhase()) {
      numToRender = this.tileToRenderQueue.size();
    }

    while (numToRender > 0) {
      numToRender--;
      const tile = this.tileToRenderQueue.pop().tile;
      this.paintTerritory(tile);
      for (const neighbor of this.game.neighbors(tile)) {
        this.paintTerritory(neighbor, true);
      }
    }
  }

  paintTerritory(tile: TileRef, isBorder: boolean = false) {
    if (isBorder && !this.game.hasOwner(tile)) {
      return;
    }
    if (!this.game.hasOwner(tile)) {
      if (this.game.hasFallout(tile)) {
        this.paintCell(
          this.game.x(tile),
          this.game.y(tile),
          this.theme.falloutColor(),
          150,
        );
        return;
      }
      this.clearCell(new Cell(this.game.x(tile), this.game.y(tile)));
      return;
    }
    const owner = this.game.owner(tile) as PlayerView;
    if (this.game.isBorder(tile)) {
      const playerIsFocused = owner && this.game.focusedPlayer() === owner;
      if (
        this.game.hasUnitNearby(
          tile,
          this.game.config().defensePostRange(),
          UnitType.DefensePost,
          owner.id(),
        )
      ) {
        const borderColors = this.theme.defendedBorderColors(owner);
        const x = this.game.x(tile);
        const y = this.game.y(tile);
        const lightTile =
          (x % 2 === 0 && y % 2 === 0) || (y % 2 === 1 && x % 2 === 1);
        const borderColor = lightTile ? borderColors.light : borderColors.dark;
        this.paintCell(x, y, borderColor, 255);
      } else {
        const useBorderColor = playerIsFocused
          ? this.theme.focusedBorderColor()
          : this.theme.borderColor(owner);
        this.paintCell(
          this.game.x(tile),
          this.game.y(tile),
          useBorderColor,
          255,
        );
      }
    } else {
      const ownedTiles = owner.numTilesOwned();
      const tileX = this.game.x(tile);
      const tileY = this.game.y(tile);
      let color = this.theme.territoryColor(owner);
      if (
        !this.game.inSpawnPhase() &&
        ((ownedTiles < this.captureTiles.low && (tileX + tileY) % 2 === 0) ||
          (ownedTiles < this.captureTiles.mid && (tileX + tileY) % 4 === 0) ||
          (ownedTiles < this.captureTiles.high && (tileX + tileY) % 8 === 0))
      ) {
        color = this.theme.spawnHighlightColor();
      }
      this.paintCell(tileX, tileY, color, 150);
    }
  }

  paintCell(x: number, y: number, color: Colord, alpha: number) {
    const index = y * this.game.width() + x;
    const offset = index * 4;
    this.imageData.data[offset] = color.rgba.r;
    this.imageData.data[offset + 1] = color.rgba.g;
    this.imageData.data[offset + 2] = color.rgba.b;
    this.imageData.data[offset + 3] = alpha;
  }

  clearCell(cell: Cell) {
    const index = cell.y * this.game.width() + cell.x;
    const offset = index * 4;
    this.imageData.data[offset + 3] = 0; // Set alpha to 0 (fully transparent)
  }

  enqueueTile(tile: TileRef) {
    this.tileToRenderQueue.push({
      tile: tile,
      lastUpdate: this.game.ticks() + this.random.nextFloat(0, 0.5),
    });
  }

  async enqueuePlayerBorder(player: PlayerView) {
    const playerBorderTiles = await player.borderTiles();
    playerBorderTiles.borderTiles.forEach((tile: TileRef) => {
      this.enqueueTile(tile);
    });
  }

  paintHighlightCell(cell: Cell, color: Colord, alpha: number) {
    this.clearCell(cell);
    this.highlightContext.fillStyle = color.alpha(alpha / 255).toRgbString();
    this.highlightContext.fillRect(cell.x, cell.y, 1, 1);
  }

  clearHighlightCell(cell: Cell) {
    this.highlightContext.clearRect(cell.x, cell.y, 1, 1);
  }
}
