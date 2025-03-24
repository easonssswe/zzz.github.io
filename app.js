// 状态管理对象
const state = {
    isTraining: false,
    currentProgress: 0,
    currentPhase: 'down', // 'up'|'down'
    startTime: null,
    repCount: 0,
    motionData: []
};

// DOM元素
const elements = {
    ring: document.getElementById('progressRing'),
    arm: document.getElementById('arm'),
    feedback: document.getElementById('feedback'),
    counter: document.getElementById('counter'),
    resetBtn: document.getElementById('resetBtn')
};

// 初始化进度环
const ctx = elements.ring.getContext('2d');
ctx.lineWidth = 8;
ctx.strokeStyle = '#4CAF50';

// 重置训练
function resetTraining() {
    state.repCount = 0;
    state.currentProgress = 0;
    state.motionData = [];
    elements.counter.textContent = '0/3';
    elements.feedback.textContent = '';
    drawProgress(0);
    updateArmPosition(0);
}

// 绘制进度环
function drawProgress(percentage) {
    ctx.clearRect(0, 0, 200, 200);
    ctx.beginPath();
    ctx.arc(100, 100, 90, -Math.PI/2, (Math.PI*2)*percentage - Math.PI/2);
    ctx.stroke();
}

// 更新手臂动画
function updateArmPosition(progress) {
    const angle = progress * 180; // 0-180度弯曲
    elements.arm.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}

// 动作分析
function analyzeMotion() {
    const duration = (Date.now() - state.startTime) / 1000;
    const speeds = [];
    
    // 计算速度变化
    for(let i=1; i<state.motionData.length; i++) {
        const delta = state.motionData[i].progress - state.motionData[i-1].progress;
        const timeDelta = state.motionData[i].timestamp - state.motionData[i-1].timestamp;
        speeds.push(delta / timeDelta);
    }

    // 分析结果
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);
    const isSmooth = (maxSpeed - minSpeed) < 0.2;
    const hasEccentric = duration > 2; // 离心阶段至少2秒

    return {
        isSmooth,
        hasEccentric,
        duration
    };
}

// 传感器处理
function handleOrientation(event) {
    if(!state.isTraining) return;

    // 横握手机时使用 beta 值（前后倾斜）
    const beta = event.beta; // -180到180
    const progress = Math.min(Math.max((beta + 90) / 180, 0), 1); // 转换为0-1
    
    // 记录运动数据
    state.motionData.push({
        progress,
        timestamp: Date.now()
    });

    // 更新界面
    drawProgress(progress);
    updateArmPosition(progress);

    // 完成检测
    if(progress >= 0.95 && state.currentPhase === 'down') {
        state.currentPhase = 'up';
        navigator.vibrate(200); // 震动反馈
        elements.feedback.textContent = '顶峰收缩！保持1秒';
    } else if(progress <= 0.1 && state.currentPhase === 'up') {
        state.repCount++;
        state.currentPhase = 'down';
        const analysis = analyzeMotion();
        
        // 显示反馈
        elements.feedback.innerHTML = `
            ${analysis.isSmooth ? '✅ 动作匀速' : '⚠️ 速度不稳定'} <br>
            ${analysis.hasEccentric ? '✅ 离心控制良好' : '⚠️ 离心阶段太快'} <br>
            用时：${analysis.duration.toFixed(1)}秒
        `;
        
        elements.counter.textContent = `${state.repCount}/3`;
        navigator.vibrate([100, 50, 100]); // 震动模式
        
        if(state.repCount >= 3) {
            state.isTraining = false;
            elements.feedback.innerHTML += '<br>🎉 训练完成！';
        }
        
        // 重置数据
        state.motionData = [];
        state.startTime = Date.now();
    }
}

// 权限请求
async function startTraining() {
    if(typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if(permission !== 'granted') return;
    }
    
    state.isTraining = true;
    state.startTime = Date.now();
    window.addEventListener('deviceorientation', handleOrientation);
}

// 事件绑定
elements.resetBtn.addEventListener('click', resetTraining);
document.body.addEventListener('click', startTraining); // 首次点击开始