import './styles.css';
import * as yandex from './lib/yandex.api.js';

let detailsState = new Map();
let uniquePricesByLevel = {}; // Глобальный объект для хранения уникальных цен
let timerState = new Map(); // Хранение состояний таймеров
let offers = {};
let routeChanged = false;
let currentRoute;
let routeStates = {};

function resetState() {
    detailsState.clear();
    uniquePricesByLevel = {};
    timerState.clear();
    offers = {};
    routeChanged = false;
}

function aggregateUniquePrices(serviceLevels) {
    serviceLevels.forEach(service => {
        const level = service.name;
        const price = service.max_price_as_decimal;
        const timerKey = `${level}-${price}`;

        if (!uniquePricesByLevel[level]) {
            uniquePricesByLevel[level] = new Set();
        }
        uniquePricesByLevel[level].add(price);

        if (uniquePricesByLevel[level].has(price)) {
            offers[level] || (offers[level] = {});
            offers[level][price] || (offers[level][price] = service.offer);
        }

        if (!timerState.has(timerKey)) {
            // Создаем таймер, если он не существует
            const endTime = Date.now() + 10 * 60 * 1000; // 10 минут, т.к. шындекс выдает офферы лишь на 10 минут
            const timer = {endTime, interval: setInterval(() => updateTimer(timerKey), 1000)};
            timerState.set(timerKey, timer);
        }
    });
}

function updateTimer(key) {
    const timer = timerState.get(key);
    if (!timer) return;

    const scheduleUpdate = () => {
        const remaining = timer.endTime - Date.now();
        if (remaining <= 0) {
            clearInterval(timer.interval);
            timerState.delete(key);
            const timerDisplay = document.getElementById(key);
            if (timerDisplay) {
                timerDisplay.textContent = ' Время вышло!';
            }
        } else {
            const minutes = Math.floor(remaining / 60000);
            const seconds = ((remaining % 60000) / 1000).toFixed(0);
            const timerDisplay = document.getElementById(key);
            if (timerDisplay) {
                timerDisplay.textContent = ` Осталось ${minutes}:${seconds < 10 ? '0' : ''}${seconds} мин.`;
            }
            setTimeout(scheduleUpdate, 1000); // Рекурсивный вызов?
        }
    };

    scheduleUpdate(); // Первоначальный вызов
}

function createAndShowPopup(serviceLevels) {
    let popup = document.getElementById('service-levels-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'service-levels-popup';
        document.body.appendChild(popup);

        // В функции createAndShowPopup:
        const title = document.createElement('h2');
        title.textContent = 'Yandex GO Price Manager';
        title.className = 'draggable-header'; // Добавляем класс для возможности перетаскивания
        popup.appendChild(title);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Закрыть';
        closeButton.className = 'close-button';
        closeButton.onclick = () => popup.style.display = 'none';
        popup.appendChild(closeButton);
    }

    // Обновляем данные об уникальных ценах
    aggregateUniquePrices(serviceLevels);
    updatePopupContent(popup, uniquePricesByLevel);
    makePopupDraggable();
}

