from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pymysql
import re
import json

from beem.exceptions import AccountExistsException
import os
from logger_config import logger

from beem import Hive
from beem import Steem
from beem.account import Account
import requests
from beem.community import Communities, Community
from image_handler import ImageHandler
from image_handler_hive import ImageHandlerHive

from beemgraphenebase.account import PrivateKey
from beemgraphenebase.account import PasswordKey

from cryptography.fernet import Fernet

import hashlib
import hmac

import time
from urllib.parse import unquote, parse_qs
from flasgger import Swagger

import threading

#from flask_sqlalchemy import SQLAlchemy

from models import db, User, Draft, AccountCreation


app = Flask(__name__)
CORS(app)

API_KEY = os.getenv('API_KEY')
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
CMC_API_KEY = os.getenv('CMC_API_KEY')
DB_PSW = os.getenv('DB_PSW')
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_NAME_S = os.getenv('DB_NAME_S')
DB_NAME_H = os.getenv('DB_NAME_H')
DB_NAME_TG = os.getenv('DB_NAME_TG')
BOT_TOKEN_STEEM = os.getenv('TELEGRAM_BOT_TOKEN_STEEM')
BOT_TOKEN_HIVE = os.getenv('TELEGRAM_BOT_TOKEN_HIVE')
BOT_TOKEN_FUN = os.getenv('TELEGRAM_BOT_TOKEN_FUN')


# Inizializza ImageHandler con la directory di destinazione
image_handler = ImageHandler('/tmp/steem')  # /tmp è la directory dove vengono salvate temporaneamente le immagini

# Inizializza ImageHandler per Hive
hive_image_handler = ImageHandlerHive("/tmp/hive")


# Variabili per la connessione al database
host = DB_HOST
user = DB_USER
password = DB_PSW
database_steem = DB_NAME_S
database_hive = DB_NAME_H
database_tg = DB_NAME_TG



# Configura il nodo Hive personalizzato
hnodes = [
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

h = Hive(node=hnodes)

# Configura il nodo Steem personalizzato
snodes = [
    #'https://api.campingclub.me',
    'https://api.moecki.online',
    'https://api.pennsif.net',
    'https://steemapi.boylikegirl.club',
    'https://cn.steems.top',
    'https://api.worldofxpilar.com',
    'https://api.upvu.org'
]

s = Steem(node=snodes)

# Configura Swagger per utilizzare il file YAML
swagger = Swagger(app, template_file='SWAGGER_RIDD.yaml')

@app.route('/')
def home():
    return "Benvenuto nell'API RIDD! Vai su /apidocs per vedere la documentazione Swagger."



#######################################      STEEM & HIVE COMMUNITIES       ######################################################################################################




def get_community_name_by_title(title):
    try:
        connection = get_database_connection_hive()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT name FROM hive_communities
                WHERE LOWER(title) = LOWER(%s)
                LIMIT 1
            """, (title,))
            result = cursor.fetchone()
            return result["name"] if result else None
    finally:
        connection.close()




def sget_community_name_by_title(title):
    try:
        connection = get_database_connection_steem()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT name FROM steem_communities
                WHERE LOWER(title) = LOWER(%s)
                LIMIT 1
            """, (title,))
            result = cursor.fetchone()
            return result["name"] if result else None
    finally:
        connection.close()



# Route per ottenere la lista di tutte le community (dati di base)
@app.route('/api/hive/communities', methods=['GET'])
def get_all_communities():
    try:
        connection = get_database_connection_hive()
        with connection.cursor() as cursor:
            limit = int(request.args.get("limit", 10000))
            offset = int(request.args.get("offset", 0))
            cursor.execute("""
                SELECT name, title, about, language, subscribers, num_authors, sum_pending, is_nsfw
                FROM hive_communities
                LIMIT %s OFFSET %s
            """, (limit, offset))
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()

@app.route('/api/hive/communities/search', methods=['GET'])
def search_communities():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Parametro 'query' obbligatorio"}), 400

    like_query = f"%{query.lower()}%"

    try:
        connection = get_database_connection_hive()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT name, title, about, language, subscribers, is_nsfw
                FROM hive_communities
                WHERE LOWER(title) LIKE %s OR LOWER(about) LIKE %s
                LIMIT 100
            """, (like_query, like_query))
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()


# Route per ottenere i dettagli completi di una singola community
@app.route('/api/hive/community/<string:community_name>', methods=['GET'])
def get_community_details(community_name):
    hive = Hive(node=hnodes)

    try:
        # Ottieni i dettagli completi della community
        community = Community(community_name, blockchain_instance=hive)
        community_details = community.json()

    except Exception as e:
        logger.error(f"Errore durante il recupero dei dettagli per la community {community_name}: {str(e)}")
        return jsonify({'error': f"Errore durante il recupero dei dettagli per la community {community_name}"}), 500

    return jsonify(community_details)


# Route per cercare una community per titolo
@app.route('/api/hive/search_community', methods=['GET'])
def search_community_by_title():
    title = request.args.get('title')

    if not title:
        return jsonify({'error': 'Il parametro "title" è obbligatorio'}), 400

    try:
        hive = Hive(node=hnodes)  # Assicurati che snodes sia definito
        communities = Communities(blockchain_instance=hive)

        results = communities.search_title(title)

        if not results:
            return jsonify({'message': 'Nessuna community trovata con il titolo specificato'}), 404

        # Ritorna la lista delle community trovate
        return jsonify(results)

    except Exception as e:
        logger.error(f"Errore durante la ricerca della community con titolo {title}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Errore durante la ricerca della community: {str(e)}"}), 500


# Route per ottenere la lista di tutte le community (dati di base)
@app.route('/api/steem/communities', methods=['GET'])
def sget_all_communities():
    try:
        connection = get_database_connection_steem()
        with connection.cursor() as cursor:
            limit = int(request.args.get("limit", 10000))
            offset = int(request.args.get("offset", 0))
            cursor.execute("""
                SELECT name, title, about, language, subscribers, num_authors, sum_pending, is_nsfw
                FROM steem_communities
                LIMIT %s OFFSET %s
            """, (limit, offset))
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()

@app.route('/api/steem/communities/search', methods=['GET'])
def ssearch_communities():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Parametro 'query' obbligatorio"}), 400

    like_query = f"%{query.lower()}%"

    try:
        connection = get_database_connection_steem()
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT name, title, about, language, subscribers, is_nsfw
                FROM steem_communities
                WHERE LOWER(title) LIKE %s OR LOWER(about) LIKE %s
                LIMIT 100
            """, (like_query, like_query))
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()




# Route per ottenere i dettagli completi di una singola community
@app.route('/api/steem/community/<string:community_name>', methods=['GET'])
def sget_community_details(community_name):
    steem = Steem(node=snodes)

    try:
        # Ottieni i dettagli completi della community
        community = Community(community_name, blockchain_instance=steem)
        community_details = community.json()

    except Exception as e:
        logger.error(f"Errore durante il recupero dei dettagli per la community {community_name}: {str(e)}")
        return jsonify({'error': f"Errore durante il recupero dei dettagli per la community {community_name}"}), 500

    return jsonify(community_details)


# Route per cercare una community per titolo
@app.route('/api/steem/search_community', methods=['GET'])
def ssearch_community_by_title():
    title = request.args.get('title')

    if not title:
        return jsonify({'error': 'Il parametro "title" è obbligatorio'}), 400

    try:
        steem = Steem(node=snodes)  # Assicurati che snodes sia definito
        communities = Communities(blockchain_instance=steem)

        results = communities.search_title(title)

        if not results:
            return jsonify({'message': 'Nessuna community trovata con il titolo specificato'}), 404

        # Ritorna la lista delle community trovate
        return jsonify(results)

    except Exception as e:
        logger.error(f"Errore durante la ricerca della community con titolo {title}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Errore durante la ricerca della community: {str(e)}"}), 500


#######################################      HIVE DATA STATS       ##############################################################################################################


def get_database_connection_hive():
    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=database_hive,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )



