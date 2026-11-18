<template>
   <svg class="svg-icon" aria-hidden="true">
      <use :xlink:href="iconName" />
    </svg>
</template>

<script>
const req = require.context('@/assets/icons/', false, /\.svg$/)
const requireAll = requireContext => requireContext.keys().map(requireContext)
requireAll(req)
export default {
  name: 'SvgIcon',
  props: {
    iconClass: {
      type: String,
      required: true
    },
    className: {
      type: String,
      default: ''
    }
  },
  computed: {
    // isExternal() {
    //   return isExternal(this.iconClass)
    // },
    iconName() {
      return `#icon-${this.iconClass}`
    },
    svgClass() {
      if (this.className) {
        return 'svg-icon ' + this.className
      } else {
        return 'svg-icon'
      }
    },
    styleExternalIcon() {
      return {
        mask: `url(${this.iconClass}) no-repeat 50% 50%`,
        '-webkit-mask': `url(${this.iconClass}) no-repeat 50% 50%`
      }
    }
  }
}
</script>

<style scoped>
.svg-icon {
  width:16px;
  height: 16px;
  /* vertical-align: -0.15em; */
  fill: currentColor;
  overflow: hidden;
  margin-right: 10px;
  margin-left: 4px;
}

.svg-external-icon {
  background-color: currentColor;
  mask-size: cover!important;
  display: inline-block;
}
</style>
