/**
 * 任务分批处理管理器。
 * 可以将很多任务（放到一个数组中），分批处理，自动管理任务间隔时间
 */
var BatchJobManager = (function () {
    /**
     * 默认国际化提示字符串
     */
    var i18n = {
        CN: {
            USAGE: function () {
                var ret = [];
                ret.push('任务分批处理管理器使用说明：');
                return ret.join('\n');
            }(),
            STARTED: "任务分批处理管理器已启动，配置：{0}",
            STOPED: "任务分批处理管理器已停止",
            ALREADY_INIT: "任务分批处理管理器已初始化",
            ALREADY_RUNNING: "任务分批处理管理器正在运行中",
            NEED_INIT: "任务分批处理管理器暂未初始化，请调用 `BatchJobManager.init(options)` 方法初始化",
            ALL_JOBS_PARAM_MUST_ARRAY: "`options.allJobs` 参数必须是数组",
            JOB_EXECUTOR_CALLBACK_MUST_FUNCTION: "`options.jobExecutorCallback` 参数必须是一个方法",
            JOB_PROGRESS: "正在执行 {0}/{1}，当前进度：{2}%",
            PER_BATCH_COMPLETE: "批次 {0} 已执行完毕，总 {1} 批次",
            NO_JOBS: "没有需要执行的任务",
            BATCH_SIZE_MUST_GREATER_THAN_ZERO: "任务分批大小必须大于0",
            JOB_DELAY_MUST_GREATER_THAN_ZERO: "任务运行间隔时间必须大于等于0毫秒",
            JOB_CHECK_INTERVAL_MUST_GREATER_THAN_1000: "任务检查执行间隔时间 `options.jobExecutorCallback` 必须大于等于1000ms",
            JOB_START: "任务[{0}]开始执行",
            JOB_EXECUTING: "任务[{0}]正在执行，参数[{1}]"
        },
        EN: {
            USAGE: function () {
                var ret = [];
                ret.push('BatchJobManager Usage:');
                return ret.join('\n');
            }(),
            STARTED: "BatchJobManager Started, options: {0}",
            STOPED: "BatchJobManager  stopped",
            ALREADY_INIT: "BatchJobManager  is already init",
            ALREADY_RUNNING: "BatchJobManager  is already running",
            NEED_INIT: "BatchJobManager  is not init, please invoke `BatchJobManager.init()` first",
            ALL_JOBS_PARAM_MUST_ARRAY: "Param `options.allJobs` must be an Array",
            JOB_EXECUTOR_CALLBACK_MUST_FUNCTION: "Param `options.jobExecutorCallback` must be a Function",
            JOB_PROGRESS: "Current progress {0}/{1}, percentage {2}%",
            PER_BATCH_COMPLETE: "Batch {0} complete, total {1} batchs",
            NO_JOBS: "No jobs to do",
            BATCH_SIZE_MUST_GREATER_THAN_ZERO: "Batch size must be greater than 0",
            JOB_DELAY_MUST_GREATER_THAN_ZERO: "Param `options.jobDelay` must greater than 0ms",
            JOB_CHECK_INTERVAL_MUST_GREATER_THAN_1000: "Param `options.jobCheckInterval` must greater than 1000ms",
            JOB_START: "Job [{0}] start",
            JOB_EXECUTING: "The job {0} running, param: {1}"
        }
    };

    var
        /**
         * 是否初始化，调用 BatchJobManager.init(options) 即可对管理器初始化
         */
        isInit = false,
        /**
         * 是否正在有任务执行
         */
        isJobRunning = false,
        /**
         * 已完成批次
         */
        completedBatch = 0,
        /**
         * 已完成任务
         */
        completedJobs = 0,
        /**
         * 管理器是否正在运行
         */
        isRunning = false,
        /**
         * 批量任务检测句柄（setInterval）
         */
        jobCheckIntervalHandler = 0,
        /**
         * 默认配置
         */
        defaultOptions = {
            /**
             * 本地化语言，默认中文
             */
            local: "CN",
            /**
            * 调试变量，开启后输出日志
            */
            debug: false,
            /**
             * 批次执行检查时间间隔
             */
            jobCheckInterval: 5000,
            /**
             * 每个任务执行延迟，设为0不延迟。默认1000ms（1秒）
             */
            jobDelay: 1000,
            /**
             * 所有需要执行的任务
             */
            allJobs: [],
            /**
             * 任务分批大小，必须大于0，默认1。1个任务1个批次
             */
            batchSize: 1,
            /**
             * 管理器任务开始回调
             * 声明：function startCallback(batchedJobs, batchSize)
             * 参数说明：分批后的任务数组，每批数量。（batchedJobs.length 即总批次）
             */
            startCallback: function (batchedJobs, batchSize) {
                logInfo(i18n[defaultOptions["local"]].STARTED, JSON.stringify(defaultOptions))
            },
            /**
             * 管理器停止回调，任务手动停止（BatchJobManager.stop()）或者任务全部执行完毕时执行
             * 声明：function stopCallback()
             * 参数说明：无
             */
            stopCallback: function () {
                logInfo(i18n[defaultOptions["local"]].STOPED)
            },
            /**
             * 每批任务结束后回调
             * 声明：function perBatchCompleteCallback(batchIndex, totalBatchs)
             * 参数说明：当前批次索引，总批次
             */
            perBatchCompleteCallback: function (batchIndex, totalBatchs) {
                logInfo(i18n[defaultOptions["local"]].PER_BATCH_COMPLETE, batchIndex, totalBatchs);
            },
            /**
             * 任务开始执行之前回调
             * 声明：function (jobIndex, job)
             * 参数说明：当前任务索引，当前任务
             */
            jobStartCallback: function (jobIndex, job) {
                logInfo(i18n[defaultOptions["local"]].JOB_START, jobIndex, job);
            },
            /**
             * 任务执行进度回调
             * 声明：function jobProgressCallback(current, total, percentage)
             * 参数说明：当前任务，总任务，百分比（不带百分号小数）
             */
            jobProgressCallback: function (current, total, percentage) {
                logInfo(i18n[defaultOptions["local"]].JOB_PROGRESS, current, total, percentage)
            },
            /**
             * 每个任务真正需要执行的方法
             * 声明：function jobExecutorCallback(jobIndex, job)
             * 参数说明：当前任务索引，当前任务
             */
            jobExecutorCallback: function (jobIndex, job) {
                logInfo(i18n[defaultOptions["local"]].JOB_EXECUTING, jobIndex, job);
            }
        }

    /**
     * 简易对象合并
     * @param {*} target 目标对象
     * @param {*} source 源对象
     */
    var extend = function (target, source) {
        for (var obj in source) {
            target[obj] = source[obj];
        }
        return target;
    }
    /**
     * 记录消息型日志
     * @param {*} msg format 字符串，{0}
     * @param {...any} params 参数
     */
    var logInfo = function () {
        defaultOptions.debug && console && console.log && console.log(stringFormat(arguments))
    }
    /**
     * 记录警告型日志
     * @param {*} msg format 字符串，{0}
     * @param {...any} params 参数
     */
    var logWarn = function () {
        defaultOptions.debug && console && console.warn && console.warn(stringFormat(arguments))
    }
    /**
     * 判断一个对象是否是数组
     * @param {Array} obj 数组对象
     */
    var isArray = function (obj) {
        return typeof obj == 'object' && obj.constructor == Array
    }
    /**
     * 判断一个对象是否是fa
     * @param {Function} obj 数组对象
     */
    var isFunction = function (obj) {
        return typeof obj == 'function'
    }
    /**
     * 按照指定的批次大小分割任务，返回分批后的任务数组
     * @param {Array} allJobs 所有任务
     * @param {Number} batchSize 批次大小，每批次含有多少元素
     */
    var splitJobs = function (allJobs, batchSize) {
        var batchs = []
        for (var i = 0, len = allJobs.length; i < len; i += batchSize) {
            batchs.push(allJobs.slice(i, i + batchSize))
        }
        return batchs
    }
    /**
     * 字符串格式化
     */
    var stringFormat = function (allArguments) {
        var s = allArguments[0];
        for (var i = 0; i < allArguments.length - 1; i++) {
            var reg = new RegExp("\\{" + i + "\\}", "gm");
            s = s.replace(reg, allArguments[i + 1]);
        }
        return s;
    }
    /**
     * 执行任务
     * @param {*} perBatchJobs 每批次任务数组
     * @param {*} totalBatchs 总批次数量
     */
    var doJob = function (perBatchJobs, totalBatchs) {
        //如果有任务执行，直接返回
        if (!isRunning || isJobRunning) {
            return
        }
        isJobRunning = true
        for (var i = 0; i < perBatchJobs.length; i++) {
            setTimeout(
                function (jobs, jobIndex) {
                    if (!isRunning) {
                        return;
                    }
                    var job = jobs[jobIndex]
                    defaultOptions.jobStartCallback && defaultOptions.jobStartCallback(completedJobs, job);
                    //执行任务
                    defaultOptions.jobExecutorCallback && defaultOptions.jobExecutorCallback(completedJobs, job)
                    //更新任务进度
                    defaultOptions.jobProgressCallback && defaultOptions.jobProgressCallback(
                        ++completedJobs,
                        defaultOptions.allJobs.length,
                        parseFloat(((completedJobs / defaultOptions.allJobs.length) * 100.0).toFixed(2))
                    )
                    //如果任务本批次任务执行完毕，更新批次进度，调用每批次任务完成回调方法
                    if (jobIndex == jobs.length - 1) {
                        isJobRunning = false
                        defaultOptions.perBatchCompleteCallback && defaultOptions.perBatchCompleteCallback(++completedBatch, totalBatchs)
                    }
                },
                i * defaultOptions.jobDelay,
                perBatchJobs,
                i
            )
        }
    }

    /**
     * 初始化管理器。
     * 默认 options 结构：
     * defaultOptions = {
     *     //本地化语言，默认中文
     *     local: "CN",
     *     //调试变量，开启后输出日志
     *     debug: false,
     *     //批次执行检查时间间隔
     *     jobCheckInterval: 5000,
     *     //每个任务执行延迟，设为0不延迟。默认1000ms（1秒）
     *     jobDelay: 1000,
     *     //所有需要执行的任务
     *     allJobs: [],
     *     //任务分批大小，必须大于0，默认1。1个任务1个批次
     *     batchSize: 1,
     *     //管理器任务开始回调
     *     //参数说明：分批后的任务数组，每批数量。（batchedJobs.length 即总批次）
     *     startCallback: function (batchedJobs, batchSize) {
     *         logInfo(i18n[defaultOptions["local"]].STARTED, JSON.stringify(defaultOptions))
     *     },
     *     //管理器停止回调，任务手动停止（BatchJobManager.stop()）或者任务全部执行完毕时执行
     *     //参数说明：无
     *     stopCallback: function () {
     *         logInfo(i18n[defaultOptions["local"]].STOPED)
     *     },
     *     //每批任务结束后回调
     *     //参数说明：当前批次索引，总批次
     *     perBatchCompleteCallback: function (batchIndex, totalBatchs) {
     *         logInfo(i18n[defaultOptions["local"]].PER_BATCH_COMPLETE, batchIndex, totalBatchs);
     *     },
     *     //任务开始执行之前回调
     *     //参数说明：当前任务索引，当前任务
     *     jobStartCallback: function (jobIndex, job) {
     *         logInfo(i18n[defaultOptions["local"]].JOB_START, jobIndex, job);
     *     },
     *     //任务执行进度回调
     *     //参数说明：当前任务，总任务，百分比（不带百分号小数）
     *     jobProgressCallback: function (current, total, percentage) {
     *         logInfo(i18n[defaultOptions["local"]].JOB_PROGRESS, current, total, percentage)
     *     },
     *     //每个任务真正需要执行的方法
     *     //参数说明：当前任务索引，当前任务
     *     jobExecutorCallback: function (jobIndex, job) {
     *         logInfo(i18n[defaultOptions["local"]].JOB_EXECUTING, jobIndex, job);
     *     }
     * }
     */
    this.init = function (options) {
        defaultOptions = extend(defaultOptions, options)
        var local = defaultOptions["local"];
        if (!local) {
            local = defaultOptions["local"] = "CN";
        }
        if (isInit) {
            logWarn(i18n[local].ALREADY_INIT)
            return
        }
        if (isRunning) {
            logWarn(i18n[local].ALREADY_RUNNING)
            return
        }
        if (!isArray(defaultOptions.allJobs)) {
            logWarn(i18n[local].ALL_JOBS_PARAM_MUST_ARRAY)
            return
        }
        if (!isFunction(defaultOptions.jobExecutorCallback)) {
            logWarn(i18n[local].JOB_EXECUTOR_CALLBACK_MUST_FUNCTION)
            return
        }
        if (defaultOptions.allJobs.length < 1) {
            logWarn(i18n[local].NO_JOBS)
            return
        }
        if (typeof defaultOptions.batchSize === 'undefined' || defaultOptions.batchSize < 1) {
            logWarn(i18n[local].BATCH_SIZE_MUST_GREATER_THAN_ZERO)
            return
        }
        if (typeof defaultOptions.jobDelay === 'undefined' || defaultOptions.jobDelay < 0) {
            logWarn(i18n[local].JOB_DELAY_MUST_GREATER_THAN_ZERO)
            return
        }
        if (defaultOptions.jobCheckInterval < 1000) {
            logWarn(i18n[local].JOB_CHECK_INTERVAL_MUST_GREATER_THAN_1000)
            defaultOptions.jobCheckInterval = 5000
        }
        isInit = true
    }

    /**
     * 输出使用方法
     */
    this.usage = function () {
        logInfo(i18n[defaultOptions["local"]].USAGE)
    }

    /**
     * 开启任务管理器
     */
    this.start = function () {
        var that = this
        if (!isInit) {
            logWarn(i18n[defaultOptions["local"]].NEED_INIT)
            return
        }
        if (isRunning) { 
            logWarn(i18n[defaultOptions["local"]].ALREADY_RUNNING)
            return
        }

        //初始化变量
        completedBatch = 0
        completedJobs = 0
        isRunning = false

        //切分任务
        var batchedJobs = splitJobs(defaultOptions.allJobs, defaultOptions.batchSize)
        //调用启动回调方法
        defaultOptions.startCallback && defaultOptions.startCallback(batchedJobs, defaultOptions.batchSize)

        isRunning = true
        //定时任务检查是否还有没有完成的任务批次
        jobCheckIntervalHandler = setInterval(function () {
            if (
                isRunning == false ||
                completedBatch >= batchedJobs.length
            ) {
                that.stop();
            } else {
                doJob(batchedJobs[completedBatch], batchedJobs.length)
            }
        }, defaultOptions.jobCheckInterval)
    }

    /**
     * 结束任务管理器，设 isRunning = false
     */
    this.stop = function () {
        isRunning = false
        clearInterval(jobCheckIntervalHandler)
        defaultOptions.stopCallback && defaultOptions.stopCallback();
    }

    return this
})()
