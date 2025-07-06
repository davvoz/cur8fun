"""
Servizio per generare meta tag dinamici HTML
"""
import os
from python.steem_client import steem_client

class MetaTagGenerator:
    def __init__(self):
        self.default_meta = {
            'title': 'cur8.fun',
            'description': 'Your Steem community social platform',
            'image': 'https://cur8.fun/assets/img/logo_tra.png',
            'url': 'https://cur8.fun/',
            'type': 'website'
        }
    
    def generate_post_meta(self, author, permlink, base_url='https://cur8.fun'):
        """Genera meta tag per un post specifico"""
        try:
            post = steem_client.get_content(author, permlink)
            
            if not post or post.get('id', 0) == 0:
                print(f"Warning: Post not found @{author}/{permlink}, using default meta")
                return self.generate_default_meta(f"{base_url}/@{author}/{permlink}")
            
            # Estrai immagine e metadata
            metadata = steem_client.parse_metadata(post.get('json_metadata', ''))
            image_url = steem_client.extract_image_from_post(post.get('body', ''), metadata)
            
            # Crea descrizione
            description = steem_client.create_description(post.get('body', ''), 160)
            
            return {
                'title': post.get('title', 'Post su Steem'),
                'description': description,
                'image': image_url or self.default_meta['image'],
                'url': f"{base_url}/@{author}/{permlink}",
                'type': 'article',
                'author': author,
                'published_time': post.get('created', ''),
                'site_name': 'cur8.fun'
            }
        except Exception as e:
            print(f"Error generating post meta for @{author}/{permlink}: {e}")
            return self.generate_default_meta(f"{base_url}/@{author}/{permlink}")
    
    def generate_profile_meta(self, username, base_url='https://cur8.fun'):
        """Genera meta tag per un profilo utente"""
        try:
            accounts = steem_client.get_accounts([username])
            
            if not accounts:
                print(f"Warning: Profile not found @{username}, using default meta")
                return self.generate_default_meta(f"{base_url}/@{username}")
            
            account = accounts[0]
            profile_data = {}
            
            # Parse profile metadata
            try:
                profile_json = account.get('posting_json_metadata', '{}')
                if profile_json:
                    profile_data = steem_client.parse_metadata(profile_json).get('profile', {})
            except:
                pass
            
            return {
                'title': f"@{username} su cur8.fun",
                'description': profile_data.get('about', f"Profilo di {username} su Steem"),
                'image': profile_data.get('profile_image') or f"https://steemitimages.com/u/{username}/avatar",
                'url': f"{base_url}/@{username}",
                'type': 'profile',
                'site_name': 'cur8.fun'
            }
        except Exception as e:
            print(f"Error generating profile meta for @{username}: {e}")
            return self.generate_default_meta(f"{base_url}/@{username}")
    
    def generate_default_meta(self, url=None):
        """Genera meta tag predefiniti"""
        meta = self.default_meta.copy()
        if url:
            meta['url'] = url
        return meta
    
    def generate_meta_tags_html(self, meta_data):
        """Genera HTML per i meta tag"""
        html_parts = []
        
        # Title
        html_parts.append(f'<title>{self.escape_html(meta_data["title"])}</title>')
        
        # Open Graph
        html_parts.append(f'<meta property="og:title" content="{self.escape_html(meta_data["title"])}" />')
        html_parts.append(f'<meta property="og:description" content="{self.escape_html(meta_data["description"])}" />')
        html_parts.append(f'<meta property="og:image" content="{self.escape_html(meta_data["image"])}" />')
        html_parts.append(f'<meta property="og:url" content="{self.escape_html(meta_data["url"])}" />')
        html_parts.append(f'<meta property="og:type" content="{meta_data["type"]}" />')
        html_parts.append(f'<meta property="og:site_name" content="{meta_data.get("site_name", "cur8.fun")}" />')
        
        # Open Graph image dimensions
        html_parts.append('<meta property="og:image:width" content="1200" />')
        html_parts.append('<meta property="og:image:height" content="630" />')
        html_parts.append(f'<meta property="og:image:alt" content="{self.escape_html(meta_data["title"])}" />')
        
        # Twitter Card
        card_type = 'summary_large_image' if meta_data.get('image') else 'summary'
        html_parts.append(f'<meta name="twitter:card" content="{card_type}" />')
        html_parts.append(f'<meta name="twitter:title" content="{self.escape_html(meta_data["title"])}" />')
        html_parts.append(f'<meta name="twitter:description" content="{self.escape_html(meta_data["description"])}" />')
        html_parts.append(f'<meta name="twitter:image" content="{self.escape_html(meta_data["image"])}" />')
        
        # Article specific tags
        if meta_data.get('type') == 'article':
            if meta_data.get('author'):
                html_parts.append(f'<meta property="article:author" content="https://cur8.fun/@{meta_data["author"]}" />')
            if meta_data.get('published_time'):
                html_parts.append(f'<meta property="article:published_time" content="{meta_data["published_time"]}" />')
        
        # Description meta tag
        html_parts.append(f'<meta name="description" content="{self.escape_html(meta_data["description"])}" />')
        
        return '\n    '.join(html_parts)
    
    def escape_html(self, text):
        """Escape caratteri HTML"""
        if not text:
            return ''
        return (str(text)
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#x27;'))

# Istanza globale
meta_generator = MetaTagGenerator()
