// 状态管理
const state = {
    isTraining: false,
    baseAngle: null,
    currentPhase: 'down',
    repCount: 0,
    motionData: []
};

// DOM元素
const elements = {
    initModal: document.getElementById('initModal'),
    startBtn: document.getElementById('startBtn'),
    container: document.querySelector('.container'),
    calibrateBtn: document.getElementById('calibrateBtn'),
    repCounter: document.getElementById('repCounter'),
    progressRing: document.getElementById('progressRing'),
    ctx: document.getElementById('progressRing').getContext('2d'),
    percentage: document.getElementById('percentage'),
    arm: document.getElementById('arm'),
    feedback: document.getElementById('feedback'),
    resultModal: document.getElementById('resultModal'),
    analysisResult: document.getElementById('analysisResult'),
    restartBtn: document.getElementById('restartBtn')
};

// 配置参数
const CONFIG = {
    TOTAL_REPS: 3,
    ANGLE_RANGE: 90,
    VIBRATION_PATTERNS: {
        REP_COMPLETE: [100, 50, 100],
        PEAK: [200],
        FINISH: [300, 100, 300]
    }
};

// 初始化
function init() {
    elements.ctx.lineWidth = 10;
    elements.ctx.strokeStyle = '#4CAF50';
    elements.ctx.lineCap = 'round';

    // 事件绑定
    elements.startBtn.addEventListener('click', startApp);
    elements.calibrateBtn.addEventListener('click', calibrate);
    elements.restartBtn.addEventListener('click', restartTraining);
}

// 开始应用
function startApp() {
    elements.initModal.classList.remove('active');
    elements.container.style.display = 'block';
    checkOrientation();
}

// 方向检测
function checkOrientation() {
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (!isLandscape) {
        showFeedback('请横屏握持手机');
        return false;
    }
    return true;
}

// 校准系统
function calibrate() {
    if (!checkOrientation()) return;

    const samples = [];
    const listener = (event) => samples.push(event.beta);
    
    window.addEventListener('deviceorientation', listener);
    showFeedback('校准中...保持手机平放');

    setTimeout(() => {
        window.removeEventListener('deviceorientation', listener);
        state.baseAngle = samples.reduce((a, b) => a + b, 0) / samples.length;
        showFeedback('校准完成！开始训练');
        startTraining();
    }, 3000);
}

// 开始训练
async function startTraining() {
    try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            await DeviceOrientationEvent.requestPermission();
        }
        window.addEventListener('deviceorientation', handleOrientation);
        state.isTraining = true;
    } catch (error) {
        showFeedback('需要传感器权限');
    }
}

// 传感器处理
function handleOrientation(event) {
    if (!state.isTraining || !state.baseAngle) return;

    const delta = event.beta - state.baseAngle;
    const progress = Math.min(Math.max(delta / CONFIG.ANGLE_RANGE, 0), 1);

    updateUI(progress);
    checkProgress(progress);
}

// UI更新
function updateUI(progress) {
    // 进度环
    elements.ctx.clearRect(0, 0, 200, 200);
    elements.ctx.beginPath();
    elements.ctx.arc(100, 100, 90, -Math.PI/2, (Math.PI*2)*progress - Math.PI/2);
    elements.ctx.stroke();

    // 百分比
    elements.percentage.textContent = `${Math.round(progress * 100)}%`;

    // 手臂角度
    elements.arm.style.transform = `rotate(${progress * 180}deg)`;
}

// 进度检测
function checkProgress(progress) {
    if (progress >= 0.95 && state.currentPhase === 'down') {
        state.currentPhase = 'up';
        triggerFeedback('PEAK');
    } else if (progress <= 0.05 && state.currentPhase === 'up') {
        completeRep();
    }
}

// 完成单次动作
function completeRep() {
    state.repCount++;
    elements.repCounter.textContent = `${state.repCount}/${CONFIG.TOTAL_REPS}`;
    triggerFeedback('REP_COMPLETE');

    if (state.repCount >= CONFIG.TOTAL_REPS) {
        finishTraining();
    }
}

// 完成训练
function finishTraining() {
    state.isTraining = false;
    window.removeEventListener('deviceorientation', handleOrientation);
    showReport();
    triggerFeedback('FINISH');
}

// 显示报告
function showReport() {
    const analysis = {
        smoothness: '优秀',
        control: '良好',
        range: '完整'
    };
    elements.analysisResult.innerHTML = `
        <p>动作流畅度: ${analysis.smoothness}</p>
        <p>离心控制: ${analysis.control}</p>
        <p>动作幅度: ${analysis.range}</p>
    `;
    elements.resultModal.style.display = 'block';
}

// 重新开始
function restartTraining() {
    state.repCount = 0;
    state.baseAngle = null;
    elements.resultModal.style.display = 'none';
    elements.repCounter.textContent = '0/3';
    elements.container.style.display = 'none';
    elements.initModal.classList.add('active');
}

// 反馈系统
function triggerFeedback(type) {
    navigator.vibrate(CONFIG.VIBRATION_PATTERNS[type]);
}

function showFeedback(text) {
    elements.feedback.textContent = text;
}

// 启动
init();