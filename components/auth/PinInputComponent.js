import Component from '../Component.js';

/**
 * PinInputComponent
 *
 * Provides two async prompt methods:
 *   - promptSetPin(title)   — shows two PIN fields (set + confirm), returns the PIN string
 *   - promptPin(title, hint) — shows one PIN field, returns the PIN string
 *
 * Both methods return null when the user cancels.
 * Retries on wrong-confirm or (optionally) wrong-decrypt are handled internally.
 */
class PinInputComponent extends Component {
    constructor() {
        super();
    }

    // ── Internal helper ──────────────────────────────────────────────────────

    _uid() {
        return Math.random().toString(36).slice(2, 9);
    }

    /**
     * Build and inject the modal DOM, return a set of element references.
     * @param {'set'|'verify'} mode
     * @param {string} title
     * @param {string} [hint]
     * @returns {{ overlay, form, input1, input2|null, errorEl, cancelBtn }}
     */
    _buildModal(mode, title, hint) {
        const id = this._uid();
        const overlay = document.createElement('div');
        overlay.className = 'auth-modal-overlay';
        overlay.id = `pinOverlay-${id}`;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const box = document.createElement('div');
        box.className = 'auth-modal-content';
        box.style.cssText = 'background:var(--background-color,#fff);border-radius:12px;padding:28px 24px;width:340px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18);';

        // Header
        const h3 = document.createElement('h3');
        h3.className = 'auth-modal-header';
        h3.style.cssText = 'margin:0 0 8px;font-size:1.1rem;';
        h3.textContent = title;
        box.appendChild(h3);

        // Description
        const desc = document.createElement('p');
        desc.style.cssText = 'margin:0 0 20px;font-size:0.88rem;color:var(--text-secondary,#666);line-height:1.4;';
        desc.textContent = mode === 'set'
            ? 'Choose a 4-digit PIN to protect your Active Key. You will be asked for it before any wallet operation.'
            : (hint || 'Enter your 4-digit PIN to authorise this wallet operation.');
        box.appendChild(desc);

        // Form
        const form = document.createElement('form');
        form.id = `pinForm-${id}`;
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '14px';

        // Shared input style
        const inputStyle = 'text-align:center;letter-spacing:0.4em;font-size:1.4rem;font-weight:bold;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px;width:100%;box-sizing:border-box;';

        // PIN input 1
        const input1 = document.createElement('input');
        input1.type = 'password';
        input1.inputMode = 'numeric';
        input1.pattern = '[0-9]{4}';
        input1.maxLength = 4;
        input1.placeholder = '• • • •';
        input1.autocomplete = 'off';
        input1.style.cssText = inputStyle;
        input1.id = `pin1-${id}`;

        const group1 = document.createElement('div');
        if (mode === 'set') {
            const lbl1 = document.createElement('label');
            lbl1.setAttribute('for', input1.id);
            lbl1.textContent = 'New PIN';
            lbl1.style.cssText = 'display:block;font-size:0.85rem;font-weight:600;margin-bottom:4px;';
            group1.appendChild(lbl1);
        }
        group1.appendChild(input1);
        form.appendChild(group1);

        // PIN input 2 (confirm — only in set mode)
        let input2 = null;
        if (mode === 'set') {
            input2 = document.createElement('input');
            input2.type = 'password';
            input2.inputMode = 'numeric';
            input2.pattern = '[0-9]{4}';
            input2.maxLength = 4;
            input2.placeholder = '• • • •';
            input2.autocomplete = 'off';
            input2.style.cssText = inputStyle;
            input2.id = `pin2-${id}`;

            const group2 = document.createElement('div');
            const lbl2 = document.createElement('label');
            lbl2.setAttribute('for', input2.id);
            lbl2.textContent = 'Confirm PIN';
            lbl2.style.cssText = 'display:block;font-size:0.85rem;font-weight:600;margin-bottom:4px;';
            group2.appendChild(lbl2);
            group2.appendChild(input2);
            form.appendChild(group2);
        }

        // Error area
        const errorEl = document.createElement('div');
        errorEl.style.cssText = 'color:#e53935;font-size:0.85rem;display:none;';
        form.appendChild(errorEl);

        // Buttons
        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:4px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'auth-btn auth-btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 18px;border-radius:7px;border:1px solid var(--border-color,#ddd);background:transparent;cursor:pointer;font-size:0.9rem;';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'auth-btn auth-btn-primary';
        submitBtn.textContent = mode === 'set' ? 'Set PIN' : 'Confirm';
        submitBtn.style.cssText = 'padding:8px 18px;border-radius:7px;border:none;background:var(--primary-color,#ff7518);color:#fff;cursor:pointer;font-size:0.9rem;font-weight:600;';

        footer.appendChild(cancelBtn);
        footer.appendChild(submitBtn);
        form.appendChild(footer);
        box.appendChild(form);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        setTimeout(() => input1.focus(), 80);

        return { overlay, form, input1, input2, errorEl, cancelBtn };
    }

