import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { translateText } from "../../../client/Utils";
import { EventBus, GameEvent } from "../../../core/EventBus";
import { UnitType } from "../../../core/game/Game";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { renderNumber } from "../../Utils";
import { Layer } from "./Layer";

interface Entry {
  name: string;
  position: number;
  score: string;
  gold: string;
  deltaGold: string;
  troops: string;
  citys: string;
  ports: string;
  isMyPlayer: boolean;
  player: PlayerView;
}

export class GoToPlayerEvent implements GameEvent {
  constructor(public player: PlayerView) {}
}

export class GoToPositionEvent implements GameEvent {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class GoToUnitEvent implements GameEvent {
  constructor(public unit: UnitView) {}
}

@customElement("leader-board")
export class Leaderboard extends LitElement implements Layer {
  public game: GameView | null = null;
  public clientID: ClientID | null = null;
  public eventBus: EventBus | null = null;

  players: Entry[] = [];
  private playerGoldHistory: Map<number, bigint[]> = new Map();
  private maxHistoryLength = 10;
  private playerDeltaGold: Map<number, number> = new Map();

  @state()
  private _leaderboardHidden = true;
  private _shownOnInit = false;
  private showTopFive = true;
  private sortBy: string = "Owned";

  init() {}

  tick() {
    if (this.game === null) throw new Error("Not initialized");
    if (!this._shownOnInit && !this.game.inSpawnPhase()) {
      this._shownOnInit = true;
      this.showLeaderboard();
      this.updateLeaderboard();
    }
    if (this._leaderboardHidden) {
      return;
    }

    if (this.game.ticks() % 10 === 0) {
      const sorted = this.game
        .playerViews()
        .filter((player) => player.isAlive());

      sorted.forEach((player) => {
        const currentGold = player.gold();
        const smallID = player.smallID();

        if (!this.playerGoldHistory.has(smallID)) {
          this.playerGoldHistory.set(smallID, [currentGold]);
          this.playerDeltaGold.set(smallID, 0);
        } else {
          const history = this.playerGoldHistory.get(smallID)!;
          if (history.length >= this.maxHistoryLength) {
            history.shift();
          }
          history.push(currentGold);

          let deltaGold = 0;
          if (history.length > 1) {
            deltaGold =
              Number(history[history.length - 1] - history[0]) /
              (history.length - 1);
          }
          this.playerDeltaGold.set(smallID, deltaGold);
        }
      });

      this.updateLeaderboard();
    }
  }

  private updateLeaderboard() {
    if (this.game === null) throw new Error("Not initialized");
    if (this.clientID === null) {
      return;
    }
    const myPlayer =
      this.game.playerViews().find((p) => p.clientID() === this.clientID) ??
      null;

    const sorted = this.game.playerViews().filter((player) => player.isAlive());
    switch (this.sortBy) {
      case "Owned":
        sorted.sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
        break;
      case "Gold":
        sorted.sort((a, b) => Number(b.gold() - a.gold()));
        break;
      case "ΔG":
        sorted.sort((a, b) => {
          const aDeltaGold = this.playerDeltaGold.get(a.smallID()) || 0;
          const bDeltaGold = this.playerDeltaGold.get(b.smallID()) || 0;
          return bDeltaGold - aDeltaGold;
        });
        break;
      case "Troops":
        sorted.sort((a, b) => b.troops() - a.troops());
        break;
      case "Citys":
        sorted.sort(
          (a, b) =>
            b.units(UnitType.City).length - a.units(UnitType.City).length,
        );
        break;
      case "Ports":
        sorted.sort(
          (a, b) =>
            b.units(UnitType.Port).length - a.units(UnitType.Port).length,
        );
        break;
    }

    const numTilesWithoutFallout =
      this.game.numLandTiles() - this.game.numTilesWithFallout();

    const playersToShow = this.showTopFive ? sorted.slice(0, 5) : sorted;

    this.players = playersToShow.map((player, index) => {
      const troops = player.troops() / 10;
      const citys = player.units(UnitType.City).length;
      const ports = player.units(UnitType.Port).length;

      const deltaGold = this.playerDeltaGold.get(player.smallID()) || 0;

      return {
        name: player.displayName(),
        position: index + 1,
        score: formatPercentage(
          player.numTilesOwned() / numTilesWithoutFallout,
        ),
        gold: renderNumber(player.gold()),
        deltaGold: renderNumber(deltaGold),
        troops: renderNumber(troops),
        citys: renderNumber(citys),
        ports: renderNumber(ports),
        isMyPlayer: player === myPlayer,
        player: player,
      };
    });

    if (
      myPlayer !== null &&
      this.players.find((p) => p.isMyPlayer) === undefined &&
      myPlayer.isAlive()
    ) {
      let place = 0;
      for (const p of sorted) {
        place++;
        if (p === myPlayer) {
          break;
        }
      }

      const deltaGold = this.playerDeltaGold.get(myPlayer.smallID()) || 0;

      const myPlayerTroops = myPlayer.troops() / 10;
      const citys = myPlayer.units(UnitType.City).length;
      const ports = myPlayer.units(UnitType.Port).length;
      this.players.pop();
      this.players.push({
        name: myPlayer.displayName(),
        position: place,
        score: formatPercentage(
          myPlayer.numTilesOwned() / this.game.numLandTiles(),
        ),
        gold: renderNumber(myPlayer.gold()),
        deltaGold: renderNumber(deltaGold),
        troops: renderNumber(myPlayerTroops),
        citys: renderNumber(citys),
        ports: renderNumber(ports),
        isMyPlayer: true,
        player: myPlayer,
      });
    }

    this.requestUpdate();
  }

