import math
import numpy as np
from typing import Tuple, Dict, List
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Arc


class ThreeRunBalancing:
    """
    Метод трех пусков для балансировки роторов
    Без использования фазоизмерительной аппаратуры
    """

    def __init__(self):
        self.debug = False
        self.angles = [0, 120, 240]  # Углы установки пробного груза в градусах

    def to_radians(self, degrees):
        """Перевод градусов в радианы"""
        return degrees * math.pi / 180.0

    def to_degrees(self, radians):
        """Перевод радиан в градусы"""
        return radians * 180.0 / math.pi

    def law_of_cosines(self, a, b, c):
        """
        Нахождение угла по теореме косинусов
        a, b, c - стороны треугольника
        Возвращает угол напротив стороны a
        """
        try:
            cos_angle = (b ** 2 + c ** 2 - a ** 2) / (2 * b * c)
            # Ограничиваем значение в пределах [-1, 1]
            cos_angle = max(-1, min(1, cos_angle))
            return math.acos(cos_angle)
        except:
            return math.pi / 2

    def calculate_from_amplitudes(self, V0: float, V1: float, V2: float,
                                  P: float) -> Tuple[float, float]:
        """
        Основной расчет методом трех пусков

        Параметры:
        V0 - амплитуда исходной вибрации (мкм)
        V1 - амплитуда вибрации с грузом P на угле 0°
        V2 - амплитуда вибрации с грузом P на угле 120°
        P - масса пробного груза (г)

        Возвращает:
        (correction_mass, correction_angle) - масса (г) и угол установки (°)
        """

        print("\n" + "=" * 60)
        print("МЕТОД ТРЕХ ПУСКОВ - БАЛАНСИРОВКА БЕЗ ФАЗОМЕТРА")
        print("=" * 60)
        print(f"\nИсходные данные:")
        print(f"  V0 = {V0:.2f} мкм (исходная вибрация)")
        print(f"  V1 = {V1:.2f} мкм (груз {P:.2f} г @ 0°)")
        print(f"  V2 = {V2:.2f} мкм (груз {P:.2f} г @ 120°)")
        print(f"  Пробный груз = {P:.2f} г")

        # Шаг 1: Находим длину вектора влияния W
        # По теореме косинусов находим угол между векторами V1 и V2
        # Векторная диаграмма: V1 = V0 + W, V2 = V0 + W * e^(i*120°)

        # Вычисляем квадраты амплитуд для удобства
        V0_sq = V0 ** 2
        V1_sq = V1 ** 2
        V2_sq = V2 ** 2

        # Находим величину вектора влияния W по формуле:
        # |W|² = (|V1|² + |V2|² - 2*|V1|*|V2|*cos(γ)) / (2*(1-cos(120°)))
        # где γ - угол между V1 и V2

        # Сначала находим угол γ между V1 и V2 через теорему косинусов
        # В треугольнике V1, V2, и разность векторов V1-V2
        delta_sq = V1_sq + V2_sq - 2 * V1 * V2 * math.cos(self.to_radians(120))
        delta = math.sqrt(delta_sq) if delta_sq > 0 else 0

        # Теперь находим угол между V1 и V2
        cos_gamma = (V1_sq + V2_sq - delta_sq) / (2 * V1 * V2)
        cos_gamma = max(-1, min(1, cos_gamma))
        gamma = math.acos(cos_gamma)

        # Вычисляем |W| через решение системы уравнений
        # Используем формулу для нахождения W по методу наименьших квадратов
        # Упрощенный подход через геометрическое построение

        # Находим координаты центра окружности для графического метода
        # Это эквивалентно решению системы:
        # |V0 + W|² = V1²
        # |V0 + W * e^(i*120°)|² = V2²

        # Переводим в декартовы координаты для решения
        # Предполагаем, что V0 направлен по оси X для упрощения
        # Тогда W имеет неизвестные координаты (x, y)

        # Решаем систему уравнений:
        # (V0 + x)² + y² = V1²
        # (V0 + x*cos120° - y*sin120°)² + (x*sin120° + y*cos120°)² = V2²

        cos120 = math.cos(self.to_radians(120))
        sin120 = math.sin(self.to_radians(120))

        # Преобразуем первое уравнение
        # x² + y² + 2*V0*x + V0² - V1² = 0

        # Второе уравнение после упрощения:
        # x² + y² + 2*V0*(x*cos120° - y*sin120°) + V0² - V2² = 0

        # Вычитаем уравнения для нахождения линейной зависимости
        # 2*V0*x - 2*V0*(x*cos120° - y*sin120°) + (V2² - V1²) = 0

        # Решаем относительно y
        A = 2 * V0 * (1 - cos120)
        B = 2 * V0 * sin120
        C = V2_sq - V1_sq

        # y = (C - A*x) / B (если B != 0)

        # Подставляем в первое уравнение и решаем квадратное уравнение
        # Для упрощения используем численное решение

        # Оптимизационный подход
        def objective(point):
            x, y = point
            # Первое уравнение
            eq1 = (V0 + x) ** 2 + y ** 2 - V1 ** 2
            # Второе уравнение
            x_rot = x * cos120 - y * sin120
            y_rot = x * sin120 + y * cos120
            eq2 = (V0 + x_rot) ** 2 + y_rot ** 2 - V2 ** 2
            return eq1 ** 2 + eq2 ** 2

        from scipy.optimize import minimize
        result = minimize(objective, [0, 0], method='Nelder-Mead')

        if result.success:
            Wx, Wy = result.x
            W_magnitude = math.sqrt(Wx ** 2 + Wy ** 2)
            W_angle = self.to_degrees(math.atan2(Wy, Wx))
        else:
            # Fallback к упрощенному методу
            # Приближенный расчет по теореме косинусов
            # Находим W через разность векторов V1 и V0
            # Для этого сначала находим угол α между V0 и V1

            # Используем приближение, что W большой
            # Находим cos(α) из треугольника V0, W, V1
            # V1² = V0² + W² + 2*V0*W*cos(α)

            # Решаем для W через итерационный метод
            W_magnitude = self.estimate_W_magnitude(V0, V1, V2, P)
            W_angle = self.estimate_W_angle(V0, V1, V2, W_magnitude)

        print(f"\n--- Вектор влияния пробного груза ---")
        print(f"  Модуль W: {W_magnitude:.3f} мкм")
        print(f"  Фаза W: {W_angle:.1f}°")

        # Шаг 2: Расчет корректирующего груза
        correction_mass = P * (V0 / W_magnitude)

        # Шаг 3: Определение угла установки
        # Угол корректирующего груза = угол W + угол V0 + 180° (с учетом знаков)
        # В методе трех пусков угол V0 неизвестен, поэтому используем геометрическое построение

        # Находим угол между V0 и W
        # Из треугольника V0, W, V1 по теореме косинусов
        cos_angle_v0_w = (V0 ** 2 + W_magnitude ** 2 - V1 ** 2) / (2 * V0 * W_magnitude)
        cos_angle_v0_w = max(-1, min(1, cos_angle_v0_w))
        angle_v0_w = self.to_degrees(math.acos(cos_angle_v0_w))

        # Определяем знак угла
        # Если V2 > V1, то угол положительный
        if V2 > V1:
            correction_angle = W_angle - angle_v0_w + 180
        else:
            correction_angle = W_angle + angle_v0_w + 180

        # Нормализуем угол
        correction_angle = correction_angle % 360

        print(f"\n--- Результат ---")
        print(f"  Корректирующий груз: {correction_mass:.3f} г")
        print(f"  Угол установки: {correction_angle:.1f}°")

        # Расчет остаточной вибрации
        residual = self.calculate_residual(V0, correction_mass, P, W_magnitude)

        print(f"  Ожидаемая остаточная вибрация: {residual:.2f} мкм")

        return correction_mass, correction_angle

    def estimate_W_magnitude(self, V0, V1, V2, P):
        """Оценка величины вектора влияния"""
        # Метод основан на решении системы уравнений
        # Используем формулу для нахождения W через амплитуды

        # Находим разность между V1 и V2
        delta = math.sqrt(V1 ** 2 + V2 ** 2 - 2 * V1 * V2 * math.cos(self.to_radians(120)))

        # Вычисляем W через геометрические соотношения
        # W = delta / (2 * sin(60°))
        W = delta / (2 * math.sin(self.to_radians(60)))

        return W

    def estimate_W_angle(self, V0, V1, V2, W_magnitude):
        """Оценка угла вектора влияния"""
        # Используем теорему косинусов для нахождения углов
        # Угол между V0 и V1
        cos_angle_0_1 = (V0 ** 2 + W_magnitude ** 2 - V1 ** 2) / (2 * V0 * W_magnitude)
        cos_angle_0_1 = max(-1, min(1, cos_angle_0_1))
        angle_0_1 = self.to_degrees(math.acos(cos_angle_0_1))

        # Угол между V0 и V2
        cos_angle_0_2 = (V0 ** 2 + W_magnitude ** 2 - V2 ** 2) / (2 * V0 * W_magnitude)
        cos_angle_0_2 = max(-1, min(1, cos_angle_0_2))
        angle_0_2 = self.to_degrees(math.acos(cos_angle_0_2))

        # Определяем знак угла
        # Если V2 > V1, то угол между V0 и W положительный
        if V2 > V1:
            angle = angle_0_1
        else:
            angle = -angle_0_1

        return angle

    def calculate_residual(self, V0, correction_mass, test_mass, W_magnitude):
        """Расчет ожидаемой остаточной вибрации"""
        # Остаточная вибрация = |V0 - correction_mass/test_mass * W_magnitude|
        correction_effect = (correction_mass / test_mass) * W_magnitude
        residual = abs(V0 - correction_effect)
        return residual

    def graphical_method(self, V0, V1, V2, P):
        """
        Графический метод для визуализации
        Строит векторную диаграмму и находит корректирующий груз
        """
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.set_aspect('equal')
        ax.grid(True, alpha=0.3)
        ax.axhline(y=0, color='k', linestyle='-', alpha=0.3)
        ax.axvline(x=0, color='k', linestyle='-', alpha=0.3)

        # Находим решение
        W_magnitude, W_angle = self.calculate_from_amplitudes(V0, V1, V2, P)[:2]

        # Строим вектор V0 (направляем по оси X)
        V0_x = V0
        V0_y = 0
        ax.arrow(0, 0, V0_x, V0_y, head_width=V0 * 0.05, head_length=V0 * 0.1,
                 fc='blue', ec='blue', label=f'V0 = {V0:.1f} мкм')

        # Строим вектор W
        W_rad = self.to_radians(W_angle)
        W_x = W_magnitude * math.cos(W_rad)
        W_y = W_magnitude * math.sin(W_rad)
        ax.arrow(0, 0, W_x, W_y, head_width=W_magnitude * 0.05, head_length=W_magnitude * 0.1,
                 fc='red', ec='red', label=f'W = {W_magnitude:.1f} мкм @ {W_angle:.1f}°')

        # Строим вектор V1 = V0 + W
        V1_x = V0_x + W_x
        V1_y = V0_y + W_y
        ax.arrow(0, 0, V1_x, V1_y, head_width=V1 * 0.05, head_length=V1 * 0.1,
                 fc='green', ec='green', label=f'V1 = {V1:.1f} мкм')

        # Строим вектор V2 = V0 + W*e^(i*120°)
        W2_rad = self.to_radians(W_angle + 120)
        W2_x = W_magnitude * math.cos(W2_rad)
        W2_y = W_magnitude * math.sin(W2_rad)
        V2_x = V0_x + W2_x
        V2_y = V0_y + W2_y
        ax.arrow(0, 0, V2_x, V2_y, head_width=V2 * 0.05, head_length=V2 * 0.1,
                 fc='orange', ec='orange', label=f'V2 = {V2:.1f} мкм')

        # Строим окружности для наглядности
        circle1 = Circle((0, 0), V0, fill=False, linestyle='--', alpha=0.5, color='blue')
        circle2 = Circle((0, 0), V1, fill=False, linestyle='--', alpha=0.5, color='green')
        circle3 = Circle((0, 0), V2, fill=False, linestyle='--', alpha=0.5, color='orange')
        ax.add_patch(circle1)
        ax.add_patch(circle2)
        ax.add_patch(circle3)

        # Настройка графика
        max_val = max(V0, V1, V2, W_magnitude) * 1.2
        ax.set_xlim(-max_val, max_val)
        ax.set_ylim(-max_val, max_val)
        ax.set_xlabel('X, мкм')
        ax.set_ylabel('Y, мкм')
        ax.set_title('Векторная диаграмма - Метод трех пусков')
        ax.legend()
        ax.grid(True, alpha=0.3)

        plt.show()

        return fig, ax


