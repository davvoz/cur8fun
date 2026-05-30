import time
import threading
from sniper_biz import SteemSniperBackend
import mysql.connector
from datetime import datetime, timezone
from beem import Steem
from beem import Hive
import config  # Importa il file di configurazione
from cryptography.fernet import Fernet
import requests
import re
from beem.community import Communities

cipher = Fernet(config.ENCRYPTION_KEY)

SNODES = [
    'https://api.moecki.online',
    'https://api.pennsif.net',
    'https://steemapi.boylikegirl.club',
    'https://cn.steems.top',
    'https://api.worldofxpilar.com',
    'https://api.upvu.org'
]

# Configura il nodo Hive personalizzato
HNODES = [
   # 'https://anyx.io',
    'https://api.openhive.network',
    'https://api.c0ff33a.uk',
    'https://hive-api.3speak.tv',
    #'https://anyx.io',
    'https://hive-api.arcange.eu',
    'https://techcoderx.com',
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://rpc.ausbit.dev',
    'https://hive.roelandp.nl'
]

# Funzione per ottenere la connessione al database
def get_db_connection():
    try:
        connection = mysql.connector.connect(**config.DATABASE_STEEM_CONFIG)
        return connection
    except mysql.connector.Error as err:
        print(f"Error connecting to database: {err}")
        return None


# Funzione per ottenere la lista delle communities
def get_communities(title_filter=None):
    hive = Hive(node=HNODES)
    communities = Communities(sort='rank', observer=None, last=None, limit=1000, lazy=False, full=True, blockchain_instance=hive)

    communities_list = []
    for community in communities:
        community_data = {
            'id': community['id'],
            'name': community['name'],
            'title': community['title'],
            'about': community.get('about', ''),
            'lang': community.get('lang', ''),
            'type': community.get('type', ''),
            'subscribers': community.get('subscribers', 0),
            'created': community.get('created', '')
        }
        # Filtra per titolo se il filtro è fornito
        if title_filter:
            if title_filter.lower() in community_data['title'].lower():
                communities_list.append(community_data)
        else:
            communities_list.append(community_data)

    return communities_list



def get_community_name_by_title(title):
    # Ottieni la lista delle community filtrate per il titolo
    communities_list = get_communities(title_filter=title)

    # Cerca nella lista una community con il titolo esatto
    for community in communities_list:
        if community['title'].lower() == title.lower():
            return community['name']  # Ritorna solo il 'name' della community trovata

    return None  # Ritorna None se non esiste una community con quel titolo


# Funzione per postare su Hive
def post_to_hive(username, posting_key, title, body, tags):
    try:
        hive = Hive(node=HNODES, keys=[posting_key])
        beneficiario = [{"account": "micro.cur8", "weight": 500}]

        # Posta su Hive e ottieni il risultato
        result = hive.post(
            title=title,
            body=body,
            author=username,
            tags=tags,
            beneficiaries=beneficiario
        )

        # Estrai il permlink dal risultato
        permlink = result['operations'][0][1]['permlink']

        # Costruisci l'URL del post
        post_url = f"https://peakd.com/{tags[0]}/@{username}/{permlink}"
        return post_url
    except Exception as e:
        print(f"Error posting to Hive: {e}")
        return None


# Funzione per ottenere la lista delle communities
def sget_communities(title_filter=None):
    steem = Steem(node=SNODES)
    communities = Communities(sort='rank', observer=None, last=None, limit=1000, lazy=False, full=True, blockchain_instance=steem)

    communities_list = []
    for community in communities:
        community_data = {
            'id': community['id'],
            'name': community['name'],
            'title': community['title'],
            'about': community.get('about', ''),
            'lang': community.get('lang', ''),
            'type': community.get('type', ''),
            'subscribers': community.get('subscribers', 0),
            'created': community.get('created', '')
        }
        # Filtra per titolo se il filtro è fornito
        if title_filter:
            if title_filter.lower() in community_data['title'].lower():
                communities_list.append(community_data)
        else:
            communities_list.append(community_data)

    return communities_list

def sget_community_name_by_title(title):
    # Ottieni la lista delle community filtrate per il titolo
    communities_list = sget_communities(title_filter=title)

    # Cerca nella lista una community con il titolo esatto
    for community in communities_list:
        if community['title'].lower() == title.lower():
            return community['name']  # Ritorna solo il 'name' della community trovata

    return None  # Ritorna None se non esiste una community con quel titolo

# Funzione per postare su Steem
def post_to_steem(username, posting_key, title, body, tags):
    try:
        steem = Steem(node=SNODES, keys=[posting_key])
        beneficiario = [{"account": "micro.cur8", "weight": 500}]

        # Posta su Steem e ottieni il risultato
        result = steem.post(
            title=title,
            body=body,
            author=username,
            tags=tags,
            beneficiaries=beneficiario
        )

        # Estrai il permlink dal risultato
        permlink = result['operations'][0][1]['permlink']

        # Costruisci l'URL del post
        post_url = f"https://cur8.fun/@{username}/{permlink}"
        return post_url
    except Exception as e:
        print(f"Error posting to Steem: {e}")
        return None

