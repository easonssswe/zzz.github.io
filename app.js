// ====== 状态管理 ======
const state = {
    isTraining: false,
    isCalibrating: false,
    baseAngle: null,  // 动态基准角度
    currentProgress: 0,
    currentPhase: 'down',
    repCount: 0,
    motionData: []
};

// ====== DOM元素 ======
const elements = {
    ring: document.getElementById('progressRing'),
    ctx: document.getElementById('progressRing').getContext('2d'),
    arm: document.getElementById('arm'),
    feedback: document.getElementById('feedback'),
    repCounter: document.getElementById('repCounter'),
    percentage: document.getElementById('percentage'),
    resetBtn: document.getElementById('resetBtn'),
    calibrateBtn: document.getElementById('calibrateBtn'),
    modal: document.getElementById('resultModal'),
    analysisResult: document.getElementById('analysisResult'),
    orientationAlert: document.getElementById('orientationAlert')
};

// ====== 配置参数 ======
const CONFIG = {
    ANGLE_RANGE: 90,  // 从基准角度开始的有效变化范围
    TOTAL_REPS: 3,
    VIBRATION_COOLDOWN: 500
};

// ====== 初始化 ======
function init() {
    // 强制横屏样式
    document.documentElement.style.transform = 'rotate(-90deg)';
    document.documentElement.style.transformOrigin = '50% 50%';
    document.documentElement.style.width = '100vh';
    document.documentElement.style.height = '100vw';
    document.documentElement.style.position = 'absolute';
    document.documentElement.style.top = '50%';
    document.documentElement.style.left = '50%';
    document.documentElement.style.marginRight = '-50%';
    document.documentElement.style.marginLeft = '-50%';

    // 进度环样式
    elements.ctx.lineWidth = 10;
    elements.ctx.strokeStyle = '#4CAF50';
    elements.ctx.lineCap = 'round';
    
    // 事件监听
    elements.resetBtn.addEventListener('click', resetTraining);
    elements.calibrateBtn.addEventListener('click', startCalibration);
    document.getElementById('closeModal').addEventListener('click', hideModal);
    
    // 初始提示
    elements.feedback.textContent = "1. 将手机平放在桌面\n2. 点击[校准起始位置]";
    elements.calibrateBtn.style.display = 'block';
}
init();

// ====== 校准系统 ======
function startCalibration() {
    state.isCalibrating = true;
    elements.feedback.textContent = "正在校准...保持手机静止";
    
    // 收集3秒内的传感器数据取平均值
    const samples = [];
    const listener = (event) => {
        samples.push(event.beta);
        if (samples.length >= 30) { // 约0.5秒数据(假设60fps)
            window.removeEventListener('deviceorientation', listener);
            finishCalibration(samples);
        }
    };
    
    window.addEventListener('deviceorientation', listener);
    setTimeout(() => {
        window.removeEventListener('deviceorientation', listener);
        if (samples.length > 0) finishCalibration(samples);
    }, 3000);
}

function finishCalibration(samples) {
    // 计算平均值并过滤异常值
    const validSamples = samples.filter(a => a > -45 && a < 45);
    state.baseAngle = validSamples.reduce((a,b) => a + b, 0) / validSamples.length;
    
    elements.feedback.textContent = `校准完成！基准角度: ${state.baseAngle.toFixed(1)}°\n点击屏幕开始训练`;
    elements.calibrateBtn.style.display = 'none';
    state.isCalibrating = false;
    
    document.body.addEventListener('click', startTraining, { once: true });
}

// ====== 训练控制 ======
async function startTraining() {
    if (state.baseAngle === null) {
        elements.feedback.textContent = "请先校准起始位置";
        return;
    }

    try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') throw new Error('权限被拒绝');
        }
        
        state.isTraining = true;
        window.addEventListener('deviceorientation', handleOrientation);
        elements.feedback.textContent = "缓慢完成弯举动作";
    } catch (error) {
        elements.feedback.textContent = "需要传感器权限: " + error.message;
    }
}

function resetTraining() {
    state.isTraining = false;
    state.repCount = 0;
    state.currentPhase = 'down';
    state.motionData = [];
    
    window.removeEventListener('deviceorientation', handleOrientation);
    updateCounter();
    updateUI(0);
    elements.feedback.textContent = "1. 将手机平放在桌面\n2. 点击[校准起始位置]";
    elements.calibrateBtn.style.display = 'block';
    hideModal();
}