class ThreeRunWithOptimization(ThreeRunBalancing):
    """
    Расширенная версия с оптимизацией и учетом погрешностей
    """

    def __init__(self):
        super().__init__()
        self.measurement_uncertainty = 0.1  # Погрешность измерений в мкм

    def monte_carlo_simulation(self, V0, V1, V2, P, n_simulations=1000):
        """
        Монте-Карло симуляция для оценки точности
        """
        results_mass = []
        results_angle = []

        for _ in range(n_simulations):
            # Добавляем случайный шум к измерениям
            V0_noise = V0 + np.random.normal(0, self.measurement_uncertainty)
            V1_noise = V1 + np.random.normal(0, self.measurement_uncertainty)
            V2_noise = V2 + np.random.normal(0, self.measurement_uncertainty)

            # Обеспечиваем положительные значения
            V0_noise = max(0.01, V0_noise)
            V1_noise = max(0.01, V1_noise)
            V2_noise = max(0.01, V2_noise)

            # Вычисляем корректирующий груз
            try:
                mass, angle = self.calculate_from_amplitudes(
                    V0_noise, V1_noise, V2_noise, P
                )
                results_mass.append(mass)
                results_angle.append(angle)
            except:
                continue

        # Статистический анализ
        mass_mean = np.mean(results_mass)
        mass_std = np.std(results_mass)
        angle_mean = np.mean(results_angle)
        angle_std = np.std(results_angle)

        print(f"\n--- Монте-Карло анализ ({n_simulations} симуляций) ---")
        print(f"  Масса: {mass_mean:.3f} ± {mass_std:.3f} г")
        print(f"  Угол: {angle_mean:.1f} ± {angle_std:.1f}°")

        # Доверительные интервалы
        mass_ci_95 = [mass_mean - 1.96 * mass_std, mass_mean + 1.96 * mass_std]
        angle_ci_95 = [angle_mean - 1.96 * angle_std, angle_mean + 1.96 * angle_std]

        print(f"  Доверительный интервал 95% для массы: [{mass_ci_95[0]:.3f}, {mass_ci_95[1]:.3f}] г")
        print(f"  Доверительный интервал 95% для угла: [{angle_ci_95[0]:.1f}, {angle_ci_95[1]:.1f}]°")

        return {
            'mass': {'mean': mass_mean, 'std': mass_std, 'ci_95': mass_ci_95},
            'angle': {'mean': angle_mean, 'std': angle_std, 'ci_95': angle_ci_95}
        }

    def sensitivity_analysis(self, V0, V1, V2, P):
        """
        Анализ чувствительности к погрешностям измерений
        """
        perturbations = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2]
        results = {
            'V0': {'mass': [], 'angle': []},
            'V1': {'mass': [], 'angle': []},
            'V2': {'mass': [], 'angle': []}
        }

        for pert in perturbations:
            # Изменяем V0
            V0_mod = max(0.01, V0 * (1 + pert))
            mass, angle = self.calculate_from_amplitudes(V0_mod, V1, V2, P)
            results['V0']['mass'].append(mass)
            results['V0']['angle'].append(angle)

            # Изменяем V1
            V1_mod = max(0.01, V1 * (1 + pert))
            mass, angle = self.calculate_from_amplitudes(V0, V1_mod, V2, P)
            results['V1']['mass'].append(mass)
            results['V1']['angle'].append(angle)

            # Изменяем V2
            V2_mod = max(0.01, V2 * (1 + pert))
            mass, angle = self.calculate_from_amplitudes(V0, V1, V2_mod, P)
            results['V2']['mass'].append(mass)
            results['V2']['angle'].append(angle)

        print(f"\n--- Анализ чувствительности ---")
        for param, values in results.items():
            mass_sensitivity = np.std(values['mass']) / np.mean(values['mass']) * 100
            angle_sensitivity = np.std(values['angle'])
            print(f"  {param}: масса ± {mass_sensitivity:.1f}%, угол ± {angle_sensitivity:.1f}°")

        return results


