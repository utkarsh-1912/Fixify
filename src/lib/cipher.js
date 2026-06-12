// src/lib/cipher.js

/**
 * Encrypts cleartext using a simple symmetric XOR cipher + Base64 encoding.
 * Supports Unicode/UTF-8 characters via percent-encoding.
 */
export function encryptMessage(text, key) {
  if (!key) return text;
  
  // XOR encryption on the characters
  let xorResult = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    xorResult += String.fromCharCode(charCode ^ keyChar);
  }

  // Convert string to base64 safely supporting Unicode characters
  try {
    const utf8Bytes = encodeURIComponent(xorResult).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return btoa(utf8Bytes);
  } catch (err) {
    console.error("Encryption serialization failed:", err);
    return text;
  }
}

/**
 * Decrypts a base64 encoded XOR encrypted string.
 * Returns the decrypted string, or a failure message if the key is invalid or data is corrupted.
 */
export function decryptMessage(encryptedText, key) {
  if (!key) return encryptedText;
  
  try {
    // Decode base64 to UTF-8 bytes safely
    const utf8Bytes = atob(encryptedText);
    const percentEncoded = utf8Bytes.split("").map((c) => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("");
    const decryptedXor = decodeURIComponent(percentEncoded);

    // XOR decryption
    let result = "";
    for (let i = 0; i < decryptedXor.length; i++) {
      const charCode = decryptedXor.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  } catch (err) {
    return "[Decryption Failed: Invalid Key]";
  }
}
