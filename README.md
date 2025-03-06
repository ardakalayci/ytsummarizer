# YTSummarizer

An Obsidian plugin that fetches YouTube transcripts and generates summaries using OpenAI GPT models.

## Features

- Fetch transcripts from YouTube videos
- Generate summaries of video content using OpenAI GPT models
- View transcripts in the sidebar or create new notes with transcripts and summaries
- Interactive timestamps that link directly to specific points in the video
- Customizable timestamp frequency
- Support for different languages and country codes
- Configurable OpenAI model selection

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click on Browse and search for "YTSummarizer"
4. Install the plugin and enable it

## Usage

### Getting Transcripts

There are multiple ways to get a YouTube transcript:

1. **From the ribbon icon**:
   - Click the YouTube icon in the left sidebar
   - Enter the YouTube URL
   - Choose whether to view in sidebar or create a new note

2. **From selected text**:
   - Select a YouTube URL in your note
   - Use the command "YTSummarizer: Get YouTube transcript from selected url"
   - The transcript will appear in the sidebar

3. **From command palette**:
   - Open the command palette (Ctrl/Cmd + P)
   - Search for "YTSummarizer: Get YouTube transcript from url prompt"
   - Enter the YouTube URL
   - Choose whether to view in sidebar or create a new note

### Working with Transcripts

- Click on any timestamp to open the video at that specific point
- In sidebar view, use the "Generate Summary" button to create a summary with OpenAI
- When creating a new note, the summary is automatically generated and placed at the top

## Configuration

In the plugin settings, you can configure:

- **Timestamp interval**: How often timestamps should appear in the transcript
- **Language**: Preferred transcript language code (e.g., "en", "fr", "de")
- **Country**: Preferred transcript country code (e.g., "EN", "FR", "DE")
- **OpenAI API Key**: Your OpenAI API key for generating summaries
- **OpenAI Model**: Choose between GPT-4o Mini, GPT-3.5 Turbo, or GPT-4o
- **Custom Summary Prompt**: Customize the prompt used for generating summaries

## Requirements

- An OpenAI API key is required for the summary generation feature

## Acknowledgments

Many thanks to creators and contributors of following plugins:

- [Auto Link Title](https://github.com/zolrath/obsidian-auto-link-title)
- [Timestamp Notes](https://github.com/juliang22/ObsidianTimestampNotes)
- [Recent Files](https://github.com/tgrosinger/recent-files-obsidian)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