def main():
    """
    Пример использования метода трех пусков
    """

    # Пример данных
    print("=" * 60)
    print("ПРИМЕР РАСЧЕТА МЕТОДОМ ТРЕХ ПУСКОВ")
    print("=" * 60)

    # Входные данные
    V0 = 2.0  # Исходная вибрация, мкм
    V1 = 3.5  # Вибрация с грузом на 0°, мкм
    V2 = 4.2  # Вибрация с грузом на 120°, мкм
    P = 1.0  # Масса пробного груза, г

    # Создаем экземпляр класса
    balancer = ThreeRunBalancing()

    # Выполняем расчет
    correction_mass, correction_angle = balancer.calculate_from_amplitudes(V0, V1, V2, P)

    print("\n" + "=" * 60)
    print("РЕЗУЛЬТАТ:")
    print(f"  Установите груз массой {correction_mass:.2f} г")
    print(f"  на угол {correction_angle:.1f}°")
    print("  (относительно метки, в направлении вращения)")
    print("=" * 60)

    # Дополнительный анализ с оптимизацией
    print("\n" + "=" * 60)
    print("РАСШИРЕННЫЙ АНАЛИЗ С УЧЕТОМ ПОГРЕШНОСТЕЙ")
    print("=" * 60)

    advanced = ThreeRunWithOptimization()

    # Монте-Карло симуляция
    advanced.monte_carlo_simulation(V0, V1, V2, P, n_simulations=500)

    # Анализ чувствительности
    advanced.sensitivity_analysis(V0, V1, V2, P)

    # Визуализация
    print("\nСтроим векторную диаграмму...")
    balancer.graphical_method(V0, V1, V2, P)


