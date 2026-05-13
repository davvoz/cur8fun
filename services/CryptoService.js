/**
 * CryptoService — AES-GCM 256-bit encryption for sensitive values at rest.
 *
 * A randomly-generated device key is stored in localStorage under _cur8_dk.
 * Encrypted values are prefixed with "enc:" so we can detect and migrate
 * plain-text values stored by older versions of the app.
 *
 * Limitation: this protects against casual inspection and automated
 * plain-text scanners, but NOT against an attacker who can already read
 * the full localStorage (they would also find the device key). For
 * true client-side key protection a hardware-backed store (WebAuthn PRF)
 * would be required — out of scope for this app.
 */

const DEVICE_KEY_ITEM = '_cur8_dk';
const ENC_PREFIX = 'enc:';

let _deviceCryptoKey = null; // in-memory cache of the imported CryptoKey

async function _getDeviceKey() {
    if (_deviceCryptoKey) return _deviceCryptoKey;

    let raw = localStorage.getItem(DEVICE_KEY_ITEM);
    if (!raw) {
        // Generate and persist a new 256-bit random device key
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        raw = btoa(String.fromCharCode(...bytes));
        localStorage.setItem(DEVICE_KEY_ITEM, raw);
    }

    const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    _deviceCryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
    return _deviceCryptoKey;
}

/**
 * Encrypt a plaintext string. Returns "enc:<base64>" or throws.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
async function encrypt(plaintext) {
    const key = await _getDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return ENC_PREFIX + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a value previously encrypted by encrypt().
 * If the value is not prefixed with "enc:" it is returned as-is (plain-text
 * migration path — caller should re-encrypt and overwrite the stored value).
 * @param {string} stored
 * @returns {Promise<string|null>}
 */
async function decrypt(stored) {
    if (!stored) return null;
    if (!stored.startsWith(ENC_PREFIX)) return stored; // plain-text fallback

    const key = await _getDeviceKey();
    const combined = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
}

/**
 * Returns true if the stored value is already in encrypted form.
 * @param {string} stored
 * @returns {boolean}
 */
function isEncrypted(stored) {
    return typeof stored === 'string' && stored.startsWith(ENC_PREFIX);
}

// ─── PIN-based encryption (PBKDF2 + AES-GCM) for the active key ─────────────
// The PIN is never stored. PBKDF2 with 100 000 iterations derives an AES-256
// key from the PIN + a random 16-byte salt on every encrypt/decrypt call.
// Layout of the stored blob: 'pin:' + base64(salt[16] || iv[12] || ciphertext)

const PIN_ITERATIONS = 100000;

async function _deriveKeyFromPin(pin, salt, usage) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PIN_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage]
    );
}

/**
 * Encrypt a value with a user-supplied PIN.
 * @param {string} plaintext
 * @param {string} pin  — 4-digit string (or any string)
 * @returns {Promise<string>} 'pin:<base64>'
 */
async function encryptWithPin(plaintext, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await _deriveKeyFromPin(pin, salt, 'encrypt');
    const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));

    const blob = new Uint8Array(salt.byteLength + iv.byteLength + ct.byteLength);
    blob.set(salt, 0);
    blob.set(iv,   salt.byteLength);
    blob.set(new Uint8Array(ct), salt.byteLength + iv.byteLength);
    return 'pin:' + btoa(String.fromCharCode(...blob));
}

/**
 * Decrypt a value encrypted with encryptWithPin.
 * Throws 'Wrong PIN' if the PIN is incorrect.
 * @param {string} stored  — 'pin:<base64>'
 * @param {string} pin
 * @returns {Promise<string>}
 */
async function decryptWithPin(stored, pin) {
    if (!stored || !stored.startsWith('pin:')) throw new Error('Not PIN-encrypted');
    const blob = Uint8Array.from(atob(stored.slice(4)), c => c.charCodeAt(0));
    const salt = blob.slice(0, 16);
    const iv   = blob.slice(16, 28);
    const ct   = blob.slice(28);
    const key  = await _deriveKeyFromPin(pin, salt, 'decrypt');
    try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return new TextDecoder().decode(pt);
    } catch {
        throw new Error('Wrong PIN');
    }
}

/**
 * Returns true if the stored value was encrypted with a PIN.
 * @param {string} stored
 * @returns {boolean}
 */
function isPinEncrypted(stored) {
    return typeof stored === 'string' && stored.startsWith('pin:');
}

const cryptoService = { encrypt, decrypt, isEncrypted, encryptWithPin, decryptWithPin, isPinEncrypted };
export default cryptoService;
