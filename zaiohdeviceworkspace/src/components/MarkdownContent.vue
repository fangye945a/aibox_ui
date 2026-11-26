<template>
    <!-- MarkdownIt escapes raw HTML and validates links before rendering. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="markdown-content" v-html="rendered"></div>
</template>

<script setup>
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps({ source: { type: String, required: true } });
const markdown = new MarkdownIt({ html: false, breaks: true });
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content);
const rendered = computed(() => markdown.render(props.source));
</script>

<style scoped>
.markdown-content { white-space: normal; overflow-wrap: anywhere; }
.markdown-content :deep(p) { margin: 0.55em 0; }
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) { margin: 0.85em 0 0.35em; line-height: 1.3; }
.markdown-content :deep(h1) { font-size: 1.45em; }
.markdown-content :deep(h2) { font-size: 1.26em; }
.markdown-content :deep(h3) { font-size: 1.12em; }
.markdown-content :deep(ul),
.markdown-content :deep(ol) { padding-inline-start: 1.6em; margin: 0.5em 0; }
.markdown-content :deep(pre) { max-width: 100%; overflow-x: auto; padding: 11px; background: #eef2fa; border-radius: 7px; }
.markdown-content :deep(code) { font-family: ui-monospace, monospace; background: #eef2fa; border-radius: 3px; }
.markdown-content :deep(blockquote) { margin: 0.65em 0; padding-inline-start: 12px; border-inline-start: 3px solid #a0b5e8; }
.markdown-content :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.markdown-content :deep(th),
.markdown-content :deep(td) { border: 1px solid #dbe4f5; padding: 5px 9px; text-align: start; }
.markdown-content :deep(th) { background: #f0f4fc; }
.markdown-content :deep(a) { color: #3159ce; text-decoration: underline; }
</style>
