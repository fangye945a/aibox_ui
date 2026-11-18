const path = require('path')

function resolve(dir) {
  return path.join(__dirname, dir)
}

const { defineConfig } = require('@vue/cli-service')
//自动导入
const AutoImport = require('unplugin-auto-import/webpack')
const Components = require('unplugin-vue-components/webpack')
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers')
// 实现 gzip 压缩打包
const CompressionPlugin = require('compression-webpack-plugin')
// vue.config.js
module.exports = defineConfig({
  
  publicPath:'./',
  outputDir: 'dist',
  filenameHashing: true,
  lintOnSave: false,
  devServer: {
    port: 9101,
    hot: true,          // 开启热更新
    open:false,
    client:{
      overlay: false
    }
},
  //静态资源打包路径
  assetsDir: "static",
  //默认false 可以加快打包
  productionSourceMap: false,
  transpileDependencies: false,
  css: {
      loaderOptions: {
        sass: {
          additionalData: `
                  @import "@/assets/css/style.scss";
                 
                `
        }
      }
  },
  // 和webpapck属性完全一致，最后会进行合并
  configureWebpack:{
    name: '边缘本地控制台',
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    //配置webpack自动按需引入element-plus
    plugins: [
      AutoImport({
        dts:true,
        imports:['vue','vue-router'],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
      // http://doc.ruoyi.vip/ruoyi-vue/other/faq.html#使用gzip解压缩静态文件
      new CompressionPlugin({
        test: /\.(js|css|html)?$/i,     // 压缩文件格式
        filename: '[path][base].gz',   // 压缩后的文件名
        algorithm: 'gzip',              // 使用gzip压缩
        threshold: 10240,               // 最小文件开启压缩
        minRatio: 0.8                   // 压缩率小于1才会压缩
      })
    ],
  },
  chainWebpack (config) {
    config.plugins.delete('preload') // TODO: need test
    config.plugins.delete('prefetch') // TODO: need test

    // set svg-sprite-loader
    config.module
        .rule('svg')
        .exclude.add(resolve('src/assets/icons'))
        .end()
    config.module
        .rule('icons')
        .test(/\.svg$/)
        .include.add(resolve('src/assets/icons'))
        .end()
        .use('svg-sprite-loader')
        .loader('svg-sprite-loader')
        .options({
            symbolId: 'icon-[name]'
        })
        .end()
  }
  
})
