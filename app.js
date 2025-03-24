// ========== 状态管理 ==========
const state = {
    isTraining: false,
    currentProgress: 0,
    currentPhase: 'down', // 'up'|'down'
    repCount: 0,
    motionData: []
};

// ========== DOM元素 ==========
const elements = {
    ring: document.getElementById('progressRing'),
    ctx: document.getElementById('progressRing').getContext('2d'),
    arm: document.getElementById('arm'),
    feedback: document.getElementById('feedback'),
    repCounter: document.getElementById('repCounter'),
    percentage: document.getElementById('percentage'),
    resetBtn: document.getElementById('resetBtn'),
    modal: document.getElementById('resultModal'),
    analysisResult: document.getElementById('analysisResult')
};

// ========== 配置参数 ==========
const CONFIG = {
    START_ANGLE: 30,    // 起始角度阈值
    END_ANGLE: 150,     // 结束角度阈值
    TOTAL_REPS: 3       // 总训练次数
};

// ========== 初始化 ==========
function init() {
    // 设置进度环样式
    elements.ctx.lineWidth = 10;
    elements.ctx.strokeStyle = '#4CAF50';
    elements.ctx.lineCap = 'round';
    
    // 事件监听
    elements.resetBtn.addEventListener('click', resetTraining);
    document.getElementById('closeModal').addEventListener('click', () => {
        elements.modal.style.display = 'none';
    });
    
    // 首次点击开始训练
    document.body.addEventListener('click', startTraining, { once: true });
    elements.feedback.textContent = "点击屏幕开始训练";
}
init();

// ========== 核心功能 ==========
function startTraining() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permission => {
                if (permission === 'granted') {
                    activateSensor();
                } else {
                    elements.feedback.textContent = "需要传感器权限才能训练";
                }
            });
    } else {
        activateSensor();
    }
}

function activateSensor() {
    state.isTraining = true;
    window.addEventListener('deviceorientation', handleOrientation);
    elements.feedback.textContent = "缓慢完成弯举动作";
}

function handleOrientation(event) {
    if (!state.isTraining) return;

    const beta = event.beta; // 前后倾斜角度（横屏时）
    let progress = calculateProgress(beta);
    
    // 记录运动数据
    state.motionData.push({
        beta,
        progress,
        phase: state.currentPhase,
        timestamp: Date.now()
    });

    // 更新界面
    updateUI(progress);
    checkRepCompletion(progress);
}

function calculateProgress(beta) {
    // 标准化进度计算 (0-1)
    if (beta < CONFIG.START_ANGLE) return 0;
    if (beta > CONFIG.END_ANGLE) return 1;
    return (beta - CONFIG.START_ANGLE) / (CONFIG.END_ANGLE - CONFIG.START_ANGLE);
}

function updateUI(progress) {
    // 更新进度环
    elements.ctx.clearRect(0, 0, 200, 200);
    elements.ctx.beginPath();
    elements.ctx.arc(100, 100, 90, -Math.PI/2, (Math.PI*2)*progress - Math.PI/2);
    elements.ctx.stroke();
    
    // 更新百分比
    elements.percentage.textContent = `${Math.round(progress * 100)}%`;
    
    // 更新手臂位置
    elements.arm.style.transform = `rotate(${progress * 180}deg)`;
}

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
    state.repCount++;
    state.currentPhase = 'down';
    updateCounter();
    triggerFeedback('repComplete');
    
    // 检查是否完成所有次数
    if (state.repCount >= CONFIG.TOTAL_REPS) {
        finishTraining();
    }
    
    // 重置当前动作数据
    state.motionData = [];
}

function updateCounter() {
    elements.repCounter.textContent = `${state.repCount}/${CONFIG.TOTAL_REPS}`;
    elements.repCounter.style.color = state.repCount === CONFIG.TOTAL_REPS ? '#FF9800' : '#4CAF50';
}

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