// ====== 传感器处理 ======
function handleOrientation(event) {
    if (!state.isTraining || !state.baseAngle) return;

    // 计算相对于基准角度的变化
    const delta = event.beta - state.baseAngle;
    let progress = Math.min(Math.max(delta / CONFIG.ANGLE_RANGE, 0), 1);
    
    // 死区过滤微小抖动
    if (Math.abs(delta) < 5) progress = 0;

    // 记录运动数据
    state.motionData.push({
        rawAngle: event.beta,
        delta,
        progress,
        phase: state.currentPhase,
        timestamp: Date.now()
    });

    // 更新界面
    updateUI(progress);
    checkRepCompletion(progress);
}

// ====== UI更新 ======
function updateUI(progress) {
    state.currentProgress = progress;
    
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

function updateCounter() {
    elements.repCounter.textContent = `${state.repCount}/${CONFIG.TOTAL_REPS}`;
    elements.repCounter.style.color = state.repCount === CONFIG.TOTAL_REPS ? '#FF9800' : '#4CAF50';
}

// ====== 动作检测 ======
function checkRepCompletion(progress) {
    // 检测动作顶峰
    if (progress >= 0.95 && state.currentPhase === 'down') {
        state.currentPhase = 'up';
        triggerFeedback('peak');
    }
    // 检测回到起点
    else if (progress <= 0.05 && state.currentPhase === 'up') {
        completeRepetition();
    }
}

function completeRepetition() {
    const now = Date.now();
    if (now - state.lastVibrationTime < CONFIG.VIBRATION_COOLDOWN) return;
    
    state.repCount++;
    state.currentPhase = 'down';
    updateCounter();
    triggerFeedback('repComplete');
    
    if (state.repCount >= CONFIG.TOTAL_REPS) {
        finishTraining();
    }
    
    state.motionData = [];
    state.lastVibrationTime = now;
}

// ====== 反馈系统 ======
function triggerFeedback(type) {
    // 震动反馈
    const patterns = {
        repComplete: [100, 50, 100],
        peak: [200],
        trainingComplete: [300, 100, 300]
    };
    navigator.vibrate(patterns[type]);
    
    // 文字反馈
    const messages = {
        repComplete: `完成 ${state.repCount}/${CONFIG.TOTAL_REPS} 次`,
        peak: "顶峰收缩！保持1秒",
        trainingComplete: "训练完成！"
    };
    elements.feedback.textContent = messages[type];
}

// ====== 分析报告 ======
function showAnalysisReport() {
    const analysis = analyzePerformance();
    elements.analysisResult.innerHTML = `
        <div class="analysis-item ${analysis.isSmooth ? 'good' : 'bad'}">
            <strong>动作流畅度：</strong><br>
            ${analysis.isSmooth ? '✅ 非常稳定' : `⚠️ 波动较大 (${analysis.speedVariation})`}
        </div>
        <div class="analysis-item ${analysis.hasGoodEccentric ? 'good' : 'bad'}">
            <strong>离心控制：</strong><br>
            ${analysis.hasGoodEccentric ? `✅ 优秀 (${analysis.eccentricRatio}%时间)` : '⚠️ 放下太快'}
        </div>
        <div class="tips">
            <strong>建议：</strong><br>
            ${generateTips(analysis)}
        </div>
    `;
    elements.modal.style.display = 'block';
}

function hideModal() {
    elements.modal.style.display = 'none';
}

// ====== 分析算法 ======
function analyzePerformance() {
    if (state.motionData.length < 10) return {};
    
    // 速度分析
    const speeds = [];
    for (let i = 1; i < state.motionData.length; i++) {
        const delta = state.motionData[i].progress - state.motionData[i-1].progress;
        const time = state.motionData[i].timestamp - state.motionData[i-1].timestamp;
        speeds.push(Math.abs(delta / time));
    }
    const speedVariation = (Math.max(...speeds) - Math.min(...speeds)).toFixed(3);
    
    // 离心控制分析
    const downPhase = state.motionData.filter(d => d.phase === 'down');
    const downDuration = downPhase.length > 1 ? 
        downPhase[downPhase.length-1].timestamp - downPhase[0].timestamp : 0;
    const totalDuration = state.motionData[state.motionData.length-1].timestamp - 
                         state.motionData[0].timestamp;
    const eccentricRatio = Math.round((downDuration / totalDuration) * 100);
    
    return {
        isSmooth: parseFloat(speedVariation) < 0.15,
        hasGoodEccentric: eccentricRatio >= 40,
        speedVariation,
        eccentricRatio
    };
}

function generateTips(analysis) {
    const tips = [];
    if (!analysis.isSmooth) tips.push("• 保持匀速运动，避免突然加速");
    if (!analysis.hasGoodEccentric) tips.push("• 放下时默数3秒，控制离心阶段");
    return tips.length ? tips.join('<br>') : "🎉 动作完美！继续保持";
}