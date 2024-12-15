import './styles.css';
import * as yandex from './lib/yandex.api.js';
import State from './store/index.js';

export const state = new State();

// Список такси тарифов
const TAXI_CLASSES = [
    'intercity',
    'econom',
    'business',
    'comfortplus',
    'vip',
    'ultimate',
    'maybach',
    'child_tariff',
    'minivan',
    'premium_van',
    'hh_with_ramp',
    'personal_driver',
    'combo',
];

const TIMERS_UPDATE_INTERVAL = 1000;
const COST_UPDATE_INTERVAL = 2000;
const TIMER_DURATION = 10 * 60 * 1000; // 10 минут

function filterTaxiServices(serviceLevels) {
    return serviceLevels.filter(service => TAXI_CLASSES.includes(service.class));
}

function aggregateUniquePrices(serviceLevels) {
    for (const service of serviceLevels) {
        const { name: level, max_price_as_decimal: price, offer } = service;
        const timerKey = `${level}-${price}`;

        if (!state.uniquePricesByLevel[level]) {
            state.uniquePricesByLevel[level] = new Set();
        }
        state.uniquePricesByLevel[level].add(price);

        if (!state.offers[level]) {
            state.offers[level] = {};
        }
        if (!state.offers[level][price]) {
            state.offers[level][price] = offer;
        }

        if (!state.timerState.has(timerKey)) {
            const endTime = Date.now() + TIMER_DURATION;
            state.timerState.set(timerKey, { endTime });
        }
    }
}

function updateAllTimers() {
    const now = Date.now();
    state.timerState.forEach((timer, key) => {
        const remaining = timer.endTime - now;
        const timerDisplay = document.getElementById(key);

        if (remaining <= 0) {
            state.timerState.delete(key);
            const [expiredLevel, expiredPrice] = key.split('-');
            if (state.uniquePricesByLevel[expiredLevel]) {
                state.uniquePricesByLevel[expiredLevel].delete(expiredPrice);
                if (state.offers[expiredLevel] && state.offers[expiredLevel][expiredPrice]) {
                    delete state.offers[expiredLevel][expiredPrice];
                }
            }

            const priceContainer = document.querySelector(`.price-container[data-level="${expiredLevel}"][data-price="${expiredPrice}"]`);
            if (priceContainer) {
                priceContainer.remove();
            }

            return;
        }

        if (timerDisplay) {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            timerDisplay.textContent = `Осталось ${minutes}:${seconds < 10 ? '0' : ''}${seconds} мин.`;
        }
    });
}

function createAndShowPopup(serviceLevels, advanceWaitingTime) {
    const taxiServiceLevels = filterTaxiServices(serviceLevels);
    let popup = document.getElementById('service-levels-popup');

    if (!popup) {
        popup = createPopupElement();
        document.body.appendChild(popup);
    }

    aggregateUniquePrices(taxiServiceLevels);

    if (!state.waitingTimesByLevel) state.waitingTimesByLevel = {};
    for (const service of taxiServiceLevels) {
        const level = service.name;
        state.waitingTimesByLevel[level] = service.estimated_waiting?.message || `~${advanceWaitingTime}`;
    }

    updatePopupContent(popup, state.uniquePricesByLevel);
    makePopupDraggable();
}

function createPopupElement() {
    const popup = document.createElement('div');
    popup.id = 'service-levels-popup';

    const title = document.createElement('h2');
    title.textContent = 'Yandex GO Price Manager';
    title.className = 'draggable-header';
    popup.appendChild(title);

    const minimizeButton = document.createElement('button');
    minimizeButton.textContent = '—';
    minimizeButton.className = 'minimize-button';
    minimizeButton.onclick = () => {
        popup.style.display = 'none';
        showMinimizedButton();
    };
    popup.appendChild(minimizeButton);

    return popup;
}

function showMinimizedButton() {
    let minimizedButton = document.getElementById('minimized-popup-button');

    if (!minimizedButton) {
        minimizedButton = document.createElement('button');
        minimizedButton.id = 'minimized-popup-button';
        minimizedButton.textContent = 'Менеджер цен';
        minimizedButton.className = 'minimized-button';
        minimizedButton.onclick = () => {
            const popup = document.getElementById('service-levels-popup');
            if (popup) {
                popup.style.display = 'flex';
            }
            minimizedButton.style.display = 'none';
        };
        document.body.appendChild(minimizedButton);
    }

    minimizedButton.style.display = 'block';
}

function updatePopupContent(popup, uniquePricesByLevel) {
    let contentArea = popup.querySelector('.content-area');
    if (!contentArea) {
        contentArea = document.createElement('div');
        contentArea.className = 'content-area';
        popup.appendChild(contentArea);
    }

    if (state.routeChanged) {
        contentArea.innerHTML = '';
        state.resetState();
        state.routeChanged = false;
        return;
    }

    for (const [level, pricesSet] of Object.entries(uniquePricesByLevel)) {
        const prices = Array.from(pricesSet).sort((a, b) => +a - +b);
        if (prices.length === 0) continue;
        const profit = prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0;
        updateLevelContainer(contentArea, level, prices, profit);
    }
}

