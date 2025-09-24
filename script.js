// --- Variables Globales y Estado del Juego ---
const starCountEl = document.getElementById('star-count');
const cardCountEl = document.getElementById('card-count');
let totalCardsInGame = 0; // dinámico según packs listados

let gameState = {
    stars: 100,
    collection: {}, // { cardId: count, ... }
};

// --- Sistema de Guardado ---
const saveGame = () => {
    localStorage.setItem('yugioh_collection_game', JSON.stringify(gameState));
};

const loadGame = () => {
    const savedState = localStorage.getItem('yugioh_collection_game');
    if (savedState) {
        gameState = JSON.parse(savedState);
    }
};


// --- Packs listados MANUALMENTE ---
const PACK_LIST = [
    'pack_00001',
    'pack_00002',
    'pack_00003',
    'pack_00004',
    'pack_00005',
    'pack_00006',
    'pack_00007',
    'pack_00008',
    'pack_00009',
    'pack_00010',
    'pack_00011',
    // agrega/quita manualmente los packs que desees en tienda
];


// --- Calcular total global de cartas según los packs visibles ---
const calculateTotalCardsInGame = async () => {
    let total = 0;
    for (const packName of PACK_LIST) {
        const packData = await fetchPackData(packName);
        if (packData && Array.isArray(packData.card_list)) {
            total += packData.card_list.length;
        }
    }
    totalCardsInGame = total;
};

// --- Manejo de la Interfaz ---
const updateUI = () => {
    const roundedStars = gameState.stars.toFixed(2);
    starCountEl.textContent = `Estrellas: ${roundedStars} ⭐`;
    const uniqueCards = Object.keys(gameState.collection).length;
    const percentGlobal = totalCardsInGame > 0 ? ((uniqueCards / totalCardsInGame) * 100).toFixed(1) : 0;
    cardCountEl.textContent = `Cartas: ${uniqueCards} / ${totalCardsInGame} (${percentGlobal}%)`;
};

// --- Vistas ---
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

// --- Fetch datos ---
const fetchCardData = async (cardId) => {
    try {
        const response = await fetch(`data/cards/json/${cardId}.json`);
        return await response.json();
    } catch {
        return null;
    }
};

const fetchPackData = async (packName) => {
    try {
        const response = await fetch(`data/packs/${packName}.json`);
        return await response.json();
    } catch {
        return null;
    }
};

// --- Render Tienda ---
const renderShop = async () => {
    const shopView = document.getElementById('shop-view');
    shopView.innerHTML = '<h2>Tienda de Paquetes</h2><div class="shop-packs"></div>';

    const packsContainer = shopView.querySelector('.shop-packs');
    for (const packName of PACK_LIST) {
        const packData = await fetchPackData(packName);
        if (packData) {
            const imagePath = `data/packs/images/${packName}.jpg`;

            const packCard = document.createElement('div');
            packCard.className = 'pack-card';
            packCard.innerHTML = `
                <img src="${imagePath}" 
                     alt="${packData.name}" 
                     class="pack-image" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='data/packs/images/pack_00000.jpg';">
                <h3>${packData.name}</h3>
                <p>Costo: ${packData.cost} ⭐</p>
                <button onclick="previewPack('${packName}', ${packData.cost})">Ver</button>
            `;
            packsContainer.appendChild(packCard);
        }
    }
};


// -----------------------
// COLLECTION (Infinite Scroll)
// -----------------------
const COLLECTION_BATCH_SIZE = 30;
let collectionIds = [];
let collectionObserver = null;
let collectionSentinel = null;

const collectionViewEl = document.getElementById('collection-view');

// Sentinel para scroll
const ensureSentinel = () => {
    if (!collectionSentinel) {
        collectionSentinel = document.createElement('div');
        collectionSentinel.id = 'collection-sentinel';
        collectionSentinel.style.width = '100%';
        collectionSentinel.style.height = '1px';
    }
    return collectionSentinel;
};

const initCollectionObserver = (container, loadMoreCallback) => {
    if (collectionObserver) {
        collectionObserver.disconnect();
        collectionObserver = null;
    }
    collectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                loadMoreCallback();
            }
        }
    }, {
        root: container,
        rootMargin: '300px',
        threshold: 0.1
    });
};

const createCardElement = async (cardId) => {
    const cardData = await fetchCardData(cardId);
    const cardCount = gameState.collection[cardId] || 0;
    const cardItem = document.createElement('div');
    cardItem.className = 'card-item';
    cardItem.id = `card-item-${cardId}`;

    const valorTag = (cardData && cardData.valor !== undefined) ? `<span class="card-value">${cardData.valor} ⭐</span>` : '';
    const repeatTag = (cardCount > 1) ? `<span class="repeat-count">x${cardCount}</span>` : '';
    const imgSrc = `data/cards/images/${cardId}.jpg`;

    cardItem.innerHTML = `
        <a href="${imgSrc}" data-lightbox="example-set">
            <img src="${imgSrc}" alt="Carta ${cardId}" loading="lazy">
        </a>
        ${valorTag}
        ${repeatTag}
        <button class="sell-button" data-cardid="${cardId}">Vender</button>
    `;

    cardItem.querySelector('.sell-button').addEventListener('click', () => {
        sellCard(cardId);
    });

    return cardItem;
};

