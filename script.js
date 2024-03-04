const detailsState = new Map();
let uniquePricesByLevel = {}; // Глобальный объект для хранения уникальных цен
const timerState = new Map(); // Хранение состояний таймеров
const offers = {};

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
            const endTime = Date.now() + 10 * 60 * 1000; // 10 минут
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
        closeButton.setAttribute('style', 'margin-top: 20px; padding: 10px; cursor: pointer;');
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
        prices = Array.from(prices).sort((a, b) => a - b); // Сортируем цены
        let levelContainer = contentArea.querySelector(`.level-container[data-level="${level}"]`);
        const profit = prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0;
        let levelTitle;
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
                // Добавьте анимацию непосредственно после создания элемента, но перед его добавлением в DOM
                priceContainer.style.animation = 'fadeInUp 0.3s ease-out';
                priceContainer.setAttribute('data-price',  price ? price : 'Недоступно');
                if (i === 0) {
                    const priceButton = detailsContainer?.firstChild?.firstChild;
                    if (priceButton) priceButton.className = priceButton.className.replace(' lowest-price', '');

                    detailsContainer.insertBefore(priceContainer, detailsContainer.firstChild);
                }
                else detailsContainer.appendChild(priceContainer);

                const orderButton = document.createElement('button');
                orderButton.className = i === 0 ? 'order-button lowest-price' : 'order-button';
                orderButton.textContent = price ? `Заказать за ${price}` : 'Недоступно в вашем районе';
                orderButton.onclick = (e) => {
                    const data = {
                        class: level,
                        price: price,
                        offer: offers[level][price],
                        route: [[
                            37.9438785683,
                            55.8231700986
                        ],
                            [
                                37.795923876560096,
                                55.718891900369215
                            ]],
                    };
                    alert(`Заказан ${level} с ценой ${price} руб.`);
                    createOrderDraft(data).then(res => {
                        commitOrder(res.orderid);
                    })
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

        request.onerror = (_) => {
            // Обработка ошибок при попытке открыть IndexedDB
            reject(request.error);
        };

        request.onsuccess = (_) => {
            // Возвращаем объект базы данных, когда она успешно открыта
            resolve(request.result);
        };
    });
}

async function getUserId() {
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
    headers.append("Content-Type", "application/json");
    headers.append('X-Yataxi-Userid', userId);

    // Используем csrfToken из localStorage, полученный ранее
    const csrfToken = JSON.parse(localStorage.getItem('taxi_csrf_token'));
    headers.append("X-Csrf-Token", csrfToken.token);
    headers.append("X-Request-Id", "558721f9-5111-4d7f-a03d-b15dca93386b");
    headers.append("Origin", "https://taxi.yandex.ru");
    headers.append("Referer", "https://taxi.yandex.ru/");
    return headers;
}


async function getCost() {
    const userId = await getUserId();

    // Используем значения a и b для формирования тела запроса
    const body = JSON.stringify({
        route: [
            [
                37.9436745322557,
                55.8231940498972
            ],
            [
                37.794990707895664,
                55.71887075633581
            ]
        ],
        payment: {type: "cash", payment_method_id: "cash"},
        summary_version: 2,
        format_currency: true,
        extended_description: true,
        is_lightweight: false,
        id: userId,
        requirements: {
            coupon: ""
        },
        selected_class: '',
        supported_markup: "tml-0.1",
        supports_paid_options: true,
        tariff_requirements: [
            {
                "class": "econom",
                "requirements": {
                    "coupon": ""
                }
            }
        ]
        // Остальные параметры оставляем без изменений
    });

    const headers = _buildHeaders(userId);
    // Создаем объект настроек запроса
    const requestOptions = {
        method: "POST",
        headers,
        body,
        credentials: 'include',
        redirect: "follow"
    };

    // Отправляем запрос
    try {
        const response = await fetch("https://ya-authproxy.taxi.yandex.ru/3.0/routestats", requestOptions);
        const result = await response.json();
        createAndShowPopup(result.service_levels);
    } catch (error) {
        console.error('Ошибка при получении стоимости:', error);
    }
}

