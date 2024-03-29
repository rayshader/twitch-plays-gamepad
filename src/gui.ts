import {simulateBlur, simulateErase, simulatePaste, sleep} from "./simulate";
import {GUIStyles, GUITemplate} from "./gui-template";
import {Component} from "./component";
import {SettingsService} from "./settings-service";
import {JoystickComponent} from "./joystick";
import {TelemetryComponent} from "./telemetry";

export type TestModeCallback = (isOn: boolean) => void;

/**
 * Plugin's HTML template
 */
export class GUI extends Component {

  private isVisible: boolean = true;

  private get $btnTelemetry(): HTMLSpanElement {
    return this.$root.querySelector('.icon')!;
  }

  private get $gamepad(): HTMLParagraphElement {
    return this.$root.querySelector('[feedback] .gamepad')!;
  }

  private get $chat(): HTMLParagraphElement {
    return this.$root.querySelector('[feedback] .chat')!;
  }

  private get $lastCommand(): HTMLParagraphElement {
    return this.$root.querySelector('[feedback] .last-command')!;
  }

  private get $lastInput(): HTMLParagraphElement {
    return this.$root.querySelector('[feedback] .last-input')!;
  }

  private get $switchTestMode(): HTMLSpanElement {
    return this.$root.querySelector('.switch')!;
  }

  private get $settings(): HTMLDivElement {
    return this.$root.querySelector('[settings]')!;
  }

  private get $btnToggleSettings(): HTMLDivElement {
    return this.$root.querySelector('.expand')!;
  }

  private get $longPressInput(): HTMLInputElement {
    return this.$root.querySelector('#long-press')!;
  }

  private get $longMoveInput(): HTMLInputElement {
    return this.$root.querySelector('#long-move')!;
  }

  get $btnCloseChatPopup(): HTMLButtonElement | null {
    return document.querySelector('.chat-input-tray__open button[title="Close"]');
  }

  private readonly $chatInput: HTMLDivElement | null = document.querySelector('.chat-wysiwyg-input__editor');
  private readonly $chatSend: HTMLButtonElement | null = document.querySelector('button[data-a-target="chat-send-button"]');

  private readonly settingsService: SettingsService = SettingsService.instance;

  private LJ?: JoystickComponent;
  private RJ?: JoystickComponent;
  private telemetry?: TelemetryComponent;

  private listenerTestMode?: TestModeCallback;

  constructor() {
    super(GUIStyles, GUITemplate);
    this.build();
    if (this.isChatAcquired) {
      this.setChatAcquired();
    }
  }

  get isChatAcquired(): boolean {
    return this.$chatInput !== null && this.$chatSend !== null;
  }

  /**
   * Whether an error arisen when using chat?
   */
  get hasChatError(): boolean {
    return document.querySelector('.chat-input-tray__open') !== null;
  }

  setGamepad(isConnected: boolean): void {
    this.$gamepad.textContent = isConnected ? '🟢 Manette connectée' : '🔴 Manette en attente de connexion';
    if (isConnected) {
      this.$lastInput.classList.remove('disabled');
    } else {
      this.$lastInput.classList.add('disabled');
    }
  }

  setChatAcquired(): void {
    this.$chat.textContent = '🟢 Accès au chat obtenu';
    this.setLastCommand(true);
  }

  updateLastInput(input: string): void {
    const $span: HTMLSpanElement = this.$lastInput.querySelector('span')!;

    $span.textContent = input;
  }

  updateLastCommand(command: string): void {
    const $span: HTMLSpanElement = this.$lastCommand.querySelector('span.value')!;

    $span.textContent = command;
  }

  setLastCommand(isEnabled: boolean): void {
    if (isEnabled) {
      this.$lastCommand.classList.remove('disabled');
    } else {
      this.$lastCommand.classList.add('disabled');
    }
  }

  async send(command: string): Promise<void> {
    if (!this.$chatInput || !this.$chatSend) {
      return;
    }
    await simulatePaste(this.$chatInput, command);
    await sleep(42);
    this.$chatSend.click();
    await sleep(42);
    this.$chatSend.click();
    await sleep(42);
    simulateBlur(this.$chatInput);
    await sleep(42);
    simulateBlur(this.$chatInput);
  }

  async erase(): Promise<void> {
    if (!this.$chatInput) {
      return;
    }
    await simulateErase(this.$chatInput);
  }

  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.$root.style.display = (this.isVisible) ? '' : 'none';
  }

  toggleTestMode(): void {
    this.onTestModeSwitched();
  }

  addTestModeListener(fn: TestModeCallback): void {
    this.listenerTestMode = fn;
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.key !== '²') {
      return;
    }
    this.toggleVisibility();
  }

  private onTestModeSwitched(): void {
    const isOn: boolean = this.$switchTestMode.hasAttribute('checked');

    if (isOn) {
      this.$switchTestMode.removeAttribute('checked');
      this.setLastCommand(false);
    } else {
      this.$switchTestMode.setAttribute('checked', '');
      this.setLastCommand(true);
    }
    this.listenerTestMode?.call(this, !isOn);
  }

  private onToggleTelemetry(): void {
    this.telemetry!.toggleVisibility();
  }

  private onToggleSettings(): void {
    let isVisible: boolean = this.$settings.style.display !== 'none';

    isVisible = !isVisible;
    this.$settings.style.display = (isVisible) ? '' : 'none';
    if (isVisible) {
      this.$btnToggleSettings.setAttribute('expanded', '');
    } else {
      this.$btnToggleSettings.removeAttribute('expanded');
    }
  }

  private onLongPressChanged(): void {
    const value: string = this.$longPressInput.value;
    let duration: number = parseInt(value);

    if (duration < 50) {
      duration = 50;
      this.$longPressInput.value = '50';
    } else if (duration > 1000) {
      duration = 1000;
      this.$longPressInput.value = '1000';
    }
    this.settingsService.settings.longPressDuration = duration;
    this.settingsService.update();
  }

  private onLongMoveChanged(): void {
    const value: string = this.$longMoveInput.value;
    let duration: number = parseInt(value);

    if (duration < 50) {
      duration = 50;
      this.$longMoveInput.value = '50';
    } else if (duration > 1000) {
      duration = 1000;
      this.$longMoveInput.value = '1000';
    }
    this.settingsService.settings.longMoveDuration = duration;
    this.settingsService.update();
  }

  protected build(): void {
    super.build();
    document.body.appendChild(this.$root);

    this.$settings.style.display = 'none';
    this.$longPressInput.value = `${this.settingsService.longPressDuration}`;
    this.$longMoveInput.value = `${this.settingsService.longMoveDuration}`;
    const $joysticks: HTMLDivElement = this.$root.querySelector('.joysticks')!;

    this.LJ = new JoystickComponent('left', $joysticks);
    this.RJ = new JoystickComponent('right', $joysticks);
    this.telemetry = new TelemetryComponent(this.$root);
    this.telemetry.toggleVisibility();

    document.addEventListener('keyup', this.onKeyUp.bind(this));

    this.$btnTelemetry.addEventListener('click', this.onToggleTelemetry.bind(this));
    this.$switchTestMode.addEventListener('click', this.onTestModeSwitched.bind(this));
    this.$btnToggleSettings.addEventListener('click', this.onToggleSettings.bind(this));

    this.$longPressInput.addEventListener('focusout', this.onLongPressChanged.bind(this));
    this.$longMoveInput.addEventListener('focusout', this.onLongMoveChanged.bind(this));
  }

}
