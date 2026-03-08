/**
 * Parse document references from orchestrator response text.
 * Pattern: [filename][PageN]
 */
export function parseReferences(text: string): { cleanText: string; references: string[] } {
    const refRegex = /\[([^\]]+)\]\[Page(\d+)\]/g;
    const references: string[] = [];
    let match;

    while ((match = refRegex.exec(text)) !== null) {
        const rawFilename = match[1];
        let filename = rawFilename;
        try {
            // Only attempt to decode if it looks URI-encoded to avoid unnecessary work
            if (/%[0-9A-Fa-f]{2}/.test(rawFilename)) {
                filename = decodeURIComponent(rawFilename);
            }
        } catch {
            // If decoding fails, fall back to the raw filename
            filename = rawFilename;
        }
        const page = match[2];
        const ref = `${filename} (Page ${page})`;
        if (!references.includes(ref)) {
            references.push(ref);
        }
    }

    const cleanText = text.replace(refRegex, "").replace(/ {2,}/g, " ").trim();

    return { cleanText, references };
}

/**
 * Parse CSV text into a 2D array of strings.
 * Handles quoted fields with commas and newlines.
 */
export function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ",") {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === "\r") {
                // Handle \r\n
                currentRow.push(currentField);
                currentField = "";
                rows.push(currentRow);
                currentRow = [];
                if (i + 1 < text.length && text[i + 1] === "\n") {
                    i++;
                }
            } else if (char === "\n") {
                currentRow.push(currentField);
                currentField = "";
                rows.push(currentRow);
                currentRow = [];
            } else {
                currentField += char;
            }
        }
    }

    // Handle last field/row
    currentRow.push(currentField);
    if (currentRow.length > 1 || currentField.length > 0) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Generate CSV text from headers and rows.
 */
export function generateCSV(headers: string[], rows: string[][]): string {
    const escape = (val: string): string => {
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
    };

    const lines = [headers.map(escape).join(",")];
    for (const row of rows) {
        lines.push(row.map(escape).join(","));
    }
    return lines.join("\n");
}
