import Component from './Component.js';

/**
 * Componente centralizzato per l'upload delle immagini
 */
export default class ImageUploader extends Component {
  constructor(options = {}) {
    // Passiamo un elemento parent fittizio perché lo creeremo dinamicamente
    super(null, options);
    
    this.onImageSelected = options.onImageSelected || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.allowURL = options.allowURL !== false;
    this.allowUpload = options.allowUpload !== false;
  }
  
  /**
   * Mostra il modal di upload immagini
   */
  show() {
    // Crea il modal
    this.element = document.createElement('div');
    this.element.className = 'image-upload-modal';
    this.element.style.opacity = '0'; // Per l'animazione
    
    this.element.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Image</h3>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          ${this.allowUpload ? `
          <div class="image-option" id="option-upload">
            <span class="material-icons">cloud_upload</span>
            <span>Upload Image</span>
          </div>
          ` : ''}
          ${this.allowURL ? `
          <div class="image-option" id="option-url">
            <span class="material-icons">link</span>
            <span>Add Image URL</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Salva la posizione di scroll corrente
    this.scrollY = window.scrollY;
    
    // Aggiungi al DOM
    document.body.appendChild(this.element);
    document.body.classList.add('modal-open');
    
    // Animazione di apertura
    setTimeout(() => {
      this.element.style.opacity = '1';
      this.element.style.transition = 'opacity 0.2s ease-in-out';
    }, 10);
    
    // Configura i listener
    this.setupEventListeners();
    
    return this;
  }
  
  /**
   * Configura i listener per gli eventi del modal
   */
  setupEventListeners() {
    // Chiusura
    const closeButton = this.element.querySelector('.close-button');
    closeButton.addEventListener('click', () => this.close());
    
    // Click esterno
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });
    
    // Gestione del tasto ESC
    this.escKeyHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escKeyHandler);
    
    // Opzione upload
    const uploadOption = this.element.querySelector('#option-upload');
    if (uploadOption) {
      uploadOption.addEventListener('click', () => {
        this.close();
        this.handleFileUpload();
      });
    }
    
    // Opzione URL
    const urlOption = this.element.querySelector('#option-url');
    if (urlOption) {
      urlOption.addEventListener('click', () => {
        this.close();
        this.handleImageURL();
      });
    }
  }
  
  /**
   * Chiude il modal
   */
  close() {
    // Animazione di chiusura
    this.element.style.opacity = '0';
    
    // Rimuovi dopo l'animazione
    setTimeout(() => {
      if (document.body.contains(this.element)) {
        this.element.remove();
      }
      
      // Ripristina lo stato del body
      document.body.classList.remove('modal-open');
      window.scrollTo(0, this.scrollY);
      
      // Rimuovi handler globali
      document.removeEventListener('keydown', this.escKeyHandler);
      
      // Notifica la cancellazione
      this.onCancel();
    }, 200);
  }
  
  /**
   * Gestisce l'inserimento dell'immagine tramite URL
   */
  handleImageURL() {
    const url = prompt('Enter image URL:');
    if (url) {
      this.onImageSelected({
        type: 'url',
        url: url
      });
    } else {
      this.onCancel();
    }
  }
  
  /**
   * Gestisce l'upload di un file
   */
  handleFileUpload() {
    // Crea un input file nascosto
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Quando il file viene selezionato
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        this.onCancel();
        fileInput.remove();
        return;
      }
      
      this.onImageSelected({
        type: 'file',
        file: file
      });
      
      // Pulisci e rimuovi l'input
      fileInput.value = '';
      fileInput.remove();
    };
    
    // Apri il selettore file
    fileInput.click();
  }
  
  /**
   * Factory method per mostrare il selettore immagini
   * @param {Object} options - Opzioni di configurazione
   * @returns {Promise} - Promise che si risolve quando un'immagine viene selezionata
   */
  static showImageSelector(options = {}) {
    return new Promise((resolve, reject) => {
      const uploader = new ImageUploader({
        ...options,
        onImageSelected: (result) => resolve(result),
        onCancel: () => reject(new Error('Image selection cancelled'))
      });
      
      uploader.show();
    });
  }
}