# Funzione per inviare il messaggio a Telegram con ritardo
def send_telegram_message_delayed(post_url, delay=10):
    time.sleep(delay)  # Ritardo prima dell'invio del messaggio
    telegram_bot_token = config.BOT_TOKEN
    telegram_chat_id = '@steem_animals'  # Prova con l'ID numerico se il canale è privato
    telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"

    # Log per il debug
    print(f"Bot Token: {telegram_bot_token}")
    print(f"Chat ID: {telegram_chat_id}")

    response = requests.post(telegram_url, data={
        'chat_id': telegram_chat_id,
        'text': post_url
    })

    # Controllo della risposta
    if response.status_code == 200:
        print("Messaggio inviato con successo su Telegram")
    else:
        print(f"Errore nell'invio del messaggio a Telegram. Status code: {response.status_code}, Response: {response.text}")


# Funzione per processare i drafts
def process_drafts():
    connection = get_db_connection()
    if not connection:
        print("Database connection error")
        return

    try:
        cursor = connection.cursor(dictionary=True)
        now_utc = datetime.now(timezone.utc)  # Ottieni la data e ora correnti in UTC

        cursor.execute("SELECT * FROM drafts")
        drafts = cursor.fetchall()

        for draft in drafts:
            username = draft['username']
            title = draft['title']
            body = draft['body']
            tags_input = draft['tags']
            scheduled_time_utc = draft['scheduled_time']  # Ora già in UTC
            community = draft['community']
            platform = draft['platform']

            if scheduled_time_utc is None:
                continue

            if scheduled_time_utc.tzinfo is None:
                scheduled_time_utc = scheduled_time_utc.replace(tzinfo=timezone.utc)

            print(f"Draft '{title}' scheduled for {scheduled_time_utc} UTC")

            # Verifica se il draft deve essere postato
            if now_utc >= scheduled_time_utc:
                # The community field stores the community code (e.g. hive-120997).
                # Try title lookup first (for legacy Telegram-bot drafts that stored titles),
                # but fall back to using the code directly if lookup returns nothing.
                if platform == 'Hive':
                    tag_community = get_community_name_by_title(community) or (community.strip().lower() if community else None)
                else:
                    tag_community = sget_community_name_by_title(community) or (community.strip().lower() if community else None)

                other_tags = [tag.strip().lower() for tag in re.split(r'[,\s]+', tags_input) if tag.strip()]
                if tag_community:
                    tags = [tag_community] + [t for t in other_tags if t != tag_community] + ["cur8"]
                else:
                    tags = other_tags + ["cur8"]

                posting_key = get_posting_key_from_db(username, platform)
                if posting_key:
                    if platform == 'Hive':
                        post_url = post_to_hive(username, posting_key, title, body, tags)
                    else:
                        post_url = post_to_steem(username, posting_key, title, body, tags)

                    if post_url:
                        print(f"Draft '{title}' posted successfully")
                        cursor.execute("DELETE FROM drafts WHERE id = %s AND platform = %s", (draft['id'], draft['platform']))
                        connection.commit()

                        # Esegui l'invio del messaggio a Telegram in un thread separato
                        delay = 10  # Ritardo in secondi
                        threading.Thread(target=send_telegram_message_delayed, args=(post_url, delay)).start()
                    else:
                        print(f"Failed to post draft '{title}' to '{platform}'")
                else:
                    print(f"Posting key for user '{username}' not found on platform '{platform}'")

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
    finally:
        cursor.close()
        connection.close()


# Funzione per decriptare la chiave di posting
def decrypt_posting_key(encrypted_posting_key):
    return cipher.decrypt(encrypted_posting_key).decode()

# Funzione per ottenere la chiave di posting dal database (curator)
def get_posting_key_from_db(username, platform):
    connection = get_db_connection()
    if not connection:
        print("Database connection error")
        return None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT posting_key FROM users WHERE username = %s AND platform = %s", (username,platform))
        results = cursor.fetchall()

        if results:
            encrypted_posting_key = results[0]['posting_key']
            if encrypted_posting_key is None:
                return config.CUR8_POSTING_HIVE if platform.lower() == "hive" else config.CUR8_POSTING_STEEM
            else:
                encrypted_posting_key = encrypted_posting_key.encode()
                posting_key = decrypt_posting_key(encrypted_posting_key)
                return posting_key
        else:
            print(f"User '{username}' not found on platform '{platform}'")
            return config.CUR8_POSTING_STEEM
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return None
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":

    # Ciclo principale per postare i draft
    while True:
        print("Processing drafts...")
        process_drafts()
        print("Waiting for the next cycle")
        time.sleep(60)  # Attende 60 secondi prima di eseguire di nuovo
