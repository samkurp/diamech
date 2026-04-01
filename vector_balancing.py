
import math
import numpy as np
from typing import Tuple, Dict, List
import matplotlib.pyplot as plt


class VectorBalancing:
    """
    Векторный метод балансировки с использованием фазоизмерительной аппаратуры
    """

    def __init__(self):
        self.debug = False

    def to_radians(self, degrees):
        """Перевод градусов в радианы"""
        return degrees * math.pi / 180.0

    def to_degrees(self, radians):
        """Перевод радиан в градусы"""
        return radians * 180.0 / math.pi

    def vector_from_polar(self, magnitude, angle_deg):
        """Создает комплексный вектор из полярных координат"""
        rad = self.to_radians(angle_deg)
        return magnitude * (math.cos(rad) + 1j * math.sin(rad))

    def vector_to_polar(self, vector):
        """Преобразует комплексный вектор в полярные координаты"""
        magnitude = abs(vector)
        angle = self.to_degrees(math.atan2(vector.imag, vector.real))
        if angle < 0:
            angle += 360
        return magnitude, angle

    def calculate_from_measurements(self, V0: float, phi0: float,
                                    Vt: float, phi_t: float,
                                    P: float) -> Tuple[float, float]:
        """
        Основной расчет векторным методом

        Параметры:
        V0 - амплитуда исходной вибрации (мкм)
        phi0 - фаза исходной вибрации (градусы)
        Vt - амплитуда вибрации с пробным грузом (мкм)
        phi_t - фаза вибрации с пробным грузом (градусы)
        P - масса пробного груза (г)

        Возвращает:
        (correction_mass, correction_angle) - масса (г) и угол установки (°)
        """

        print("\n" + "=" * 60)
        print("ВЕКТОРНЫЙ МЕТОД БАЛАНСИРОВКИ")
        print("=" * 60)
        print(f"\nИсходные данные:")
        print(f"  V0 = {V0:.2f} мкм @ {phi0:.1f}° (исходная вибрация)")
        print(f"  Vt = {Vt:.2f} мкм @ {phi_t:.1f}° (с пробным грузом)")
        print(f"  Пробный груз = {P:.2f} г")

        # Шаг 1: Представляем векторы в комплексной форме
        V0_complex = self.vector_from_polar(V0, phi0)
        Vt_complex = self.vector_from_polar(Vt, phi_t)

        # Шаг 2: Находим вектор влияния пробного груза
        W_complex = Vt_complex - V0_complex
        W_magnitude, W_angle = self.vector_to_polar(W_complex)

        print(f"\n--- Вектор влияния пробного груза ---")
        print(f"  W = {W_magnitude:.3f} мкм @ {W_angle:.1f}°")

        # Шаг 3: Вычисляем удельное влияние пробного груза
        K_complex = W_complex / P
        K_magnitude, K_angle = self.vector_to_polar(K_complex)

        print(f"\n--- Удельное влияние пробного груза ---")
        print(f"  K = {K_magnitude:.3f} мкм/г @ {K_angle:.1f}°")

        # Шаг 4: Расчет корректирующего груза
        # Корректирующий груз должен создать вектор, равный по величине V0,
        # но противоположный по направлению: G = -V0 / K
        G_complex = -V0_complex / K_complex
        correction_mass, correction_angle = self.vector_to_polar(G_complex)

        print(f"\n--- Результат ---")
        print(f"  Корректирующий груз: {correction_mass:.3f} г")
        print(f"  Угол установки: {correction_angle:.1f}°")
        print("  (отсчет от метки, против часовой стрелки)")

        # Шаг 5: Расчет остаточной вибрации
        residual_complex = V0_complex + K_complex * G_complex
        residual = abs(residual_complex)

        print(f"  Ожидаемая остаточная вибрация: {residual:.2f} мкм")

        return correction_mass, correction_angle

    def monte_carlo_simulation(self, V0, phi0, Vt, phi_t, P,
                               amplitude_uncertainty=0.1,
                               phase_uncertainty=2.0,
                               n_simulations=1000):
        """
        Монте-Карло симуляция для оценки точности
        """
        results_mass = []
        results_angle = []

        for _ in range(n_simulations):
            # Добавляем случайный шум к измерениям
            V0_noise = max(0.01, V0 + np.random.normal(0, amplitude_uncertainty))
            Vt_noise = max(0.01, Vt + np.random.normal(0, amplitude_uncertainty))

            phi0_noise = phi0 + np.random.normal(0, phase_uncertainty)
            phi_t_noise = phi_t + np.random.normal(0, phase_uncertainty)

            # Вычисляем корректирующий груз
            try:
                mass, angle = self.calculate_from_measurements(
                    V0_noise, phi0_noise, Vt_noise, phi_t_noise, P
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

    def graphical_method(self, V0, phi0, Vt, phi_t, P):
        """
        Графический метод для визуализации векторной диаграммы
        """
        fig, ax = plt.subplots(figsize=(12, 12))
        ax.set_aspect('equal')
        ax.grid(True, alpha=0.3)
        ax.axhline(y=0, color='k', linestyle='-', alpha=0.3)
        ax.axvline(x=0, color='k', linestyle='-', alpha=0.3)

        # Вычисляем результат
        correction_mass, correction_angle = self.calculate_from_measurements(
            V0, phi0, Vt, phi_t, P
        )

        # Строим вектор V0
        V0_complex = self.vector_from_polar(V0, phi0)
        ax.arrow(0, 0, V0_complex.real, V0_complex.imag,
                 head_width=V0 * 0.05, head_length=V0 * 0.1,
                 fc='blue', ec='blue', linewidth=2,
                 label=f'V₀ = {V0:.1f} мкм @ {phi0:.1f}°')

        # Строим вектор Vt
        Vt_complex = self.vector_from_polar(Vt, phi_t)
        ax.arrow(0, 0, Vt_complex.real, Vt_complex.imag,
                 head_width=Vt * 0.05, head_length=Vt * 0.1,
                 fc='green', ec='green', linewidth=2,
                 label=f'Vₜ = {Vt:.1f} мкм @ {phi_t:.1f}°')

        # Строим вектор влияния W = Vt - V0
        W_complex = Vt_complex - V0_complex
        W_magnitude, W_angle = self.vector_to_polar(W_complex)
        ax.arrow(V0_complex.real, V0_complex.imag,
                 W_complex.real, W_complex.imag,
                 head_width=W_magnitude * 0.05, head_length=W_magnitude * 0.1,
                 fc='red', ec='red', linestyle='--', linewidth=2,
                 label=f'W = {W_magnitude:.1f} мкм @ {W_angle:.1f}°')

        # Строим вектор корректирующего груза
        K_complex = W_complex / P
        G_complex = -V0_complex / K_complex
        correction_mass, correction_angle = self.vector_to_polar(G_complex)

        ax.arrow(0, 0, G_complex.real, G_complex.imag,
                 head_width=correction_mass * 0.05, head_length=correction_mass * 0.1,
                 fc='orange', ec='orange', linewidth=2,
                 label=f'G = {correction_mass:.1f} г @ {correction_angle:.1f}°')

        # Строим окружности для наглядности
        circle1 = plt.Circle((0, 0), V0, fill=False, linestyle='--', alpha=0.3, color='blue')
        circle2 = plt.Circle((0, 0), Vt, fill=False, linestyle='--', alpha=0.3, color='green')
        ax.add_patch(circle1)
        ax.add_patch(circle2)

        # Настройка графика
        max_val = max(V0, Vt, abs(G_complex)) * 1.2
        ax.set_xlim(-max_val, max_val)
        ax.set_ylim(-max_val, max_val)
        ax.set_xlabel('X, мкм')
        ax.set_ylabel('Y, мкм')
        ax.set_title('Векторная диаграмма - Векторный метод балансировки')
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.show()

        return fig, ax


def main():
    """Пример использования векторного метода"""

    print("=" * 60)
    print("ПРИМЕР РАСЧЕТА ВЕКТОРНЫМ МЕТОДОМ")
    print("=" * 60)

    # Пример данных
    V0 = 2.0  # исходная вибрация, мкм
    phi0 = 45.0  # фаза исходной вибрации, градусы
    Vt = 3.5  # вибрация с пробным грузом, мкм
    phi_t = 95.0  # фаза вибрации с пробным грузом, градусы
    P = 1.0  # масса пробного груза, г

    # Создаем экземпляр класса
    balancer = VectorBalancing()

    # Выполняем расчет
    correction_mass, correction_angle = balancer.calculate_from_measurements(
        V0, phi0, Vt, phi_t, P
    )

    print("\n" + "=" * 60)
    print("ИТОГОВЫЙ РЕЗУЛЬТАТ:")
    print(f"  Установите груз массой {correction_mass:.2f} г")
    print(f"  на угол {correction_angle:.1f}°")
    print("  (относительно метки, против часовой стрелки)")
    print("=" * 60)

    # Монте-Карло анализ
    print("\n" + "=" * 60)
    print("МОНТЕ-КАРЛО АНАЛИЗ С УЧЕТОМ ПОГРЕШНОСТЕЙ")
    print("=" * 60)
    balancer.monte_carlo_simulation(V0, phi0, Vt, phi_t, P)

    # Визуализация
    print("\nСтроим векторную диаграмму...")
    balancer.graphical_method(V0, phi0, Vt, phi_t, P)


def interactive_input():
    """Интерактивный ввод данных"""

    print("\n" + "=" * 60)
    print("ВЕКТОРНЫЙ МЕТОД - ИНТЕРАКТИВНЫЙ РЕЖИМ")
    print("=" * 60)

    try:
        print("\nВведите данные измерений:")
        V0 = float(input("Исходная амплитуда вибрации V0 (мкм): "))
        phi0 = float(input("Исходная фаза вибрации φ0 (градусы): "))
        Vt = float(input("Амплитуда с пробным грузом Vt (мкм): "))
        phi_t = float(input("Фаза с пробным грузом φt (градусы): "))
        P = float(input("Масса пробного груза (г): "))

        balancer = VectorBalancing()
        mass, angle = balancer.calculate_from_measurements(V0, phi0, Vt, phi_t, P)

        print("\n" + "=" * 60)
        print("ИТОГОВЫЙ РЕЗУЛЬТАТ:")
        print(f"  Корректирующий груз: {mass:.3f} г")
        print(f"  Угол установки: {angle:.1f}°")
        print("=" * 60)

        # Предложение визуализации
        show_plot = input("\nПостроить векторную диаграмму? (y/n): ").lower()
        if show_plot == 'y':
            balancer.graphical_method(V0, phi0, Vt, phi_t, P)

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