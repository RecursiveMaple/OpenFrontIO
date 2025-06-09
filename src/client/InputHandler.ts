import { EventBus, GameEvent } from "../core/EventBus";
import { UnitView } from "../core/game/GameView";
import { UserSettings } from "../core/game/UserSettings";

export class MouseUpEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

/**
 * Event emitted when a unit is selected or deselected
 */
export class UnitSelectionEvent implements GameEvent {
  constructor(
    public readonly unit: UnitView | null,
    public readonly isSelected: boolean,
  ) {}
}

export class MouseDownEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class MouseMoveEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class ContextMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class ZoomEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly delta: number,
  ) {}
}

export class DragEvent implements GameEvent {
  constructor(
    public readonly deltaX: number,
    public readonly deltaY: number,
  ) {}
}

export class AlternateViewEvent implements GameEvent {
  constructor(public readonly alternateView: boolean) {}
}

export class CloseViewEvent implements GameEvent {}

export class RefreshGraphicsEvent implements GameEvent {}

export class ShowBuildMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}
export class ShowEmojiMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class AttackRatioEvent implements GameEvent {
  constructor(public readonly attackRatio: number) {}
}

export class CenterCameraEvent implements GameEvent {
  constructor() {}
}

export class PreciseDragEvent implements GameEvent {
  constructor(
    public readonly deltaX: number,
    public readonly deltaY: number,
  ) {}
}

export class QuickActionModeEvent implements GameEvent {
  constructor(public readonly mode: QuickActionMode | null) {}
}

export class QAMouseUpEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class QAMouse2UpEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export enum QuickActionMode {
  BoatAttack,
  BoatAttackOneTroop,
  SendAlliance,
  BreakAlliance,
  DonateTroops,
  DonateMoney,
  Target,
  SendEmoji,
  BuildAtomBomb,
  BuildMIRV,
  BuildHydrogenBomb,
  BuildWarship,
  BuildPort,
  BuildMissileSilo,
  BuildSAMLauncher,
  BuildDefensePost,
  BuildCity,
}

export class InputHandler {
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  private lastPointerDownX: number = 0;
  private lastPointerDownY: number = 0;

  private pointers: Map<number, PointerEvent> = new Map();

  private lastPinchDistance: number = 0;

  private pointerDown: boolean = false;

  private quickActionMode: QuickActionMode | null = null;

  private alternateView = false;

  private moveInterval: NodeJS.Timeout | null = null;
  private activeKeys = new Set<string>();

  private readonly keyToActionModeMap = new Map<string, QuickActionMode>([
    ["KeyB", QuickActionMode.BoatAttack],
    ["Space", QuickActionMode.BoatAttackOneTroop],
    ["Equal", QuickActionMode.SendAlliance],
    ["Minus", QuickActionMode.BreakAlliance],
    ["KeyM", QuickActionMode.DonateMoney],
    ["KeyT", QuickActionMode.DonateTroops],
    ["KeyO", QuickActionMode.Target],
    ["KeyE", QuickActionMode.SendEmoji],
    ["KeyA", QuickActionMode.BuildAtomBomb],
    ["KeyV", QuickActionMode.BuildMIRV],
    ["KeyH", QuickActionMode.BuildHydrogenBomb],
    ["KeyW", QuickActionMode.BuildWarship],
    ["KeyP", QuickActionMode.BuildPort],
    ["KeyS", QuickActionMode.BuildMissileSilo],
    ["KeyL", QuickActionMode.BuildSAMLauncher],
    ["KeyD", QuickActionMode.BuildDefensePost],
    ["KeyC", QuickActionMode.BuildCity],
  ]);

  private userSettings: UserSettings = new UserSettings();

  constructor(
    private canvas: HTMLCanvasElement,
    private eventBus: EventBus,
  ) {}

  initialize() {
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        this.onScroll(e);
        this.onShiftScroll(e);
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener("pointermove", this.onPointerMove.bind(this));
    this.pointers.clear();
    this.canvas.addEventListener("contextmenu", (e) => this.onContextMenu(e));
    window.addEventListener("mousemove", (e) => {
      if (e.movementX || e.movementY) {
        this.eventBus.emit(new MouseMoveEvent(e.clientX, e.clientY));
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") {
        if (!this.alternateView) {
          this.alternateView = true;
          this.eventBus.emit(new AlternateViewEvent(true));
        }
      }
      if (e.code === "Escape") {
        this.eventBus.emit(new CloseViewEvent());
      }
      let deltaX = 0;
      let deltaY = 0;
      if (e.code === "ArrowUp") {
        deltaY += 1;
      }
      if (e.code === "ArrowDown") {
        deltaY -= 1;
      }
      if (e.code === "ArrowLeft") {
        deltaX += 1;
      }
      if (e.code === "ArrowRight") {
        deltaX -= 1;
      }
      if (deltaX || deltaY) {
        this.eventBus.emit(new PreciseDragEvent(deltaX, deltaY));
      }
      if (/^Digit[0-9]$/.test(e.code)) {
        const num = parseInt(e.code.replace("Digit", ""));
        const value = num === 0 ? 1.0 : num / 10;
        this.eventBus.emit(
          new AttackRatioEvent(e.shiftKey ? value / 10 : value),
        );
      }
      if (this.keyToActionModeMap.has(e.code)) {
        const newMode = this.keyToActionModeMap.get(e.code)!;
        if (this.quickActionMode !== newMode) {
          this.quickActionMode = newMode;
          this.eventBus.emit(new QuickActionModeEvent(newMode));
        }
      }
      if (["ControlLeft", "ControlRight"].includes(e.code)) {
        this.activeKeys.add(e.code);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Backquote") {
        e.preventDefault();
        this.alternateView = false;
        this.eventBus.emit(new AlternateViewEvent(false));
      }

      if (e.key.toLowerCase() === "r" && e.altKey && !e.ctrlKey) {
        e.preventDefault();
        this.eventBus.emit(new RefreshGraphicsEvent());
      }

      if (this.keyToActionModeMap.has(e.code)) {
        e.preventDefault();
        if (this.quickActionMode === this.keyToActionModeMap.get(e.code)) {
          this.quickActionMode = null;
          this.eventBus.emit(new QuickActionModeEvent(null));
        }
      }

      this.activeKeys.delete(e.code);
    });
  }

