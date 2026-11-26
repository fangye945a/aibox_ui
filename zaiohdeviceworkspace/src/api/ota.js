/*
 * Copyright (c) 2026 Hunan OpenValley Digital Industry Development Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { demoEnabled, demoFetch } from '@/demo/data';

// OTA接口返回任务对象，独立解析，避免混入本地控制台的code/data响应协议。
export async function otaRequest(path, options = {}) {
    const headers = {Authorization: `Bearer ${localStorage.getItem('loginToken') || ''}`, ...options.headers};
    let body = options.body;
    if (body && !(body instanceof Blob)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
    }
    const target = `/api/ota${path}`;
    const requestOptions = {...options, headers, body, cache: 'no-store'};
    const response = demoEnabled ? await demoFetch(target, requestOptions) : await fetch(target, requestOptions);
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error || data.msg || `请求失败：${response.status}`);
        error.status = response.status;
        if (response.status === 401) {
            localStorage.removeItem('loginToken');
            window.location.assign('/#/login');
        }
        throw error;
    }
    return data;
}
