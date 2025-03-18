import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Notice
} from "obsidian";
import { TranscriptView, TRANSCRIPT_TYPE_VIEW } from "src/transcript-view";
import { PromptModal, PromptAction } from "src/prompt-modal";
import { EditorExtensions } from "../editor-extensions";
import { DEFAULT_OPENAI_SETTINGS, OpenAIService, OpenAISettings } from "./openai-service";
import { YoutubeTranscript } from "./fetch-transcript";
import { formatTimestamp } from "./timestampt-utils";
import { getTranscriptBlocks } from "./render-utils";

interface YTranscriptSettings {
	timestampMod: number;
	lang: string;
	country: string;
	leafUrls: string[];
	openai: OpenAISettings;
}

const DEFAULT_SETTINGS: YTranscriptSettings = {
	timestampMod: 5,
	lang: "en",
	country: "EN",
	leafUrls: [],
	openai: DEFAULT_OPENAI_SETTINGS,
};

export default class YTranscriptPlugin extends Plugin {
	settings: YTranscriptSettings;
	openaiService: OpenAIService;

	async onload() {
		await this.loadSettings();

		this.openaiService = new OpenAIService(this.settings.openai);

		this.registerView(
			TRANSCRIPT_TYPE_VIEW,
			(leaf) => new TranscriptView(leaf, this),
		);

		this.addRibbonIcon("youtube", "YouTube Transcript", async () => {
			const prompt = new PromptModal();
			const result = await new Promise<{ url: string, action: PromptAction }>((resolve) =>
				prompt.openAndGetValue(resolve, () => { }),
			);
			if (result && result.url) {
				if (result.action === PromptAction.SIDEBAR) {
					this.openView(result.url);
				} else if (result.action === PromptAction.NEW_PAGE) {
					this.createNewPageWithTranscript(result.url);
				}
			}
		});

		this.addCommand({
			id: "transcript-from-text",
			name: "Get YouTube transcript from selected url",
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const url = EditorExtensions.getSelectedText(editor).trim();
				this.openView(url);
			},
		});

		this.addCommand({
			id: "transcript-from-prompt",
			name: "Get YouTube transcript from url prompt",
			callback: async () => {
				const prompt = new PromptModal();
				const result = await new Promise<{ url: string, action: PromptAction }>((resolve) =>
					prompt.openAndGetValue(resolve, () => { }),
				);
				if (result && result.url) {
					if (result.action === PromptAction.SIDEBAR) {
						this.openView(result.url);
					} else if (result.action === PromptAction.NEW_PAGE) {
						this.createNewPageWithTranscript(result.url);
					}
				}
			},
		});