function updatePopupContent(popup, uniquePricesByLevel) {
    let contentArea = popup.querySelector('.content-area');
    if (!contentArea) {
        contentArea = document.createElement('div');
        contentArea.className = 'content-area';
        popup.appendChild(contentArea);
    }

    if (routeChanged) { // При изменении адреса, аннулируем все офферы кек
        contentArea.innerHTML = '';
        resetState();
        return getCost();
    }

    Object.entries(uniquePricesByLevel).forEach(([level, prices]) => {
        prices = Array.from(prices).sort((a, b) => +a - +b); // Сортируем цены
        let levelContainer = contentArea.querySelector(`.level-container[data-level="${level}"]`);
        const profit = prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0;
        let levelTitle;
        const pricesAvailable = prices.some(price => price);
        if (!pricesAvailable) return;
        if (!levelContainer) {
            levelContainer = document.createElement('div');
            levelContainer.className = 'level-container';
            levelContainer.setAttribute('data-level', level);
            contentArea.appendChild(levelContainer);

            levelTitle = document.createElement('button');
            levelTitle.className = 'level-title';
            levelContainer.appendChild(levelTitle);

            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'details-container';
            detailsContainer.style.display = detailsState.get(level) ? 'block' : 'none';
            levelTitle.onclick = () => {
                const isVisible = detailsContainer.style.display === 'block';
                detailsContainer.style.display = isVisible ? 'none' : 'block';
                detailsState.set(level, !isVisible);
            };
            levelContainer.appendChild(detailsContainer);
        }

        const detailsContainer = levelContainer.querySelector('.details-container');
        levelTitle = levelTitle || levelContainer.querySelector('.level-title');
        levelTitle.textContent = level + (profit ? ` (Выгода +${profit} руб.)` : '');
        for (let i = 0; i < prices.length; i++) {
            const price = prices[i];
            let priceContainer = detailsContainer.querySelector(`.price-container[data-price="${price}"]`);
            if (!priceContainer) {
                priceContainer = document.createElement('div');
                priceContainer.className = 'price-container';
                priceContainer.style.animation = 'fadeInUp 0.3s ease-out';
                priceContainer.setAttribute('data-price', price ? price : 'Недоступно');

                // Находим правильное место для вставки нового элемента
                let insertBeforeElement = { ind: null, el: null };
                const allPrices = detailsContainer.querySelectorAll('.price-container');
                for (let j = 0; j < allPrices.length; j++) {
                    const currentElementPrice = +allPrices[j].getAttribute('data-price');
                    if (price < currentElementPrice) {
                        insertBeforeElement = { ind: i, el: allPrices[j] };
                        break;
                    }
                }

                if (insertBeforeElement.el) {
                    if (insertBeforeElement.el.isSameNode(detailsContainer.firstChild)) {
                        // Убираем у последней наименьшей цены подсветку
                        detailsContainer.firstChild.firstChild.className = 'order-button';
                    }
                    detailsContainer.insertBefore(priceContainer, insertBeforeElement.el);
                } else {
                    detailsContainer.appendChild(priceContainer);
                }

                const orderButton = document.createElement('button');
                orderButton.className = !allPrices.length || insertBeforeElement.ind === 0 ? 'order-button lowest-price' : 'order-button';
                orderButton.textContent = price ? `Заказать за ${price}` : 'Недоступно в вашем районе';
                orderButton.onclick = () => {
                    const data = {
                        class: level,
                        price: price,
                        offer: offers[level][price],
                    };
                    console.log(level, price, offers);
                    alert(`Заказан ${level} с ценой ${price} руб.`);
                    createOrderDraft(data).then(res => {
                        yandex.commitOrder(res.orderid);
                    });
                };

                priceContainer.appendChild(orderButton);

                const timerDisplay = document.createElement('span');
                timerDisplay.className = 'timer-display';
                priceContainer.appendChild(timerDisplay);
            }

            // Обновляем отображение таймера, используя существующий элемент, если он есть
            const timerKey = `${level}-${price}`;
            const timerDisplay = priceContainer.querySelector('.timer-display');
            if (timerDisplay) {
                timerDisplay.id = timerKey; // Убедитесь, что ID обновлен, если он используется для поиска
                updateTimer(timerKey); // Обновляем таймер без пересоздания элемента
            }
        }
    });
}


function determinePath() {
    if (document.querySelector('.Popup2')) return; // это popup отвечающий за выбор точки
    const textarea = Array.from(document.querySelectorAll('textarea.Textarea-Control'));
    // Проверяем, найден ли элемент
    if (textarea) {
        // Получаем значение из textarea
        return textarea.map(x => x.value).filter(x => x);
    } else {
        console.log('Path not found');
    }
}

// Предполагаем, что a и b - глобальные переменные, определенные выше
// Модификация функции determinePath() не требуется, поскольку она уже определена