const renderCollection = async () => {
    const collectionView = document.getElementById('collection-view');
    collectionView.innerHTML = '<h2>Mi Colección</h2><div class="card-grid" id="card-grid"></div>';

    const cardGrid = document.getElementById('card-grid');

    collectionIds = Object.keys(gameState.collection);

    const sentinel = ensureSentinel();
    cardGrid.appendChild(sentinel);

    initCollectionObserver(cardGrid, async () => {
        await loadMoreCollectionItems();
    });

    await loadMoreCollectionItems();
};

const loadMoreCollectionItems = async () => {
    const cardGrid = document.getElementById('card-grid');
    if (!cardGrid) return;

    const alreadyRendered = cardGrid.querySelectorAll('.card-item').length;
    const nextSlice = collectionIds.slice(alreadyRendered, alreadyRendered + COLLECTION_BATCH_SIZE);

    if (nextSlice.length === 0) {
        return;
    }

    for (const cardId of nextSlice) {
        const el = await createCardElement(cardId);
        const sentinel = ensureSentinel();
        if (!cardGrid.contains(sentinel)) {
            cardGrid.appendChild(sentinel);
        }
        cardGrid.insertBefore(el, sentinel);
    }

    if (collectionObserver && collectionSentinel) {
        collectionObserver.unobserve(collectionSentinel);
        collectionObserver.observe(collectionSentinel);
    }
};

// --- Venta de cartas ---
const performSale = async (cardId) => {
    const cardData = await fetchCardData(cardId);
    if (!cardData) return;

    gameState.stars += cardData.valor || 0;
    if (gameState.collection[cardId]) gameState.collection[cardId]--;

    if (gameState.collection[cardId] === 0) {
        delete gameState.collection[cardId];
    }

    await calculateTotalCardsInGame();
    updateUI();

    const node = document.getElementById(`card-item-${cardId}`);
    if (node) {
        const newCount = gameState.collection[cardId] || 0;
        const repeatEl = node.querySelector('.repeat-count');
        if (newCount > 1) {
            if (repeatEl) {
                repeatEl.textContent = `x${newCount}`;
            } else {
                const span = document.createElement('span');
                span.className = 'repeat-count';
                span.textContent = `x${newCount}`;
                node.appendChild(span);
            }
        } else {
            if (repeatEl) repeatEl.remove();
            if (newCount === 0) {
                node.remove();
            }
        }
    }

    saveGame();
};

const sellCard = async (cardId) => {
    if (gameState.collection[cardId] && gameState.collection[cardId] > 0) {
        if (gameState.collection[cardId] === 1) {
            const cardData = await fetchCardData(cardId);
            showConfirmModal(`¿Estás seguro de que deseas vender la única carta de ${cardData.name}?`, () => {
                performSale(cardId);
            });
        } else {
            performSale(cardId);
        }
    } else {
        alert('No tienes esta carta para vender.');
    }
};

// --- Confirm Modal ---
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

const showConfirmModal = (message, onConfirm) => {
    confirmMessage.textContent = message;
    confirmModal.classList.add('show');

    confirmYesBtn.addEventListener('click', () => {
        onConfirm();
        hideConfirmModal();
    }, { once: true });

    confirmNoBtn.addEventListener('click', () => {
        hideConfirmModal();
    }, { once: true });
};

const hideConfirmModal = () => {
    confirmModal.classList.remove('show');
};

// --- Packs: Preview, Comprar, Abrir ---
const previewPackModal = document.getElementById('preview-pack-modal');
const previewPackCardGrid = document.getElementById('preview-pack-card-grid');
const previewBuyBtn = document.getElementById('preview-buy-btn');
const previewCancelBtn = document.getElementById('preview-cancel-btn');
const quantityDecreaseBtn = document.getElementById('quantity-decrease');
const quantityIncreaseBtn = document.getElementById('quantity-increase');
const previewPackQuantityEl = document.getElementById('preview-pack-quantity');
const previewPackProgress = document.getElementById('preview-pack-progress');

let currentPreviewPack = null;
let currentPreviewCost = 0;
let currentQuantity = 1;

const updateBuyButtonState = () => {
    const totalCost = currentPreviewCost * currentQuantity;
    previewBuyBtn.disabled = gameState.stars < totalCost;
};

