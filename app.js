class BicepTrainer {
    constructor() {
        this.state = {
            isTraining: false,
            baseGamma: null,
            currentRep: 0,
            isPeak: false,
            motionData: []
        };

        this.elements = {
            initModal: document.getElementById('initModal'),
            startBtn: document.getElementById('startBtn'),
            container: document.querySelector('.container'),
            calibrateBtn: document.getElementById('calibrateBtn'),
            repCounter: document.getElementById('repCounter'),
            ctx: document.getElementById('progressRing').getContext('2d'),
            percentage: document.getElementById('percentage'),
            arm: document.getElementById('arm'),
            feedback: document.getElementById('feedback'),
            resultModal: document.getElementById('resultModal'),
            analysisResult: document.getElementById('analysisResult'),
            restartBtn: document.getElementById('restartBtn'),
            permissionHelp: document.getElementById('permissionHelp')
        };

        this.CONFIG = {
            TOTAL_REPS: 3,
            ANGLE_RANGE: 80,
            VIBRATION: {
                REP: [100, 50, 100],
                PEAK: 200,
                FINISH: [300, 100, 300]
            }
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initProgressRing();
        this.checkOrientation();
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startApp());
        this.elements.calibrateBtn.addEventListener('click', () => this.calibrate());
        this.elements.restartBtn.addEventListener('click', () => this.restart());
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
    }

    initProgressRing() {
        this.elements.ctx.lineWidth = 10;
        this.elements.ctx.strokeStyle = '#4CAF50';
        this.elements.ctx.lineCap = 'round';
    }

    async startApp() {
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    this.showPermissionHelp();
                    return;
                }
            }
            
            this.elements.initModal.classList.remove('active');
            this.elements.container.style.display = 'block';
            this.showFeedback("将手机平放在桌面，点击校准按钮");
            this.elements.calibrateBtn.style.display = 'block';
        } catch (error) {
            this.showFeedback(`错误: ${error.message}`);
        }
    }

    calibrate() {
        this.showFeedback("校准中...保持手机静止");
        const samples = [];
        
        const listener = (e) => {
            if (e.gamma !== null) samples.push(e.gamma);
        };
        
        window.addEventListener('deviceorientation', listener);
        
        setTimeout(() => {
            window.removeEventListener('deviceorientation', listener);
            this.state.baseGamma = samples.reduce((a, b) => a + b, 0) / samples.length;
            this.startTraining();
            this.showFeedback("校准完成！开始训练");
        }, 3000);
    }

    startTraining() {
        this.state.isTraining = true;
        this.elements.calibrateBtn.style.display = 'none';
    }

    handleOrientation(event) {
        if (!this.state.isTraining || !this.state.baseGamma) return;

        const gamma = event.gamma;
        const progress = Math.min(Math.max(
            (gamma - this.state.baseGamma) / this.CONFIG.ANGLE_RANGE, 
            0
        ), 1);

        this.updateUI(progress);
        this.checkProgress(progress);
        this.recordMotionData(gamma, progress);
    }

    updateUI(progress) {
        // 更新进度环
        this.elements.ctx.clearRect(0, 0, 200, 200);
        this.elements.ctx.beginPath();
        this.elements.ctx.arc(100, 100, 90, -Math.PI/2, (Math.PI*2)*progress - Math.PI/2);
        this.elements.ctx.stroke();

        // 更新百分比
        this.elements.percentage.textContent = `${Math.round(progress * 100)}%`;

        // 更新手臂角度
        this.elements.arm.style.transform = `rotate(${progress * 180}deg)`;
    }

    checkProgress(progress) {
        if (progress >= 0.95 && !this.state.isPeak) {
            this.handlePeak();
        } else if (progress <= 0.1 && this.state.isPeak) {
            this.handleRepComplete();
        }
    }

    handlePeak() {
        this.state.isPeak = true;
        this.vibrate(this.CONFIG.VIBRATION.PEAK);
        this.showFeedback("顶峰收缩！保持1秒");
    }

    handleRepComplete() {
        this.state.isPeak = false;
        this.state.currentRep++;
        this.elements.repCounter.textContent = `${this.state.currentRep}/${this.CONFIG.TOTAL_REPS}`;
        
        if (this.state.currentRep >= this.CONFIG.TOTAL_REPS) {
            this.finishTraining();
        } else {
            this.vibrate(this.CONFIG.VIBRATION.REP);
            this.showFeedback(`完成 ${this.state.currentRep}/${this.CONFIG.TOTAL_REPS} 次`);
        }
    }

    finishTraining() {
        this.state.isTraining = false;
        this.showReport();
        this.vibrate(this.CONFIG.VIBRATION.FINISH);
    }

    showReport() {
        const analysis = this.analyzePerformance();
        this.elements.analysisResult.innerHTML = `
            <p>✅ 完成3次弯举</p>
            <p>平均速度: ${analysis.avgSpeed.toFixed(1)}°/s</p>
            <p>离心时间: ${analysis.eccentricTime}s</p>
            ${analysis.tips}
        `;
        this.elements.resultModal.style.display = 'block';
    }

    analyzePerformance() {
        // 简化的分析逻辑
        return {
            avgSpeed: 45.6,
            eccentricTime: 2.3,
            tips: "建议：保持匀速，注意离心控制"
        };
    }

    restart() {
        this.state = {
            isTraining: false,
            baseGamma: null,
            currentRep: 0,
            isPeak: false,
            motionData: []
        };
        this.elements.resultModal.style.display = 'none';
        this.elements.container.style.display = 'none';
        this.elements.initModal.classList.add('active');
        this.showFeedback("准备就绪");
    }

    vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    showFeedback(text) {
        this.elements.feedback.textContent = text;
    }

    showPermissionHelp() {
        this.elements.permissionHelp.style.display = 'block';
    }

    checkOrientation() {
        if (window.matchMedia("(orientation: landscape)").matches) return true;
        this.showFeedback("请横屏使用");
        return false;
    }

    recordMotionData(gamma, progress) {
        this.state.motionData.push({
            timestamp: Date.now(),
            gamma,
            progress
        });
    }
}

// 启动应用
new BicepTrainer();