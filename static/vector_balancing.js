// Класс для векторного метода балансировки с накоплением КВ
class VectorBalancing {
    constructor() {
        this.apiEndpoint = '/api/balancing/vector';
        this.resetEndpoint = '/api/balancing/vector/reset';
        this.measurementsCount = 0;
        this.currentK = null;
    }

    async calculateFromMeasurements(V0, phi0, Vt, phi_t, P, angleInstalled = 0, isCorrection = false) {
        console.log('Векторный метод балансировки:', { V0, phi0, Vt, phi_t, P, angleInstalled, isCorrection });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    V0, phi0, Vt, phi_t, P,
                    angle_installed: angleInstalled,
                    is_correction: isCorrection
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Ошибка расчета');
            }

            // Обновляем счетчик измерений и КВ
            if (data.session_info) {
                this.measurementsCount = data.session_info.measurements_count;
                this.currentK = {
                    magnitude: data.session_info.current_K_magnitude,
                    angle: data.session_info.current_K_angle
                };
            }

            return data;

        } catch (error) {
            console.error('Ошибка API расчета:', error);
            throw error;
        }
    }

    async resetSession() {
        try {
            const response = await fetch(this.resetEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.measurementsCount = 0;
            this.currentK = null;
            console.log('Сессия сброшена');
            return data;
        } catch (error) {
            console.error('Ошибка сброса сессии:', error);
        }
    }

    getMeasurementsCount() {
        return this.measurementsCount;
    }

    getCurrentK() {
        return this.currentK;
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
    const angleInstalledInput = document.getElementById('angleInstalled');
    const calculateBtn = document.getElementById('calculateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resetSessionBtn = document.getElementById('resetSessionBtn');
    const resultsSection = document.getElementById('resultsSection');
    const statusMessage = document.getElementById('statusMessage');
    const sessionInfoDiv = document.getElementById('sessionInfo');

    // Если элемента с angleInstalled нет в HTML, создаем его
    if (!angleInstalledInput) {
        const formRow = document.querySelector('.form-row:last-child');
        if (formRow) {
            const newGroup = document.createElement('div');
            newGroup.className = 'form-group';
            newGroup.innerHTML = `
                <label for="angleInstalled">Угол установки груза (°)</label>
                <input type="number" id="angleInstalled" step="0.1" value="0" placeholder="0° для пробного груза">
            `;
            formRow.appendChild(newGroup);
        }
    }

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

    // Обновление информации о сессии
    function updateSessionInfo() {
        const count = balancer.getMeasurementsCount();
        const currentK = balancer.getCurrentK();

        if (sessionInfoDiv) {
            if (count > 0) {
                let infoHtml = `<div style="background: var(--primary-bg); padding: 10px; border-radius: 8px; margin-bottom: 15px;">`;
                infoHtml += `<strong>📊 Сессия балансировки:</strong> ${count} измерение(й)`;
                if (currentK) {
                    infoHtml += `<br><strong>🔬 Текущий КВ:</strong> |K| = ${currentK.magnitude} @ ${currentK.angle}°`;
                }
                if (count > 1) {
                    infoHtml += `<br><span style="color: #28a745;">✅ КВ уточнен после ${count} пусков</span>`;
                }
                infoHtml += `</div>`;
                sessionInfoDiv.innerHTML = infoHtml;
                sessionInfoDiv.style.display = 'block';
            } else {
                sessionInfoDiv.style.display = 'none';
            }
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
        const angleInstalled = parseFloat(document.getElementById('angleInstalled')?.value) || 0;

        // Определяем, корректирующий это пуск или пробный
        const isCorrection = balancer.getMeasurementsCount() > 0;

        calculateBtn.disabled = true;
        calculateBtn.textContent = '⏳ Расчет...';

        try {
            const result = await balancer.calculateFromMeasurements(V0, phi0, Vt, phi_t, P, angleInstalled, isCorrection);

            // Округляем результаты
            const roundedMass = roundMass(result.result.correction_mass);
            const roundedAngle = roundAngle(result.result.correction_angle);

            // Обновляем результаты на странице
            document.getElementById('correctionMass').textContent = `${roundedMass} г`;
            document.getElementById('correctionAngle').textContent = `${roundedAngle}°`;

            // Обновляем инструкцию
            document.getElementById('instrMass').textContent = `${roundedMass} г`;
            document.getElementById('instrAngle').textContent = `${roundedAngle}°`;

            // Показываем ожидаемую вибрацию если есть
            if (result.result.expected_vibration) {
                let expectedHtml = document.getElementById('expectedVibration');
                if (!expectedHtml) {
                    const instrDiv = document.getElementById('installationInstructions');
                    expectedHtml = document.createElement('p');
                    expectedHtml.id = 'expectedVibration';
                    expectedHtml.style.marginTop = '10px';
                    expectedHtml.style.fontWeight = '500';
                    instrDiv.appendChild(expectedHtml);
                }
                expectedHtml.innerHTML = `📉 <strong>Ожидаемая остаточная вибрация:</strong> ${result.result.expected_vibration} мкм`;
            }

            // Показываем информацию о сессии
            if (result.session_info) {
                const infoMsg = `📊 Измерений в сессии: ${result.session_info.measurements_count} | |K| = ${result.session_info.current_K_magnitude} @ ${result.session_info.current_K_angle}°`;
                showStatus(infoMsg, 'success');

                if (result.session_info.measurements_count > 1) {
                    const improvementMsg = document.createElement('div');
                    improvementMsg.className = 'status-message success';
                    improvementMsg.style.marginTop = '10px';
                    improvementMsg.innerHTML = `✅ <strong>КВ уточнен!</strong> Использовано ${result.session_info.measurements_count} пусков. Точность повышена.`;
                    document.querySelector('.form-container').insertBefore(improvementMsg, resultsSection);
                    setTimeout(() => improvementMsg.remove(), 5000);
                }
            }

            // Показываем секцию результатов
            resultsSection.style.display = 'block';
            updateSessionInfo();
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Сохраняем в localStorage историю расчетов
            saveToLocalHistory({
                timestamp: new Date().toISOString(),
                method: 'vector_adaptive',
                V0, phi0, Vt, phi_t, P,
                angle_installed: angleInstalled,
                is_correction: isCorrection,
                result: {
                    correction_mass: roundedMass,
                    correction_angle: roundedAngle
                },
                measurements_count: balancer.getMeasurementsCount()
            });

            // Подсказка для следующего шага
            if (balancer.getMeasurementsCount() === 1) {
                showStatus('💡 Подсказка: После установки корректирующего груза, сделайте новый пуск и введите новые значения для уточнения КВ!', 'info');
            }

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

            // Храним последние 50 расчетов
            if (history.length > 50) history = history.slice(0, 50);

            localStorage.setItem('vector_balancing_history', JSON.stringify(history));
        } catch (error) {
            console.error('Ошибка сохранения истории:', error);
        }
    }

    // Очистка формы (только поля ввода)
    function resetForm() {
        V0Input.value = '';
        phi0Input.value = '';
        VtInput.value = '';
        phi_tInput.value = '';
        PInput.value = '';
        if (angleInstalledInput) angleInstalledInput.value = '0';

        resultsSection.style.display = 'none';

        // Удаляем сообщение об ожидаемой вибрации
        const expectedHtml = document.getElementById('expectedVibration');
        if (expectedHtml) expectedHtml.remove();

        showStatus('🔄 Форма очищена', 'info');
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 2000);
    }

    // Полный сброс сессии (очистка формы + сброс накопленного КВ)
    async function resetFullSession() {
        const confirmed = confirm('Сбросить сессию балансировки? Все накопленные данные КВ будут потеряны.');
        if (!confirmed) return;

        try {
            await balancer.resetSession();
            resetForm();
            updateSessionInfo();
            showStatus('🔄 Сессия балансировки полностью сброшена. Начинаем с чистого листа.', 'success');

            // Добавляем подсказку
            setTimeout(() => {
                showStatus('💡 Теперь это первый пуск. Введите данные пробного пуска (груз на 0°).', 'info');
            }, 2000);
        } catch (error) {
            showStatus(`❌ Ошибка сброса: ${error.message}`, 'error');
        }
    }

    // Загрузка последнего расчета из localStorage
    function loadLastCalculation() {
        try {
            const history = localStorage.getItem('vector_balancing_history');
            if (history) {
                const calculations = JSON.parse(history);
                const last = calculations.find(c => c.method === 'vector_adaptive');
                if (last) {
                    V0Input.value = last.V0 || '';
                    phi0Input.value = last.phi0 || '';
                    VtInput.value = last.Vt || '';
                    phi_tInput.value = last.phi_t || '';
                    PInput.value = last.P || '';
                    if (angleInstalledInput) angleInstalledInput.value = last.angle_installed || 0;

                    showStatus('📂 Загружен последний расчет. Нажмите "Рассчитать" для продолжения.', 'info');
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    // Создание кнопки сброса сессии если её нет
    function ensureResetSessionButton() {
        if (!resetSessionBtn && document.querySelector('.form-container')) {
            const btnContainer = document.querySelector('.form-container');
            const newBtn = document.createElement('button');
            newBtn.id = 'resetSessionBtn';
            newBtn.textContent = '🔄 Сбросить сессию';
            newBtn.className = 'back-button';
            newBtn.style.background = '#dc3545';
            newBtn.style.color = 'white';
            newBtn.style.marginLeft = '10px';
            newBtn.onclick = resetFullSession;

            const existingReset = document.getElementById('resetBtn');
            if (existingReset) {
                existingReset.parentNode.insertBefore(newBtn, existingReset.nextSibling);
            } else if (calculateBtn) {
                calculateBtn.parentNode.appendChild(newBtn);
            }
        } else if (resetSessionBtn) {
            resetSessionBtn.onclick = resetFullSession;
        }
    }

    // Добавляем информационный блок для сессии
    function addSessionInfoBlock() {
        if (!document.getElementById('sessionInfo') && document.querySelector('.form-container')) {
            const infoBlock = document.createElement('div');
            infoBlock.id = 'sessionInfo';
            infoBlock.style.marginBottom = '15px';
            document.querySelector('.form-container').insertBefore(infoBlock, document.querySelector('.form-section'));
        }
    }

    // Обработчики событий
    if (calculateBtn) calculateBtn.addEventListener('click', calculateAndDisplay);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);

    // Добавляем подсказку при первом запуске
    function showWelcomeHint() {
        const hasHistory = localStorage.getItem('vector_balancing_history');
        if (!hasHistory) {
            setTimeout(() => {
                showStatus('💡 Первый пуск: установите пробный груз на 0°, измерьте вибрацию и введите данные.', 'info');
            }, 1000);
        }
    }

    // Инициализация
    addSessionInfoBlock();
    ensureResetSessionButton();
    loadLastCalculation();
    updateSessionInfo();
    showWelcomeHint();

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            calculateAndDisplay();
        }
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            resetFullSession();
        }
    });
});