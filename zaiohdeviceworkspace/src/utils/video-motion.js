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

export const SAMPLE_WIDTH = 96;
export const SAMPLE_HEIGHT = 54;

/** @brief 对比相邻采样帧，返回变化区域及其占画面的百分比。 */
export function CompareFrames(previous, current, sensitivity) {
    const cutoff = 96 - sensitivity * 0.8;
    let left = SAMPLE_WIDTH;
    let top = SAMPLE_HEIGHT;
    let right = -1;
    let bottom = -1;
    let count = 0;
    for (let row = 0; row < SAMPLE_HEIGHT; row++) {
        for (let column = 0; column < SAMPLE_WIDTH; column++) {
            const offset = (row * SAMPLE_WIDTH + column) * 4;
            const red = Math.abs(previous[offset] - current[offset]);
            const green = Math.abs(previous[offset + 1] - current[offset + 1]);
            const blue = Math.abs(previous[offset + 2] - current[offset + 2]);
            if (Math.max(red, green, blue) < cutoff) {
                continue;
            }
            count++;
            left = Math.min(left, column);
            top = Math.min(top, row);
            right = Math.max(right, column);
            bottom = Math.max(bottom, row);
        }
    }
    if (!count) {
        return null;
    }
    return {
        x: left / SAMPLE_WIDTH,
        y: top / SAMPLE_HEIGHT,
        width: (right - left + 1) / SAMPLE_WIDTH,
        height: (bottom - top + 1) / SAMPLE_HEIGHT,
        percent: count * 100 / (SAMPLE_WIDTH * SAMPLE_HEIGHT)
    };
}

/** @brief 绘制带有间歇移动目标的示例画面。 */
export function DrawSample(context, width, height, elapsed) {
    const cycle = elapsed % 7600;
    const travel = Math.min(1, cycle / 4200);
    const boxX = width * (0.12 + 0.61 * travel);
    const boxY = height * 0.47;
    context.fillStyle = '#26323b';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#39464f';
    context.fillRect(0, height * 0.43, width, height * 0.35);
    context.strokeStyle = '#64727d';
    context.lineWidth = 1;
    for (let index = 0; index <= 16; index++) {
        context.beginPath();
        context.moveTo(index * width / 16, height * 0.44);
        context.lineTo(index * width / 16, height * 0.77);
        context.stroke();
    }
    context.fillStyle = '#e3ac50';
    context.fillRect(0, height * 0.41, width, height * 0.02);
    context.fillRect(0, height * 0.78, width, height * 0.02);
    context.fillStyle = '#e5b778';
    context.fillRect(boxX, boxY, width * 0.15, height * 0.26);
    context.fillStyle = '#996a37';
    context.fillRect(boxX + width * 0.07, boxY, width * 0.02, height * 0.26);
    context.fillStyle = '#f5f2e9';
    context.fillRect(boxX + width * 0.096, boxY + height * 0.12, width * 0.036, height * 0.055);
}
