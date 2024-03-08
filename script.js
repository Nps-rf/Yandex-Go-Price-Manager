const detailsState = new Map();
const uniquePricesByLevel = {}; // Глобальный объект для хранения уникальных цен
const timerState = new Map(); // Хранение состояний таймеров
const offers = {};
const routeStates = [];

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
        title.textContent = 'Уровни услуг';
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
                        commitOrder(res.orderid);
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
    const textarea = document.querySelectorAll('textarea.Textarea-Control');

    // Проверяем, найден ли элемент
    if (textarea) {
        // Получаем значение из textarea
        return Array.from(textarea).map(x => x.value).filter(x => x);
    } else {
        console.log('Элемент не найден');
    }
}

// Предполагаем, что a и b - глобальные переменные, определенные выше
// Модификация функции determinePath() не требуется, поскольку она уже определена

function getIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open('turboapp-taxi', 1);

        request.onerror = () => {
            // Обработка ошибок при попытке открыть IndexedDB
            reject(request.error);
        };

        request.onsuccess = () => {
            // Возвращаем объект базы данных, когда она успешно открыта
            resolve(request.result);
        };
    });
}

async function getUserId() {
    // Не бейте если выглядит убого
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const db = await getIndexedDB();
            const transaction = db.transaction(['redux-persist'], 'readonly');
            const objectStore = transaction.objectStore('redux-persist');
            const request = objectStore.get('persist:session');

            request.onsuccess = () => {
                // Проверяем, получен ли результат и имеет ли он свойство userId
                if (request.result && request.result.userId) {
                    resolve(request.result.userId);
                } else {
                    console.log('UserId not found');
                    resolve(null); // Или reject(new Error('UserId not found'));
                }
            };

            request.onerror = () => {
                console.log('Ошибка при попытке получить данные из IndexedDB', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('Ошибка при работе с IndexedDB:', error);
            reject(error);
        }
    });
}

function _buildHeaders(userId) {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-Yataxi-Userid', userId);

    // Используем csrfToken из localStorage, полученный ранее
    const csrfToken = JSON.parse(localStorage.getItem('taxi_csrf_token'));
    headers.append('X-Csrf-Token', csrfToken.token);
    // headers.append("X-Request-Id", "558721f9-5111-4d7f-a03d-b15dca93386b");
    headers.append('Origin', 'https://taxi.yandex.ru');
    headers.append('Referer', 'https://taxi.yandex.ru/');
    return headers;
}


async function getCost() {
    const userId = await getUserId();
    const route = (await processRoute()).map(point => point.position);

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

    const headers = _buildHeaders(userId);
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

async function createOrderDraft(data) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);

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

async function finalSuggest(point) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);
    const body = JSON.stringify({
        action: 'finalize',
        state: {
            accuracy: 0, // Пока неизвестно на что именно влияет
            location: point.position,
            selected_class: 'econom',
        },
        sticky: true,
        type: 'b',
        id: userId,
        position: point.position,
    });

    const res = await fetch(`https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/finalsuggest`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
        redirect: 'follow'
    });

    return (await res.json()).results[0];
}

async function determineAddress(name) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);

    const YMapsCenterPoint = getPinAddress(); // Выступает в роли региона для поиска
    const res = await fetch(`https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/suggest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            action: 'user_input',
            state: {
                accuracy: 0, // Пока неизвестно на что именно влияет
                location: YMapsCenterPoint,
            },
            sticky: false,
            type: 'b',
            id: userId,
            part: name,
            position: YMapsCenterPoint,
        }),
        credentials: 'include',
        redirect: 'follow'
    });
    return await finalSuggest((await res.json()).results[0]);
}

async function commitOrder(orderId) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);
    const res = fetch(`https://ya-authproxy.taxi.yandex.ru/external/3.0/ordercommit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({id: userId, orderid: orderId}),
        credentials: 'include',
        redirect: 'follow'
    });
    console.log(await res.json());
}

function getPinAddress() {
    const YMaps = document.querySelectorAll('ymaps')[0];
    const storeKey = Object.keys(YMaps).find(k => k.startsWith('__reactInternalInstance'));
    return YMaps[storeKey]['return'].memoizedProps.location.center;
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


async function processRoute() {
    const path = determinePath();
    if (path.length < 2) return;
    const pathId = path.reduce((prev, next) => `${prev}-${next}`);
    const stateCheck = routeStates.find(state => state.id === pathId)?.result;
    if (stateCheck) return stateCheck;
    const result = [];

    for (let i = 0; i < path.length; i++) {
        const res = await determineAddress(path[i]);
        result.push(res);
    }

    routeStates.push({
        id: pathId,
        result,
    });
    return result;
}
// Модифицируем интервальный вызов, чтобы включить getCost
setInterval(() => {
    // processRoute()
    // processRoute().then(console.log)
    getCost();
}, 3000);

