import * as d3 from "d3";
import allianceIcon from "../../../../resources/images/AllianceIconWhite.svg";
import warshipIcon from "../../../../resources/images/BattleshipIconWhite.svg";
import boatIcon from "../../../../resources/images/BoatIconWhite.svg";
import chatIcon from "../../../../resources/images/ChatIconWhite.svg";
import cityIcon from "../../../../resources/images/CityIconWhite.svg";
import donateGoldIcon from "../../../../resources/images/DonateGoldIconWhite.svg";
import donateTroopIcon from "../../../../resources/images/DonateTroopIconWhite.svg";
import emojiIcon from "../../../../resources/images/EmojiIconWhite.svg";
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
  Cell,
  PlayerType,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { flattenedEmojiTable } from "../../../core/Util";
import {
  MouseMoveEvent,
  QAMouse2UpEvent,
  QAMouseUpEvent,
  QuickActionMode,
  QuickActionModeEvent,
} from "../../InputHandler";
import {
  BuildUnitIntentEvent,
  SendAllianceRequestIntentEvent,
  SendBoatAttackIntentEvent,
  SendBreakAllianceIntentEvent,
  SendDonateGoldIntentEvent,
  SendDonateTroopsIntentEvent,
  SendEmojiIntentEvent,
  SendTargetPlayerIntentEvent,
} from "../../Transport";
import { TransformHandler } from "../TransformHandler";
import { UIState } from "../UIState";
import { EmojiTable } from "./EmojiTable";
import { FlatChatModal } from "./FlatChatModal";
import { Layer } from "./Layer";

export class IndicatorLayer implements Layer {
  private indicatorElement: d3.Selection<
    HTMLDivElement,
    unknown,
    null,
    undefined
  >;
  private borderElement: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  private rangeElement: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private isIndicatorVisible: boolean = false;

  private readonly actionIconMap = new Map<QuickActionMode, string>([
    [QuickActionMode.BoatAttack, boatIcon],
    [QuickActionMode.BoatAttackOneTroop, boatIcon],
    [QuickActionMode.SendAlliance, allianceIcon],
    [QuickActionMode.BreakAlliance, traitorIcon],
    [QuickActionMode.DonateTroops, donateTroopIcon],
    [QuickActionMode.DonateMoney, donateGoldIcon],
    [QuickActionMode.Target, targetIcon],
    [QuickActionMode.SendEmoji, emojiIcon],
    [QuickActionMode.SendChat, chatIcon],
    [QuickActionMode.BuildCity, cityIcon],
    [QuickActionMode.BuildDefensePost, shieldIcon],
    [QuickActionMode.BuildMissileSilo, missileSiloIcon],
    [QuickActionMode.BuildSAMLauncher, samlauncherIcon],
    [QuickActionMode.BuildPort, portIcon],
    [QuickActionMode.BuildWarship, warshipIcon],
    [QuickActionMode.BuildAtomBomb, atomBombIcon],
    [QuickActionMode.BuildMIRV, mirvIcon],
    [QuickActionMode.BuildHydrogenBomb, hydrogenBombIcon],
  ]);

  private readonly actionUnitTypeMap = new Map<QuickActionMode, UnitType>([
    [QuickActionMode.BuildCity, UnitType.City],
    [QuickActionMode.BuildDefensePost, UnitType.DefensePost],
    [QuickActionMode.BuildMissileSilo, UnitType.MissileSilo],
    [QuickActionMode.BuildSAMLauncher, UnitType.SAMLauncher],
    [QuickActionMode.BuildPort, UnitType.Port],
    [QuickActionMode.BuildWarship, UnitType.Warship],
    [QuickActionMode.BuildAtomBomb, UnitType.AtomBomb],
    [QuickActionMode.BuildMIRV, UnitType.MIRV],
    [QuickActionMode.BuildHydrogenBomb, UnitType.HydrogenBomb],
  ]);

  private readonly iconSize = 24;

  private clientX: number = 0;
  private clientY: number = 0;

  private quickActionMode: QuickActionMode | null = null;
  private validAction: {
    tile: TileRef;
    mode: QuickActionMode;
  } | null = null;
  private validShore: TileRef | null = null;