function updateLevelContainer(contentArea, level, prices, profit) {
    let levelContainer = contentArea.querySelector(`.level-container[data-level="${level}"]`);

    const waitingMessage = state.waitingTimesByLevel && state.waitingTimesByLevel[level] ? state.waitingTimesByLevel[level] : '';

    const extras = [];
    if (profit > 0) {
        extras.push(`Выгода +${profit} руб.`);
    }
    if (waitingMessage) {
        extras.push(waitingMessage);
    }

    const extrasText = extras.length > 0 ? ` (${extras.join(', ')})` : '';

    if (!levelContainer) {
        levelContainer = document.createElement('div');
        levelContainer.className = 'level-container';
        levelContainer.setAttribute('data-level', level);
        contentArea.appendChild(levelContainer);

        const levelTitle = document.createElement('button');
        levelTitle.className = 'level-title';
        levelTitle.textContent = `${level}${extrasText}`;
        levelContainer.appendChild(levelTitle);

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'details-container';
        detailsContainer.style.display = state.detailsState.get(level) ? 'block' : 'none';

        levelTitle.onclick = () => {
            const isVisible = detailsContainer.style.display === 'block';
            detailsContainer.style.display = isVisible ? 'none' : 'block';
            state.detailsState.set(level, !isVisible);
        };

        levelContainer.appendChild(detailsContainer);
    } else {
        const levelTitle = levelContainer.querySelector('.level-title');
        if (levelTitle) {
            levelTitle.textContent = `${level}${extrasText}`;
        }
    }

    const detailsContainer = levelContainer.querySelector('.details-container');
    updatePriceContainers(detailsContainer, level, prices);
}


function updatePriceContainers(detailsContainer, level, prices) {
    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        if (!price) continue;
        let priceContainer = detailsContainer.querySelector(`.price-container[data-price="${price}"]`);

        if (!priceContainer) {
            priceContainer = document.createElement('div');
            priceContainer.className = 'price-container';
            priceContainer.style.animation = 'fadeInUp 0.5s ease-out';
            priceContainer.setAttribute('data-price', price);
            priceContainer.setAttribute('data-level', level);

            insertPriceContainerInOrder(detailsContainer, priceContainer, price);

            const orderButton = createOrderButton(level, price);
            if (!orderButton) continue;
            priceContainer.appendChild(orderButton);

            const timerDisplay = document.createElement('span');
            timerDisplay.className = 'timer-display';
            timerDisplay.id = `${level}-${price}`;
            priceContainer.appendChild(timerDisplay);
        }
    }

    const allOrderButtons = detailsContainer.querySelectorAll('.order-button');
    allOrderButtons.forEach(btn => btn.classList.remove('lowest-price'));

    if (prices.length > 0) {
        const lowestPrice = prices[0];
        const lowestPriceContainer = detailsContainer.querySelector(`.price-container[data-price="${lowestPrice}"]`);
        if (lowestPriceContainer) {
            const lowestOrderButton = lowestPriceContainer.querySelector('.order-button');
            if (lowestOrderButton) lowestOrderButton.classList.add('lowest-price');
        }
    }
}

function insertPriceContainerInOrder(detailsContainer, priceContainer, price) {
    const existingPrices = Array.from(detailsContainer.querySelectorAll('.price-container'));
    const insertIndex = existingPrices.findIndex(el => +el.getAttribute('data-price') > price);

    if (insertIndex !== -1) detailsContainer.insertBefore(priceContainer, existingPrices[insertIndex]);
    else detailsContainer.appendChild(priceContainer);
}

function createOrderButton(level, price, isLowestPrice = false) {
    const orderButton = document.createElement('button');
    orderButton.className = isLowestPrice ? 'order-button lowest-price' : 'order-button';
    orderButton.textContent = `Заказать за ${price}`;
    orderButton.onclick = async () => {
        alert(`Заказан ${level} с ценой ${price} руб.`);
        const data = {
            class: level,
            price: price,
            offer: state.offers[level][price],
        };
        const isMobile = window.matchMedia('(max-width: 640px)').matches;
        const res = await yandex.createOrderDraft(data, isMobile);
        yandex.commitOrder(res.orderid);
    };
    return orderButton;
}

async function getCost() {
    try {
        const userId = await yandex.getUserId();
        let route = await yandex.processRoute();

        if (!route || route.length < 2) return;
        route = route.map(point => point.point);

        if (JSON.stringify(route) !== JSON.stringify(state.lastRoute)) {
            state.routeChanged = true;
            state.lastRoute = route;
        }

        const body = buildRequestBody(route, userId);
        const headers = yandex.buildHeaders(userId);

        const response = await fetch('https://ya-authproxy.taxi.yandex.ru/3.0/routestats', {
            method: 'POST',
            headers,
            body,
            credentials: 'include',
            redirect: 'follow',
        });

        const result = await response.json();
        createAndShowPopup(result.service_levels, result.time);
    } catch (error) {
        console.error('Ошибка при получении стоимости:', error);
    }
}

function buildRequestBody(route, userId) {
    return JSON.stringify({
        route,
        payment: { type: 'cash', payment_method_id: 'cash' },
        summary_version: 2,
        format_currency: true,
        extended_description: true,
        is_lightweight: false,
        id: userId,
        requirements: { coupon: '' },
        selected_class: '',
        supported_markup: 'tml-0.1',
        supports_paid_options: true,
        tariff_requirements: TAXI_CLASSES.map(tariff => ({
            class: tariff,
            requirements: { coupon: '' },
        })),
    });
}

function makePopupDraggable() {
    const popup = document.getElementById('service-levels-popup');
    if (!popup) return;

    const header = popup.querySelector('h2');
    if (!header) {
        console.error('Draggable element (header) not found.');
        return;
    }

    header.style.cursor = 'move';

    let isDragging = false;
    let startX, startY, origX, origY;

    function onMouseMove(e) {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        popup.style.left = `${origX + deltaX}px`;
        popup.style.top = `${origY + deltaY}px`;
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    header.addEventListener('mousedown', e => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origX = popup.offsetLeft;
        origY = popup.offsetTop;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
}

setInterval(updateAllTimers, TIMERS_UPDATE_INTERVAL);
setInterval(getCost, COST_UPDATE_INTERVAL);