  private handleRowClickPlayer(player: PlayerView) {
    if (this.eventBus === null) return;
    this.eventBus.emit(new GoToPlayerEvent(player));
  }

  private handleHeaderClick(column: string) {
    if (
      column === "Rank" ||
      column === "Player" ||
      column === "Owned" ||
      this.sortBy === column
    ) {
      this.sortBy = "Owned";
    } else {
      this.sortBy = column;
    }

    this.updateLeaderboard();
  }

  renderLayer(context: CanvasRenderingContext2D) {}
  shouldTransform(): boolean {
    return false;
  }

  static styles = css`
    :host {
      display: block;
    }
    img.emoji {
      height: 0.8em;
      width: auto;
    }
    .leaderboard {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 9998;
      background-color: rgb(31 41 55 / 0.7);
      padding: 10px;
      padding-top: 0px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      border-radius: 10px;
      max-height: 40vh;
      overflow-y: auto;
      width: 400px;
      backdrop-filter: blur(5px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 4px;
      text-align: center;
      border-bottom: 1px solid rgba(51, 51, 51, 0.2);
      color: white;
    }
    th {
      background-color: rgb(31 41 55 / 0.5);
      color: white;
      font-size: 0.8em;
      cursor: pointer;
    }
    .sorted-header {
      color: #53ac75 !important;
    }
    .myPlayer {
      font-weight: bold;
      font-size: 0.8em;
    }
    .otherPlayer {
      font-size: 0.8em;
    }
    tr:nth-child(even) {
      background-color: rgb(31 41 55 / 0.5);
    }
    tbody tr {
      cursor: pointer;
      transition: background-color 0.2s;
    }
    tbody tr:hover {
      background-color: rgba(78, 78, 78, 0.8);
    }
    .hidden {
      display: none !important;
    }
    .leaderboard-button {
      position: fixed;
      left: 10px;
      top: 10px;
      z-index: 9998;
      background-color: rgb(31 41 55 / 0.7);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
    }

    .leaderboard-close-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
    }

    .leaderboard-top-five-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
    }

    .player-name {
      max-width: 10ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 1000px) {
      .leaderboard {
        top: 70px;
        left: 0px;
      }

      .leaderboard-button {
        left: 0px;
        top: 52px;
      }
    }
  `;

  render() {
    return html`
      <button
        @click=${() => this.toggleLeaderboard()}
        class="leaderboard-button ${this._shownOnInit && this._leaderboardHidden
          ? ""
          : "hidden"}"
      >
        ${translateText("leaderboard.title")}
      </button>
      <div
        class="leaderboard ${this._leaderboardHidden ? "hidden" : ""}"
        @contextmenu=${(e) => e.preventDefault()}
      >
        <button
          class="leaderboard-close-button"
          @click=${() => this.hideLeaderboard()}
        >
          ${translateText("leaderboard.hide")}
        </button>
        <button
          class="leaderboard-top-five-button"
          @click=${() => {
            this.showTopFive = !this.showTopFive;
            this.updateLeaderboard();
          }}
        >
          ${this.showTopFive ? "Show All" : "Show Top 5"}
        </button>
        <table>
          <thead>
            <tr>
              <th @click=${() => this.handleHeaderClick("Rank")}>
                ${translateText("leaderboard.rank")}
              </th>
              <th @click=${() => this.handleHeaderClick("Player")}>
                ${translateText("leaderboard.player")}
              </th>
              <th @click=${() => this.handleHeaderClick("Owned")}>
                ${translateText("leaderboard.owned")}
              </th>
              <th
                @click=${() => this.handleHeaderClick("Gold")}
                class="${this.sortBy === "Gold" ? "sorted-header" : ""}"
              >
                ${translateText("leaderboard.gold")}
              </th>
              <th
                @click=${() => this.handleHeaderClick("ΔG")}
                class="${this.sortBy === "ΔG" ? "sorted-header" : ""}"
              >
                ΔG
              </th>
              <th
                @click=${() => this.handleHeaderClick("Troops")}
                class="${this.sortBy === "Troops" ? "sorted-header" : ""}"
              >
                ${translateText("leaderboard.troops")}
              </th>
              <th
                @click=${() => this.handleHeaderClick("Citys")}
                class="${this.sortBy === "Citys" ? "sorted-header" : ""}"
              >
                Citys
              </th>
              <th
                @click=${() => this.handleHeaderClick("Ports")}
                class="${this.sortBy === "Ports" ? "sorted-header" : ""}"
              >
                Ports
              </th>
            </tr>
          </thead>
          <tbody>
            ${this.players.map(
              (player) => html`
                <tr
                  class="${player.isMyPlayer ? "myPlayer" : "otherPlayer"}"
                  @click=${() => this.handleRowClickPlayer(player.player)}
                >
                  <td>${player.position}</td>
                  <td class="player-name">${unsafeHTML(player.name)}</td>
                  <td>${player.score}</td>
                  <td>${player.gold}</td>
                  <td>${player.deltaGold}</td>
                  <td>${player.troops}</td>
                  <td>${player.citys}</td>
                  <td>${player.ports}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  toggleLeaderboard() {
    this._leaderboardHidden = !this._leaderboardHidden;
    this.requestUpdate();
  }

  hideLeaderboard() {
    this._leaderboardHidden = true;
    this.requestUpdate();
  }

  showLeaderboard() {
    this._leaderboardHidden = false;
    this.requestUpdate();
  }

  get isVisible() {
    return !this._leaderboardHidden;
  }
}

function formatPercentage(value: number): string {
  const perc = value * 100;
  if (perc > 99.5) {
    return "100%";
  }
  if (perc < 0.01) {
    return "0%";
  }
  if (perc < 0.1) {
    return perc.toPrecision(1) + "%";
  }
  return perc.toPrecision(2) + "%";
}
