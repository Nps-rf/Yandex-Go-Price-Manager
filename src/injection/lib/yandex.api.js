import {state} from '../index.js';

/**
 * Открывает IndexedDB и возвращает объект базы данных.
 */
export function getIndexedDB() {
  console.log('[getIndexedDB] Открываем базу данных turboapp-taxi');
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('turboapp-taxi', 1);

    request.onerror = () => {
      console.error('[getIndexedDB] Ошибка при открытии IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[getIndexedDB] База данных открыта успешно');
      resolve(request.result);
    };
  });
}

/**
 * Получает userId из IndexedDB.
 */
export async function getUserId() {
  console.log('[getUserId] Запрос userId из IndexedDB...');
  try {
    const db = await getIndexedDB();
    const transaction = db.transaction('redux-persist', 'readonly');
    const objectStore = transaction.objectStore('redux-persist');

    const result = await new Promise((resolve, reject) => {
      const request = objectStore.get('persist:session');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (result && result.userId) {
      console.log('[getUserId] Получен userId:', result.userId);
      return result.userId;
    } else {
      console.log('[getUserId] userId не найден в базе');
      return null;
    }
  } catch (error) {
    console.error('[getUserId] Ошибка при работе с IndexedDB:', error);
    throw error;
  }
}

/**
 * Строит заголовки для запросов.
 */
export function buildHeaders(userId) {
  console.log('[buildHeaders] Строим заголовки для запросов с userId:', userId);
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('X-Yataxi-Userid', userId);

  const csrfToken = JSON.parse(localStorage.getItem('taxi_csrf_token'));
  if (csrfToken && csrfToken.token) {
    headers.append('X-Csrf-Token', csrfToken.token);
  } else {
    console.warn('[buildHeaders] CSRF токен не найден в localStorage');
  }

  headers.append('Origin', 'https://taxi.yandex.ru');
  headers.append('Referer', 'https://taxi.yandex.ru');
  return headers;
}

/**
 * Отправляет запрос на финальное предложение адреса.
 */
export async function finalSuggest(point) {
  console.log('[finalSuggest] Старт финализации адреса для точки:', point);
  try {
    const userId = await getUserId();
    const headers = buildHeaders(userId);
    const bodyObj = {
      action: 'finalize',
      state: {
        accuracy: 0,
        location: point.position,
        selected_class: 'econom',
      },
      sticky: true,
      type: 'b',
      id: userId,
      position: point.position,
    };
    const body = JSON.stringify(bodyObj);

    console.log('[finalSuggest] Запрос POST /4.0/persuggest/v1/finalsuggest', bodyObj);

    const response = await fetch('https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/finalsuggest', {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      redirect: 'follow',
    });

    const json = await response.json();
    console.log('[finalSuggest] Ответ от сервера:', json);
    return json;
  } catch (error) {
    console.error('[finalSuggest] Ошибка в finalSuggest:', error);
    throw error;
  }
}

/**
 * Функция запроса zerosuggest.
 * Возвращает подсказки на основе текущей позиции.
 */
export async function getZeroSuggest(latitude, longitude) {
  console.log('[getZeroSuggest] Запрос zerosuggest для координат:', {latitude, longitude});
  try {
    const userId = await getUserId();
    const headers = buildHeaders(userId);

    const bodyObj = {
      "type": "b",
      "client_id": "turboapp-taxi",
      "state": {
        "accuracy": 0,
        "location": [longitude, latitude]
      },
      "position": [longitude, latitude]
    };
    const body = JSON.stringify(bodyObj);

    console.log('[getZeroSuggest] Запрос POST /4.0/persuggest/v1/zerosuggest', bodyObj);

    const response = await fetch('https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/zerosuggest', {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      redirect: 'follow',
    });

    const json = await response.json();
    console.log('[getZeroSuggest] Ответ от сервера:', json);
    return json;
  } catch (error) {
    console.error('[getZeroSuggest] Ошибка в getZeroSuggest:', error);
    throw error;
  }
}

/**
 * Определяет адрес по имени.
 */
export async function determineAddress(name, type) {
  console.log('[determineAddress] Определяем адрес по имени:', name, 'тип:', type);
  try {
    const userId = await getUserId();
    const headers = buildHeaders(userId);
    const centerPoint = getPinAddress();

    console.log('[determineAddress] Пин-адрес (центр карты):', centerPoint);

    const bodyObj = {
      action: 'user_input',
      state: {
        accuracy: 0,
        location: centerPoint,
      },
      sticky: false,
      type,
      id: userId,
      part: name,
      position: centerPoint,
    };
    const body = JSON.stringify(bodyObj);

    console.log('[determineAddress] Запрос POST /4.0/persuggest/v1/suggest', bodyObj);

    const response = await fetch('https://ya-authproxy.taxi.yandex.ru/4.0/persuggest/v1/suggest', {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      redirect: 'follow',
    });

    const results = await response.json();
    console.log('[determineAddress] Ответ от suggest:', results);

    if (results && results.results && results.results[0]) {
      console.log('[determineAddress] Получен первый результат, отправляем на финализацию');
      const finalRes = await finalSuggest(results.results[0]);
      console.log('[determineAddress] Результат finalSuggest:', finalRes);
      return finalRes;
    } else {
      console.error('[determineAddress] Нет результатов в suggest');
      return null;
    }
  } catch (error) {
    console.error('[determineAddress] Ошибка в determineAddress:', error);
    throw error;
  }
}

/**
 * Подтверждает заказ.
 */
export async function commitOrder(orderId) {
  console.log('[commitOrder] Подтверждаем заказ с orderId:', orderId);
  try {
    const userId = await getUserId();
    const headers = buildHeaders(userId);

    const bodyObj = { id: userId, orderid: orderId };
    const body = JSON.stringify(bodyObj);

    console.log('[commitOrder] Запрос POST /external/3.0/ordercommit', bodyObj);

    const response = await fetch('https://ya-authproxy.taxi.yandex.ru/external/3.0/ordercommit', {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      redirect: 'follow',
    });

    const result = await response.json();
    console.log('[commitOrder] Ответ от ordercommit:', result);
  } catch (error) {
    console.error('[commitOrder] Ошибка в commitOrder:', error);
  }
}

/**
 * Получает центральную точку карты из ymaps.
 */
export function getPinAddress() {
  console.log('[getPinAddress] Пытаемся получить central point из ymaps...');
  const yMapsElements = document.querySelectorAll('ymaps');
  if (yMapsElements.length === 0) {
    console.warn('[getPinAddress] Элемент ymaps не найден');
    return null;
  }

  const yMaps = yMapsElements[0];
  const storeKey = Object.keys(yMaps).find((k) => k.startsWith('__reactInternalInstance'));
  if (storeKey && yMaps[storeKey]?.return?.memoizedProps?.location?.center) {
    const center = yMaps[storeKey].return.memoizedProps.location.center;
    console.log('[getPinAddress] Найдена точка центра карты:', center);
    return center;
  } else {
    console.warn('[getPinAddress] React internal instance или center не найден');
    return null;
  }
}

// Алиасы классов
const langClassAlias = {
  'Межгород': 'intercity',
  'Эконом': 'econom',
  'Комфорт': 'business',
  'Комфорт+': 'comfortplus',
  'Business': 'vip',
  'Premier': 'ultimate',
  'Élite': 'maybach',
  'Минивэн': 'minivan',
  'Cruise': 'premium_van',
  'Специальный': 'hh_with_ramp',
  'Водитель': 'personal_driver',
  'Вместе': 'combo',
};

/**
 * Обрабатывает маршрут.
 */
export async function processRouteOld() {
  console.log('[processRoute] Начинаем обработку маршрута...');
  try {
    const path = determinePath();
    console.log('[processRoute] Определенный путь из textarea:', path);

    if (!path || path.length < 2) {
      console.error('[processRoute] Недопустимый путь (меньше двух точек или null)');
      return null;
    }

    const result = [];
    for (let i = 0; i < path.length; i++) {
      console.log(`[processRoute] Обрабатываем точку #${i}:`, path[i]);
      const address = await determineAddress(path[i], i === 0 ? 'a' : 'b');
      console.log(`[processRoute] Результат finalSuggest для точки #${i} (${i === 0 ? 'a' : 'b'}):`, address);
      result.push(address);
    }

    return result;
  } catch (error) {
    console.error('[processRoute] Ошибка в processRoute:', error);
    throw error;
  }
}

/**
 * Создает черновик заказа.
 */
export async function createOrderDraft(data) {
  console.log('[createOrderDraft] Создаем черновик заказа для данных:', data);
  try {
    const userId = await getUserId();
    const headers = buildHeaders(userId);

    const taxiClass = data.class;
    const route = await processRouteOld();

    console.log('[createOrderDraft] Обработанный маршрут:', route);

    if (!route || route.length < 2) {
      console.error('[createOrderDraft] Недопустимый маршрут (меньше двух точек)');
      return null;
    }

    const builtRoute = route.map((point) => ({
      short_text: point.results[0].title.text,
      geopoint: point.points[0].geometry,
      fullname: point.results[0].text,
      type: 'address',
      city: point.results[0].city,
      uri: point.results[0].uri,
    }));

    let finedRoute = [];
    console.log(77777777777777, builtRoute)
    const points = state.routeStates[state.currentRoute];
    for (let i = 0; i < builtRoute.length; i++) {
      const point = points[i].point;
      finedRoute.push({
        ...builtRoute[i],
        geopoint: point,
      })
    }

    console.log('[createOrderDraft] Сформированный маршрут для отправки:', finedRoute);

    const bodyObj = {
      id: userId,
      offer: data.offer,
      requirements: { coupon: '' },
      parks: [],
      dont_sms: false,
      driverclientchat_enabled: true,
      payment: {
        type: 'cash',
        payment_method_id: 'cash',
      },
      route: finedRoute,
      class: [langClassAlias[taxiClass] || 'econom'],
    };
    const body = JSON.stringify(bodyObj);

    console.log('[createOrderDraft] Запрос POST /external/3.0/orderdraft', bodyObj);

    const response = await fetch('https://ya-authproxy.taxi.yandex.ru/external/3.0/orderdraft', {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      redirect: 'follow',
    });

    const json = await response.json();
    console.log('[createOrderDraft] Ответ от orderdraft:', json);
    return json;
  } catch (error) {
    console.error('[createOrderDraft] Ошибка в createOrderDraft:', error);
    throw error;
  }
}

/**
 * Пытается извлечь текущий маршрут из структуры React internal instance у элемента <ymaps>.
 * Возвращает массив координат, если удалось, иначе null.
 */
function getCurrentRouteFromYmaps() {
  const yMapsElement = document.querySelector('ymaps');
  if (!yMapsElement) {
    console.warn('[getCurrentRouteFromYmaps] Элемент ymaps не найден');
    return null;
  }

  // Ищем ключ, начинающийся с __reactInternalInstance или __reactFiber (Обычно __reactInternalInstance)
  const storeKey = Object.keys(yMapsElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
  if (!storeKey) {
    console.warn('[getCurrentRouteFromYmaps] Не найден ключ __reactInternalInstance/__reactFiber');
    return null;
  }

  const fiberNode = yMapsElement[storeKey];

  try {
    // Спускаемся по цепочке свойств
    const route = fiberNode
        ?.memoizedProps
        ?.children?.props?.children?.[3]?.[3]?.props?.route;

    if (Array.isArray(route)) {
      console.log('[getCurrentRouteFromYmaps] Извлечен маршрут:', route);
      return route;
    } else {
      console.warn('[getCurrentRouteFromYmaps] Не удалось найти массив route');
      return null;
    }
  } catch (e) {
    console.error('[getCurrentRouteFromYmaps] Ошибка при извлечении route:', e);
    return null;
  }
}

/**
 * Обрабатывает маршрут, теперь координаты берутся из React internal instance, а не из determineAddress.
 */
export async function processRoute() {
  console.log('[processRoute] Начинаем обработку маршрута...');

  try {
    // Получаем маршрут из внутреннего состояния приложения (React fiber)
    const routeData = getCurrentRouteFromYmaps();
    if (!routeData || routeData.length < 2) {
      console.error('[processRoute] Недопустимый маршрут (меньше двух точек или не найден)');
      return null;
    }

    // Формируем уникальный id для маршрута
    const pathCoordinates = routeData.map(item => item.point.join(','));
    const pathId = pathCoordinates.join('-');
    console.log('[processRoute] Определенный маршрут (из ymaps):', pathCoordinates);

    if (state.routeStates[pathId]) {
      console.log('[processRoute] Маршрут уже есть в кэше (state.routeStates)', state.routeStates[pathId]);
      return state.routeStates[pathId];
    }

    // Сохраняем маршрут в состоянии (здесь можно сохранить как есть или адаптировать данные)
    state.routeStates[pathId] = routeData;

    if (pathId !== state.currentRoute) {
      state.routeChanged = true;
      console.log('[processRoute] Маршрут изменился, state.routeChanged = true');
    }

    state.currentRoute = pathId;
    return routeData;
  } catch (error) {
    console.error('[processRoute] Ошибка в processRoute:', error);
    throw error;
  }
}

/**
 * Определяет путь из значений textarea.
 */
export function determinePath() {
  console.log('[determinePath] Ищем текстовые поля для маршрута...');
  if (document.querySelector('.Popup2')) {
    console.log('[determinePath] Найден Popup2 - пропускаем определение пути');
    return null;
  }

  const textareas = Array.from(document.querySelectorAll('textarea.Textarea-Control'));
  console.log('[determinePath] Найдено textarea:', textareas.length);

  if (textareas.length === 0) {
    console.warn('[determinePath] Textarea не найдены');
    return null;
  }

  const values = textareas.map((textarea) => textarea.value).filter((value) => value);
  console.log('[determinePath] Значения из textarea:', values);
  return values.length > 0 ? values : null;
}
