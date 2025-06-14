import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { DirectiveResult } from "lit/directive.js";
import { unsafeHTML, UnsafeHTMLDirective } from "lit/directives/unsafe-html.js";
import allianceIcon from "../../../../resources/images/AllianceIconWhite.svg";
import warshipIcon from "../../../../resources/images/BattleshipIconWhite.svg";
import boatIcon from "../../../../resources/images/BoatIconWhite.svg";
import cityIcon from "../../../../resources/images/CityIconWhite.svg";
import donateGoldIcon from "../../../../resources/images/DonateGoldIconWhite.svg";
import donateTroopIcon from "../../../../resources/images/DonateTroopIconWhite.svg";
import goldCoinIcon from "../../../../resources/images/GoldCoinIcon.svg";
import mirvIcon from "../../../../resources/images/MIRVIcon.svg";
import missileSiloIcon from "../../../../resources/images/MissileSiloIconWhite.svg";
import hydrogenBombIcon from "../../../../resources/images/MushroomCloudIconWhite.svg";
import atomBombIcon from "../../../../resources/images/NukeIconWhite.svg";
import portIcon from "../../../../resources/images/PortIcon.svg";
import samlauncherIcon from "../../../../resources/images/SamLauncherIconWhite.svg";
import shieldIcon from "../../../../resources/images/ShieldIconWhite.svg";
import targetIcon from "../../../../resources/images/TargetIconWhite.svg";
import traitorIcon from "../../../../resources/images/TraitorIconWhite.svg";
import { EventBus } from "../../../core/EventBus";
import {
  AllPlayers,
  MessageType,
  PlayerType,
  Tick,
  UnitType,
} from "../../../core/game/Game";
import {
  AllianceExpiredUpdate,
  AllianceRequestReplyUpdate,
  AllianceRequestUpdate,
  AttackUpdate,
  BrokeAllianceUpdate,
  DisplayChatMessageUpdate,
  DisplayMessageUpdate,
  EmojiUpdate,
  GameUpdateType,
  TargetPlayerUpdate,
  UnitIncomingUpdate,
} from "../../../core/game/GameUpdates";
import { ClientID } from "../../../core/Schemas";
import {
  CancelAttackIntentEvent,
  CancelBoatIntentEvent,
  SendAllianceReplyIntentEvent,
} from "../../Transport";
import { Layer } from "./Layer";

import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { renderTroops } from "../../Utils";
import {
  GoToPlayerEvent,
  GoToPositionEvent,
  GoToUnitEvent,
} from "./Leaderboard";

import { translateText } from "../../Utils";

interface Event {
  description: string;
  unsafeDescription?: boolean;
  buttons?: {
    text: string;
    className: string;
    action: () => void;
    preventClose?: boolean;
  }[];
  type: MessageType;
  highlight?: boolean;
  createdAt: number;
  onDelete?: () => void;
  // lower number: lower on the display
  priority?: number;
  duration?: Tick;
  focusID?: number;
  unitView?: UnitView;
}

@customElement("events-display")
export class EventsDisplay extends LitElement implements Layer {
  public eventBus: EventBus;
  public game: GameView;
  public clientID: ClientID;

  private active: boolean = false;
  private events: Event[] = [];
  @state() private incomingAttacks: AttackUpdate[] = [];
  @state() private outgoingAttacks: AttackUpdate[] = [];
  @state() private outgoingLandAttacks: AttackUpdate[] = [];
  @state() private outgoingBoats: UnitView[] = [];
  @state() private _hidden: boolean = false;
  @state() private newEvents: number = 0;

  private toggleHidden() {
    this._hidden = !this._hidden;
    if (this._hidden) {
      this.newEvents = 0;
    }
    this.requestUpdate();
  }

  private updateMap = new Map([
    [GameUpdateType.DisplayEvent, (u) => this.onDisplayMessageEvent(u)],
    [GameUpdateType.DisplayChatEvent, (u) => this.onDisplayChatEvent(u)],
    [GameUpdateType.AllianceRequest, (u) => this.onAllianceRequestEvent(u)],
    [
      GameUpdateType.AllianceRequestReply,
      (u) => this.onAllianceRequestReplyEvent(u),
    ],
    [GameUpdateType.BrokeAlliance, (u) => this.onBrokeAllianceEvent(u)],
    [GameUpdateType.TargetPlayer, (u) => this.onTargetPlayerEvent(u)],
    [GameUpdateType.Emoji, (u) => this.onEmojiMessageEvent(u)],
    [GameUpdateType.UnitIncoming, (u) => this.onUnitIncomingEvent(u)],
  ]);

