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
        // Mostra loading
        UI.showLoading();
        
        try {
            // Para demonstração, vou simular um upload
            // Na versão real, você precisa de uma chave API do ImgBB
            // Cadastre-se em https://imgbb.com/ para obter uma chave gratuita
            
            // Código real seria:

            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success) {
                return data.data.url;
            }
            
        } catch (error) {
            UI.hideLoading();
            alert('Erro ao fazer upload. Tente novamente!');
            console.error('Upload error:', error);
            return null;
        }
    };
    
    return {
        uploadImage: uploadToImgBB
    };
})();

// === MÓDULO DE UI === //
const UI = (() => {
    let currentSection = 'photos';
    let selectedNoteColor = '#FFE5B4';
    
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
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const url = await Upload.uploadImage(file);
                    if (url) {
                        const photo = {
                            id: Date.now(),
                            url: url,
                            date: new Date().toLocaleDateString('pt-BR')
                        };
                        Storage.add(CONFIG.STORAGE_KEYS.PHOTOS, photo);
                        this.renderPhotos();
                        photoUploadArea.style.display = 'none';
                    }
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
                
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const url = await Upload.uploadImage(file);
                    if (url) {
                        const photo = {
                            id: Date.now(),
                            url: url,
                            date: new Date().toLocaleDateString('pt-BR')
                        };
                        Storage.add(CONFIG.STORAGE_KEYS.PHOTOS, photo);
                        this.renderPhotos();
                        photoUploadArea.style.display = 'none';
                    }
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
                    photoUploadArea.style.display = photoUploadArea.style.display === 'none' ? 'block' : 'none';
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
                <div class="photo-item" onclick="UI.openLightbox('${photo.url}')">
                    <img src="${photo.url}" alt="Memória" loading="lazy">
                    <div class="photo-date">${photo.date}</div>
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
                <div class="video-item">
                    <iframe src="https://www.youtube.com/embed/${video.videoId}" allowfullscreen></iframe>
                    <div class="video-info">
                        <h3>${video.title}</h3>
                        <div class="video-date">${video.date}</div>
                    </div>
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
                <div class="post-it" style="background-color: ${note.color}">
                    ${note.text}
                    <div class="post-it-date">${note.date}</div>
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