// Variáveis globais
let currentSection = 'live';
let credentials = {};
let proxyIP = '';
let seriesInfo = {};
let currentSeriesId = null;
let historyStack = [];

// Aplicar tema salvo
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Alternar tema
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Verificar se o usuário já está logado
function checkLoginStatus() {
    const savedCredentials = localStorage.getItem('credentials');
    const savedProxy = localStorage.getItem('proxyIP');
    
    if (savedCredentials) {
        credentials = JSON.parse(savedCredentials);
        proxyIP = savedProxy || '';
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        loadSection('live');
        attachEventListeners();
    }
}

// Fazer login
function login() {
    const host = document.getElementById('host').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    proxyIP = document.getElementById('proxy').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!host || !username || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) {
        alert('O host deve começar com http:// ou https://');
        return;
    }

    credentials = { host, username, password };
    
    // Salvar credenciais se solicitado
    if (rememberMe) {
        localStorage.setItem('credentials', JSON.stringify(credentials));
        if (proxyIP) {
            localStorage.setItem('proxyIP', proxyIP);
        }
    }

    // Verificar credenciais
    fetch(`${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
        .then(response => response.json())
        .then(data => {
            if (data.user_info && data.user_info.auth === 1) {
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';
                loadSection('live');
                attachEventListeners();
            } else {
                alert('Credenciais inválidas.');
                localStorage.removeItem('credentials');
                localStorage.removeItem('proxyIP');
            }
        })
        .catch(error => {
            console.error('Erro na solicitação à API:', error);
            alert('Erro ao conectar com o servidor.');
            localStorage.removeItem('credentials');
            localStorage.removeItem('proxyIP');
        });
}

// Fazer logout
function logout() {
    localStorage.removeItem('credentials');
    localStorage.removeItem('proxyIP');
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';
    historyStack = [];
}

// Anexar event listeners
function attachEventListeners() {
    document.getElementById('loginButton').addEventListener('click', login);
    document.getElementById('searchButton').addEventListener('click', globalSearch);
    document.getElementById('accountButton').addEventListener('click', showAccountInfo);
    document.getElementById('logoutButton').addEventListener('click', logout);
    document.getElementById('playEpisodeButton').addEventListener('click', playEpisode);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('season-select').addEventListener('change', updateEpisodes);
    
    // Navegação por seção
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            loadSection(this.dataset.section);
        });
    });
}

// Carregar seção
function loadSection(section) {
    currentSection = section;
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    document.getElementById('content-grid').style.display = 'grid';
    
    historyStack = [{ type: 'section', section }];
    
    fetchCategories(section);
}

// Buscar categorias
function fetchCategories(section) {
    const action = section === 'live' ? 'get_live_categories' :
        section === 'movies' ? 'get_vod_categories' : 'get_series_categories';
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=${action}`;

    fetch(url)
        .then(response => response.json())
        .then(categories => {
            const sidebar = document.getElementById('categories');
            sidebar.innerHTML = '<ul>' + categories.map(cat => 
                `<li data-section="${section}" data-category-id="${cat.category_id}" data-category-name="${cat.category_name}">${cat.category_name}</li>`
            ).join('') + '</ul>';
            
            // Anexar listeners às categorias
            document.querySelectorAll('#categories li').forEach(item => {
                item.addEventListener('click', function() {
                    loadCategory(section, this.dataset.categoryId, this.dataset.categoryName);
                });
            });
            
            // Carregar primeira categoria por padrão
            if (categories.length > 0) {
                loadCategory(section, categories[0].category_id, categories[0].category_name);
            }
        })
        .catch(error => {
            console.error('Erro ao carregar categorias:', error);
            alert('Erro ao carregar categorias: ' + error.message);
        });
}