		this.addSettingTab(new YTranslateSettingTab(this.app, this));
	}

	async openView(url: string) {
		const leaf = this.app.workspace.getRightLeaf(false)!;
		await leaf.setViewState({
			type: TRANSCRIPT_TYPE_VIEW,
		});
		this.app.workspace.revealLeaf(leaf);
		leaf.setEphemeralState({
			url,
		});
	}

	async createNewPageWithTranscript(url: string) {
		try {
			// Create a temporary file name
			const tempFileName = `YouTube Transcript - Loading...`;

			// First create an empty file
			const file = await this.app.vault.create(`${tempFileName}.md`, `Loading transcript...\n\n[${url}](${url})`);

			// Open the file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			new Notice("Getting transcript...");

			// Get YouTube transcript
			const data = await YoutubeTranscript.fetchTranscript(url, {
				lang: this.settings.lang,
				country: this.settings.country,
			});

			if (!data || !data.lines) {
				await this.app.vault.process(file, (currentContent) => `Failed to get transcript!\n\n[${url}](${url})`);
				new Notice("Failed to get transcript!");
				return;
			}

			// Create the real file name
			const randomChars = Math.random().toString(36).substring(2, 6);
			const fileName = `${data.title.replace(/[\\/:*?"<>|]/g, "_")} #${randomChars}.md`;

			// Create transcript blocks
			const blocks = getTranscriptBlocks(data.lines, this.settings.timestampMod);

			// Initialize file content
			let content = `[${url}](${url})\n\n`;

			// Update the file (adding transcript)
			content += `## Transcript\n\n`;
			content += `> [!faq]- Transcript Content\n`;

			// Add transcript content
			blocks.forEach((block) => {
				content += `> **[${formatTimestamp(block.quoteTimeOffset)}]** ${block.quote}\n>\n`;
			});

			await this.app.vault.process(file, (currentContent) => content);

			// Update file name
			await this.app.fileManager.renameFile(file, `${fileName}`);

			// Generate summary
			new Notice("Generating summary...");

			// Show summary loading status
			const contentWithLoadingMessage = `[${url}](${url})\n\n## Summary\n\n*Generating summary, please wait...*\n\n${content.substring(content.indexOf("## Transcript"))}`;

			await this.app.vault.process(file, (currentContent) => contentWithLoadingMessage);

			// Combine transcript text
			let transcriptText = "";
			blocks.forEach((block) => {
				transcriptText += `> **[${formatTimestamp(block.quoteTimeOffset)}]** ${block.quote}\n>\n`;
			});
			// blocks.map(block => block.quote).join(" ");

			// Generate summary with OpenAI
			const summary = await this.openaiService.generateSummary(transcriptText, data.title, url);

			// Get current content


			// Add summary to the beginning of the file
			let updatedContent = `[${url}](${url})\n\n`;

			if (summary) {
				updatedContent += `## Summary\n\n${summary}\n\n`;
			} else {
				updatedContent += `## Summary\n\nFailed to generate summary.\n\n`;
				new Notice("Failed to generate summary!");
			}

			// Update the file
			await this.app.vault.process(file, (currentContent) => updatedContent + currentContent.substring(currentContent.indexOf("## Transcript"))
			);

			new Notice("Transcript and summary created!");

		} catch (error) {
			console.error("Error creating transcript:", error);
			new Notice("An error occurred while creating the transcript!");
		}
	}

	onunload() {
		// Yaprakları ayırmak yerine sadece kaynakları temizle
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.openaiService) {
			this.openaiService.updateSettings(this.settings.openai);
		}
	}
}

class YTranslateSettingTab extends PluginSettingTab {
	plugin: YTranscriptPlugin;
	values: Record<string, string>;

	constructor(app: App, plugin: YTranscriptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Timestamp interval")
			.setDesc(
				"Indicates how often timestamp should occur in text (1 - every line, 10 - every 10 lines)",
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.timestampMod.toFixed())
					.onChange(async (value) => {
						const v = Number.parseInt(value);
						this.plugin.settings.timestampMod = Number.isNaN(v)
							? 5
							: v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Preferred transcript language")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.lang)
					.onChange(async (value) => {
						this.plugin.settings.lang = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Country")
			.setDesc("Preferred transcript country code")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.country)
					.onChange(async (value) => {
						this.plugin.settings.country = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI")
			.setHeading();

		new Setting(containerEl)
			.setName("OpenAI API key")
			.setDesc("Enter your OpenAI API key")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openai.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.openai.apiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("OpenAI model")
			.setDesc("Select the OpenAI model to use")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("gpt-4o-mini", "GPT-4o Mini")
					.addOption("gpt-3.5-turbo", "GPT-3.5 Turbo")
					.addOption("gpt-4o", "GPT-4o")
					.setValue(this.plugin.settings.openai.model)
					.onChange(async (value) => {
						this.plugin.settings.openai.model = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Custom summary prompt")
			.setDesc("Enter a custom prompt to use when generating summaries. Leave empty to use the default prompt.")
			.addTextArea((textarea) => {
				textarea
					.setPlaceholder(DEFAULT_OPENAI_SETTINGS.customPrompt)
					.setValue(this.plugin.settings.openai.customPrompt)
					.onChange(async (value) => {
						this.plugin.settings.openai.customPrompt = value;
						await this.plugin.saveSettings();
					});
				textarea.inputEl.rows = 6;
				textarea.inputEl.cols = 50;
			});
		new Setting(containerEl)
			.setName("Max tokens")
			.setDesc("Maximum number of tokens to generate for the summary (1-4000)")
			.addText((text) =>
				text
					.setPlaceholder("2000")
					.setValue(this.plugin.settings.openai.maxTokens.toString())
					.onChange(async (value) => {
						const tokens = Number.parseInt(value);
						this.plugin.settings.openai.maxTokens = Number.isNaN(tokens) || tokens < 10 || tokens > 10000
							? 2000
							: tokens;
						await this.plugin.saveSettings();
					}),
			);
	}
}
