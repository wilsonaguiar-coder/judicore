export class DocumentNormalizerService {
  normalize(text: string): string {
    return text
      // Remove null bytes and other control characters (except \n, \r, \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize Windows and old Mac line endings to Unix
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Collapse more than 2 consecutive blank lines
      .replace(/\n{3,}/g, "\n\n")
      // Reduce multiple spaces/tabs to a single space (but preserve newlines)
      .replace(/[ \t]{2,}/g, " ")
      // Remove trailing whitespace on each line
      .replace(/ +$/gm, "")
      // Remove leading whitespace on each line (but preserve indented legal citations)
      .replace(/^ {4,}/gm, "    ")
      // Normalize Unicode smart quotes to ASCII
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      // Normalize dashes
      .replace(/[–—]/g, "-")
      // Normalize non-breaking spaces
      .replace(/ /g, " ")
      .trim();
  }
}
