import YTranscriptPlugin from "src/main";
import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon, ButtonComponent } from "obsidian";
import {
	TranscriptResponse,
	YoutubeTranscript,
	YoutubeTranscriptError,
} from "./fetch-transcript";
import { formatTimestamp } from "./timestampt-utils";
import { getTranscriptBlocks, highlightText } from "./render-utils";
import { TranscriptBlock } from "./types";

export const TRANSCRIPT_TYPE_VIEW = "transcript-view";
export class TranscriptView extends ItemView {
	isDataLoaded: boolean;
	plugin: YTranscriptPlugin;

	loaderContainerEl?: HTMLElement;
	dataContainerEl?: HTMLElement;
	errorContainerEl?: HTMLElement;
	summaryContainerEl?: HTMLElement;

	videoTitle?: string;
	videoData?: TranscriptResponse[] = [];
	currentUrl?: string;
	summary?: string;
	isSummaryLoading: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: YTranscriptPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.isDataLoaded = false;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h4", { text: "Transcript" });
	}

	async onClose() {
		const leafIndex = this.getLeafIndex();
		this.plugin.settings.leafUrls.splice(leafIndex, 1);
	}

	/**
	 * Gets the leaf index out of all of the open leaves
	 * This assumes that the leaf order shouldn't changed, which is a fair assumption
	 */
	private getLeafIndex(): number {
		const leaves = this.app.workspace.getLeavesOfType(TRANSCRIPT_TYPE_VIEW);
		return leaves.findIndex((leaf) => leaf === this.leaf);
	}

	/**
	 * Adds a div with loading text to the view content
	 */
	private renderLoader() {
		if (this.loaderContainerEl !== undefined) {
			this.loaderContainerEl.createEl("div", {
				text: "Loading...",
			});
		}
	}

	/**
	 * Adds a text input to the view content
	 */
	private renderSearchInput(
		url: string,
		data: TranscriptResponse,
		timestampMod: number,
	) {
		const searchInputEl = this.contentEl.createEl("input");
		searchInputEl.type = "text";
		searchInputEl.placeholder = "Search...";
		searchInputEl.style.marginBottom = "20px";
		searchInputEl.addEventListener("input", (e) => {
			const searchFilter = (e.target as HTMLInputElement).value;
			this.renderTranscriptionBlocks(
				url,
				data,
				timestampMod,
				searchFilter,
			);
		});
	}

	/**
	 * Adds a div with the video title to the view content
	 * @param title - the title of the video
	 */
	private renderVideoTitle(title: string) {
		const titleEl = this.contentEl.createEl("div");
		titleEl.innerHTML = title;
		titleEl.style.fontWeight = "bold";
		titleEl.style.marginBottom = "20px";
	}

	private formatContentToPaste(url: string, blocks: TranscriptBlock[]) {
		return blocks
			.map((block) => {
				const { quote, quoteTimeOffset } = block;
				const href = url + "&t=" + Math.floor(quoteTimeOffset / 1000);
				const formattedBlock = `[${formatTimestamp(
					quoteTimeOffset,
				)}](${href}) ${quote}`;
				return formattedBlock;
			})
			.join("\n\n");
	}

	/**
	 * Renders the summary button and container
	 */
	private renderSummaryButton() {
		if (!this.plugin.settings.openai.apiKey) {
			return;
		}

		const buttonContainer = this.contentEl.createEl("div");
		buttonContainer.style.marginBottom = "20px";
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "center";

		const summaryButton = new ButtonComponent(buttonContainer);
		summaryButton.setButtonText("Özet Çıkar");
		setIcon(summaryButton.buttonEl, "file-text");

		summaryButton.onClick(async () => {
			if (this.isSummaryLoading) {
				return;
			}

			if (!this.videoData || !this.videoData[0] || !this.currentUrl) {
				new Notice("Özet çıkarmak için önce bir transkript yükleyin.");
				return;
			}

			this.isSummaryLoading = true;

			// Özet konteynerini oluştur veya temizle
			if (!this.summaryContainerEl) {
				this.summaryContainerEl = this.contentEl.createEl("div");
				this.summaryContainerEl.style.marginTop = "20px";
				this.summaryContainerEl.style.padding = "15px";
				this.summaryContainerEl.style.border = "1px solid var(--background-modifier-border)";
				this.summaryContainerEl.style.borderRadius = "5px";
				this.summaryContainerEl.style.backgroundColor = "var(--background-secondary)";
			} else {
				this.summaryContainerEl.empty();
			}

			// Yükleniyor mesajını göster
			this.summaryContainerEl.createEl("p", { text: "Özet oluşturuluyor..." });

			try {
				// Transkripti düz metin olarak hazırla
				const transcriptText = this.videoData[0].lines
					.map((line) => line.text)
					.join(" ");

				// Özeti oluştur
				this.summary = await this.plugin.openaiService.generateSummary(
					transcriptText,
					this.videoData[0].title
				);

				// Özeti göster
				this.summaryContainerEl.empty();
				const titleEl = this.summaryContainerEl.createEl("h4", { text: "Video Özeti" });
				titleEl.style.marginTop = "0";

				const summaryEl = this.summaryContainerEl.createEl("div");
				summaryEl.innerHTML = this.summary.replace(/\n/g, "<br>");

				// Kopyalama butonu ekle
				const copyButtonContainer = this.summaryContainerEl.createEl("div");
				copyButtonContainer.style.marginTop = "10px";
				copyButtonContainer.style.display = "flex";
				copyButtonContainer.style.justifyContent = "flex-end";

				const copyButton = new ButtonComponent(copyButtonContainer);
				copyButton.setButtonText("Kopyala");
				setIcon(copyButton.buttonEl, "copy");
				copyButton.onClick(() => {
					navigator.clipboard.writeText(this.summary || "");
					new Notice("Özet panoya kopyalandı!");
				});

			} catch (error) {
				this.summaryContainerEl.empty();
				this.summaryContainerEl.createEl("p", {
					text: error instanceof Error ? error.message : "Özet oluşturulurken bir hata oluştu."
				});
			} finally {
				this.isSummaryLoading = false;
			}
		});
	}

	/**
	 * Add a transcription blocks to the view content
	 * @param url - the url of the video
	 * @param data - the transcript data
	 * @param timestampMod - the number of seconds between each timestamp
	 * @param searchValue - the value to search for in the transcript
	 */
	private renderTranscriptionBlocks(
		url: string,
		data: TranscriptResponse,
		timestampMod: number,
		searchValue: string,
	) {
		const dataContainerEl = this.dataContainerEl;
		if (dataContainerEl !== undefined) {
			//Clear old data before rerendering
			dataContainerEl.empty();

			// TODO implement drag and drop
			// const handleDrag = (quote: string) => {
			// 	return (event: DragEvent) => {
			// 		event.dataTransfer?.setData("text/plain", quote);
			// 	};
			// };

			const transcriptBlocks = getTranscriptBlocks(
				data.lines,
				timestampMod,
			);

			//Filter transcript blocks based on
			const filteredBlocks = transcriptBlocks.filter((block) =>
				block.quote.toLowerCase().includes(searchValue.toLowerCase()),
			);

			filteredBlocks.forEach((block) => {
				const { quote, quoteTimeOffset } = block;
				const blockContainerEl = createEl("div", {
					cls: "yt-transcript__transcript-block",
				});
				blockContainerEl.draggable = true;

				const linkEl = createEl("a", {
					text: formatTimestamp(quoteTimeOffset),
					attr: {
						href: url + "&t=" + Math.floor(quoteTimeOffset / 1000),
					},
				});
				linkEl.style.marginBottom = "5px";

				const span = dataContainerEl.createEl("span", {
					text: quote,
					title: "Click to copy",
				});

				span.addEventListener("click", (event) => {
					const target = event.target as HTMLElement;
					if (target !== null) {
						navigator.clipboard.writeText(target.textContent ?? "");
					}
				});

				//Highlight any match search terms
				if (searchValue !== "") highlightText(span, searchValue);

				// TODO implement drag and drop
				// span.setAttr("draggable", "true");
				// span.addEventListener("dragstart", handleDrag(quote));

				blockContainerEl.appendChild(linkEl);
				blockContainerEl.appendChild(span);
				blockContainerEl.addEventListener(
					"dragstart",
					(event: DragEvent) => {
						event.dataTransfer?.setData(
							"text/html",
							blockContainerEl.innerHTML,
						);
					},
				);

				blockContainerEl.addEventListener(
					"contextmenu",
					(event: MouseEvent) => {
						const menu = new Menu();
						menu.addItem((item) =>
							item.setTitle("Copy all").onClick(() => {
								navigator.clipboard.writeText(
									this.formatContentToPaste(
										url,
										filteredBlocks,
									),
								);
							}),
						);
						menu.showAtPosition({
							x: event.clientX,
							y: event.clientY,
						});
					},
				);

				dataContainerEl.appendChild(blockContainerEl);
			});
		}
	}

	/**
	 * Sets the state of the view
	 * This is called when the view is loaded
	 */
	async setEphemeralState(state: { url: string }): Promise<void> {
		const { url } = state;
		this.currentUrl = url;

		this.contentEl.empty();
		this.contentEl.createEl("h4", { text: "Transcript" });

		this.loaderContainerEl = this.contentEl.createEl("div");
		this.dataContainerEl = this.contentEl.createEl("div");
		this.errorContainerEl = this.contentEl.createEl("div");

		this.renderLoader();

		try {
			const data = await YoutubeTranscript.fetchTranscript(url, {
				lang: this.plugin.settings.lang,
				country: this.plugin.settings.country,
			});

			this.videoData = [data];
			this.videoTitle = data.title;

			this.loaderContainerEl.empty();
			this.renderVideoTitle(data.title);
			this.renderSearchInput(url, data, this.plugin.settings.timestampMod);

			// Özet butonunu ekle
			this.renderSummaryButton();

			this.renderTranscriptionBlocks(
				url,
				data,
				this.plugin.settings.timestampMod,
				"",
			);
		} catch (err) {
			this.loaderContainerEl.empty();
			this.errorContainerEl.createEl("div", {
				text: err instanceof YoutubeTranscriptError
					? err.message
					: "An error occurred while fetching the transcript",
			});
		}
	}

	getViewType(): string {
		return TRANSCRIPT_TYPE_VIEW;
	}
	getDisplayText(): string {
		return "YouTube Transcript";
	}
	getIcon(): string {
		return "scroll";
	}
}