// ========== 分析报告 ==========
function showAnalysisReport() {
    const analysis = analyzePerformance();
    elements.analysisResult.innerHTML = generateReportHTML(analysis);
    elements.modal.style.display = 'block';
}

function analyzePerformance() {
    if (state.motionData.length < 10) return {};
    
    // 1. 计算速度一致性
    const speeds = [];
    for (let i = 1; i < state.motionData.length; i++) {
        const deltaP = state.motionData[i].progress - state.motionData[i-1].progress;
        const deltaT = state.motionData[i].timestamp - state.motionData[i-1].timestamp;
        speeds.push(Math.abs(deltaP / deltaT));
    }
    const speedVariation = Math.max(...speeds) - Math.min(...speeds);
    
    // 2. 离心控制分析
    const downPhase = state.motionData.filter(d => d.phase === 'down');
    const downDuration = downPhase.length > 1 ? 
        downPhase[downPhase.length-1].timestamp - downPhase[0].timestamp : 0;
    const totalDuration = state.motionData[state.motionData.length-1].timestamp - 
                         state.motionData[0].timestamp;
    const eccentricRatio = downDuration / totalDuration;
    
    // 3. 动作幅度分析
    const minBeta = Math.min(...state.motionData.map(d => d.beta));
    const maxBeta = Math.max(...state.motionData.map(d => d.beta));
    const rangeRatio = (maxBeta - minBeta) / (CONFIG.END_ANGLE - CONFIG.START_ANGLE);
    
    return {
        isSmooth: speedVariation < 0.15,
        hasGoodEccentric: eccentricRatio > 0.4,
        isFullRange: rangeRatio > 0.85,
        speedVariation: speedVariation.toFixed(3),
        eccentricRatio: (eccentricRatio * 100).toFixed(0),
        rangeRatio: (rangeRatio * 100).toFixed(0)
    };
}

function generateReportHTML(analysis) {
    let html = `
        <div class="analysis-item ${analysis.isSmooth ? 'good' : 'bad'}">
            <strong>动作流畅度：</strong><br>
            ${analysis.isSmooth ? '✅ 非常稳定' : 
              `⚠️ 波动较大 (变化值: ${analysis.speedVariation})`}
        </div>
        
        <div class="analysis-item ${analysis.hasGoodEccentric ? 'good' : 'bad'}">
            <strong>离心控制：</strong><br>
            ${analysis.hasGoodEccentric ? 
              `✅ 优秀控制 (${analysis.eccentricRatio}%时间用于放下)` : 
              '⚠️ 放下太快'}
        </div>
        
        <div class="analysis-item ${analysis.isFullRange ? 'good' : 'bad'}">
            <strong>动作幅度：</strong><br>
            ${analysis.isFullRange ? 
              '✅ 完整范围' : 
              `⚠️ 只完成${analysis.rangeRatio}%范围`}
        </div>
        
        <div class="tips">
            <strong>训练建议：</strong><br>
            ${generateTrainingTips(analysis)}
        </div>
    `;
    return html;
}

function generateTrainingTips(analysis) {
    const tips = [];
    
    if (!analysis.isSmooth) {
        tips.push("• 尝试用2秒举起，2秒放下的节奏");
    }
    
    if (!analysis.hasGoodEccentric) {
        tips.push("• 重点控制放下阶段，想象在抵抗重力");
    }
    
    if (!analysis.isFullRange) {
        tips.push("• 确保手臂完全伸展后再开始下一次动作");
    }
    
    if (tips.length === 0) {
        tips.push("• 完美表现！继续保持！");
    }
    
    return tips.join('<br>');
}

// ========== 重置功能 ==========
function resetTraining() {
    // 重置状态
    state.isTraining = false;
    state.repCount = 0;
    state.currentPhase = 'down';
    state.motionData = [];
    
    // 重置UI
    updateCounter();
    updateUI(0);
    elements.feedback.textContent = "点击屏幕重新开始";
    elements.modal.style.display = 'none';
    
    // 重新启用首次点击监听
    document.body.addEventListener('click', startTraining, { once: true });
}