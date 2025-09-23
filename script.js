// --- Variables Globales y Estado del Juego ---
const gameScreen = document.getElementById('game-container');
const starCountEl = document.getElementById('star-count');
const cardCountEl = document.getElementById('card-count');
const totalCardsInGame = 100; 

let gameState = {
    stars: 100,
    collection: {}, 
};

// --- Sistema de Guardado ---
const saveGame = () => {
    localStorage.setItem('yugioh_collection_game', JSON.stringify(gameState));
    console.log('Juego guardado.');
};

const loadGame = () => {
    const savedState = localStorage.getItem('yugioh_collection_game');
    if (savedState) {
        gameState = JSON.parse(savedState);
        console.log('Juego cargado.');
    }
};

// --- Manejo de la Interfaz ---
const updateUI = () => {
    const roundedStars = gameState.stars.toFixed(2);
    starCountEl.textContent = `Estrellas: ${roundedStars} ⭐`;
    const uniqueCards = Object.keys(gameState.collection).length;
    cardCountEl.textContent = `Cartas: ${uniqueCards} / ${totalCardsInGame}`;
};

// La función principal para cambiar entre vistas
const switchView = (viewId) => {
    document.getElementById('shop-view').style.display = 'none';
    document.getElementById('collection-view').style.display = 'none';

    if (viewId === 'shop') {
        document.getElementById('shop-view').style.display = 'block';
        renderShop();
    } else if (viewId === 'collection') {
        document.getElementById('collection-view').style.display = 'block';
        renderCollection();
    }
};

// --- Funciones de renderizado de contenido ---
const renderShop = async () => {
    const shopView = document.getElementById('shop-view');
    shopView.innerHTML = '<h2>Tienda de Paquetes</h2><div class="shop-packs"></div>';

    const packsContainer = shopView.querySelector('.shop-packs');
    const packNames = [
    'pack_00001',
    //'booster_pack',
    // Aquí puedes agregar nuevos paquetes fácilmente en una línea separada
    //'gold_pack',
    //'legendary_pack',
	]; 

    for (const packName of packNames) {
        const packData = await fetchPackData(packName);
        if (packData) {
            // Se crea la ruta de la imagen del paquete
            const imagePath = `data/packs/images/${packName}.jpg`;

            const packCard = document.createElement('div');
            packCard.className = 'pack-card';
            packCard.innerHTML = `
                <img src="${imagePath}" alt="${packData.name}" class="pack-image">
                <h3>${packData.name}</h3>
                <p>Costo: ${packData.cost} ⭐</p>
                <button onclick="buyPack('${packName}', ${packData.cost})">Comprar</button>
            `;
            packsContainer.appendChild(packCard);
        }
    }
};

const renderCollection = async () => {
    const collectionView = document.getElementById('collection-view');
    collectionView.innerHTML = '<h2>Mi Colección</h2><div class="card-grid"></div>';
    
    const cardGrid = collectionView.querySelector('.card-grid');
    
    for (const cardId in gameState.collection) {
        const cardData = await fetchCardData(cardId);
        
        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        const cardCount = gameState.collection[cardId];
        const isRepeated = cardCount > 1;

        cardItem.innerHTML = `
            <a href="data/cards/images/${cardId}.jpg" data-lightbox="example-set"><img src="data/cards/images/${cardId}.jpg" alt="Carta ${cardId}"></a>
            ${cardData.valor !== undefined ? `<span class="card-value">${cardData.valor} ⭐</span>` : ''}
            ${isRepeated ? `<span class="repeat-count">x${cardCount}</span>` : ''}
            <button class="sell-button" onclick="sellCard('${cardId}')">Vender</button>
        `;
        cardGrid.appendChild(cardItem);
    }
};

// --- Lógica del Juego ---
const fetchCardData = async (cardId) => {
    try {
        const response = await fetch(`data/cards/json/${cardId}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error al cargar la carta ${cardId}:`, error);
        return null;
    }
};

const fetchPackData = async (packName) => {
    try {
        const response = await fetch(`data/packs/${packName}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error al cargar el paquete ${packName}:`, error);
        return null;
    }
};

const buyPack = async (packName, cost) => {
    if (gameState.stars >= cost) {
        gameState.stars -= cost;
        const packData = await fetchPackData(packName);
        if (packData) {
            openPack(packData);
        }
        updateUI();
        saveGame();
    } else {
        alert('No tienes suficientes estrellas para comprar este paquete.');
    }
};

