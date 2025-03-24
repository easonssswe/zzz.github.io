// ====== 状态管理 ======
const state = {
    isTraining: false,
    currentProgress: 0,
    currentPhase: 'down',
    repCount: 0,
    motionData: [],
    lastVibrationTime: 0
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
    modal: document.getElementById('resultModal'),
    analysisResult: document.getElementById('analysisResult'),
    orientationAlert: document.getElementById('orientationAlert')
};

// ====== 配置参数 ======
const CONFIG = {
    PORTRAIT: {
        start: 30,   // 竖屏起始角度
        end: 150     // 竖屏结束角度
    },
    LANDSCAPE: {
        start: -60,  // 横屏起始角度
        end: 60      // 横屏结束角度
    },
    TOTAL_REPS: 3,
    VIBRATION_COOLDOWN: 500 // 防抖时间(ms)
};

// ====== 初始化 ======
function init() {
    // 进度环样式
    elements.ctx.lineWidth = 10;
    elements.ctx.strokeStyle = '#4CAF50';
    elements.ctx.lineCap = 'round';
    
    // 事件监听
    elements.resetBtn.addEventListener('click', resetTraining);
    document.getElementById('closeModal').addEventListener('click', hideModal);
    window.addEventListener('resize', checkOrientation);
    
    // 首次点击开始
    document.body.addEventListener('click', startTraining, { once: true });
    elements.feedback.textContent = "点击屏幕开始训练";
    
    checkOrientation();
}
init();

// ====== 方向检测 ======
function checkOrientation() {
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    elements.orientationAlert.style.display = isLandscape ? 'none' : 'flex';
    return isLandscape;
}

// ====== 训练控制 ======
async function startTraining() {
    if (!checkOrientation()) {
        elements.feedback.textContent = "请横屏握持手机";
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
    elements.feedback.textContent = "点击屏幕重新开始";
    hideModal();
    
    document.body.addEventListener('click', startTraining, { once: true });
}

// ====== 传感器处理 ======
function handleOrientation(event) {
    if (!state.isTraining) return;

    const now = Date.now();
    const rawValue = checkOrientation() ? event.gamma : event.beta;
    const config = checkOrientation() ? CONFIG.LANDSCAPE : CONFIG.PORTRAIT;
    
    // 计算标准化进度 (0-1)
    let progress = (rawValue - config.start) / (config.end - config.start);
    progress = Math.min(Math.max(progress, 0), 1);

    // 记录运动数据
    if (now - (state.motionData[state.motionData.length-1]?.timestamp || 0) > 50) {
        state.motionData.push({
            rawValue,
            progress,
            phase: state.currentPhase,
            timestamp: now
        });
    }

    // 更新界面
    updateUI(progress);
    checkRepCompletion(progress);
}

// ====== UI更新 ======
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

function finishTraining() {
    state.isTraining = false;
    window.removeEventListener('deviceorientation', handleOrientation);
    showAnalysisReport();
    triggerFeedback('trainingComplete');
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
        <div class="analysis-item ${analysis.isFullRange ? 'good' : 'bad'}">
            <strong>动作幅度：</strong><br>
            ${analysis.isFullRange ? '✅ 完整' : `⚠️ 仅完成${analysis.rangeRatio}%`}
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

function analyzePerformance() {
    if (state.motionData.length < 5) return {};
    
    // 1. 速度分析
    const speeds = [];
    for (let i = 1; i < state.motionData.length; i++) {
        const delta = state.motionData[i].progress - state.motionData[i-1].progress;
        const time = state.motionData[i].timestamp - state.motionData[i-1].timestamp;
        speeds.push(Math.abs(delta / time));
    }
    const speedVariation = (Math.max(...speeds) - Math.min(...speeds)).toFixed(3);
    
    // 2. 离心控制
    const downPhase = state.motionData.filter(d => d.phase === 'down');
    const downDuration = downPhase.length > 1 ? 
        downPhase[downPhase.length-1].timestamp - downPhase[0].timestamp : 0;
    const totalDuration = state.motionData[state.motionData.length-1].timestamp - 
                         state.motionData[0].timestamp;
    const eccentricRatio = Math.round((downDuration / totalDuration) * 100);
    
    // 3. 动作幅度
    const min = Math.min(...state.motionData.map(d => d.rawValue));
    const max = Math.max(...state.motionData.map(d => d.rawValue));
    const config = checkOrientation() ? CONFIG.LANDSCAPE : CONFIG.PORTRAIT;
    const rangeRatio = Math.round(((max - min) / (config.end - config.start)) * 100);
    
    return {
        isSmooth: parseFloat(speedVariation) < 0.15,
        hasGoodEccentric: eccentricRatio >= 40,
        isFullRange: rangeRatio >= 85,
        speedVariation,
        eccentricRatio,
        rangeRatio
    };
}

function generateTips(analysis) {
    const tips = [];
    if (!analysis.isSmooth) tips.push("• 尝试2秒上举+2秒放下的节奏");
    if (!analysis.hasGoodEccentric) tips.push("• 离心阶段至少持续3秒");
    if (!analysis.isFullRange) tips.push("• 确保手臂完全伸展");
    return tips.length ? tips.join('<br>') : "🎉 完美表现！";
}

// ====== 横屏检测 ======
window.addEventListener('orientationchange', () => {
    if (!checkOrientation() && state.isTraining) {
        elements.feedback.textContent = "请保持横屏姿势";
    }
});