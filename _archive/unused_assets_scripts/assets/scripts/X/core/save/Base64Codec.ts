const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export class Base64Codec {
  public static encode(input: string): string {
    const bytes = this.stringToUtf8Bytes(input);
    let output = '';

    for (let i = 0; i < bytes.length; i += 3) {
      const byte1 = bytes[i];
      const byte2 = i + 1 < bytes.length ? bytes[i + 1] : NaN;
      const byte3 = i + 2 < bytes.length ? bytes[i + 2] : NaN;

      const chunk = (byte1 << 16)
        | ((Number.isNaN(byte2) ? 0 : byte2) << 8)
        | (Number.isNaN(byte3) ? 0 : byte3);

      output += BASE64_ALPHABET[(chunk >> 18) & 63];
      output += BASE64_ALPHABET[(chunk >> 12) & 63];
      output += Number.isNaN(byte2) ? '=' : BASE64_ALPHABET[(chunk >> 6) & 63];
      output += Number.isNaN(byte3) ? '=' : BASE64_ALPHABET[chunk & 63];
    }

    return output;
  }

  public static decode(input: string): string {
    const sanitized = input.replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes: number[] = [];

    for (let i = 0; i < sanitized.length; i += 4) {
      const encoded1 = this.charToValue(sanitized[i]);
      const encoded2 = this.charToValue(sanitized[i + 1]);
      const encoded3 = sanitized[i + 2] === '=' ? -1 : this.charToValue(sanitized[i + 2]);
      const encoded4 = sanitized[i + 3] === '=' ? -1 : this.charToValue(sanitized[i + 3]);

      const chunk = (encoded1 << 18)
        | (encoded2 << 12)
        | ((encoded3 < 0 ? 0 : encoded3) << 6)
        | (encoded4 < 0 ? 0 : encoded4);

      bytes.push((chunk >> 16) & 255);
      if (encoded3 >= 0) {
        bytes.push((chunk >> 8) & 255);
      }
      if (encoded4 >= 0) {
        bytes.push(chunk & 255);
      }
    }

    return this.utf8BytesToString(bytes);
  }

  private static charToValue(char: string): number {
    return BASE64_ALPHABET.indexOf(char);
  }

  private static stringToUtf8Bytes(input: string): number[] {
    const bytes: number[] = [];

    for (let i = 0; i < input.length; i++) {
      let codePoint = input.charCodeAt(i);

      if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
        const next = input.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
          i += 1;
        }
      }

      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >> 6));
        bytes.push(0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(0xe0 | (codePoint >> 12));
        bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
        bytes.push(0x80 | (codePoint & 0x3f));
      } else {
        bytes.push(0xf0 | (codePoint >> 18));
        bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
        bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
        bytes.push(0x80 | (codePoint & 0x3f));
      }
    }

    return bytes;
  }

  private static utf8BytesToString(bytes: number[]): string {
    let output = '';

    for (let i = 0; i < bytes.length; ) {
      const byte1 = bytes[i++];

      if (byte1 < 0x80) {
        output += String.fromCharCode(byte1);
        continue;
      }

      if (byte1 < 0xe0) {
        const byte2 = bytes[i++];
        output += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
        continue;
      }

      if (byte1 < 0xf0) {
        const byte2 = bytes[i++];
        const byte3 = bytes[i++];
        output += String.fromCharCode(
          ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f),
        );
        continue;
      }

      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      const codePoint = ((byte1 & 0x07) << 18)
        | ((byte2 & 0x3f) << 12)
        | ((byte3 & 0x3f) << 6)
        | (byte4 & 0x3f);
      const offset = codePoint - 0x10000;
      output += String.fromCharCode(0xd800 + (offset >> 10));
      output += String.fromCharCode(0xdc00 + (offset & 0x3ff));
    }

    return output;
  }
}
