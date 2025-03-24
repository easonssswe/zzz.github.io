// ========== iOS专用配置 ==========
const IOS_CONFIG = {
    ANGLE_RANGE: 80, // iOS的gamma值范围较小
    VIBRATION_DURATION: 400 // 更长的震动
};

// ========== 状态管理 ==========
const state = {
    isCalibrating: false,
    baseGamma: null, // iOS使用gamma值
    currentRep: 0,
    lastVibration: 0
};

// ========== DOM元素 ==========
const elements = {
    initModal: document.getElementById('initModal'),
    startBtn: document.getElementById('startBtn'),
    trainingUI: document.getElementById('trainingUI'),
    repCounter: document.getElementById('repCounter'),
    progressRing: document.getElementById('progressRing'),
    ctx: document.getElementById('progressRing').getContext('2d'),
    percentage: document.getElementById('percentage'),
    feedback: document.getElementById('feedback'),
    resultModal: document.getElementById('resultModal'),
    analysisResult: document.getElementById('analysisResult'),
    restartBtn: document.getElementById('restartBtn'),
    debugInfo: document.getElementById('debugInfo')
};

// ========== 初始化 ==========
function init() {
    // 进度环样式
    elements.ctx.lineWidth = 12;
    elements.ctx.strokeStyle = '#FF2D55'; // iOS风格红色
    elements.ctx.lineCap = 'round';

    // 事件绑定
    elements.startBtn.addEventListener('click', requestPermission);
    elements.restartBtn.addEventListener('click', resetApp);
    
    // 显示调试信息（开发时启用）
    // elements.debugInfo.style.display = 'block';
}

// ========== iOS权限请求 ==========
async function requestPermission() {
    try {
        // 必须来自用户点击事件
        const permission = await DeviceOrientationEvent.requestPermission();
        
        if (permission === 'granted') {
            elements.initModal.classList.remove('active');
            elements.trainingUI.style.display = 'block';
            startCalibration();
        } else {
            showFeedback("请允许方向传感器权限");
        }
    } catch (error) {
        showFeedback("错误: " + error.message);
    }
}

// ========== 校准系统 ==========
function startCalibration() {
    state.isCalibrating = true;
    showFeedback("将手机平放在桌面...");
    
    const samples = [];
    let calibrationCount = 0;
    
    const calibrationInterval = setInterval(() => {
        calibrationCount++;
        showFeedback(`校准中... ${calibrationCount}/3`);
    }, 1000);

    const listener = (event) => {
        // iOS横屏时使用gamma值
        samples.push(event.gamma);
        updateDebugInfo(event);
    };

    window.addEventListener('deviceorientation', listener);

    setTimeout(() => {
        clearInterval(calibrationInterval);
        window.removeEventListener('deviceorientation', listener);
        
        // 计算平均值（过滤异常值）
        const validSamples = samples.filter(g => g !== null && Math.abs(g) < 15);
        state.baseGamma = validSamples.reduce((a,b) => a + b, 0) / validSamples.length;
        
        showFeedback("校准完成！开始弯举");
        state.isCalibrating = false;
        startTraining();
    }, 3000);
}

// ========== 训练逻辑 ==========
function startTraining() {
    window.addEventListener('deviceorientation', handleOrientation);
}

function handleOrientation(event) {
    if (state.isCalibrating || state.baseGamma === null) return;
    
    // iOS横屏时gamma值范围：-90°到90°
    const currentGamma = event.gamma;
    let progress = (currentGamma - state.baseGamma) / IOS_CONFIG.ANGLE_RANGE;
    progress = Math.min(Math.max(progress, 0), 1); // 限制在0-1范围
    
    updateUI(progress);
    checkProgress(progress);
    updateDebugInfo(event);
}

// ========== UI更新 ==========
function updateUI(progress) {
    // 进度环
    elements.ctx.clearRect(0, 0, 200, 200);
    elements.ctx.beginPath();
    elements.ctx.arc(100, 100, 90, -Math.PI/2, (Math.PI*2)*progress - Math.PI/2);
    elements.ctx.stroke();
    
    // 百分比
    elements.percentage.textContent = `${Math.round(progress * 100)}%`;
    
    // 手臂动画
    elements.arm.style.transform = `rotate(${progress * 180}deg)`;
}

// ========== 进度检测 ==========
function checkProgress(progress) {
    const now = Date.now();
    
    // 到达顶部
    if (progress > 0.9 && !state.isPeak) {
        state.isPeak = true;
        triggerVibration(IOS_CONFIG.VIBRATION_DURATION);
        showFeedback("保持顶峰收缩！");
    }
    // 回到底部
    else if (progress < 0.1 && state.isPeak) {
        state.isPeak = false;
        completeRepetition();
    }
}

function completeRepetition() {
    const now = Date.now();
    if (now - state.lastVibration < 1000) return; // 防抖
    
    state.currentRep++;
    elements.repCounter.textContent = `${state.currentRep}/3`;
    triggerVibration([100, 50, 100]);
    
    if (state.currentRep >= 3) {
        finishTraining();
    }
    
    state.lastVibration = now;
}

// ========== 训练完成 ==========
function finishTraining() {
    window.removeEventListener('deviceorientation', handleOrientation);
    showResult();
    triggerVibration([300, 100, 300]);
}

function showResult() {
    elements.analysisResult.innerHTML = `
        <p>完成3次标准弯举！</p>
        <p>建议：保持匀速控制</p>
    `;
    elements.resultModal.style.display = 'block';
}

// ========== 工具函数 ==========
function triggerVibration(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

function showFeedback(text) {
    elements.feedback.textContent = text;
}

function updateDebugInfo(event) {
    elements.debugInfo.innerHTML = `
        Gamma: ${event.gamma?.toFixed(1) || 'null'}<br>
        Base: ${state.baseGamma?.toFixed(1) || '未校准'}<br>
        Rep: ${state.currentRep}/3
    `;
}

function resetApp() {
    state.baseGamma = null;
    state.currentRep = 0;
    elements.resultModal.style.display = 'none';
    elements.trainingUI.style.display = 'none';
    elements.initModal.classList.add('active');
}

// 启动应用
init();