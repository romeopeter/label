import qrcode from "qrcode-generator";

// The library's own encoder mangles anything outside Latin-1, so accented text
// and symbols would scan as garbage. Its ESM build also lacks the
// `stringToBytesFuncs` table its types declare, so this replaces it directly.
qrcode.stringToBytes = (text) => Array.from(new TextEncoder().encode(text));

/** Modules of blank space the QR standard requires around the code. */
const QUIET_ZONE = 4;

export interface QrShape {
  /** SVG path of the dark modules, in module units, quiet zone included. */
  path: string;
  /** Width and height of the whole code in modules, quiet zone included. */
  size: number;
}

/**
 * Encodes text as one vector path, or returns null if it's empty or too long
 * for a QR code. Adjacent modules merge into runs so a single fill covers them,
 * which avoids hairline seams between squares when the code is scaled.
 */
export const qrShape = (text: string): QrShape | null => {
  if (!text) return null;

  const code = qrcode(0, "M");

  // Throws when the text exceeds what the largest QR code can hold.
  try {
    code.addData(text, "Byte");
    code.make();
  } catch {
    return null;
  }

  const count = code.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (!code.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < count && code.isDark(row, col)) col++;
      const run = col - start;
      path += `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h${-run}z`;
    }
  }

  return { path, size: count + QUIET_ZONE * 2 };
};
