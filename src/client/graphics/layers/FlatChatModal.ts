import { LitElement, css, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { PlayerType } from "../../../core/game/Game";
import { GameView, PlayerView } from "../../../core/game/GameView";

import quickChatData from "../../../../resources/QuickChat.json";
import { EventBus } from "../../../core/EventBus";
import { SendQuickChatEvent } from "../../Transport";
import { translateText } from "../../Utils";

type QuickChatPhrase = {
  key: string;
  requiresPlayer: boolean;
};

type QuickChatPhrases = Record<string, QuickChatPhrase[]>;

const quickChatPhrases: QuickChatPhrases = quickChatData;

@customElement("flat-chat-modal")
export class FlatChatModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    :host .c-modal__header {
      padding: 0.5rem 2.4rem 0.5rem 1.4rem;
    }

    .chat-columns {
      display: flex;
      gap: 8px;
      padding: 12px;
      overflow-x: auto;
    }

    .chat-column {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 140px;
    }

    .column-title {
      font-weight: bold;
      margin-bottom: 4px;
    }

    .chat-option-button {
      background: #333;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      text-align: left;
      cursor: pointer;
      font-size: 16px;
    }

    .chat-option-button.selected {
      background-color: #66c;
    }

    .player-search-input {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid #666;
      font-size: 14px;
      outline: none;
      background-color: #fff;
      color: #000;
    }

    .player-scroll-area {
      max-height: 320px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-right: 4px;
    }

    .phrase-scroll-area {
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-right: 4px;
    }
  `;

  @query("o-modal") private modalEl!: HTMLElement & {
    open: () => void;
    close: () => void;
  };

  private selectedPhraseData: {
    category: string;
    key: string;
    text: string;
    template: string;
    requiresPlayer: boolean;
  } | null = null;

  private selectedPlayer: PlayerView | null = null;
  private playerSearchQuery: string = "";
  private players: PlayerView[] = [];

  private recipient: PlayerView;
  private sender: PlayerView;
  public eventBus: EventBus;
  public g: GameView;

  private categories = [{ id: "help" }, { id: "attack" }, { id: "defend" }];

  private getPhrasesForCategory(categoryId: string) {
    return quickChatPhrases[categoryId] ?? [];
  }

  render() {
    return html`
      <o-modal title="${translateText("chat.title")}">
        <div class="chat-columns">
          ${this.categories.map(
            (category) => html`
              <div class="chat-column">
                <div class="column-title">
                  ${translateText(`chat.cat.${category.id}`)}
                </div>
                <div class="phrase-scroll-area">
                  ${this.getPhrasesForCategory(category.id).map(
                    (phrase) => html`
                      <button
                        class="chat-option-button ${this.selectedPhraseData
                          ?.category === category.id &&
                        this.selectedPhraseData?.key === phrase.key
                          ? "selected"
                          : ""}"
                        @click=${() => this.selectPhrase(category.id, phrase)}
                      >
                        ${translateText(`chat.${category.id}.${phrase.key}`)}
                      </button>
                    `,
                  )}
                </div>
              </div>
            `,
          )}

          <div class="chat-column">
            <div class="column-title">${translateText("chat.player")}</div>
            <input
              class="player-search-input"
              type="text"
              placeholder="${translateText("chat.search")}"
              .value=${this.playerSearchQuery}
              @input=${this.onPlayerSearchInput}
            />
            <div class="player-scroll-area">
              ${this.getSortedFilteredPlayers().map(
                (player) => html`
                  <button
                    class="chat-option-button ${this.selectedPlayer === player
                      ? "selected"
                      : ""}"
                    @click=${() => this.selectPlayer(player)}
                  >
                    ${player.name()}
                  </button>
                `,
              )}
            </div>
          </div>
        </div>
      </o-modal>
    `;
  }

  private checkAndSendIfReady() {
    if (!this.selectedPhraseData) return;

    if (this.selectedPhraseData.requiresPlayer && !this.selectedPlayer) {
      return; // 等待用户选择玩家
    }

    this.sendChatMessage();
  }

  private selectPhrase(category: string, phrase: QuickChatPhrase) {
    const text = translateText(`chat.${category}.${phrase.key}`);
    this.selectedPhraseData = {
      category,
      key: phrase.key,
      text,
      template: text,
      requiresPlayer: phrase.requiresPlayer,
    };
    this.requestUpdate();
    this.checkAndSendIfReady();
  }

  public selectPlayer(player: PlayerView) {
    this.selectedPlayer = player;
    this.requestUpdate();
    this.checkAndSendIfReady();
  }

  private sendChatMessage() {
    if (this.sender && this.recipient && this.selectedPhraseData) {
      this.eventBus.emit(
        new SendQuickChatEvent(
          this.recipient,
          `${this.selectedPhraseData.category}.${this.selectedPhraseData.key}`,
          this.selectedPlayer?.id(),
        ),
      );
    }

    this.selectedPhraseData = null;
    this.selectedPlayer = null;
    this.close();
    this.requestUpdate();
  }

  private onPlayerSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.playerSearchQuery = target.value.toLowerCase();
    this.requestUpdate();
  }

  private getSortedFilteredPlayers(): PlayerView[] {
    const sorted = [...this.players].sort((a, b) =>
      a.name().localeCompare(b.name()),
    );
    const filtered = sorted.filter((p) =>
      p.name().toLowerCase().includes(this.playerSearchQuery),
    );
    const others = sorted.filter(
      (p) => !p.name().toLowerCase().includes(this.playerSearchQuery),
    );
    return [...filtered, ...others];
  }

  public open(sender?: PlayerView, recipient?: PlayerView) {
    if (sender && recipient) {
      this.players = this.g
        .players()
        .filter((p) => p.isAlive() && p.data.playerType !== PlayerType.Bot);

      this.recipient = recipient;
      this.sender = sender;
    }
    this.requestUpdate();
    this.modalEl?.open();
  }

  public close() {
    this.selectedPhraseData = null;
    this.selectedPlayer = null;
    this.modalEl?.close();
  }
}
