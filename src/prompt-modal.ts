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
		textInput.inputEl.addClass("yt-transcript__text-input");
		textInput.onChange((value) => (this.url = value));
		textInput.inputEl.addEventListener("keydown", (evt: KeyboardEvent) =>
			this.enterCallback(evt),
		);
		textInput.inputEl.focus();

		// Buttons container
		const buttonDiv = this.modalEl.createDiv();
		buttonDiv.addClass("modal-button-container");

		// Show in sidebar button
		const sidebarButton = new ButtonComponent(buttonDiv);
		sidebarButton.setCta();
		sidebarButton.setButtonText("Show in sidebar").onClick((evt: Event) => {
			this.action = PromptAction.SIDEBAR;
			this.resolveAndClose(evt);
		});

		// Create new page button
		const newPageButton = new ButtonComponent(buttonDiv);
		newPageButton.setButtonText("Create new page").onClick((evt: Event) => {
			this.action = PromptAction.NEW_PAGE;
			this.resolveAndClose(evt);
		});
	}

	private enterCallback(evt: KeyboardEvent) {
		if (evt.key === "Enter") {
			this.action = PromptAction.SIDEBAR; // Default to sidebar view when Enter key is pressed
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