// Carregar categoria
function loadCategory(section, categoryId, categoryName) {
    const action = section === 'live' ? 'get_live_streams' :
        section === 'movies' ? 'get_vod_streams' : 'get_series';
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=${action}&category_id=${categoryId}`;

    historyStack.push({ type: 'category', section, categoryId, categoryName });

    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    const contentGrid = document.getElementById('content-grid');
    contentGrid.style.display = 'none';
    contentGrid.innerHTML = '';

    fetch(url)
        .then(response => response.json())
        .then(items => {
            contentGrid.innerHTML = items.length > 0 ? items.map(item => {
                const imageSrc = section === 'series' ? 
                    (item.cover || 'https://via.placeholder.com/200x150?text=Sem+Imagem') : 
                    (item.stream_icon || 'https://via.placeholder.com/200x150?text=Sem+Imagem');
                return `
                    <div class="content-item" data-section="${section}" data-stream-id="${item.stream_id || item.series_id}" data-name="${item.name}" data-icon="${imageSrc}">
                        <img src="${imageSrc}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/200x150?text=Sem+Imagem'"/>
                        <p class="title">${item.name}</p>
                    </div>
                `;
            }).join('') : '<p>Nenhum item disponível.</p>';
            
            contentGrid.style.display = 'grid';

            // Anexar listeners aos itens
            document.querySelectorAll('.content-item').forEach(item => {
                item.addEventListener('click', function() {
                    playStream(
                        this.dataset.section, 
                        this.dataset.streamId, 
                        this.dataset.name, 
                        this.dataset.icon
                    );
                });
            });
        })
        .catch(error => {
            console.error('Erro ao carregar itens:', error);
            contentGrid.innerHTML = '<p>Erro ao carregar itens.</p>';
            contentGrid.style.display = 'grid';
        });
}

// Reproduzir stream
function playStream(section, streamId, name, icon) {
    document.getElementById('content-grid').style.display = 'none';
    const playerDiv = document.getElementById('video-player');
    const videoTitle = document.getElementById('video-title');
    const videoInfo = document.getElementById('video-info');
    const seriesSelector = document.getElementById('series-selector');
    
    playerDiv.style.display = 'block';
    videoTitle.textContent = name;
    videoInfo.innerHTML = '';
    videoInfo.style.display = 'none';

    historyStack.push({ type: 'stream', section, streamId, name, icon });

    if (section === 'movies') {
        // Buscar informações do filme
        const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_vod_info&vod_id=${streamId}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                const genre = data.info && data.info.genre ? data.info.genre : 'N/A';
                const synopsis = data.info && data.info.plot ? data.info.plot : 'Sem descrição';
                videoInfo.innerHTML = `
                    <p class="genre"><strong>Gênero:</strong> ${genre}</p>
                    <p class="description">${synopsis}</p>
                `;
                videoInfo.style.display = 'block';
            })
            .catch(error => {
                console.error('Erro ao carregar informações do filme:', error);
            });
    } else if (section === 'series') {
        currentSeriesId = streamId;
        fetchSeriesInfo(streamId);
        seriesSelector.style.display = 'block';
    }

    const player = videojs('player');
    if (section !== 'series') {
        seriesSelector.style.display = 'none';
        
        let streamUrl = `${credentials.host}/${section === 'live' ? 'live' : 'movie'}/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${streamId}.${section === 'movies' ? 'mp4' : 'm3u8'}`;
        
        // Aplicar proxy se especificado
        if (proxyIP) {
            if (section === 'movies') {
                streamUrl = `http://${proxyIP}/mp4?url=${encodeURIComponent(streamUrl)}`;
            } else {
                streamUrl = `http://${proxyIP}/hlsretry?url=${encodeURIComponent(streamUrl)}`;
            }
        }
        
        if (section === 'movies') {
            player.src({
                src: streamUrl,
                type: 'video/mp4'
            });
        } else {
            player.src({
                src: streamUrl,
                type: 'application/x-mpegURL'
            });
        }
        player.play();
    }

    if (section === 'live') {
        fetchEPG(streamId);
    } else {
        document.getElementById('epg').style.display = 'none';
    }
}

