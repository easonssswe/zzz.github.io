// app.js
class BicepTrainer {
    constructor() {
        this.state = {
            isTraining: false,
            baseGamma: null,
            currentRep: 0,
            isPeak: false,
            motionData: [],
            startTime: null
        };

        this.elements = {
            initModal: document.getElementById('initModal'),
            startBtn: document.getElementById('startBtn'),
            container: document.querySelector('.container'),
            resetBtn: document.getElementById('resetBtn'),
            calibrateBtn: document.getElementById('calibrateBtn'),
            repCounter: document.getElementById('repCounter'),
            ctx: document.getElementById('progressRing').getContext('2d'),
            percentage: document.getElementById('percentage'),
            arm: document.getElementById('arm'),
            feedback: document.getElementById('feedback'),
            resultModal: document.getElementById('resultModal'),
            analysisResult: document.getElementById('analysisResult'),
            restartBtn: document.getElementById('restartBtn')
        };

        this.CONFIG = {
            TOTAL_REPS: 3,
            ANGLE_RANGE: 80,
            VIBRATION: {
                REP: [100, 50, 100],
                PEAK: 200,
                FINISH: [300, 100, 300]
            },
            COOLDOWN: 1000
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initProgressRing();
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startApp());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        this.elements.calibrateBtn.addEventListener('click', () => this.calibrate());
        this.elements.restartBtn.addEventListener('click', () => this.restart());
    }

    async startApp() {
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') return;
            }
            
            this.elements.initModal.classList.remove('active');
            this.elements.container.style.display = 'block';
            this.showFeedback("请将手机平放后点击校准");
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
        this.state.startTime = Date.now();
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
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
        if (Date.now() - this.state.lastVibration < this.CONFIG.COOLDOWN) return;
        
        this.state.isPeak = false;
        this.state.currentRep++;
        this.elements.repCounter.textContent = `${this.state.currentRep}/${this.CONFIG.TOTAL_REPS}`;
        
        if (this.state.currentRep >= this.CONFIG.TOTAL_REPS) {
            this.finishTraining();
        } else {
            this.vibrate(this.CONFIG.VIBRATION.REP);
            this.showFeedback(`完成 ${this.state.currentRep}/${this.CONFIG.TOTAL_REPS} 次`);
        }
        
        this.state.lastVibration = Date.now();
    }

    finishTraining() {
        this.state.isTraining = false;
        this.showReport();
        this.vibrate(this.CONFIG.VIBRATION.FINISH);
        window.removeEventListener('deviceorientation', this.handleOrientation);
    }

    showReport() {
        const duration = ((Date.now() - this.state.startTime) / 1000).toFixed(1);
        const analysis = this.analyzePerformance();
        
        this.elements.analysisResult.innerHTML = `
            <div class="report-item">
                <h3>🏆 训练完成</h3>
                <p>总用时: ${duration}秒</p>
            </div>
            <div class="report-item">
                <h3>📈 动作分析</h3>
                <p>平均速度: ${analysis.avgSpeed}°/s</p>
                <p>离心时间: ${analysis.eccentricTime}s</p>
                <p>动作幅度: ${analysis.range}%</p>
            </div>
            <div class="tips">
                <h3>💡 改进建议</h3>
                ${analysis.tips}
            </div>
        `;
        this.elements.resultModal.style.display = 'block';
    }

    analyzePerformance() {
        // 示例分析数据（实际应基于motionData计算）
        return {
            avgSpeed: "45.6",
            eccentricTime: "2.3",
            range: "92",
            tips: "保持匀速，注意离心阶段的控制"
        };
    }

    reset() {
        this.state = {
            isTraining: false,
            baseGamma: null,
            currentRep: 0,
            isPeak: false,
            motionData: [],
            startTime: null
        };
        this.updateUI(0);
        this.elements.repCounter.textContent = "0/3";
        this.showFeedback("已重置训练数据");
    }

    restart() {
        this.reset();
        this.elements.resultModal.style.display = 'none';
        this.elements.container.style.display = 'none';
        this.elements.initModal.classList.add('active');
    }

    vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    showFeedback(text) {
        this.elements.feedback.textContent = text;
    }

    recordMotionData(gamma, progress) {
        this.state.motionData.push({
            timestamp: Date.now(),
            gamma,
            progress
        });
    }

    initProgressRing() {
        this.elements.ctx.lineWidth = 10;
        this.elements.ctx.strokeStyle = '#4CAF50';
        this.elements.ctx.lineCap = 'round';
    }
}

new BicepTrainer();