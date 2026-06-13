// src/lib/cipher.js

/**
 * A synchronous pure-JS implementation of SHA-256.
 * Used for deriving secure key streams without asynchronous SubtleCrypto overhead,
 * maintaining compatibility with synchronous React render mapping.
 */
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiLength = ascii[lengthProperty] * 8;
  
  let hash = sha256.h = sha256.h || [];
  let k = sha256.k = sha256.k || [];
  let primeCounter = k[lengthProperty];

  const isPrime = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isPrime[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << (24 - (i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength);
  
  let h0 = hash[0], h1 = hash[1], h2 = hash[2], h3 = hash[3],
      h4 = hash[4], h5 = hash[5], h6 = hash[6], h7 = hash[7];

  for (i = 0; i < words[lengthProperty]; i += 16) {
    const w = words.slice(i, i + 16);
    const oldH0 = h0, oldH1 = h1, oldH2 = h2, oldH3 = h3,
          oldH4 = h4, oldH5 = h5, oldH6 = h6, oldH7 = h7;

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = w[j] || 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const ch = (h4 & h5) ^ (~h4 & h6);
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const temp1 = (h7 + (rightRotate(h4, 6) ^ rightRotate(h4, 11) ^ rightRotate(h4, 25)) + ch + k[j] + w[j]) | 0;
      const temp2 = ((rightRotate(h0, 2) ^ rightRotate(h0, 13) ^ rightRotate(h0, 22)) + maj) | 0;

      h7 = h6;
      h6 = h5;
      h5 = (h4 + temp1) | 0;
      h4 = h3;
      h3 = h2;
      h2 = h1;
      h1 = h0;
      h0 = (temp1 + temp2) | 0;
    }

    h0 = (h0 + oldH0) | 0;
    h1 = (h1 + oldH1) | 0;
    h2 = (h2 + oldH2) | 0;
    h3 = (h3 + oldH3) | 0;
    h4 = (h4 + oldH4) | 0;
    h5 = (h5 + oldH5) | 0;
    h6 = (h6 + oldH6) | 0;
    h7 = (h7 + oldH7) | 0;
  }

  const hex = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (i = 0; i < 8; i++) {
    const val = hex[i] < 0 ? hex[i] + 0x100000000 : hex[i];
    result += val.toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Encrypts plaintext using a secure key derived block-keystream stream cipher.
 * Prepends a random 8-character IV to prevent repeating patterns.
 */
export function encryptMessage(text, key) {
  if (!key) return text;
  
  // Generate a random 8-character IV
  const ivChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let iv = "";
  for (let i = 0; i < 8; i++) {
    iv += ivChars.charAt(Math.floor(Math.random() * ivChars.length));
  }
  
  // Encrypt using unique derived key stream
  let ciphertext = "";
  let blockIndex = 0;
  let keystream = "";
  
  for (let i = 0; i < text.length; i++) {
    if (i % 32 === 0) {
      keystream = sha256(key + iv + blockIndex);
      blockIndex++;
    }
    const charCode = text.charCodeAt(i);
    // Parse hex byte from keystream
    const keyByte = parseInt(keystream.substr((i % 32) * 2, 2), 16);
    ciphertext += String.fromCharCode(charCode ^ keyByte);
  }
  
  try {
    const utf8Bytes = encodeURIComponent(ciphertext).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return iv + ":" + btoa(utf8Bytes);
  } catch (err) {
    console.error("Encryption failed:", err);
    return text;
  }
}

/**
 * Decrypts a message payload.
 * Supports legacy XOR fallback if no colon separator/IV prefix is present.
 */
export function decryptMessage(encryptedText, key) {
  if (!key) return encryptedText;
  
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      return decryptLegacyXOR(encryptedText, key);
    }
    const [iv, payload] = parts;
    if (iv.length !== 8) {
      return decryptLegacyXOR(encryptedText, key);
    }
    
    // Decode base64
    const utf8Bytes = atob(payload);
    const percentEncoded = utf8Bytes.split("").map((c) => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("");
    const ciphertext = decodeURIComponent(percentEncoded);
    
    let result = "";
    let blockIndex = 0;
    let keystream = "";
    
    for (let i = 0; i < ciphertext.length; i++) {
      if (i % 32 === 0) {
        keystream = sha256(key + iv + blockIndex);
        blockIndex++;
      }
      const charCode = ciphertext.charCodeAt(i);
      const keyByte = parseInt(keystream.substr((i % 32) * 2, 2), 16);
      result += String.fromCharCode(charCode ^ keyByte);
    }
    return result;
  } catch (err) {
    return "[Decryption Failed: Invalid Key or Corrupted Data]";
  }
}

/**
 * Legacy decryptor for older messages that do not have the IV prefix.
 */
function decryptLegacyXOR(encryptedText, key) {
  try {
    const utf8Bytes = atob(encryptedText);
    const percentEncoded = utf8Bytes.split("").map((c) => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("");
    const decryptedXor = decodeURIComponent(percentEncoded);

    let result = "";
    for (let i = 0; i < decryptedXor.length; i++) {
      const charCode = decryptedXor.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  } catch (err) {
    return "[Decryption Failed]";
  }
}