// Buscar informações da série
function fetchSeriesInfo(seriesId) {
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_series_info&series_id=${seriesId}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            seriesInfo = data;
            const seasonSelect = document.getElementById('season-select');
            seasonSelect.innerHTML = '<option value="">Selecione a temporada</option>';
            
            if (data.seasons && Array.isArray(data.seasons)) {
                data.seasons.forEach(season => {
                    const option = document.createElement('option');
                    option.value = season.season_number;
                    option.textContent = `Temporada ${season.season_number}`;
                    seasonSelect.appendChild(option);
                });
            }
            
            updateEpisodes();

            const videoInfo = document.getElementById('video-info');
            const genre = data.info && data.info.genre ? data.info.genre : 'N/A';
            const synopsis = data.info && data.info.plot ? data.info.plot : 'Sem descrição';
            videoInfo.innerHTML = `
                <p class="genre"><strong>Gênero:</strong> ${genre}</p>
                <p class="description">${synopsis}</p>
            `;
            videoInfo.style.display = 'block';
        })
        .catch(error => {
            console.error('Erro ao carregar informações da série:', error);
            document.getElementById('series-selector').style.display = 'none';
        });
}

// Atualizar episódios
function updateEpisodes() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    const selectedSeason = seasonSelect.value;
    
    episodeSelect.innerHTML = '<option value="">Selecione o episódio</option>';

    if (selectedSeason && seriesInfo && seriesInfo.episodes && seriesInfo.episodes[selectedSeason]) {
        seriesInfo.episodes[selectedSeason].forEach(episode => {
            const option = document.createElement('option');
            option.value = episode.id;
            option.textContent = episode.title || `Episódio ${episode.episode_num}`;
            episodeSelect.appendChild(option);
        });
    }
}

// Reproduzir episódio
function playEpisode() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    const selectedEpisodeId = episodeSelect.value;

    if (selectedEpisodeId && seriesInfo && seriesInfo.episodes && seriesInfo.episodes[seasonSelect.value]) {
        const episode = seriesInfo.episodes[seasonSelect.value].find(ep => ep.id === selectedEpisodeId);
        if (episode) {
            const player = videojs('player');
            let streamUrl = `${credentials.host}/series/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${selectedEpisodeId}.${episode.container_extension || 'm3u8'}`;
            
            // Aplicar proxy se especificado
            if (proxyIP) {
                if (episode.container_extension === 'mp4') {
                    streamUrl = `http://${proxyIP}/mp4?url=${encodeURIComponent(streamUrl)}`;
                } else {
                    streamUrl = `http://${proxyIP}/hlsretry?url=${encodeURIComponent(streamUrl)}`;
                }
            }
            
            if (episode.container_extension === 'mp4') {
                player.src({
                    src: streamUrl,
                    type: 'video/mp4'
                });
            } else {
                player.src({
                    src: streamUrl,
                    type: 'application/x-mpegURL'
                });
            }
            player.play();
        }
    }
}

// Buscar EPG
function fetchEPG(streamId) {
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_short_epg&stream_id=${streamId}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const epgList = document.getElementById('epg-list');
            if (data.epg_listings && Array.isArray(data.epg_listings)) {
                epgList.innerHTML = data.epg_listings.map(program => {
                    const startTimestamp = program.start_timestamp || null;
                    const endTimestamp = program.stop_timestamp || null;
                    const start = startTimestamp ? new Date(startTimestamp * 1000).toLocaleString('pt-BR', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit', hour12: false 
                    }) : 'N/A';
                    const end = endTimestamp ? new Date(endTimestamp * 1000).toLocaleString('pt-BR', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit', hour12: false 
                    }) : 'N/A';
                    
                    let title = 'Sem título';
                    let description = '';
                    
                    try {
                        title = program.title ? decodeURIComponent(escape(atob(program.title))) : 'Sem título';
                        description = program.description ? decodeURIComponent(escape(atob(program.description))) : '';
                    } catch (e) {
                        console.error('Erro ao decodificar título ou descrição:', e);
                    }
                    
                    if (!title || title.trim() === '') title = 'Sem título';
                    if (!description || description.trim() === '') description = 'Sem descrição';

                    return `
                        <div class="epg-item">
                            <div class="time">${start} - ${end}</div>
                            <div class="title"><strong>${title}</strong></div>
                            <div class="description">${description}</div>
                        </div>
                    `;
                }).join('');
                document.getElementById('epg').style.display = 'block';
            } else {
                epgList.innerHTML = '<p>Nenhum EPG disponível.</p>';
                document.getElementById('epg').style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar EPG:', error);
            document.getElementById('epg').style.display = 'none';
        });
}