const previewPack = async (packName, cost) => {
    currentPreviewPack = packName;
    currentPreviewCost = cost;
    currentQuantity = 1;
    previewPackQuantityEl.textContent = currentQuantity;

    const packData = await fetchPackData(packName);
    previewPackCardGrid.innerHTML = '';

    let ownedInThisPack = 0;
    let totalInPack = 0;
    if (packData && Array.isArray(packData.card_list)) {
        totalInPack = packData.card_list.length;
        for (const cardEntry of packData.card_list) {
            const cid = cardEntry.card_id;
            if (gameState.collection[cid]) ownedInThisPack++;
        }
    }
    const percent = totalInPack > 0 ? ((ownedInThisPack / totalInPack) * 100).toFixed(1) : 0;
    previewPackProgress.textContent = `Tienes ${ownedInThisPack}/${totalInPack} cartas de este paquete (${percent}%)`;

    if (packData && packData.card_list) {
        for (const cardEntry of packData.card_list) {
            const cardId = cardEntry.card_id;
            const cardData = await fetchCardData(cardId);
            if (!cardData) continue;

            const owned = !!gameState.collection[cardId];
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.innerHTML = `
                <img src="data/cards/images/${cardId}.jpg" alt="${cardData.name}" loading="lazy">
                <span class="card-drop-rate">${(cardEntry.probability * 100).toFixed(2)}%</span>
                <span class="card-status ${owned ? 'owned' : 'missing'}">${owned ? '✔' : '✘'}</span>
            `;
            previewPackCardGrid.appendChild(cardItem);
        }
    }

    updateBuyButtonState();
    previewPackModal.classList.add('show');
};

quantityDecreaseBtn.addEventListener('click', () => {
    if (currentQuantity > 1) {
        currentQuantity--;
        previewPackQuantityEl.textContent = currentQuantity;
        updateBuyButtonState();
    }
});

quantityIncreaseBtn.addEventListener('click', () => {
    currentQuantity++;
    previewPackQuantityEl.textContent = currentQuantity;
    updateBuyButtonState();
});

previewCancelBtn.addEventListener('click', () => {
    previewPackModal.classList.remove('show');
});

previewBuyBtn.addEventListener('click', async () => {
    previewPackModal.classList.remove('show');
    await buyPack(currentPreviewPack, currentPreviewCost, currentQuantity);
});

const buyPack = async (packName, cost, quantity = 1) => {
    const totalCost = cost * quantity;
    if (gameState.stars >= totalCost) {
        gameState.stars -= totalCost;
        const packData = await fetchPackData(packName);
        if (packData) {
            const allCardsObtained = {};
            for (let i = 0; i < quantity; i++) {
                const cardsObtained = openPack(packData, false);
                for (const cardId in cardsObtained) {
                    allCardsObtained[cardId] = (allCardsObtained[cardId] || 0) + cardsObtained[cardId];
                }
            }
            await calculateTotalCardsInGame();
            updateUI();
            showOpenPackModal(allCardsObtained, quantity, totalCost);
            renderCollection(); // refresca colección
        }
        saveGame();
    } else {
        alert('No tienes suficientes estrellas para comprar esta cantidad de paquetes.');
    }
};

const openPack = (packData, showModal = true) => {
    const cardsObtained = {};
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
            cardsObtained[selectedCard] = (cardsObtained[selectedCard] || 0) + 1;
            gameState.collection[selectedCard] = (gameState.collection[selectedCard] || 0) + 1;
        }
    }
    if (showModal) {
        showOpenPackModal(cardsObtained, 1, packData.cost || 0);
    }
    return cardsObtained;
};

const openPackModal = document.getElementById('open-pack-modal');
const openPackTitle = document.getElementById('open-pack-title');
const openPackCardGrid = document.getElementById('open-pack-card-grid');
const openPackOkBtn = document.getElementById('open-pack-ok-btn');

const showOpenPackModal = async (cardsObtained, quantity, totalCost) => {
    openPackCardGrid.innerHTML = '';
    openPackTitle.textContent = quantity > 1
        ? `¡Has abierto ${quantity} paquetes por ${totalCost} ⭐!`
        : `¡Has abierto un paquete por ${totalCost} ⭐!`;

    for (const cardId in cardsObtained) {
        const cardData = await fetchCardData(cardId);
        if (cardData) {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            const cardCount = cardsObtained[cardId];
            const isRepeated = cardCount > 1;

            cardItem.innerHTML = `
                <img src="data/cards/images/${cardId}.jpg" alt="Carta ${cardData.name}" loading="lazy">
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

// --- Reset ---
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
    if (document.getElementById('collection-view').style.display !== 'none') {
        renderCollection();
    }
};

// --- Eventos ---
document.getElementById('show-collection-btn').addEventListener('click', () => switchView('collection'));
document.getElementById('show-shop-btn').addEventListener('click', () => switchView('shop'));

document.getElementById('add-stars-btn').addEventListener('click', addStars);
document.getElementById('reset-game-btn').addEventListener('click', resetGame);
openPackOkBtn.addEventListener('click', hideOpenPackModal);

document.addEventListener('DOMContentLoaded', async () => {
    loadGame();
    await calculateTotalCardsInGame();
    updateUI();
    switchView('collection');
});
