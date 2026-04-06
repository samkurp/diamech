"""
Модуль для расчетов балансировки роторов
"""
import math


def calculate_balancing(V0, V1, V2, V3, P):
    """
    Расчет балансировки методом трех пусков
    
    Args:
        V0: начальная вибрация
        V1: вибрация после пробного запуска под 0°
        V2: вибрация после пробного запуска под 120°
        V3: вибрация после пробного запуска под 240°
        P: масса пробного груза
    
    Returns:
        dict с результатами расчета (корректирующий груз и угол)
    """
    # Преобразование амплитуд в квадраты для расчетов
    V0_2 = V0 ** 2
    V1_2 = V1 ** 2
    V2_2 = V2 ** 2
    V3_2 = V3 ** 2

    # Расчет по методу трех пусков
    # Формулы для нахождения вектора дисбаланса
    cos_phi = (V1_2 - V0_2 - V2_2) / (2 * V0 * V2) if (2 * V0 * V2) != 0 else 0

    # Ограничиваем значение в пределах [-1, 1] для arccos
    cos_phi = max(-1, min(1, cos_phi))
    phi = math.acos(cos_phi)

    # Находим минимальную вибрацию
    vib_values = [V1, V2, V3]
    min_index = vib_values.index(min(vib_values))

    # Определяем угол корректирующего груза
    angles = [0, 120, 240]
    correction_angle = angles[min_index]

    # Расчет массы корректирующего груза
    V_min = min(vib_values)
    correction_mass = P * V0 / V_min if V_min > 0 else P

    return {
        'correction_mass': round(correction_mass, 3),
        'correction_angle': round(correction_angle, 1)
    }


def estimate_W_magnitude_simple(V0, V1, V2, V3):
    """
    Упрощенная оценка величины вектора влияния с использованием трех замеров
    """
    def to_radians(degrees):
        return degrees * math.pi / 180.0

    # Используем усреднение по трем парам
    # Для пары 0° и 120°
    delta12 = math.sqrt(V1 ** 2 + V2 ** 2 - 2 * V1 * V2 * math.cos(to_radians(120)))
    W1 = delta12 / (2 * math.sin(to_radians(60)))

    # Для пары 120° и 240°
    delta23 = math.sqrt(V2 ** 2 + V3 ** 2 - 2 * V2 * V3 * math.cos(to_radians(120)))
    W2 = delta23 / (2 * math.sin(to_radians(60)))

    # Для пары 240° и 0°
    delta31 = math.sqrt(V3 ** 2 + V1 ** 2 - 2 * V3 * V1 * math.cos(to_radians(120)))
    W3 = delta31 / (2 * math.sin(to_radians(60)))

    # Усредняем
    W_magnitude = (W1 + W2 + W3) / 3

    return W_magnitude


def estimate_W_angle_simple(V0, V1, V2, V3, W_magnitude):
    """
    Упрощенная оценка угла вектора влияния
    """
    def to_degrees(radians):
        return radians * 180.0 / math.pi

    # Используем тригонометрические соотношения для определения угла
    # По значению вибрации V1 (угол 0°)
    try:
        cos_angle_1 = (V1 ** 2 - V0 ** 2 - W_magnitude ** 2) / (2 * V0 * W_magnitude)
        cos_angle_1 = max(-1, min(1, cos_angle_1))
        angle_1 = to_degrees(math.acos(cos_angle_1))
    except:
        angle_1 = 0

    # По значению вибрации V2 (угол 120°)
    try:
        cos_angle_2 = (V2 ** 2 - V0 ** 2 - W_magnitude ** 2) / (2 * V0 * W_magnitude)
        cos_angle_2 = max(-1, min(1, cos_angle_2))
        base_angle_2 = to_degrees(math.acos(cos_angle_2))
        angle_2 = 120 - base_angle_2
    except:
        angle_2 = 120

    # По значению вибрации V3 (угол 240°)
    try:
        cos_angle_3 = (V3 ** 2 - V0 ** 2 - W_magnitude ** 2) / (2 * V0 * W_magnitude)
        cos_angle_3 = max(-1, min(1, cos_angle_3))
        base_angle_3 = to_degrees(math.acos(cos_angle_3))
        angle_3 = 240 + base_angle_3
    except:
        angle_3 = 240

    # Усредняем оценки угла
    W_angle = (angle_1 + angle_2 + angle_3) / 3

    # Нормализуем угол в диапазон [0, 360)
    W_angle = W_angle % 360

    return W_angle


def calculate_vector_balancing(V0, V1, V2, V3, P):
    """
    Расчет векторной балансировки с определением вектора влияния
    
    Args:
        V0: начальная вибрация
        V1: вибрация после пробного запуска под 0°
        V2: вибрация после пробного запуска под 120°
        V3: вибрация после пробного запуска под 240°
        P: масса пробного груза
    
    Returns:
        dict с полными результатами векторной балансировки
    """
    # Оцениваем величину и угол вектора влияния
    W_magnitude = estimate_W_magnitude_simple(V0, V1, V2, V3)
    W_angle = estimate_W_angle_simple(V0, V1, V2, V3, W_magnitude)

    # Расчет начального дисбаланса
    U_initial = V0 / W_magnitude if W_magnitude > 0 else 0

    # Расчет корректирующего груза
    correction_mass = U_initial
    correction_angle = (W_angle + 180) % 360

    # Прогноз остаточной вибрации
    residual_vibration = V0 * 0.1  # Оценка 10% от начальной

    return {
        'initial_vibration': round(V0, 3),
        'W_magnitude': round(W_magnitude, 3),
        'W_angle': round(W_angle, 1),
        'U_initial': round(U_initial, 3),
        'correction_mass': round(correction_mass, 3),
        'correction_angle': round(correction_angle, 1),
        'residual_vibration': round(residual_vibration, 3),
        'v1': round(V1, 3),
        'v2': round(V2, 3),
        'v3': round(V3, 3)
    }