async function createOrderDraft(data) {
    // Example {
    //     "route": [
    //         {
    //             "short_text": "бульвар Нестерова, 6",
    //             "geopoint": [
    //                 37.9436745322557,
    //                 55.8231940498972
    //             ],
    //             "fullname": "Московская область, Балашиха, микрорайон Авиаторов, бульвар Нестерова, 6",
    //             "type": "address",
    //             "city": "Балашиха",
    //             "uri": "ymapsbm1://geo?data=CgoxNTA0MjIzMzc3EpIB0KDQvtGB0YHQuNGPLCDQnNC-0YHQutC-0LLRgdC60LDRjyDQvtCx0LvQsNGB0YLRjCwg0JHQsNC70LDRiNC40YXQsCwg0LzQuNC60YDQvtGA0LDQudC-0L0g0JDQstC40LDRgtC-0YDQvtCyLCDQsdGD0LvRjNCy0LDRgCDQndC10YHRgtC10YDQvtCy0LAsIDYiCg0mxxdCFWVKX0I,"
    //         }
    //     ],
    // }
    const userId = await getUserId();
    const headers = _buildHeaders(userId);

    const taxiClass = data.class;

    const body = JSON.stringify({
        id: userId,
        offer: data.offer,
        requirements: {coupon: ""},
        parks: [],
        dont_sms: false,
        driverclientchat_enabled: true,
        payment: {
            type: "cash",
            payment_method_id: "cash"
        },
        route: [
            {
                "short_text": "бульвар Нестерова, 6",
                "geopoint": [
                    37.9436745322557,
                    55.8231940498972
                ],
                "fullname": "Московская область, Балашиха, микрорайон Авиаторов, бульвар Нестерова, 6",
                "type": "address",
                "city": "Балашиха",
                "uri": "ymapsbm1://geo?data=CgoxNTA0MjIzMzc3EpIB0KDQvtGB0YHQuNGPLCDQnNC-0YHQutC-0LLRgdC60LDRjyDQvtCx0LvQsNGB0YLRjCwg0JHQsNC70LDRiNC40YXQsCwg0LzQuNC60YDQvtGA0LDQudC-0L0g0JDQstC40LDRgtC-0YDQvtCyLCDQsdGD0LvRjNCy0LDRgCDQndC10YHRgtC10YDQvtCy0LAsIDYiCg0mxxdCFWVKX0I,"
            },
            {
                "short_text": "4-й Вешняковский проезд, 6",
                "geopoint": [
                    37.794990707895664,
                    55.71887075633581
                ],
                "fullname": "Москва, 4-й Вешняковский проезд, 6",
                "type": "address",
                "city": "Москва",
                "uri": "ymapsbm1://geo?data=Cgg1NjY4NjA3MBJJ0KDQvtGB0YHQuNGPLCDQnNC-0YHQutCy0LAsIDQt0Lkg0JLQtdGI0L3Rj9C60L7QstGB0LrQuNC5INC_0YDQvtC10LfQtCwgNiIKDQcvF0IVJuBeQg,,"
            }
        ],
        class: ['econom'],
    })

    const result = await fetch("https://ya-authproxy.taxi.yandex.ru/external/3.0/orderdraft", {
        method: "POST",
        headers,
        body,
        credentials: 'include',
        redirect: "follow"
    });

    return await result.json();
}

async function determineAddress(name) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);

    const YMapsCenterPoint = getPinAddress(); // Выступает в роли региона для поиска
    const res = await fetch(`https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/suggest`, {
        method: "POST",
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
        redirect: "follow"
    });
    return (await res.json()).results[0];
}

async function commitOrder(orderId) {
    const userId = await getUserId();
    const headers = _buildHeaders(userId);
    const res = fetch(`https://ya-authproxy.taxi.yandex.ru/external/3.0/ordercommit`, {
        method: "POST",
        headers,
        body: JSON.stringify({id: userId, orderid: orderId}),
        credentials: 'include',
        redirect: "follow"
    });
    console.log(await res.json())
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

    for (let i = 0; i < path.length; i++) {
        console.log(await determineAddress(path[i])) // TODO
    }
}
// Модифицируем интервальный вызов, чтобы включить getCost
setInterval(() => {
    processRoute()
    // getCost()
}, 2000);

