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

import { strFromU8, strToU8, unzip, zipSync } from 'fflate';
import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';

const PACKAGE_LIMIT = 64 * 1024 * 1024;
const DESCRIPTION_LIMIT = 64 * 1024;
const DESCRIPTION_FILE = 'model.json';
const DATABASE = 'aibox-algorithm-packages';
const STORE = 'packages';

export const g_cloudModels = [
    { id: 'cloud-person', name: '人员检测增强版', kind: 'person', target: 'rk3588', version: '2.1.0', demo: true,
        labels: ['person'], description: '识别画面中的人员，提供置信度和 NMS IoU 参数。' },
    { id: 'cloud-safety', name: '安全帽检测', kind: 'yolo26n', target: 'rk3588', version: '1.3.0', demo: true,
        labels: ['person', 'hat'], description: '识别画面中的人员和安全帽，提供置信度参数。' }
];

function OpenDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('无法打开浏览器模型存储'));
    });
}

async function ModelTransaction(id, blob) {
    const database = await OpenDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE, blob ? 'readwrite' : 'readonly');
            const request = blob ? transaction.objectStore(STORE).put(blob, id) : transaction.objectStore(STORE).get(id);
            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(new Error('浏览器无法保存或读取算法模型包'));
        });
    } finally {
        database.close();
    }
}

/** @brief 保留原始 ZIP 以支持刷新后导出。 */
export async function StoreModelPackage(id, blob) {
    await ModelTransaction(id, blob);
}

/** @brief 获取持久化的原始模型包。 */
export function LoadModelPackage(id) {
    return ModelTransaction(id);
}

function ReadArchive(bytes) {
    return new Promise((resolve, reject) => {
        const names = new Set();
        let total = 0;
        unzip(bytes, {
            filter: entry => {
                total += entry.originalSize;
                const name = entry.name;
                if (names.size === 2 || names.has(name) || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(name) || name.includes('..') ||
                    total > PACKAGE_LIMIT || (name === DESCRIPTION_FILE && entry.originalSize > DESCRIPTION_LIMIT)) {
                    throw new Error('ZIP 应仅包含根目录下的 model.json 和一个算法模型文件');
                }
                names.add(name);
                return true;
            }
        }, (error, entries) => {
            if (error) {
                reject(new Error('ZIP 损坏或压缩格式不受支持'));
            } else {
                resolve(entries);
            }
        });
    });
}

function ReadDescription(entries) {
    try {
        return JSON.parse(strFromU8(entries[DESCRIPTION_FILE]));
    } catch {
        throw new Error('缺少有效的 model.json 描述文件');
    }
}

/** @brief 检查 ZIP 结构、目标平台与算法文件校验值，并生成资产信息。 */
export async function ParseModelPackage(blob, origin) {
    if (!blob?.size || blob.size < 22 || blob.size > PACKAGE_LIMIT) {
        throw new Error('请选择不大于 64 MiB 的有效算法模型 ZIP');
    }
    const entries = await ReadArchive(new Uint8Array(await blob.arrayBuffer()));
    const item = ReadDescription(entries);
    const file = item?.file;
    const binary = typeof file === 'string' && file !== DESCRIPTION_FILE && Object.hasOwn(entries, file) ? entries[file] : null;
    if (Object.keys(entries).length !== 2 || !binary?.length || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 ||
        typeof item.version !== 'string' || !/^[a-z0-9.-]{1,32}$/i.test(item.version) || !['person', 'yolo26n'].includes(item.kind)) {
        throw new Error('model.json 须包含有效的 name、version、kind、target 和 file');
    }
    if (item.target !== 'rk3588') {
        throw new Error('算法模型与当前设备平台 RK3588 不兼容');
    }
    const hash = bytesToHex(sha256(binary));
    if (item.sha256 && (typeof item.sha256 !== 'string' || item.sha256.toLowerCase() !== hash)) {
        throw new Error('算法模型文件校验值不匹配');
    }
    return {
        id: `${item.kind}-${hash.slice(0, 24)}`, name: item.name.trim(), version: item.version, kind: item.kind, target: item.target, file,
        description: typeof item.description === 'string' ? item.description.slice(0, 1000) : '', labels: item.kind === 'person' ? ['person'] : ['person', 'hat'],
        sha256: hash, origin, size: blob.size, status: '可用', demo: item.demo === true
    };
}

/** @brief 生成云目录和内置资产的模拟算法模型 ZIP。 */
export function MakeDemoModelPackage(item) {
    const version = item.version || '1.0.0';
    const file = 'model.bin';
    const binary = strToU8(`AIBox demo ${item.id} ${version}`);
    const description = { name: item.name, version, kind: item.kind, target: item.target, file, description: item.description,
        sha256: bytesToHex(sha256(binary)), demo: true };
    return new Blob([zipSync({ [DESCRIPTION_FILE]: strToU8(JSON.stringify(description, null, 2)), [file]: binary })], { type: 'application/zip' });
}
