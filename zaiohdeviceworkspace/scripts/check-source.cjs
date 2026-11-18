const fs = require('fs');
const path = require('path');
const {parse, compileScript, compileTemplate} = require('@vue/compiler-sfc');
const parser = require('@babel/parser');
let count = 0;
function check(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory()){check(filename);continue;}
    const source=fs.readFileSync(filename,'utf8');
    if(filename.endsWith('.vue')) {
      const result=parse(source,{filename});
      if(result.errors.length)throw new Error(filename+': '+result.errors.join('; '));
      const descriptor=result.descriptor;
      if(descriptor.script||descriptor.scriptSetup)compileScript(descriptor,{id:filename});
      if(descriptor.template){const output=compileTemplate({source:descriptor.template.content,filename,id:filename});if(output.errors.length)throw new Error(filename+': '+output.errors.join('; '));}
      count++;
    }else if(filename.endsWith('.js')){parser.parse(source,{sourceType:'module'});count++;}
  }
}
check(path.join(__dirname,'../src'));
console.log(`通过：${count}个Vue SFC/JavaScript源码解析和模板编译检查`);