def check_delegators_h(account_name):
    account = Account(account_name, hive_instance=h)
    delegators = {}

    for op in account.history(only_ops=['delegate_vesting_shares']):
        delegator = op['delegator']
        delegatee = op['delegatee']
        vesting_shares_amount = h.vests_to_hp(float(op['vesting_shares']['amount'])) / 1000000

        if delegatee == account_name:
            if vesting_shares_amount == 0:
                if delegator in delegators:
                    del delegators[delegator]
            else:
                delegators[delegator] = vesting_shares_amount

    # Ordina i delegatori per quantità di vesting shares delegate e prendi i primi 10
    sorted_delegators = sorted(delegators.items(), key=lambda item: item[1], reverse=True)[:10]

    return sorted_delegators


#HIVE CUR8 DATA
@app.route('/api/hive', methods=['GET'])
def get_hive_data():
    try:
        connection = get_database_connection_hive()
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM hive_data")
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()


#HIVE CUR8_7D
@app.route('/api/hive_cur', methods=['GET'])
def get_hive_curation_rewards_data():
    try:
        connection = get_database_connection_hive()
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM hive_curation_rewards ORDER BY id DESC")
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()



#HIVE REPUTATION
@app.route('/api/hive/rep/<string:account_name>', methods=['GET'])
def calcola_rep(account_name):
    account = Account(account_name, blockchain_instance=h)
    rep = account.get_reputation()
    print(rep)
    return jsonify(rep)

#HIVE FOLLOW_REP
@app.route('/api/hive/follow/<string:account_name>', methods=['GET'])
def calcola_follow_count(account_name):
    account = Account(account_name, blockchain_instance=h)
    follow_count = account.get_follow_count(account=account_name)
    rep = account.get_reputation()
    return jsonify({
        'following_count': follow_count['following_count'],
        'follower_count': follow_count['follower_count'],
        'rep': rep
    })

#HIVE GET_ACCOUNT
@app.route('/api/hive/<string:account_name>', methods=['GET'])
def get_account_details(account_name):
    try:
        account = Account(account_name, blockchain_instance=h)
        account_details = {
            'user': account,
            'status': '200'
        }
        return jsonify(account_details)
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500

#HIVE ACCOUNT_HISTORY
@app.route('/api/hive/history/<string:account_name>', methods=['GET'])
def get_recent_transactions_h(account_name, limit=100):
    # Inizializza l'oggetto Account per l'account specificato
    account = Account(account_name, steem_instance=h)

    # Ottieni il numero massimo di operazioni virtuali dell'account
    max_op_count = account.virtual_op_count()

    # Ottieni le ultime transazioni
    recent_transactions = []
    for op in account.history(start=max_op_count - limit, stop=max_op_count, use_block_num=False):
        transaction_type = op['type']
        transaction_details = {}

        if transaction_type == 'transfer':
            transaction_details['from'] = op['from']
            transaction_details['to'] = op['to']
            transaction_details['amount'] = op['amount']
            transaction_details['memo'] = op['memo']
        elif transaction_type == 'comment':
            transaction_details['author'] = op['author']
            transaction_details['permlink'] = op['permlink']
            transaction_details['title'] = op['title']
            transaction_details['body'] = op['body']
        elif transaction_type == 'vote':
            transaction_details['voter'] = op['voter']
            transaction_details['author'] = op['author']
            transaction_details['permlink'] = op['permlink']
            transaction_details['weight'] = op['weight']
        elif transaction_type == 'transfer_to_vesting':
            transaction_details['from'] = op['from']
            transaction_details['to'] = op['to']
            transaction_details['amount'] = op['amount']
        elif transaction_type == 'withdraw_vesting':
            transaction_details['account'] = op['account']
            transaction_details['vesting_shares'] = op['vesting_shares']
        elif transaction_type == 'curation_reward':
            transaction_details['reward'] = op['reward']
        elif transaction_type == 'delegate_vesting_shares':
            transaction_details['delegator'] = op['delegator']
            transaction_details['amount'] = op['vesting_shares']
        else:
            continue

        transaction = {
            'type': transaction_type,
            'timestamp': op['timestamp'],
            'details': transaction_details
        }

        recent_transactions.append(transaction)

    return jsonify({'transactions': recent_transactions})

# HIVE TOP DELEGATORS
@app.route('/api/hive/delegators/<account_name>', methods=['GET'])
def get_top_delegators_h(account_name):
    top_delegators = check_delegators_h(account_name)
    return jsonify(top_delegators)


#######################################      STEEM DATA STATS       ###########################################################################################################

def get_database_connection_steem():
    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=database_steem,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )


def check_delegators_s(account_name):
    account = Account(account_name, hive_instance=s)
    delegators = {}

    for op in account.history(only_ops=['delegate_vesting_shares']):
        delegator = op['delegator']
        delegatee = op['delegatee']
        vesting_shares_amount = s.vests_to_sp(float(op['vesting_shares']['amount'])) / 1000000

        if delegatee == account_name:
            if vesting_shares_amount == 0:
                if delegator in delegators:
                    del delegators[delegator]
            else:
                delegators[delegator] = vesting_shares_amount

    # Ordina i delegatori per quantità di vesting shares delegate e prendi i primi 10
    sorted_delegators = sorted(delegators.items(), key=lambda item: item[1], reverse=True)[:10]

    return sorted_delegators



#STEEM CUR8 DATA
@app.route('/api/steem', methods=['GET'])
def get_steem_data():
    try:
        connection = get_database_connection_steem()
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM steem_data")
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()



#STEEM CUR8_7D
@app.route('/api/steem_cur', methods=['GET'])
def get_steem_curation_rewards_data():
    try:
        connection = get_database_connection_steem()
        with connection.cursor() as cursor:
            # Supponendo che la tua tabella abbia una colonna "id" o "timestamp" per l'ordinamento
            cursor.execute("SELECT * FROM steem_curation_rewards ORDER BY id DESC")  # Usa "id" o la colonna appropriata
            data = cursor.fetchall()
        return jsonify(data)
    finally:
        connection.close()


#STEEM REPUTATION
@app.route('/api/steem/rep/<string:account_name>', methods=['GET'])
def scalcola_rep(account_name):
    account = Account(account_name, blockchain_instance=s)
    rep = account.get_reputation()
    return jsonify(rep)


#STEEM FOLLOW_REP
@app.route('/api/steem/follow/<string:account_name>', methods=['GET'])
def scalcola_follow_count(account_name):
    account = Account(account_name, blockchain_instance=s)
    rep = account.get_reputation()
    follow_count = account.get_follow_count(account=account_name)
    return jsonify({
        'following_count': follow_count['following_count'],
        'follower_count': follow_count['follower_count'],
        'rep': rep
    })


#STEEM GET_ACCOUNT
@app.route('/api/steem/<string:account_name>', methods=['GET'])
def sget_account_details(account_name):
    try:
        account = Account(account_name, blockchain_instance=s)
        account_details = {
            'user': account,
            'status': '200'
        }
        return jsonify(account_details)
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': str(e)}), 500


#STEEM ACCOUNT_HISTORY
@app.route('/api/steem/history/<string:account_name>', methods=['GET'])
def get_recent_transactions_s(account_name, limit=100):
    # Inizializza l'oggetto Account per l'account specificato
    account = Account(account_name, steem_instance=s)

    # Ottieni il numero massimo di operazioni virtuali dell'account
    max_op_count = account.virtual_op_count()

    # Ottieni le ultime transazioni
    recent_transactions = []
    for op in account.history(start=max_op_count - limit, stop=max_op_count, use_block_num=False):
        transaction_type = op['type']
        transaction_details = {}

        if transaction_type == 'transfer':
            transaction_details['from'] = op['from']
            transaction_details['to'] = op['to']
            transaction_details['amount'] = op['amount']
            transaction_details['memo'] = op['memo']
        elif transaction_type == 'comment':
            transaction_details['author'] = op['author']
            transaction_details['permlink'] = op['permlink']
            transaction_details['title'] = op['title']
            transaction_details['body'] = op['body']
        elif transaction_type == 'vote':
            transaction_details['voter'] = op['voter']
            transaction_details['author'] = op['author']
            transaction_details['permlink'] = op['permlink']
            transaction_details['weight'] = op['weight']
        elif transaction_type == 'transfer_to_vesting':
            transaction_details['from'] = op['from']
            transaction_details['to'] = op['to']
            transaction_details['amount'] = op['amount']
        elif transaction_type == 'withdraw_vesting':
            transaction_details['account'] = op['account']
            transaction_details['vesting_shares'] = op['vesting_shares']
        elif transaction_type == 'curation_reward':
            transaction_details['reward'] = op['reward']
        elif transaction_type == 'delegate_vesting_shares':
            transaction_details['delegator'] = op['delegator']
            transaction_details['amount'] = op['vesting_shares']
        else:
            continue

        transaction = {
            'type': transaction_type,
            'timestamp': op['timestamp'],
            'details': transaction_details
        }

        recent_transactions.append(transaction)

    return jsonify({'transactions': recent_transactions})


