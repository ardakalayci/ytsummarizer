import { Modal, ButtonComponent, TextComponent } from "obsidian";

export enum PromptAction {
	SIDEBAR = "sidebar",
	NEW_PAGE = "new_page"
}

export class PromptModal extends Modal {
	private resolve: (value: { url: string, action: PromptAction }) => void;
	private reject: () => void;
	private submitted = false;
	private url: string = "";
	private action: PromptAction = PromptAction.SIDEBAR;

	constructor() {
		super(app);
	}

	listenInput(evt: KeyboardEvent) {
		if (evt.key === "Enter") {
			evt.preventDefault();
			this.enterCallback(evt);
		}
	}

	onOpen(): void {
		this.titleEl.setText("YouTube URL");
		this.createForm();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) {
			this.reject();
		}
	}

	createForm(): void {
		// Input field
		const textInput = new TextComponent(this.contentEl);
		textInput.inputEl.style.width = "100%";
		textInput.onChange((value) => (this.url = value));
		textInput.inputEl.addEventListener("keydown", (evt: KeyboardEvent) =>
			this.enterCallback(evt),
		);
		textInput.inputEl.focus();

		// Buttons container
		const buttonDiv = this.modalEl.createDiv();
		buttonDiv.addClass("modal-button-container");

		// Yan menüde göster butonu
		const sidebarButton = new ButtonComponent(buttonDiv);
		sidebarButton.buttonEl.addClass("mod-cta");
		sidebarButton.setButtonText("Yan Menüde Göster").onClick((evt: Event) => {
			this.action = PromptAction.SIDEBAR;
			this.resolveAndClose(evt);
		});

		// Yeni sayfa oluştur butonu
		const newPageButton = new ButtonComponent(buttonDiv);
		newPageButton.setButtonText("Yeni Sayfa Oluştur").onClick((evt: Event) => {
			this.action = PromptAction.NEW_PAGE;
			this.resolveAndClose(evt);
		});
	}

	private enterCallback(evt: KeyboardEvent) {
		if (evt.key === "Enter") {
			this.action = PromptAction.SIDEBAR; // Enter tuşuna basıldığında varsayılan olarak yan menüde göster
			this.resolveAndClose(evt);
		}
	}

	private resolveAndClose(evt: Event | KeyboardEvent) {
		this.submitted = true;
		evt.preventDefault();
		this.resolve({ url: this.url, action: this.action });
		this.close();
	}

	async openAndGetValue(
		resolve: (value: { url: string, action: PromptAction }) => void,
		reject: () => void,
	): Promise<void> {
		this.resolve = resolve;
		this.reject = reject;
		this.open();
	}
}
