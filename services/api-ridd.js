import { displayResult } from '../components/dialog.js';
export class ApiClient {
    constructor() {
        this.apiKey = 'your_secret_api_key';
        let url_string = window.location.href
        let questionMarkCount = 0;
        let modified_url = url_string.replace(/\?/g, function(match) {
            questionMarkCount++;
            return questionMarkCount === 2 ? '&' : match;
        });
        const url = new URL(modified_url);
        const params = new URLSearchParams(url.search);
        const platform = params.get('platform') || localStorage.getItem('platform');
        
        // Valori predefiniti per quando l'app è aperta fuori da Telegram o senza parametri
        const baseUrlMap = {
            'STEEM': 'https://imridd.eu.pythonanywhere.com/api/steem',
            'HIVE': 'https://imridd.eu.pythonanywhere.com/api/hive',
        };
        
        // Se platform è null o non valido, usa STEEM come predefinito
        if (!platform || !baseUrlMap[platform]) {
            console.warn(`Platform parameter not specified or invalid: "${platform}". Using STEEM as default.`);
            this.baseUrl = baseUrlMap['STEEM'];
            // Salva la piattaforma predefinita per riferimento futuro
            localStorage.setItem('platform', 'STEEM');
        } else {
            this.baseUrl = baseUrlMap[platform];
        }

        console.log(`API Client initialized with platform: ${platform || 'STEEM'}, baseUrl: ${this.baseUrl}`);
    }

    async sendRequest(endpoint, method, data = null) {
        const telegramData = {
            'id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null,
            'first_name': window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || null,
            'username': window.Telegram?.WebApp?.initDataUnsafe?.user?.username || null,
            'auth_date': window.Telegram?.WebApp?.initDataUnsafe?.auth_date || null,
            'hash': window.Telegram?.WebApp?.initDataUnsafe?.hash || null
        };

        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            },
            body: data ? JSON.stringify(data) : null
        };

        // Aggiungi ID Telegram all'header solo se è disponibile
        if (telegramData.id) {
            options.headers['Id-Telegram'] = telegramData.id;
            options.headers['Telegram-Data'] = window.Telegram?.WebApp?.initData || '';
        }

        try {
            console.log(`Sending ${method} request to ${url}`);
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    login(idTelegram, username, postingKey) {
        return this.sendRequest('/login', 'POST', { id_telegram: idTelegram, username, posting_key: postingKey });
    }

    signerlogin(idTelegram, username, postingKey) {
        return this.sendRequest('/signerlogin', 'POST', { id_telegram: idTelegram, username, posting_key: postingKey });
    }

    logout(idTelegram, username) {
        return this.sendRequest('/logout', 'POST', { id_telegram: idTelegram, username });
    }

    saveDraft(username, title, tags, body, scheduledTime, timezone, community) {
        return this.sendRequest('/save_draft', 'POST', { username, title, tags, body, scheduled_time: scheduledTime, timezone, community });
    }

    getUserDrafts(username) {
        return this.sendRequest(`/get_user_drafts?username=${username}`, 'GET');
    }

    deleteDraft(id, username) {
        return this.sendRequest('/delete_draft', 'DELETE', { id, username });
    }

    postToSteem(username, title, body, tags, community) {
        console.log('Posting to Steem:', username, title, body, tags, community);
        return this.sendRequest('/post', 'POST', { username, title, body, tags, community });
    }

    async checkAccountExists(accountName) {
        try {
            // Ottieni la piattaforma attuale (STEEM o HIVE)
            let platform = localStorage.getItem('platform') || 'STEEM';
            
            // Determina il nodo API in base alla piattaforma
            let node = platform === 'STEEM' 
                ? "https://api.steemit.com"
                : "https://api.hive.blog";

            console.log(`Checking if account ${accountName} exists on ${platform} (node: ${node})`);
            
            const response = await fetch(node, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "condenser_api.get_accounts",
                    params: [[accountName]],
                    id: 1
                })
            });
            
            const data = await response.json();
            return data.result && data.result.length > 0;
        } catch (error) {
            console.error('Error checking account:', error);
            throw new Error('Failed to check account availability');
        }
    }

    createAccount(accountName) {
        return this.sendRequest('/create_account', 'POST', { 
            new_account_name: accountName 
        });
    }

    readAccount(username) {
        return this.sendRequest(`/read_account?username=${username}`, 'GET');
    }

    updateAccount(username, postingKey) {
        return this.sendRequest('/update_account', 'PUT', { username, posting_key: postingKey });
    }

    deleteAccount(username) {
        return this.sendRequest('/delete_account', 'DELETE', { username });
    }

    checkLogin(idTelegram) {
        return this.sendRequest('/check_login', 'POST', { id_telegram: idTelegram });
    }

    listaComunities() {
        return this.sendRequest('/communities', 'GET');
    }
}