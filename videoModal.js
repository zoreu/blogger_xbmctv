function openModal(el) {
    var rawBody = el.getAttribute("data-video-url");
    
    // Expressão regular para encontrar a primeira URL http/https
    // Note: Usei 'var' e sintaxe mais antiga para máxima compatibilidade.
    var urlMatch = rawBody.match(/(https?:\/\/[^\s<]+)/);
    
    if (urlMatch && urlMatch[0]) {
        var videoUrl = urlMatch[0];
        var modalFrame = document.getElementById("modalFrame");
        
        // Adiciona o autoplay
        // Usando o método .indexOf() para compatibilidade
        var finalUrl = videoUrl + (videoUrl.indexOf('?') > -1 ? '&' : '?') + 'autoplay=1';

        modalFrame.src = finalUrl;
        document.getElementById("videoModal").style.display = "flex";
    } else {
        console.error("Não foi possível extrair a URL de vídeo do post.");
    }
}

function closeModal() {
    var modal = document.getElementById("videoModal");
    modal.style.display = "none";
    document.getElementById("modalFrame").src = "";
}

// Configuração do clique fora do modal
window.onload = function() {
    var modal = document.getElementById("videoModal");
    if (modal) {
        modal.onclick = function(event) {
            if(event.target === modal) { closeModal(); }
        };
    }
};
