/**
 * Service for handling image uploads using imridd API
 */
import authService from './AuthService.js';
import steemService from './SteemService.js';
import eventEmitter from '../utils/EventEmitter.js';

class ImageUploadService {
  constructor() {
    this.MAX_FILE_SIZE_MB = 15;
    this.UPLOAD_TIMEOUT_MS = 60000; // 60 secondi di timeout
    this.API_ENDPOINT = 'https://develop-imridd.eu.pythonanywhere.com/api/steem/free_upload_image';
  }

  /**
   * Verifica se la dimensione del file è valida
   */
  isFileSizeValid(file) {
    const fileSizeInMB = file.size / (1024 * 1024);
    return fileSizeInMB <= this.MAX_FILE_SIZE_MB;
  }

  /**
   * Comprime l'immagine se necessario
   */
  async compressImage(file, maxWidthHeight = 1920) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Ridimensiona se l'immagine è troppo grande
        if (width > maxWidthHeight || height > maxWidthHeight) {
          if (width > height) {
            height *= maxWidthHeight / width;
            width = maxWidthHeight;
          } else {
            width *= maxWidthHeight / height;
            height = maxWidthHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Determina il tipo MIME dall'originale
        const mimeType = file.type || 'image/jpeg';
        
        // Usa la qualità massima per PNG, altrimenti qualità 90% per JPEG
        const quality = mimeType === 'image/png' ? 1.0 : 0.9;
        
        canvas.toBlob(
          blob => resolve(blob),
          mimeType,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Error loading image for compression'));
    });
  }

  /**
   * Genera un nome file univoco con timestamp
   */
  generateUniqueFilename(file) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const extension = file.name.split('.').pop().toLowerCase();
    return `image_${timestamp}_${randomString}.${extension}`;
  }

  /**
   * Funzione helper per eseguire fetch con timeout
   */
  fetchWithTimeout(url, options, timeout) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * Carica un'immagine utilizzando l'API di imridd
   */
  async uploadImage(file, username) {
    // Validazione input
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid file: only images are supported');
    }

    if (!this.isFileSizeValid(file)) {
      throw new Error(`Image is too large. Maximum allowed size is ${this.MAX_FILE_SIZE_MB}MB.`);
    }
    
    // Emetti un evento di notifica per l'inizio dell'upload
    eventEmitter.emit('notification', {
      type: 'info',
      message: 'Uploading image...'
    });
    
    try {
      // Comprimi l'immagine
      const compressedFile = await this.compressImage(file);
      
      // Converti il file in base64
      const base64Data = await this.fileToBase64(compressedFile);
      
      // Prepara il payload per la richiesta
      const payload = {
        image_base64: base64Data
      };
      
      // Esegui la richiesta con timeout
      const response = await this.fetchWithTimeout(
        this.API_ENDPOINT, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }, 
        this.UPLOAD_TIMEOUT_MS
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.image_url) {
        throw new Error('Invalid response: missing image URL');
      }
      
      // Notifica di successo
      eventEmitter.emit('notification', {
        type: 'success',
        message: 'Image uploaded successfully!'
      });
      
      return data.image_url;
    } catch (error) {
      console.error('Image upload failed:', error);
      
      let errorMessage = error.message;
      if (errorMessage.includes('timeout')) {
        errorMessage = 'The image is taking too long to load, check your connection and try again later.';
      }
      
      // Notifica di errore
      eventEmitter.emit('notification', {
        type: 'error',
        message: `Upload failed: ${errorMessage}`
      });
      
      throw error;
    }
  }
  
  /**
   * Converte un file in base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = () => {
        try {
          // Verifica che il risultato della lettura sia valido
          if (!reader.result || typeof reader.result !== 'string') {
            throw new Error('Invalid file data');
          }
          
          const parts = reader.result.split(',');
          if (parts.length < 2) {
            throw new Error('Invalid image data format');
          }
          
          resolve(parts[1]); // Restituisci solo la parte base64 (dopo la virgola)
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(new Error('Error reading file: ' + error));
      };
    });
  }
}

// Esporta una singola istanza
const imageUploadService = new ImageUploadService();
export default imageUploadService;