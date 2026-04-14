// Класс для векторного метода балансировки
class VectorBalancing {
    constructor() {
        this.apiEndpoint = '/api/balancing/vector';
    }

    async calculateFromMeasurements(V0, phi0, Vt, phi_t, P, rotationDirection = 'cw') {
        console.log('Векторный метод балансировки:', { V0, phi0, Vt, phi_t, P, rotationDirection });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    V0,
                    phi0,
                    Vt,
                    phi_t,
                    P,
                    rotation_direction: rotationDirection
                })
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
    const rotationDirectionSelect = document.getElementById('rotationDirection');
    const calculateBtn = document.getElementById('calculateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultsSection = document.getElementById('resultsSection');
    const statusMessage = document.getElementById('statusMessage');
    const angleDirectionEl = document.getElementById('angleDirection');

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
        const rotationDirection = rotationDirectionSelect.value;

        calculateBtn.disabled = true;
        calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromMeasurements(V0, phi0, Vt, phi_t, P, rotationDirection);

            // Округляем результаты
            const roundedMass = roundMass(result.correction_mass);
            const roundedAngle = roundAngle(result.correction_angle);

            // Обновляем результаты на странице
            document.getElementById('correctionMass').textContent = `${roundedMass} г`;
            document.getElementById('correctionAngle').textContent = `${roundedAngle}°`;

            // Обновляем инструкцию
            document.getElementById('instrMass').textContent = `${roundedMass} г`;
            document.getElementById('instrAngle').textContent = `${roundedAngle}°`;

            // Обновляем текст направления в инструкции
            if (rotationDirection === 'cw') {
                angleDirectionEl.textContent = 'в противоположную сторону вращения ротора (по часовой стрелке)';
            } else {
                angleDirectionEl.textContent = 'в сторону вращения ротора (против часовой стрелки)';
            }

            // Показываем секцию результатов
            resultsSection.style.display = 'block';

            // Прокручиваем к результатам
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            showStatus('✅ Расчет выполнен успешно!', 'success');

            // Сохраняем в localStorage историю расчетов
            saveToLocalHistory({
                timestamp: new Date().toISOString(),
                method: 'vector',
                V0, phi0, Vt, phi_t, P, rotationDirection,
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
        rotationDirectionSelect.value = 'cw';
        resultsSection.style.display = 'none';

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

                    if (last.rotationDirection) {
                        rotationDirectionSelect.value = last.rotationDirection;
                    }

                    showStatus('📂 Загружен последний расчет', 'info');
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    // Обработчики событий
    calculateBtn.addEventListener('click', calculateAndDisplay);
    resetBtn.addEventListener('click', resetForm);

    // Загрузка последнего расчета
    loadLastCalculation();

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            calculateAndDisplay();
        }
    });
});