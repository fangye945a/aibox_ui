<template>
<div class='pagination'>
  <el-pagination
    style=" text-align: right; padding-right: 20px;"
    background
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
    :current-page="pagination.pageNum"
    :page-sizes="[10, 15, 20, 30]"
    :page-size="pagination.pageSize"
    layout="total, prev, pager, next,sizes, jumper"
    :total="pagination.total">
  </el-pagination>
  </div>
</template>
<script>
  export default {
    props: {
      pagination: {
        default() {
          return {
            pageNum: 1,
            total: 0,
            pageSize: 10
          }
        },
        type: Object
      }
    },
    data() {
      return {}
    },
    mounted() {
    },
    methods: {
      handleSizeChange(val) {
        this.$emit('pageSizeChangeHandle', val)
      },
      handleCurrentChange(page) {
        this.$emit('pageChangeHandle', page)
      }
    },
  }
</script>
<style lang="scss">
.pagination{
  background:#fff;
  padding:22px 0px;
}
.el-pagination.is-background .btn-next, .el-pagination.is-background .btn-prev, .el-pagination.is-background .el-pager li{
  border:1px solid #c9c9cb;
  color:#000;
  opacity: .65;
  background:transparent;
}
.el-pagination__jump{
  margin-left: 0px;
}
.el-pagination.is-background .el-pager li:not(.disabled).active{
  border-color:#1890ff;
  color:#1890ff;
  background:transparent;
}

</style>