#STEEM TOP DELEGATORS
@app.route('/api/steem/delegators/<account_name>', methods=['GET'])
def get_top_delegators_s(account_name):
    top_delegators = check_delegators_s(account_name)
    return jsonify(top_delegators)




#######################################      STEEM & HIVE PRICES       ######################################################################################################


#PREZZI
@app.route('/api/prices', methods=['GET'])
def get_prices():
    # Chiave API di CoinMarketCap
    COIN_API_KEY = CMC_API_KEY

    # URL dell'API di CoinMarketCap per ottenere i prezzi
    url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest"

    # Parametri della richiesta
    params = {
        "symbol": "HIVE,HBD,STEEM,SBD",
        "convert": "USD"
    }

    # Intestazione della richiesta con la chiave API
    headers = {
        "Accepts": "application/json",
        "X-CMC_PRO_API_KEY": COIN_API_KEY
    }

    # Effettua la richiesta GET
    response = requests.get(url, params=params, headers=headers)

    # Controlla se la richiesta ha avuto successo
    if response.status_code == 200:
        # Estrai i dati della risposta
        data = response.json()
        quotes = data["data"]

        # Crea un dizionario per i prezzi
        prices = {}
        for symbol, quote in quotes.items():
            prices[symbol] = quote['quote']['USD']['price']

        # Restituisci i prezzi come JSON
        return jsonify(prices)
    else:
        # Se la richiesta non ha avuto successo, restituisci un messaggio di errore
        return jsonify({"error": "Errore nella richiesta: " + str(response.status_code)})





#######################################      TELEGRAM DB CONFIG       #################################################################################################



# Configurazione del database, sostituisci con le tue credenziali
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{user}:{password}@{host}/{database_tg}?charset=utf8mb4'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


# Aggiunta di pool_pre_ping per controllare la connessione prima di ogni query
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,   # Verifica che la connessione sia attiva
    'pool_recycle': 1800,    # Ricicla la connessione dopo 30 minuti per evitare timeout
}



# Inizializza il database con SQLAlchemy
db.init_app(app)

# Crea le tabelle
with app.app_context():
    db.create_all()


#######################################      SECURITY & VERIFY       #################################################################################################


def verify_telegram_hash(data, telegram_hash, bot_token):
    # Crea la stringa di controllo concatenata con i dati ordinati alfabeticamente
    check_string = "\n".join([f"{k}={v}" for k, v in sorted(data.items())])

    # Crea la chiave segreta HMAC-SHA-256 del bot_token con la stringa "WebAppData"
    secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()

    # Calcola l'hash HMAC-SHA256 della stringa di controllo utilizzando la chiave segreta
    calculated_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

    # Debug: stampa i valori per confrontarli
    print(f"Check String: {check_string}")
    print(f"Calculated Hash: {calculated_hash}")
    print(f"Received Hash: {telegram_hash}")

    # Confronta l'hash calcolato con l'hash ricevuto
    return calculated_hash == telegram_hash


def validate_telegram_data_steem(request):
    """Verifica i dati Telegram e restituisce l'ID Telegram se valido."""
    telegram_data_encoded = request.headers.get('Telegram-Data')
    if not telegram_data_encoded:
        return {'error': 'Missing Telegram data'}, 400


    try:
        # Decodifica la stringa URL-encoded in un dizionario
        telegram_data = parse_qs(telegram_data_encoded)
        telegram_data = {key: unquote(value[0]) for key, value in telegram_data.items()}
    except Exception as e:
        logger.error(e, exc_info=True)
        return {'error': 'Invalid Telegram data', 'details': str(e)}, 400


    # Verifica che il campo 'hash' sia presente
    if 'hash' not in telegram_data:
        return {'error': 'Missing field: hash'}, 400


    # Estrai l'hash da confrontare
    telegram_hash = telegram_data.pop('hash')

    # Verifica l'hash
    if not (verify_telegram_hash(telegram_data, telegram_hash, BOT_TOKEN_STEEM) or
        verify_telegram_hash(telegram_data, telegram_hash, BOT_TOKEN_FUN)):
        return {'error': 'Invalid Telegram hash'}, 403


    # Verifica che i dati non siano scaduti
    if (time.time() - int(telegram_data.get('auth_date', 0))) > 86400:
        return {'error': 'Authorization data is outdated'}, 403


    # Estrai l'ID Telegram dal campo 'user', che è un JSON serializzato
    try:
        user_data = telegram_data.get('user')
        if user_data:
            user_dict = json.loads(user_data)
            id_telegram = user_dict.get('id')
        else:
            return {'error': 'Missing user data'}, 400

    except Exception as e:
        logger.error(e, exc_info=True)
        return {'error': 'Failed to parse user data', 'details': str(e)}, 400


    if not id_telegram:
        return {'error': 'Missing Telegram user ID'}, 400


    # Restituisci l'ID Telegram se la verifica ha successo
    return id_telegram, 200


def validate_telegram_data_hive(request):
    """Verifica i dati Telegram e restituisce l'ID Telegram se valido."""
    telegram_data_encoded = request.headers.get('Telegram-Data')
    if not telegram_data_encoded:
        return {'error': 'Missing Telegram data'}, 400


    try:
        # Decodifica la stringa URL-encoded in un dizionario
        telegram_data = parse_qs(telegram_data_encoded)
        telegram_data = {key: unquote(value[0]) for key, value in telegram_data.items()}
    except Exception as e:
        logger.error(e, exc_info=True)
        return {'error': 'Invalid Telegram data', 'details': str(e)}, 400


    # Verifica che il campo 'hash' sia presente
    if 'hash' not in telegram_data:
        return {'error': 'Missing field: hash'}, 400


    # Estrai l'hash da confrontare
    telegram_hash = telegram_data.pop('hash')

    # Verifica l'hash
    if not verify_telegram_hash(telegram_data, telegram_hash, BOT_TOKEN_HIVE):
        return {'error': 'Invalid Telegram hash'}, 403


    # Verifica che i dati non siano scaduti
    if (time.time() - int(telegram_data.get('auth_date', 0))) > 86400:
        return {'error': 'Authorization data is outdated'}, 403


    # Estrai l'ID Telegram dal campo 'user', che è un JSON serializzato
    try:
        user_data = telegram_data.get('user')
        if user_data:
            user_dict = json.loads(user_data)
            id_telegram = user_dict.get('id')
        else:
            return {'error': 'Missing user data'}, 400

    except Exception as e:
        logger.error(e, exc_info=True)
        return {'error': 'Failed to parse user data', 'details': str(e)}, 400


    if not id_telegram:
        return {'error': 'Missing Telegram user ID'}, 400


    # Restituisci l'ID Telegram se la verifica ha successo
    return id_telegram, 200

cipher = Fernet(ENCRYPTION_KEY)

def encrypt_posting_key(posting_key):
    return cipher.encrypt(posting_key.encode())

def decrypt_posting_key(encrypted_posting_key):
    # Assumi che encrypted_posting_key sia già in formato bytes
    return cipher.decrypt(encrypted_posting_key).decode()


##################################################################


def send_telegram_message_animals(post_url):
    # Attende il tempo specificato in secondi prima di inviare il messaggio
   # time.sleep(delay)

    telegram_bot_token = BOT_TOKEN_STEEM  # Assicurati che BOT_TOKEN sia configurato correttamente
    telegram_chat_id = '@steem_animals'  # Nome del canale Telegram
    telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"

    # Esegui la richiesta per inviare il messaggio a Telegram
    response = requests.post(telegram_url, data={
        'chat_id': telegram_chat_id,
        'text': post_url
    })

    # Controlla la risposta e stampa dettagli per il debug
    if response.status_code == 200:
        print("Messaggio inviato con successo su Telegram")
    else:
        print("Errore nell'invio del messaggio a Telegram")
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")



