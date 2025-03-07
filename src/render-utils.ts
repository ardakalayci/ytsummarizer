import { TranscriptLine } from "./fetch-transcript";
import { TranscriptBlock } from "./types";

/**
 * Highlights matched text in the div
 * @param div - the div that we want to highlight
 * @param searchValue - the value that will be highlight
 */
export const highlightText = (div: HTMLElement, searchValue: string) => {
	// Clear the div
	const textContent = div.textContent || "";
	div.empty();

	if (!searchValue.trim()) {
		div.setText(textContent);
		return;
	}

	const regex = new RegExp(searchValue, "gi");
	let match;
	let lastIndex = 0;

	// Split the text by matches and create spans for highlighted parts
	while ((match = regex.exec(textContent)) !== null) {
		// Add text before match
		if (match.index > lastIndex) {
			div.createSpan({
				text: textContent.substring(lastIndex, match.index)
			});
		}

		// Add highlighted match
		div.createSpan({
			text: match[0],
			cls: "yt-transcript__highlight"
		});

		lastIndex = regex.lastIndex;
	}

	// Add remaining text after last match
	if (lastIndex < textContent.length) {
		div.createSpan({
			text: textContent.substring(lastIndex)
		});
	}
};

/**
 * Gets an array of transcript render blocks
 * @param data - the transcript data
 * @param timestampMod - the number of seconds between each timestamp
 */
export const getTranscriptBlocks = (
	data: TranscriptLine[],
	timestampMod: number,
) => {
	const transcriptBlocks: TranscriptBlock[] = [];

	//Convert data into blocks
	let quote = "";
	let quoteTimeOffset = 0;
	data.forEach((line, i) => {
		if (i === 0) {
			quoteTimeOffset = line.offset;
			quote += line.text + " ";
			return;
		}
		if (i % timestampMod == 0) {
			transcriptBlocks.push({
				quote,
				quoteTimeOffset,
			});

			//Clear the data
			quote = "";
			quoteTimeOffset = line.offset;
		}
		quote += line.text + " ";
	});

	if (quote !== "") {
		transcriptBlocks.push({
			quote,
			quoteTimeOffset,
		});
	}
	return transcriptBlocks;
};
