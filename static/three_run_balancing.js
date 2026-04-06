/**
 * Optimized Three Run Balancing Calculator
 */
'use strict';

class ThreeRunBalancing {
    async calculateFromAmplitudes(V0, V1, V2, V3, P) {
        const response = await fetch('/api/balancing/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ V0, V1, V2, V3, P })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Ошибка расчета');
        return data.result;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const balancer = new ThreeRunBalancing();
    const els = {
        V0: document.getElementById('V0'), V1: document.getElementById('V1'),
        V2: document.getElementById('V2'), V3: document.getElementById('V3'),
        P: document.getElementById('P'), calculateBtn: document.getElementById('calculateBtn'),
        resetBtn: document.getElementById('resetBtn'), resultsSection: document.getElementById('resultsSection'),
        statusMessage: document.getElementById('statusMessage')
    };

    const validateInputs = () => {
        const errors = [];
        const check = (val, msg) => { if (isNaN(val) || val <= 0) errors.push(msg); };
        check(parseFloat(els.V0.value), 'Исходная вибрация V₀ должна быть положительным числом');
        check(parseFloat(els.V1.value), 'Вибрация V₁ должна быть положительным числом');
        check(parseFloat(els.V2.value), 'Вибрация V₂ должна быть положительным числом');
        check(parseFloat(els.V3.value), 'Вибрация V₃ должна быть положительным числом');
        check(parseFloat(els.P.value), 'Масса пробного груза должна быть положительным числом');
        return { valid: !errors.length, errors };
    };

    const showStatus = (msg, type = 'info') => {
        els.statusMessage.textContent = msg;
        els.statusMessage.className = `status-message ${type}`;
        els.statusMessage.style.display = 'block';
        if (type !== 'info') setTimeout(() => { els.statusMessage.style.display = 'none'; }, 5000);
    };

    const saveToHistory = (calc) => {
        try {
            let history = Utils.storage.get('three_run_balancing_history', []);
            history.unshift(calc);
            Utils.storage.set('three_run_balancing_history', history.slice(0, 50));
        } catch (e) { console.error('Ошибка сохранения истории:', e); }
    };

    const calculateAndDisplay = async () => {
        const validation = validateInputs();
        if (!validation.valid) { showStatus(`❌ ${validation.errors.join(', ')}`, 'error'); return; }

        const V0 = parseFloat(els.V0.value), V1 = parseFloat(els.V1.value);
        const V2 = parseFloat(els.V2.value), V3 = parseFloat(els.V3.value);
        const P = parseFloat(els.P.value);

        els.calculateBtn.disabled = true;
        els.calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromAmplitudes(V0, V1, V2, V3, P);
            const roundedMass = Math.round(result.correction_mass * 10) / 10;
            const roundedAngle = Math.round(result.correction_angle);

            document.getElementById('correctionMass').textContent = `${roundedMass} г`;
            document.getElementById('correctionAngle').textContent = `${roundedAngle}°`;
            document.getElementById('instrMass').textContent = `${roundedMass} г`;
            document.getElementById('instrAngle').textContent = `${roundedAngle}°`;

            els.resultsSection.style.display = 'block';
            els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showStatus('✅ Расчет выполнен успешно!', 'success');

            saveToHistory({ timestamp: new Date().toISOString(), V0, V1, V2, V3, P, result: { correction_mass: roundedMass, correction_angle: roundedAngle } });
        } catch (error) {
            console.error('Ошибка расчета:', error);
            showStatus(`❌ Ошибка расчета: ${error.message}`, 'error');
        } finally {
            els.calculateBtn.disabled = false;
            els.calculateBtn.textContent = '🎯 Рассчитать корректирующий груз';
        }
    };

    els.calculateBtn.addEventListener('click', calculateAndDisplay);
    els.resetBtn.addEventListener('click', () => {
        els.V0.value = ''; els.V1.value = ''; els.V2.value = ''; els.V3.value = ''; els.P.value = '';
        els.resultsSection.style.display = 'none';
        showStatus('🔄 Форма очищена', 'info');
        setTimeout(() => { els.statusMessage.style.display = 'none'; }, 2000);
    });

    // Load last calculation
    const last = Utils.storage.get('three_run_balancing_history', [])?.[0];
    if (last) { els.V0.value = last.V0 || ''; els.V1.value = last.V1 || ''; els.V2.value = last.V2 || ''; els.V3.value = last.V3 || ''; els.P.value = last.P || ''; }

    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); calculateAndDisplay(); } });
});