  private onPointerDown(event: PointerEvent) {
    if (event.button > 0) {
      return;
    }

    this.pointerDown = true;
    this.pointers.set(event.pointerId, event);

    if (this.pointers.size === 1) {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;

      this.lastPointerDownX = event.clientX;
      this.lastPointerDownY = event.clientY;

      this.eventBus.emit(new MouseDownEvent(event.clientX, event.clientY));
    } else if (this.pointers.size === 2) {
      this.lastPinchDistance = this.getPinchDistance();
    }
  }

  onPointerUp(event: PointerEvent) {
    if (event.button > 0) {
      return;
    }
    this.pointerDown = false;
    this.pointers.clear();

    if (event.ctrlKey) {
      this.eventBus.emit(new ShowBuildMenuEvent(event.clientX, event.clientY));
      return;
    }
    if (event.altKey) {
      this.eventBus.emit(new ShowEmojiMenuEvent(event.clientX, event.clientY));
      return;
    }

    const dist =
      Math.abs(event.x - this.lastPointerDownX) +
      Math.abs(event.y - this.lastPointerDownY);
    if (dist < 10) {
      if (event.pointerType === "touch") {
        this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
        event.preventDefault();
        return;
      }

      if (!this.userSettings.leftClickOpensMenu() || event.shiftKey) {
        if (this.quickActionMode === null) {
          this.eventBus.emit(new MouseUpEvent(event.x, event.y));
        } else {
          this.eventBus.emit(new QAMouseUpEvent(event.x, event.y));
        }
      } else {
        this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
      }
    }
  }

  private onScroll(event: WheelEvent) {
    if (!event.shiftKey) {
      const realCtrl =
        this.activeKeys.has("ControlLeft") ||
        this.activeKeys.has("ControlRight");
      const ratio = event.ctrlKey && !realCtrl ? 10 : 1; // Compensate pinch-zoom low sensitivity
      this.eventBus.emit(new ZoomEvent(event.x, event.y, event.deltaY * ratio));
    }
  }

  private onShiftScroll(event: WheelEvent) {
    if (event.shiftKey) {
      const ratio = event.deltaY > 0 ? -10 : 10;
      this.eventBus.emit(new AttackRatioEvent(ratio));
    }
  }

  private onPointerMove(event: PointerEvent) {
    if (event.button > 0) {
      return;
    }

    this.pointers.set(event.pointerId, event);

    if (!this.pointerDown) {
      return;
    }

    if (this.pointers.size === 1) {
      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;

      this.eventBus.emit(new DragEvent(deltaX, deltaY));

      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    } else if (this.pointers.size === 2) {
      const currentPinchDistance = this.getPinchDistance();
      const pinchDelta = currentPinchDistance - this.lastPinchDistance;

      if (Math.abs(pinchDelta) > 1) {
        const zoomCenter = this.getPinchCenter();
        this.eventBus.emit(
          new ZoomEvent(zoomCenter.x, zoomCenter.y, -pinchDelta * 2),
        );
        this.lastPinchDistance = currentPinchDistance;
      }
    }
  }

  private onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (this.quickActionMode === null) {
      this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
    } else {
      this.eventBus.emit(new QAMouse2UpEvent(event.clientX, event.clientY));
    }
  }

  private getPinchDistance(): number {
    const pointerEvents = Array.from(this.pointers.values());
    const dx = pointerEvents[0].clientX - pointerEvents[1].clientX;
    const dy = pointerEvents[0].clientY - pointerEvents[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPinchCenter(): { x: number; y: number } {
    const pointerEvents = Array.from(this.pointers.values());
    return {
      x: (pointerEvents[0].clientX + pointerEvents[1].clientX) / 2,
      y: (pointerEvents[0].clientY + pointerEvents[1].clientY) / 2,
    };
  }

  destroy() {
    if (this.moveInterval !== null) {
      clearInterval(this.moveInterval);
    }
    this.activeKeys.clear();
  }
}
