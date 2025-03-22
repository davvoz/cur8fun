/**
 * Service for handling image uploads
 */
class ImageUploadService {
  constructor() {
    this.MAX_FILE_SIZE_MB = 15;
    this.UPLOAD_TIMEOUT_MS = 60000; // 60 secondi di timeout
  }

  /**
   * Verifica se la dimensione del file è valida
   * @param {File} file - File da verificare
   * @returns {boolean} true se la dimensione è valida
   */
  isFileSizeValid(file) {
    const fileSizeInMB = file.size / (1024 * 1024);
    return fileSizeInMB <= this.MAX_FILE_SIZE_MB;
  }

  /**
   * Carica un'immagine su STEEM/HIVE
   * @param {File} file - File immagine da caricare
   * @param {string} username - Username dell'utente
   * @returns {Promise<string>} URL dell'immagine caricata
   */
  async uploadImage(file, username) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid file: only images are supported');
    }

    if (!this.isFileSizeValid(file)) {
      throw new Error(`Image is too large. Maximum allowed size is ${this.MAX_FILE_SIZE_MB}MB.`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        try {
          const base64Image = reader.result.split(',')[1];
          
          // Determina la piattaforma (STEEM o HIVE)
          // Possiamo usare una configurazione o determinarlo dall'URL corrente
          const platform = 'HIVE'; // Valore predefinito, puoi cambiarlo in base alla tua configurazione
          
          const baseUrlMap = {
            'STEEM': 'https://develop-imridd.eu.pythonanywhere.com/api/steem/upload_base64_image',
            'HIVE': 'https://develop-imridd.eu.pythonanywhere.com/api/hive/upload_base64_image'
          };
          
          const baseUrl = baseUrlMap[platform];
          if (!baseUrl) {
            reject(new Error(`Invalid platform: ${platform}`));
            return;
          }
          
          // Prepara i dati per la richiesta
          const payload = {
            image_base64: base64Image,
            username: username,
            id_telegram: 'steemee_app' // ID generico per tracciare l'origine
          };
          
          // Funzione per gestire il timeout
          const fetchWithTimeout = (url, options, timeout) => {
            return Promise.race([
              fetch(url, options),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: Image upload is taking too long.')), timeout)
              )
            ]);
          };
          
          // Esegui la richiesta di upload
          const response = await fetchWithTimeout(
            baseUrl, 
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }, 
            this.UPLOAD_TIMEOUT_MS
          );
          
          if (!response.ok) {
            throw new Error('Server error while uploading image');
          }
          
          const data = await response.json();
          resolve(data.image_url);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  }
}

// Esporta una singola istanza
const imageUploadService = new ImageUploadService();
export default imageUploadService;