import request from '@/config/axios';
import { demoEnabled } from '@/demo/data';
import { CreateDemoAssistantApi } from '@/demo/assistant';

export function CreateAssistantApi() {
    if (demoEnabled) return CreateDemoAssistantApi();
    const call = async (method, path, data, signal) => (await request({
        method, url: '/api/assistant/' + path, data, signal, silentError: true, timeout: 65000,
    })).data;
    return {
        Status: signal => call('GET', 'settings', undefined, signal),
        Save: data => call('PUT', 'settings', data),
        Test: (model, signal) => call('POST', 'test?' + new URLSearchParams({ model }), undefined, signal),
        Ask: (data, signal) => call('POST', 'ask', data, signal),
        Extract: extractDocument,
        SocialStatus: (platform, signal) => call('GET', 'social/' + platform, undefined, signal),
        SocialStart: (platform, data, signal) => call('POST', 'social/' + platform, data, signal),
        SocialRemove: (platform, unbind, signal) => call('DELETE', 'social/' + platform + '?unbind=' + unbind, undefined, signal),
    };
}

async function extractDocument(file, signal) {
    const response = await request({
        method: 'POST', url: '/api/assistant/attachments/extract?' + new URLSearchParams({ name: file.name }),
        data: file, signal, headers: { 'Content-Type': 'application/octet-stream' },
        silentError: true, timeout: 45000,
    });
    return response.data;
}
