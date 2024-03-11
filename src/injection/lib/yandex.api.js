export function getIndexedDB() {
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

export async function getUserId() {
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

export function _buildHeaders(userId) {
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('X-Yataxi-Userid', userId);

  // Используем csrfToken из localStorage, полученный ранее
  const csrfToken = JSON.parse(localStorage.getItem('taxi_csrf_token'));
  headers.append('X-Csrf-Token', csrfToken.token);
  // headers.append("X-Request-Id", "558721f9-5111-4d7f-a03d-b15dca93386b");
  headers.append('Origin', 'https://taxi.yandex.ru');
  headers.append('Referer', 'https://taxi.yandex.ru');
  return headers;
}

export async function finalSuggest(point) {
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

export async function determineAddress(name) {
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

export async function commitOrder(orderId) {
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

export function getPinAddress() {
  const YMaps = document.querySelectorAll('ymaps')[0];
  const storeKey = Object.keys(YMaps).find(k => k.startsWith('__reactInternalInstance'));
  return YMaps[storeKey]['return'].memoizedProps.location.center;
}