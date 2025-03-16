import YTranscriptPlugin from "src/main";
import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon, ButtonComponent, TextComponent } from "obsidian";
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

		// Loader container
		this.loaderContainerEl = contentEl.createEl("div", {
			cls: "yt-transcript__loader-container"
		});

		// Data container
		this.dataContainerEl = contentEl.createEl("div", {
			cls: "yt-transcript__data-container"
		});
		this.dataContainerEl.style.display = "none";

		// Error container
		this.errorContainerEl = contentEl.createEl("div", {
			cls: "yt-transcript__error-container"
		});
		this.errorContainerEl.style.display = "none";

		// Summary container
		this.summaryContainerEl = contentEl.createEl("div", {
			cls: "yt-transcript__summary-container"
		});
		this.summaryContainerEl.style.display = "none";

		// Set state from leaf
		const state = this.leaf.getEphemeralState();
		if (state && state.url) {
			await this.setEphemeralState(state);
		}
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
	 * Loads a transcript from a YouTube URL
	 * @param url - the YouTube URL
	 */
	private async loadTranscript(url: string): Promise<void> {
		this.currentUrl = url;

		// Clear the content and recreate containers
		this.contentEl.empty();
		this.contentEl.createEl("h4", { text: "Transcript" });

		// Recreate containers with proper CSS classes
		this.loaderContainerEl = this.contentEl.createEl("div", {
			cls: "yt-transcript__loader-container"
		});

		this.dataContainerEl = this.contentEl.createEl("div", {
			cls: "yt-transcript__data-container"
		});
		this.dataContainerEl.style.display = "none";

		this.errorContainerEl = this.contentEl.createEl("div", {
			cls: "yt-transcript__error-container"
		});
		this.errorContainerEl.style.display = "none";

		this.summaryContainerEl = this.contentEl.createEl("div", {
			cls: "yt-transcript__summary-container"
		});
		this.summaryContainerEl.style.display = "none";

		// Show loader
		this.renderLoader();

		try {
			// Fetch transcript
			const data = await YoutubeTranscript.fetchTranscript(url, {
				lang: this.plugin.settings.lang,
				country: this.plugin.settings.country,
			});

			this.videoData = [data];
			this.videoTitle = data.title;

			// Hide loader and show data
			if (this.loaderContainerEl) this.loaderContainerEl.style.display = "none";
			if (this.dataContainerEl) {
				this.dataContainerEl.style.display = "block";
				this.dataContainerEl.empty();

				// Render video title and transcript
				this.renderVideoTitle(data.title);
				this.renderTranscriptionBlocks(
					url,
					data,
					this.plugin.settings.timestampMod,
					""
				);
			}
		} catch (error) {
			// Hide loader and show error
			if (this.loaderContainerEl) this.loaderContainerEl.style.display = "none";
			if (this.errorContainerEl) {
				this.errorContainerEl.style.display = "flex";
				this.errorContainerEl.empty();
				this.errorContainerEl.createEl("h4", { text: "Error" });
				this.errorContainerEl.createEl("p", { text: error.message });
			}
		}
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
	 * Renders the video title
	 * @param title - the title of the video
	 */
	private renderVideoTitle(title: string) {
		const titleEl = this.contentEl.createEl("div", {
			text: title,
			cls: "yt-transcript__video-title"
		});
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
		summaryButton.setButtonText("Generate summary");
		summaryButton.onClick(async () => {
			if (!this.videoData || this.videoData.length === 0) {
				new Notice("Please load a transcript first to generate a summary.");
				return;
			}

			this.isSummaryLoading = true;

			// Create or clear summary container
			if (!this.summaryContainerEl) {
				this.summaryContainerEl = this.contentEl.createEl("div", {
					cls: "yt-transcript__summary-container"
				});
			} else {
				this.summaryContainerEl.empty();
				this.summaryContainerEl.style.display = "block";
			}

			this.summaryContainerEl.createEl("p", { text: "Generating summary..." });

			try {
				// Prepare transcript as plain text
				const transcriptText = this.videoData[0].lines
					.map((line) => line.text)
					.join(" ");

				// Generate summary
				this.summary = await this.plugin.openaiService.generateSummary(
					transcriptText,
					this.videoTitle || "YouTube video",
					this.currentUrl || ""
				);

				// Show summary
				this.summaryContainerEl.empty();
				const titleEl = this.summaryContainerEl.createEl("h4", {
					text: "Video summary",
					cls: "yt-transcript__summary-title"
				});

				const summaryEl = this.summaryContainerEl.createEl("div");

				// Split newlines into paragraphs
				const paragraphs = this.summary.split("\n");
				paragraphs.forEach((paragraph, index) => {
					if (paragraph.trim()) {
						summaryEl.createEl("p", { text: paragraph });
					} else if (index < paragraphs.length - 1) {
						// Add empty lines as <br> (except for the last empty line)
						summaryEl.createEl("br");
					}
				});

				// Add copy button
				const copyButtonContainer = this.summaryContainerEl.createEl("div", {
					cls: "yt-transcript__button-container"
				});

				const copyButton = new ButtonComponent(copyButtonContainer);
				copyButton.setButtonText("Copy to clipboard");
				copyButton.onClick(() => {
					navigator.clipboard.writeText(this.summary || "");
					new Notice("Summary copied to clipboard!");
				});
			} catch (error) {
				this.summaryContainerEl.empty();
				this.summaryContainerEl.createEl("p", {
					text: error instanceof Error ? error.message : "An error occurred while generating the summary."
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
						// Use text content for drag operation
						const textContent = `${block.quote} (${formatTimestamp(block.quoteTimeOffset)})`;
						event.dataTransfer?.setData("text/plain", textContent);
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
	 * Sets the ephemeral state of the view
	 * @param state - the state to set
	 */
	async setEphemeralState(state: { url: string }): Promise<void> {
		const { url } = state;
		await this.loadTranscript(url);
	}

	getViewType() {
		return TRANSCRIPT_TYPE_VIEW;
	}

	getDisplayText() {
		return "Transcript";
	}

	getIcon() {
		return "scroll";
	}
}