def send_telegram_message_pirati(post_url):

    telegram_bot_token = BOT_TOKEN_HIVE  # Assicurati che BOT_TOKEN sia configurato correttamente
    telegram_chat_id = '-1002247582547'  # Nome del canale Telegram
    telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"

    # Esegui la richiesta per inviare il messaggio a Telegram
    response = requests.post(telegram_url, data={
        'chat_id': telegram_chat_id,
        'text': post_url
    })

    # Controlla la risposta e stampa dettagli per il debug
    if response.status_code == 200:
        print("Messaggio inviato con successo su Telegram")
    else:
        print("Errore nell'invio del messaggio a Telegram")
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")




def get_telegram_name_hive(id_telegram):
    """Recupera l'username o, in alternativa, il nome dell'utente Telegram"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN_HIVE}/getChat"
    params = {"chat_id": id_telegram}

    response = requests.get(url, params=params)
    data = response.json()

    if data.get("ok"):
        username = data["result"].get("username")  # Se l'utente ha un username
        first_name = data["result"].get("first_name")  # Nome dell'utente

        if username:
            return f"@{username}"  # Se ha un username, usa quello
        elif first_name:
            return first_name  # Altrimenti usa il nome
        else:
            return "Utente Sconosciuto"  # Caso estremo in cui non ci sia nessuna info
    else:
        print(f"Errore: {data}")
        return "Utente Sconosciuto"

def get_telegram_name_steem(id_telegram):
    """Recupera l'username o, in alternativa, il nome dell'utente Telegram"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN_STEEM}/getChat"
    params = {"chat_id": id_telegram}

    response = requests.get(url, params=params)
    data = response.json()

    if data.get("ok"):
        username = data["result"].get("username")  # Se l'utente ha un username
        first_name = data["result"].get("first_name")  # Nome dell'utente

        if username:
            return f"@{username}"  # Se ha un username, usa quello
        elif first_name:
            return first_name  # Altrimenti usa il nome
        else:
            return "Utente Sconosciuto"  # Caso estremo in cui non ci sia nessuna info
    else:
        print(f"Errore: {data}")
        return "Utente Sconosciuto"




@app.route('/api/telegram/send_message_animals', methods=['POST'])
def send_message_animals():
    data = request.get_json()
    if not data or 'post_url' not in data:
        return jsonify({"error": "Campo 'post_url' mancante"}), 400

    post_url = data['post_url']
    result = send_telegram_message_animals(post_url)
    return jsonify(result), 200



#######################################      STEEM TELEGRAM API       #################################################################################################



def verify_posting_key_steem(username, posting_key):
    try:
        # Inizializza Steem
        steem = Steem(node=snodes)

        # Deriva la chiave pubblica dalla chiave privata di posting
        posting_pub_key = str(PrivateKey(posting_key).pubkey)

        # Ottieni le informazioni sull'account dato il nome utente
        account = Account(username, steem_instance=steem)

        # Recupera la chiave pubblica di posting registrata per l'account
        registered_posting_pub_key = account['posting']['key_auths'][0][0]

        # Verifica se la chiave pubblica derivata corrisponde a quella registrata
        if posting_pub_key == registered_posting_pub_key:
            print("Il nome utente è corretto e corrisponde alla chiave privata di posting fornita.")
            return True
        else:
            print("Il nome utente fornito NON corrisponde alla chiave privata di posting.")
            return False

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error verifying posting key: {e}")
        return False


def get_profile_image_steem(username):
    try:
        # Effettua una richiesta all'API di Steemit per recuperare le informazioni dell'account
        response = requests.get(f"https://steemit.com/@{username}.json")

        if response.status_code == 200:
            user_data = response.json()

            # Stampa i metadati per verificare il loro contenuto
            #print(f"Metadati dell'utente {username}: {user_data}")

            # Controlla se l'account ha metadati del profilo
            if 'user' in user_data and 'posting_json_metadata' in user_data['user']:
                posting_metadata = user_data['user']['posting_json_metadata']

                # Verifica se i metadati sono una stringa JSON valida
                if posting_metadata:
                    try:
                        profile_data = json.loads(posting_metadata).get('profile', {})
                        profile_image = profile_data.get('profile_image', None)
                        return profile_image if profile_image else None
                    except json.JSONDecodeError:
                        print(f"Errore nel decodificare i metadati JSON per {username}: {posting_metadata}")
                        return None

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Errore durante il recupero dell'immagine del profilo: {str(e)}")
        return None

    return None  # Se non ci sono metadati o altri problemi



def get_usernames_steem(id_telegram):
    try:
        # Query per trovare utenti con l'id_telegram fornito
        users = User.query.filter_by(id_telegram=id_telegram, platform='Steem').all()

        if users:
            usernames_with_images = []
            for user in users:
                username = user.username
                profile_image = get_profile_image_steem(username)  # Usa la funzione per ottenere l'immagine del profilo

                # Aggiungi username e immagine se presente
                if profile_image:
                    usernames_with_images.append({
                        'profile_image': profile_image,
                        'username': username
                    })
                else:
                    usernames_with_images.append({
                        'username': username
                    })

            return {'usernames': usernames_with_images}, 200
        else:
            return {'message': 'User not logged in'}, 201
    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return {'error': 'Database query error'}, 500


def post_to_steem(username, posting_key, title, body, tags):
    try:
        steem = Steem(node=snodes, keys=[posting_key])
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
        post_url = f"https://cur8.fun/@{username}/{permlink}"
        return post_url, None

    except Exception as e:
        logger.error(e, exc_info=True)
        error_message = str(e)

        # Identifica messaggi di errore specifici per l'utente
        if "RC, needs" in error_message:
            user_message = "Insufficient RC. Please wait for credits to recharge or power up."
        elif "You may only post once every 5 minutes" in error_message:
            user_message = "Please wait 5 minutes before posting again."
        else:
            user_message = "An error occurred while posting. Please try again later."

        # Log del messaggio di errore
        print(f"Error posting to Steem: {error_message}")
        return None, user_message




@app.route('/api/steem/check_login', methods=['POST'])
def check_login_steem():
       # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram dal corpo della richiesta
    #id_telegram = request.json.get('id_telegram')

    # Procedi con la logica del login
    response, status_code = get_usernames_steem(id_telegram)

    if status_code == 200:
        return jsonify({
            'message': 'User is already logged in',
            'usernames': response['usernames']
        }), 200

    return jsonify(response), status_code