async function getCost() {
    const userId = await yandex.getUserId();
    let route = await processRoute();
    if (!route) return;
    route = route.map(point => point.position);

    if (route.length < 2) return;

    // Используем значения a и b для формирования тела запроса
    const body = JSON.stringify({
        route,
        payment: {type: 'cash', payment_method_id: 'cash'},
        summary_version: 2,
        format_currency: true,
        extended_description: true,
        is_lightweight: false,
        id: userId,
        requirements: {
            coupon: ''
        },
        selected_class: '',
        supported_markup: 'tml-0.1',
        supports_paid_options: true,
        tariff_requirements: [
            {
                'class': 'econom',
                'requirements': {
                    'coupon': ''
                }
            },
            {
                'class': 'business',
                'requirements': {
                    'coupon': ''
                }
            },
            {
                'class': 'comfortplus',
                'requirements': {
                    'coupon': ''
                }
            },
            {
                'class': 'vip',
                'requirements': {
                    'coupon': ''
                }
            },
            {
                'class': 'child_tariff',
                'requirements': {
                    'coupon': ''
                }
            },
            {
                'class': 'minivan',
                'requirements': {
                    'coupon': ''
                }
            }
        ]
        // Остальные параметры оставляем без изменений
    });

    const headers = yandex._buildHeaders(userId);
    // Создаем объект настроек запроса
    const requestOptions = {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
        redirect: 'follow'
    };

    // Отправляем запрос
    try {
        const response = await fetch('https://ya-authproxy.taxi.yandex.ru/3.0/routestats', requestOptions);
        const result = await response.json();
        createAndShowPopup(result.service_levels);
    } catch (error) {
        console.error('Ошибка при получении стоимости:', error);
    }
}

function makePopupDraggable() {
    const popup = document.getElementById('service-levels-popup');
    if (!popup) return; // Если попап не найден, выходим из функции

    let isDragging = false;
    let startX, startY; // Координаты курсора в момент начала перетаскивания
    let origX, origY; // Начальные координаты попапа

    const onMouseMove = function(e) {
        if (!isDragging) return;

        // Вычисляем новые координаты попапа на основе разницы между текущим положением курсора и начальным
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Обновляем позицию попапа, прибавляя смещение к оригинальной позиции
        popup.style.left = `${origX + deltaX}px`;
        popup.style.top = `${origY + deltaY}px`;
    };

    const onMouseUp = function() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    const header = popup.querySelector('h2'); // Используем заголовок h2 как часть, за которую можно перетаскивать
    if (!header) {
        console.error('Draggable element not found.');
        return;
    }

    header.style.cursor = 'move'; // Меняем курсор для индикации возможности перетаскивания

    header.addEventListener('mousedown', function(e) {
        isDragging = true;

        // Запоминаем начальное положение курсора
        startX = e.clientX;
        startY = e.clientY;

        // Сохраняем начальные координаты попапа
        origX = popup.offsetLeft;
        origY = popup.offsetTop;

        // Добавляем обработчики событий перемещения и отпускания мыши
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Предотвращаем стандартное перетаскивание и выделение текста
        e.preventDefault();
    });
}

// noinspection JSNonASCIINames
const langClassAlias = {
    'Эконом': 'econom',
    'Комфорт': 'business',
    'Комфорт+': 'comfortplus',
    'Business': 'vip',
    'Premier': 'ultimate',
    'Élite': 'maybach',
    'Минивэн': 'minivan',
};

export async function createOrderDraft(data) {
    const userId = await yandex.getUserId();
    const headers = yandex._buildHeaders(userId);

    const taxiClass = data.class;

    const route = await processRoute();

    if (route.length < 2) return;

    const buildedRoute = route.map(point => {
        return {
            'short_text': point.title.text,
            'geopoint': point.position,
            'fullname': point.text,
            'type': 'address',
            'city': point.city,
            'uri': point.uri
        };
    });

    const body = JSON.stringify({
        id: userId,
        offer: data.offer,
        requirements: {coupon: ''},
        parks: [],
        dont_sms: false,
        driverclientchat_enabled: true,
        payment: {
            type: 'cash',
            payment_method_id: 'cash'
        },
        route: buildedRoute,
        class: [langClassAlias[taxiClass] || 'econom'],
    });

    const result = await fetch('https://ya-authproxy.taxi.yandex.ru/external/3.0/orderdraft', {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
        redirect: 'follow'
    });

    return await result.json();
}

async function processRoute() {
    const path = determinePath();
    if (!path || path?.length < 2) return;
    const pathId = path.reduce((prev, next) => `${prev}-${next}`);
    const stateCheck = routeStates[pathId];
    if (stateCheck) return stateCheck;
    const result = [];

    for (let i = 0; i < path.length; i++) {
        const res = await yandex.determineAddress(path[i]);
        result.push(res);
    }

    routeStates[pathId] = result;
    if (pathId !== currentRoute) routeChanged = true;
    currentRoute = pathId;
    return result;
}

// Модифицируем интервальный вызов, чтобы включить getCost
setInterval(() => {
    getCost();
}, 1000);