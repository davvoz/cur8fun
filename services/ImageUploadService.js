/**
 * Service for handling image uploads using only Steem Keychain
 */
import authService from './AuthService.js';
import steemService from './SteemService.js';
import eventEmitter from '../utils/EventEmitter.js';

class ImageUploadService {
  constructor() {
    this.MAX_FILE_SIZE_MB = 15;
    this.UPLOAD_TIMEOUT_MS = 60000; // 60 secondi di timeout
  }

  /**
   * Verifica se la dimensione del file è valida
   */
  isFileSizeValid(file) {
    const fileSizeInMB = file.size / (1024 * 1024);
    return fileSizeInMB <= this.MAX_FILE_SIZE_MB;
  }

  /**
   * Verifica se Keychain è disponibile nel browser
   */
  isKeychainAvailable() {
    return typeof window.steem_keychain !== 'undefined';
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
   * Carica un'immagine utilizzando esclusivamente Steem Keychain
   */
  async uploadImage(file, username) {
    // Validazione input
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid file: only images are supported');
    }

    if (!this.isFileSizeValid(file)) {
      throw new Error(`Image is too large. Maximum allowed size is ${this.MAX_FILE_SIZE_MB}MB.`);
    }
    
    if (!username) {
      throw new Error('Username is required to upload images');
    }
    
    if (!this.isKeychainAvailable()) {
      throw new Error('Steem Keychain is required but not installed in your browser');
    }
    
    try {
      // Comprimi l'immagine
      const compressedFile = await this.compressImage(file);
      console.log(`Image compressed from ${file.size} to ${compressedFile.size} bytes`);
      
      // Genera un nome file unico
      const uniqueFilename = this.generateUniqueFilename(file);
      
      // Carica con Keychain
      return await this.uploadWithKeychain(compressedFile, username, uniqueFilename);
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    }
  }
  
  /**
   * Carica un'immagine con Keychain (unico metodo supportato)
   */
  async uploadWithKeychain(file, username, filename) {
    console.log('Uploading image with Keychain...');
    
    return new Promise((resolve, reject) => {
      // Converti il file in base64
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
          
          const base64Data = parts[1];
          
          // Crea l'oggetto JSON per l'operazione custom_json
          const jsonData = {
            action: "upload_image",
            username: username,
            filename: filename,
            data: base64Data
          };
          
          console.log('Preparing Keychain request for user:', username);
          
          // Invia la richiesta a Keychain
          window.steem_keychain.requestCustomJson(
            username,
            "steemitwallet",  // ID per Steem
            "Posting",
            JSON.stringify(jsonData),
            "Upload Image",
            (response) => {
              console.log('Keychain response received:', response);
              
              if (response.success) {
                // Costruisci l'URL dell'immagine
                const imageUrl = `https://steemitimages.com/0x0/${username}/${filename}`;
                console.log('Image uploaded successfully with Keychain:', imageUrl);
                
                eventEmitter.emit('notification', {
                  type: 'success',
                  message: 'Image uploaded successfully!'
                });
                
                resolve(imageUrl);
              } else {
                // Gestione errore
                let errorMessage = 'Unknown error';
                
                if (response.error) {
                  if (typeof response.error === 'string') {
                    errorMessage = response.error;
                  } else if (typeof response.error === 'object') {
                    errorMessage = JSON.stringify(response.error);
                    
                    if (response.error.message) {
                      errorMessage = response.error.message;
                    } else if (response.error.error) {
                      errorMessage = response.error.error;
                    } else if (response.error.data && response.error.data.message) {
                      errorMessage = response.error.data.message;
                    }
                  }
                } else if (response.message) {
                  errorMessage = response.message;
                }
                
                console.error('Keychain upload error details:', errorMessage);
                reject(new Error(`Keychain upload failed: ${errorMessage}`));
              }
            }
          );
        } catch (error) {
          console.error('Error preparing image data:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        reject(new Error('Error reading file for upload'));
      };
    });
  }
}

// Esporta una singola istanza
const imageUploadService = new ImageUploadService();
export default imageUploadService;