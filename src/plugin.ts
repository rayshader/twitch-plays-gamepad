import {ButtonReleaseEvent, JoystickMoveEvent} from "./gamepad-event";
import {GUI} from "./gui";
import {GamepadService} from "./gamepad-service";
import {SettingsService} from "./settings-service";
import {TelemetrySection, TelemetryService} from "./telemetry-service";

enum RandomizeCase {
  upper,
  lower,
  first,
  last,
  size
}

export class Plugin {
  // false to disable logging when building in release mode.
  private static readonly logging: boolean = false;

  // Map digit characters using AZERTY keyboard.
  private static readonly digits: string = `&é"'(-è_çà)=`;

  private readonly gui: GUI = new GUI();
  private readonly gamepadService: GamepadService = new GamepadService(this.gui);
  private readonly settingsService: SettingsService = SettingsService.instance;
  private readonly telemetryService: TelemetryService = TelemetryService.instance;

  private isTestMode: boolean = false;
  private dropFirstCommand: boolean = true;
  private randomize: RandomizeCase = RandomizeCase.upper;

  constructor() {
    if (!Plugin.logging) {
      console.log = () => {};
      console.warn = () => {};
    }
    this.gamepadService.addConnectionListener(this.onConnected.bind(this));
    this.gamepadService.addDisconnectionListener(this.onDisconnected.bind(this));
    this.gui.addTestModeListener(this.onTestModeChanged.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  start(): void {
    this.gamepadService.start();
    console.log('<plugin (start) />');
  }

  /**
   * Send message using UI.
   * @param message to send on chat.
   * @param section of telemetry to record to.
   */
  private async send(message: string, section: TelemetrySection): Promise<void> {
    if (this.dropFirstCommand) {
      this.dropFirstCommand = false;
      console.log('<plugin (drop-command) />');
      return;
    }
    if (!this.gui.isChatAcquired) {
      return;
    }
    if (this.isTestMode) {
      return;
    }
    message = this.randomizeCommand(message);
    await this.gui.send(message);
    this.gui.updateLastCommand(message);
    setTimeout(this.detectChatError.bind(this), 300);
    this.randomize++;
    if (this.randomize === RandomizeCase.size) {
      this.randomize = 0;
    }
    console.log(`<send command="${message}" />`);
    this.telemetryService.addCommand(message, section);
  }

  /**
   * Test if an error occurred due to "spamming" chat. Reset input for next command.
   * @private
   */
  private async detectChatError(): Promise<void> {
    if (!this.gui.hasChatError) {
      return;
    }
    await this.gui.erase();
    const $close: HTMLButtonElement | null = this.gui.$btnCloseChatPopup;

    if (!$close) {
      return;
    }
    $close.click();
  }

  private onConnected(): void {
    this.gui.setGamepad(true);
    this.gamepadService.addButtonListener(this.onButtonReleased.bind(this));
    this.gamepadService.addJoystickListener(this.onJoystickMoved.bind(this));
  }

  private onDisconnected(): void {
    this.gui.setGamepad(false);
    this.gui.updateLastInput('N/A');
  }

  private onTestModeChanged(isOn: boolean): void {
    this.isTestMode = !isOn;
    if (this.isTestMode) {
      this.telemetryService.disable();
    } else {
      this.telemetryService.enable();
    }
  }

  private onButtonReleased(event: ButtonReleaseEvent): void {
    if (event.button === 'START') {
      this.gui.toggleVisibility();
      return;
    }
    if (event.button === 'SELECT') {
      this.gui.toggleTestMode();
      return;
    }
    let command: string = event.button;

    if (event.duration >= this.settingsService.longPressDuration) {
      command = `+${command}`;
    }
    this.send(command, 'gamepad');
  }

  private onJoystickMoved(event: JoystickMoveEvent): void {
    let command: string = `M${event.side === 'left' ? 'L' : 'R'}${event.button}`;

    if (event.duration >= this.settingsService.longMoveDuration) {
      command = `+${command}`;
    }
    this.send(command, 'joystick');
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!Plugin.digits.includes(event.key)) {
      return;
    }
    const digit: number = Plugin.digits.indexOf(event.key) + 1;

    this.gui.updateLastInput(digit.toString());
    this.send(digit.toString(), 'keyboard');
  }

  private randomizeCommand(message: string): string {
    const isNumber: number = parseInt(message);

    if (isNumber >= 1 && isNumber <= 12) {
      return message;
    }
    let offset: number = 0;

    if (message[0] === '+') {
      offset++;
    }
    let randomize: RandomizeCase = this.randomize;

    // Upper / Lower only when command is a single letter.
    if (message.length === 1) {
      randomize %= 2;
    }
    if (randomize === RandomizeCase.upper) {
      return message.toUpperCase();
    } else if (randomize === RandomizeCase.first) {
      return `${message.substring(0, offset + 1).toUpperCase()}${message.substring(offset + 1).toLowerCase()}`;
    } else if (randomize === RandomizeCase.last) {
      return `${message.substring(0, message.length - 1).toLowerCase()}${message.substring(message.length - 1).toUpperCase()}`;
    } else {
      return message.toLowerCase();
    }
  }

}