  private readonly unitIconMap = new Map<string, string>([
    ["Transport", boatIcon],
    ["Warship", warshipIcon],
    ["Port", portIcon],
    ["Trade Ship", goldCoinIcon],
    ["Missile Silo", missileSiloIcon],
    ["Defense Post", shieldIcon],
    ["SAM Launcher", samlauncherIcon],
    ["City", cityIcon],
  ]);

  private readonly templateMap: Map<
    RegExp,
    {
      format: (matches: RegExpExecArray, type: MessageType) => string;
      priority: number;
      duration: number;
    }
  > = new Map([
    [
      /Conquered (.+) received (.+) gold/,
      {
        format: (matches, type) => `${matches[2]} 💰 (conquer ${matches[1]})`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /Captured (.+) from (.+)/,
      {
        format: (matches, type) =>
          `Captured ${this.unitIconMap.has(matches[1]) ? this.getImgTag(this.unitIconMap.get(matches[1])!, type) : matches[1]} from ${matches[2]}`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /Naval invasion incoming from (.+)/,
      {
        format: (matches, type) =>
          `${matches[1]} ${this.getImgTag(boatIcon, type)}`,
        priority: 10,
        duration: 100,
      },
    ],
    [
      /Received (.+) gold from trade with (.+)/,
      {
        format: (matches, type) => `${matches[1]} 💰 (trade ${matches[2]})`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /Received (.+) gold from ship captured from (.+)/,
      {
        format: (matches, type) => `${matches[1]} 💰 (hijack ${matches[2]})`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /(.+) - atom bomb inbound/,
      {
        format: (matches, type) =>
          `${matches[1]} ${this.getImgTag(atomBombIcon, type)}`,
        priority: 10,
        duration: 100,
      },
    ],
    [
      /Your (.+) was destroyed/,
      {
        format: (matches, type) =>
          `${this.unitIconMap.has(matches[1]) ? this.getImgTag(this.unitIconMap.get(matches[1])!, type) : matches[1]} destroyed`,
        priority: 20,
        duration: 50,
      },
    ],
    [
      /(.+) - hydrogen bomb inbound/,
      {
        format: (matches, type) =>
          `${matches[1]} ${this.getImgTag(hydrogenBombIcon, type)}`,
        priority: 10,
        duration: 100,
      },
    ],
    [
      /Sent (.+) troops to (.+)/,
      {
        format: (matches, type) =>
          `${matches[1]} ${this.getImgTag(donateTroopIcon, type)} to ${matches[2]}`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /Received (.+) troops from (.+)/,
      {
        format: (matches, type) =>
          `${matches[2]} ${this.getImgTag(donateTroopIcon, type)} ${matches[1]}`,
        priority: 20,
        duration: 100,
      },
    ],
    [
      /⚠️⚠️⚠️ (.+) - MIRV INBOUND ⚠️⚠️⚠️/,
      {
        format: (matches, type) =>
          `⚠️${matches[1]} ${this.getImgTag(mirvIcon, type)}⚠️`,
        priority: 10,
        duration: 100,
      },
    ],
    [
      /Attack cancelled, (.+) soldiers killed during retreat./,
      {
        format: (matches, type) => `Retreated (${matches[1]} died)`,
        priority: 100000,
        duration: 50,
      },
    ],
    [
      /Missile intercepted (.+)/,
      {
        format: (matches, type) =>
          `Downed ${this.unitIconMap.has(matches[1]) ? this.getImgTag(this.unitIconMap.get(matches[1])!, type) : matches[1]}`,
        priority: 30,
        duration: 30,
      },
    ],
    [
      /Sent (.+) gold to (.+)/,
      {
        format: (matches, type) =>
          `${matches[1]} ${this.getImgTag(donateGoldIcon, type)} to ${matches[2]}`,
        priority: 100000,
        duration: 30,
      },
    ],
    [
      /Received (.+) gold from (.+)/,
      {
        format: (matches, type) =>
          `${matches[2]} ${this.getImgTag(donateGoldIcon, type)} ${matches[1]}`,
        priority: 20,
        duration: 100,
      },
    ],
    [
      /No boats available, max (.+)/,
      {
        format: (matches, type) => `No boats available (max ${matches[1]})`,
        priority: 20,
        duration: 20,
      },
    ],
    [
      /Missile failed to intercept (.+)/,
      {
        format: (matches, type) =>
          `Missed ${this.unitIconMap.has(matches[1]) ? this.getImgTag(this.unitIconMap.get(matches[1])!, type) : matches[1]}`,
        priority: 30,
        duration: 50,
      },
    ],
    [
      /(.+) MIRV warheads intercepted/,
      {
        format: (matches, type) =>
          `Downed ${matches[1]} ${this.getImgTag(mirvIcon, type)}`,
        priority: 30,
        duration: 30,
      },
    ],
    [
      /Your (.+) was captured by (.+)/,
      {
        format: (matches, type) =>
          `Lost ${this.unitIconMap.has(matches[1]) ? this.getImgTag(this.unitIconMap.get(matches[1])!, type) : matches[1]} to ${matches[2]}`,
        priority: 20,
        duration: 50,
      },
    ],
  ]);

  constructor() {
    super();
    this.events = [];
    this.incomingAttacks = [];
    this.outgoingAttacks = [];
    this.outgoingBoats = [];
  }

  init() {}

  tick() {
    this.active = true;
    const updates = this.game.updatesSinceLastTick();
    if (updates) {
      for (const [ut, fn] of this.updateMap) {
        updates[ut]?.forEach(fn);
      }
    }

    let remainingEvents = this.events.filter((event) => {
      const shouldKeep =
        this.game.ticks() - event.createdAt < (event.duration ?? 600);
      if (!shouldKeep && event.onDelete) {
        event.onDelete();
      }
      return shouldKeep;
    });

    if (remainingEvents.length > 50) {
      remainingEvents = remainingEvents.slice(-50);
    }

    if (this.events.length !== remainingEvents.length) {
      this.events = remainingEvents;
      this.requestUpdate();
    }

    const myPlayer = this.game.myPlayer();
    if (!myPlayer) {
      return;
    }

    // Update attacks
    this.incomingAttacks = myPlayer.incomingAttacks().filter((a) => {
      const t = (this.game.playerBySmallID(a.attackerID) as PlayerView).type();
      return t !== PlayerType.Bot;
    });

    this.outgoingAttacks = myPlayer
      .outgoingAttacks()
      .filter((a) => a.targetID !== 0);

    this.outgoingLandAttacks = myPlayer
      .outgoingAttacks()
      .filter((a) => a.targetID === 0);

    this.outgoingBoats = myPlayer
      .units()
      .filter((u) => u.type() === UnitType.TransportShip);

    this.requestUpdate();
  }

  private addEvent(event: Event) {
    this.events = [...this.events, event];
    if (this._hidden === true) {
      this.newEvents++;
    }
    this.requestUpdate();
  }

  private removeEvent(index: number) {
    this.events = [
      ...this.events.slice(0, index),
      ...this.events.slice(index + 1),
    ];
  }

  shouldTransform(): boolean {
    return false;
  }

  renderLayer(): void {}

  onDisplayMessageEvent(event: DisplayMessageUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (
      event.playerID !== null &&
      (!myPlayer || myPlayer.smallID() !== event.playerID)
    ) {
      return;
    }

    let message = event.message;
    let priority = 100000;
    let duration = 600;

    for (const [pattern, template] of this.templateMap) {
      const matches = pattern.exec(message);
      if (matches) {
        message = template.format(matches, event.messageType);
        priority = template.priority;
        duration = template.duration;
      }
    }

    this.addEvent({
      description: message,
      createdAt: this.game.ticks(),
      highlight: true,
      type: event.messageType,
      priority: priority,
      duration: duration,
      unsafeDescription: true,
    });
  }

  private getImgTag(icon: string, type: MessageType): string {
    return `<img src="${icon}" style="height: 1.2em; width: 1.2em; vertical-align: -0.2em; display: inline-block; stroke: blue; filter: ${this.getIconColorFilter(type)};"/>`;
  }

  onDisplayChatEvent(event: DisplayChatMessageUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (
      event.playerID === null ||
      !myPlayer ||
      myPlayer.smallID() !== event.playerID
    ) {
      return;
    }

    const baseMessage = translateText(`chat.${event.category}.${event.key}`);
    let translatedMessage = baseMessage;
    if (event.target) {
      try {
        const targetPlayer = this.game.player(event.target);
        const targetName = targetPlayer?.name() ?? event.target;
        translatedMessage = baseMessage.replace("[P1]", targetName);
      } catch (e) {
        console.warn(
          `Failed to resolve player for target ID '${event.target}'`,
          e,
        );
        return;
      }
    }

    this.addEvent({
      description: translateText(event.isFrom ? "chat.from" : "chat.to", {
        user: event.recipient,
        msg: translatedMessage,
      }),
      createdAt: this.game.ticks(),
      highlight: true,
      type: MessageType.CHAT,
      priority: 30,
      duration: 80,
      unsafeDescription: false,
    });
  }

  onAllianceRequestEvent(update: AllianceRequestUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer || update.recipientID !== myPlayer.smallID()) {
      return;
    }

    const requestor = this.game.playerBySmallID(
      update.requestorID,
    ) as PlayerView;
    const recipient = this.game.playerBySmallID(
      update.recipientID,
    ) as PlayerView;

    this.addEvent({
      description: `${requestor.name()} request ${this.getImgTag(allianceIcon, MessageType.INFO)}`,
      buttons: [
        {
          text: "Focus",
          className: "btn-gray",
          action: () => this.eventBus.emit(new GoToPlayerEvent(requestor)),
          preventClose: true,
        },
        {
          text: "Accept",
          className: "btn",
          action: () =>
            this.eventBus.emit(
              new SendAllianceReplyIntentEvent(requestor, recipient, true),
            ),
        },
        {
          text: "Reject",
          className: "btn-info",
          action: () =>
            this.eventBus.emit(
              new SendAllianceReplyIntentEvent(requestor, recipient, false),
            ),
        },
      ],
      highlight: true,
      type: MessageType.INFO,
      createdAt: this.game.ticks(),
      onDelete: () =>
        this.eventBus.emit(
          new SendAllianceReplyIntentEvent(requestor, recipient, false),
        ),
      priority: 0,
      duration: this.game.config().allianceRequestCooldown(),
      focusID: update.requestorID,
      unsafeDescription: true,
    });
  }

  onAllianceRequestReplyEvent(update: AllianceRequestReplyUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer || update.request.requestorID !== myPlayer.smallID()) {
      return;
    }

    const recipient = this.game.playerBySmallID(
      update.request.recipientID,
    ) as PlayerView;

    const type = update.accepted ? MessageType.SUCCESS : MessageType.ERROR;

    this.addEvent({
      description: `${recipient.name()} ${this.getImgTag(allianceIcon, type)} ${
        update.accepted ? "accepted" : "rejected"
      }`,
      type: type,
      highlight: true,
      createdAt: this.game.ticks(),
      priority: 10,
      duration: 50,
      focusID: update.request.recipientID,
      unsafeDescription: true,
    });
  }

  onBrokeAllianceEvent(update: BrokeAllianceUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer) return;

    const betrayed = this.game.playerBySmallID(update.betrayedID) as PlayerView;
    const traitor = this.game.playerBySmallID(update.traitorID) as PlayerView;

    if (!betrayed.isTraitor() && traitor === myPlayer) {
      const malusPercent = Math.round(
        (1 - this.game.config().traitorDefenseDebuff()) * 100,
      );

      const traitorDuration = Math.floor(
        this.game.config().traitorDuration() * 0.1,
      );
      const durationText =
        traitorDuration === 1 ? "1 second" : `${traitorDuration} seconds`;

      const duration = this.game.config().traitorDuration() / 10;
      this.addEvent({
        description:
          `${this.getImgTag(traitorIcon, MessageType.ERROR)} ${betrayed.name()} ` +
          `(TRAITOR: ${malusPercent}% defense debuff for ${duration}s)`,
        type: MessageType.ERROR,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.betrayedID,
        priority: 100000,
        duration: 20,
        unsafeDescription: true,
      });
    } else if (betrayed === myPlayer) {
      this.addEvent({
        description: `${traitor.name()} ${this.getImgTag(traitorIcon, MessageType.ERROR)}`,
        type: MessageType.ERROR,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.traitorID,
        priority: 10,
        duration: 50,
        unsafeDescription: true,
      });
    }
  }

  onAllianceExpiredEvent(update: AllianceExpiredUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer) return;

    const otherID =
      update.player1ID === myPlayer.smallID()
        ? update.player2ID
        : update.player2ID === myPlayer.smallID()
          ? update.player1ID
          : null;
    if (otherID === null) return;
    const other = this.game.playerBySmallID(otherID) as PlayerView;
    if (!other || !myPlayer.isAlive() || !other.isAlive()) return;

    this.addEvent({
      description: `Your alliance with ${other.name()} expired`,
      type: MessageType.WARN,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: otherID,
      priority: 10,
      duration: 50,
      unsafeDescription: true,
    });
  }

  onTargetPlayerEvent(event: TargetPlayerUpdate) {
    const other = this.game.playerBySmallID(event.playerID) as PlayerView;
    const myPlayer = this.game.playerByClientID(this.clientID) as PlayerView;
    if (!myPlayer || !myPlayer.isFriendly(other)) return;

    const target = this.game.playerBySmallID(event.targetID) as PlayerView;

    this.addEvent({
      description: `${other.name()} ${this.getImgTag(targetIcon, MessageType.INFO)} ${target.name()}`,
      type: MessageType.INFO,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: event.targetID,
      priority: 20,
      duration: 50,
      unsafeDescription: true,
    });
  }

  emitCancelAttackIntent(id: string) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer) return;
    this.eventBus.emit(new CancelAttackIntentEvent(id));
  }

  emitBoatCancelIntent(id: number) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer) return;
    this.eventBus.emit(new CancelBoatIntentEvent(id));
  }

  emitGoToPlayerEvent(attackerID: number) {
    const attacker = this.game.playerBySmallID(attackerID) as PlayerView;
    if (!attacker) return;
    this.eventBus.emit(new GoToPlayerEvent(attacker));
  }

  emitGoToPositionEvent(x: number, y: number) {
    this.eventBus.emit(new GoToPositionEvent(x, y));
  }

  emitGoToUnitEvent(unit: UnitView) {
    this.eventBus.emit(new GoToUnitEvent(unit));
  }

  onEmojiMessageEvent(update: EmojiUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);
    if (!myPlayer) return;

    const recipient =
      update.emoji.recipientID === AllPlayers
        ? AllPlayers
        : this.game.playerBySmallID(update.emoji.recipientID);
    const sender = this.game.playerBySmallID(
      update.emoji.senderID,
    ) as PlayerView;

    if (recipient === myPlayer) {
      this.addEvent({
        description: `${sender.displayName()}: ${update.emoji.message}`,
        unsafeDescription: true,
        type: MessageType.INFO,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.emoji.senderID,
        priority: 30,
        duration: 80,
      });
    } else if (sender === myPlayer && recipient !== AllPlayers) {
      this.addEvent({
        description: `${
          update.emoji.message
        } to ${(recipient as PlayerView).displayName()}`,
        unsafeDescription: true,
        type: MessageType.INFO,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: recipient.smallID(),
        priority: 100000,
        duration: 20,
      });
    }
  }

  onUnitIncomingEvent(event: UnitIncomingUpdate) {
    const myPlayer = this.game.playerByClientID(this.clientID);

    if (!myPlayer || myPlayer.smallID() !== event.playerID) {
      return;
    }

    const unitView = this.game.unit(event.unitID);

    let message = event.message;
    let priority = 100000;
    let duration = 600;

    for (const [pattern, template] of this.templateMap) {
      const matches = pattern.exec(message);
      if (matches) {
        message = template.format(matches, event.messageType);
        priority = template.priority;
        duration = template.duration;
      }
    }

    this.addEvent({
      description: message,
      type: event.messageType,
      unsafeDescription: true,
      highlight: true,
      createdAt: this.game.ticks(),
      priority: priority,
      duration: duration,
      unitView: unitView,
    });
  }

  private getMessageTypeClasses(type: MessageType): string {
    switch (type) {
      case MessageType.SUCCESS:
        return "text-green-300";
      case MessageType.INFO:
        return "text-gray-200";
      case MessageType.CHAT:
        return "text-gray-200";
      case MessageType.WARN:
        return "text-yellow-300";
      case MessageType.ERROR:
        return "text-red-300";
      default:
        return "text-white";
    }
  }

  private getIconColorFilter(type: MessageType): string {
    switch (type) {
      case MessageType.SUCCESS:
        // text-green-300
        return "brightness(0) saturate(100%) invert(87%) sepia(12%) saturate(1188%) hue-rotate(101deg) brightness(92%) contrast(96%)";
      case MessageType.INFO:
        // text-gray-200
        return "brightness(0) saturate(100%) invert(93%) sepia(8%) saturate(169%) hue-rotate(177deg) brightness(95%) contrast(92%)";
      case MessageType.WARN:
        // text-yellow-300
        return "brightness(0) saturate(100%) invert(85%) sepia(22%) saturate(5017%) hue-rotate(10deg) brightness(103%) contrast(101%)";
      case MessageType.ERROR:
        // text-red-300
        return "brightness(0) saturate(100%) invert(72%) sepia(32%) saturate(845%) hue-rotate(314deg) brightness(103%) contrast(103%)";
      default:
        // text-white
        return "brightness(0) saturate(100%) invert(100%)";
    }
  }

  private getEventDescription(
    event: Event,
  ): string | DirectiveResult<typeof UnsafeHTMLDirective> {
    return event.unsafeDescription
      ? unsafeHTML(event.description)
      : event.description;
  }

  private async attackWarningOnClick(attack: AttackUpdate) {
    const playerView = this.game.playerBySmallID(attack.attackerID);
    if (playerView !== undefined) {
      if (playerView instanceof PlayerView) {
        const averagePosition = await playerView.attackAveragePosition(
          attack.attackerID,
          attack.id,
        );

        if (averagePosition === null) {
          this.emitGoToPlayerEvent(attack.attackerID);
        } else {
          this.emitGoToPositionEvent(averagePosition.x, averagePosition.y);
        }
      }
    } else {
      this.emitGoToPlayerEvent(attack.attackerID);
    }
  }

  private renderIncomingAttacks() {
    return html`
      ${this.incomingAttacks.length > 0
        ? html`
            <tr class="border-t border-gray-700">
              <td class="lg:p-2 p-1 text-left text-red-400">
                ${this.incomingAttacks.map(
                  (attack) => html`
                    <button
                      translate="no"
                      class="ml-2"
                      @click=${() => this.attackWarningOnClick(attack)}
                    >
                      ${renderTroops(attack.troops)}
                      ${(
                        this.game.playerBySmallID(
                          attack.attackerID,
                        ) as PlayerView
                      )?.name()}
                    </button>
                    ${attack.retreating ? "(retreating...)" : ""}
                  `,
                )}
              </td>
            </tr>
          `
        : ""}
    `;
  }

  private renderOutgoingAttacks() {
    return html`
      ${this.outgoingAttacks.length > 0
        ? html`
            <tr class="border-t border-gray-700">
              <td class="lg:p-2 p-1 text-left text-blue-400">
                ${this.outgoingAttacks.map(
                  (attack) => html`
                    <button
                      translate="no"
                      class="ml-2"
                      @click=${async () => this.attackWarningOnClick(attack)}
                    >
                      ${renderTroops(attack.troops)}
                      ${(
                        this.game.playerBySmallID(attack.targetID) as PlayerView
                      )?.name()}
                    </button>

                    ${!attack.retreating
                      ? html`<button
                          ${attack.retreating ? "disabled" : ""}
                          @click=${() => {
                            this.emitCancelAttackIntent(attack.id);
                          }}
                        >
                          ❌
                        </button>`
                      : "(retreating...)"}
                  `,
                )}
              </td>
            </tr>
          `
        : ""}
    `;
  }

  private renderOutgoingLandAttacks() {
    return html`
      ${this.outgoingLandAttacks.length > 0
        ? html`
            <tr class="border-t border-gray-700">
              <td class="lg:p-2 p-1 text-left text-gray-400">
                ${this.outgoingLandAttacks.map(
                  (landAttack) => html`
                    <button translate="no" class="ml-2">
                      ${renderTroops(landAttack.troops)} Wilderness
                    </button>

                    ${!landAttack.retreating
                      ? html`<button
                          ${landAttack.retreating ? "disabled" : ""}
                          @click=${() => {
                            this.emitCancelAttackIntent(landAttack.id);
                          }}
                        >
                          ❌
                        </button>`
                      : "(retreating...)"}
                  `,
                )}
              </td>
            </tr>
          `
        : ""}
    `;
  }

  private renderBoats() {
    return html`
      ${this.outgoingBoats.length > 0
        ? html`
            <tr class="border-t border-gray-700">
              <td class="lg:p-2 p-1 text-left text-blue-400">
                ${this.outgoingBoats.map(
                  (boat) => html`
                    <button
                      translate="no"
                      @click=${() => this.emitGoToUnitEvent(boat)}
                    >
                      Boat: ${renderTroops(boat.troops())}
                    </button>
                    ${!boat.retreating()
                      ? html`<button
                          ${boat.retreating() ? "disabled" : ""}
                          @click=${() => {
                            this.emitBoatCancelIntent(boat.id());
                          }}
                        >
                          ❌
                        </button>`
                      : "(retreating...)"}
                  `,
                )}
              </td>
            </tr>
          `
        : ""}
    `;
  }

  render() {
    if (!this.active) {
      return html``;
    }

    this.events.sort((a, b) => {
      const aPrior = a.priority ?? 100000;
      const bPrior = b.priority ?? 100000;
      if (aPrior === bPrior) {
        return a.createdAt - b.createdAt;
      }
      return bPrior - aPrior;
    });

    return html`
      <div
        class="${this._hidden
          ? "w-fit px-[10px] py-[5px]"
          : ""} rounded-md bg-black bg-opacity-60 relative max-h-[50vh] flex flex-col-reverse overflow-y-auto w-full lg:bottom-2.5 lg:right-2.5 z-50 lg:max-w-[30vw] lg:w-full lg:w-auto"
      >
        <div>
          <div class="w-full bg-black/80 sticky top-0 px-[10px]">
            <button
              class="text-white cursor-pointer pointer-events-auto ${this
                ._hidden
                ? "hidden"
                : ""}"
              @click=${this.toggleHidden}
            >
              Hide
            </button>
          </div>
          <button
            class="text-white cursor-pointer pointer-events-auto ${this._hidden
              ? ""
              : "hidden"}"
            @click=${this.toggleHidden}
          >
            Events
            <span
              class="${this.newEvents
                ? ""
                : "hidden"} inline-block px-2 bg-red-500 rounded-sm"
              >${this.newEvents}</span
            >
          </button>
          <table
            class="w-full border-collapse text-white shadow-lg lg:text-base text-xs ${this
              ._hidden
              ? "hidden"
              : ""}"
            style="pointer-events: auto;"
          >
            <tbody>
              ${this.events.map(
                (event, index) => html`
                  <tr
                    class="border-b border-opacity-0 ${this.getMessageTypeClasses(
                      event.type,
                    )}"
                  >
                    <td class="lg:p-2 p-1 text-left">
                      ${event.focusID
                        ? html`<button
                            @click=${() => {
                              event.focusID &&
                                this.emitGoToPlayerEvent(event.focusID);
                            }}
                          >
                            ${this.getEventDescription(event)}
                          </button>`
                        : event.unitView
                          ? html`<button
                              @click=${() => {
                                event.unitView &&
                                  this.emitGoToUnitEvent(event.unitView);
                              }}
                            >
                              ${this.getEventDescription(event)}
                            </button>`
                          : this.getEventDescription(event)}
                      ${event.buttons
                        ? html`
                            <div class="flex flex-wrap gap-1.5 mt-1">
                              ${event.buttons.map(
                                (btn) => html`
                                  <button
                                    class="inline-block px-3 py-1 text-white rounded text-sm cursor-pointer transition-colors duration-300
                            ${btn.className.includes("btn-info")
                                      ? "bg-blue-500 hover:bg-blue-600"
                                      : btn.className.includes("btn-gray")
                                        ? "bg-gray-500 hover:bg-gray-600"
                                        : "bg-green-600 hover:bg-green-700"}"
                                    @click=${() => {
                                      btn.action();
                                      if (!btn.preventClose) {
                                        this.removeEvent(index);
                                      }
                                      this.requestUpdate();
                                    }}
                                  >
                                    ${btn.text}
                                  </button>
                                `,
                              )}
                            </div>
                          `
                        : ""}
                    </td>
                  </tr>
                `,
              )}
              ${this.renderIncomingAttacks()} ${this.renderOutgoingAttacks()}
              ${this.renderOutgoingLandAttacks()} ${this.renderBoats()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
