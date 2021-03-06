﻿# BatchJobManager

#### 任务分批执行管理器。

业务中有时会遇到一次性请求很多 API（比如：查询任务结果）的需求，这时，如果不控制会导致服务器瞬间接收很多请求，导致服务器卡死，或者浏览器卡死，相应不过来。

此工具便可以将一批任务，分为 n 批，分批执行，带有进度回调，可以在界面显示执行进度，提升用户体验，减小服务器压力。

查看 [Demo](https://mrhuo.github.io/BatchJobManager/)

#### 使用方法

```
//data 为任务参数数组
var data = [];
BatchJobManager.init({
    //任务参数。必选
    allJobs: data,
    //调试模式。可选，默认false，不输出任何日志
    debug: true,
    //每批任务多少个，不设置默认1个任务1批。可选
    batchSize: 2,
    //任务延迟执行时间，100毫秒，不设置默认1000毫秒。可选
    jobDelay: 100,
    //任务队列检查间隔时间，不设置默认5000。可选
    jobCheckInterval: 1000,
    //手动停止或全部停止回调。可选
    stopCallback: function () {
    },
    //任务执行回调。可选，不设置时使用 console 输出。注意：如果 debug = false，不设置此回调，将看不到任何输出
    jobExecutorCallback: function (jobIndex, job) {
        //这里需要执行真正的任务操作。jobIndex 为所有任务参数中的索引，job 为当前索引对应的任务参数
        //具体看 demo，index.html
    },
    //进度回调。可选
    jobProgressCallback: function (current, total, percentage) {
    }
});
//开始
BatchJobManager.start();
//停止
BatchJobManager.stop();
```
