// Класс для метода трех пусков
class ThreeRunBalancing {
    constructor() {
        this.angles = [0, 120, 240];
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }

    async calculateFromAmplitudes(V0, V1, V2, P) {
        console.log('Расчет методом трех пусков:', { V0, V1, V2, P });

        try {
            const response = await fetch('/api/balancing/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ V0, V1, V2, P })
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
    const balancer = new ThreeRunBalancing();

    // DOM элементы
    const V0Input = document.getElementById('V0');
    const V1Input = document.getElementById('V1');
    const V2Input = document.getElementById('V2');
    const PInput = document.getElementById('P');
    const calculateBtn = document.getElementById('calculateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultsSection = document.getElementById('resultsSection');
    const statusMessage = document.getElementById('statusMessage');

    // Проверка валидности ввода
    function validateInputs() {
        const V0 = parseFloat(V0Input.value);
        const V1 = parseFloat(V1Input.value);
        const V2 = parseFloat(V2Input.value);
        const P = parseFloat(PInput.value);

        const errors = [];

        if (isNaN(V0) || V0 <= 0) errors.push('Исходная вибрация V₀ должна быть положительным числом');
        if (isNaN(V1) || V1 <= 0) errors.push('Вибрация V₁ должна быть положительным числом');
        if (isNaN(V2) || V2 <= 0) errors.push('Вибрация V₂ должна быть положительным числом');
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
        const V1 = parseFloat(V1Input.value);
        const V2 = parseFloat(V2Input.value);
        const P = parseFloat(PInput.value);

        // Показываем индикатор загрузки
        calculateBtn.disabled = true;
        calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromAmplitudes(V0, V1, V2, P);

            // Обновляем результаты на странице
            document.getElementById('correctionMass').textContent = `${result.correction_mass} г`;
            document.getElementById('correctionAngle').textContent = `${result.correction_angle}°`;
            document.getElementById('Wmagnitude').textContent = `${result.W_magnitude} мкм`;
            document.getElementById('Wangle').textContent = `${result.W_angle}°`;
            document.getElementById('residualVibration').textContent = `${result.residual} мкм`;

            // Обновляем инструкцию
            document.getElementById('instrMass').textContent = `${result.correction_mass} г`;
            document.getElementById('instrAngle').textContent = `${result.correction_angle}°`;

            // Показываем секцию результатов
            resultsSection.style.display = 'block';

            // Прокручиваем к результатам
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            showStatus('✅ Расчет выполнен успешно!', 'success');

            // Сохраняем в localStorage историю расчетов
            saveToLocalHistory({
                timestamp: new Date().toISOString(),
                V0, V1, V2, P,
                result
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
            let history = localStorage.getItem('three_run_balancing_history');
            history = history ? JSON.parse(history) : [];

            history.unshift(calculation); // Добавляем в начало

            // Ограничиваем до 50 записей
            if (history.length > 50) history = history.slice(0, 50);

            localStorage.setItem('three_run_balancing_history', JSON.stringify(history));
        } catch (error) {
            console.error('Ошибка сохранения истории:', error);
        }
    }

    // Очистка формы
    function resetForm() {
        V0Input.value = '';
        V1Input.value = '';
        V2Input.value = '';
        PInput.value = '';
        resultsSection.style.display = 'none';

        showStatus('🔄 Форма очищена', 'info');
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 2000);
    }

    // Загрузка последнего расчета из localStorage
    function loadLastCalculation() {
        try {
            const history = localStorage.getItem('three_run_balancing_history');
            if (history) {
                const calculations = JSON.parse(history);
                if (calculations.length > 0) {
                    const last = calculations[0];
                    V0Input.value = last.V0 || '';
                    V1Input.value = last.V1 || '';
                    V2Input.value = last.V2 || '';
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