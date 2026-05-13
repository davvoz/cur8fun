import eventEmitter from '../../utils/EventEmitter.js';
/**
 * Core functionality for Steem blockchain interaction
 */
export default class SteemCore {
    constructor() {
        this.apiEndpoints = [
            'https://api.moecki.online',
            'https://api.steemitdev.com',
            'https://api.steemit.com',
            'https://api.steemyy.com',
        ];
        this.currentEndpoint = 0;
        this.steem = null;

        if (typeof window !== 'undefined' && window.steem) {
            this.steem = window.steem;
            this.configureApi();
        }
    }

    async loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/steem/dist/steem.min.js';
            script.async = true;

            script.onload = () => {
                if (window.steem) {
                    this.steem = window.steem;
                    this.configureApi();
                    eventEmitter.emit('steem:loaded');
                    resolve(this.steem);
                } else {
                    const error = new Error('Steem library loaded but not available globally');
                    eventEmitter.emit('notification', {
                        type: 'error',
                        message: 'Failed to initialize Steem connection'
                    });
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error('Failed to load Steem library');
                eventEmitter.emit('notification', {
                    type: 'error',
                    message: 'Failed to load Steem library'
                });
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    configureApi() {
        if (!this.steem) {
            throw new Error('Steem library not loaded');
        }

        this.steem.api.setOptions({ url: this.apiEndpoints[this.currentEndpoint] });
        this.steem.config.set('address_prefix', 'STM');
        this.steem.config.set('chain_id', '0000000000000000000000000000000000000000000000000000000000000000');
    }

    switchEndpoint() {
        this.currentEndpoint = (this.currentEndpoint + 1) % this.apiEndpoints.length;
        this.configureApi();
        console.log(`Switched to endpoint: ${this.apiEndpoints[this.currentEndpoint]}`);
        return this.apiEndpoints[this.currentEndpoint];
    }

    async ensureLibraryLoaded() {
        if (!this.steem) {
            try {
                await this.loadLibrary();
            } catch (error) {
                console.error('Failed to load Steem library:', error);
                throw new Error('Steem library not loaded');
            }
        }
        return this.steem;
    }

    async executeWithRetry(operation, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.error(`Error in operation (attempt ${attempt + 1}):`, error);
                if (attempt === retries) throw error;
                this.switchEndpoint();
            }
        }
    }

    async executeApiMethod(methodName, params) {
        return this.executeWithRetry(() => {
            return new Promise((resolve, reject) => {
                this.steem.api[methodName](params, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        });
    }

    /**
     * Raw JSON-RPC call with automatic node failover.
     * Tries all endpoints in order until one returns a valid result.
     * @param {string} method - e.g. 'condenser_api.get_accounts'
     * @param {*} params - params array or object
     * @returns {Promise<*>} The `result` field from the RPC response
     */
    async rpcCall(method, params) {
        const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
        let lastError;

        for (let i = 0; i < this.apiEndpoints.length; i++) {
            const endpoint = this.apiEndpoints[(this.currentEndpoint + i) % this.apiEndpoints.length];
            let timeoutId;
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 7000);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const data = await response.json();

                if (data.error) {
                    lastError = new Error(data.error.message || JSON.stringify(data.error));
                    continue;
                }

                return data.result;
            } catch (err) {
                if (timeoutId) clearTimeout(timeoutId);
                lastError = err;
            }
        }

        throw lastError || new Error(`rpcCall failed for method: ${method}`);
    }
}