@app.route('/api/steem/login', methods=['POST'])
def login_steem():

           # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result


    # Ottieni i dati dal corpo della richiesta
   # id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')
    posting_key = request.json.get('posting_key')

    # Controlla che i campi obbligatori siano presenti
    if not id_telegram or not username or not posting_key:
        return jsonify({'error': 'id_telegram, username e posting_key sono obbligatori'}), 400

    if not verify_posting_key_steem(username, posting_key):
        return jsonify({'error': 'Invalid posting key'}), 400
    encrypted_posting_key = encrypt_posting_key(posting_key)

    try:
        # Controlla se l'utente esiste già nel database
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

        if user:
            return jsonify({'message': 'User already exists in the database'}), 200

        # Crea un nuovo utente e salva nel database
        new_user = User(
            id_telegram=id_telegram,
            username=username,
            posting_key=encrypted_posting_key,  # Inserisci NULL se non esiste una posting_key
            platform='Steem'
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User successfully logged in and saved to the database'}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return jsonify({'error': 'Database query error'}), 500


@app.route('/api/steem/signerlogin', methods=['POST'])
def login_steemlogin():

           # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result


    # Ottieni i dati dal corpo della richiesta
    #id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')
    posting_key = os.getenv('CUR8_POSTING_STEEM')

    # Controlla che i campi obbligatori siano presenti
    if not id_telegram or not username or not posting_key:
        return jsonify({'error': 'id_telegram, username e posting_key sono obbligatori'}), 400

    #if not verify_posting_key_steem(username, posting_key):
    #    return jsonify({'error': 'Invalid posting key'}), 400
    encrypted_posting_key = encrypt_posting_key(posting_key)

    try:
        # Controlla se l'utente esiste già nel database
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

        if user:
            return jsonify({'message': 'User already exists in the database'}), 200

        # Crea un nuovo utente e salva nel database
        new_user = User(
            id_telegram=id_telegram,
            username=username,
            posting_key=encrypted_posting_key,  # Inserisci NULL se non esiste una posting_key
            platform='Steem'
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User successfully logged in and saved to the database'}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return jsonify({'error': 'Database query error'}), 500



@app.route('/api/steem/logout', methods=['POST'])
def logout_steem():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    #id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')

    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        # Verifica se l'utente esiste
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Elimina l'utente
        db.session.delete(user)
        db.session.commit()

        # Verifica se ci sono altri utenti con lo stesso username
        remaining_users = User.query.filter_by(username=username, platform='Steem').count()

        if remaining_users == 0:
            # Se non ci sono più utenti con lo stesso username, elimina i draft associati
            Draft.query.filter_by(username=username, platform='Steem').delete()
            db.session.commit()

        return jsonify({'message': 'Logout successful'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()  # In caso di errore, annulla la transazione
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/steem/save_draft', methods=['POST'])
def save_draft_steem():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

   # id_telegram = request.headers.get('Id-Telegram')

    username = request.json.get('username')
    title = request.json.get('title')
    tags = request.json.get('tags')
    body = request.json.get('body')
    scheduled_time = request.json.get('scheduled_time')  # Optional
    timezone = request.json.get('timezone')  # Optional
    community = request.json.get('community')


    # Verifica che i campi obbligatori siano presenti
    if not id_telegram or not username or not title or not body:
        return jsonify({'error': 'ID Telegram, username, title, and body are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
      #  user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

      #  if not user:
       #     return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Salva il draft nel database
        new_draft = Draft(
            username=username,
            title=title,
            tags=tags,
            body=body,
            scheduled_time=scheduled_time,  # Facoltativo
            timezone=timezone,  # Facoltativo
            community=community,
            platform='Steem'
        )

        db.session.add(new_draft)
        db.session.commit()

        return jsonify({'message': 'Draft saved successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()  # In caso di errore, annulla la transazione
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/steem/get_user_drafts', methods=['GET'])
def get_user_drafts_steem():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram e l'username dai parametri della richiesta
   # id_telegram = request.headers.get('Id-Telegram')

    username = request.args.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Recupera tutti i drafts associati all'username
        drafts = Draft.query.filter_by(username=username, platform='Steem').all()

        # Se non ci sono drafts, restituisci una lista vuota
        if not drafts:
            return jsonify([]), 200

        # Converti i drafts in formato serializzabile
        drafts_list = [
            {
                'id': draft.id,
                'username': draft.username,
                'title': draft.title,
                'tags': draft.tags,
                'body': draft.body,
                'scheduled_time': draft.scheduled_time,
                'timezone': draft.timezone,
                'community': draft.community
            } for draft in drafts
        ]

        return jsonify(drafts_list), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/steem/delete_draft', methods=['DELETE'])
def delete_draft_steem():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram e l'username dalla richiesta
   # id_telegram = request.headers.get('Id-Telegram')

    draft_id = request.json.get('id')
    username = request.json.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not draft_id or not username or not id_telegram:
        return jsonify({'error': 'Draft ID, username, and ID Telegram are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()

        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Verifica se il draft esiste e appartiene all'utente
        draft = Draft.query.filter_by(id=draft_id, username=username, platform='Steem').first()

        if not draft:
            return jsonify({'error': 'Draft not found or not owned by the user'}), 404

        # Elimina il draft
        db.session.delete(draft)
        db.session.commit()

        return jsonify({'message': 'Draft deleted successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/steem/post', methods=['POST'])
def post_to_steem_endpoint():

    # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    #id_telegram = request.headers.get('Id-Telegram')

    username = request.json.get('username')
    title = request.json.get('title')
    body = request.json.get('body')
    tags_input = request.json.get('tags')
    community = request.json.get('community')

    tag_community = sget_community_name_by_title(community)
    if tag_community:
        tags = [tag_community] + ["cur8"] +  [tag.strip().lower() for tag in re.split(r'[,\s]+', tags_input) if tag.strip()]
    else:
        tags = ["cur8"] + [tag.strip().lower() for tag in re.split(r'[,\s]+', tags_input) if tag.strip()]

    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Steem').first()
        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        encrypted_posting_key = user.posting_key
        if not encrypted_posting_key:
            posting_key = os.getenv('CUR8_POSTING_STEEM')
            if not posting_key:
                return jsonify({'error': 'CUR8_POSTING_STEEM key is not available in the environment'}), 500
        else:
            encrypted_posting_key = encrypted_posting_key.encode()
            posting_key = decrypt_posting_key(encrypted_posting_key)

        # Esegui il post su Steem e ottieni il risultato o un messaggio di errore
        post_url, error_message = post_to_steem(username, posting_key, title, body, tags)

        if post_url:
            # Avvia un thread per inviare il link a Telegram con ritardo
        #    threading.Thread(target=send_telegram_message_delayed, args=(post_url,), kwargs={"delay": 10}).start()
            send_telegram_message_animals(post_url)
            return jsonify({'message': 'Post successfully submitted to Steem', 'url': post_url}), 200
        else:
            return jsonify({'message': error_message}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Unhandled error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred. Please try again later.'}), 500




#######################################      HIVE TELEGRAM API       #################################################################################################



def verify_posting_key_hive(username, posting_key):
    try:
        # Inizializza Hive
        hive = Hive(node=hnodes)

        # Deriva la chiave pubblica dalla chiave privata di posting
        posting_pub_key = str(PrivateKey(posting_key).pubkey)

        # Ottieni le informazioni sull'account dato il nome utente
        account = Account(username, hive_instance=hive)

        # Recupera la chiave pubblica di posting registrata per l'account
        registered_posting_pub_key = account['posting']['key_auths'][0][0]

        # Verifica se la chiave pubblica derivata corrisponde a quella registrata
        if posting_pub_key == registered_posting_pub_key:
            print("Il nome utente è corretto e corrisponde alla chiave privata di posting fornita.")
            return True
        else:
            print("Il nome utente fornito NON corrisponde alla chiave privata di posting.")
            return False

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error verifying posting key: {e}")
        return False


def get_profile_image_hive(username):
    try:
        # Effettua una richiesta all'API di Hive blog per recuperare le informazioni dell'account
        response = requests.get(f"https://hive.blog/@{username}.json")

        if response.status_code == 200:
            user_data = response.json()

            # Stampa i metadati per verificare il loro contenuto
            #print(f"Metadati dell'utente {username}: {user_data}")

            # Controlla se l'account ha metadati del profilo
            if 'user' in user_data and 'posting_json_metadata' in user_data['user']:
                posting_metadata = user_data['user']['posting_json_metadata']

                # Verifica se i metadati sono una stringa JSON valida
                if posting_metadata:
                    try:
                        profile_data = json.loads(posting_metadata).get('profile', {})
                        profile_image = profile_data.get('profile_image', None)
                        return profile_image if profile_image else None
                    except json.JSONDecodeError:
                        print(f"Errore nel decodificare i metadati JSON per {username}: {posting_metadata}")
                        return None

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Errore durante il recupero dell'immagine del profilo: {str(e)}")
        return None

    return None  # Se non ci sono metadati o altri problemi



def get_usernames_hive(id_telegram):
    try:
        # Query per trovare utenti con l'id_telegram fornito
        users = User.query.filter_by(id_telegram=id_telegram, platform='Hive').all()

        if users:
            usernames_with_images = []
            for user in users:
                username = user.username
                profile_image = get_profile_image_hive(username)  # Usa la funzione per ottenere l'immagine del profilo

                # Aggiungi username e immagine se presente
                if profile_image:
                    usernames_with_images.append({
                        'profile_image': profile_image,
                        'username': username
                    })
                else:
                    usernames_with_images.append({
                        'username': username
                    })

            return {'usernames': usernames_with_images}, 200
        else:
            return {'message': 'User not logged in'}, 201
    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return {'error': 'Database query error'}, 500



def post_to_hive(username, posting_key, title, body, tags):
    try:
        hive = Hive(node=hnodes, keys=[posting_key])
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
        post_url = f"https://peakd.com/{tags[0]}/@{username}/{permlink}"
        return post_url, None

    except Exception as e:
        logger.error(e, exc_info=True)
        error_message = str(e)

        # Identifica messaggi di errore specifici per l'utente
        if "You may only post once every 5 minutes" in error_message:
            user_message = "Please wait 5 minutes before posting again."
        elif "has" in error_message and "RC, needs" in error_message:
            user_message = "Insufficient RC. Please wait for credits to recharge or power up."
        else:
            user_message = "An error occurred while posting. Please try again later."

        # Log del messaggio di errore
        print(f"Error posting to Hive: {error_message}")
        return None, user_message





@app.route('/api/hive/check_login', methods=['POST'])
def check_login_hive():
       # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram dal corpo della richiesta
   # id_telegram = request.json.get('id_telegram')

    # Procedi con la logica del login
    response, status_code = get_usernames_hive(id_telegram)

    if status_code == 200:
        return jsonify({
            'message': 'User is already logged in',
            'usernames': response['usernames']
        }), 200

    return jsonify(response), status_code




@app.route('/api/hive/login', methods=['POST'])
def login_hive():

           # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result


    # Ottieni i dati dal corpo della richiesta
   # id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')
    posting_key = request.json.get('posting_key')

    # Controlla che i campi obbligatori siano presenti
    if not id_telegram or not username or not posting_key:
        return jsonify({'error': 'id_telegram e username sono obbligatori'}), 400

    if not verify_posting_key_hive(username, posting_key):
        return jsonify({'error': 'Invalid posting key'}), 400
    encrypted_posting_key = encrypt_posting_key(posting_key)

    try:
        # Controlla se l'utente esiste già nel database
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if user:
            return jsonify({'message': 'User already exists in the database'}), 200

        # Crea un nuovo utente e salva nel database
        new_user = User(
            id_telegram=id_telegram,
            username=username,
            posting_key=encrypted_posting_key,  # Inserisci NULL se non esiste una posting_key
            platform='Hive'
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User successfully logged in and saved to the database'}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return jsonify({'error': 'Database query error'}), 500


@app.route('/api/hive/signerlogin', methods=['POST'])
def login_hivesigner():

           # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result


    # Ottieni i dati dal corpo della richiesta
  #  id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')
    posting_key = os.getenv('CUR8_POSTING_HIVE')

    # Controlla che i campi obbligatori siano presenti
    if not id_telegram or not username or not posting_key:
        return jsonify({'error': 'id_telegram e username sono obbligatori'}), 400

    encrypted_posting_key = encrypt_posting_key(posting_key)

    try:
        # Controlla se l'utente esiste già nel database
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if user:
            return jsonify({'message': 'User already exists in the database'}), 200

        # Crea un nuovo utente e salva nel database
        new_user = User(
            id_telegram=id_telegram,
            username=username,
            posting_key=encrypted_posting_key,  # Inserisci NULL se non esiste una posting_key
            platform='Hive'
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User successfully logged in and saved to the database'}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return jsonify({'error': 'Database query error'}), 500



@app.route('/api/hive/logout', methods=['POST'])
def logout_hive():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

  #  id_telegram = request.json.get('id_telegram')

    username = request.json.get('username')

    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        # Verifica se l'utente esiste
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Elimina l'utente
        db.session.delete(user)
        db.session.commit()

        # Verifica se ci sono altri utenti con lo stesso username
        remaining_users = User.query.filter_by(username=username, platform='Hive').count()

        if remaining_users == 0:
            # Se non ci sono più utenti con lo stesso username, elimina i draft associati
            Draft.query.filter_by(username=username, platform='Hive').delete()
            db.session.commit()

        return jsonify({'message': 'Logout successful'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()  # In caso di errore, annulla la transazione
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hive/save_draft', methods=['POST'])
def save_draft_hive():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

  #  id_telegram = request.headers.get('Id-Telegram')

    username = request.json.get('username')
    title = request.json.get('title')
    tags = request.json.get('tags')
    body = request.json.get('body')
    scheduled_time = request.json.get('scheduled_time')  # Optional
    timezone = request.json.get('timezone')  # Optional
    community = request.json.get('community')


    # Verifica che i campi obbligatori siano presenti
    if not id_telegram or not username or not title or not body:
        return jsonify({'error': 'ID Telegram, username, title, and body are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Salva il draft nel database
        new_draft = Draft(
            username=username,
            title=title,
            tags=tags,
            body=body,
            scheduled_time=scheduled_time,  # Facoltativo
            timezone=timezone,  # Facoltativo
            community=community,
            platform='Hive'
        )

        db.session.add(new_draft)
        db.session.commit()

        return jsonify({'message': 'Draft saved successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()  # In caso di errore, annulla la transazione
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hive/get_user_drafts', methods=['GET'])
def get_user_drafts_hive():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram e l'username dai parametri della richiesta
  #  id_telegram = request.headers.get('Id-Telegram')

    username = request.args.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Recupera tutti i drafts associati all'username
        drafts = Draft.query.filter_by(username=username, platform='Hive').all()

        # Se non ci sono drafts, restituisci una lista vuota
        if not drafts:
            return jsonify([]), 200

        # Converti i drafts in formato serializzabile
        drafts_list = [
            {
                'id': draft.id,
                'username': draft.username,
                'title': draft.title,
                'tags': draft.tags,
                'body': draft.body,
                'scheduled_time': draft.scheduled_time,
                'timezone': draft.timezone,
                'community': draft.community
            } for draft in drafts
        ]

        return jsonify(drafts_list), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hive/delete_draft', methods=['DELETE'])
def delete_draft_hive():

               # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    # Ottieni l'ID Telegram e l'username dalla richiesta
   # id_telegram = request.headers.get('Id-Telegram')

    draft_id = request.json.get('id')
    username = request.json.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not draft_id or not username or not id_telegram:
        return jsonify({'error': 'Draft ID, username, and ID Telegram are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()

        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Verifica se il draft esiste e appartiene all'utente
        draft = Draft.query.filter_by(id=draft_id, username=username, platform='Hive').first()

        if not draft:
            return jsonify({'error': 'Draft not found or not owned by the user'}), 404

        # Elimina il draft
        db.session.delete(draft)
        db.session.commit()

        return jsonify({'message': 'Draft deleted successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hive/post', methods=['POST'])
def post_to_hive_endpoint():

    # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result


   # id_telegram = request.headers.get('Id-Telegram')

    username = request.json.get('username')
    title = request.json.get('title')
    body = request.json.get('body')
    tags_input = request.json.get('tags')
    community = request.json.get('community')

    tag_community = get_community_name_by_title(community)
    if tag_community:
        tags = [tag_community] + ["cur8"] + [tag.strip().lower() for tag in re.split(r'[,\s]+', tags_input) if tag.strip()]
    else:
        tags = ["cur8"] + [tag.strip().lower() for tag in re.split(r'[,\s]+', tags_input) if tag.strip()]

    if not id_telegram or not username:
        return jsonify({'error': 'ID Telegram and username are required'}), 400

    try:
        user = User.query.filter_by(id_telegram=id_telegram, username=username, platform='Hive').first()
        if not user:
            return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        encrypted_posting_key = user.posting_key
        if not encrypted_posting_key:
            posting_key = os.getenv('CUR8_POSTING_HIVE')
            if not posting_key:
                return jsonify({'error': 'CUR8_POSTING_HIVE key is not available in the environment'}), 500
        else:
            encrypted_posting_key = encrypted_posting_key.encode()
            posting_key = decrypt_posting_key(encrypted_posting_key)

        # Esegui il post su Hive e ottieni il risultato o un messaggio di errore
        post_url, error_message = post_to_hive(username, posting_key, title, body, tags)

        if post_url:
            # Avvia un thread per inviare il link a Telegram con ritardo
          #  threading.Thread(target=send_telegram_message_delayed, args=(post_url,), kwargs={"delay": 10}).start()
            send_telegram_message_animals(post_url)
            return jsonify({'message': 'Post successfully submitted to Hive', 'url': post_url}), 200
        else:
            return jsonify({'message': error_message}), 201

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Unhandled error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred. Please try again later.'}), 500


#######################################      STEEM & HIVE IMG UPLOADER       #################################################################################################



@app.route('/api/steem/free_upload_image', methods=['POST'])
def free_upload_image_steem():

    data = request.json
    base64_string = data.get('image_base64')
    username = 'cur8'
    wif = os.getenv('CUR8_POSTING_STEEM')

    if not base64_string:
        return jsonify({'error': 'Base64 string è obbligatoria'}), 400

    try:
        # Usa l'istanza di ImageHandler per gestire il caricamento dell'immagine
        image_url = image_handler.handle_image_upload(base64_string, username, wif)
        return jsonify({'image_url': image_url})
    except ValueError as ve:
        return jsonify({'error': f'Errore immagine: {str(ve)}'}), 400
    except RuntimeError as re:
        return jsonify({'error': f'Errore caricamento: {str(re)}'}), 500
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': f'Errore generico: {str(e)}'}), 500


def get_posting_key_from_db_steem(username, id_telegram):
    try:
        # Cerca l'utente nel database filtrando per username e id_telegram
        user = User.query.filter_by(username=username, id_telegram=id_telegram, platform='Steem').first()

        if user:
            encrypted_posting_key = user.posting_key

            # Se la posting_key è NULL, utilizza la chiave e l'username di CUR8
            if encrypted_posting_key is None:
                print(f"Posting key for user '{username}' is NULL. Using CUR8_POSTING_STEEM key.")
                posting_key = os.getenv('CUR8_POSTING_STEEM')
                cur8_username = 'cur8'  # Imposta l'username su 'cur8'
                if not posting_key:
                    print("CUR8_POSTING_STEEM key is not available in the environment")
                return posting_key, cur8_username
            else:
                # Decripta la chiave di posting se non è NULL
                encrypted_posting_key = encrypted_posting_key.encode()  # Conversione in bytes
                posting_key = decrypt_posting_key(encrypted_posting_key)
                return posting_key, username  # Restituisci l'username originale
        else:
            print(f"User '{username}' with Telegram ID '{id_telegram}' not found")
            return None, None
    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return None, None



# Funzione per l'upload dell'immagine su Steem con supporto per la WIF dal database o dal payload
@app.route('/api/steem/upload_base64_image', methods=['POST'])
def upload_base64_image_steem():
        # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    id_telegram = request.json.get('id_telegram')

    data = request.json
    base64_string = data.get('image_base64')
    username = data.get('username')
    wif = data.get('wif')  # Opzionale: ricevi la WIF dal payload

    if not base64_string or not username or not id_telegram:
        return jsonify({'error': 'Base64 string, username e id_telegram sono obbligatori'}), 400

    try:
        # Se la WIF non è fornita nel payload, recuperala dal database
        if not wif:
            wif, username = get_posting_key_from_db_steem(username, id_telegram)  # Ora passa anche id_telegram

        # Controlla se la WIF è disponibile
        if not wif:
            return jsonify({'error': f"Impossibile recuperare la chiave privata per l'utente '{username}' con ID Telegram '{id_telegram}'"}), 400

        if not verify_posting_key_steem(username, wif):
            username = "cur8"


        # Usa l'istanza di ImageHandler per gestire il caricamento dell'immagine
        image_url = image_handler.handle_image_upload(base64_string, username, wif)
        return jsonify({'image_url': image_url})
    except ValueError as ve:
        return jsonify({'error': f'Errore immagine: {str(ve)}'}), 400
    except RuntimeError as re:
        return jsonify({'error': f'Errore caricamento: {str(re)}'}), 500
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': f'Errore generico: {str(e)}'}), 500





def get_posting_key_from_db_hive(username, id_telegram):
    try:
        # Cerca l'utente nel database filtrando per username e id_telegram
        user = User.query.filter_by(username=username, id_telegram=id_telegram, platform='Hive').first()

        if user:
            encrypted_posting_key = user.posting_key

            # Se la posting_key è NULL, utilizza la chiave e l'username di CUR8
            if encrypted_posting_key is None:
                print(f"Posting key for user '{username}' is NULL. Using CUR8_POSTING_HIVE key.")
                posting_key = os.getenv('CUR8_POSTING_HIVE')
                cur8_username = 'cur8'  # Imposta l'username su 'cur8'
                if not posting_key:
                    print("CUR8_POSTING_HIVE key is not available in the environment")
                return posting_key, cur8_username
            else:
                # Decripta la chiave di posting se non è NULL
                encrypted_posting_key = encrypted_posting_key.encode()  # Conversione in bytes
                posting_key = decrypt_posting_key(encrypted_posting_key)
                return posting_key, username  # Restituisci l'username originale
        else:
            print(f"User '{username}' with Telegram ID '{id_telegram}' not found")
            return None, None
    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Database error: {e}")
        return None, None



# Funzione per l'upload dell'immagine su Hive con supporto per la WIF dal database o dal payload
@app.route('/api/hive/upload_base64_image', methods=['POST'])
def upload_base64_image_hive():
        # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

   # id_telegram = request.json.get('id_telegram')

    data = request.json
    base64_string = data.get('image_base64')
    username = data.get('username')
    wif = data.get('wif')  # Opzionale: ricevi la WIF dal payload

    if not base64_string or not username or not id_telegram:
        return jsonify({'error': 'Base64 string, username e id_telegram sono obbligatori'}), 400

    try:
        # Se la WIF non è fornita nel payload, recuperala dal database
        if not wif:
            wif, username = get_posting_key_from_db_hive(username, id_telegram)  # Ora passa anche id_telegram

        # Controlla se la WIF è disponibile
        if not wif:
            return jsonify({'error': f"Impossibile recuperare la chiave privata per l'utente '{username}' con ID Telegram '{id_telegram}'"}), 400

        if not verify_posting_key_hive(username, wif):
            username = "cur8"

        # Usa l'istanza di ImageHandler per gestire il caricamento dell'immagine
        image_url = hive_image_handler.handle_image_upload(base64_string, username, wif)
        return jsonify({'image_url': image_url})
    except ValueError as ve:
        return jsonify({'error': f'Errore immagine: {str(ve)}'}), 400
    except RuntimeError as re:
        return jsonify({'error': f'Errore caricamento: {str(re)}'}), 500
    except Exception as e:
        logger.error(e, exc_info=True)
        return jsonify({'error': f'Errore generico: {str(e)}'}), 500








#######################################      STEEM ACCOUNT CREATION     ############################################################################################


# Configurazione della chiave API segreta
#SECRET_API_KEY = os.getenv('API_KEY')  # Cambia questo con una chiave sicura

def generate_master_key():
    """Genera una master key con un prefisso 'P'."""
    private_key = PrivateKey()  # Genera una nuova chiave privata casuale
    wif = str(private_key)  # Chiave WIF (Wallet Import Format)
    return f"P{wif}"  # Aggiungi 'P'

def create_account(new_account_name, tg_id):
    creator_name = 'cur8'
    creator_private_key = os.getenv('CUR8_ACTIVE_STEEM')
    steem = Steem(node=snodes, keys=[creator_private_key])
    password = generate_master_key()

    # Controllo limite di account per telegram ID
    user_creation = AccountCreation.query.filter_by(id_telegram=tg_id).first()
    if user_creation and user_creation.created_count >= 3:
        return {"status": "error", "message": "Hai già creato il numero massimo di account consentiti (3)."}

    # Generazione chiavi
    owner_key = PasswordKey(new_account_name, password, role="owner").get_private()
    active_key = PasswordKey(new_account_name, password, role="active").get_private()
    posting_key = PasswordKey(new_account_name, password, role="posting").get_private()
    memo_key = PasswordKey(new_account_name, password, role="memo").get_private()

    owner_pubkey = str(owner_key.pubkey)
    active_pubkey = str(active_key.pubkey)
    posting_pubkey = str(posting_key.pubkey)
    memo_pubkey = str(memo_key.pubkey)

    try:
        steem.create_claimed_account(
            account_name=new_account_name,
            creator=creator_name,
            owner_key=owner_pubkey,
            active_key=active_pubkey,
            posting_key=posting_pubkey,
            memo_key=memo_pubkey,
            delegation_fee_steem="0.000 STEEM",
            storekeys=False,
            ticket=True
        )

        # Aggiorna o crea record nel contatore
        if user_creation:
            user_creation.created_count += 1
        else:
            user_creation = AccountCreation(id_telegram=tg_id, created_count=1)
            db.session.add(user_creation)

        db.session.commit()

        send_telegram_message_pirati(f"{tg_id} ✅ Nuovo account creato su Steem: {new_account_name}")

        keys = {
            "master_key": password,
            "owner_key": str(owner_key),
            "active_key": str(active_key),
            "posting_key": str(posting_key),
            "memo_key": str(memo_key),
        }

        return {"status": "success", "message": f"Account {new_account_name} creato con successo.", "keys": keys}

    except AccountExistsException:
        send_telegram_message_pirati(f"{tg_id} ha provato a creare {new_account_name}, ma esiste già.")
        return {"status": "error", "message": f"Account {new_account_name} già esistente."}

    except Exception as e:
        logger.error(e, exc_info=True)
        send_telegram_message_pirati(f"{tg_id} errore: {str(e)}")
        return {"status": "error", "message": f"Errore: {str(e)}"}


@app.route('/api/steem/create_account', methods=['POST'])
def api_create_account():
        # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_steem(request)
    if status_code != 200:
        return jsonify(result), status_code

   #  Ottieni l'ID Telegram
    id_telegram = result

    tg_id = get_telegram_name_steem(id_telegram)

    new_account_name = request.json.get('new_account_name')

    result = create_account(new_account_name, tg_id)

    return jsonify(result)  # Restituisce sempre una risposta JSON


#######################################      HIVE ACCOUNT CREATION     ###########################################################################################



def create_hive_account(new_account_name, tg_id):
    creator_name = 'cur8'
    creator_private_key = os.getenv('CUR8_ACTIVE_HIVE')
    hive = Hive(node=hnodes, keys=[creator_private_key])

    # Controllo limite di account per telegram ID
    user_creation = AccountCreation.query.filter_by(id_telegram=tg_id).first()
    if user_creation and user_creation.created_count >= 3:
        return {"status": "error", "message": "Hai già creato il numero massimo di account consentiti (3)."}

    # Genera una master key sicura
    password = generate_master_key()

    # Genera le chiavi per il nuovo account
    owner_key = PasswordKey(new_account_name, password, role="owner").get_private()
    active_key = PasswordKey(new_account_name, password, role="active").get_private()
    posting_key = PasswordKey(new_account_name, password, role="posting").get_private()
    memo_key = PasswordKey(new_account_name, password, role="memo").get_private()

    owner_pubkey = str(owner_key.pubkey)
    active_pubkey = str(active_key.pubkey)
    posting_pubkey = str(posting_key.pubkey)
    memo_pubkey = str(memo_key.pubkey)

    try:
        hive.create_claimed_account(
            account_name=new_account_name,
            creator=creator_name,
            owner_key=owner_pubkey,
            active_key=active_pubkey,
            posting_key=posting_pubkey,
            memo_key=memo_pubkey,
            delegation_fee_hive="0.000 HIVE",
            storekeys=False,
            ticket=True
        )

        # Aggiorna o crea il contatore
        if user_creation:
            user_creation.created_count += 1
        else:
            user_creation = AccountCreation(id_telegram=tg_id, created_count=1)
            db.session.add(user_creation)

        db.session.commit()

        send_telegram_message_pirati(f"{tg_id} ✅ Nuovo account creato su Hive: {new_account_name}")

        keys = {
            "master_key": password,
            "owner_key": str(owner_key),
            "active_key": str(active_key),
            "posting_key": str(posting_key),
            "memo_key": str(memo_key),
        }

        return {"status": "success", "message": f"Account {new_account_name} creato con successo.", "keys": keys}

    except AccountExistsException:
        send_telegram_message_pirati(f"{tg_id} ha provato a creare {new_account_name} su Hive, ma esiste già")
        return {"status": "error", "message": f"Account {new_account_name} già esistente."}

    except Exception as e:
        logger.error(e, exc_info=True)
        send_telegram_message_pirati(f"{tg_id} errore: {str(e)}")
        return {"status": "error", "message": f"Errore: {str(e)}"}



@app.route('/api/hive/create_account', methods=['POST'])
def api_create_hive_account():
        # Usa la funzione helper per validare i dati Telegram
    result, status_code = validate_telegram_data_hive(request)
    if status_code != 200:
        return jsonify(result), status_code

    # Ottieni l'ID Telegram
    id_telegram = result

    tg_id = get_telegram_name_hive(id_telegram)

    new_account_name = request.json.get('new_account_name')

    result = create_hive_account(new_account_name, tg_id)

    return jsonify(result)  # Restituisce sempre una risposta JSON




################################################################################ CUR8FUN #####################################################################################

@app.route('/api/steem/save_scheduled', methods=['POST'])
def save_scheduled_steem():

    username = request.json.get('username')
    title = request.json.get('title')
    tags = request.json.get('tags')
    body = request.json.get('body')
    scheduled_time = request.json.get('scheduled_time')  # Optional
    timezone = request.json.get('timezone')  # Optional
    community = request.json.get('community')


    # Verifica che i campi obbligatori siano presenti
    if not username or not title or not body:
        return jsonify({'error': 'Username, title, and body are required'}), 400

    try:
        new_draft = Draft(
            username=username,
            title=title,
            tags=tags,
            body=body,
            scheduled_time=scheduled_time,  # Facoltativo
            timezone=timezone,  # Facoltativo
            community=community,
            platform='Steem'
        )

        db.session.add(new_draft)
        db.session.commit()

        return jsonify({'message': 'Draft saved successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()  # In caso di errore, annulla la transazione
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/steem/get_user_scheduled', methods=['GET'])
def get_user_scheduled_steem():


    username = request.args.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
      #  user = User.query.filter_by(username=username, platform='Steem').first()

     #   if not user:
     #       return jsonify({'error': 'User not found or ID Telegram does not match'}), 404

        # Recupera tutti i drafts associati all'username
        drafts = Draft.query.filter_by(username=username, platform='Steem').all()

        # Se non ci sono drafts, restituisci una lista vuota
        if not drafts:
            return jsonify([]), 200

        # Converti i drafts in formato serializzabile
        drafts_list = [
            {
                'id': draft.id,
                'username': draft.username,
                'title': draft.title,
                'tags': draft.tags,
                'body': draft.body,
                'scheduled_time': draft.scheduled_time,
                'timezone': draft.timezone,
                'community': draft.community
            } for draft in drafts
        ]

        return jsonify(drafts_list), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/steem/delete_scheduled', methods=['DELETE'])
def delete_scheduled_steem():


    draft_id = request.json.get('id')
    username = request.json.get('username')

    # Verifica che i campi obbligatori siano presenti
    if not draft_id or not username:
        return jsonify({'error': 'Draft ID, username are required'}), 400

    try:
        # Verifica se l'utente esiste e se l'id_telegram corrisponde all'username
    #    user = User.query.filter_by(username=username, platform='Steem').first()

     #   if not user:
     #       return jsonify({'error': 'User not found'}), 404

        # Verifica se il draft esiste e appartiene all'utente
        draft = Draft.query.filter_by(id=draft_id, username=username, platform='Steem').first()

        if not draft:
            return jsonify({'error': 'Draft not found or not owned by the user'}), 404

        # Elimina il draft
        db.session.delete(draft)
        db.session.commit()

        return jsonify({'message': 'Draft deleted successfully'}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/steem/update_scheduled', methods=['POST'])
def update_scheduled_steem():

    draft_id = request.json.get('id')
    username = request.json.get('username')
    title = request.json.get('title')
    tags = request.json.get('tags')
    body = request.json.get('body')
    scheduled_time = request.json.get('scheduled_time')
    timezone = request.json.get('timezone')
    community = request.json.get('community')

    if not draft_id or not username:
        return jsonify({'error': 'Draft ID and username are required'}), 400

    try:
        draft = Draft.query.filter_by(id=draft_id, username=username, platform='Steem').first()

        if not draft:
            return jsonify({'error': 'Scheduled post not found or not owned by the user'}), 404

        if title is not None:
            draft.title = title
        if tags is not None:
            draft.tags = tags
        if body is not None:
            draft.body = body
        if scheduled_time is not None:
            draft.scheduled_time = scheduled_time
        if timezone is not None:
            draft.timezone = timezone
        if community is not None:
            draft.community = community

        db.session.commit()

        return jsonify({'message': 'Scheduled post updated successfully', 'id': draft.id}), 200

    except Exception as e:
        logger.error(e, exc_info=True)
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
