import { OpenAI } from "openai";
import { Notice } from "obsidian";

export interface OpenAISettings {
    apiKey: string;
    model: string;
    customPrompt: string;
    maxTokens: number;
}

export const DEFAULT_OPENAI_SETTINGS: OpenAISettings = {
    apiKey: "",
    model: "gpt-4o-mini",
    customPrompt: "You are an assistant that summarizes YouTube video transcripts. Summarize the given transcript in a concise, clear, and understandable way. Highlight important points and remove unnecessary details.",
    maxTokens: 1000
};

export class OpenAIService {
    private openai: OpenAI | null = null;
    private settings: OpenAISettings;

    constructor(settings: OpenAISettings) {
        this.settings = settings;
        if (settings.apiKey) {
            this.initializeClient(settings.apiKey);
        }
    }

    private initializeClient(apiKey: string) {
        try {
            this.openai = new OpenAI({
                apiKey: apiKey,
                dangerouslyAllowBrowser: true
            });
        } catch (error) {
            console.error("OpenAI client initialization failed:", error);
            new Notice("Failed to connect to OpenAI API. Please check your API key.");
            this.openai = null;
        }
    }

    public updateSettings(settings: OpenAISettings) {
        this.settings = settings;
        if (settings.apiKey) {
            this.initializeClient(settings.apiKey);
        } else {
            this.openai = null;
        }
    }

    public async generateSummary(transcript: string, title: string, url: string): Promise<string> {
        if (!this.openai) {
            throw new Error("OpenAI API key is not set. Please enter your API key in the plugin settings.");
        }

        try {
            const systemPrompt = this.settings.customPrompt.trim() || DEFAULT_OPENAI_SETTINGS.customPrompt;

            const response = await this.openai.chat.completions.create({
                model: this.settings.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: `Video Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease summarize this video. To create links to relevant sections where the user requests, here is the video link: ${url}`
                    }
                ],
                temperature: 0.7,
                max_tokens: this.settings.maxTokens
            });

            return response.choices[0]?.message?.content || "Failed to generate summary.";
        } catch (error) {
            console.error("OpenAI API error:", error);
            throw new Error("An error occurred while generating the summary. Please try again later.");
        }
    }
} 