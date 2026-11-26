<template>
    <el-dialog :model-value="modelValue" :title="'接入 ' + name"
        width="min(460px, calc(100vw - 28px))" @update:model-value="$emit('update:modelValue', $event)">
        <div class="social-body" v-loading="busy">
            <template v-if="state.qr">
                <img class="social-qr" :src="'data:image/png;base64,' + state.qr" :alt="name + '绑定二维码'" />
                <p>{{ state.state === 'scanned' ? '已扫码，请在手机上确认授权。' : '请使用 ' + name + ' 扫描二维码。' }}</p>
                <p v-if="state.expiresAt" class="social-note">有效至 {{ formatTime(state.expiresAt) }}</p>
            </template>
            <p v-else-if="state.state === 'unbound'">扫码绑定后，在{{ name }}私聊中即可与 ZaiAgent 对话。</p>
            <p v-if="stateText" class="social-status" role="status">{{ stateText }}</p>
            <p v-if="state.bound" class="social-note">设备会在后台保持连接，并使用工作台的默认模型回复已绑定账号。</p>
            <p v-if="state.message" class="social-note" role="status">{{ state.message }}</p>
            <p v-if="error" class="social-error" role="alert">{{ error }}</p>
            <p v-if="confirmUnbind" class="social-error">解绑后，{{ name }}将停止接收 ZaiAgent 回复。</p>
        </div>
        <template #footer>
            <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
            <el-button v-if="waiting" :disabled="busy" @click="remove(false)">取消绑定</el-button>
            <el-button v-if="state.bound" type="danger" :plain="!confirmUnbind" :disabled="busy" @click="unbind">
                {{ confirmUnbind ? '确认解绑' : '解绑' }}
            </el-button>
            <el-button v-if="state.state === 'unknown' && error" type="primary" :disabled="busy" @click="refresh">
                重新查询
            </el-button>
            <el-button v-if="canStart" type="primary" :disabled="busy" @click="start">生成二维码</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, onDeactivated, onUnmounted, ref, watch } from 'vue';
import { CreateAssistantApi } from '@/api/assistant';

const props = defineProps({ modelValue: Boolean, platform: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const api = CreateAssistantApi();
const name = computed(() => ({ feishu: '飞书', weixin: '微信', qq: 'QQ' })[props.platform]);
const state = ref({ state: 'unknown' });
const busy = ref(false);
const error = ref('');
const confirmUnbind = ref(false);
const canStart = computed(() => !state.value.bound && ['unbound', 'expired', 'error'].includes(state.value.state));
const waiting = computed(() => !state.value.bound && ['starting', 'waiting', 'scanned'].includes(state.value.state));
const stateText = computed(() => ({
    starting: '正在连接平台…',
    connecting: '已绑定，正在建立连接…',
    connected: '已连接',
    reconnecting: '正在重新连接…',
    expired: '扫码已过期',
    error: '连接失败',
})[state.value.state] || '');
let controller;
let timer;

function formatTime(value) {
    return new Date(value).toLocaleTimeString();
}

function stop() {
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
    busy.value = false;
}

async function run(operation, foreground = false) {
    stop();
    const request = new AbortController();
    controller = request;
    busy.value = foreground;
    error.value = '';
    try {
        const result = await operation(props.platform, request.signal);
        if (!request.signal.aborted) state.value = result;
    } catch (err) {
        if (!request.signal.aborted) error.value = err.message || '无法连接工作台，请重试。';
    } finally {
        if (!request.signal.aborted) {
            busy.value = false;
            if (props.modelValue && (waiting.value || state.value.bound || state.value.state === 'busy')) {
                timer = setTimeout(refresh, error.value ? 3000 : 1500);
            }
        }
    }
}

function refresh() {
    return run(api.SocialStatus, state.value.state === 'unknown');
}

function start() {
    return run((platform, signal) => api.SocialStart(platform, {}, signal), true);
}

function remove(unbind) {
    confirmUnbind.value = false;
    return run((platform, signal) => api.SocialRemove(platform, unbind, signal), true);
}

function unbind() {
    if (confirmUnbind.value) remove(true);
    else confirmUnbind.value = true;
}

watch(() => [props.modelValue, props.platform], async ([open]) => {
    stop();
    state.value = { state: 'unknown' };
    confirmUnbind.value = false;
    error.value = '';
    if (open) {
        await refresh();
        if (props.modelValue && state.value.state === 'unbound') start();
    }
});

onDeactivated(() => {
    stop();
    emit('update:modelValue', false);
});
onUnmounted(stop);
</script>

<style scoped>
.social-body { min-height: 72px; text-align: center; }
.social-qr { display: block; width: min(240px, 100%); margin: 0 auto 12px; image-rendering: pixelated; }
.social-body p { margin: 8px 0; line-height: 1.55; }
.social-note { color: var(--el-text-color-secondary); font-size: 13px; }
.social-status { font-weight: 600; }
.social-error { color: var(--el-color-danger); }
</style>