// Pesquisa global
function globalSearch() {
    const query = document.getElementById('search').value.toLowerCase();
    if (!query) {
        loadSection(currentSection);
        return;
    }
    
    historyStack.push({ type: 'search', query });
    
    const contentGrid = document.getElementById('content-grid');
    document.getElementById('video-player').style.display = 'none';
    document.getElementById('epg').style.display = 'none';
    document.getElementById('series-selector').style.display = 'none';
    contentGrid.style.display = 'none';
    contentGrid.innerHTML = '';

    // Buscar em todas as seções
    const liveUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_live_streams`;
    const vodUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_vod_streams`;
    const seriesUrl = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}&action=get_series`;

    Promise.all([
        fetch(liveUrl).then(response => response.json()),
        fetch(vodUrl).then(response => response.json()),
        fetch(seriesUrl).then(response => response.json())
    ])
    .then(([live, vod, series]) => {
        const liveResults = Array.isArray(live) ? live.filter(item => 
            (item.name || '').toLowerCase().includes(query)
        ).map(item => ({ section: 'live', ...item })) : [];
        
        const vodResults = Array.isArray(vod) ? vod.filter(item => 
            (item.name || '').toLowerCase().includes(query)
        ).map(item => ({ section: 'movies', ...item })) : [];
        
        const seriesResults = Array.isArray(series) ? series.filter(item => 
            (item.name || '').toLowerCase().includes(query)
        ).map(item => ({ section: 'series', ...item })) : [];
        
        const results = [...liveResults, ...vodResults, ...seriesResults];
        
        contentGrid.innerHTML = results.length > 0 ? results.map(item => {
            const imageSrc = item.section === 'series' ? 
                (item.cover || 'https://via.placeholder.com/200x150?text=Sem+Imagem') : 
                (item.stream_icon || 'https://via.placeholder.com/200x150?text=Sem+Imagem');
            const itemName = item.name || 'Sem título';
            const itemId = item.stream_id || item.series_id || '';
            
            return `
                <div class="content-item" data-section="${item.section}" data-stream-id="${itemId}" data-name="${itemName}" data-icon="${imageSrc}">
                    <img src="${imageSrc}" alt="${itemName}" onerror="this.src='https://via.placeholder.com/200x150?text=Sem+Imagem'"/>
                    <p class="title">${itemName}</p>
                </div>
            `;
        }).join('') : '<p>Nenhum resultado encontrado.</p>';
        
        contentGrid.style.display = 'grid';

        // Anexar listeners aos resultados
        document.querySelectorAll('.content-item').forEach(item => {
            item.addEventListener('click', function() {
                playStream(
                    this.dataset.section, 
                    this.dataset.streamId, 
                    this.dataset.name, 
                    this.dataset.icon
                );
            });
        });
    })
    .catch(error => {
        console.error('Erro na pesquisa:', error);
        contentGrid.innerHTML = '<p>Erro ao carregar resultados da busca.</p>';
        contentGrid.style.display = 'grid';
    });
}

// Mostrar informações da conta
function showAccountInfo() {
    const url = `${credentials.host}/player_api.php?username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const userInfo = data.user_info;
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="modal-close">×</span>
                    <h3>Informações da Conta</h3>
                    <div class="account-info">
                        <p><strong>Usuário:</strong> ${userInfo.username}</p>
                        <p><strong>Data de Criação:</strong> ${new Date(userInfo.created_at * 1000).toLocaleDateString()}</p>
                        <p><strong>Expiração:</strong> ${userInfo.exp_date ? new Date(userInfo.exp_date * 1000).toLocaleDateString() : 'Nunca expira'}</p>
                        <p><strong>Conexões Máximas:</strong> ${userInfo.max_connections || 'Ilimitado'}</p>
                        <p><strong>Conexões Atuais:</strong> ${userInfo.active_cons || '0'}</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const closeButton = modal.querySelector('.modal-close');
            closeButton.addEventListener('click', () => {
                modal.remove();
            });
            
            // Fechar modal ao clicar fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        })
        .catch(error => {
            console.error('Erro ao carregar informações da conta:', error);
            alert('Erro ao carregar informações da conta: ' + error.message);
        });
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    applySavedTheme();
    checkLoginStatus();
});
