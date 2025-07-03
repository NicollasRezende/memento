// === CONFIGURAÇÕES === //
const CONFIG = {
    PIN: '1234', // MUDE PARA O CÓDIGO QUE VOCÊS QUISEREM!
    IMGBB_API_KEY: 'bcfb741e6d085a2d8e0df6eafc8d2101', // Substitua pela sua chave da API ImgBB
    STORAGE_KEYS: {
        AUTH: 'memories_auth',
        PHOTOS: 'memories_photos',
        VIDEOS: 'memories_videos',
        NOTES: 'memories_notes'
    }
};

// === MÓDULO DE AUTENTICAÇÃO === //
const Auth = (() => {
    const hashPin = (pin) => btoa(pin + 'love');
    
    return {
        login(pin) {
            if (pin === CONFIG.PIN) {
                const token = btoa(Date.now() + Math.random());
                localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH, token);
                return true;
            }
            return false;
        },
        
        logout() {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH);
            location.reload();
        },
        
        isAuthenticated() {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH) !== null;
        }
    };
})();

// === MÓDULO DE ARMAZENAMENTO === //
const Storage = (() => {
    return {
        get(key) {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        },
        
        save(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
        },
        
        add(key, item) {
            const items = this.get(key);
            items.unshift(item);
            this.save(key, items);
        },
        
        remove(key, id) {
            const items = this.get(key);
            const filtered = items.filter(item => item.id !== id);
            this.save(key, filtered);
        }
    };
})();

// === MÓDULO DE UPLOAD === //
const Upload = (() => {
    const uploadToImgBB = async (file) => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.data.url;
            } else {
                throw new Error('Upload falhou');
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    };
    
    const uploadMultipleImages = async (files, onProgress) => {
        const results = [];
        const total = files.length;
        
        for (let i = 0; i < files.length; i++) {
            try {
                if (onProgress) {
                    onProgress(i + 1, total, files[i].name);
                }
                
                const url = await uploadToImgBB(files[i]);
                results.push({
                    success: true,
                    url: url,
                    file: files[i]
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    file: files[i]
                });
            }
        }
        
        return results;
    };
    
    return {
        uploadImage: uploadToImgBB,
        uploadMultiple: uploadMultipleImages
    };
})();