const openPack = (packData) => {
    const cardsObtained = {};
    const cardIds = [];
    for (let i = 0; i < packData.cards_per_pack; i++) {
        let selectedCard = null;
        let randomValue = Math.random();
        let cumulativeProbability = 0;

        for (const cardEntry of packData.card_list) {
            cumulativeProbability += cardEntry.probability;
            if (randomValue <= cumulativeProbability) {
                selectedCard = cardEntry.card_id;
                break;
            }
        }
        if (selectedCard) {
            if (cardsObtained[selectedCard]) {
                cardsObtained[selectedCard]++;
            } else {
                cardsObtained[selectedCard] = 1;
            }
            if (gameState.collection[selectedCard]) {
                gameState.collection[selectedCard]++;
            } else {
                gameState.collection[selectedCard] = 1;
            }
        }
    }
    showOpenPackModal(cardsObtained);
    updateUI();
    saveGame();
};

const performSale = async (cardId) => {
    const cardData = await fetchCardData(cardId);
    
    gameState.stars += cardData.valor;
    gameState.collection[cardId]--;

    if (gameState.collection[cardId] === 0) {
        delete gameState.collection[cardId];
    }
    
    updateUI();
    renderCollection(); 
    saveGame();
};


const sellCard = async (cardId) => {
    if (gameState.collection[cardId] && gameState.collection[cardId] > 0) {
        // Verificar si es la última carta
        if (gameState.collection[cardId] === 1) {
            const cardData = await fetchCardData(cardId);
            // Mostrar el modal de confirmación
            showConfirmModal(`¿Estás seguro de que deseas vender la única carta de ${cardData.name}?`, () => {
                performSale(cardId);
            });
        } else {
            // Si hay más de una, vender directamente
            performSale(cardId);
        }
    } else {
        alert('No tienes esta carta para vender.');
    }
};

// --- Funciones del modal ---
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

const showConfirmModal = (message, onConfirm) => {
    confirmMessage.textContent = message;
    confirmModal.classList.add('show');

    // Manejadores de eventos de los botones
    const handleYes = () => {
        onConfirm();
        hideConfirmModal();
    };

    const handleNo = () => {
        hideConfirmModal();
    };
    
    // Remueve listeners anteriores para evitar múltiples ejecuciones
    confirmYesBtn.removeEventListener('click', handleYes);
    confirmNoBtn.removeEventListener('click', handleNo);
    
    confirmYesBtn.addEventListener('click', handleYes, { once: true });
    confirmNoBtn.addEventListener('click', handleNo, { once: true });
};

const hideConfirmModal = () => {
    confirmModal.classList.remove('show');
};

const openPackModal = document.getElementById('open-pack-modal');
const openPackCardGrid = document.getElementById('open-pack-card-grid');
const openPackOkBtn = document.getElementById('open-pack-ok-btn');

const showOpenPackModal = async (cardsObtained) => {
    openPackCardGrid.innerHTML = ''; // Limpiar el contenido del modal
    for (const cardId in cardsObtained) {
        const cardData = await fetchCardData(cardId);
        if (cardData) {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            const cardCount = cardsObtained[cardId];
            const isRepeated = cardCount > 1;

            cardItem.innerHTML = `
                <img src="data/cards/images/${cardId}.jpg" alt="Carta ${cardData.name}">
                ${cardData.valor !== undefined ? `<span class="card-value">${cardData.valor} ⭐</span>` : ''}
                ${isRepeated ? `<span class="repeat-count">x${cardCount}</span>` : ''}
            `;
            openPackCardGrid.appendChild(cardItem);
        }
    }
    openPackModal.classList.add('show');
};

const hideOpenPackModal = () => {
    openPackModal.classList.remove('show');
};

// --- Funciones de prueba ---
const addStars = () => {
    gameState.stars += 100;
    updateUI();
    saveGame();
};

const resetGame = () => {
    gameState.stars = 100;
    gameState.collection = {};
    updateUI();
    saveGame();
    switchView('collection');
};

// --- Eventos y Inicialización ---
document.getElementById('show-collection-btn').addEventListener('click', () => switchView('collection'));
document.getElementById('show-shop-btn').addEventListener('click', () => switchView('shop'));

document.getElementById('add-stars-btn').addEventListener('click', addStars);
document.getElementById('reset-game-btn').addEventListener('click', resetGame);
openPackOkBtn.addEventListener('click', hideOpenPackModal);

document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    updateUI();
    switchView('collection'); // CAMBIADO de 'shop' a 'collection'
});