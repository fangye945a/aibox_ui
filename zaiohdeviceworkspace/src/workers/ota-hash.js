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

import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';

// 独立线程增量读取固件，最多保留一个8MiB缓冲，不依赖HTTP页面的WebCrypto权限。
self.onmessage = async ({data: file}) => {
    try {
        const hash = sha256.create();
        for (let offset = 0; offset < file.size; offset += 8 * 1024 * 1024) {
            hash.update(new Uint8Array(await file.slice(offset, offset + 8 * 1024 * 1024).arrayBuffer()));
            self.postMessage({progress: Math.min(file.size, offset + 8 * 1024 * 1024)});
        }
        self.postMessage({digest: bytesToHex(hash.digest())});
    } catch (error) {
        self.postMessage({error: error.message || '文件摘要计算失败'});
    }
};