// === MÓDULO DE UI === //
const UI = (() => {
    let currentSection = 'photos';
    let selectedNoteColor = '#FFE5B4';
    let pendingFiles = []; // Armazenar arquivos pendentes
    let editMode = {
        photos: false,
        videos: false,
        notes: false
    };
    let itemToDelete = null;
    
    return {
        init() {
            this.bindEvents();
            this.checkAuth();
        },
        
        checkAuth() {
            if (Auth.isAuthenticated()) {
                document.getElementById('loginScreen').classList.remove('active');
                document.getElementById('app').classList.add('active');
                this.loadContent();
            }
        },
        
        bindEvents() {
            // Login
            document.getElementById('loginBtn').addEventListener('click', this.handleLogin);
            document.getElementById('pinInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
            
            // Logout
            document.getElementById('logoutBtn').addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    Auth.logout();
                }
            });
            
            // Navegação
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchSection(link.dataset.section);
                });
            });
            
            // Botões de adicionar
            document.querySelectorAll('.add-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.handleAdd(btn.dataset.type);
                });
            });
            
            // Upload de foto
            const photoInput = document.getElementById('photoInput');
            const photoUploadArea = document.getElementById('photoUploadArea');
            
            photoInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                
                // Filtrar apenas imagens
                const imageFiles = files.filter(file => file.type.startsWith('image/'));
                
                if (imageFiles.length > 0) {
                    // Mostrar preview
                    UI.showImagePreview(imageFiles);
                    
                    // Adicionar botão de upload
                    const previewContainer = document.getElementById('uploadPreview');
                    const uploadBtn = document.createElement('button');
                    uploadBtn.className = 'select-btn';
                    uploadBtn.style.marginTop = '1rem';
                    uploadBtn.textContent = `Enviar ${imageFiles.length} foto(s)`;
                    uploadBtn.onclick = async () => {
                        uploadBtn.disabled = true;
                        uploadBtn.textContent = 'Enviando...';
                        
                        UI.showLoadingWithProgress(`Preparando upload de ${pendingFiles.length} imagem(ns)...`);
                        
                        const results = await Upload.uploadMultiple(pendingFiles, (current, total, fileName) => {
                            UI.showLoadingWithProgress(`Enviando ${fileName} (${current}/${total})...`);
                        });
                        
                        // Processar resultados
                        const successfulUploads = results.filter(r => r.success);
                        const failedUploads = results.filter(r => !r.success);
                        
                        // Adicionar fotos bem-sucedidas
                        successfulUploads.forEach(result => {
                            const photo = {
                                id: Date.now() + Math.random(),
                                url: result.url,
                                date: new Date().toLocaleDateString('pt-BR')
                            };
                            Storage.add(CONFIG.STORAGE_KEYS.PHOTOS, photo);
                        });
                        
                        UI.hideLoading();
                        
                        // Mostrar resultado
                        if (failedUploads.length > 0) {
                            alert(`${successfulUploads.length} foto(s) enviada(s) com sucesso!\n${failedUploads.length} foto(s) falharam.`);
                        } else {
                            UI.showSuccess(`${successfulUploads.length} foto(s) adicionada(s) com sucesso! 💕`);
                        }
                        
                        this.renderPhotos();
                        photoUploadArea.style.display = 'none';
                        photoInput.value = ''; // Limpar input
                        previewContainer.innerHTML = ''; // Limpar preview
                        pendingFiles = []; // Limpar arquivos pendentes
                    };
                    previewContainer.appendChild(uploadBtn);
                }
            });
            
            // Drag and drop
            const uploadBox = photoUploadArea.querySelector('.upload-box');
            
            uploadBox.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadBox.classList.add('drag-over');
            });
            
            uploadBox.addEventListener('dragleave', () => {
                uploadBox.classList.remove('drag-over');
            });
            
            uploadBox.addEventListener('drop', async (e) => {
                e.preventDefault();
                uploadBox.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                const imageFiles = files.filter(file => file.type.startsWith('image/'));
                
                if (imageFiles.length > 0) {
                    // Mostrar preview
                    UI.showImagePreview(imageFiles);
                    
                    // Adicionar botão de upload
                    const previewContainer = document.getElementById('uploadPreview');
                    const uploadBtn = document.createElement('button');
                    uploadBtn.className = 'select-btn';
                    uploadBtn.style.marginTop = '1rem';
                    uploadBtn.textContent = `Enviar ${imageFiles.length} foto(s)`;
                    uploadBtn.onclick = async () => {
                        uploadBtn.disabled = true;
                        uploadBtn.textContent = 'Enviando...';
                        
                        UI.showLoadingWithProgress(`Preparando upload de ${pendingFiles.length} imagem(ns)...`);
                        
                        const results = await Upload.uploadMultiple(pendingFiles, (current, total, fileName) => {
                            UI.showLoadingWithProgress(`Enviando ${fileName} (${current}/${total})...`);
                        });
                        
                        // Processar resultados
                        const successfulUploads = results.filter(r => r.success);
                        const failedUploads = results.filter(r => !r.success);
                        
                        // Adicionar fotos bem-sucedidas
                        successfulUploads.forEach(result => {
                            const photo = {
                                id: Date.now() + Math.random(),
                                url: result.url,
                                date: new Date().toLocaleDateString('pt-BR')
                            };
                            Storage.add(CONFIG.STORAGE_KEYS.PHOTOS, photo);
                        });
                        
                        UI.hideLoading();
                        
                        // Mostrar resultado
                        if (failedUploads.length > 0) {
                            alert(`${successfulUploads.length} foto(s) enviada(s) com sucesso!\n${failedUploads.length} foto(s) falharam.`);
                        } else {
                            UI.showSuccess(`${successfulUploads.length} foto(s) adicionada(s) com sucesso! 💕`);
                        }
                        
                        this.renderPhotos();
                        photoUploadArea.style.display = 'none';
                        previewContainer.innerHTML = ''; // Limpar preview
                        pendingFiles = []; // Limpar arquivos pendentes
                    };
                    previewContainer.appendChild(uploadBtn);
                }
            });
            
            // Adicionar vídeo
            document.getElementById('addVideoBtn').addEventListener('click', () => {
                const urlInput = document.getElementById('videoUrlInput');
                const url = urlInput.value.trim();
                
                if (url) {
                    // Extrair ID do YouTube
                    let videoId = '';
                    if (url.includes('youtube.com/watch?v=')) {
                        videoId = url.split('v=')[1].split('&')[0];
                    } else if (url.includes('youtu.be/')) {
                        videoId = url.split('youtu.be/')[1];
                    }
                    
                    if (videoId) {
                        const video = {
                            id: Date.now(),
                            videoId: videoId,
                            title: 'Nosso vídeo',
                            date: new Date().toLocaleDateString('pt-BR')
                        };
                        Storage.add(CONFIG.STORAGE_KEYS.VIDEOS, video);
                        this.renderVideos();
                        urlInput.value = '';
                        document.getElementById('videoUploadArea').style.display = 'none';
                    } else {
                        alert('Por favor, insira um link válido do YouTube!');
                    }
                }
            });
            
            // Modal de recadinhos
            document.getElementById('saveNoteBtn').addEventListener('click', () => {
                const text = document.getElementById('noteText').value.trim();
                if (text) {
                    const note = {
                        id: Date.now(),
                        text: text,
                        color: selectedNoteColor,
                        date: new Date().toLocaleDateString('pt-BR')
                    };
                    Storage.add(CONFIG.STORAGE_KEYS.NOTES, note);
                    this.renderNotes();
                    this.closeNoteModal();
                }
            });
            
            document.getElementById('cancelNoteBtn').addEventListener('click', () => {
                this.closeNoteModal();
            });
            
            // Seletor de cor
            document.querySelectorAll('.color').forEach(color => {
                color.addEventListener('click', () => {
                    document.querySelectorAll('.color').forEach(c => c.classList.remove('active'));
                    color.classList.add('active');
                    selectedNoteColor = color.dataset.color;
                });
            });
            
            // Lightbox
            document.getElementById('lightbox').addEventListener('click', () => {
                document.getElementById('lightbox').classList.remove('active');
            });
            
            // Modal de confirmação de exclusão
            document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                if (itemToDelete) {
                    const { type, id } = itemToDelete;
                    let storageKey;
                    
                    switch(type) {
                        case 'photo':
                            storageKey = CONFIG.STORAGE_KEYS.PHOTOS;
                            break;
                        case 'video':
                            storageKey = CONFIG.STORAGE_KEYS.VIDEOS;
                            break;
                        case 'note':
                            storageKey = CONFIG.STORAGE_KEYS.NOTES;
                            break;
                    }
                    
                    if (storageKey) {
                        Storage.remove(storageKey, id);
                        this.closeDeleteModal();
                        
                        // Recarregar o conteúdo apropriado
                        switch(type) {
                            case 'photo':
                                this.renderPhotos();
                                break;
                            case 'video':
                                this.renderVideos();
                                break;
                            case 'note':
                                this.renderNotes();
                                break;
                        }
                        
                        UI.showSuccess('Item removido com sucesso!');
                    }
                }
            });
            
            document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                this.closeDeleteModal();
            });
        },
        
        handleLogin() {
            const pin = document.getElementById('pinInput').value;
            if (Auth.login(pin)) {
                document.getElementById('loginScreen').classList.remove('active');
                document.getElementById('app').classList.add('active');
                UI.loadContent();
            } else {
                alert('Código incorreto! Tente novamente 💔');
                document.getElementById('pinInput').value = '';
                document.getElementById('pinInput').focus();
            }
        },
        
        switchSection(section) {
            currentSection = section;
            
            // Atualizar navegação
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('active', link.dataset.section === section);
            });
            
            // Mostrar seção
            document.querySelectorAll('.section').forEach(sec => {
                sec.classList.toggle('active', sec.id === section);
            });
        },
        
        handleAdd(type) {
            switch(type) {
                case 'photo':
                    const photoUploadArea = document.getElementById('photoUploadArea');
                    if (photoUploadArea.style.display === 'none') {
                        photoUploadArea.style.display = 'block';
                    } else {
                        photoUploadArea.style.display = 'none';
                        document.getElementById('uploadPreview').innerHTML = '';
                        pendingFiles = [];
                    }
                    break;
                case 'video':
                    const videoUploadArea = document.getElementById('videoUploadArea');
                    videoUploadArea.style.display = videoUploadArea.style.display === 'none' ? 'block' : 'none';
                    document.getElementById('videoUrlInput').focus();
                    break;
                case 'note':
                    this.openNoteModal();
                    break;
            }
        },
        
        openNoteModal() {
            document.getElementById('noteModal').classList.add('active');
            document.getElementById('noteText').value = '';
            document.getElementById('noteText').focus();
            document.querySelector('.color').click(); // Selecionar primeira cor
        },
        
        closeNoteModal() {
            document.getElementById('noteModal').classList.remove('active');
        },
        
        loadContent() {
            this.renderPhotos();
            this.renderVideos();
            this.renderNotes();
        },
        
        renderPhotos() {
            const photos = Storage.get(CONFIG.STORAGE_KEYS.PHOTOS);
            const gallery = document.getElementById('photoGallery');
            
            if (photos.length === 0) {
                gallery.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">Nenhuma foto ainda... Adicione a primeira! 📸</p>';
                return;
            }
            
            gallery.innerHTML = photos.map(photo => `
                <div class="photo-item" data-id="${photo.id}">
                    <img src="${photo.url}" alt="Memória" loading="lazy" onclick="UI.openLightbox('${photo.url}')">
                    <div class="photo-date">${photo.date}</div>
                    <button class="delete-btn" onclick="event.stopPropagation(); UI.confirmDelete('photo', ${photo.id})">🗑️</button>
                </div>
            `).join('');
        },
        
        renderVideos() {
            const videos = Storage.get(CONFIG.STORAGE_KEYS.VIDEOS);
            const gallery = document.getElementById('videoGallery');
            
            if (videos.length === 0) {
                gallery.innerHTML = '<p style="text-align: center; color: #999;">Nenhum vídeo ainda... Adicione o primeiro! 🎥</p>';
                return;
            }
            
            gallery.innerHTML = videos.map(video => `
                <div class="video-item" data-id="${video.id}">
                    <iframe src="https://www.youtube.com/embed/${video.videoId}" allowfullscreen></iframe>
                    <div class="video-info">
                        <h3>${video.title}</h3>
                        <div class="video-date">${video.date}</div>
                    </div>
                    <button class="delete-btn" onclick="UI.confirmDelete('video', ${video.id})">🗑️</button>
                </div>
            `).join('');
        },
        
        renderNotes() {
            const notes = Storage.get(CONFIG.STORAGE_KEYS.NOTES);
            const board = document.getElementById('notesBoard');
            
            if (notes.length === 0) {
                board.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">Nenhum recadinho ainda... Deixe o primeiro! 💝</p>';
                return;
            }
            
            board.innerHTML = notes.map(note => `
                <div class="post-it" style="background-color: ${note.color}" data-id="${note.id}">
                    ${note.text}
                    <div class="post-it-date">${note.date}</div>
                    <button class="delete-btn" onclick="UI.confirmDelete('note', ${note.id})">🗑️</button>
                </div>
            `).join('');
        },
        
        openLightbox(url) {
            document.getElementById('lightboxImg').src = url;
            document.getElementById('lightbox').classList.add('active');
        },
        
        showLoading() {
            document.getElementById('loading').classList.add('active');
        },
        
        hideLoading() {
            document.getElementById('loading').classList.remove('active');
        },
        
        showLoadingWithProgress(message) {
            const loading = document.getElementById('loading');
            const p = loading.querySelector('p');
            p.textContent = message;
            loading.classList.add('active');
        },
        
        showSuccess(message) {
            // Criar notificação temporária de sucesso
            const notification = document.createElement('div');
            notification.className = 'success-notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
                color: white;
                padding: 1rem 2rem;
                border-radius: 50px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 500;
                animation: slideDown 0.5s ease-out;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideUp 0.5s ease-out';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        },
        
        showImagePreview(files) {
            const previewContainer = document.getElementById('uploadPreview');
            previewContainer.innerHTML = '';
            pendingFiles = [...files]; // Armazenar arquivos
            
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.dataset.index = index;
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="Preview ${index + 1}">
                        <button class="remove-btn" onclick="UI.removePreviewItem(this, ${index})">&times;</button>
                    `;
                    previewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
        },
        
        removePreviewItem(btn, index) {
            btn.parentElement.remove();
            pendingFiles = pendingFiles.filter((_, i) => i !== index);
            
            // Atualizar o contador no botão de upload
            const previewContainer = document.getElementById('uploadPreview');
            const uploadBtn = previewContainer.querySelector('.select-btn');
            
            if (uploadBtn && pendingFiles.length > 0) {
                uploadBtn.textContent = `Enviar ${pendingFiles.length} foto(s)`;
            } else if (uploadBtn && pendingFiles.length === 0) {
                uploadBtn.remove();
            }
        },
        
        toggleEditMode(section) {
            editMode[section] = !editMode[section];
            const sectionElement = document.getElementById(section);
            const editBtn = sectionElement.querySelector('.edit-btn');
            
            if (editMode[section]) {
                sectionElement.classList.add('edit-mode');
                editBtn.classList.add('active');
                editBtn.innerHTML = '<span class="icon">✓</span> Concluído';
            } else {
                sectionElement.classList.remove('edit-mode');
                editBtn.classList.remove('active');
                editBtn.innerHTML = '<span class="icon">✏️</span> Editar';
            }
        },
        
        confirmDelete(type, id) {
            itemToDelete = { type, id };
            document.getElementById('deleteModal').classList.add('active');
        },
        
        closeDeleteModal() {
            document.getElementById('deleteModal').classList.remove('active');
            itemToDelete = null;
        }
    };
})();

// === INICIALIZAÇÃO === //
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    
    // Prevenir arrastar imagens acidentalmente
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG' && !e.target.closest('.upload-box')) {
            e.preventDefault();
        }
    });
});