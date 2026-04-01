// Класс для векторного метода балансировки
class VectorBalancing {
    constructor() {
        this.apiEndpoint = '/api/balancing/vector';
    }

    async calculateFromMeasurements(V0, phi0, Vt, phi_t, P) {
        console.log('Векторный метод балансировки:', { V0, phi0, Vt, phi_t, P });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ V0, phi0, Vt, phi_t, P })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Ошибка расчета');
            }

            return data.result;

        } catch (error) {
            console.error('Ошибка API расчета:', error);
            throw error;
        }
    }

    async monteCarloSimulation(V0, phi0, Vt, phi_t, P, ampUncertainty, phaseUncertainty, nSimulations = 1000) {
        console.log('Монте-Карло анализ:', { V0, phi0, Vt, phi_t, P, ampUncertainty, phaseUncertainty, nSimulations });

        // Имитация Монте-Карло на клиенте
        const masses = [];
        const angles = [];

        for (let i = 0; i < nSimulations; i++) {
            // Добавляем случайный шум
            const V0_noise = Math.max(0.01, V0 + (Math.random() - 0.5) * 2 * ampUncertainty);
            const Vt_noise = Math.max(0.01, Vt + (Math.random() - 0.5) * 2 * ampUncertainty);
            const phi0_noise = phi0 + (Math.random() - 0.5) * 2 * phaseUncertainty;
            const phi_t_noise = phi_t + (Math.random() - 0.5) * 2 * phaseUncertainty;

            try {
                const result = await this.calculateFromMeasurements(V0_noise, phi0_noise, Vt_noise, phi_t_noise, P);
                masses.push(result.correction_mass);
                angles.push(result.correction_angle);
            } catch (e) {
                continue;
            }
        }

        if (masses.length === 0) {
            throw new Error('Не удалось выполнить симуляции');
        }

        // Статистический анализ
        const massMean = this.mean(masses);
        const massStd = this.std(masses, massMean);
        const angleMean = this.mean(angles);
        const angleStd = this.std(angles, angleMean);

        // Доверительные интервалы 95%
        const massCI95 = [massMean - 1.96 * massStd, massMean + 1.96 * massStd];
        const angleCI95 = [angleMean - 1.96 * angleStd, angleMean + 1.96 * angleStd];

        return {
            mass: {
                mean: massMean,
                std: massStd,
                ci_95: massCI95,
                min: Math.min(...masses),
                max: Math.max(...masses)
            },
            angle: {
                mean: angleMean,
                std: angleStd,
                ci_95: angleCI95,
                min: Math.min(...angles),
                max: Math.max(...angles)
            },
            n_simulations: masses.length
        };
    }

    mean(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    std(arr, mean) {
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    const balancer = new VectorBalancing();

    // DOM элементы
    const V0Input = document.getElementById('V0');
    const phi0Input = document.getElementById('phi0');
    const VtInput = document.getElementById('Vt');
    const phi_tInput = document.getElementById('phi_t');
    const PInput = document.getElementById('P');
    const ampUncertaintyInput = document.getElementById('ampUncertainty');
    const phaseUncertaintyInput = document.getElementById('phaseUncertainty');
    const calculateBtn = document.getElementById('calculateBtn');
    const monteCarloBtn = document.getElementById('monteCarloBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultsSection = document.getElementById('resultsSection');
    const monteCarloSection = document.getElementById('monteCarloSection');
    const statusMessage = document.getElementById('statusMessage');

    // Функция округления массы до десятых
    function roundMass(value) {
        return Math.round(value * 10) / 10;
    }

    // Функция округления угла до целых
    function roundAngle(value) {
        return Math.round(value);
    }

    // Проверка валидности ввода
    function validateInputs() {
        const V0 = parseFloat(V0Input.value);
        const phi0 = parseFloat(phi0Input.value);
        const Vt = parseFloat(VtInput.value);
        const phi_t = parseFloat(phi_tInput.value);
        const P = parseFloat(PInput.value);

        const errors = [];

        if (isNaN(V0) || V0 <= 0) errors.push('Исходная амплитуда V₀ должна быть положительным числом');
        if (isNaN(phi0)) errors.push('Исходная фаза φ₀ должна быть числом');
        if (isNaN(Vt) || Vt <= 0) errors.push('Амплитуда с пробным грузом Vₜ должна быть положительным числом');
        if (isNaN(phi_t)) errors.push('Фаза с пробным грузом φₜ должна быть числом');
        if (isNaN(P) || P <= 0) errors.push('Масса пробного груза должна быть положительным числом');

        return { valid: errors.length === 0, errors };
    }

    // Показ статуса
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';

        if (type !== 'info') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Расчет и отображение результатов
    async function calculateAndDisplay() {
        const validation = validateInputs();
        if (!validation.valid) {
            showStatus(`❌ ${validation.errors.join(', ')}`, 'error');
            return;
        }

        const V0 = parseFloat(V0Input.value);
        const phi0 = parseFloat(phi0Input.value);
        const Vt = parseFloat(VtInput.value);
        const phi_t = parseFloat(phi_tInput.value);
        const P = parseFloat(PInput.value);

        calculateBtn.disabled = true;
        calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromMeasurements(V0, phi0, Vt, phi_t, P);

            // Округляем результаты
            const roundedMass = roundMass(result.correction_mass);
            const roundedAngle = roundAngle(result.correction_angle);

            // Обновляем результаты на странице
            document.getElementById('correctionMass').textContent = `${roundedMass} г`;
            document.getElementById('correctionAngle').textContent = `${roundedAngle}°`;

            // Обновляем инструкцию
            document.getElementById('instrMass').textContent = `${roundedMass} г`;
            document.getElementById('instrAngle').textContent = `${roundedAngle}°`;

            // Показываем секцию результатов
            resultsSection.style.display = 'block';

            // Прокручиваем к результатам
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            showStatus('✅ Расчет выполнен успешно!', 'success');

            // Сохраняем в localStorage историю расчетов
            saveToLocalHistory({
                timestamp: new Date().toISOString(),
                method: 'vector',
                V0, phi0, Vt, phi_t, P,
                result: {
                    correction_mass: roundedMass,
                    correction_angle: roundedAngle
                }
            });

        } catch (error) {
            console.error('Ошибка расчета:', error);
            showStatus(`❌ Ошибка расчета: ${error.message}`, 'error');
        } finally {
            calculateBtn.disabled = false;
            calculateBtn.textContent = '🎯 Рассчитать корректирующий груз';
        }
    }

    // Монте-Карло анализ
    async function runMonteCarlo() {
        const validation = validateInputs();
        if (!validation.valid) {
            showStatus(`❌ ${validation.errors.join(', ')}`, 'error');
            return;
        }

        const V0 = parseFloat(V0Input.value);
        const phi0 = parseFloat(phi0Input.value);
        const Vt = parseFloat(VtInput.value);
        const phi_t = parseFloat(phi_tInput.value);
        const P = parseFloat(PInput.value);
        const ampUncertainty = parseFloat(ampUncertaintyInput.value) || 0.1;
        const phaseUncertainty = parseFloat(phaseUncertaintyInput.value) || 2.0;

        monteCarloBtn.disabled = true;
        monteCarloBtn.textContent = '⏳ Анализ...';

        try {
            const result = await balancer.monteCarloSimulation(V0, phi0, Vt, phi_t, P, ampUncertainty, phaseUncertainty);

            // Формируем HTML для результатов
            const html = `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: var(--primary); margin-bottom: 15px;">📊 Статистический анализ (${result.n_simulations} симуляций)</h4>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div style="background: white; border-radius: 8px; padding: 15px;">
                            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 10px;">⚖️ Корректирующий груз</div>
                            <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">${result.mass.mean.toFixed(2)} ± ${result.mass.std.toFixed(2)} г</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                                Диапазон: ${result.mass.min.toFixed(2)} - ${result.mass.max.toFixed(2)} г<br>
                                95% ДИ: [${result.mass.ci_95[0].toFixed(2)}, ${result.mass.ci_95[1].toFixed(2)}] г
                            </div>
                        </div>
                        <div style="background: white; border-radius: 8px; padding: 15px;">
                            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 10px;">🎯 Угол установки</div>
                            <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">${result.angle.mean.toFixed(0)} ± ${result.angle.std.toFixed(0)}°</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                                Диапазон: ${result.angle.min.toFixed(0)} - ${result.angle.max.toFixed(0)}°<br>
                                95% ДИ: [${result.angle.ci_95[0].toFixed(0)}, ${result.angle.ci_95[1].toFixed(0)}]°
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--warning-light); border-radius: 8px; padding: 12px;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            📌 <strong>Интерпретация:</strong><br>
                            Доверительный интервал 95% означает, что при повторных измерениях с указанными погрешностями,
                            истинное значение корректирующего груза с вероятностью 95% находится в указанном диапазоне.
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('monteCarloResults').innerHTML = html;
            monteCarloSection.style.display = 'block';
            monteCarloSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            showStatus('✅ Монте-Карло анализ выполнен', 'success');

        } catch (error) {
            console.error('Ошибка Монте-Карло анализа:', error);
            showStatus(`❌ Ошибка анализа: ${error.message}`, 'error');
        } finally {
            monteCarloBtn.disabled = false;
            monteCarloBtn.textContent = '📊 Монте-Карло анализ';
        }
    }

    // Сохранение в локальную историю
    function saveToLocalHistory(calculation) {
        try {
            let history = localStorage.getItem('vector_balancing_history');
            history = history ? JSON.parse(history) : [];

            history.unshift(calculation);

            if (history.length > 50) history = history.slice(0, 50);

            localStorage.setItem('vector_balancing_history', JSON.stringify(history));
        } catch (error) {
            console.error('Ошибка сохранения истории:', error);
        }
    }

    // Очистка формы
    function resetForm() {
        V0Input.value = '';
        phi0Input.value = '';
        VtInput.value = '';
        phi_tInput.value = '';
        PInput.value = '';
        resultsSection.style.display = 'none';
        monteCarloSection.style.display = 'none';

        showStatus('🔄 Форма очищена', 'info');
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 2000);
    }

    // Загрузка последнего расчета из localStorage
    function loadLastCalculation() {
        try {
            const history = localStorage.getItem('vector_balancing_history');
            if (history) {
                const calculations = JSON.parse(history);
                const last = calculations.find(c => c.method === 'vector');
                if (last) {
                    V0Input.value = last.V0 || '';
                    phi0Input.value = last.phi0 || '';
                    VtInput.value = last.Vt || '';
                    phi_tInput.value = last.phi_t || '';
                    PInput.value = last.P || '';

                    showStatus('📂 Загружен последний расчет', 'info');
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    // Обработчики событий
    calculateBtn.addEventListener('click', calculateAndDisplay);
    monteCarloBtn.addEventListener('click', runMonteCarlo);
    resetBtn.addEventListener('click', resetForm);

    // Загрузка последнего расчета
    loadLastCalculation();

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            calculateAndDisplay();
        }
        if (e.ctrlKey && e.altKey && e.key === 'm') {
            e.preventDefault();
            runMonteCarlo();
        }
    });
});