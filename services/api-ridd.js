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
            const startTime = Date.now();
            
            // Set a timeout for the fetch operation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout
            options.signal = controller.signal;
            
            // Attempt the request
            let response;
            try {
                response = await fetch(url, options);
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    console.error('Request timed out after 20 seconds');
                    throw new Error('Network request timed out. The server might be busy.');
                }
                throw fetchError;
            }
            
            const responseTime = Date.now() - startTime;
            console.log(`Response received in ${responseTime}ms with status: ${response.status}`);
            
            if (!response.ok) {
                // Enhance error detail based on HTTP status code
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                switch (response.status) {
                    case 401:
                        errorMessage = 'Authentication error: Invalid or missing credentials';
                        break;
                    case 403:
                        errorMessage = 'Forbidden: You don\'t have permission for this operation';
                        break;
                    case 404:
                        errorMessage = 'Server endpoint not found';
                        break;
                    case 429:
                        errorMessage = 'Too many requests. Please try again later';
                        break;
                    case 500:
                        errorMessage = 'Server error. The service might be experiencing issues';
                        break;
                    case 502:
                    case 503:
                    case 504:
                        errorMessage = 'Service temporarily unavailable. Please try again later';
                        break;
                }
                
                // Try to get more error details from response if possible
                try {
                    const errorDetail = await response.text();
                    console.error('Error response detail:', errorDetail);
                    
                    try {
                        // Try to parse as JSON
                        const jsonError = JSON.parse(errorDetail);
                        if (jsonError.message) {
                            errorMessage = jsonError.message;
                        }
                    } catch (e) {
                        // If not JSON, use the raw text if it's not too long
                        if (errorDetail && errorDetail.length < 100) {
                            errorMessage += `: ${errorDetail}`;
                        }
                    }
                } catch (e) {
                    console.error('Could not read error response', e);
                }
                
                throw new Error(errorMessage);
            }
            
            const jsonData = await response.json();
            return jsonData;
        } catch (error) {
            console.error('API request error:', error);
            // Add more detailed debugging info
            console.error('Failed request details:', {
                url,
                method,
                timestamp: new Date().toISOString(),
                telegramId: telegramData.id ? 'Present' : 'Not Present',
                errorName: error.name,
                errorMessage: error.message
            });
            
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

    SchedulePost(username, title, tags, body, scheduledTime, timezone, community) {
        // Usa sempre l'endpoint STEEM e non aggiunge header Telegram
        const url = 'https://imridd.eu.pythonanywhere.com/api/steem/save_scheduled';
        const payload = { 
            username: username, 
            title: title, 
            tags: tags, 
            body: body, 
            scheduledTime: scheduledTime, 
            timezone: timezone, 
            community: community 
        };
        console.log('[DEBUG] saveDraft payload:', payload);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            },
            body: JSON.stringify(payload)
        };
        return fetch(url, options).then(async response => {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Errore API: ${response.status} - ${errorText}`);
            }
            return response.json();
        });
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
    }    async createAccount(accountName) {
        console.log(`Creating account with name: ${accountName}`);
        try {
            const result = await this.sendRequest('/create_account', 'POST', { 
                new_account_name: accountName 
            });
            
            // Check if the result contains a success message despite any status code
            if (result.message && result.message.includes('created successfully')) {
                console.log(`Account creation successful: ${result.message}`);
                return {
                    ...result,
                    success: true
                };
            }
            
            return result;
        } catch (error) {
            console.error(`Account creation error for ${accountName}:`, error);
            
            // Check if the error message indicates success (this can happen with some APIs)
            if (error.message && error.message.includes('created successfully')) {
                console.log('Detected success message in error response');
                return {
                    success: true,
                    message: error.message
                };
            }
            
            // Rethrow with more context
            throw new Error(`Failed to create account "${accountName}": ${error.message}`);
        }
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

export class ApiScheduledClient {
    constructor() {
        this.apiKey = 'your_secret_api_key';
        this.baseUrl = 'https://imridd.eu.pythonanywhere.com/api/steem';
    }

    Get_ScheduledPosts(username) {
        const url = `${this.baseUrl}/get_user_scheduled?username=${username}`;
        return fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            }
        }).then(async response => {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }
            return response.json();
        });
    }

    async SchedulePost(username, title, tags = [], body, scheduledTime, timezone = 'UTC', community = '') {
        const url = `${this.baseUrl}/save_scheduled`;
        const payload = { 
            username, 
            title, 
            tags, 
            body, 
            scheduled_time: scheduledTime, 
            timezone, 
            community 
        };
        
        console.log('[DEBUG] ApiScheduledClient.SchedulePost payload:', payload);
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            },
            body: JSON.stringify(payload)
        };
        
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }

    async DeleteScheduledPost(postId, username) {
        const url = `${this.baseUrl}/delete_scheduled`;
        const payload = { id: postId, username };
        
        const options = {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            },
            body: JSON.stringify(payload)
        };
        
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }

    async UpdateScheduledPost(postId, username, updatedData) {
        const url = `${this.baseUrl}/update_scheduled`;
        const payload = { 
            id: postId, 
            username, 
            ...updatedData 
        };
        
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': this.apiKey
            },
            body: JSON.stringify(payload)
        };
        
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }
}