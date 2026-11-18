import vue from 'eslint-plugin-vue';
import globals from 'globals';
import * as vueAPI from 'vue';
import * as routerAPI from 'vue-router';
export default [
  {ignores:['dist/**','node_modules/**','public/**','auto-imports.d.ts']},
  ...vue.configs['flat/essential'],
  {files:['src/**/*.js','src/**/*.vue'],languageOptions:{globals:{...globals.browser,...globals.node,...Object.fromEntries([...Object.keys(vueAPI),...Object.keys(routerAPI)].map(name=>[name,'readonly']))}},rules:{'no-undef':'error','vue/multi-word-component-names':'off'}},
];