  private boatAttackSource: TileRef | null = null;
  private chatP1: PlayerView | null = null;

  private emojiTable: EmojiTable;
  private chatModal: FlatChatModal;

  constructor(
    private eventBus: EventBus,
    private g: GameView,
    private transformHandler: TransformHandler,
    private uiState: UIState,
  ) {}

  init() {
    this.eventBus.on(QuickActionModeEvent, (e) => this.onModeChange(e));
    this.eventBus.on(MouseMoveEvent, (e) => this.onMouseMove(e));
    this.eventBus.on(QAMouseUpEvent, (e) => this.onQAMouseUp(e));
    this.eventBus.on(QAMouse2UpEvent, (e) => this.onQAMouse2Up(e));

    this.emojiTable = document.querySelector("emoji-table") as EmojiTable;
    this.chatModal = document.querySelector("flat-chat-modal") as FlatChatModal;

    this.createIndicatorElement();
  }

  private createIndicatorElement() {
    this.indicatorElement = d3
      .select(document.body)
      .append("div")
      .style("position", "fixed")
      .style("display", "none")
      .style("z-index", "9999")
      .style("pointer-events", "none")
      .style("width", `${this.iconSize}px`)
      .style("height", `${this.iconSize}px`)
      .style("mask-size", "contain")
      .style("mask-repeat", "no-repeat")
      .style("mask-position", "center")
      .style("justify-content", "center")
      .style("align-items", "center")
      .style("transition", "all 0.15s ease");

    this.borderElement = d3
      .select(document.body)
      .append("div")
      .style("position", "fixed")
      .style("display", "none")
      .style("z-index", "999")
      .style("pointer-events", "none")
      .style("width", `${this.iconSize + 8}px`)
      .style("height", `${this.iconSize + 8}px`)
      .style("border-radius", `${this.iconSize / 2 + 4}px`)
      .style("transition", "all 0.15s ease");

    this.rangeElement = d3
      .select(document.body)
      .append("svg")
      .style("position", "fixed")
      .style("display", "none")

      .style("z-index", "999")
      .style("pointer-events", "none")
      .style("overflow", "visible");
    this.rangeElement
      .append("circle")
      .attr("class", "circle-inner")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 0)
      .attr("fill", "none")
      .attr("stroke", "#000000")
      .attr("stroke-width", "1");
    this.rangeElement
      .append("circle")
      .attr("class", "circle-outer")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 0)
      .attr("fill", "none")
      .attr("stroke", "#000000")
      .attr("stroke-width", "1");
  }

  private showIndicator(
    x: number,
    y: number,
    icon: string,
    color: string,
    border: string | null,
  ) {
    this.indicatorElement
      .style("left", `${x - this.iconSize / 2}px`)
      .style("top", `${y - this.iconSize / 2}px`)
      .style("display", "flex")
      .style("mask-image", `url(${icon})`)
      .style("background-color", color);

    let outerRadius = 0;
    let innerRadius = 0;

    switch (this.quickActionMode) {
      case QuickActionMode.BoatAttack:
      case QuickActionMode.BoatAttackOneTroop:
        this.borderElement
          .style("left", `${x - this.iconSize / 2 - 4}px`)
          .style("top", `${y - this.iconSize / 2 - 4}px`)
          .style("border", `4px solid ${border}`)
          .style("display", "flex");
        if (this.boatAttackSource !== null) {
          this.borderElement.style("background-color", "rgb(255, 230, 0)");
        } else {
          this.borderElement.style("background-color", "transparent");
        }
        break;
      case QuickActionMode.SendChat:
        this.borderElement
          .style("left", `${x - this.iconSize / 2 - 4}px`)
          .style("top", `${y - this.iconSize / 2 - 4}px`)
          .style("border", `4px solid ${color}`)
          .style("display", "flex");
        if (this.chatP1 !== null) {
          this.borderElement.style("background-color", "rgb(255, 230, 0)");
        } else {
          this.borderElement.style("background-color", "transparent");
        }
        break;
      case QuickActionMode.BuildDefensePost:
        outerRadius = this.g.config().defensePostRange();
        innerRadius = outerRadius;
        break;
      case QuickActionMode.BuildAtomBomb:
      case QuickActionMode.BuildHydrogenBomb:
        const { inner, outer } = this.g
          .config()
          .nukeMagnitudes(this.actionUnitTypeMap.get(this.quickActionMode)!);
        outerRadius = outer;
        innerRadius = inner;
        break;
      case QuickActionMode.BuildSAMLauncher:
        outerRadius = 80;
        innerRadius = 50;
        break;
      case QuickActionMode.BuildMIRV:
        outerRadius = 1500;
        innerRadius = 25;

        const tgtCell = this.transformHandler.screenToWorldCoordinates(x, y);
        const tgtTile: TileRef = this.g.ref(tgtCell.x, tgtCell.y);
        const sources = this.g
          .units(UnitType.MissileSilo)
          .filter((silo) => {
            return !silo.isCooldown();
          })
          .sort((a, b) => {
            return (
              this.g.manhattanDist(a.tile(), tgtTile) -
              this.g.manhattanDist(b.tile(), tgtTile)
            );
          });
        if (sources.length === 0) {
          break;
        }
        const srcTile: TileRef = sources[0].tile();
        const sepTileX = Math.floor((tgtCell.x + this.g.x(srcTile)) / 2);
        const sepTileY = Math.max(0, tgtCell.y - 500) + 50;
        const sepScreenPos = this.transformHandler.worldToScreenCoordinates(
          new Cell(sepTileX, sepTileY),
        );
        this.borderElement
          .style("left", `${sepScreenPos.x - this.iconSize / 2}px`)
          .style("top", `${sepScreenPos.y - this.iconSize / 2}px`)
          .style("border", `4px solid ${color}`)
          .style("display", "flex");
        break;
      default:
        this.borderElement.style("display", "none").style("border", "none");
        this.rangeElement.style("display", "none");
    }

    if (outerRadius > 0) {
      outerRadius *= this.transformHandler.scale;
      innerRadius *= this.transformHandler.scale;
      this.rangeElement
        .select(".circle-outer")
        .attr("cx", outerRadius)
        .attr("cy", outerRadius)
        .attr("r", outerRadius);
      this.rangeElement
        .select(".circle-inner")
        .attr("cx", outerRadius)
        .attr("cy", outerRadius)
        .attr("r", innerRadius);
      this.rangeElement
        .style("left", `${x - outerRadius}px`)
        .style("top", `${y - outerRadius}px`)
        .style("width", `${outerRadius * 2}px`)
        .style("height", `${outerRadius * 2}px`)
        .style("display", "block");
    }

    this.isIndicatorVisible = true;
  }

  private hideIndicator() {
    if (this.indicatorElement) {
      this.indicatorElement.style("display", "none");
    }
    if (this.borderElement) {
      this.borderElement.style("display", "none");
    }
    if (this.rangeElement) {
      this.rangeElement.style("display", "none");
    }
    this.isIndicatorVisible = false;
  }

  private updateIndicator(x: number, y: number) {
    if (this.quickActionMode === null) {
      return;
    }

    const cell = this.transformHandler.screenToWorldCoordinates(x, y);
    if (!cell || !this.g.isValidCoord(cell.x, cell.y)) {
      return;
    }

    const tile: TileRef = this.g.ref(cell.x, cell.y);
    let tilePlayer = this.g.owner(tile);
    const myPlayer = this.g.myPlayer();

    if (myPlayer === null) {
      return;
    }

    myPlayer.actions(tile).then((actions) => {
      if (!actions) {
        return;
      }

      const icon: string | null =
        this.actionIconMap.get(this.quickActionMode!) || null;
      let active: boolean = false;
      let border: string | null = null;

      if (icon === null) {
        return;
      }

      switch (this.quickActionMode) {
        case QuickActionMode.BoatAttack:
        case QuickActionMode.BoatAttackOneTroop:
          if (
            actions.buildableUnits.find(
              (bu) => bu.type === UnitType.TransportShip,
            )?.canBuild
          ) {
            active = true;
          }
          if (tilePlayer === myPlayer && this.g.isShore(tile)) {
            this.validShore = tile;
            border = "#53ac75";
          } else {
            this.validShore = null;
            border = "#c74848";
          }
          break;

        case QuickActionMode.SendAlliance:
          if (actions.interaction?.canSendAllianceRequest) {
            active = true;
          }
          break;

        case QuickActionMode.BreakAlliance:
          if (actions.interaction?.canBreakAlliance) {
            active = true;
          }
          break;

        case QuickActionMode.DonateTroops:
          if (actions.interaction?.canDonate) {
            active = true;
          }
          break;

        case QuickActionMode.DonateMoney:
          if (actions.interaction?.canDonate) {
            active = true;
          }
          break;

        case QuickActionMode.Target:
          if (actions.interaction?.canTarget) {
            active = true;
          }
          break;

        case QuickActionMode.SendEmoji:
          if (tilePlayer.isPlayer()) {
            tilePlayer = tilePlayer as PlayerView;
            const canSendEmoji =
              tilePlayer === myPlayer
                ? actions.canSendEmojiAllPlayers
                : actions.interaction?.canSendEmoji;
            if (canSendEmoji) {
              active = true;
            }
          }
          break;

        case QuickActionMode.SendChat:
          if (tilePlayer.isPlayer() && tilePlayer.type() !== PlayerType.Bot) {
            active = true;
            border = "#53ac75";
          }
          break;

        case QuickActionMode.BuildCity:
        case QuickActionMode.BuildDefensePost:
        case QuickActionMode.BuildMissileSilo:
        case QuickActionMode.BuildSAMLauncher:
        case QuickActionMode.BuildPort:
        case QuickActionMode.BuildWarship:
        case QuickActionMode.BuildAtomBomb:
        case QuickActionMode.BuildMIRV:
        case QuickActionMode.BuildHydrogenBomb:
          const unitType = this.actionUnitTypeMap.get(this.quickActionMode);
          if (unitType) {
            const unit = actions.buildableUnits.find(
              (u) => u.type === unitType,
            );
            if (unit?.canBuild) {
              active = true;
            }
          }
          break;

        default:
          return;
      }

      if (active) {
        this.validAction = {
          tile: tile,
          mode: this.quickActionMode,
        };
      }
      this.showIndicator(x, y, icon, active ? "#53ac75" : "#c74848", border);
    });
  }

  private onQAMouseUp(event: QAMouseUpEvent) {
    this.clientX = event.x;
    this.clientY = event.y;

    if (this.quickActionMode === null) {
      return;
    }

    if (
      this.validAction === null ||
      this.validAction.mode !== this.quickActionMode
    ) {
      return;
    }

    const cell = this.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );
    if (!cell || !this.g.isValidCoord(cell.x, cell.y)) {
      return;
    }

    const tile = this.g.ref(cell.x, cell.y);

    const validTile = this.validAction.tile;
    const validCell = new Cell(this.g.x(validTile), this.g.y(validTile));

    const dist =
      Math.abs(cell.x - validCell.x) + Math.abs(cell.y - validCell.y);
    if (dist > 2) {
      return;
    }

    const myPlayer = this.g.myPlayer();
    const other = this.g.owner(validTile) as PlayerView;

    if (myPlayer === null) {
      return;
    }

    switch (this.quickActionMode) {
      case QuickActionMode.BoatAttack:
      case QuickActionMode.BoatAttackOneTroop:
        if (this.boatAttackSource !== null) {
          this.eventBus.emit(
            new SendBoatAttackIntentEvent(
              other.id(),
              validTile,
              this.uiState.attackRatio * myPlayer.troops(),
              this.boatAttackSource,
            ),
          );
          this.boatAttackSource = null;
          break;
        }
        myPlayer.bestTransportShipSpawn(tile).then((spawn) => {
          const troops =
            this.quickActionMode === QuickActionMode.BoatAttack
              ? this.uiState.attackRatio * myPlayer.troops()
              : 1;
          this.eventBus.emit(
            new SendBoatAttackIntentEvent(
              other.id(),
              validTile,
              troops,
              spawn !== false ? spawn : null,
            ),
          );
        });
        break;

      case QuickActionMode.SendAlliance:
        this.eventBus.emit(
          new SendAllianceRequestIntentEvent(myPlayer, other as PlayerView),
        );
        break;

      case QuickActionMode.BreakAlliance:
        this.eventBus.emit(
          new SendBreakAllianceIntentEvent(myPlayer, other as PlayerView),
        );
        break;

      case QuickActionMode.DonateTroops:
        this.eventBus.emit(
          new SendDonateTroopsIntentEvent(
            other,
            this.uiState.attackRatio * myPlayer.troops(),
          ),
        );
        break;

      case QuickActionMode.DonateMoney:
        this.eventBus.emit(new SendDonateGoldIntentEvent(other, null));
        break;

      case QuickActionMode.Target:
        this.eventBus.emit(new SendTargetPlayerIntentEvent(other.id()));
        break;

      case QuickActionMode.SendEmoji:
        this.emojiTable.showTable((emoji: string) => {
          if (myPlayer === other) {
            this.eventBus.emit(
              new SendEmojiIntentEvent(
                AllPlayers,
                flattenedEmojiTable.indexOf(emoji),
              ),
            );
          } else {
            this.eventBus.emit(
              new SendEmojiIntentEvent(
                other,
                flattenedEmojiTable.indexOf(emoji),
              ),
            );
          }
          this.emojiTable.hideTable();
        });
        break;

      case QuickActionMode.SendChat:
        this.chatModal.open(myPlayer, other);
        if (this.chatP1 !== null) {
          this.chatModal.selectPlayer(this.chatP1);
        }
        break;

      case QuickActionMode.BuildCity:
      case QuickActionMode.BuildDefensePost:
      case QuickActionMode.BuildMissileSilo:
      case QuickActionMode.BuildSAMLauncher:
      case QuickActionMode.BuildPort:
      case QuickActionMode.BuildWarship:
      case QuickActionMode.BuildAtomBomb:
      case QuickActionMode.BuildMIRV:
      case QuickActionMode.BuildHydrogenBomb:
        const unitType = this.actionUnitTypeMap.get(this.quickActionMode)!;
        this.eventBus.emit(new BuildUnitIntentEvent(unitType, validCell));
        break;
    }
  }

  private onQAMouse2Up(event: QAMouse2UpEvent) {
    this.clientX = event.x;
    this.clientY = event.y;

    if (
      this.quickActionMode !== QuickActionMode.BoatAttack &&
      this.quickActionMode !== QuickActionMode.BoatAttackOneTroop &&
      this.quickActionMode !== QuickActionMode.SendChat
    ) {
      return;
    }

    const cell = this.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );
    if (!cell || !this.g.isValidCoord(cell.x, cell.y)) {
      return;
    }

    const tile = this.g.ref(cell.x, cell.y);

    if (this.quickActionMode === QuickActionMode.SendChat) {
      const tilePlayer = this.g.owner(tile);
      if (tilePlayer.isPlayer() && tilePlayer.type() !== PlayerType.Bot) {
        this.chatP1 = tilePlayer as PlayerView;
      }
    } else if (this.validShore === tile) {
      this.boatAttackSource = tile;
    }
  }

  private onMouseMove(event: MouseMoveEvent) {
    this.clientX = event.x;
    this.clientY = event.y;
  }

  private onModeChange(event: QuickActionModeEvent) {
    this.quickActionMode = event.mode;
    if (
      event.mode !== QuickActionMode.BoatAttack &&
      event.mode !== QuickActionMode.BoatAttackOneTroop
    ) {
      this.boatAttackSource = null;
    }
    if (event.mode !== QuickActionMode.SendChat) {
      this.chatP1 = null;
    }
    if (event.mode === null) {
      this.validAction = null;
      this.validShore = null;
      if (this.isIndicatorVisible) {
        this.hideIndicator();
      }
    }
  }

  async tick() {
    this.updateIndicator(this.clientX, this.clientY);
  }

  renderLayer(context: CanvasRenderingContext2D) {
    // No need to render anything on the canvas
  }

  shouldTransform(): boolean {
    return false;
  }
}
