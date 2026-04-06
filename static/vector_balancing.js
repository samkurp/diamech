/**
 * Optimized Vector Balancing Calculator
 */
'use strict';

class VectorBalancing {
    constructor() { this.apiEndpoint = '/api/balancing/vector'; }

    async calculateFromMeasurements(V0, phi0, Vt, phi_t, P) {
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ V0, phi0, Vt, phi_t, P })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Ошибка расчета');
        return data.result;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const balancer = new VectorBalancing();
    const els = {
        V0: document.getElementById('V0'), phi0: document.getElementById('phi0'),
        Vt: document.getElementById('Vt'), phi_t: document.getElementById('phi_t'),
        P: document.getElementById('P'), calculateBtn: document.getElementById('calculateBtn'),
        resetBtn: document.getElementById('resetBtn'), resultsSection: document.getElementById('resultsSection'),
        statusMessage: document.getElementById('statusMessage')
    };

    const validateInputs = () => {
        const errors = [];
        const check = (val, msg) => { if (isNaN(val) || val <= 0) errors.push(msg); };
        check(parseFloat(els.V0.value), 'Исходная амплитуда V₀ должна быть положительным числом');
        check(parseFloat(els.phi0.value), 'Исходная фаза φ₀ должна быть числом');
        check(parseFloat(els.Vt.value), 'Амплитуда с пробным грузом Vₜ должна быть положительным числом');
        check(parseFloat(els.phi_t.value), 'Фаза с пробным грузом φₜ должна быть числом');
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
            let history = Utils.storage.get('vector_balancing_history', []);
            history.unshift(calc);
            Utils.storage.set('vector_balancing_history', history.slice(0, 50));
        } catch (e) { console.error('Ошибка сохранения истории:', e); }
    };

    const calculateAndDisplay = async () => {
        const validation = validateInputs();
        if (!validation.valid) { showStatus(`❌ ${validation.errors.join(', ')}`, 'error'); return; }

        const V0 = parseFloat(els.V0.value), phi0 = parseFloat(els.phi0.value);
        const Vt = parseFloat(els.Vt.value), phi_t = parseFloat(els.phi_t.value);
        const P = parseFloat(els.P.value);

        els.calculateBtn.disabled = true;
        els.calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromMeasurements(V0, phi0, Vt, phi_t, P);
            const roundedMass = Math.round(result.correction_mass * 10) / 10;
            const roundedAngle = Math.round(result.correction_angle);

            document.getElementById('correctionMass').textContent = `${roundedMass} г`;
            document.getElementById('correctionAngle').textContent = `${roundedAngle}°`;
            document.getElementById('instrMass').textContent = `${roundedMass} г`;
            document.getElementById('instrAngle').textContent = `${roundedAngle}°`;

            els.resultsSection.style.display = 'block';
            els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            showStatus('✅ Расчет выполнен успешно!', 'success');

            saveToHistory({ timestamp: new Date().toISOString(), method: 'vector', V0, phi0, Vt, phi_t, P, result: { correction_mass: roundedMass, correction_angle: roundedAngle } });
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
        els.V0.value = ''; els.phi0.value = ''; els.Vt.value = ''; els.phi_t.value = ''; els.P.value = '';
        els.resultsSection.style.display = 'none';
        showStatus('🔄 Форма очищена', 'info');
        setTimeout(() => { els.statusMessage.style.display = 'none'; }, 2000);
    });

    // Load last calculation
    const last = Utils.storage.get('vector_balancing_history', [])?.find(c => c.method === 'vector');
    if (last) { els.V0.value = last.V0 || ''; els.phi0.value = last.phi0 || ''; els.Vt.value = last.Vt || ''; els.phi_t.value = last.phi_t || ''; els.P.value = last.P || ''; }

    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); calculateAndDisplay(); } });
});