    _showError(errorEl, msg) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }

    _clearError(errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }

    _remove(overlay) {
        if (overlay && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Show a "set PIN" modal (two fields).
     * Validates: exactly 4 digits, both fields match.
     * @param {string} [title]
     * @returns {Promise<string|null>} PIN string or null if cancelled
     */
    promptSetPin(title = 'Set Active Key PIN') {
        return new Promise((resolve) => {
            const { overlay, form, input1, input2, errorEl, cancelBtn } =
                this._buildModal('set', title);

            const done = (pin) => { this._remove(overlay); resolve(pin); };

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const pin = input1.value.trim();
                const confirm = input2.value.trim();

                if (!/^\d{4}$/.test(pin)) {
                    this._showError(errorEl, 'PIN must be exactly 4 digits (0–9).');
                    input1.focus();
                    return;
                }
                if (pin !== confirm) {
                    this._showError(errorEl, 'PINs do not match. Try again.');
                    input2.value = '';
                    input2.focus();
                    return;
                }
                done(pin);
            });

            cancelBtn.addEventListener('click', () => done(null));

            // Only allow digit input
            [input1, input2].forEach(inp => {
                inp.addEventListener('input', () => {
                    inp.value = inp.value.replace(/\D/g, '').slice(0, 4);
                    this._clearError(errorEl);
                });
            });
        });
    }

    /**
     * Show a "verify PIN" modal (single field).
     * Accepts a `verify` async callback — if it throws, shows the error and
     * lets the user retry. Resolves with the PIN when `verify` succeeds.
     * @param {string} [title]
     * @param {string} [hint]
     * @param {Function} [verify]  async (pin) => void — throw to indicate wrong PIN
     * @returns {Promise<string|null>}
     */
    promptPin(title = 'Enter Active Key PIN', hint, verify) {
        return new Promise((resolve) => {
            const { overlay, form, input1, errorEl, cancelBtn } =
                this._buildModal('verify', title, hint);

            const done = (pin) => { this._remove(overlay); resolve(pin); };

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pin = input1.value.trim();

                if (!/^\d{4}$/.test(pin)) {
                    this._showError(errorEl, 'PIN must be exactly 4 digits.');
                    return;
                }

                if (verify) {
                    const submitBtn = form.querySelector('[type=submit]');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Verifying…';
                    try {
                        await verify(pin);
                        done(pin);
                    } catch (err) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Confirm';
                        this._showError(errorEl, err.message || 'Wrong PIN. Try again.');
                        input1.value = '';
                        input1.focus();
                    }
                } else {
                    done(pin);
                }
            });

            cancelBtn.addEventListener('click', () => done(null));

            input1.addEventListener('input', () => {
                input1.value = input1.value.replace(/\D/g, '').slice(0, 4);
                this._clearError(errorEl);
            });
        });
    }
}

const pinInput = new PinInputComponent();
export default pinInput;