def interactive_input():
    """
    Интерактивный ввод данных
    """
    print("\n" + "=" * 60)
    print("МЕТОД ТРЕХ ПУСКОВ - ИНТЕРАКТИВНЫЙ РЕЖИМ")
    print("=" * 60)

    try:
        V0 = float(input("\nИсходная вибрация V0 (мкм): "))
        V1 = float(input("Вибрация с грузом на 0° V1 (мкм): "))
        V2 = float(input("Вибрация с грузом на 120° V2 (мкм): "))
        P = float(input("Масса пробного груза (г): "))

        balancer = ThreeRunBalancing()
        mass, angle = balancer.calculate_from_amplitudes(V0, V1, V2, P)

        print("\n" + "=" * 60)
        print("ИТОГОВЫЙ РЕЗУЛЬТАТ:")
        print(f"  Корректирующий груз: {mass:.3f} г")
        print(f"  Угол установки: {angle:.1f}°")
        print("=" * 60)

        # Предложение визуализации
        show_plot = input("\nПостроить векторную диаграмму? (y/n): ").lower()
        if show_plot == 'y':
            balancer.graphical_method(V0, V1, V2, P)

    except ValueError:
        print("Ошибка: введите корректные числовые значения")


if __name__ == "__main__":
    print("\nВЫБЕРИТЕ РЕЖИМ РАБОТЫ:")
    print("1 - Демонстрационный режим (с примером данных)")
    print("2 - Интерактивный режим (ввод своих данных)")
    print("3 - Выход")

    choice = input("\nВаш выбор (1/2/3): ")

    if choice == '1':
        main()
    elif choice == '2':
        interactive_input()
    else:
        print("Выход из программы.")