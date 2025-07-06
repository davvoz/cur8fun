"""
Client per interagire con l'API Steem/Hive senza dipendenze esterne
"""
import json
import re
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError

class SteemClient:
    def __init__(self):
        self.api_url = "https://api.steemit.com"
    
    def get_content(self, author, permlink):
        """Ottiene il contenuto di un post"""
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "condenser_api.get_content",
                "params": [author, permlink],
                "id": 1
            }
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self.api_url,
                data=data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'cur8.fun/1.0'
                }
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                if 'result' in result and result['result']:
                    return result['result']
                return None
                
        except (URLError, HTTPError, json.JSONDecodeError) as e:
            print(f"Error fetching content: {e}")
            return None
    
    def get_accounts(self, usernames):
        """Ottiene i profili utente"""
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "condenser_api.get_accounts",
                "params": [usernames],
                "id": 1
            }
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self.api_url,
                data=data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'cur8.fun/1.0'
                }
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                if 'result' in result and result['result']:
                    return result['result']
                return []
                
        except (URLError, HTTPError, json.JSONDecodeError) as e:
            print(f"Error fetching accounts: {e}")
            return []
    
    def extract_image_from_post(self, post_body, metadata=None):
        """Estrae la migliore immagine da un post"""
        if not post_body:
            return None
            
        # 1. Controlla metadata
        if metadata and isinstance(metadata, dict):
            if 'image' in metadata and metadata['image']:
                return self.optimize_image_url(metadata['image'][0])
            if 'thumbnail' in metadata and metadata['thumbnail']:
                return self.optimize_image_url(metadata['thumbnail'])
        
        # 2. Estrai da markdown
        markdown_pattern = r'!\[.*?\]\((https?://[^\s\)]+)\)'
        markdown_match = re.search(markdown_pattern, post_body)
        if markdown_match:
            return self.optimize_image_url(markdown_match.group(1))
        
        # 3. Estrai da HTML
        html_pattern = r'<img[^>]+src=["\'](https?://[^"\']+)["\'][^>]*>'
        html_match = re.search(html_pattern, post_body, re.IGNORECASE)
        if html_match:
            return self.optimize_image_url(html_match.group(1))
        
        # 4. Estrai URL diretti
        direct_pattern = r'(https?://[^\s<>"\']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"\']*)?)'
        direct_match = re.search(direct_pattern, post_body, re.IGNORECASE)
        if direct_match:
            return self.optimize_image_url(direct_match.group(1))
        
        # 5. Estrai da servizi specifici
        steem_pattern = r'https?://(?:steemitimages\.com|images\.hive\.blog|gateway\.pinata\.cloud|ipfs\.io)/[^\s<>"\']+' 
        steem_match = re.search(steem_pattern, post_body, re.IGNORECASE)
        if steem_match:
            return self.optimize_image_url(steem_match.group(0))
        
        return None
    
    def optimize_image_url(self, url):
        """Ottimizza URL immagine usando proxy Steem"""
        if not url or 'steemitimages.com' in url:
            return url
            
        # Pulisci URL
        clean_url = url.split('?')[0]
        
        try:
            # Verifica se l'URL è valido
            encoded_url = urllib.parse.quote(clean_url, safe=':/?#[]@!$&\'()*+,;=')
            return f"https://steemitimages.com/1200x630/{encoded_url}"
        except:
            return "https://cur8.fun/assets/img/logo_tra.png"
    
    def create_description(self, content, max_length=160):
        """Crea descrizione pulita dal contenuto"""
        if not content:
            return "Your Steem community social platform"
        
        # Rimuovi markdown e HTML
        clean_content = re.sub(r'!\[.*?\]\(.*?\)', '', content)  # Rimuovi immagini
        clean_content = re.sub(r'\[.*?\]\(.*?\)', '', clean_content)  # Rimuovi link
        clean_content = re.sub(r'<[^>]*>', '', clean_content)  # Rimuovi HTML
        clean_content = re.sub(r'#{1,6}\s', '', clean_content)  # Rimuovi header
        clean_content = re.sub(r'\*{1,2}(.*?)\*{1,2}', r'\1', clean_content)  # Rimuovi bold
        clean_content = re.sub(r'`{1,3}(.*?)`{1,3}', r'\1', clean_content)  # Rimuovi code
        clean_content = re.sub(r'\n+', ' ', clean_content)  # Sostituisci newline
        clean_content = re.sub(r'\s+', ' ', clean_content)  # Rimuovi spazi multipli
        clean_content = clean_content.strip()
        
        if len(clean_content) > max_length:
            clean_content = clean_content[:max_length] + '...'
        
        return clean_content or "Your Steem community social platform"
    
    def parse_metadata(self, json_metadata):
        """Parse metadata JSON"""
        if not json_metadata:
            return {}
        
        try:
            if isinstance(json_metadata, str):
                return json.loads(json_metadata)
            return json_metadata
        except:
            return {}

# Istanza globale del client
steem_client = SteemClient()
